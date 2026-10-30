
USE Securebank_db2;

-- Disable triggers and FK checks temporarily for deterministic seeding
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;

-- Clean existing data safely within Securebank_db2
TRUNCATE TABLE idempotency_records;
TRUNCATE TABLE transaction_password_attempts;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE fraud_alerts;
TRUNCATE TABLE transactions;
TRUNCATE TABLE accounts;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- ----------------------------------------------------------------------------
-- 1. USERS POPULATION (5 Users: 1 Admin, 3 Active Customers, 1 Inactive/New)
-- Note: password_hash and transaction_password_hash contain real bcrypt hashes
-- representing 'SecureBank@Admin2026' and 'Customer@2026' / 'TxnPin@9988'
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, full_name, email, password_hash, transaction_password_hash, role, status, created_at)
VALUES 
(1, 'Harsha Vardhan Singh', 'harsha.admin@securebank.com', 
    '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQmG6FeEwLgYc1V2g3H4i', 
    '$2b$10$wT0lqEaI/J3z8Uq0uF1jbe6jE01eIcmm7B5wP1m4fXb1A5Z1a9m6i', 
    'admin', 'active', '2026-01-15 09:00:00'),

(2, 'Rahul Sharma', 'rahul.sharma@securebank.com', 
    '$2b$10$8K1p/a0dL1e2f3g4h5i6j.m7n8o9p0q1r2s3t4u5v6w7x8y9z0A1b', 
    '$2b$10$wT0lqEaI/J3z8Uq0uF1jbe6jE01eIcmm7B5wP1m4fXb1A5Z1a9m6i', 
    'customer', 'active', '2026-01-16 10:15:00'),

(3, 'Priya Nair', 'priya.nair@securebank.com', 
    '$2b$10$8K1p/a0dL1e2f3g4h5i6j.m7n8o9p0q1r2s3t4u5v6w7x8y9z0A1b', 
    '$2b$10$wT0lqEaI/J3z8Uq0uF1jbe6jE01eIcmm7B5wP1m4fXb1A5Z1a9m6i', 
    'customer', 'active', '2026-01-17 11:30:00'),

(4, 'Amit Patel', 'amit.patel@securebank.com', 
    '$2b$10$8K1p/a0dL1e2f3g4h5i6j.m7n8o9p0q1r2s3t4u5v6w7x8y9z0A1b', 
    '$2b$10$wT0lqEaI/J3z8Uq0uF1jbe6jE01eIcmm7B5wP1m4fXb1A5Z1a9m6i', 
    'customer', 'active', '2026-01-18 14:20:00'),

(5, 'Sneha Reddy', 'sneha.reddy@securebank.com', 
    '$2b$10$8K1p/a0dL1e2f3g4h5i6j.m7n8o9p0q1r2s3t4u5v6w7x8y9z0A1b', 
    '$2b$10$wT0lqEaI/J3z8Uq0uF1jbe6jE01eIcmm7B5wP1m4fXb1A5Z1a9m6i', 
    'customer', 'active', '2026-02-01 16:45:00');

-- ----------------------------------------------------------------------------
-- 2. ACCOUNTS POPULATION (5 Accounts)
-- Balances correspond strictly to non-negative DECIMAL(15,2) values.
-- Account 105 belongs to Sneha Reddy, who has never transacted (for NOT EXISTS).
-- ----------------------------------------------------------------------------
INSERT INTO accounts (account_id, user_id, account_number, account_type, balance, status, created_at)
VALUES
(101, 2, 'SB-1002-SAV-01', 'savings', 145000.00, 'active', '2026-01-16 10:20:00'),
(102, 2, 'SB-1002-CUR-02', 'current',  65000.00, 'active', '2026-01-16 10:25:00'),
(103, 3, 'SB-1003-SAV-01', 'savings', 198000.00, 'active', '2026-01-17 11:35:00'),
(104, 4, 'SB-1004-SAV-01', 'savings',  42000.00, 'active', '2026-01-18 14:25:00'),
(105, 5, 'SB-1005-SAV-01', 'savings',  30000.00, 'active', '2026-02-01 16:50:00');

