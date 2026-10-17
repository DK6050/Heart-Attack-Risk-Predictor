-- Schema for the Heart Attack Prediction app (database: dsdb).
-- For a FRESH server:   mysql -u root < schema.sql
-- (An existing dsdb should use migrate_existing_db.sql instead.)
CREATE DATABASE IF NOT EXISTS dsdb;
USE dsdb;

CREATE TABLE IF NOT EXISTS dataset (
  id INT AUTO_INCREMENT PRIMARY KEY,
  age VARCHAR(50), sex VARCHAR(50), cp VARCHAR(50), trtbps VARCHAR(50), chol VARCHAR(50),
  fbs VARCHAR(50), restecg VARCHAR(50), thalachh VARCHAR(50), exng VARCHAR(50),
  oldpeak VARCHAR(50), slp VARCHAR(50), caa VARCHAR(50), thall VARCHAR(50), output VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS userdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uname VARCHAR(50), email VARCHAR(50) NOT NULL UNIQUE, phone VARCHAR(10),
  gender VARCHAR(50), ADDR VARCHAR(4000),
  pswd VARCHAR(255)            -- werkzeug password hash
);

CREATE TABLE IF NOT EXISTS contactform (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stname VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '', msg TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- one row per risk assessment a patient runs (private to that patient)
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
);

-- NOTE: the API also creates 'assessments' and adds id / created_at to an older 'contactform'
-- automatically the first time it runs, so existing databases need no manual migration.
