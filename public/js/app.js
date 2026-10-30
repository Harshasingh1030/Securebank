/**
 * SECUREBANK MAIN APPLICATION CONTROLLER
 * Coordinates Views, User Actions, and Real-time Backend Synchronization.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Setup unauthorized event listener
  window.addEventListener('securebank:unauthorized', () => {
    State.setUser(null);
    State.setAccounts([]);
    State.setView('landing');
    State.showToast('Your session has expired. Please sign in again.', 'warning');
    renderApp();
  });

  // Check initial authentication
  const existingToken = API.getToken();
  if (existingToken) {
    try {
      const meRes = await API.auth.me();
      State.setUser(meRes.user);
      if (meRes.user.role === 'admin') {
        State.setView('admin');
      } else {
        const accRes = await API.accounts.list();
        State.setAccounts(accRes.accounts);
        State.setView('dashboard');
      }
    } catch {
      API.clearToken();
      State.setView('landing');
    }
  } else {
    State.setView('landing');
  }

  // Subscribe to state changes
  State.subscribe((event) => {
    if (event === 'view:changed' || event === 'user:changed') {
      renderNav();
      renderApp();
    }
  });

  // Initial render
  renderNav();
  renderApp();
  setupGlobalModals();
});

// ==========================================================================
// NAVIGATION RENDERING
// ==========================================================================
function renderNav() {
  const user = State.getUser();
  const currentView = State.getView();
  const navLinksContainer = document.getElementById('nav-links-container');
  const navActionsContainer = document.getElementById('nav-actions-container');

  if (!user) {
    // Public Navigation
    navLinksContainer.innerHTML = `
      <li class="nav-item ${currentView === 'landing' ? 'active' : ''}">
        <a href="#features" onclick="navigateToLandingSection('features')">Features</a>
      </li>
      <li class="nav-item">
        <a href="#security" onclick="navigateToLandingSection('security')">Security</a>
      </li>
      <li class="nav-item">
        <a href="#about" onclick="navigateToLandingSection('about')">About Us</a>
      </li>
    `;

    navActionsContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="openLoginModal()">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="openRegisterModal()">Open Account</button>
    `;
  } else if (user.role === 'admin') {
    // Administrator Navigation
    navLinksContainer.innerHTML = `
      <li class="nav-item ${currentView === 'admin' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('admin')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Admin Console
        </a>
      </li>
    `;

    const adminName = (user && (user.full_name || user.fullName)) || 'Administrator';
    navActionsContainer.innerHTML = `
      <div class="user-menu">
        <div class="user-avatar" style="background:#0f766e;">A</div>
        <div class="user-meta">
          <span class="user-name">${adminName}</span>
          <span class="user-role-badge">System Administrator</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Sign Out</button>
    `;
  } else {
    // Customer Navigation
    const customerName = (user && (user.full_name || user.fullName)) || 'Customer';
    const initial = (String(customerName || 'C').charAt(0) || 'C').toUpperCase();
    navLinksContainer.innerHTML = `
      <li class="nav-item ${currentView === 'dashboard' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('dashboard')">Dashboard</a>
      </li>
      <li class="nav-item ${currentView === 'accounts' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('accounts')">My Accounts</a>
      </li>
      <li class="nav-item ${currentView === 'transfer' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('transfer')">Transfer Money</a>
      </li>
      <li class="nav-item ${currentView === 'history' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('history')">History</a>
      </li>
      <li class="nav-item ${currentView === 'alerts' ? 'active' : ''}">
        <a href="javascript:void(0)" onclick="State.setView('alerts')">Security Alerts</a>
      </li>
    `;

    navActionsContainer.innerHTML = `
      <div class="user-menu">
        <div class="user-avatar">${initial}</div>
        <div class="user-meta">
          <span class="user-name">${customerName}</span>
          <span class="user-role-badge">Verified Customer</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Sign Out</button>
    `;
  }
}

// ==========================================================================
// APP ROUTING & VIEW SWITCHER
// ==========================================================================
function renderApp() {
  const view = State.getView();
  const main = document.getElementById('main-content');
  if (!main) return;

  switch (view) {
    case 'landing':
      renderLandingView(main);
      break;
    case 'dashboard':
      renderDashboardView(main);
      break;
    case 'accounts':
      renderAccountsView(main);
      break;
    case 'transfer':
      renderTransferView(main);
      break;
    case 'history':
      renderHistoryView(main);
      break;
    case 'alerts':
      renderAlertsView(main);
      break;
    case 'admin':
      renderAdminView(main);
      break;
    default:
      renderLandingView(main);
  }
}

// ==========================================================================
// VIEW: PUBLIC LANDING PAGE
// ==========================================================================
function renderLandingView(container) {
  container.innerHTML = `
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Multi-Tiered 2FA Security Architecture
        </div>
        <h1 class="hero-title">Next-Generation Digital Banking Built on <span>Ironclad Security</span></h1>
        <p class="hero-subtitle">
          Experience effortless transfers, real-time fraud monitoring, and automated high-value authorization. SecureBank protects your personal and commercial assets around the clock.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" onclick="openRegisterModal()">Open an Account</button>
          <button class="btn btn-secondary btn-lg" onclick="openLoginModal()">Sign In to Portal</button>
        </div>
      </div>
    </section>

    <!-- Demo Access Banner for Evaluation -->
    <div class="container">
      <div class="demo-access-banner">
        <div class="demo-access-info">
          <div class="stat-icon teal" style="margin-bottom:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </div>
          <div>
            <strong style="color:var(--text-primary); font-size:0.95rem;">Quick Demo Sign-In Credentials</strong>
            <p style="color:var(--text-muted); font-size:0.8rem; margin:0;">Click a persona below to auto-fill sign in details</p>
          </div>
        </div>
        <div class="demo-pills">
          <button class="demo-chip" onclick="quickFillCredentials('customer')">
            <strong>Customer:</strong> Rahul Sharma (Customer@2026)
          </button>
          <button class="demo-chip" onclick="quickFillCredentials('admin')">
            <strong>Administrator:</strong> Harsha (SecureBank@Admin2026)
          </button>
          <button class="demo-chip" onclick="copyTxnPin()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Txn PIN: TxnPin@9988
          </button>
        </div>
      </div>
    </div>

    <!-- Feature Highlights -->
    <section class="container" id="features">
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h3 class="feature-title">Tiered 2FA Authorization</h3>
          <p class="feature-desc">Transfers up to ₹5,000 process instantly. High-value transactions strictly mandate secondary bcrypt transaction-password validation.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          </div>
          <h3 class="feature-title">Atomic Peer Transfers</h3>
          <p class="feature-desc">Funds move between accounts with atomic debit and credit guarantees. No partial debits, duplicate charges, or phantom records.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h3 class="feature-title">Idempotent Protection</h3>
          <p class="feature-desc">Deterministic request fingerprinting ensures network retries and double-clicks never result in duplicate debit transactions.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </div>
          <h3 class="feature-title">Real-Time Fraud Screening</h3>
          <p class="feature-desc">High-value transfers automatically enter the security review queue with risk scoring and administrative investigation workflows.</p>
        </div>
      </div>
    </section>

    <!-- Security Assurance Section -->
    <section class="container" id="security" style="margin-bottom: 4rem;">
      <div class="card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 2.5rem;">
        <div style="max-width: 650px;">
          <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--teal-500);">Bank-Grade Security</span>
          <h2 style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0 1rem; color:#ffffff;">Zero Trust. Maximum Financial Integrity.</h2>
          <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
            All sensitive credentials, including login and transaction passwords, are hashed with bcrypt. Client ownership is verified on the trusted server before every financial debit.
          </p>
          <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span style="font-size:0.9rem; color:#f1f5f9;">256-bit Token Authorization</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span style="font-size:0.9rem; color:#f1f5f9;">Strict Decimal Precision</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span style="font-size:0.9rem; color:#f1f5f9;">Automated Audit Logs</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ==========================================================================
// VIEW: CUSTOMER DASHBOARD
// ==========================================================================
async function renderDashboardView(container) {
  const user = State.getUser();
  if (!user) {
    State.setView('landing');
    return;
  }

  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
            Welcome, ${user.full_name || user.fullName || 'Customer'}
          </h1>
          <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
            Online Banking Overview • Secure Session Active
          </p>
        </div>
        <div style="display:flex; gap:0.75rem;">
          <button class="btn btn-primary" onclick="State.setView('transfer')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            Send Money
          </button>
          <button class="btn btn-secondary" onclick="State.setView('history')">
            Transaction History
          </button>
        </div>
      </div>

      <!-- Live Notification Banner (if any alerts) -->
      <div id="dashboard-alert-banner"></div>

      <!-- Dashboard Metric Cards -->
      <div class="grid-4 mb-3">
        <div class="card stat-card">
          <div class="stat-icon teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          </div>
          <span class="stat-label">Total Liquid Balance</span>
          <span class="stat-value" id="dash-total-balance">Loading...</span>
          <span class="stat-desc">Across all active accounts</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <span class="stat-label">Active Accounts</span>
          <span class="stat-value" id="dash-account-count">—</span>
          <span class="stat-desc">Primary & secondary</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
          <span class="stat-label">Security Shield</span>
          <span class="stat-value" style="font-size:1.35rem; color:#059669;">Protected</span>
          <span class="stat-desc">2FA Tiered verification active</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <span class="stat-label">Account Status</span>
          <span class="stat-value" style="font-size:1.35rem; color:var(--text-primary);">Active</span>
          <span class="stat-desc">Identity verified</span>
        </div>
      </div>

      <!-- Accounts Carousel / Grid -->
      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h3 class="card-title">My Accounts</h3>
            <span class="card-subtitle">Select an account for quick actions</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="State.setView('accounts')">Manage Accounts</button>
        </div>
        <div class="grid-2" id="dash-accounts-grid">
          <div style="padding:2rem; text-align:center; color:var(--text-muted);">Loading accounts...</div>
        </div>
      </div>

      <!-- Recent Transactions Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Recent Transactions</h3>
            <span class="card-subtitle">Last 5 activities across your accounts</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="State.setView('history')">View All</button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date & Time</th>
                <th>Counterparty</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="dash-recent-tx-tbody">
              <tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading transactions...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Fetch live accounts, alerts & transactions in parallel
  try {
    const [accRes, alertRes, txRes] = await Promise.all([
      API.accounts.list(),
      API.alerts.list(),
      API.transactions.list()
    ]);

    State.setAccounts(accRes.accounts);
    const totalBalEl = document.getElementById('dash-total-balance');
    const accCountEl = document.getElementById('dash-account-count');
    if (totalBalEl) totalBalEl.textContent = State.formatINR(accRes.total_balance);
    if (accCountEl) accCountEl.textContent = accRes.accounts.length;

    // Render account cards in dashboard
    const accountsGrid = document.getElementById('dash-accounts-grid');
    if (accountsGrid) {
      if (accRes.accounts.length === 0) {
        accountsGrid.innerHTML = `<div style="padding:1.5rem; color:var(--text-muted);">No accounts found.</div>`;
      } else {
        accountsGrid.innerHTML = accRes.accounts.map(acc => `
          <div class="account-card">
            <div class="account-card-header">
              <div>
                <span class="account-badge-type">${acc.account_type}</span>
                <div class="account-number-mono">${acc.account_number}</div>
              </div>
              <span class="badge badge-success"><span class="badge-dot"></span>${acc.status}</span>
            </div>
            <div>
              <div style="font-size:0.8rem; color:var(--text-muted);">Available Balance</div>
              <div class="account-balance-amount">${State.formatINR(acc.balance)}</div>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
              <button class="btn btn-primary btn-sm" onclick="initiateTransferFrom(${acc.account_id})">Transfer</button>
              <button class="btn btn-secondary btn-sm" onclick="viewAccountStatement(${acc.account_id})">Statement</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render alerts banner
    const alertBanner = document.getElementById('dashboard-alert-banner');
    if (alertBanner && alertRes.alerts && alertRes.alerts.length > 0) {
      const pendingCount = alertRes.alerts.filter(a => a.review_status === 'pending' || a.review_status === 'under_review').length;
      if (pendingCount > 0) {
        alertBanner.innerHTML = `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:var(--radius-md); padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div>
                <strong style="color:#92400e; font-size:0.9rem;">Security Notice: ${pendingCount} transaction(s) undergoing verification</strong>
                <p style="color:#b45309; font-size:0.8rem; margin:0;">Our operations team is completing standard security checks.</p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="State.setView('alerts')">View Details</button>
          </div>
        `;
      }
    }

    // Render recent transactions
    const tbody = document.getElementById('dash-recent-tx-tbody');
    if (tbody) {
      const recent = (txRes.transactions || []).slice(0, 5);
      if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions recorded yet.</td></tr>`;
      } else {
        tbody.innerHTML = recent.map(tx => `
          <tr>
            <td class="font-mono">#TX-${tx.transaction_id}</td>
            <td>${State.formatDate(tx.transaction_time)}</td>
            <td>
              <strong>${tx.direction === 'debit' ? tx.receiver_name : tx.sender_name}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">${tx.description || 'Fund Transfer'}</div>
            </td>
            <td class="font-mono" style="font-size:0.8rem;">${tx.direction === 'debit' ? tx.sender_account_number : tx.receiver_account_number}</td>
            <td class="${tx.direction === 'debit' ? 'amount-debit' : 'amount-credit'}">
              ${tx.direction === 'debit' ? '-' : '+'} ${State.formatINR(tx.amount)}
            </td>
            <td>
              <span class="badge ${tx.status === 'successful' ? 'badge-success' : tx.status === 'pending_review' ? 'badge-warning' : 'badge-danger'}">
                ${tx.status}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="openTransactionReceipt(${tx.transaction_id})">Receipt</button>
            </td>
          </tr>
        `).join('');
      }
    }

  } catch (err) {
    State.showToast('Failed to load dashboard data: ' + err.message, 'error');
  }
}

function renderAccountsCardsHtml(accountsList) {
  if (!accountsList || accountsList.length === 0) {
    return `<div class="card" style="padding:2rem; color:var(--text-muted); grid-column: span 2;">No accounts found.</div>`;
  }
  return accountsList.map(acc => `
    <div class="card account-card" style="min-height: 220px;">
      <div class="account-card-header">
        <div>
          <span class="account-badge-type">${acc.account_type}</span>
          <div class="account-number-mono" style="margin-top:0.65rem;">
            ${acc.account_number}
            <button onclick="copyToClipboard('${acc.account_number}')" title="Copy Account Number" style="color:var(--text-muted);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <span class="badge badge-success"><span class="badge-dot"></span>${acc.status}</span>
      </div>

      <div style="margin: 1.25rem 0;">
        <div style="font-size:0.8rem; color:var(--text-muted);">Current Verified Balance</div>
        <div class="account-balance-amount">${State.formatINR(acc.balance)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">Created: ${State.formatDate(acc.created_at)}</div>
      </div>

      <div style="display:flex; gap:0.75rem; border-top:1px solid var(--border-subtle); padding-top:1rem;">
        <button class="btn btn-primary btn-sm" onclick="initiateTransferFrom(${acc.account_id})">Send Money</button>
        <button class="btn btn-secondary btn-sm" onclick="viewAccountStatement(${acc.account_id})">Itemized Statement</button>
      </div>
    </div>
  `).join('');
}

// ==========================================================================
// VIEW: MY ACCOUNTS
// ==========================================================================
async function renderAccountsView(container) {
  const cachedAccounts = State.getAccounts();
  const initialCardsHtml = (cachedAccounts && cachedAccounts.length > 0)
    ? renderAccountsCardsHtml(cachedAccounts)
    : `<div style="padding:2rem; color:var(--text-muted); grid-column: span 2;">Loading accounts...</div>`;

  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
            My Accounts
          </h1>
          <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
            Inspect your active accounts and verified balances
          </p>
        </div>
        <button class="btn btn-primary" onclick="State.setView('transfer')">Transfer Funds</button>
      </div>

      <div class="grid-2" id="accounts-page-grid">
        ${initialCardsHtml}
      </div>
    </div>
  `;

  try {
    const accRes = await API.accounts.list();
    State.setAccounts(accRes.accounts);
    const grid = document.getElementById('accounts-page-grid');
    if (grid) {
      grid.innerHTML = renderAccountsCardsHtml(accRes.accounts);
    }
  } catch (err) {
    State.showToast('Failed to load accounts: ' + err.message, 'error');
  }
}

// ==========================================================================
// VIEW: MONEY TRANSFER (WITH TIERED 2FA & IDEMPOTENCY)
// ==========================================================================
async function renderTransferView(container) {
  const accounts = State.getAccounts();
  const user = State.getUser();

  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem; max-width: 720px;">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
          Transfer Money
        </h1>
        <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
          Instant account-to-account transfer with multi-tier authorization
        </p>
      </div>

      <div class="card">
        <form id="transfer-form" onsubmit="handleTransferSubmit(event)">
          <!-- Sender Account Selection -->
          <div class="form-group">
            <label class="form-label" for="transfer-sender">From Account (Sender)</label>
            <select id="transfer-sender" class="form-control" required onchange="handleSenderChanged()">
              ${accounts.map(acc => `
                <option value="${acc.account_id}" data-balance="${acc.balance}">
                  ${acc.account_number} (${acc.account_type.toUpperCase()}) — Balance: ${State.formatINR(acc.balance)}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Recipient Account Number -->
          <div class="form-group">
            <label class="form-label" for="transfer-receiver">Recipient Account Number</label>
            <input type="text" id="transfer-receiver" class="form-control font-mono" placeholder="e.g. SB-1003-SAV-01" required oninput="handleRecipientInput(event)">
            <div id="recipient-verify-box" style="margin-top:0.5rem; font-size:0.85rem;"></div>
          </div>

          <!-- Transfer Amount -->
          <div class="form-group">
            <label class="form-label" for="transfer-amount">Amount (INR)</label>
            <div class="input-group">
              <span class="input-prefix">₹</span>
              <input type="number" id="transfer-amount" class="form-control input-with-prefix" placeholder="0.00" min="1" step="0.01" required oninput="handleAmountInput(event)">
            </div>
            
            <!-- Quick Amount Chips -->
            <div style="display:flex; gap:0.5rem; margin-top:0.65rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="setTransferAmount(500)">₹500</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="setTransferAmount(2500)">₹2,500</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="setTransferAmount(5000)">₹5,000</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="setTransferAmount(15000)">₹15,000</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="setTransferAmount(55000)">₹55,000</button>
            </div>
          </div>

          <!-- Tiered 2FA Security Notice -->
          <div id="transfer-security-banner" style="margin-bottom:1.25rem;">
            <div id="tier-banner-content"></div>
          </div>

          <!-- Optional Description -->
          <div class="form-group">
            <label class="form-label" for="transfer-desc">Transfer Description / Memo (Optional)</label>
            <input type="text" id="transfer-desc" class="form-control" placeholder="e.g. Consulting invoice, Split lunch">
          </div>

          <!-- Submit Button -->
          <div style="margin-top: 1.75rem;">
            <button type="submit" id="btn-submit-transfer" class="btn btn-primary btn-lg" style="width:100%;">
              Proceed to Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Focus receiver if preloaded
  handleAmountInput();
}

function setTransferAmount(val) {
  const input = document.getElementById('transfer-amount');
  if (input) {
    input.value = val;
    handleAmountInput();
  }
}

function handleAmountInput() {
  const amountInput = document.getElementById('transfer-amount');
  const bannerContent = document.getElementById('tier-banner-content');
  if (!amountInput || !bannerContent) return;

  const amount = parseFloat(amountInput.value) || 0;
  if (amount > 5000) {
    bannerContent.innerHTML = `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:var(--radius-md); padding:0.85rem 1rem; display:flex; align-items:center; gap:0.65rem;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <div>
          <strong style="color:#92400e; font-size:0.85rem;">Tier 2: Two-Factor Authentication (2FA) Mandatory</strong>
          <div style="font-size:0.775rem; color:#b45309;">Amount exceeds ₹5,000.00. You will be prompted to enter your 2FA Transaction Password PIN to authorize this transfer.</div>
        </div>
      </div>
    `;
  } else {
    bannerContent.innerHTML = `
      <div style="background:var(--teal-50); border:1px solid var(--teal-100); border-radius:var(--radius-md); padding:0.85rem 1rem; display:flex; align-items:center; gap:0.65rem;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <div>
          <strong style="color:var(--teal-800); font-size:0.85rem;">Tier 1 Standard Transfer (2FA Exempt)</strong>
          <div style="font-size:0.775rem; color:var(--teal-700);">Transfers up to ₹5,000.00 process instantly without requiring a secondary 2FA PIN.</div>
        </div>
      </div>
    `;
  }
}

let lookupTimer = null;
function handleRecipientInput(e) {
  clearTimeout(lookupTimer);
  const val = e.target.value.trim();
  const box = document.getElementById('recipient-verify-box');
  if (!val || val.length < 5) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `<span style="color:var(--text-muted);">Verifying recipient account...</span>`;
  lookupTimer = setTimeout(async () => {
    try {
      const res = await API.accounts.lookup(val);
      if (res.found) {
        if (res.account.is_own_account) {
          box.innerHTML = `<span style="color:#d97706; font-weight:600;">⚠ Notice: This is your own account (${res.account.account_type}).</span>`;
        } else {
          box.innerHTML = `<span style="color:#059669; font-weight:600;">✓ Verified Recipient: ${res.account.recipient_name} (${res.account.account_type.toUpperCase()})</span>`;
        }
      } else {
        box.innerHTML = `<span style="color:#dc2626;">✕ ${res.error}</span>`;
      }
    } catch {
      box.innerHTML = `<span style="color:#dc2626;">✕ Error verifying account.</span>`;
    }
  }, 400);
}

// Transfer Submission
async function handleTransferSubmit(e) {
  e.preventDefault();
  const senderId = document.getElementById('transfer-sender').value;
  const receiverNumber = document.getElementById('transfer-receiver').value.trim();
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  const description = document.getElementById('transfer-desc').value.trim();

  if (isNaN(amount) || amount <= 0) {
    State.showToast('Please enter a valid transfer amount.', 'error');
    return;
  }

  // Lookup receiver account ID
  let receiverAccountId = null;
  let receiverName = 'Recipient';
  try {
    const lookup = await API.accounts.lookup(receiverNumber);
    if (!lookup.found) {
      State.showToast(lookup.error || 'Recipient account not found.', 'error');
      return;
    }
    receiverAccountId = lookup.account.account_id;
    receiverName = lookup.account.recipient_name;
  } catch (err) {
    State.showToast('Recipient verification failed: ' + err.message, 'error');
    return;
  }

  // Open confirmation / 2FA Challenge modal
  openTransferConfirmModal({
    senderAccountId: senderId,
    receiverAccountId,
    receiverNumber,
    receiverName,
    amount,
    description
  });
}

// Confirmation Modal with Tiered 2FA Challenge
function openTransferConfirmModal(draft) {
  const modal = document.getElementById('global-modal');
  const modalContent = document.getElementById('global-modal-content');
  const is2FARequired = draft.amount > 5000;

  modalContent.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <div style="width:32px; height:32px; border-radius:50%; background:${is2FARequired ? '#fffbeb' : '#ecfdf5'}; color:${is2FARequired ? '#d97706' : '#059669'}; display:flex; align-items:center; justify-content:center;">
          ${is2FARequired ? 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`}
        </div>
        <h3 class="modal-title">${is2FARequired ? 'Two-Factor Authentication (2FA)' : 'Confirm Transfer'}</h3>
      </div>
      <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
    </div>

    <div>
      <!-- Tier Badge & Policy Notice -->
      ${is2FARequired ? `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:var(--radius-md); padding:0.85rem 1rem; margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <strong style="color:#92400e; font-size:0.85rem;">Tier 2 High-Value Authorization Required</strong>
            <span class="badge badge-warning">2FA Mandated</span>
          </div>
          <p style="color:#b45309; font-size:0.8rem; margin:0; line-height:1.4;">
            Transfers strictly exceeding ₹5,000.00 require secondary transaction-password authorization verified on the server via bcrypt.
          </p>
        </div>
      ` : `
        <div style="background:var(--teal-50); border:1px solid var(--teal-100); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--teal-800); font-size:0.825rem; font-weight:600;">✓ Tier 1 Standard Transfer</span>
          <span class="badge badge-success">2FA Exempt (≤ ₹5,000)</span>
        </div>
      `}

      <!-- Transaction Breakdown Box -->
      <div style="background:var(--bg-card-subtle); border-radius:var(--radius-md); padding:1rem 1.25rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.65rem;">
          <span style="color:var(--text-muted); font-size:0.85rem;">Transfer Amount</span>
          <strong style="font-size:1.35rem; color:var(--text-primary); letter-spacing:-0.02em;">${State.formatINR(draft.amount)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.85rem;">
          <span style="color:var(--text-muted);">Recipient</span>
          <span style="font-weight:600;">${draft.receiverName || 'Recipient'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.85rem;">
          <span style="color:var(--text-muted);">Destination Account</span>
          <span class="font-mono">${draft.receiverNumber}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
          <span style="color:var(--text-muted);">Transfer Fee</span>
          <span style="color:#059669; font-weight:600;">₹0.00 (Free)</span>
        </div>
      </div>

      <!-- Dedicated 2FA PIN Input (Shown only when > ₹5,000) -->
      ${is2FARequired ? `
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" for="confirm-modal-pin" style="display:flex; justify-content:space-between; align-items:center;">
            <span>Enter 2FA Transaction Password</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">Secondary Authorization PIN</span>
          </label>
          <div style="position:relative; display:flex; align-items:center;">
            <input type="password" id="confirm-modal-pin" class="form-control" placeholder="Enter your 2FA Transaction Password" autofocus required style="padding-right:4.5rem;">
            <button type="button" id="btn-toggle-pin" class="btn btn-secondary btn-sm" onclick="toggleConfirmPinVisibility()" style="position:absolute; right:6px; padding:3px 8px; font-size:0.75rem;">Show</button>
          </div>
          <div id="confirm-modal-pin-error" style="display:none; color:#dc2626; font-size:0.825rem; font-weight:600; margin-top:0.4rem;"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; font-size:0.75rem;">
            <span style="color:var(--text-muted);">Standard Demo PIN: <strong class="font-mono">TxnPin@9988</strong></span>
            <button type="button" class="demo-chip" style="font-size:0.75rem; padding:2px 8px;" onclick="fillConfirmPin('TxnPin@9988')">Auto-fill PIN</button>
          </div>
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" style="flex:1;" onclick="closeGlobalModal()">Cancel</button>
        <button id="btn-exec-transfer" class="btn btn-primary" style="flex:1;" onclick="executeConfirmedTransfer()">
          ${is2FARequired ? 'Verify 2FA & Transfer' : 'Confirm & Complete'}
        </button>
      </div>
    </div>
  `;

  window.activeTransferDraft = draft;
  modal.classList.add('active');

  if (is2FARequired) {
    setTimeout(() => {
      document.getElementById('confirm-modal-pin')?.focus();
    }, 150);
  }
}

function toggleConfirmPinVisibility() {
  const pinInput = document.getElementById('confirm-modal-pin');
  const btn = document.getElementById('btn-toggle-pin');
  if (!pinInput) return;
  if (pinInput.type === 'password') {
    pinInput.type = 'text';
    if (btn) btn.textContent = 'Hide';
  } else {
    pinInput.type = 'password';
    if (btn) btn.textContent = 'Show';
  }
}

function fillConfirmPin(pin) {
  const pinInput = document.getElementById('confirm-modal-pin');
  if (pinInput) {
    pinInput.value = pin;
    const errBox = document.getElementById('confirm-modal-pin-error');
    if (errBox) errBox.style.display = 'none';
    pinInput.style.borderColor = 'var(--border-focus)';
  }
}

async function executeConfirmedTransfer() {
  const draft = window.activeTransferDraft;
  if (!draft) return;

  const is2FARequired = draft.amount > 5000;
  let transactionPassword = null;

  if (is2FARequired) {
    const pinInput = document.getElementById('confirm-modal-pin');
    const errBox = document.getElementById('confirm-modal-pin-error');
    transactionPassword = pinInput ? pinInput.value.trim() : '';

    if (!transactionPassword) {
      if (errBox) {
        errBox.textContent = 'Please enter your 2FA Transaction Password PIN.';
        errBox.style.display = 'block';
      }
      if (pinInput) {
        pinInput.style.borderColor = '#dc2626';
        pinInput.focus();
      }
      return;
    }
  }

  const btn = document.getElementById('btn-exec-transfer');
  if (btn) {
    btn.disabled = true;
    btn.textContent = is2FARequired ? 'Verifying 2FA PIN...' : 'Processing Transfer...';
  }

  // Generate unique idempotency key for this transfer attempt
  const idempotencyKey = API.generateIdempotencyKey();

  try {
    const res = await API.transfers.execute({
      senderAccountId: draft.senderAccountId,
      receiverAccountId: draft.receiverAccountId,
      amount: draft.amount,
      description: draft.description,
      transactionPassword,
      idempotencyKey
    });

    closeGlobalModal();
    State.showToast(is2FARequired ? '2FA Verified! Transfer completed successfully.' : 'Transfer completed successfully!', 'success');

    // Refresh accounts in state
    const accRes = await API.accounts.list();
    State.setAccounts(accRes.accounts);

    // Show receipt
    openTransactionReceipt(res.data.transaction_id);

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = is2FARequired ? 'Verify 2FA & Transfer' : 'Confirm & Complete';
    }

    // If 2FA PIN error, keep modal open and highlight the error inside the modal!
    const errBox = document.getElementById('confirm-modal-pin-error');
    const pinInput = document.getElementById('confirm-modal-pin');
    if (is2FARequired && errBox && pinInput) {
      errBox.textContent = '✕ ' + (err.message || 'Invalid 2FA Transaction Password PIN.');
      errBox.style.display = 'block';
      pinInput.style.borderColor = '#dc2626';
      pinInput.value = '';
      pinInput.focus();
    } else {
      State.showToast('Transfer failed: ' + err.message, 'error');
    }
  }
}

// Receipt Modal with 2FA Verification Status
async function openTransactionReceipt(txId) {
  try {
    const res = await API.transactions.get(txId);
    const tx = res.transaction;
    const is2FA = parseFloat(tx.amount) > 5000;

    const modal = document.getElementById('global-modal');
    const modalContent = document.getElementById('global-modal-content');

    modalContent.innerHTML = `
      <div class="receipt-box">
        <div class="receipt-header">
          <div class="receipt-icon-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span style="font-size:0.8rem; font-weight:700; color:#059669; text-transform:uppercase; letter-spacing:0.05em;">Payment Successful</span>
          <div class="receipt-amount">${State.formatINR(tx.amount)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${State.formatDate(tx.transaction_time)}</div>
        </div>

        <div class="receipt-row">
          <span class="receipt-label">Transaction Reference</span>
          <span class="receipt-val font-mono">#TX-${tx.transaction_id}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Two-Factor Authentication (2FA)</span>
          <span class="receipt-val" style="color:${is2FA ? '#059669' : 'var(--text-muted)'}; font-weight:700;">
            ${is2FA ? '✓ Verified & Passed (bcrypt)' : 'Exempt (Tier 1 ≤ ₹5,000)'}
          </span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Debited From</span>
          <span class="receipt-val font-mono">${tx.sender_account_number}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Credited To</span>
          <span class="receipt-val font-mono">${tx.receiver_account_number}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Sender Name</span>
          <span class="receipt-val">${tx.sender_name}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Recipient Name</span>
          <span class="receipt-val">${tx.receiver_name}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Description / Memo</span>
          <span class="receipt-val">${tx.description || 'Fund Transfer'}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Status</span>
          <span class="receipt-val" style="color:#059669;">${tx.status.toUpperCase()}</span>
        </div>

        <div style="display:flex; gap:0.75rem; margin-top:1.75rem;">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.print()">Print Receipt</button>
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="closeGlobalModal(); State.setView('history');">View in History</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  } catch (err) {
    State.showToast('Could not load receipt: ' + err.message, 'error');
  }
}

// ==========================================================================
// VIEW: TRANSACTION HISTORY (FULL LEDGER WITH FILTERS)
// ==========================================================================
async function renderHistoryView(container) {
  let accounts = State.getAccounts();
  if (!accounts || accounts.length === 0) {
    try {
      const accRes = await API.accounts.list();
      accounts = accRes.accounts || [];
      State.setAccounts(accounts);
    } catch {}
  }

  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
            Transaction History
          </h1>
          <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
            Itemized monetary ledger across your registered bank accounts
          </p>
        </div>
        <button class="btn btn-primary" onclick="State.setView('transfer')">Transfer Money</button>
      </div>

      <!-- Filters Panel -->
      <div class="card mb-3">
        <div class="grid-4" style="gap:1rem;">
          <div>
            <label class="form-label" style="font-size:0.8rem;">Search</label>
            <input type="text" id="filter-search" class="form-control" placeholder="Ref ID, counterparty..." oninput="debounceFilterTransactions()">
          </div>
          <div>
            <label class="form-label" style="font-size:0.8rem;">Account</label>
            <select id="filter-account" class="form-control" onchange="filterTransactions()">
              <option value="">All Accounts</option>
              ${accounts.map(a => `<option value="${a.account_id}">${a.account_number}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:0.8rem;">Flow Type</label>
            <select id="filter-type" class="form-control" onchange="filterTransactions()">
              <option value="">All Flows</option>
              <option value="debit">Outflow (Debited)</option>
              <option value="credit">Inflow (Credited)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:0.8rem;">Status</label>
            <select id="filter-status" class="form-control" onchange="filterTransactions()">
              <option value="">All Statuses</option>
              <option value="successful">Successful</option>
              <option value="pending_review">Pending Review</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transactions Ledger Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date & Time</th>
                <th>Counterparty</th>
                <th>Source Account</th>
                <th>Destination Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody id="tx-history-tbody">
              <tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading transactions...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  filterTransactions();
}

let filterTimer = null;
function debounceFilterTransactions() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(filterTransactions, 300);
}

async function filterTransactions() {
  const search = document.getElementById('filter-search')?.value || '';
  const accountId = document.getElementById('filter-account')?.value || '';
  const type = document.getElementById('filter-type')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('tx-history-tbody');
  if (!tbody) return;

  try {
    const res = await API.transactions.list({ search, accountId, type, status });
    const list = res.transactions || [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">No matching transactions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(tx => `
      <tr>
        <td class="font-mono">#TX-${tx.transaction_id}</td>
        <td>${State.formatDate(tx.transaction_time)}</td>
        <td>
          <strong>${tx.direction === 'debit' ? tx.receiver_name : tx.sender_name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${tx.description || 'Direct Transfer'}</div>
        </td>
        <td class="font-mono" style="font-size:0.8rem;">${tx.sender_account_number}</td>
        <td class="font-mono" style="font-size:0.8rem;">${tx.receiver_account_number}</td>
        <td class="${tx.direction === 'debit' ? 'amount-debit' : 'amount-credit'}">
          ${tx.direction === 'debit' ? '-' : '+'} ${State.formatINR(tx.amount)}
        </td>
        <td>
          <span class="badge ${tx.status === 'successful' ? 'badge-success' : tx.status === 'pending_review' ? 'badge-warning' : 'badge-danger'}">
            ${tx.status}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openTransactionReceipt(${tx.transaction_id})">Receipt</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

// ==========================================================================
// ==========================================================================
// VIEW: CUSTOMER SECURITY CENTER & ALERTS
// ==========================================================================
async function renderAlertsView(container) {
  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem; max-width: 880px;">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
          Security Center & Alerts
        </h1>
        <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
          Two-factor authentication controls, authorization logs, and compliance notices
        </p>
      </div>

      <!-- 2FA Security Overview Card -->
      <div class="card mb-3" style="border: 1px solid var(--border-subtle); overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            <div style="width:48px; height:48px; border-radius:var(--radius-md); background:var(--teal-50); color:var(--teal-700); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin:0;">
                  Two-Factor Authentication (2FA)
                </h3>
                <span class="badge badge-success">Active & Enforced</span>
              </div>
              <p style="color:var(--text-secondary); font-size:0.875rem; margin:0; line-height:1.5; max-width:560px;">
                SecureBank enforces tiered security: transfers strictly exceeding <strong>₹5,000.00</strong> require secondary 2FA Transaction Password authorization, cryptographically verified on the server via bcrypt.
              </p>
              <div style="margin-top:0.65rem; font-size:0.8rem; color:var(--text-muted);">
                Default Evaluation PIN: <code class="font-mono" style="background:var(--bg-card-subtle); padding:2px 6px; border-radius:4px; font-weight:600; color:var(--text-primary);">TxnPin@9988</code>
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="openUpdate2FAPinModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Update 2FA PIN
            </button>
          </div>
        </div>
      </div>

      <!-- 2FA Authorization Activity Log Card -->
      <div class="card mb-3">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">
            Recent 2FA Verification Activity
          </h3>
          <span style="font-size:0.75rem; color:var(--text-muted);">Live Server Audit Trail</span>
        </div>
        <div id="twofa-history-container">
          <div style="padding:1rem; color:var(--text-muted); font-size:0.85rem;">Loading verification activity...</div>
        </div>
      </div>

      <!-- Compliance & High-Value Alerts Section -->
      <div style="margin-top:2rem; margin-bottom:1rem;">
        <h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">
          Transaction Compliance Notices
        </h3>
        <p style="color:var(--text-muted); font-size:0.825rem; margin-top:2px;">
          Automated monitoring and routine compliance updates
        </p>
      </div>

      <div id="alerts-list-container">
        <div style="padding:2rem; color:var(--text-muted);">Loading notices...</div>
      </div>
    </div>
  `;

  // Fetch 2FA History & Alerts in parallel
  try {
    const [alertsRes, historyRes] = await Promise.all([
      API.alerts.list().catch(() => ({ alerts: [] })),
      API.auth.get2FAHistory().catch(() => ({ attempts: [] }))
    ]);

    // Render 2FA History
    const historyContainer = document.getElementById('twofa-history-container');
    const attempts = (historyRes && historyRes.attempts) || [];
    if (historyContainer) {
      if (attempts.length === 0) {
        historyContainer.innerHTML = `
          <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
            No recent 2FA verification attempts logged. (Transfers > ₹5,000 will be audited here).
          </div>
        `;
      } else {
        historyContainer.innerHTML = `
          <div style="overflow-x:auto;">
            <table class="table" style="font-size:0.85rem; margin:0;">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Verification Result</th>
                  <th>Security Factor</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                ${attempts.map(att => `
                  <tr>
                    <td>${State.formatDate(att.attempt_time)}</td>
                    <td>
                      ${att.success === 1 || att.success === true ? 
                        '<span class="badge badge-success" style="font-size:0.75rem;">✓ 2FA Verified (Passed)</span>' : 
                        '<span class="badge badge-danger" style="font-size:0.75rem;">✕ Invalid PIN (Failed)</span>'}
                    </td>
                    <td style="color:var(--text-secondary);">Transaction Password (bcrypt)</td>
                    <td class="font-mono" style="font-size:0.8rem; color:var(--text-muted);">${att.ip_address || '127.0.0.1'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    // Render Compliance Notices
    const containerEl = document.getElementById('alerts-list-container');
    const alerts = (alertsRes && alertsRes.alerts) || [];

    if (containerEl) {
      if (alerts.length === 0) {
        containerEl.innerHTML = `
          <div class="card" style="text-align:center; padding:2.5rem;">
            <div style="width:40px; height:40px; border-radius:50%; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin:0;">All Clear</h4>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.35rem; margin-bottom:0;">No compliance reviews or pending transaction notices on your accounts.</p>
          </div>
        `;
      } else {
        containerEl.innerHTML = alerts.map(a => `
          <div class="card mb-2" style="border-left: 4px solid ${a.review_status === 'resolved' ? '#10b981' : '#f59e0b'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
              <div>
                <strong style="color:var(--text-primary); font-size:1rem;">Routine High-Value Transfer Notice</strong>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                  ${State.formatDate(a.date)} • Ref: #TX-${a.transaction_id}
                </div>
              </div>
              <span class="badge ${a.review_status === 'resolved' ? 'badge-success' : 'badge-warning'}">
                ${a.status_label}
              </span>
            </div>
            <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin:0;">
              ${a.customer_message}
            </p>
            <div style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted);">
              Our compliance team conducts standard security checks on transfers exceeding threshold amounts. No manual customer intervention is required.
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    State.showToast('Failed to load security center: ' + err.message, 'error');
  }
}

// ==========================================================================
// VIEW: ADMINISTRATOR CONSOLE
// ==========================================================================
async function renderAdminView(container) {
  const user = State.getUser();
  if (!user || user.role !== 'admin') {
    State.setView('landing');
    return;
  }

  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; padding-bottom: 3rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800; color:var(--text-primary); letter-spacing:-0.02em;">
            SecureBank Administration Console
          </h1>
          <p style="color:var(--text-muted); font-size:0.925rem; margin-top:0.25rem;">
            Fraud Alert Review Queue, Automated Cursor Scan & Security Audit Trail
          </p>
        </div>
        <div style="display:flex; gap:0.75rem;">
          <button class="btn btn-primary" onclick="triggerAutomatedFraudScan()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Run Anomaly Scan (Cursor)
          </button>
        </div>
      </div>

      <!-- Admin Overview Stat Cards -->
      <div class="grid-4 mb-3">
        <div class="card stat-card">
          <div class="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="stat-label">Total Customers</span>
          <span class="stat-value" id="admin-total-customers">—</span>
          <span class="stat-desc">Registered users</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          </div>
          <span class="stat-label">System Deposits</span>
          <span class="stat-value" id="admin-total-deposits">—</span>
          <span class="stat-desc">Active account balances</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
          <span class="stat-label">Total Volume</span>
          <span class="stat-value" id="admin-total-volume">—</span>
          <span class="stat-desc">Successful transfers</span>
        </div>

        <div class="card stat-card">
          <div class="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
          </div>
          <span class="stat-label">Pending Fraud Alerts</span>
          <span class="stat-value" id="admin-pending-alerts" style="color:#d97706;">—</span>
          <span class="stat-desc">Awaiting administrator review</span>
        </div>
      </div>

      <!-- Sub-tabs navigation -->
      <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.5rem;">
        <button id="admin-tab-alerts" class="btn btn-secondary btn-sm" onclick="switchAdminSubTab('alerts')">Fraud Alert Queue</button>
        <button id="admin-tab-audit" class="btn btn-secondary btn-sm" onclick="switchAdminSubTab('audit')">Security Audit Trail</button>
        <button id="admin-tab-txns" class="btn btn-secondary btn-sm" onclick="switchAdminSubTab('txns')">System Transactions</button>
      </div>

      <!-- Fraud Alerts Queue Table -->
      <div id="admin-view-alerts" class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Fraud Alert Investigation Queue</h3>
            <span class="card-subtitle">Transactions flagged by real-time threshold & anomaly triggers</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Tx Ref</th>
                <th>Amount</th>
                <th>Customer</th>
                <th>Account</th>
                <th>Risk Score</th>
                <th>Review Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="admin-alerts-tbody">
              <tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading alerts...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audit Trail Table (Hidden by default) -->
      <div id="admin-view-audit" class="card" style="display:none;">
        <div class="card-header">
          <div>
            <h3 class="card-title">Immutable Security Audit Trail</h3>
            <span class="card-subtitle">Automated system and operational events</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="admin-audit-tbody">
              <tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading audit trail...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- System Transactions Table (Hidden by default) -->
      <div id="admin-view-txns" class="card" style="display:none;">
        <div class="card-header">
          <div>
            <h3 class="card-title">Global Transaction Ledger</h3>
            <span class="card-subtitle">All transactions across the banking network</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Date & Time</th>
                <th>Sender</th>
                <th>Receiver</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="admin-txns-tbody">
              <tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading ledger...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Load Admin Data
  loadAdminOverview();
  loadAdminAlerts();
}

function switchAdminSubTab(tab) {
  document.getElementById('admin-view-alerts').style.display = tab === 'alerts' ? 'block' : 'none';
  document.getElementById('admin-view-audit').style.display = tab === 'audit' ? 'block' : 'none';
  document.getElementById('admin-view-txns').style.display = tab === 'txns' ? 'block' : 'none';

  document.getElementById('admin-tab-alerts').className = tab === 'alerts' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  document.getElementById('admin-tab-audit').className = tab === 'audit' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  document.getElementById('admin-tab-txns').className = tab === 'txns' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

  if (tab === 'audit') loadAdminAudit();
  if (tab === 'txns') loadAdminTransactions();
}

async function loadAdminOverview() {
  try {
    const res = await API.admin.overview();
    const stats = res.stats;
    document.getElementById('admin-total-customers').textContent = stats.total_customers;
    document.getElementById('admin-total-deposits').textContent = State.formatINR(stats.total_deposits);
    document.getElementById('admin-total-volume').textContent = State.formatINR(stats.total_volume);
    document.getElementById('admin-pending-alerts').textContent = stats.pending_alerts;
  } catch (err) {
    console.error('Failed to load admin overview:', err);
  }
}

async function loadAdminAlerts() {
  const tbody = document.getElementById('admin-alerts-tbody');
  if (!tbody) return;

  try {
    const res = await API.admin.alerts();
    const alerts = res.alerts || [];

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No fraud alerts registered.</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td class="font-mono">#ALT-${a.alert_id}</td>
        <td class="font-mono">#TX-${a.transaction_id}</td>
        <td style="font-weight:700;">${State.formatINR(a.amount)}</td>
        <td>
          <strong>${a.customer_name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${a.customer_email}</div>
        </td>
        <td class="font-mono" style="font-size:0.8rem;">${a.account_number}</td>
        <td>
          <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.8rem; background:${a.risk_score >= 8 ? '#fef2f2' : '#fffbeb'}; color:${a.risk_score >= 8 ? '#dc2626' : '#d97706'};">
            ${a.risk_score} / 10
          </span>
        </td>
        <td>
          <span class="badge ${a.review_status === 'resolved' ? 'badge-success' : a.review_status === 'dismissed' ? 'badge-secondary' : 'badge-warning'}">
            ${a.review_status}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openReviewAlertModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">Review</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

async function loadAdminAudit() {
  const tbody = document.getElementById('admin-audit-tbody');
  if (!tbody) return;

  try {
    const res = await API.admin.auditLogs();
    const logs = res.logs || [];

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="font-mono">#LOG-${l.log_id}</td>
        <td style="font-size:0.8rem;">${State.formatDate(l.created_at)}</td>
        <td>
          <strong>${l.full_name || 'System Actor'}</strong>
          ${l.role ? `<span style="font-size:0.7rem; color:var(--text-muted);"> (${l.role})</span>` : ''}
        </td>
        <td><span class="font-mono" style="font-size:0.8rem; color:var(--teal-700);">${l.action}</span></td>
        <td style="font-size:0.85rem; max-width:350px; word-break:break-all;">${l.details}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

async function loadAdminTransactions() {
  const tbody = document.getElementById('admin-txns-tbody');
  if (!tbody) return;

  try {
    const res = await API.admin.transactions();
    const txns = res.transactions || [];

    tbody.innerHTML = txns.map(tx => `
      <tr>
        <td class="font-mono">#TX-${tx.transaction_id}</td>
        <td style="font-size:0.8rem;">${State.formatDate(tx.transaction_time)}</td>
        <td>${tx.sender_name} <span class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">(${tx.sender_account_number})</span></td>
        <td>${tx.receiver_name} <span class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">(${tx.receiver_account_number})</span></td>
        <td style="font-weight:700;">${State.formatINR(tx.amount)}</td>
        <td><span class="badge badge-success">${tx.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

// Admin Alert Review Modal
function openReviewAlertModal(alert) {
  const modal = document.getElementById('global-modal');
  const modalContent = document.getElementById('global-modal-content');

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Fraud Alert Review (#ALT-${alert.alert_id})</h3>
      <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
    </div>
    <div>
      <div style="background:var(--bg-card-subtle); border-radius:var(--radius-md); padding:1rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--text-muted); font-size:0.85rem;">Transaction</span>
          <span class="font-mono">#TX-${alert.transaction_id} (${State.formatINR(alert.amount)})</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--text-muted); font-size:0.85rem;">Customer Account</span>
          <span class="font-mono">${alert.account_number}</span>
        </div>
        <div style="margin-top:0.75rem; font-size:0.85rem; color:var(--text-secondary);">
          <strong>Trigger Reason:</strong> ${alert.reason}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="alert-status-select">Set Review Status</label>
        <select id="alert-status-select" class="form-control">
          <option value="pending" ${alert.review_status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="under_review" ${alert.review_status === 'under_review' ? 'selected' : ''}>Under Review (Investigating)</option>
          <option value="resolved" ${alert.review_status === 'resolved' ? 'selected' : ''}>Resolved (Verified Genuine)</option>
          <option value="dismissed" ${alert.review_status === 'dismissed' ? 'selected' : ''}>Dismissed (False Positive)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="alert-notes-input">Administrator Notes</label>
        <textarea id="alert-notes-input" class="form-control" rows="3" placeholder="Enter KYC details or review notes...">${alert.review_notes || ''}</textarea>
      </div>

      <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" style="flex:1;" onclick="closeGlobalModal()">Cancel</button>
        <button class="btn btn-primary" style="flex:1;" onclick="submitAlertReview(${alert.alert_id})">Save Decision</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

async function submitAlertReview(alertId) {
  const status = document.getElementById('alert-status-select').value;
  const notes = document.getElementById('alert-notes-input').value.trim();

  try {
    await API.admin.updateAlert(alertId, status, notes);
    closeGlobalModal();
    State.showToast(`Alert #${alertId} updated to ${status}.`, 'success');
    loadAdminAlerts();
    loadAdminOverview();
  } catch (err) {
    State.showToast('Failed to update alert: ' + err.message, 'error');
  }
}

// Automated Cursor Scan Trigger
async function triggerAutomatedFraudScan() {
  State.showToast('Initiating automated cursor scan across transactions > ₹50,000...', 'info');
  try {
    const res = await API.admin.scanFraud(50000.00);
    State.showToast(`Scan complete: ${res.new_alerts_created} new alert(s) generated.`, 'success');
    loadAdminAlerts();
    loadAdminOverview();
  } catch (err) {
    State.showToast('Scan failed: ' + err.message, 'error');
  }
}

// ==========================================================================
// MODAL CONTROLLERS: LOGIN & REGISTER
// ==========================================================================
function setupGlobalModals() {
  // Modal click outside to close
  const modal = document.getElementById('global-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeGlobalModal();
    });
  }
}

function closeGlobalModal() {
  const modal = document.getElementById('global-modal');
  if (modal) modal.classList.remove('active');
}

function openLoginModal() {
  const modal = document.getElementById('global-modal');
  const modalContent = document.getElementById('global-modal-content');

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Sign In to SecureBank</h3>
      <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
    </div>
    <div>
      <form id="login-form" onsubmit="handleLoginSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="login-email">Email Address</label>
          <input type="email" id="login-email" class="form-control" placeholder="name@securebank.com" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Password</label>
          <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
        </div>
        <div style="margin-top:1.5rem;">
          <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width:100%;">Sign In</button>
        </div>
      </form>

      <div style="margin-top:1.5rem; text-align:center; font-size:0.875rem; color:var(--text-muted);">
        Don't have an account? <a href="#" onclick="openRegisterModal(); return false;" style="font-weight:600;">Create one</a>
      </div>

      <!-- Quick persona filler inside modal -->
      <div style="margin-top:1.25rem; padding-top:1rem; border-top:1px dashed var(--border-subtle); display:flex; justify-content:center; gap:0.5rem;">
        <button class="demo-chip" type="button" onclick="quickFillForm('rahul.sharma@securebank.com', 'Customer@2026')">Fill Customer</button>
        <button class="demo-chip" type="button" onclick="quickFillForm('harsha.admin@securebank.com', 'SecureBank@Admin2026')">Fill Admin</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function quickFillForm(email, password) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login-submit');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Authenticating...';
  }

  try {
    const res = await API.auth.login({ email, password });
    State.setUser(res.user);
    closeGlobalModal();
    State.showToast(`Welcome back, ${res.user.full_name || res.user.fullName || 'User'}!`, 'success');

    if (res.user.role === 'admin') {
      State.setView('admin');
    } else {
      const accRes = await API.accounts.list();
      State.setAccounts(accRes.accounts);
      State.setView('dashboard');
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
    State.showToast(err.message, 'error');
  }
}

function openRegisterModal() {
  const modal = document.getElementById('global-modal');
  const modalContent = document.getElementById('global-modal-content');

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Open a SecureBank Account</h3>
      <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
    </div>
    <div>
      <form id="register-form" onsubmit="handleRegisterSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="reg-fullname">Full Legal Name</label>
          <input type="text" id="reg-fullname" class="form-control" placeholder="e.g. Vikram Malhotra" required minlength="2">
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-email">Email Address</label>
          <input type="email" id="reg-email" class="form-control" placeholder="name@example.com" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-password">Login Password (min 6 characters)</label>
          <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required minlength="6">
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-txn-pin">
            Transaction Password (2FA PIN)
          </label>
          <input type="password" id="reg-txn-pin" class="form-control" placeholder="e.g. TxnPin@9988" required minlength="4">
          <div class="form-help">Mandatory 2FA PIN required for authorizing transfers strictly greater than ₹5,000.</div>
        </div>
        <div style="margin-top:1.5rem;">
          <button type="submit" id="btn-register-submit" class="btn btn-primary" style="width:100%;">Create Account</button>
        </div>
      </form>

      <div style="margin-top:1.5rem; text-align:center; font-size:0.875rem; color:var(--text-muted);">
        Already have an account? <a href="#" onclick="openLoginModal(); return false;" style="font-weight:600;">Sign In</a>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const transactionPassword = document.getElementById('reg-txn-pin').value;
  const btn = document.getElementById('btn-register-submit');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Provisioning Account...';
  }

  try {
    const res = await API.auth.register({ fullName, email, password, transactionPassword });
    State.setUser(res.user);
    closeGlobalModal();
    State.showToast('Account successfully provisioned with initial ₹25,000.00 deposit!', 'success');

    const accRes = await API.accounts.list();
    State.setAccounts(accRes.accounts);
    State.setView('dashboard');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
    State.showToast(err.message, 'error');
  }
}

async function handleLogout() {
  await API.auth.logout();
  State.setUser(null);
  State.setAccounts([]);
  State.setView('landing');
  State.showToast('You have been signed out safely.', 'info');
}

// ==========================================================================
// UTILITY ACTIONS & HELPERS
// ==========================================================================
function initiateTransferFrom(accountId) {
  State.setView('transfer');
  setTimeout(() => {
    const senderSelect = document.getElementById('transfer-sender');
    if (senderSelect) {
      senderSelect.value = accountId;
    }
  }, 100);
}

async function viewAccountStatement(accountId) {
  try {
    const res = await API.accounts.getStatement(accountId);
    const stmt = res.statement || [];

    const modal = document.getElementById('global-modal');
    const modalContent = document.getElementById('global-modal-content');

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Account Statement</h3>
        <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
      </div>
      <div>
        <div class="table-responsive" style="max-height:400px; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Flow</th>
                <th>Amount</th>
                <th>Counterparty</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              ${stmt.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No transactions in statement window.</td></tr>' : 
                stmt.map(s => `
                  <tr>
                    <td style="font-size:0.8rem;">${State.formatDate(s.transaction_time)}</td>
                    <td>
                      <span class="badge ${s.transaction_type === 'DEBIT' ? 'badge-danger' : 'badge-success'}">${s.transaction_type}</span>
                    </td>
                    <td style="font-weight:700;">${State.formatINR(s.amount)}</td>
                    <td class="font-mono" style="font-size:0.8rem;">#${s.counterparty_account_id}</td>
                    <td style="font-size:0.85rem;">${s.description || '—'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
        <div style="margin-top:1.5rem; text-align:right;">
          <button class="btn btn-secondary btn-sm" onclick="closeGlobalModal()">Close</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  } catch (err) {
    State.showToast('Failed to load statement: ' + err.message, 'error');
  }
}

function quickFillCredentials(role) {
  openLoginModal();
  setTimeout(() => {
    if (role === 'customer') {
      quickFillForm('rahul.sharma@securebank.com', 'Customer@2026');
    } else {
      quickFillForm('harsha.admin@securebank.com', 'SecureBank@Admin2026');
    }
  }, 100);
}

function copyTxnPin() {
  navigator.clipboard.writeText('TxnPin@9988');
  State.showToast('Transaction PIN copied to clipboard: TxnPin@9988', 'info');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  State.showToast('Account number copied: ' + text, 'info');
}

// ==========================================================================
// 2FA PIN MANAGEMENT MODAL
// ==========================================================================
function openUpdate2FAPinModal() {
  const modal = document.getElementById('global-modal');
  const modalContent = document.getElementById('global-modal-content');

  modalContent.innerHTML = `
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <div style="width:32px; height:32px; border-radius:50%; background:var(--teal-50); color:var(--teal-700); display:flex; align-items:center; justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h3 class="modal-title">Update 2FA PIN</h3>
      </div>
      <button class="modal-close" onclick="closeGlobalModal()">&times;</button>
    </div>

    <div>
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">
        Your 2FA Transaction Password PIN is required whenever you transfer amounts strictly greater than <strong>₹5,000.00</strong>.
      </p>

      <form id="update-pin-form" onsubmit="handleUpdateTxnPinSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="pin-cur-pass">Current Login Password</label>
          <input type="password" id="pin-cur-pass" class="form-control" placeholder="Verify your login password" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="pin-new-pin">New 2FA Transaction PIN (min 4 characters)</label>
          <input type="password" id="pin-new-pin" class="form-control" placeholder="Enter new PIN / password" required minlength="4">
        </div>

        <div class="form-group">
          <label class="form-label" for="pin-confirm-pin">Confirm New 2FA PIN</label>
          <input type="password" id="pin-confirm-pin" class="form-control" placeholder="Re-enter new PIN" required minlength="4">
        </div>

        <div id="pin-update-error" style="display:none; color:#dc2626; font-size:0.825rem; font-weight:600; margin-bottom:1rem;"></div>

        <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" style="flex:1;" onclick="closeGlobalModal()">Cancel</button>
          <button type="submit" id="btn-submit-update-pin" class="btn btn-primary" style="flex:1;">Update 2FA PIN</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('active');
}

async function handleUpdateTxnPinSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('pin-cur-pass').value;
  const newTxnPassword = document.getElementById('pin-new-pin').value;
  const confirmPin = document.getElementById('pin-confirm-pin').value;
  const errBox = document.getElementById('pin-update-error');
  const btn = document.getElementById('btn-submit-update-pin');

  if (newTxnPassword !== confirmPin) {
    if (errBox) {
      errBox.textContent = '✕ New 2FA PIN and confirmation do not match.';
      errBox.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
  }

  try {
    await API.auth.updateTxnPin({ currentPassword, newTxnPassword });
    closeGlobalModal();
    State.showToast('2FA Transaction Password successfully updated!', 'success');
    // Refresh alerts view to show updated status
    if (State.getView() === 'alerts') {
      renderAlertsView(document.getElementById('main-content'));
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update 2FA PIN';
    }
    if (errBox) {
      errBox.textContent = '✕ ' + err.message;
      errBox.style.display = 'block';
    }
  }
}

function navigateToLandingSection(sectionId) {
  if (State.getView() !== 'landing') {
    State.setView('landing');
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  } else {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }
}

