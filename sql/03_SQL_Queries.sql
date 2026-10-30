
USE Securebank_db2;

-- ----------------------------------------------------------------------------
-- QUERY 1: Multi-Table INNER JOIN (USERS, ACCOUNTS, TRANSACTIONS)
-- DBMS Concept: Equi-join across multiple relational entities via foreign keys.
-- Banking Utility: Audits which customer initiated which transfer from their
-- authorized account, displaying full customer name, account number, and amount.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 1: INNER JOIN (USERS, ACCOUNTS, TRANSACTIONS) ---' AS query_title;

SELECT 
    t.transaction_id,
    u.full_name AS sender_name,
    u.email AS sender_email,
    a.account_number AS sender_account,
    t.amount,
    t.status,
    t.transaction_time
FROM transactions t
INNER JOIN accounts a ON t.sender_account_id = a.account_id
INNER JOIN users u    ON a.user_id = u.user_id
ORDER BY t.transaction_id ASC;

-- ----------------------------------------------------------------------------
-- QUERY 2: LEFT OUTER JOIN (All Accounts Including Inactive/Zero-Transfer)
-- DBMS Concept: Outer join preserving all left-table rows regardless of match.
-- Banking Utility: Detects dormant or newly registered accounts that have never
-- initiated any outgoing transaction (such as Sneha's account SB-1005-SAV-01).
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 2: LEFT JOIN (ACCOUNTS WITH OR WITHOUT TRANSACTIONS) ---' AS query_title;

SELECT 
    a.account_id,
    a.account_number,
    a.account_type,
    a.balance,
    COUNT(t.transaction_id) AS total_outgoing_transactions,
    COALESCE(SUM(t.amount), 0.00) AS total_amount_transferred
FROM accounts a
LEFT JOIN transactions t ON a.account_id = t.sender_account_id
GROUP BY a.account_id, a.account_number, a.account_type, a.balance
ORDER BY total_outgoing_transactions ASC;

-- ----------------------------------------------------------------------------
-- QUERY 3: Multi-Alias Self-Join on ACCOUNTS (Sender & Receiver Account Details)
-- DBMS Concept: Multiple joins on the same table using distinct table aliases.
-- Banking Utility: Generates comprehensive bank ledger statements showing both
-- sender and receiver account numbers and owner names in a single record.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 3: TWO-WAY JOIN (SENDER & RECEIVER ACCOUNT DETAILS) ---' AS query_title;

SELECT 
    t.transaction_id,
    u_send.full_name AS sender_customer,
    acc_send.account_number AS sender_account_no,
    u_recv.full_name AS receiver_customer,
    acc_recv.account_number AS receiver_account_no,
    t.amount,
    t.description,
    t.transaction_time
FROM transactions t
INNER JOIN accounts acc_send ON t.sender_account_id = acc_send.account_id
INNER JOIN users u_send      ON acc_send.user_id = u_send.user_id
INNER JOIN accounts acc_recv ON t.receiver_account_id = acc_recv.account_id
INNER JOIN users u_recv      ON acc_recv.user_id = u_recv.user_id
ORDER BY t.transaction_id ASC;

-- ----------------------------------------------------------------------------
-- QUERY 4: GROUP BY Aggregation (Transaction Counts by Account)
-- DBMS Concept: Data aggregation and categorical summarization via GROUP BY.
-- Banking Utility: Profiles customer transaction volume to establish baselines
-- for fraud velocity and AML (Anti-Money Laundering) tier calculation.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 4: GROUP BY (TRANSACTION VOLUME BY ACCOUNT) ---' AS query_title;

SELECT 
    a.account_id,
    a.account_number,
    u.full_name AS account_holder,
    COUNT(t.transaction_id) AS transaction_count
FROM accounts a
INNER JOIN users u ON a.user_id = u.user_id
INNER JOIN transactions t ON a.account_id = t.sender_account_id
GROUP BY a.account_id, a.account_number, u.full_name
ORDER BY transaction_count DESC;

-- ----------------------------------------------------------------------------
-- QUERY 5: Aggregate Functions (SUM, AVG, MIN, MAX Across Transfers)
-- DBMS Concept: Scalar summary computations over relational partitions.
-- Banking Utility: High-level financial analytics revealing system-wide volume,
-- mean transfer size, and boundary statistics for risk management.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 5: AGGREGATE FUNCTIONS (SUM, AVG, MIN, MAX) ---' AS query_title;

SELECT 
    COUNT(*) AS total_successful_transfers,
    SUM(amount) AS gross_settled_amount,
    AVG(amount) AS average_transfer_amount,
    MIN(amount) AS minimum_transfer,
    MAX(amount) AS maximum_transfer
FROM transactions
WHERE status = 'successful';

-- ----------------------------------------------------------------------------
-- QUERY 6: HAVING Clause (Filtering Aggregated Account Volumes)
-- DBMS Concept: Post-aggregation predicate filtering with HAVING.
-- Banking Utility: Flags high-volume sender accounts whose cumulative transfers
-- exceed ₹20,000 for compliance reporting (e.g. tax reporting thresholds).
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 6: HAVING CLAUSE (CUMULATIVE OUTFLOW > ₹20,000) ---' AS query_title;

SELECT 
    a.account_id,
    a.account_number,
    u.full_name AS account_holder,
    COUNT(t.transaction_id) AS total_transfers,
    SUM(t.amount) AS cumulative_amount_sent
FROM accounts a
INNER JOIN users u ON a.user_id = u.user_id
INNER JOIN transactions t ON a.account_id = t.sender_account_id
WHERE t.status = 'successful'
GROUP BY a.account_id, a.account_number, u.full_name
HAVING SUM(t.amount) > 20000.00
ORDER BY cumulative_amount_sent DESC;

-- ----------------------------------------------------------------------------
-- QUERY 7: Scalar Subquery (Accounts with Balance Above System Average)
-- DBMS Concept: Subquery returning a single scalar evaluated dynamically.
-- Banking Utility: Identifies high-net-worth customer accounts eligible for
-- premium relationship management and elevated security monitoring.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 7: SUBQUERY (ACCOUNTS WITH BALANCE > AVERAGE) ---' AS query_title;

SELECT 
    a.account_id,
    a.account_number,
    u.full_name AS owner_name,
    a.balance,
    (SELECT ROUND(AVG(balance), 2) FROM accounts) AS system_average_balance
FROM accounts a
INNER JOIN users u ON a.user_id = u.user_id
WHERE a.balance > (SELECT AVG(balance) FROM accounts)
ORDER BY a.balance DESC;

-- ----------------------------------------------------------------------------
-- QUERY 8: Correlated NOT EXISTS Query (Users with Zero Sent Transactions)
-- DBMS Concept: Correlated existential subquery with NOT EXISTS.
-- Banking Utility: Identifies completely inactive customers or beneficiaries
-- who have never initiated an outgoing transfer, useful for retention marketing.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 8: NOT EXISTS (USERS WHO NEVER SENT A TRANSACTION) ---' AS query_title;

SELECT 
    u.user_id,
    u.full_name,
    u.email,
    u.role,
    u.created_at
FROM users u
WHERE NOT EXISTS (
    SELECT 1 
    FROM transactions t 
    WHERE t.initiated_by_user_id = u.user_id
)
ORDER BY u.user_id ASC;

-- ----------------------------------------------------------------------------
-- QUERY 9: Fraud-Alert Summary Grouped by Rule Type and Review Status
-- DBMS Concept: Multi-column categorical aggregation with conditional counting.
-- Banking Utility: Operational dashboard metrics for the Fraud Operations Center,
-- showing pending vs reviewed fraud incidents by detection rule.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 9: FRAUD ALERT SUMMARY BY RULE TYPE ---' AS query_title;

SELECT 
    rule_type,
    COUNT(*) AS total_alerts,
    AVG(risk_score) AS average_risk_score,
    SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) AS pending_reviews,
    SUM(CASE WHEN review_status = 'under_review' THEN 1 ELSE 0 END) AS under_investigation,
    SUM(CASE WHEN review_status = 'resolved' THEN 1 ELSE 0 END) AS resolved_alerts
