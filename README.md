# Heart Attack Prediction

A web app that estimates a person's heart-attack risk from 13 clinical measurements. Patients register, run assessments and keep a private history. Admins manage the training dataset, users and contact messages.

| Part | Folder | Stack |
|---|---|---|
| Front end | `Frontend_Angular/` | Angular 19, Chart.js |
| Back end | `Backend_Flask/` | Flask, MySQL, scikit-learn |

## How it works

When a prediction is requested, the API trains four models on the `dataset` table (Logistic Regression, linear SVM, KNN, Random Forest), scores each with stratified cross-validation and keeps the best one. The model is cached until the dataset changes. It needs at least 20 rows and two examples of each class, otherwise the admin is asked to load data.

Each assessment returns a risk percentage (low below 20%, high from 50%), the model used and its accuracy, and is saved to the patient's history.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- MySQL or MariaDB (for example XAMPP)

## Setup

### 1. Database

```bash
mysql -u root < Backend_Flask/schema.sql
```

This creates the `dsdb` database with its tables. If you already have an older `dsdb`, the API adds the missing tables and columns automatically the first time it runs.

### 2. Backend (http://localhost:5000)

```bash
cd Backend_Flask
pip install -r requirements.txt
cp .env.example .env   # Windows: copy .env.example .env  - then edit the values
python app.py          # or double-click runner.bat on Windows
```

### 3. Frontend (http://localhost:4200)

```bash
cd Frontend_Angular
npm install
npm start
```

The frontend calls the API at `http://localhost:5000` (`API_URL` in `src/app/services/api.service.ts`).

### 4. Load the training data

Log in as admin, open **Dataloader** and upload `Backend_Flask/static/Upload/heart.csv` (max 5 MB). Predictions won't work until a dataset is loaded.

## Configuration

Backend settings and secrets live in `Backend_Flask/.env`, which is git-ignored. Copy `Backend_Flask/.env.example` and fill in your values. Real environment variables also work and take precedence. The database defaults suit a local XAMPP install.

| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST`, `DB_PORT` | `localhost`, `3306` | MySQL server |
| `DB_NAME` | `dsdb` | Database name |
| `DB_USER`, `DB_PASSWORD` | `root`, empty | MySQL login |
| `ADMIN_USER`, `ADMIN_PASSWORD` | none | Built-in admin login. If unset, the admin login is disabled. Use a strong password. |
| `SECRET_KEY` | random per start | Signs login tokens. Set it so logins survive restarts. |
| `CORS_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Allowed front-end origins |
| `PORT` | `5000` | API port |
| `OUTPUT_1_MEANS_DISEASE` | `0` | Set to `1` if your dataset labels disease as `output=1`. In the standard `heart.csv`, `output=1` means no disease. |
| `FLASK_DEBUG` | off | Set to `1` for debug mode |

## Pages

| Route | Access | Page |
|---|---|---|
| `/index`, `/contact`, `/register`, `/login` | public | Home, contact form, sign-up, sign-in |
| `/dashboard`, `/predict`, `/history` | patient | Overview, new risk assessment, past assessments |
| `/admindashboard`, `/usermanagement`, `/dataloader`, `/dataset`, `/messages` | admin | Statistics and model status, users, CSV upload, dataset records, contact messages |

## API

Responses are JSON. Errors have the form `{"error": "..."}`.

| Endpoint | Purpose |
|---|---|
| `POST /regdata`, `/logdata` | Register, log in |
| `POST /contactdata` | Send a contact message |
| `GET /me` | Current user |
| `POST /predictdata` | Run a risk assessment |
| `GET /assessments`, `POST /assessments/delete` | List or delete the patient's history |
| `GET /angadmindashboard` | Admin statistics and model state |
| `GET /angplanning`, `POST /delind` | List or delete dataset rows |
| `POST /dataparser`, `/datadelete` | Upload a CSV, clear the dataset |
| `GET /anguserdata`, `POST /anguserdele` | List or delete users |
| `GET /messages`, `POST /messages/delete` | List or delete contact messages |

## Dataset format

The CSV needs these 14 columns: `age, sex, cp, trtbps, chol, fbs, restecg, thalachh, exng, oldpeak, slp, caa, thall, output`. Values are validated on upload (for example `age` 1–120, `sex` 0/1).

## Scripts (Frontend_Angular)

| Command | Action |
|---|---|
| `npm start` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (Karma and Jasmine) |

## Notes

- Never commit `.env`. For anything beyond local use, set a strong `ADMIN_PASSWORD` and your own `SECRET_KEY`.
