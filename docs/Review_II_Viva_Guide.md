# SecureBank — Review II Viva & Technical Understanding Guide

**Student Name:** Harsha Vardhan Singh  
**Registration Number:** 24BYB0099  
**Institution:** Vellore Institute of Technology, Vellore  
**Course:** BCSE302L — Database Systems (Review II)  
**Database Name:** `Securebank_db2` (MySQL 8.0+ InnoDB)

---

## Evaluation Rubric Overview (10 Marks)

| Category | Component | Marks | Associated Artifact |
|---|---|:---:|---|
| **Cat 1** | DDL & Constraints | **2** | `sql/01_DDL_Constraints.sql` |
| **Cat 2** | DML & Data Population | **1** | `sql/02_DML_Data_Population.sql` |
| **Cat 3** | SQL Queries (Joins, Aggregates, Subqueries) | **2** | `sql/03_SQL_Queries.sql` |
| **Cat 4** | Stored Procedures & Functions | **2** | `sql/04_Procedures_Functions.sql` |
| **Cat 5** | Cursors & Triggers | **2** | `sql/05_Cursor_Triggers.sql` |
| **Cat 6** | Viva & Technical Understanding | **1** | `docs/Review_II_Viva_Guide.md` |
| **Total** | | **10** | **17/17 Automated Tests Passed** |

---

## Viva Question Bank & Demonstrations

### 1. Primary Key vs. Foreign Key
* **Concept:** A **Primary Key (PK)** uniquely identifies each row within a table and enforces entity integrity (`NOT NULL` + `UNIQUE`). A **Foreign Key (FK)** enforces referential integrity by establishing a relationship pointing to the primary key of another table, ensuring child rows cannot reference nonexistent parent entities.
* **SecureBank Example:** `users.user_id` is the PK of `users`. In `accounts`, `user_id` is a Foreign Key referencing `users.user_id` with `ON DELETE RESTRICT ON UPDATE CASCADE`.
* **Viva Demonstration Query:**
  ```sql
  USE Securebank_db2;
  -- Shows PK on accounts and FK linking to users
  SELECT 
      CONSTRAINT_NAME, CONSTRAINT_TYPE 
  FROM information_schema.table_constraints 
  WHERE table_schema = 'Securebank_db2' AND table_name = 'accounts';
  ```

---

### 2. UNIQUE vs. CHECK Constraints
* **Concept:** 
  * A **UNIQUE constraint** guarantees that all non-null values in a column or set of columns are distinct across the table.
  * A **CHECK constraint** validates domain integrity by evaluating a Boolean expression on row insertion/update; the statement fails if the expression evaluates to `FALSE`.
* **SecureBank Example:**
  * UNIQUE: `uq_users_email` prevents two users from registering with the same email address.
  * CHECK: `chk_accounts_balance_non_negative CHECK (balance >= 0.00)` mathematically forbids negative balances (overdrafts) at the database layer.
* **Viva Demonstration Query:**
  ```sql
  -- Attempting negative balance violation (rejected by CHECK constraint)
  UPDATE accounts SET balance = -500.00 WHERE account_id = 101;
  -- Result: Error Code 3819: Check constraint 'chk_accounts_balance_non_negative' is violated.
  ```

---

### 3. Why InnoDB Engine Is Mandatory in Banking
* **Concept:** MySQL supports multiple storage engines. `MyISAM` does not support transactions, row-level locking, or foreign key cascades. `InnoDB` is an **ACID-compliant storage engine** providing:
  1. Complete transactional atomicity (`COMMIT` / `ROLLBACK`).
  2. Row-level locking (`SELECT ... FOR UPDATE`), enabling high concurrency without locking whole tables.
  3. Crash recovery via Write-Ahead Logging (WAL / Redo Log) and Undo Tablespace.
  4. Strict foreign key referential integrity enforcement.
