"""Heart-attack risk assessment API (Flask + MySQL) used by the Angular front-end in ../myapp.

Roles
    patient (role "user")  registers, runs risk assessments with their own health measurements
                           and keeps a private history of them
    admin                  manages the training dataset, users and contact messages and sees
                           system-wide activity and the state of the prediction model

Configuration (all optional, defaults suit a local XAMPP install):
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    ADMIN_USER, ADMIN_PASSWORD   built-in admin login (default admin / admin)
    SECRET_KEY                   signs login tokens (random per start if unset)
    CORS_ORIGINS                 comma separated list (default: Angular dev server)
    PORT                         port to listen on (default 5000)
"""
import csv
import io
import json
import logging
import os
import re
import secrets
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from functools import wraps
from hmac import compare_digest

import mysql.connector
import numpy as np
import pandas as pd
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

log = logging.getLogger("heart-api")
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # CSV uploads up to 5 MB
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200")
CORS(app, origins=[o.strip() for o in _origins.split(",") if o.strip()])

DB_CONFIG = dict(
    host=os.environ.get("DB_HOST", "localhost"),
    port=int(os.environ.get("DB_PORT", "3306")),
    database=os.environ.get("DB_NAME", "dsdb"),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", ""),
)
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

FEATURES = ["age", "sex", "cp", "trtbps", "chol", "fbs", "restecg",
            "thalachh", "exng", "oldpeak", "slp", "caa", "thall"]
COLUMNS = FEATURES + ["output"]

# Allowed values / ranges for every dataset column (used for predictions and CSV loading).
CHOICES = {
    "sex": {0, 1}, "cp": {0, 1, 2, 3}, "fbs": {0, 1}, "restecg": {0, 1, 2},
    "exng": {0, 1}, "slp": {0, 1, 2}, "caa": {0, 1, 2, 3, 4}, "thall": {0, 1, 2, 3},
    "output": {0, 1},
}
RANGES = {
    "age": (1, 120), "trtbps": (50, 300), "chol": (100, 600),
    "thalachh": (50, 250), "oldpeak": (0, 10),
}
MIN_TRAIN_ROWS = 20

# In the public heart dataset this app is built around (heart.csv) the `output` column is the
# reverse of what its name suggests: output=1 means NO heart disease (exercise angina, blocked
# vessels and ST depression all occur mostly when output=0, high max heart rate when output=1).
# `DISEASE_LABEL` is the output value that means "prone to heart attack". Set the environment
# variable OUTPUT_1_MEANS_DISEASE=1 if you load a dataset that is labelled the other way round.
DISEASE_LABEL = 1 if os.environ.get("OUTPUT_1_MEANS_DISEASE", "0") == "1" else 0

# risk bands used everywhere (history badges, admin statistics)
LOW_RISK_BELOW = 20.0
HIGH_RISK_FROM = 50.0


# --------------------------------------------------------------------------- helpers
@contextmanager
def db():
    """Yield a cursor on a fresh connection; commit on success, roll back on error."""
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        conn.close()


def now_iso():
    """Current server time with UTC offset, e.g. 2026-10-17T00:55:14+05:30."""
    return datetime.now().astimezone().isoformat(timespec="seconds")


def iso(value):
    """MySQL DATETIME (naive, server local time) -> ISO string with offset."""
    return value.astimezone().isoformat(timespec="seconds") if isinstance(value, datetime) else None


def num(value):
    """Decimal/float -> int when it is a whole number, else float (keeps JSON tidy)."""
    value = float(value)
    return int(value) if value.is_integer() else value


def err(message, status=400):
    return jsonify({"error": message}), status


def body():
    return request.get_json(silent=True) or {}


def text(data, key, maxlen=255):
    value = data.get(key)
    return value.strip()[:maxlen] if isinstance(value, str) else ""


