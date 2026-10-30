const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();
const pool = require('./db');

const app = express();
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

const JWT_SECRET = process.env.JWT_SECRET || 'securebank_super_secret_jwt_key_2026_vit_production';

// ----------------------------------------------------------------------------
// Token Authentication Utilities (Standard JWT format using built-in crypto)
// ----------------------------------------------------------------------------
function generateToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24-hour expiration
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    const user = verifyToken(token);
    if (!user) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    }
    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access forbidden. Administrator credentials required.' });
    }
    next();
}

// Helper to compute deterministic request payload fingerprint (SHA-256)
function computeFingerprint(payload) {
    const serialized = JSON.stringify({
        userId: payload.userId,
        senderAccountId: payload.senderAccountId,
        receiverAccountId: payload.receiverAccountId,
        amount: Number(payload.amount).toFixed(2)
    });
    return crypto.createHash('sha256').update(serialized).digest('hex');
}

// ----------------------------------------------------------------------------
// Health Check Endpoint (Preserved)
// ----------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ status: 'ok', database: process.env.DB_NAME, mysql: true });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// ----------------------------------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------------------------------

// Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, password, transactionPassword } = req.body;

    if (!fullName || !email || !password || !transactionPassword) {
        return res.status(400).json({ error: 'All fields (Full Name, Email, Password, Transaction Password) are required.' });
    }

    const cleanFullName = String(fullName).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanFullName.length < 2) {
        return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (String(transactionPassword).length < 4) {
        return res.status(400).json({ error: 'Transaction password PIN must be at least 4 characters.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Check for existing email
        const [existing] = await conn.query('SELECT user_id FROM users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            await conn.rollback();
            conn.release();
            return res.status(409).json({ error: 'An account with this email address already exists.' });
        }

        // Hash passwords with bcrypt
        const passwordHash = await bcrypt.hash(password, 10);
        const txnPasswordHash = await bcrypt.hash(transactionPassword, 10);

        // Insert new user
        const [userResult] = await conn.query(
            'INSERT INTO users (full_name, email, password_hash, transaction_password_hash, role, status) VALUES (?, ?, ?, ?, "customer", "active")',
            [cleanFullName, cleanEmail, passwordHash, txnPasswordHash]
        );
        const newUserId = userResult.insertId;

        // Create initial customer savings account with starter balance ₹25,000.00
        const accountNumber = `SB-${1000 + Number(newUserId)}-SAV-01`;
        const [accountResult] = await conn.query(
            'INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, "savings", 25000.00, "active")',
            [newUserId, accountNumber]
        );

        // Record registration in audit_logs
        await conn.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "USER_REGISTRATION", ?)',
            [newUserId, `Customer registered: ${cleanEmail}. Primary savings account ${accountNumber} provisioned.`]
        );

        await conn.commit();
        conn.release();

        const token = generateToken({
            userId: newUserId,
            fullName: cleanFullName,
            email: cleanEmail,
            role: 'customer'
        });

        return res.status(201).json({
            status: 'success',
            message: 'Registration successful. Your primary savings account has been provisioned.',
            token,
            user: {
                userId: newUserId,
                user_id: newUserId,
                fullName: cleanFullName,
                full_name: cleanFullName,
                email: cleanEmail,
                role: 'customer',
                status: 'active'
            },
            primaryAccount: {
                accountId: accountResult.insertId,
                accountNumber,
                accountType: 'savings',
                balance: '25000.00'
            }
        });

    } catch (err) {
        await conn.rollback();
        conn.release();
        return res.status(500).json({ error: 'Registration failed due to server error: ' + err.message });
    }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
        const [rows] = await pool.query(
            'SELECT user_id, full_name, email, password_hash, role, status FROM users WHERE email = ?',
            [cleanEmail]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email address or password.' });
        }

        const user = rows[0];

        if (user.status === 'locked') {
            return res.status(403).json({ error: 'Your account is locked for security reasons. Please contact bank administration.' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ error: 'Your account is currently inactive.' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email address or password.' });
        }

        // Record successful login in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "USER_LOGIN", ?)',
            [user.user_id, `User ${user.full_name} (${user.email}) logged in successfully from ${req.ip || '127.0.0.1'}`]
        );

        const token = generateToken({
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            role: user.role
        });

        return res.json({
            status: 'success',
            token,
            user: {
                userId: user.user_id,
                user_id: user.user_id,
                fullName: user.full_name,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (err) {
        return res.status(500).json({ error: 'Login authentication error: ' + err.message });
    }
});

// Session Verification Endpoint
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT user_id, full_name, email, role, status, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User record not found.' });
        }

        const u = rows[0];
        return res.json({
            user: {
                userId: u.user_id,
                user_id: u.user_id,
                fullName: u.full_name,
                full_name: u.full_name,
                email: u.email,
                role: u.role,
                status: u.status,
                created_at: u.created_at
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Logout Endpoint
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "USER_LOGOUT", ?)',
            [req.user.userId, `User ${req.user.fullName} logged out.`]
        );
        return res.json({ status: 'success', message: 'Logged out successfully.' });
    } catch (err) {
        return res.json({ status: 'success' });
    }
});