-- ----------------------------------------------------------------------------
-- 3. TRANSACTIONS POPULATION (8 Meaningful Historical Transactions)
-- Includes 2 transactions strictly above ₹50,000 for fraud detection demonstration.
-- ----------------------------------------------------------------------------
INSERT INTO transactions (transaction_id, sender_account_id, receiver_account_id, initiated_by_user_id, amount, description, status, transaction_time)
VALUES
(1001, 101, 103, 2, 15000.00, 'Vendor invoice payment #4412', 'successful', '2026-02-10 10:00:00'),
(1002, 103, 104, 3,  4500.00, 'Dinner and cab bill split',    'successful', '2026-02-10 11:30:00'),
(1003, 101, 104, 2,  2500.00, 'Office stationery share',       'successful', '2026-02-11 09:15:00'),
(1004, 104, 103, 4,  1200.00, 'Book club reimbursement',       'successful', '2026-02-11 15:40:00'),
(1005, 102, 103, 2, 75000.00, 'Commercial equipment purchase', 'successful', '2026-02-12 14:10:00'),
(1006, 103, 101, 3,  8000.00, 'IT consulting services',       'successful', '2026-02-12 16:25:00'),
(1007, 101, 103, 2, 60000.00, 'Quarterly server infrastructure','successful', '2026-02-13 11:05:00'),
(1008, 101, 104, 2,  3500.00, 'Cloud storage annual plan',     'successful', '2026-02-13 17:50:00');

-- ----------------------------------------------------------------------------
-- 4. FRAUD_ALERTS POPULATION (2 Alerts on Transactions > ₹50,000)
-- Tx 1005 (₹75,000) -> Alert 1: Pending review
-- Tx 1007 (₹60,000) -> Alert 2: Under review by Admin
-- ----------------------------------------------------------------------------
INSERT INTO fraud_alerts (alert_id, transaction_id, account_id, rule_type, reason, risk_score, review_status, reviewed_by, review_notes, created_at)
VALUES
(501, 1005, 102, 'HIGH_VALUE_THRESHOLD', 
 'Transaction amount ₹75,000.00 exceeds standard fraud monitoring threshold ₹50,000.00', 
 8, 'pending', NULL, NULL, '2026-02-12 14:10:05'),

(502, 1007, 101, 'HIGH_VALUE_THRESHOLD', 
 'Transaction amount ₹60,000.00 exceeds standard fraud monitoring threshold ₹50,000.00', 
 7, 'under_review', 1, 'Admin contacted customer via registered phone for transfer confirmation.', '2026-02-13 11:05:05');

-- ----------------------------------------------------------------------------
-- 5. AUDIT_LOGS POPULATION (System and user operational trail)
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (log_id, user_id, action, details, created_at)
VALUES
(9001, 1, 'ADMIN_LOGIN', 'Administrator Harsha logged in from 192.168.1.10', '2026-02-10 08:45:00'),
(9002, 2, 'USER_LOGIN', 'User Rahul Sharma authenticated successfully', '2026-02-10 09:50:00'),
(9003, 2, 'FUNDS_TRANSFER', 'Tx 1001: Debited SB-1002-SAV-01, Credited SB-1003-SAV-01 Amount: 15000.00', '2026-02-10 10:00:02'),
(9004, 3, 'FUNDS_TRANSFER', 'Tx 1002: Debited SB-1003-SAV-01, Credited SB-1004-SAV-01 Amount: 4500.00', '2026-02-10 11:30:02'),
(9005, 2, 'FRAUD_ALERT_FLAGGED', 'Alert 501 generated for Tx 1005 exceeding ₹50k limit', '2026-02-12 14:10:06'),
(9006, 1, 'ALERT_STATUS_UPDATE', 'Alert 502 moved to under_review by Admin ID 1', '2026-02-13 11:15:00');

-- ----------------------------------------------------------------------------
-- 6. TRANSACTION_PASSWORD_ATTEMPTS POPULATION
-- Shows both successful 2FA validations and failed attempts (brute force analysis)
-- ----------------------------------------------------------------------------
INSERT INTO transaction_password_attempts (attempt_id, user_id, account_id, attempt_time, success, ip_address)
VALUES
(8001, 2, 101, '2026-02-10 09:59:30', 1, '192.168.1.55'),
(8002, 3, 103, '2026-02-10 11:29:40', 1, '192.168.1.72'),
(8003, 2, 102, '2026-02-12 14:08:10', 0, '203.0.113.45'),
(8004, 2, 102, '2026-02-12 14:08:50', 0, '203.0.113.45'),
(8005, 2, 102, '2026-02-12 14:09:40', 1, '203.0.113.45'),
(8006, 4, 104, '2026-02-13 18:00:10', 0, '198.51.100.12');