def int_id(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def valid_value(column, raw):
    """Return the float value if `raw` is valid for `column`, else None."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(value):
        return None
    if column in CHOICES:
        return value if value in CHOICES[column] else None
    low, high = RANGES[column]
    return value if low <= value <= high else None


# --------------------------------------------------------------------------- schema
ASSESSMENTS_DDL = """
CREATE TABLE IF NOT EXISTS assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  age DOUBLE, sex DOUBLE, cp DOUBLE, trtbps DOUBLE, chol DOUBLE, fbs DOUBLE, restecg DOUBLE,
  thalachh DOUBLE, exng DOUBLE, oldpeak DOUBLE, slp DOUBLE, caa DOUBLE, thall DOUBLE,
  risk_percent DECIMAL(5,1) NOT NULL,
  prediction TINYINT NOT NULL,
  model VARCHAR(40),
  model_accuracy DECIMAL(5,2),
  factors TEXT NULL,
  INDEX idx_assessments_user (user_email, created_at)
)"""

CONTACT_DDL = """
CREATE TABLE IF NOT EXISTS contactform (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stname VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  msg TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)"""

_schema_lock = threading.Lock()
_schema_ready = False


def ensure_schema():
    """Create / extend the tables added after the first version. Only ever adds things."""
    global _schema_ready
    with _schema_lock:
        if _schema_ready:
            return
        with db() as cur:
            cur.execute(ASSESSMENTS_DDL)
            cur.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'contactform'", (DB_CONFIG["database"],))
            cols = {r[0].lower() for r in cur.fetchall()}
            if not cols:
                cur.execute(CONTACT_DDL)
            else:
                if "id" not in cols:
                    cur.execute("ALTER TABLE contactform ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST")
                if "created_at" not in cols:
                    cur.execute("ALTER TABLE contactform ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
        _schema_ready = True
        log.info("Database schema is up to date")


@app.before_request
def _prepare():
    if request.method != "OPTIONS" and request.endpoint != "health":
        ensure_schema()


# --------------------------------------------------------------------------- auth
def _serializer():
    return URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="heart-api-auth")


def issue_token(email, role):
    return _serializer().dumps({"email": email, "role": role})


def require_auth(role=None):
    """Require a valid bearer token; `role` ('admin' or 'user') restricts who may call the view."""
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            token = header[7:] if header.startswith("Bearer ") else ""
            try:
                claims = _serializer().loads(token, max_age=8 * 3600)
            except SignatureExpired:
                return err("Session expired, please log in again", 401)
            except BadSignature:
                return err("Please log in first", 401)
            if role and claims.get("role") != role:
                return err("Admin access required" if role == "admin" else "This is only available to patient accounts", 403)
            g.claims = claims
            return view(*args, **kwargs)
        return wrapper
    return decorator


# --------------------------------------------------------------------------- errors
@app.errorhandler(mysql.connector.Error)
def handle_db_error(exc):
    log.error("Database error: %s", exc)
    return err("Database error - is MySQL running and is the 'dsdb' schema set up?", 503)


@app.errorhandler(Exception)
def handle_unexpected(exc):
    if isinstance(exc, HTTPException):
        return err(exc.description, exc.code)
    log.exception("Unhandled error")
    return err("Unexpected server error", 500)


@app.route("/")
def health():
    return jsonify({"status": "ok", "service": "heart-api"})


# --------------------------------------------------------------------------- public routes
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^[6-9][0-9]{9}$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z ]*$")
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{5,64}$")
GENDERS = {"Male", "Female", "Others"}


@app.route("/regdata", methods=["POST"])
def regdata():
    d = body()
    name, email, phone = text(d, "stname", 50), text(d, "email", 50).lower(), text(d, "phone", 10)
    addr, gender, pwd = text(d, "addr1", 4000), text(d, "gender", 50), d.get("pswd") or ""
    if not NAME_RE.match(name):
        return err("Invalid name")
    if not EMAIL_RE.match(email):
        return err("Invalid email address")
    if not PHONE_RE.match(phone):
        return err("Invalid phone number")
    if gender not in GENDERS:
        return err("Please select a gender")
    if not isinstance(pwd, str) or not PASSWORD_RE.match(pwd):
        return err("Password needs an upper-case letter, a lower-case letter, a digit and 5+ characters")

    try:
        with db() as cur:
            cur.execute(
                "INSERT INTO userdata(uname, email, phone, addr, gender, pswd) VALUES (%s,%s,%s,%s,%s,%s)",
                (name, email, phone, addr, gender, generate_password_hash(pwd)),
            )
    except mysql.connector.IntegrityError:
        return err("Email already present", 409)
    return jsonify({"message": "Data Saved Successfully"})


@app.route("/logdata", methods=["POST"])
def logdata():
    d = body()
    email, pwd = text(d, "email", 50), d.get("pswd") or ""
    if not email or not isinstance(pwd, str) or not pwd:
        return err("Email and password are required", 400)

    if compare_digest(email, ADMIN_USER) and compare_digest(pwd, ADMIN_PASSWORD):
        return jsonify({"role": "admin", "name": "Administrator", "token": issue_token(ADMIN_USER, "admin")})

    with db() as cur:
        cur.execute("SELECT id, pswd, uname FROM userdata WHERE email = %s", (email.lower(),))
        row = cur.fetchone()
        if row:
            uid, stored, uname = row
            if stored and stored.startswith(("scrypt:", "pbkdf2:")):
                ok = check_password_hash(stored, pwd)
            else:  # legacy plain-text password: accept once and upgrade it to a hash
                ok = bool(stored) and compare_digest(stored, pwd)
                if ok:
                    try:
                        cur.execute("UPDATE userdata SET pswd=%s WHERE id=%s",
                                    (generate_password_hash(pwd), uid))
                    except mysql.connector.Error as exc:
                        log.warning("Could not upgrade password hash (run migrate_existing_db.sql): %s", exc)
            if ok:
                return jsonify({"role": "user", "name": uname or email.split("@")[0],
                                "token": issue_token(email.lower(), "user")})
    return err("Credentials not found", 401)


@app.route("/contactdata", methods=["POST"])
def contactdata():
    d = body()
    name, email, phone, msg = text(d, "stname"), text(d, "email"), text(d, "phone", 20), text(d, "msg", 5000)
    if not NAME_RE.match(name):
        return err("Invalid name")
    if not EMAIL_RE.match(email):
        return err("Invalid email address")
    if phone and not PHONE_RE.match(phone):
        return err("Invalid phone number")
    if not msg:
        return err("Please enter a message")
    with db() as cur:
        cur.execute("INSERT INTO contactform(stname, email, phone, msg) VALUES (%s,%s,%s,%s)",
                    (name, email, phone, msg))
    return jsonify({"message": "Thank you! Your message was sent and we will get back to you soon."})


@app.route("/me")
@require_auth()
def me():
    claims = g.claims
    if claims["role"] == "admin":
        return jsonify({"name": "Administrator", "email": claims["email"], "role": "admin"})
    with db() as cur:
        cur.execute("SELECT uname FROM userdata WHERE email = %s", (claims["email"],))
        row = cur.fetchone()
    return jsonify({"name": row[0] if row else claims["email"], "email": claims["email"], "role": "user"})


# --------------------------------------------------------------------------- prediction model
_model_lock = threading.Lock()
_model_cache = {"signature": None, "bundle": None}


def _load_training_frame():
    with db() as cur:
        cur.execute("SELECT COUNT(*), COALESCE(MAX(id), 0) FROM dataset")
        signature = cur.fetchone()
        cur.execute(f"SELECT {', '.join(COLUMNS)} FROM dataset")
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=COLUMNS).apply(pd.to_numeric, errors="coerce").dropna()
    return signature, df


def get_model():
    """Train (or reuse) the best of several models for the current contents of the dataset table.

    Models are compared with stratified k-fold cross-validation, which is far more reliable on a
    few hundred rows than a single train/test split; the winner is then refitted on every row.
    """
    signature, df = _load_training_frame()
    with _model_lock:
        if _model_cache["signature"] == signature and _model_cache["bundle"]:
            return _model_cache["bundle"]

        counts = df["output"].value_counts()
        if len(df) < MIN_TRAIN_ROWS or len(counts) < 2 or counts.min() < 2:
            raise ValueError(
                f"Not enough training data to build a model yet ({len(df)} usable records). "
                "Please ask an administrator to load the training dataset.")

        X, y = df[FEATURES], df["output"].astype(int)
        folds = StratifiedKFold(n_splits=min(5, int(counts.min())), shuffle=True, random_state=0)
        candidates = {
            "Logistic Regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
            "SVM": make_pipeline(StandardScaler(), SVC(kernel="linear", probability=True, random_state=0)),
            "KNN": make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=7)),
            "Random Forest": RandomForestClassifier(n_estimators=150, random_state=0),
        }
        scores = {name: cross_val_score(model, X, y, cv=folds).mean() for name, model in candidates.items()}
        best = max(scores, key=scores.get)
        candidates[best].fit(X, y)  # final model uses every row
        bundle = {"model": candidates[best], "name": best,
                  "accuracy": round(scores[best] * 100, 2), "rows": len(df),
                  "medians": X.median().to_dict(), "trainedAt": now_iso()}
        _model_cache.update(signature=signature, bundle=bundle)
        return bundle


def disease_risk(bundle, rows):
    """Probability (0..1) of the 'prone to heart attack' class for every row in `rows`."""
    model = bundle["model"]
    proba = model.predict_proba(pd.DataFrame(rows, columns=FEATURES))
    return proba[:, list(model.classes_).index(DISEASE_LABEL)]


def _logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def explain(bundle, values, risk):
    """What drove this result.

    For every measurement the patient's value is replaced by the training-data median and the risk
    is recomputed. The change is measured in log-odds, which stays meaningful even when the risk is
    close to 0% or 100%. A positive impact means the patient's own value pushes the risk UP, a
    negative one means it pulls the risk DOWN; only the relative size of the impacts matters.
    """
    medians = bundle["medians"]
    variants = []
    for i, feature in enumerate(FEATURES):
        alt = list(values)
        alt[i] = medians[feature]
        variants.append(alt)
    impacts = _logit(risk) - _logit(disease_risk(bundle, variants))
    ranked = sorted(zip(FEATURES, impacts), key=lambda t: -abs(t[1]))
    return [{"feature": f, "impact": round(float(x), 2)} for f, x in ranked[:6] if abs(x) >= 0.05]


# --------------------------------------------------------------------------- patient: assessments
ASSESSMENT_FIELDS = ["id", "created_at"] + FEATURES + ["risk_percent", "prediction", "model", "model_accuracy", "factors"]


def assessment_json(row):
    r = dict(zip(ASSESSMENT_FIELDS, row))
    return {
        "id": r["id"],
        "createdAt": iso(r["created_at"]),
        "inputs": {f: num(r[f]) for f in FEATURES},
        "riskPercent": float(r["risk_percent"]),
        "prediction": int(r["prediction"]),
        "model": r["model"],
        "accuracy": float(r["model_accuracy"]) if r["model_accuracy"] is not None else None,
        "factors": json.loads(r["factors"]) if r["factors"] else [],
    }


@app.route("/predictdata", methods=["POST"])
@require_auth()
def predictdata():
    d = body()
    values = []
    for column in FEATURES:
        value = valid_value(column, d.get(column))
        if value is None:
            return err(f'Invalid or missing value for "{column}"')
        values.append(value)

    try:
        bundle = get_model()
    except ValueError as exc:
        return err(str(exc), 422)

    risk = float(disease_risk(bundle, [values])[0])
    risk_percent = round(risk * 100, 1)
    prediction = int(risk >= 0.5)  # 1 = prone to heart attack, 0 = not prone
    factors = explain(bundle, values, risk)

    result = {"prediction": prediction, "riskPercent": risk_percent, "factors": factors,
              "model": bundle["name"], "accuracy": bundle["accuracy"], "trainedOn": bundle["rows"],
              "saved": False}

    # a patient's assessment is saved to their own history; an admin only tries the model
    if g.claims["role"] == "user":
        with db() as cur:
            cur.execute(
                f"INSERT INTO assessments(user_email, {', '.join(FEATURES)}, risk_percent, prediction, model, "
                f"model_accuracy, factors) VALUES (%s, {', '.join(['%s'] * len(FEATURES))}, %s, %s, %s, %s, %s)",
                (g.claims["email"], *values, risk_percent, prediction, bundle["name"], bundle["accuracy"],
                 json.dumps(factors)))
            result["assessmentId"] = cur.lastrowid
        result["saved"] = True
        result["createdAt"] = now_iso()
    return jsonify(result)


@app.route("/assessments")
@require_auth("user")
def assessments():
    with db() as cur:
        cur.execute(f"SELECT {', '.join(ASSESSMENT_FIELDS)} FROM assessments WHERE user_email = %s "
                    "ORDER BY created_at DESC, id DESC LIMIT 200", (g.claims["email"],))
        rows = [assessment_json(r) for r in cur.fetchall()]
    return jsonify({"rows": rows, "asOf": now_iso()})


@app.route("/assessments/delete", methods=["POST"])
@require_auth("user")
def assessments_delete():
    assessment_id = int_id(body().get("id"))
    if assessment_id is None:
        return err('The "id" parameter is required')
    with db() as cur:  # a patient can only delete their own records
        cur.execute("DELETE FROM assessments WHERE id = %s AND user_email = %s", (assessment_id, g.claims["email"]))
        deleted = cur.rowcount
    if not deleted:
        return err("Assessment not found", 404)
    return jsonify({"message": "Assessment deleted."})


# --------------------------------------------------------------------------- admin: overview
@app.route("/angadmindashboard")
@require_auth("admin")
def angadmindashboard():
    with db() as cur:
        cur.execute("SELECT gender, COUNT(*) FROM userdata GROUP BY gender")
        counts = dict(cur.fetchall())

        cur.execute("SELECT COUNT(*), COALESCE(SUM(risk_percent < %s), 0), "
                    "COALESCE(SUM(risk_percent >= %s AND risk_percent < %s), 0), "
                    "COALESCE(SUM(risk_percent >= %s), 0) FROM assessments",
                    (LOW_RISK_BELOW, LOW_RISK_BELOW, HIGH_RISK_FROM, HIGH_RISK_FROM))
        total, low, moderate, high = (int(v) for v in cur.fetchone())

        cur.execute("SELECT DATE(created_at), COUNT(*) FROM assessments "
                    "WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY DATE(created_at)")
        per_day = {str(day): n for day, n in cur.fetchall()}

        cur.execute("SELECT output, COUNT(*) FROM dataset GROUP BY output")
        output = {str(k): v for k, v in cur.fetchall()}

    today = datetime.now().date()
    daily = []
    for back in range(13, -1, -1):
        day = today - timedelta(days=back)
        daily.append({"date": day.isoformat(), "count": per_day.get(day.isoformat(), 0)})

    try:
        bundle = get_model()
        model = {"name": bundle["name"], "accuracy": bundle["accuracy"], "trainedOn": bundle["rows"],
                 "trainedAt": bundle["trainedAt"]}
    except ValueError:
        model = None

    genders = {gname: counts.get(gname, 0) for gname in ("Female", "Male", "Others")}
    return jsonify({
        "genders": genders, "total": sum(counts.values()), "asOf": now_iso(),
        "assessments": {"total": total, "levels": {"low": low, "moderate": moderate, "high": high}, "daily": daily},
        "dataset": {"records": sum(output.values()),
                    "prone": output.get(str(DISEASE_LABEL), 0),
                    "notProne": output.get(str(1 - DISEASE_LABEL), 0)},
        "model": model,
    })


# --------------------------------------------------------------------------- admin: training dataset
@app.route("/angplanning")
@require_auth("admin")
def angplanning():
    size = min(max(request.args.get("size", 12, type=int), 1), 100)
    page = max(request.args.get("page", 1, type=int), 1)
    with db() as cur:
        cur.execute("SELECT COUNT(*) FROM dataset")
        total = cur.fetchone()[0]
        cur.execute(f"SELECT id, {', '.join(COLUMNS)} FROM dataset ORDER BY id LIMIT %s OFFSET %s",
                    (size, (page - 1) * size))
        rows = [dict(zip(["id"] + COLUMNS, r)) for r in cur.fetchall()]
    return jsonify({"rows": rows, "total": total, "page": page, "size": size, "diseaseLabel": DISEASE_LABEL})


@app.route("/delind", methods=["POST"])
@require_auth("admin")
def delind():
    row_id = int_id(body().get("id"))
    if row_id is None:
        return err('The "id" parameter is required')
    with db() as cur:
        cur.execute("DELETE FROM dataset WHERE id = %s", (row_id,))
        deleted = cur.rowcount
    if not deleted:
        return err("Row not found", 404)
    return jsonify({"message": "Data Deleted Successfully"})


@app.route("/dataparser", methods=["POST"])
@require_auth("admin")
def dataparser():
    upload = request.files.get("csvfile")
    if upload is None or not upload.filename:
        return err("Please choose a CSV file")
    try:
        content = upload.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return err("The file is not a valid UTF-8 CSV")

    rows = [r for r in csv.reader(io.StringIO(content)) if any(c.strip() for c in r)]
    if not rows or [c.strip().lower() for c in rows[0]] != COLUMNS:
        return err("CSV header must be exactly: " + ",".join(COLUMNS))

    clean, invalid = [], 0
    for row in rows[1:]:
        cells = [c.strip() for c in row]
        if len(cells) != len(COLUMNS) or any(valid_value(c, v) is None for c, v in zip(COLUMNS, cells)):
            invalid += 1
            continue
        clean.append(tuple(cells))

    with db() as cur:
        cur.execute(f"SELECT {', '.join(COLUMNS)} FROM dataset")
        existing = {tuple(str(v) for v in r) for r in cur.fetchall()}
        new_rows, duplicates = [], 0
        for r in clean:
            if r in existing:
                duplicates += 1
            else:
                existing.add(r)
                new_rows.append(r)
        if new_rows:
            cur.executemany(
                f"INSERT INTO dataset({', '.join(COLUMNS)}) VALUES ({', '.join(['%s'] * len(COLUMNS))})",
                new_rows)

    return jsonify({
        "message": f"{len(new_rows)} rows loaded, {duplicates} duplicates skipped, {invalid} invalid rows ignored",
        "inserted": len(new_rows), "duplicates": duplicates, "invalid": invalid,
    })


@app.route("/datadelete", methods=["POST"])
@require_auth("admin")
def datadelete():
    with db() as cur:
        cur.execute("TRUNCATE TABLE dataset")
    return jsonify({"message": "Data Cleared"})


# --------------------------------------------------------------------------- admin: users
@app.route("/anguserdata")
@require_auth("admin")
def anguserdata():
    with db() as cur:
        cur.execute("SELECT u.id, u.uname, u.email, u.phone, u.gender, u.addr, "
                    "(SELECT COUNT(*) FROM assessments a WHERE a.user_email = u.email) "
                    "FROM userdata u ORDER BY u.id")
        rows = [dict(zip(["id", "uname", "email", "phone", "gender", "addr", "assessments"], r))
                for r in cur.fetchall()]
    return jsonify({"rows": rows})


@app.route("/anguserdele", methods=["POST"])
@require_auth("admin")
def anguserdele():
    user_id = int_id(body().get("id"))
    if user_id is None:
        return err('The "id" parameter is required')
    with db() as cur:
        cur.execute("SELECT email FROM userdata WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            return err("User not found", 404)
        # removing a patient also removes their private assessment history
        cur.execute("DELETE FROM assessments WHERE user_email = %s", (row[0],))
        cur.execute("DELETE FROM userdata WHERE id = %s", (user_id,))
    return jsonify({"message": "Data Deleted Successfully"})


# --------------------------------------------------------------------------- admin: contact messages
@app.route("/messages")
@require_auth("admin")
def messages():
    with db() as cur:
        cur.execute("SELECT id, stname, email, phone, msg, created_at FROM contactform ORDER BY id DESC LIMIT 200")
        rows = [{"id": r[0], "name": r[1], "email": r[2], "phone": r[3], "message": r[4], "createdAt": iso(r[5])}
                for r in cur.fetchall()]
    return jsonify({"rows": rows})


@app.route("/messages/delete", methods=["POST"])
@require_auth("admin")
def messages_delete():
    message_id = int_id(body().get("id"))
    if message_id is None:
        return err('The "id" parameter is required')
    with db() as cur:
        cur.execute("DELETE FROM contactform WHERE id = %s", (message_id,))
        deleted = cur.rowcount
    if not deleted:
        return err("Message not found", 404)
    return jsonify({"message": "Message deleted."})


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG") == "1")