// 2FA Security: Fetch recent attempts history
app.get('/api/auth/2fa-history', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT attempt_id, attempt_time, success, ip_address FROM transaction_password_attempts WHERE user_id = ? ORDER BY attempt_time DESC LIMIT 10',
            [req.user.userId]
        );
        return res.json({ attempts: rows });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2FA Security: Update / Reset Transaction Password PIN
app.post('/api/auth/update-txn-pin', authenticateToken, async (req, res) => {
    const { currentPassword, newTxnPassword } = req.body;
    if (!currentPassword || !newTxnPassword) {
        return res.status(400).json({ error: 'Current login password and new 2FA PIN are required.' });
    }
    if (String(newTxnPassword).length < 4) {
        return res.status(400).json({ error: 'New 2FA PIN must be at least 4 characters.' });
    }

    try {
        const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'User record not found.' });

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Incorrect login password. Cannot change 2FA PIN.' });
        }

        const newHash = await bcrypt.hash(newTxnPassword, 10);
        await pool.query('UPDATE users SET transaction_password_hash = ? WHERE user_id = ?', [newHash, req.user.userId]);
        await pool.query('INSERT INTO audit_logs (user_id, action, details) VALUES (?, "TXN_PIN_UPDATED", "User updated their 2FA transaction password PIN")', [req.user.userId]);

        return res.json({ status: 'success', message: '2FA Transaction Password PIN updated successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update 2FA PIN: ' + err.message });
    }
});