* **SecureBank Demonstration Query:**
  ```sql
  SELECT table_name, engine 
  FROM information_schema.tables 
  WHERE table_schema = 'Securebank_db2';
  ```

---

### 4. Why DECIMAL(15,2) Instead of FLOAT or DOUBLE for Money
* **Concept:** `FLOAT` and `DOUBLE` are IEEE 754 floating-point types that represent fractional numbers approximately using binary fractions, introducing precision rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). In financial systems, accumulating round-off pennies is a severe audit and legal violation. `DECIMAL(M,D)` is an exact numeric fixed-point data type stored as packed binary decimals where every cent/paisa is strictly accurate.
* **SecureBank Specification:** All balances and transaction amounts use `DECIMAL(15,2)` allowing up to ₹9,999,999,999,999.99 with exact 2-decimal precision.

---

### 5. INSERT, UPDATE, and DELETE (DML Operations)
* **Concept:** Data Manipulation Language (DML) manages data instances.
* **SecureBank Demonstrations:**
  * **INSERT:** Inserts a new security audit record into `audit_logs`.
  * **UPDATE:** Changes fraud alert status from `pending` to `under_review`.
  * **DELETE:** Creates and subsequently deletes a disposable diagnostic record, proving `DELETE` without corrupting transactional financial records.
* **Viva Demonstration Query:**
  ```sql
  -- Run Category 2 demonstration block
  SELECT 'DML verified in 02_DML_Data_Population.sql';
  ```

---

### 6. INNER JOIN vs. LEFT OUTER JOIN
* **Concept:** 
  * An **INNER JOIN** returns only rows where there is a matching key in both tables (intersection).
  * A **LEFT JOIN** returns all rows from the left table, along with matching rows from the right table; if no match exists, NULL values are populated for right-table columns.
* **SecureBank Example:**
  * INNER JOIN finds accounts that have active transaction records.
  * LEFT JOIN finds all accounts, including newly opened accounts (such as Account 105 for Sneha Reddy) that have 0 transactions.
* **Viva Demonstration Query:**
  ```sql
  SELECT 
      a.account_id, a.account_number, COUNT(t.transaction_id) AS tx_count
  FROM accounts a
  LEFT JOIN transactions t ON a.account_id = t.sender_account_id
  GROUP BY a.account_id, a.account_number;
  ```

---

### 7. GROUP BY vs. HAVING
* **Concept:** 
  * `WHERE` filters individual rows **before** any aggregation takes place.
  * `GROUP BY` collapses rows sharing identical values into summary rows.
  * `HAVING` filters aggregated groups **after** aggregation functions (`SUM`, `COUNT`, `AVG`) have been calculated.
* **SecureBank Example:** Find accounts whose *cumulative transferred outflow* exceeds ₹20,000:
* **Viva Demonstration Query:**
  ```sql
  SELECT 
      sender_account_id, 
      COUNT(*) AS total_transfers, 
      SUM(amount) AS total_outflow
  FROM transactions
  GROUP BY sender_account_id
  HAVING SUM(amount) > 20000.00;
  ```

---

### 8. Subqueries and Aggregate Functions
* **Concept:** A subquery is a nested query whose result is passed to the outer query. Aggregate functions (`AVG`, `MAX`, `SUM`) compute a single summary value over a column partition.
* **SecureBank Example:** Retrieve accounts whose balance is strictly above the bank-wide average balance:
* **Viva Demonstration Query:**
  ```sql
  SELECT account_id, account_number, balance 
  FROM accounts 
  WHERE balance > (SELECT AVG(balance) FROM accounts);
  ```

---

