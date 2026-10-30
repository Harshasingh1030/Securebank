
USE Securebank_db2;

-- Drop existing routines if present to ensure clean idempotent compilation
DROP FUNCTION IF EXISTS fn_account_balance;
DROP FUNCTION IF EXISTS fn_failed_password_attempts_count;
DROP PROCEDURE IF EXISTS sp_transfer_money;
DROP PROCEDURE IF EXISTS sp_flag_large_transactions;
DROP PROCEDURE IF EXISTS sp_get_account_statement;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- ROUTINE 1: STORED FUNCTION - fn_account_balance
-- Input : p_account_id BIGINT UNSIGNED
-- Return: DECIMAL(15,2) (Current verified balance)
-- Purpose: Encapsulated scalar balance lookup with existence verification.
-- Returns NULL if the account does not exist.
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_account_balance(p_account_id BIGINT UNSIGNED)
RETURNS DECIMAL(15,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_balance DECIMAL(15,2);

    SELECT balance INTO v_balance
    FROM accounts
    WHERE account_id = p_account_id;

    RETURN v_balance;
END$$

-- ----------------------------------------------------------------------------
-- ROUTINE 2: STORED FUNCTION - fn_failed_password_attempts_count
-- Inputs: p_user_id BIGINT UNSIGNED, p_window_minutes INT
-- Return: INT (Number of failed 2FA attempts in recent sliding window)
-- Purpose: Real-time velocity security check to detect active brute-force attacks.
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_failed_password_attempts_count(
    p_user_id BIGINT UNSIGNED, 
    p_window_minutes INT
)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_failed_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_failed_count
    FROM transaction_password_attempts
    WHERE user_id = p_user_id
      AND success = FALSE
      AND attempt_time >= DATE_SUB(NOW(), INTERVAL p_window_minutes MINUTE);

    RETURN v_failed_count;
END$$

-- ----------------------------------------------------------------------------
-- ROUTINE 3: STORED PROCEDURE - sp_transfer_money
-- Purpose: Complete ACID-compliant funds transfer between two bank accounts.
--
-- Security & Business Rules:
-- 1. Amount must be strictly greater than 0.
-- 2. Sender and receiver accounts must be distinct.
-- 3. Sender account must belong to the initiating user.
-- 4. Sender and receiver accounts must exist and have status = 'active'.
-- 5. Tiered 2FA Security Policy:
--    - For transfers > ₹5,000.00, p_password_verified MUST be TRUE (1).
--    - For transfers <= ₹5,000.00, p_password_verified is not required.
-- 6. Deadlock Prevention Strategy:
--    - Both account rows are locked using SELECT ... FOR UPDATE.
--    - Accounts are locked in strictly ascending numerical order of account_id.
-- 7. Sufficient balance verification on locked sender row.
-- 8. Atomic debit + credit + transaction log inside a MySQL transaction.
-- 9. Automatic ROLLBACK on SQL exception or rule violation.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_transfer_money(
    IN  p_sender_account_id   BIGINT UNSIGNED,
    IN  p_receiver_account_id BIGINT UNSIGNED,
    IN  p_initiating_user_id  BIGINT UNSIGNED,
    IN  p_amount              DECIMAL(15,2),
    IN  p_description         VARCHAR(255),
    IN  p_password_verified   BOOLEAN,
    OUT p_transaction_id      BIGINT UNSIGNED,
    OUT p_status_code         VARCHAR(50),
    OUT p_status_message      VARCHAR(255)
)
proc_label: BEGIN
    -- Local state variables
    DECLARE v_first_lock_id       BIGINT UNSIGNED;
    DECLARE v_second_lock_id      BIGINT UNSIGNED;
    DECLARE v_dummy_lock          DECIMAL(15,2);
    DECLARE v_sender_owner_id     BIGINT UNSIGNED;
    DECLARE v_sender_status       VARCHAR(20);
    DECLARE v_sender_balance      DECIMAL(15,2);
    DECLARE v_receiver_status     VARCHAR(20);
    DECLARE v_receiver_exists     INT DEFAULT 0;

    -- Standard SQL exception handler triggers rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_transaction_id = NULL;
        SET p_status_code    = 'SQL_ERROR';
        SET p_status_message = 'Internal database exception encountered. Transaction rolled back.';
    END;

    -- Default output initialization
    SET p_transaction_id = NULL;
    SET p_status_code    = 'INITIALIZING';
    SET p_status_message = '';

    -- ------------------------------------------------------------------------
    -- STEP 1: VALIDATION CHECKS (PRIOR TO TRANSACTION START)
    -- ------------------------------------------------------------------------
    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        SET p_status_code    = 'INVALID_AMOUNT';
        SET p_status_message = 'Transfer amount must be strictly greater than zero.';
        LEAVE proc_label;
    END IF;

    IF p_sender_account_id = p_receiver_account_id THEN
        SET p_status_code    = 'SAME_ACCOUNT';
        SET p_status_message = 'Sender and receiver accounts must be different.';
        LEAVE proc_label;
    END IF;

    -- Tiered 2FA authentication requirement
    IF p_amount > 5000.00 AND (p_password_verified IS NULL OR p_password_verified = FALSE) THEN
        SET p_status_code    = 'AUTH_REQUIRED';
        SET p_status_message = 'Transaction password authentication is required for transfers exceeding ₹5,000.00.';
        LEAVE proc_label;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 2: BEGIN DATABASE TRANSACTION
    -- ------------------------------------------------------------------------
    START TRANSACTION;

    -- Deterministic Deadlock Prevention: Order row locks by ascending account_id
    IF p_sender_account_id < p_receiver_account_id THEN
        SET v_first_lock_id  = p_sender_account_id;
        SET v_second_lock_id = p_receiver_account_id;
    ELSE
        SET v_first_lock_id  = p_receiver_account_id;
        SET v_second_lock_id = p_sender_account_id;
    END IF;

    -- Lock both account rows in strictly ascending sequence without leaking result sets
    SELECT balance INTO v_dummy_lock FROM accounts 
    WHERE account_id = v_first_lock_id 
    FOR UPDATE;

    SELECT balance INTO v_dummy_lock FROM accounts 
    WHERE account_id = v_second_lock_id 
    FOR UPDATE;

    -- ------------------------------------------------------------------------
    -- STEP 3: VERIFY SENDER ACCOUNT
    -- ------------------------------------------------------------------------
    SELECT user_id, status, balance 
    INTO v_sender_owner_id, v_sender_status, v_sender_balance
    FROM accounts
    WHERE account_id = p_sender_account_id;

    IF v_sender_owner_id IS NULL THEN
        ROLLBACK;
        SET p_status_code    = 'SENDER_NOT_FOUND';
        SET p_status_message = 'Sender account ID does not exist.';
        LEAVE proc_label;
    END IF;

    IF v_sender_owner_id <> p_initiating_user_id THEN
        ROLLBACK;
        SET p_status_code    = 'UNAUTHORIZED';
        SET p_status_message = 'Initiating user does not own the designated sender account.';
        LEAVE proc_label;
    END IF;

    IF v_sender_status <> 'active' THEN
        ROLLBACK;
        SET p_status_code    = 'SENDER_INACTIVE';
        SET p_status_message = CONCAT('Sender account is ', v_sender_status, ' and cannot initiate transfers.');
        LEAVE proc_label;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 4: VERIFY RECEIVER ACCOUNT
    -- ------------------------------------------------------------------------
    SELECT status, 1 INTO v_receiver_status, v_receiver_exists
    FROM accounts
    WHERE account_id = p_receiver_account_id;

    IF v_receiver_exists = 0 OR v_receiver_status IS NULL THEN
        ROLLBACK;
        SET p_status_code    = 'RECEIVER_NOT_FOUND';
        SET p_status_message = 'Receiver account ID does not exist.';
        LEAVE proc_label;
    END IF;

    IF v_receiver_status <> 'active' THEN
        ROLLBACK;
        SET p_status_code    = 'RECEIVER_INACTIVE';
        SET p_status_message = CONCAT('Receiver account is ', v_receiver_status, ' and cannot receive transfers.');
        LEAVE proc_label;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 5: VERIFY SENDER SUFFICIENT BALANCE
    -- ------------------------------------------------------------------------
    IF v_sender_balance < p_amount THEN
        ROLLBACK;
        SET p_status_code    = 'INSUFFICIENT_FUNDS';
        SET p_status_message = CONCAT('Insufficient balance. Available: ₹', v_sender_balance, ', Requested: ₹', p_amount);
        LEAVE proc_label;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 6: EXECUTE MONETARY TRANSFER (DEBIT & CREDIT)
    -- ------------------------------------------------------------------------
    -- Debit sender account
    UPDATE accounts
    SET balance = balance - p_amount
    WHERE account_id = p_sender_account_id;

    -- Credit receiver account
    UPDATE accounts
    SET balance = balance + p_amount
    WHERE account_id = p_receiver_account_id;

    -- Record transaction ledger entry
    INSERT INTO transactions (
        sender_account_id,
        receiver_account_id,
        initiated_by_user_id,
        amount,
        description,
        status,
        transaction_time
    )
    VALUES (
        p_sender_account_id,
        p_receiver_account_id,
        p_initiating_user_id,
        p_amount,
        COALESCE(p_description, 'Direct peer-to-peer transfer'),
        'successful',
        NOW()
    );

    SET p_transaction_id = LAST_INSERT_ID();

    -- Commit entire atomic unit of work
    COMMIT;

    SET p_status_code    = 'SUCCESS';
    SET p_status_message = CONCAT('Transfer of ₹', p_amount, ' completed successfully. Transaction ID: ', p_transaction_id);

END proc_label$$

-- ----------------------------------------------------------------------------
-- ROUTINE 4: STORED PROCEDURE - sp_flag_large_transactions
-- Purpose: Scans for successful transactions exceeding a given threshold and
-- inserts fraud alerts while avoiding duplicate alerts.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_flag_large_transactions(
    IN  p_threshold       DECIMAL(15,2),
    OUT p_alerts_created  INT
)
BEGIN
    DECLARE v_before_count INT;
    DECLARE v_after_count  INT;

    SELECT COUNT(*) INTO v_before_count FROM fraud_alerts;

    -- Set-based insert with duplicate avoidance via NOT EXISTS
    INSERT INTO fraud_alerts (
        transaction_id, 
        account_id, 
        rule_type, 
        reason, 
        risk_score, 
        review_status, 
        created_at
    )
    SELECT 
        t.transaction_id,
        t.sender_account_id,
        'HIGH_VALUE_THRESHOLD',
        CONCAT('Automated batch scan: Transaction amount ₹', t.amount, ' exceeds monitoring limit of ₹', p_threshold),
        8,
        'pending',
        NOW()
    FROM transactions t
    WHERE t.status = 'successful'
      AND t.amount > p_threshold
      AND NOT EXISTS (
          SELECT 1 
          FROM fraud_alerts fa 
          WHERE fa.transaction_id = t.transaction_id 
            AND fa.rule_type = 'HIGH_VALUE_THRESHOLD'
      );

    SELECT COUNT(*) INTO v_after_count FROM fraud_alerts;

    SET p_alerts_created = v_after_count - v_before_count;
END$$

-- ----------------------------------------------------------------------------
-- ROUTINE 5: STORED PROCEDURE - sp_get_account_statement
-- Purpose: Produces an itemized ledger statement for an account in date range.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_get_account_statement(
    IN p_account_id BIGINT UNSIGNED,
    IN p_start_date DATETIME,
    IN p_end_date   DATETIME
)
BEGIN
    SELECT 
        t.transaction_id,
        t.transaction_time,
        CASE 
            WHEN t.sender_account_id = p_account_id THEN 'DEBIT'
            ELSE 'CREDIT'
        END AS transaction_type,
        t.amount,
        t.description,
        t.status,
        CASE 
            WHEN t.sender_account_id = p_account_id THEN t.receiver_account_id
            ELSE t.sender_account_id
        END AS counterparty_account_id
    FROM transactions t
    WHERE (t.sender_account_id = p_account_id OR t.receiver_account_id = p_account_id)
      AND t.transaction_time BETWEEN p_start_date AND p_end_date
    ORDER BY t.transaction_time ASC;
END$$

DELIMITER ;

-- ============================================================================
-- DEMONSTRATIONS OF PROCEDURES AND FUNCTIONS
-- ============================================================================

-- Demonstration 1: Stored Function fn_account_balance
SELECT '--- DEMO: FUNCTION fn_account_balance ---' AS demonstration;
SELECT 
    account_id,
    account_number,
    fn_account_balance(account_id) AS computed_balance
FROM accounts;

-- Demonstration 2: Stored Function fn_failed_password_attempts_count
SELECT '--- DEMO: FUNCTION fn_failed_password_attempts_count ---' AS demonstration;
SELECT 
    user_id,
    full_name,
    fn_failed_password_attempts_count(user_id, 1440) AS failed_attempts_last_24hr
FROM users;

-- Demonstration 3: Stored Procedure sp_transfer_money (Low-value transfer <= ₹5000, no PIN needed)
SELECT '--- DEMO: PROCEDURE sp_transfer_money (Low-value ₹1,500) ---' AS demonstration;
CALL sp_transfer_money(101, 103, 2, 1500.00, 'Low-value lunch bill split', FALSE, @out_tx_id, @out_code, @out_msg);
SELECT @out_tx_id AS new_transaction_id, @out_code AS result_code, @out_msg AS result_message;

-- Demonstration 4: Stored Procedure sp_flag_large_transactions
SELECT '--- DEMO: PROCEDURE sp_flag_large_transactions (> ₹50,000) ---' AS demonstration;
CALL sp_flag_large_transactions(50000.00, @out_alerts_created);
SELECT @out_alerts_created AS new_alerts_count;
