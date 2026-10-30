
USE Securebank_db2;

-- Drop existing triggers and cursor routines to guarantee idempotent setup
DROP TRIGGER IF EXISTS trg_transactions_before_insert;
DROP TRIGGER IF EXISTS trg_transactions_after_insert;
DROP TRIGGER IF EXISTS trg_fraud_alerts_after_insert;
DROP PROCEDURE IF EXISTS sp_cursor_review_large_transactions;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- TRIGGER 1: BEFORE INSERT ON TRANSACTIONS
-- Purpose: Schema-level invariant enforcement prior to row persistence.
-- Ensures that no corrupt transaction enters the database, even if inserted
-- via direct raw SQL outside the stored procedure.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_transactions_before_insert
BEFORE INSERT ON transactions
FOR EACH ROW
BEGIN
    -- Invariant 1: Amount must be strictly greater than zero
    IF NEW.amount IS NULL OR NEW.amount <= 0.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trigger validation failure: Transaction amount must be strictly greater than zero.';
    END IF;

    -- Invariant 2: Sender and receiver accounts must be distinct
    IF NEW.sender_account_id = NEW.receiver_account_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Trigger validation failure: Sender and receiver accounts must be distinct.';
    END IF;
END$$

-- ----------------------------------------------------------------------------
-- TRIGGER 2: AFTER INSERT ON TRANSACTIONS
-- Purpose: Automatic compliance & audit trail recording.
-- Executes in the exact same transaction context as the INSERT statement.
-- If the transaction rolls back, this audit log also rolls back automatically.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_transactions_after_insert
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        details,
        created_at
    )
    VALUES (
        NEW.initiated_by_user_id,
        'TRANSACTION_CREATED',
        CONCAT(
            '{"event":"TX_RECORDED"',
            ',"transaction_id":', NEW.transaction_id,
            ',"sender_account_id":', NEW.sender_account_id,
            ',"receiver_account_id":', NEW.receiver_account_id,
            ',"amount":', NEW.amount,
            ',"status":"', NEW.status, '"',
            ',"description":"', COALESCE(NEW.description, ''), '"}'
        ),
        NOW()
    );
END$$

-- ----------------------------------------------------------------------------
-- TRIGGER 3: AFTER INSERT ON FRAUD_ALERTS
-- Purpose: Records automated fraud alert creation in audit_logs.
-- Preserves system actor integrity when reviewed_by is NULL.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_fraud_alerts_after_insert
AFTER INSERT ON fraud_alerts
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        details,
        created_at
    )
    VALUES (
        NEW.reviewed_by, -- NULL for automated alerts; captures reviewer ID if set
        'FRAUD_ALERT_CREATED',
        CONCAT(
            '{"event":"FRAUD_MONITOR_ALERT"',
            ',"alert_id":', NEW.alert_id,
            ',"transaction_id":', NEW.transaction_id,
            ',"account_id":', NEW.account_id,
            ',"rule_type":"', NEW.rule_type, '"',
            ',"risk_score":', NEW.risk_score,
            ',"review_status":"', NEW.review_status, '"}'
        ),
        NOW()
    );
END$$

