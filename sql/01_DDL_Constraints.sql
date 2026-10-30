
-- ----------------------------------------------------------------------------
-- STEP 1: DATABASE INITIALIZATION
-- ----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS Securebank_db2
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE Securebank_db2;

-- Disable foreign key checks during schema bootstrap to guarantee clean setup
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- TABLE 1: USERS
-- Purpose: Authentication, RBAC (customer/admin), account status lifecycle.
-- Passwords and transaction passwords store valid bcrypt hashes (60 chars).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name                 VARCHAR(100) NOT NULL,
    email                     VARCHAR(254) NOT NULL,
    password_hash             VARCHAR(255) NOT NULL,
    transaction_password_hash VARCHAR(255) NOT NULL,
    role                      VARCHAR(20)  NOT NULL DEFAULT 'customer',
    status                    VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('customer', 'admin')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'locked'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 2: ACCOUNTS
-- Purpose: Core financial accounts mapped to users.
-- Enforces non-negative balance, unique account numbers, and strict FK integrity.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    account_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT UNSIGNED NOT NULL,
    account_number VARCHAR(34)     NOT NULL,
    account_type   VARCHAR(20)     NOT NULL,
    balance        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    status         VARCHAR(20)     NOT NULL DEFAULT 'active',
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT uq_accounts_account_number UNIQUE (account_number),
    CONSTRAINT fk_accounts_user_id FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_accounts_type CHECK (account_type IN ('savings', 'current')),
    CONSTRAINT chk_accounts_status CHECK (status IN ('active', 'inactive', 'frozen')),
    CONSTRAINT chk_accounts_balance_non_negative CHECK (balance >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 3: TRANSACTIONS
-- Purpose: Ledger of all monetary transfers between sender and receiver.
-- Requires positive amount, distinct accounts, and composite indexes for timeline queries.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_account_id     BIGINT UNSIGNED NOT NULL,
    receiver_account_id   BIGINT UNSIGNED NOT NULL,
    initiated_by_user_id  BIGINT UNSIGNED NOT NULL,
    amount                DECIMAL(15,2)   NOT NULL,
    description           VARCHAR(255)    DEFAULT NULL,
    status                VARCHAR(20)     NOT NULL DEFAULT 'successful',
    transaction_time      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_tx_sender_account FOREIGN KEY (sender_account_id)
        REFERENCES accounts (account_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_tx_receiver_account FOREIGN KEY (receiver_account_id)
        REFERENCES accounts (account_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_tx_initiating_user FOREIGN KEY (initiated_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT chk_tx_amount_positive CHECK (amount > 0.00),
    CONSTRAINT chk_tx_sender_receiver_different CHECK (sender_account_id <> receiver_account_id),
    CONSTRAINT chk_tx_status CHECK (status IN ('successful', 'failed', 'pending_review', 'reversed')),

    -- Performance Indexes
    INDEX idx_tx_sender_time (sender_account_id, transaction_time),
    INDEX idx_tx_receiver_time (receiver_account_id, transaction_time),
    INDEX idx_tx_status_time (status, transaction_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 4: FRAUD_ALERTS
-- Purpose: Security subsystem capturing anomalies (large tx, rapid velocity).
-- Enforces 1-10 risk score and unique rule per transaction.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT UNSIGNED NOT NULL,
    account_id     BIGINT UNSIGNED NOT NULL,
    rule_type      VARCHAR(50)     NOT NULL,
    reason         TEXT            NOT NULL,
    risk_score     TINYINT UNSIGNED NOT NULL,
    review_status  VARCHAR(20)     NOT NULL DEFAULT 'pending',
    reviewed_by    BIGINT UNSIGNED DEFAULT NULL,
    review_notes   TEXT            DEFAULT NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_fraud_transaction FOREIGN KEY (transaction_id)
        REFERENCES transactions (transaction_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_fraud_account FOREIGN KEY (account_id)
        REFERENCES accounts (account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_fraud_reviewed_by FOREIGN KEY (reviewed_by)
        REFERENCES users (user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT chk_fraud_risk_score CHECK (risk_score BETWEEN 1 AND 10),
    CONSTRAINT chk_fraud_review_status CHECK (review_status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    CONSTRAINT uq_alert_tx_rule UNIQUE (transaction_id, rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 5: AUDIT_LOGS
-- Purpose: Immutable security & compliance trail recording user/system events.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED DEFAULT NULL,
    action     VARCHAR(100) NOT NULL,
    details    TEXT         NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Index for timeline analysis per user
    INDEX idx_audit_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 6: TRANSACTION_PASSWORD_ATTEMPTS
-- Purpose: Tracking brute-force and credential abuse attempts on 2FA PIN/passwords.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_password_attempts (
    attempt_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED NOT NULL,
    account_id   BIGINT UNSIGNED DEFAULT NULL,
    attempt_time TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success      BOOLEAN         NOT NULL DEFAULT FALSE,
    ip_address   VARCHAR(45)     NOT NULL,

    -- Constraints
    CONSTRAINT fk_pwd_attempt_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_pwd_attempt_account FOREIGN KEY (account_id)
        REFERENCES accounts (account_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Composite indexes for velocity & brute-force attack detection
    INDEX idx_pw_attempts_user_time (user_id, attempt_time),
    INDEX idx_pw_attempts_user_success (user_id, success, attempt_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLE 7: IDEMPOTENCY_RECORDS
-- Purpose: Guarantees at-most-once execution for transfer requests.
-- Prevents duplicate debit/credit when network retries occur.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              BIGINT UNSIGNED NOT NULL,
    request_key          VARCHAR(128)    NOT NULL,
    request_fingerprint  CHAR(64)        NOT NULL,
    transaction_id       BIGINT UNSIGNED DEFAULT NULL,
    response_status      VARCHAR(20)     NOT NULL DEFAULT 'processing',
    response_data        JSON            DEFAULT NULL,
    created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_idempotency_tx FOREIGN KEY (transaction_id)
        REFERENCES transactions (transaction_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT chk_idempotency_status CHECK (response_status IN ('processing', 'completed', 'failed')),
    CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- ----------------------------------------------------------------------------
-- VERIFICATION STATEMENTS
-- ----------------------------------------------------------------------------
SELECT 'SCHEMA VERIFICATION: List of Tables in Securebank_db2' AS verification_step;
SHOW FULL TABLES IN Securebank_db2 WHERE Table_type = 'BASE TABLE';

SELECT 'SCHEMA VERIFICATION: Constraints and Table Engine Check' AS verification_step;
SELECT 
    table_name,
    engine,
    table_collation,
    table_rows
FROM information_schema.tables 
WHERE table_schema = 'Securebank_db2';