// ----------------------------------------------------------------------------
// Account Balance (Preserved)
// ----------------------------------------------------------------------------
app.get('/api/accounts/:id/balance', async (req, res) => {
    try {
        const accountId = req.params.id;
        const [rows] = await pool.query(
            'SELECT fn_account_balance(?) AS balance',
            [accountId]
        );
        if (!rows || rows.length === 0 || rows[0].balance === null) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json({ account_id: accountId, balance: rows[0].balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------------
// Customer Accounts Management
// ----------------------------------------------------------------------------

// List all accounts owned by the authenticated customer
app.get('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const [accounts] = await pool.query(
            'SELECT account_id, user_id, account_number, account_type, balance, status, created_at, updated_at FROM accounts WHERE user_id = ? ORDER BY account_id ASC',
            [req.user.userId]
        );

        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

        return res.json({
            accounts,
            total_balance: totalBalance.toFixed(2),
            account_count: accounts.length
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve accounts: ' + err.message });
    }
});

// Real-time recipient account lookup by account number
app.get('/api/accounts/lookup', authenticateToken, async (req, res) => {
    const { accountNumber } = req.query;
    if (!accountNumber) {
        return res.status(400).json({ error: 'Account number is required for lookup.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT a.account_id, a.account_number, a.account_type, a.status, a.user_id, u.full_name
             FROM accounts a
             JOIN users u ON a.user_id = u.user_id
             WHERE a.account_number = ?`,
            [String(accountNumber).trim()]
        );

        if (rows.length === 0) {
            return res.json({ found: false, error: 'Recipient account number not found.' });
        }

        const match = rows[0];
        if (match.status !== 'active') {
            return res.json({ found: false, error: `Recipient account is ${match.status} and cannot receive transfers.` });
        }

        // Mask recipient name for privacy (e.g. "Rahul Sharma" -> "Rahul S****")
        const nameParts = (match.full_name || 'Customer').trim().split(/\s+/);
        let maskedName = nameParts[0] || 'Customer';
        if (nameParts.length > 1 && nameParts[1]) {
            maskedName += ' ' + nameParts[1].charAt(0) + '****';
        }

        return res.json({
            found: true,
            account: {
                account_id: match.account_id,
                account_number: match.account_number,
                account_type: match.account_type,
                status: match.status,
                recipient_name: maskedName,
                is_own_account: match.user_id === req.user.userId
            }
        });
    } catch (err) {
        return res.status(500).json({ error: 'Lookup failed: ' + err.message });
    }
});

// Account statement using sp_get_account_statement
app.get('/api/accounts/:id/statement', authenticateToken, async (req, res) => {
    const accountId = req.params.id;
    try {
        // Enforce ownership
        const [accRows] = await pool.query(
            'SELECT user_id FROM accounts WHERE account_id = ?',
            [accountId]
        );
        if (accRows.length === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        if (req.user.role !== 'admin' && accRows[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied. You do not own this account.' });
        }

        const startDate = req.query.startDate || '2026-01-01 00:00:00';
        const endDate = req.query.endDate || '2026-12-31 23:59:59';

        const [results] = await pool.query(
            'CALL sp_get_account_statement(?, ?, ?)',
            [accountId, startDate, endDate]
        );

        return res.json({
            account_id: accountId,
            statement: results[0] || []
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve statement: ' + err.message });
    }
});

// ----------------------------------------------------------------------------
// Idempotent Transfer Endpoint (Preserved Core Contract & Enhanced for Auth)
// ----------------------------------------------------------------------------
app.post('/api/transfer', async (req, res) => {
    const idempotencyKey = req.header('Idempotency-Key');
    const { userId: bodyUserId, senderAccountId, receiverAccountId, amount, description, transactionPassword } = req.body;

    // Determine effective user ID: prioritize authenticated session if present, else fallback to bodyUserId
    let userId = bodyUserId;
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenUser = verifyToken(authHeader.slice(7));
        if (tokenUser) {
            userId = tokenUser.userId;
        }
    }

    if (!userId || !senderAccountId || !receiverAccountId || !amount) {
        return res.status(400).json({ error: 'Missing required transfer fields.' });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ error: 'Transfer amount must be strictly positive.' });
    }

    const fingerprint = computeFingerprint({ userId, senderAccountId, receiverAccountId, amount: transferAmount });

    // Step 1: Idempotency coordination if Idempotency-Key header is present
    let idempotencyRecordId = null;
    if (idempotencyKey) {
        const [existing] = await pool.query(
            'SELECT idempotency_id, request_fingerprint, response_status, response_data FROM idempotency_records WHERE user_id = ? AND request_key = ?',
            [userId, idempotencyKey]
        );

        if (existing.length > 0) {
            const record = existing[0];
            // Check fingerprint match
            if (record.request_fingerprint !== fingerprint) {
                return res.status(409).json({
                    error: 'Idempotency conflict: The supplied request key was previously used with different parameters.'
                });
            }

            if (record.response_status === 'completed') {
                return res.status(200).json({
                    idempotent_replay: true,
                    data: typeof record.response_data === 'string' ? JSON.parse(record.response_data) : record.response_data
                });
            }

            if (record.response_status === 'processing') {
                return res.status(425).json({
                    error: 'Request is currently being processed by another concurrent thread. Please wait.'
                });
            }
        } else {
            // Register preliminary 'processing' record
            const [insertResult] = await pool.query(
                'INSERT INTO idempotency_records (user_id, request_key, request_fingerprint, response_status) VALUES (?, ?, ?, "processing")',
                [userId, idempotencyKey, fingerprint]
            );
            idempotencyRecordId = insertResult.insertId;
        }
    }

    // Step 2: Tiered 2FA Security Verification via bcrypt in Node.js
    let isPasswordVerified = false;
    if (transferAmount > 5000.00) {
        if (!transactionPassword) {
            if (idempotencyRecordId) {
                await pool.query('DELETE FROM idempotency_records WHERE idempotency_id = ?', [idempotencyRecordId]);
            }
            return res.status(401).json({
                error: 'Transaction password is required for transfers exceeding ₹5,000.00.'
            });
        }

        // Fetch bcrypt hash from database
        const [userRows] = await pool.query(
            'SELECT transaction_password_hash FROM users WHERE user_id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            if (idempotencyRecordId) {
                await pool.query('DELETE FROM idempotency_records WHERE idempotency_id = ?', [idempotencyRecordId]);
            }
            return res.status(404).json({ error: 'Initiating user not found.' });
        }

        const validPassword = await bcrypt.compare(transactionPassword, userRows[0].transaction_password_hash);
        
        // Log attempt into transaction_password_attempts table
        await pool.query(
            'INSERT INTO transaction_password_attempts (user_id, account_id, success, ip_address) VALUES (?, ?, ?, ?)',
            [userId, senderAccountId, validPassword, req.ip || '127.0.0.1']
        );

        if (!validPassword) {
            if (idempotencyRecordId) {
                await pool.query('DELETE FROM idempotency_records WHERE idempotency_id = ?', [idempotencyRecordId]);
            }
            return res.status(401).json({ error: 'Invalid transaction password 2FA PIN.' });
        }

        isPasswordVerified = true;
    }

    // Step 3: Invoke ACID Stored Procedure sp_transfer_money
    try {
        const [spResults] = await pool.query(
            `CALL sp_transfer_money(?, ?, ?, ?, ?, ?, @out_tx, @out_code, @out_msg);
             SELECT @out_tx AS transaction_id, @out_code AS status_code, @out_msg AS status_message;`,
            [senderAccountId, receiverAccountId, userId, transferAmount, description || null, isPasswordVerified]
        );

        // Extract output variables from multi-statement result
        const selectOutput = spResults[spResults.length - 1][0];
        const { transaction_id, status_code, status_message } = selectOutput;

        if (status_code !== 'SUCCESS') {
            if (idempotencyRecordId) {
                await pool.query('DELETE FROM idempotency_records WHERE idempotency_id = ?', [idempotencyRecordId]);
            }
            return res.status(400).json({
                error: status_message,
                status_code
            });
        }

        const responsePayload = {
            status: 'success',
            transaction_id,
            amount: transferAmount,
            sender_account_id: senderAccountId,
            receiver_account_id: receiverAccountId,
            status_message
        };

        // Step 4: Finalize Idempotency Record to 'completed'
        if (idempotencyRecordId) {
            await pool.query(
                'UPDATE idempotency_records SET response_status = "completed", transaction_id = ?, response_data = ? WHERE idempotency_id = ?',
                [transaction_id, JSON.stringify(responsePayload), idempotencyRecordId]
            );
        }

        return res.status(200).json({
            idempotent_replay: false,
            data: responsePayload
        });

    } catch (err) {
        if (idempotencyRecordId) {
            await pool.query('DELETE FROM idempotency_records WHERE idempotency_id = ?', [idempotencyRecordId]);
        }
        return res.status(500).json({ error: 'Database execution error: ' + err.message });
    }
});

// ----------------------------------------------------------------------------
// Transaction History & Details Endpoints
// ----------------------------------------------------------------------------

// List customer transactions with filters
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { accountId, type, status, search, startDate, endDate, minAmount, maxAmount } = req.query;

        // Base query joins accounts and users for rich presentation
        let query = `
            SELECT 
                t.transaction_id,
                t.sender_account_id,
                t.receiver_account_id,
                t.initiated_by_user_id,
                t.amount,
                t.description,
                t.status,
                t.transaction_time,
                sa.account_number AS sender_account_number,
                ra.account_number AS receiver_account_number,
                su.full_name AS sender_name,
                ru.full_name AS receiver_name,
                CASE 
                    WHEN sa.user_id = ? THEN 'debit'
                    ELSE 'credit'
                END AS direction
            FROM transactions t
            JOIN accounts sa ON t.sender_account_id = sa.account_id
            JOIN accounts ra ON t.receiver_account_id = ra.account_id
            JOIN users su ON sa.user_id = su.user_id
            JOIN users ru ON ra.user_id = ru.user_id
            WHERE (sa.user_id = ? OR ra.user_id = ?)
        `;

        const params = [req.user.userId, req.user.userId, req.user.userId];

        if (accountId) {
            query += ' AND (t.sender_account_id = ? OR t.receiver_account_id = ?)';
            params.push(accountId, accountId);
        }

        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        }

        if (type === 'debit') {
            query += ' AND sa.user_id = ?';
            params.push(req.user.userId);
        } else if (type === 'credit') {
            query += ' AND ra.user_id = ? AND sa.user_id != ?';
            params.push(req.user.userId, req.user.userId);
        }

        if (startDate) {
            query += ' AND t.transaction_time >= ?';
            params.push(startDate + ' 00:00:00');
        }

        if (endDate) {
            query += ' AND t.transaction_time <= ?';
            params.push(endDate + ' 23:59:59');
        }

        if (minAmount) {
            query += ' AND t.amount >= ?';
            params.push(parseFloat(minAmount));
        }

        if (maxAmount) {
            query += ' AND t.amount <= ?';
            params.push(parseFloat(maxAmount));
        }

        if (search) {
            query += ' AND (t.transaction_id = ? OR t.description LIKE ? OR sa.account_number LIKE ? OR ra.account_number LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(isNaN(Number(search)) ? 0 : Number(search), searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY t.transaction_time DESC LIMIT 150';

        const [transactions] = await pool.query(query, params);

        return res.json({ transactions });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve transactions: ' + err.message });
    }
});

// Single Transaction Details
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const txId = req.params.id;
        const [rows] = await pool.query(
            `SELECT 
                t.transaction_id,
                t.sender_account_id,
                t.receiver_account_id,
                t.initiated_by_user_id,
                t.amount,
                t.description,
                t.status,
                t.transaction_time,
                sa.account_number AS sender_account_number,
                sa.user_id AS sender_user_id,
                ra.account_number AS receiver_account_number,
                ra.user_id AS receiver_user_id,
                su.full_name AS sender_name,
                ru.full_name AS receiver_name
            FROM transactions t
            JOIN accounts sa ON t.sender_account_id = sa.account_id
            JOIN accounts ra ON t.receiver_account_id = ra.account_id
            JOIN users su ON sa.user_id = su.user_id
            JOIN users ru ON ra.user_id = ru.user_id
            WHERE t.transaction_id = ?`,
            [txId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction record not found.' });
        }

        const tx = rows[0];

        // Enforce ownership unless user is admin
        if (req.user.role !== 'admin' && tx.sender_user_id !== req.user.userId && tx.receiver_user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied. You are not authorized to view this transaction.' });
        }

        return res.json({
            transaction: tx,
            direction: tx.sender_user_id === req.user.userId ? 'debit' : 'credit'
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve transaction: ' + err.message });
    }
});

// ----------------------------------------------------------------------------
// Customer Fraud Alerts & Notifications
// ----------------------------------------------------------------------------
app.get('/api/alerts', authenticateToken, async (req, res) => {
    try {
        const [alerts] = await pool.query(
            `SELECT 
                fa.alert_id,
                fa.transaction_id,
                fa.account_id,
                fa.rule_type,
                fa.reason,
                fa.risk_score,
                fa.review_status,
                fa.created_at,
                t.amount,
                t.transaction_time,
                a.account_number
            FROM fraud_alerts fa
            JOIN accounts a ON fa.account_id = a.account_id
            JOIN transactions t ON fa.transaction_id = t.transaction_id
            WHERE a.user_id = ?
            ORDER BY fa.created_at DESC`,
            [req.user.userId]
        );

        // Format customer-facing messages
        const customerAlerts = alerts.map(alert => ({
            alert_id: alert.alert_id,
            transaction_id: alert.transaction_id,
            account_number: alert.account_number,
            amount: alert.amount,
            review_status: alert.review_status,
            date: alert.created_at,
            customer_message: `Transaction of ₹${Number(alert.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} on account ${alert.account_number} is undergoing routine verification.`,
            status_label: alert.review_status === 'resolved' ? 'Verified & Cleared' : 
                          alert.review_status === 'dismissed' ? 'Review Completed' : 
                          alert.review_status === 'under_review' ? 'Security Review In Progress' : 'In Review Queue'
        }));

        return res.json({ alerts: customerAlerts });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve alerts: ' + err.message });
    }
});

// ----------------------------------------------------------------------------
// Fraud Scan Trigger (Preserved - Invoking sp_cursor_review_large_transactions)
// ----------------------------------------------------------------------------
app.post('/api/fraud/scan', async (req, res) => {
    try {
        const threshold = req.body.threshold || 50000.00;
        const [results] = await pool.query(
            `CALL sp_cursor_review_large_transactions(?, @out_alerts);
             SELECT @out_alerts AS new_alerts_count;`,
            [threshold]
        );
        const alertsCount = results[results.length - 1][0].new_alerts_count;
        res.json({ status: 'completed', threshold, new_alerts_created: alertsCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------------
// Administrator Endpoints
// ----------------------------------------------------------------------------

// Admin System Overview Metrics
app.get('/api/admin/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
                (SELECT COUNT(*) FROM accounts) AS total_accounts,
                (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE status = 'active') AS total_deposits,
                (SELECT COUNT(*) FROM transactions) AS total_transactions,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'successful') AS total_volume,
                (SELECT COUNT(*) FROM fraud_alerts WHERE review_status = 'pending') AS pending_alerts,
                (SELECT COUNT(*) FROM fraud_alerts WHERE review_status = 'under_review') AS under_review_alerts
        `);

        return res.json({ stats: stats[0] });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve admin overview: ' + err.message });
    }
});

// Admin All Fraud Alerts List
app.get('/api/admin/alerts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [alerts] = await pool.query(`
            SELECT 
                fa.alert_id,
                fa.transaction_id,
                fa.account_id,
                fa.rule_type,
                fa.reason,
                fa.risk_score,
                fa.review_status,
                fa.reviewed_by,
                fa.review_notes,
                fa.created_at,
                fa.updated_at,
                t.amount,
                t.transaction_time,
                t.status AS transaction_status,
                u.full_name AS customer_name,
                u.email AS customer_email,
                a.account_number,
                reviewer.full_name AS reviewer_name
            FROM fraud_alerts fa
            JOIN transactions t ON fa.transaction_id = t.transaction_id
            JOIN accounts a ON fa.account_id = a.account_id
            JOIN users u ON a.user_id = u.user_id
            LEFT JOIN users reviewer ON fa.reviewed_by = reviewer.user_id
            ORDER BY fa.created_at DESC
        `);

        return res.json({ alerts });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve fraud alerts: ' + err.message });
    }
});

// Admin Update Fraud Alert Review Status
app.patch('/api/admin/alerts/:id', authenticateToken, requireAdmin, async (req, res) => {
    const alertId = req.params.id;
    const { review_status, review_notes } = req.body;

    const validStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(review_status)) {
        return res.status(400).json({ error: 'Invalid review status. Must be pending, under_review, resolved, or dismissed.' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE fraud_alerts 
             SET review_status = ?, reviewed_by = ?, review_notes = ? 
             WHERE alert_id = ?`,
            [review_status, req.user.userId, review_notes || null, alertId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Fraud alert record not found.' });
        }

        // Record in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "ALERT_STATUS_UPDATE", ?)',
            [req.user.userId, `Admin ${req.user.fullName} updated Alert #${alertId} to status "${review_status}". Notes: ${review_notes || 'None'}`]
        );

        return res.json({ status: 'success', message: `Alert #${alertId} status updated to ${review_status}.` });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update alert: ' + err.message });
    }
});

// Admin System Audit Trail
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [logs] = await pool.query(`
            SELECT 
                al.log_id,
                al.user_id,
                al.action,
                al.details,
                al.created_at,
                u.full_name,
                u.email,
                u.role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.user_id
            ORDER BY al.created_at DESC
            LIMIT 100
        `);

        return res.json({ logs });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve audit logs: ' + err.message });
    }
});

// Admin All System Transactions
app.get('/api/admin/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [transactions] = await pool.query(`
            SELECT 
                t.transaction_id,
                t.sender_account_id,
                t.receiver_account_id,
                t.amount,
                t.description,
                t.status,
                t.transaction_time,
                sa.account_number AS sender_account_number,
                ra.account_number AS receiver_account_number,
                su.full_name AS sender_name,
                ru.full_name AS receiver_name
            FROM transactions t
            JOIN accounts sa ON t.sender_account_id = sa.account_id
            JOIN accounts ra ON t.receiver_account_id = ra.account_id
            JOIN users su ON sa.user_id = su.user_id
            JOIN users ru ON ra.user_id = ru.user_id
            ORDER BY t.transaction_time DESC
            LIMIT 100
        `);

        return res.json({ transactions });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve system transactions: ' + err.message });
    }
});

// Fallback route for Single Page Application
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(__dirname, '../public/index.html'));
    }
    next();
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`SecureBank API server running on port ${PORT} connecting to ${process.env.DB_NAME}`);
    });
}