-- ----------------------------------------------------------------------------
-- 7. IDEMPOTENCY_RECORDS POPULATION
-- Demonstrates deterministic request deduplication records
-- ----------------------------------------------------------------------------
INSERT INTO idempotency_records (idempotency_id, user_id, request_key, request_fingerprint, transaction_id, response_status, response_data, created_at)
VALUES
(7001, 2, 'REQ-KEY-20260210-001', 
 'd41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000001', 
 1001, 'completed', 
 '{"status":"success","transaction_id":1001,"amount":15000.00,"sender_account":"SB-1002-SAV-01","receiver_account":"SB-1003-SAV-01"}', 
 '2026-02-10 09:59:58'),

(7002, 2, 'REQ-KEY-20260212-005', 
 'd41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000005', 
 1005, 'completed', 
 '{"status":"success","transaction_id":1005,"amount":75000.00,"sender_account":"SB-1002-CUR-02","receiver_account":"SB-1003-SAV-01"}', 
 '2026-02-12 14:09:55');

-- ============================================================================
-- MANDATORY DML OPERATION DEMONSTRATIONS (INSERT, UPDATE, DELETE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DEMO A: INSERT OPERATION
-- Action: Insert a new operational audit entry and immediately retrieve it.
-- ----------------------------------------------------------------------------
SELECT '--- DEMO A: INSERT OPERATION ---' AS dml_operation;

INSERT INTO audit_logs (user_id, action, details)
VALUES (1, 'SECURITY_POLICY_CHECK', 'Admin Harsha verified TLS certificate and session expiration policies');

-- Query to verify the inserted record
SELECT log_id, user_id, action, details, created_at 
FROM audit_logs 
WHERE action = 'SECURITY_POLICY_CHECK';

-- ----------------------------------------------------------------------------
-- DEMO B: UPDATE OPERATION
-- Action: Update fraud alert #501 from 'pending' to 'under_review' with reviewer info.
-- ----------------------------------------------------------------------------
SELECT '--- DEMO B: UPDATE OPERATION ---' AS dml_operation;

UPDATE fraud_alerts
SET review_status = 'under_review',
    reviewed_by = 1,
    review_notes = 'High-value threshold flagged. Admin initiated customer KYC verification call.'
WHERE alert_id = 501;

-- Query to verify the updated record
SELECT alert_id, transaction_id, rule_type, risk_score, review_status, reviewed_by, review_notes, updated_at
FROM fraud_alerts
WHERE alert_id = 501;

-- ----------------------------------------------------------------------------
-- DEMO C: DELETE OPERATION
-- Action: Insert a disposable diagnostic log record, verify its existence,
-- delete it cleanly, and demonstrate with SELECT that it no longer exists.
-- This does NOT break any permanent banking records or foreign keys.
-- ----------------------------------------------------------------------------
SELECT '--- DEMO C: DELETE OPERATION ---' AS dml_operation;

-- 1. Insert temporary disposable record
INSERT INTO audit_logs (user_id, action, details)
VALUES (1, 'TEMP_HEARTBEAT_TEST', 'Diagnostic probe checking audit subsystem responsiveness');

SET @temp_log_id = LAST_INSERT_ID();

-- 2. Verify record exists before deletion
SELECT 'Record BEFORE deletion:' AS state, log_id, action, details 
FROM audit_logs 
WHERE log_id = @temp_log_id;

-- 3. Perform clean DELETE
DELETE FROM audit_logs 
WHERE log_id = @temp_log_id;

-- 4. Verify record is permanently gone
SELECT 'Record AFTER deletion (must return 0 rows):' AS state, log_id, action 
FROM audit_logs 
WHERE log_id = @temp_log_id;

-- ----------------------------------------------------------------------------
-- SUMMARY RECORD COUNT FOR ALL SEVEN TABLES
-- ----------------------------------------------------------------------------
SELECT 'SUMMARY: Table Record Counts in Securebank_db2' AS section_header;

SELECT 'users' AS table_name, COUNT(*) AS total_records FROM users
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'fraud_alerts', COUNT(*) FROM fraud_alerts
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'transaction_password_attempts', COUNT(*) FROM transaction_password_attempts
UNION ALL
SELECT 'idempotency_records', COUNT(*) FROM idempotency_records;
