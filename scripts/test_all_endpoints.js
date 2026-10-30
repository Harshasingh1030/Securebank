const http = require('http');
const app = require('../src/server');
const pool = require('../src/db');

async function testAll() {
    console.log('====================================================================');
    console.log('       SECUREBANK FULL END-TO-END SYSTEM INTEGRATION TEST           ');
    console.log('====================================================================\n');

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, baseUrl);
            const headers = options.headers || {};
            if (options.token) {
                headers['Authorization'] = `Bearer ${options.token}`;
            }
            if (options.idempotencyKey) {
                headers['Idempotency-Key'] = options.idempotencyKey;
            }
            if (options.body && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }

            const request = http.request(url, {
                method: options.method || 'GET',
                headers
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, body: json });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            request.on('error', reject);
            if (options.body) {
                request.write(JSON.stringify(options.body));
            }
            request.end();
        });
    }

    let passCount = 0;
    let failCount = 0;

    function assert(cond, name, details) {
        if (cond) {
            console.log(`[PASS] ${name}`);
            passCount++;
        } else {
            console.error(`[FAIL] ${name}`, details || '');
            failCount++;
        }
    }

    try {
        // 1. Health check
        const health = await req('/api/health');
        assert(health.status === 200 && health.body.mysql === true, '1. Server Health Check', health.body);

        // 2. Admin Login
        const adminLogin = await req('/api/auth/login', {
            method: 'POST',
            body: { email: 'harsha.admin@securebank.com', password: 'SecureBank@Admin2026' }
        });
        assert(adminLogin.status === 200 && adminLogin.body.user.role === 'admin', '2. Admin Login Authentication', adminLogin.body);
        const adminToken = adminLogin.body.token;

        // 3. Customer Login (Rahul Sharma)
        const custLogin = await req('/api/auth/login', {
            method: 'POST',
            body: { email: 'rahul.sharma@securebank.com', password: 'Customer@2026' }
        });
        assert(custLogin.status === 200 && custLogin.body.user.role === 'customer', '3. Customer Login Authentication', custLogin.body);
        const rahulToken = custLogin.body.token;

        // 4. Auth Session Check
        const meRes = await req('/api/auth/me', { token: rahulToken });
        assert(meRes.status === 200 && meRes.body.user.email === 'rahul.sharma@securebank.com', '4. Verify Session (/api/auth/me)', meRes.body);

        // 5. Customer Accounts List
        const accsRes = await req('/api/accounts', { token: rahulToken });
        assert(accsRes.status === 200 && accsRes.body.accounts.length >= 2, '5. Customer Accounts Retrieval (/api/accounts)', accsRes.body);
        const rahulAcc1 = accsRes.body.accounts[0]; // 101
        const rahulAcc2 = accsRes.body.accounts[1]; // 102

        // 6. Balance Function Endpoint
        const balRes = await req(`/api/accounts/${rahulAcc1.account_id}/balance`);
        assert(balRes.status === 200 && balRes.body.balance !== undefined, '6. Stored Function Balance (/api/accounts/:id/balance)', balRes.body);

        // 7. Recipient Lookup
        const lookupRes = await req('/api/accounts/lookup?accountNumber=SB-1003-SAV-01', { token: rahulToken });
        assert(lookupRes.status === 200 && lookupRes.body.found === true && lookupRes.body.account.recipient_name, '7. Recipient Account Lookup', lookupRes.body);

        // 8. Low-value transfer (<= ₹5,000) WITHOUT transaction password
        const txLow = await req('/api/transfer', {
            method: 'POST',
            token: rahulToken,
            idempotencyKey: 'TEST-TX-LOW-' + Date.now(),
            body: {
                userId: rahulAcc1.user_id,
                senderAccountId: rahulAcc1.account_id,
                receiverAccountId: 103, // Priya's account
                amount: 1200.00,
                description: 'End-to-end low value test transfer'
            }
        });
        assert(txLow.status === 200 && txLow.body.data.status === 'success', '8. Transfer <= ₹5,000 without Transaction Password', txLow.body);

        // 9. High-value transfer (> ₹5,000) with INCORRECT transaction password (must fail 401)
        const txWrongPin = await req('/api/transfer', {
            method: 'POST',
            token: rahulToken,
            body: {
                userId: rahulAcc1.user_id,
                senderAccountId: rahulAcc1.account_id,
                receiverAccountId: 103,
                amount: 8000.00,
                transactionPassword: 'WrongPin@123'
            }
        });
        assert(txWrongPin.status === 401, '9. Transfer > ₹5,000 with Invalid PIN Rejected (401)', txWrongPin.body);

        // 10. High-value transfer (> ₹5,000) with CORRECT transaction password (must succeed 200)
        const txHigh = await req('/api/transfer', {
            method: 'POST',
            token: rahulToken,
            idempotencyKey: 'TEST-TX-HIGH-' + Date.now(),
            body: {
                userId: rahulAcc1.user_id,
                senderAccountId: rahulAcc1.account_id,
                receiverAccountId: 103,
                amount: 6000.00,
                transactionPassword: 'TxnPin@9988',
                description: 'End-to-end high value 2FA test transfer'
            }
        });
        assert(txHigh.status === 200 && txHigh.body.data.status === 'success', '10. Transfer > ₹5,000 with Valid Transaction Password PIN', txHigh.body);

        // 11. Transaction History
        const txHistory = await req('/api/transactions', { token: rahulToken });
        assert(txHistory.status === 200 && txHistory.body.transactions.length > 0, '11. Transaction History Retrieval', txHistory.body);
        const lastTxId = txHistory.body.transactions[0].transaction_id;

        // 12. Single Transaction Receipt
        const txReceipt = await req(`/api/transactions/${lastTxId}`, { token: rahulToken });
        assert(txReceipt.status === 200 && txReceipt.body.transaction.transaction_id === lastTxId, '12. Single Transaction Details Receipt', txReceipt.body);

        // 13. Customer Fraud Alerts
        const custAlerts = await req('/api/alerts', { token: rahulToken });
        assert(custAlerts.status === 200 && Array.isArray(custAlerts.body.alerts), '13. Customer Alerts Retrieval', custAlerts.body);

        // 14. Registration of a brand new customer
        const uniqueEmail = `testuser_${Date.now()}@example.com`;
        const regRes = await req('/api/auth/register', {
            method: 'POST',
            body: {
                fullName: 'Vikram Malhotra',
                email: uniqueEmail,
                password: 'Customer@2026',
                transactionPassword: 'TxnPin@9988'
            }
        });
        assert(regRes.status === 201 && regRes.body.user.userId && regRes.body.primaryAccount.accountNumber, '14. New Customer Registration & Account Provisioning', regRes.body);

        // 15. New Customer Login
        const newLogin = await req('/api/auth/login', {
            method: 'POST',
            body: { email: uniqueEmail, password: 'Customer@2026' }
        });
        assert(newLogin.status === 200 && newLogin.body.token, '15. Newly Registered Customer Login', newLogin.body);

        // 16. Admin System Overview
        const adminOverview = await req('/api/admin/overview', { token: adminToken });
        assert(adminOverview.status === 200 && adminOverview.body.stats.total_customers >= 5, '16. Admin System Overview Metrics', adminOverview.body);

        // 17. Admin Fraud Alerts List & Management
        const adminAlerts = await req('/api/admin/alerts', { token: adminToken });
        assert(adminAlerts.status === 200 && adminAlerts.body.alerts.length >= 2, '17. Admin All Fraud Alerts List', adminAlerts.body);

        // 18. Admin Update Alert Status
        const firstAlertId = adminAlerts.body.alerts[0].alert_id;
        const patchAlert = await req(`/api/admin/alerts/${firstAlertId}`, {
            method: 'PATCH',
            token: adminToken,
            body: {
                review_status: 'resolved',
                review_notes: 'Automated test suite verified customer authenticity via KYC.'
            }
        });
        assert(patchAlert.status === 200 && patchAlert.body.status === 'success', '18. Admin Update Alert Status & Notes', patchAlert.body);

        // 19. Admin Audit Logs
        const auditLogs = await req('/api/admin/audit-logs', { token: adminToken });
        assert(auditLogs.status === 200 && auditLogs.body.logs.length > 0, '19. Admin Security Audit Logs', auditLogs.body);

        // 20. Admin Automated Fraud Scan Trigger (Cursor Procedure)
        const scanRes = await req('/api/fraud/scan', {
            method: 'POST',
            body: { threshold: 40000.00 }
        });
        assert(scanRes.status === 200 && scanRes.body.status === 'completed', '20. Automated Fraud Cursor Scan Trigger', scanRes.body);

        console.log('\n====================================================================');
        console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} Scenarios`);
        console.log('====================================================================\n');

    } finally {
        server.close();
        await pool.end();
    }
}

testAll().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});