### 9. Stored Procedure vs. Stored Function
* **Concept:**
  | Feature | Stored Function (`fn_account_balance`) | Stored Procedure (`sp_transfer_money`) |
  |---|---|---|
  | **Return Value** | Must return exactly one scalar value (`RETURNS DECIMAL`) | Returns zero, one, or multiple values via `OUT` parameters or result sets |
  | **Invocation** | Called inline inside SQL statements (`SELECT fn(...)`) | Called standalone using `CALL sp(...)` |
  | **Transactions** | Cannot manage transactions (`START TRANSACTION`, `COMMIT`, `ROLLBACK` forbidden) | Full transaction control (`START TRANSACTION`, `COMMIT`, `ROLLBACK`) |
  | **Side Effects** | Read-only in standard query contexts | Can execute DML (`INSERT`, `UPDATE`, `DELETE`) modifying persistent state |
* **Viva Demonstration Query:**
  ```sql
  -- Function call:
  SELECT account_number, fn_account_balance(account_id) FROM accounts;

  -- Procedure call:
  CALL sp_transfer_money(101, 103, 2, 1000.00, 'Viva demo', FALSE, @tx_id, @code, @msg);
  SELECT @tx_id, @code, @msg;
  ```

---

### 10. Cursor Lifecycle: DECLARE, OPEN, FETCH, CLOSE
* **Concept:** A cursor allows procedural row-by-row navigation over an active result set when set-based operations are insufficient or external iterative business logic is required.
  1. `DECLARE cur CURSOR FOR SELECT ...`: Defines the query structure.
  2. `OPEN cur`: Executes the query and instantiates the cursor memory buffer.
  3. `FETCH cur INTO var1, var2`: Retrieves the current row and advances the pointer. Controlled by `DECLARE CONTINUE HANDLER FOR NOT FOUND`.
  4. `CLOSE cur`: Frees the server cursor resources.
* **Set-based vs Cursor Tradeoff:** Set-based SQL is declarative, parallelizable, and orders of magnitude faster. Cursors process Row-By-Agonizing-Row (RBAR) and consume server memory, but are suitable for complex procedural audits.
* **Viva Demonstration Query:**
  ```sql
  CALL sp_cursor_review_large_transactions(50000.00, @alerts_created);
  SELECT @alerts_created;
  ```

---

### 11. BEFORE vs. AFTER Triggers
* **Concept:**
  * **BEFORE Trigger (`trg_transactions_before_insert`):** Fires before the proposed row is written to the table buffer. Used for invariant validation and input sanitation. It can modify `NEW.column` or abort execution via `SIGNAL SQLSTATE '45000'`.
  * **AFTER Trigger (`trg_transactions_after_insert`):** Fires after the row is staged into the table buffer. `NEW` columns are read-only. Used for secondary side-effects such as audit logging or notifying external subsystems.
* **Transactional Behavior:** Both BEFORE and AFTER triggers execute inside the **exact same transaction scope** as the invoking DML. If the transaction fails or aborts later, all trigger side-effects are completely rolled back!

---

### 12. ACID Properties in SecureBank
* **A — Atomicity:** A funds transfer consists of debiting Sender, crediting Receiver, and logging Transaction. Either all three execute, or none execute (`START TRANSACTION` ... `COMMIT` / `ROLLBACK`).
* **C — Consistency:** Database moves from one valid state to another. Constraints (`CHECK balance >= 0`, foreign keys) are never violated.
* **I — Isolation:** Concurrent transfers do not interfere with each other or read dirty uncommitted state (`SELECT ... FOR UPDATE` row locks).
* **D — Durability:** Once committed, records persist in InnoDB Redo Logs even if the power fails immediately.

---

### 13. Deadlock Prevention Strategy
* **Problem:** If User A transfers from Account 101 to Account 102, and User B simultaneously transfers from Account 102 to Account 101:
  * Thread 1 locks Account 101, waits for Account 102.
  * Thread 2 locks Account 102, waits for Account 101.
  * Result: **Deadlock** (`ER_LOCK_DEADLOCK`).
