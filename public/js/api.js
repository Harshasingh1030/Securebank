/**
 * SECUREBANK CENTRALIZED API SERVICE LAYER
 * Communicates with backend endpoints while maintaining session tokens and idempotency keys.
 */

const API = (() => {
  const BASE_URL = '/api';

  // Secure Token Management (sessionStorage ensures tokens clear on tab close)
  const TOKEN_KEY = 'securebank_auth_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  // Generate cryptographically unique idempotency key
  function generateIdempotencyKey() {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `IDEM-${Date.now()}-${randomHex}`;
  }

  // Generic request dispatcher
  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method: options.method || 'GET',
      headers
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // If unauthenticated or token expired, trigger session cleanup
        if (response.status === 401 && path !== '/auth/login') {
          clearToken();
          window.dispatchEvent(new CustomEvent('securebank:unauthorized'));
        }
        const errorMsg = data && data.error ? data.error : `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${options.method || 'GET'} ${path}]:`, err.message);
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    clearToken,
    generateIdempotencyKey,

    // Authentication Endpoints
    auth: {
      async register({ fullName, email, password, transactionPassword }) {
        const res = await request('/auth/register', {
          method: 'POST',
          body: { fullName, email, password, transactionPassword }
        });
        if (res.token) setToken(res.token);
        return res;
      },

      async login({ email, password }) {
        const res = await request('/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        if (res.token) setToken(res.token);
        return res;
      },

      async me() {
        return await request('/auth/me');
      },

      async logout() {
        try {
          await request('/auth/logout', { method: 'POST' });
        } finally {
          clearToken();
        }
      },

      async get2FAHistory() {
        return await request('/auth/2fa-history');
      },

      async updateTxnPin({ currentPassword, newTxnPassword }) {
        return await request('/auth/update-txn-pin', {
          method: 'POST',
          body: { currentPassword, newTxnPassword }
        });
      }
    },

    // Accounts Endpoints
    accounts: {
      async list() {
        return await request('/accounts');
      },

      async getBalance(accountId) {
        return await request(`/accounts/${accountId}/balance`);
      },

      async lookup(accountNumber) {
        return await request(`/accounts/lookup?accountNumber=${encodeURIComponent(accountNumber)}`);
      },

      async getStatement(accountId, startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return await request(`/accounts/${accountId}/statement?${params.toString()}`);
      }
    },

    // Transfers Endpoints (Preserving /api/transfer)
    transfers: {
      async execute({ senderAccountId, receiverAccountId, amount, description, transactionPassword, idempotencyKey, userId }) {
        const headers = {};
        if (idempotencyKey) {
          headers['Idempotency-Key'] = idempotencyKey;
        }

        return await request('/transfer', {
          method: 'POST',
          headers,
          body: {
            userId,
            senderAccountId,
            receiverAccountId,
            amount: parseFloat(amount),
            description: description || undefined,
            transactionPassword: transactionPassword || undefined
          }
        });
      }
    },

    // Transactions Endpoints
    transactions: {
      async list(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            params.append(k, v);
          }
        });
        const queryStr = params.toString() ? `?${params.toString()}` : '';
        return await request(`/transactions${queryStr}`);
      },

      async get(transactionId) {
        return await request(`/transactions/${transactionId}`);
      }
    },

    // Customer Alerts
    alerts: {
      async list() {
        return await request('/alerts');
      }
    },

    // Administrator Endpoints
    admin: {
      async overview() {
        return await request('/admin/overview');
      },

      async alerts() {
        return await request('/admin/alerts');
      },

      async updateAlert(alertId, reviewStatus, reviewNotes) {
        return await request(`/admin/alerts/${alertId}`, {
          method: 'PATCH',
          body: {
            review_status: reviewStatus,
            review_notes: reviewNotes
          }
        });
      },

      async auditLogs() {
        return await request('/admin/audit-logs');
      },

      async transactions() {
        return await request('/admin/transactions');
      },

      async scanFraud(threshold = 50000.00) {
        return await request('/fraud/scan', {
          method: 'POST',
          body: { threshold }
        });
      }
    }
  };
})();

