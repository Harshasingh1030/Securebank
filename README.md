# SecureBank — Modern Digital Banking Application

SecureBank is a full-stack, enterprise-grade simulated online banking web application built with a responsive single-page frontend (SPA), a resilient Node.js / Express backend, and an ACID-compliant MySQL database.

The application features tiered Two-Factor Authentication (2FA), cursor-based automated anomaly detection, idempotent financial transfers, real-time fraud alerts, and complete customer & administrative portals.

---

## 🌟 Key Features

### 1. Customer Banking Experience
- **Account Dashboard:** Real-time aggregate balances, account cards, and quick transaction shortcuts.
- **Account Ledger:** Filterable transaction history with detailed transaction receipts and printing capability.
- **Inter-Bank Transfers:** Transfer money between accounts with verified recipient lookup.
- **Tiered Two-Factor Authentication (2FA):**
  - **Tier 1 (≤ ₹5,000):** Streamlined standard transfer without extra friction (2FA exempt).
  - **Tier 2 (> ₹5,000):** Mandated secondary 2FA Transaction Password PIN verified server-side with `bcrypt`.
- **Security Center:** Manage 2FA Transaction PIN and inspect a live, database-audited 2FA verification attempt log.

### 2. Administrator & Risk Operations
- **System Overview:** Total registered customers, active deposit volume, and system metrics.
- **Fraud Alert Review Queue:** Review flagged transactions and update review status (`under_review`, `resolved`, `dismissed`) with compliance notes.
- **Automated Anomaly Scan:** Trigger database cursor-based scans (`sp_cursor_review_large_transactions`) to detect high-value anomalies.
- **Security Audit Trail:** Complete audit logs recording user authentication, transfers, and administrative actions.

### 3. Engineering & Database Design
- **ACID Transactions:** Money transfers are wrapped inside database transactions (`sp_transfer_money`) with rollback protection and balance integrity checks.
- **Idempotency Protection:** Prevents duplicate transfer charges using client-generated idempotency keys (`idempotency_records`).
- **Secure Password Architecture:** `bcrypt` hashing for both login passwords and 2FA transaction PINs.
- **JWT Authentication:** Stateless, signed HMAC-SHA256 session management with automatic credential normalization.

---

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5, Modern CSS3 (custom banking design system), Vanilla JavaScript (SPA State Pattern)
- **Backend:** Node.js, Express 5, MySQL2 (`mysql2/promise`), `bcrypt`, `dotenv`
- **Database:** MySQL 8.0 (InnoDB engine, Stored Procedures, Functions, Triggers, and Cursors)

---

## 📁 Repository Structure

```text
├── sql/
│   ├── 01_DDL_Constraints.sql          # Table definitions, foreign keys, and CHECK constraints
│   ├── 02_DML_Data_Population.sql       # Seed data for users, accounts, and sample transactions
│   ├── 03_SQL_Queries.sql               # Core business queries and reporting
│   ├── 04_Procedures_Functions.sql      # Transfer stored procedure & balance calculation function
│   ├── 05_Cursor_Triggers.sql           # Cursor-based fraud scan & audit triggers
│   └── 06_Verification_Tests.sql        # Database constraint verification suite
├── src/
│   ├── db.js                            # MySQL connection pool configuration
│   └── server.js                        # Express API server, routes, and authentication middleware
├── public/
│   ├── index.html                       # Single-page application entry point
│   ├── css/
│   │   └── styles.css                   # Custom responsive banking design system
│   └── js/
│       ├── api.js                       # Frontend API client & idempotency generator
│       ├── state.js                     # Centralized reactive state store
│       └── app.js                       # SPA router, UI views, and modals
├── scripts/
│   ├── test_all_endpoints.js            # 20-scenario full end-to-end integration test
│   └── test_idempotency.js              # Idempotency and 2FA regression test suite
├── .env.example                         # Environment configuration template
├── package.json                         # Node.js project manifest & scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- MySQL Server (v8.0+)

### 1. Clone the Repository
```bash
git clone https://github.com/Harshasingh1030/Securebank.git
cd Securebank
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Database
1. Launch MySQL and execute the SQL scripts in order:
   ```bash
   mysql -u root -p < sql/01_DDL_Constraints.sql
   mysql -u root -p < sql/02_DML_Data_Population.sql
   mysql -u root -p < sql/04_Procedures_Functions.sql
   mysql -u root -p < sql/05_Cursor_Triggers.sql
   ```
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your MySQL credentials:
   ```env
   PORT=3000
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=Securebank_db2
   JWT_SECRET=your_secret_key
   ```

### 4. Start the Application
```bash
npm start
```
Visit **`http://localhost:3000`** in your browser.

---

## 🧪 Testing

Run the automated integration test suite:
```bash
# Run all 20 API and database integration tests
npm test

# Run idempotency and 2FA replay tests
npm run test:idempotency
```

---

## 🔒 Security & Default Demo Credentials

| Role | Email | Login Password | 2FA Transaction PIN |
| :--- | :--- | :--- | :--- |
| **Customer** | `rahul.sharma@securebank.com` | `Customer@2026` | `TxnPin@9988` |
| **Customer** | `kohli@gmail.com` | `kohli123` | `TxnPin@9988` |
| **System Admin** | `harsha.admin@securebank.com` | `SecureBank@Admin2026` | N/A |

---

## 📄 License
ISC