* **SecureBank Solution:** In `sp_transfer_money`, we sort the two account IDs and lock them in strictly ascending order:
  ```sql
  IF p_sender_account_id < p_receiver_account_id THEN
      SET v_first_lock_id = p_sender_account_id;
      SET v_second_lock_id = p_receiver_account_id;
  ELSE
      SET v_first_lock_id = p_receiver_account_id;
      SET v_second_lock_id = p_sender_account_id;
  END IF;
  -- Both threads always request lock on smaller account ID first!
  ```
  Since all threads acquire locks in the identical resource hierarchy, circular wait is mathematically eliminated.

---

### 14. Idempotency Architecture
* **Concept:** Idempotency ensures that executing the same API request multiple times produces the identical outcome as executing it once, preventing duplicate debits when mobile clients retry dropped connections.
* **Implementation:**
  1. Client sends a unique `Idempotency-Key` (e.g. UUID).
  2. Server hashes `(user_id, sender_account, receiver_account, amount)` into a SHA-256 fingerprint.
  3. Table `idempotency_records` enforces `UNIQUE(user_id, request_key)`.
  4. If a retry arrives with the same key and identical fingerprint, the cached successful transfer response is returned immediately without debiting the customer again.
  5. If the same key is reused with a different amount/payload, it is rejected with `409 Conflict`.

---

### 15. Fraud Alert vs. Confirmed Fraud
* **Concept:** A transaction flagged by an automated rule (e.g., amount > ₹50,000 or 5 rapid transfers in 2 minutes) creates a **Fraud Alert** with status `'pending'`.
* **Important Distinction:** Suspicious behavior is **NOT** confirmed fraud. Legitimate high-net-worth customers often execute large transfers. The system creates an explainable alert with a risk score (1–10) and assigns it to a human compliance officer/admin who reviews KYC notes and moves status to `'under_review'`, `'resolved'`, or `'dismissed'`.

---

### 16. Why Triggers Cannot Replace Application Authorization
* **Concept:** Triggers operate at the database tier on raw row state (`NEW.amount`, `NEW.sender_account_id`). However:
  1. Triggers cannot verify user session tokens, JWTs, or biometric signatures.
  2. MySQL cannot securely compute slow CPU-bound bcrypt/Argon2 password hashes inside a trigger without blocking connection threads.
  3. Triggers lack context on HTTP request headers, device fingerprints, or IP geolocations.
  * **Role:** The Node.js application enforces authentication, session validation, and bcrypt 2FA verification. The database triggers and stored procedures enforce relational integrity, row-locking, and financial consistency.

---

### 17. SQL/PSM vs. Oracle PL/SQL
* **Concept:** 
  * MySQL uses the ISO/IEC standard **SQL/PSM (Persistent Stored Modules)** language specification.
  * Oracle uses **PL/SQL (Procedural Language for SQL)**, which has proprietary syntax (`CREATE OR REPLACE PROCEDURE`, `%TYPE`, packages, autonomous transactions).
  * In MySQL SQL/PSM, statement delimiters must be temporarily changed using `DELIMITER $$` so MySQL client does not mistake semicolons inside routine bodies for end-of-statement markers.

---

## Professor Demonstration Quick Reference

| Step | Script to Run | Key Output to Highlight to Professor |
|:---:|---|---|
| **1** | `01_DDL_Constraints.sql` | 7 tables created, InnoDB engine, CHECK & UNIQUE constraints |
| **2** | `02_DML_Data_Population.sql` | 5 users, 5 accounts, 8 transactions, INSERT/UPDATE/DELETE demos |
| **3** | `03_SQL_Queries.sql` | 14 queries, 2-way joins, HAVING, Subquery, EXPLAIN index scan |
| **4** | `04_Procedures_Functions.sql` | `fn_account_balance`, `sp_transfer_money` (ACID + 2FA threshold) |
| **5** | `05_Cursor_Triggers.sql` | BEFORE/AFTER triggers, `sp_cursor_review_large_transactions` |
| **6** | `06_Verification_Tests.sql` | **17/17 PASS** summary verification report |
