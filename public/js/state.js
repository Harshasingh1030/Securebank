/**
 * SECUREBANK APPLICATION STATE & UTILITIES
 */

const State = (() => {
  let currentUser = null;
  let userAccounts = [];
  let currentView = 'landing'; // landing, dashboard, accounts, transfer, history, alerts, admin

  const listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify(event, data) {
    listeners.forEach(fn => fn(event, data));
  }

  function setUser(user) {
    if (user) {
      const name = user.full_name || user.fullName || 'User';
      currentUser = {
        ...user,
        userId: user.userId || user.user_id,
        user_id: user.user_id || user.userId,
        fullName: name,
        full_name: name
      };
    } else {
      currentUser = null;
    }
    notify('user:changed', currentUser);
  }

  function getUser() {
    return currentUser;
  }

  function setAccounts(accounts) {
    userAccounts = accounts || [];
  }

  function getAccounts() {
    return userAccounts;
  }

  function setView(view) {
    if (currentView === view) return;
    currentView = view;
    notify('view:changed', currentView);
  }

  function getView() {
    return currentView;
  }

  // Currency & Date Formatting Helpers
  function formatINR(val) {
    const num = Number(val);
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  }

  function maskAccount(accNumber) {
    if (!accNumber || typeof accNumber !== 'string') return '';
    const parts = accNumber.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-••••-${parts[parts.length - 1]}`;
    }
    return accNumber.slice(0, 3) + '••••' + accNumber.slice(-3);
  }

  // Toast Notification System
  function showToast(message, type = 'info', durationMs = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div style="flex-shrink: 0; margin-top: 2px;">${iconSvg}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, durationMs);
  }

  return {
    subscribe,
    setUser,
    getUser,
    setAccounts,
    getAccounts,
    setView,
    getView,
    formatINR,
    formatDate,
    maskAccount,
    showToast
  };
})();