-- ----------------------------------------------------------------------------
-- ROUTINE: CURSOR STORED PROCEDURE - sp_cursor_review_large_transactions
-- Purpose: Iterates through transactions exceeding a threshold using a cursor,
-- evaluates whether an alert already exists, and inserts new alerts.
--
-- Cursor Lifecycle Demonstrated:
-- 1. DECLARE : Defines cursor query and loop termination state handler.
-- 2. OPEN    : Allocates result set buffer in database server memory.
-- 3. FETCH   : Advances pointer row-by-row into local variables.
-- 4. CLOSE   : Releases cursor resources from memory.
--
-- Performance Comparison (Viva Discussion):
-- Set-based SQL (sp_flag_large_transactions) operates over entire sets using
-- relational algebra and index scans, minimizing context switching.
-- Cursors (sp_cursor_review_large_transactions) process row-by-row (RBAR),
-- which is useful when procedural per-row logic or external APIs are involved,
-- but incurs procedural iteration overhead.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_cursor_review_large_transactions(
    IN  p_threshold     DECIMAL(15,2),
    OUT p_alerts_count  INT
)
BEGIN
    -- Local variables for cursor traversal
    DECLARE v_done          BOOLEAN DEFAULT FALSE;
    DECLARE v_tx_id         BIGINT UNSIGNED;
    DECLARE v_account_id    BIGINT UNSIGNED;
    DECLARE v_amount        DECIMAL(15,2);
    DECLARE v_exists        INT;

    -- Step 1: Cursor Declaration
    DECLARE cur_transactions CURSOR FOR
        SELECT transaction_id, sender_account_id, amount
        FROM transactions
        WHERE status = 'successful'
          AND amount > p_threshold;

    -- Step 2: NOT FOUND condition handler
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    -- Initialize counter
    SET p_alerts_count = 0;

    -- Step 3: Open Cursor
    OPEN cur_transactions;

    -- Step 4: Fetch Loop
    read_loop: LOOP
        FETCH cur_transactions INTO v_tx_id, v_account_id, v_amount;

        IF v_done THEN
            LEAVE read_loop;
        END IF;

        -- Step 5: Check if an alert already exists to prevent duplicate violation
        SELECT COUNT(*) INTO v_exists
        FROM fraud_alerts
        WHERE transaction_id = v_tx_id
          AND rule_type = 'HIGH_VALUE_THRESHOLD';

        IF v_exists = 0 THEN
            INSERT INTO fraud_alerts (
                transaction_id,
                account_id,
                rule_type,
                reason,
                risk_score,
                review_status,
                created_at
            )
            VALUES (
                v_tx_id,
                v_account_id,
                'HIGH_VALUE_THRESHOLD',
                CONCAT('Cursor automated review: High-value transfer of ₹', v_amount, ' exceeds threshold ₹', p_threshold),
                8,
                'pending',
                NOW()
            );

            SET p_alerts_count = p_alerts_count + 1;
        END IF;

    END LOOP read_loop;

    -- Step 6: Close Cursor
    CLOSE cur_transactions;

END$$

DELIMITER ;

-- ============================================================================
-- DEMONSTRATIONS OF TRIGGERS AND CURSOR
-- ============================================================================

-- Demonstration 1: AFTER INSERT Trigger Verification on TRANSACTIONS
SELECT '--- DEMO 1: AFTER INSERT TRIGGER ON TRANSACTIONS ---' AS demonstration;

-- Read audit log count before insert
SELECT COUNT(*) AS audit_logs_before FROM audit_logs WHERE action = 'TRANSACTION_CREATED';

-- Insert a test transaction directly to fire trigger
INSERT INTO transactions (sender_account_id, receiver_account_id, initiated_by_user_id, amount, description, status)
VALUES (101, 104, 2, 850.00, 'Test trigger execution transfer', 'successful');

SET @test_tx_id = LAST_INSERT_ID();

-- Verify that the trigger automatically inserted an audit record
SELECT log_id, user_id, action, details, created_at
FROM audit_logs
WHERE action = 'TRANSACTION_CREATED' AND details LIKE CONCAT('%"transaction_id":', @test_tx_id, '%');

-- Demonstration 2: BEFORE INSERT Trigger Violation Rejection Test
SELECT '--- DEMO 2: BEFORE INSERT TRIGGER ERROR REJECTION (Negative Amount) ---' AS demonstration;
-- The following statement is expected to fail with SQLSTATE 45000:
-- INSERT INTO transactions (sender_account_id, receiver_account_id, initiated_by_user_id, amount) VALUES (101, 103, 2, -100.00);

-- Demonstration 3: Cursor Procedure sp_cursor_review_large_transactions
SELECT '--- DEMO 3: CURSOR PROCEDURE sp_cursor_review_large_transactions ---' AS demonstration;
CALL sp_cursor_review_large_transactions(40000.00, @out_cursor_alerts);
SELECT @out_cursor_alerts AS new_alerts_created_by_cursor;

-- Demonstration 4: Rerunnability Check (Must return 0 new alerts without error)
CALL sp_cursor_review_large_transactions(40000.00, @out_cursor_alerts_rerun);
SELECT @out_cursor_alerts_rerun AS new_alerts_on_rerun_must_be_zero;