FROM fraud_alerts
GROUP BY rule_type;

-- ----------------------------------------------------------------------------
-- QUERY 10: Failed Transaction Password Attempt Analysis (Brute-Force Detection)
-- DBMS Concept: Filtering and temporal grouping on security audit tables.
-- Banking Utility: Detects brute-force 2FA/PIN cracking attempts by analyzing
-- failure rates, source IP addresses, and affected customer accounts.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 10: FAILED PASSWORD ATTEMPTS ANALYSIS ---' AS query_title;

SELECT 
    tpa.user_id,
    u.full_name,
    u.email,
    tpa.ip_address,
    COUNT(*) AS total_failed_attempts,
    MIN(tpa.attempt_time) AS first_failed_at,
    MAX(tpa.attempt_time) AS last_failed_at
FROM transaction_password_attempts tpa
INNER JOIN users u ON tpa.user_id = u.user_id
WHERE tpa.success = FALSE
GROUP BY tpa.user_id, u.full_name, u.email, tpa.ip_address
HAVING COUNT(*) >= 1
ORDER BY total_failed_attempts DESC;

-- ----------------------------------------------------------------------------
-- QUERY 11: High-Value Transactions Above ₹50,000 Threshold
-- DBMS Concept: Value-range predicate filtering with joined contextual data.
-- Banking Utility: Flagged for mandatory AML (Anti-Money Laundering) review,
-- RBI guidelines, and high-tier transaction limits.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 11: TRANSACTIONS ABOVE ₹50,000 ---' AS query_title;

SELECT 
    t.transaction_id,
    t.sender_account_id,
    u_send.full_name AS sender_name,
    t.receiver_account_id,
    u_recv.full_name AS receiver_name,
    t.amount,
    t.status,
    t.transaction_time
FROM transactions t
INNER JOIN accounts a_send ON t.sender_account_id = a_send.account_id
INNER JOIN users u_send    ON a_send.user_id = u_send.user_id
INNER JOIN accounts a_recv ON t.receiver_account_id = a_recv.account_id
INNER JOIN users u_recv    ON a_recv.user_id = u_recv.user_id
WHERE t.amount > 50000.00
ORDER BY t.amount DESC;

-- ----------------------------------------------------------------------------
-- QUERY 12: Rolling 2-Minute Transaction Frequency (Velocity Fraud Detection)
-- DBMS Concept: Self-join with non-equi range join condition on TIMESTAMP.
-- Banking Utility: Flags automated bot attacks and rapid-fire debit card fraud
-- where an account executes > 5 transactions within any 120-second sliding window.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 12: ROLLING 2-MINUTE TRANSACTION FREQUENCY ---' AS query_title;

SELECT 
    t1.sender_account_id,
    acc.account_number,
    t1.transaction_id AS anchor_tx_id,
    t1.transaction_time AS window_start,
    COUNT(t2.transaction_id) AS transactions_in_window
FROM transactions t1
INNER JOIN accounts acc ON t1.sender_account_id = acc.account_id
INNER JOIN transactions t2 
    ON t1.sender_account_id = t2.sender_account_id
    AND t2.transaction_time BETWEEN t1.transaction_time AND DATE_ADD(t1.transaction_time, INTERVAL 2 MINUTE)
GROUP BY t1.sender_account_id, acc.account_number, t1.transaction_id, t1.transaction_time
HAVING COUNT(t2.transaction_id) > 5;

-- ----------------------------------------------------------------------------
-- QUERY 13: Operational Date-Range Query with Parameter Filtering
-- DBMS Concept: Bounded range condition on TIMESTAMP with indexing support.
-- Banking Utility: Generates end-of-day bank reconciliation reports between
-- specified dates and times.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 13: DATE-RANGE FILTERED TRANSACTIONS ---' AS query_title;

SELECT 
    transaction_id,
    sender_account_id,
    receiver_account_id,
    amount,
    status,
    transaction_time
FROM transactions
WHERE transaction_time >= '2026-02-10 00:00:00'
  AND transaction_time <= '2026-02-12 23:59:59'
ORDER BY transaction_time ASC;

-- ----------------------------------------------------------------------------
-- QUERY 14: EXPLAIN Plan for Indexed Transaction Queries
-- DBMS Concept: Query execution optimizer analysis and index usage verification.
-- Demonstrates utilization of idx_tx_sender_time for range-filtered lookups.
-- ----------------------------------------------------------------------------
SELECT '--- QUERY 14: EXPLAIN QUERY PLAN (INDEX VERIFICATION) ---' AS query_title;

EXPLAIN SELECT 
    transaction_id,
    sender_account_id,
    receiver_account_id,
    amount,
    status,
    transaction_time
FROM transactions
WHERE sender_account_id = 101
  AND transaction_time >= '2026-02-10 00:00:00';
