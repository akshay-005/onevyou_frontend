// ✅ Unified API utility
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ✅ Get Authorization headers
function getAuthHeaders() {
  const token = localStorage.getItem("userToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ✅ Helper to fetch JSON safely
async function fetchJSON(url: string, options: RequestInit = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      console.error("❌ HTTP Error:", res.status, text);
      return { success: false, message: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    return { success: false, message: "Network error" };
  }
}

// ===========================
// USER APIs
// ===========================
export const getOnlineUsers = async () =>
  fetchJSON(`${API_BASE}/api/users/all`, { headers: getAuthHeaders() });

export const getMe = async () =>
  fetchJSON(`${API_BASE}/api/users/me`, { headers: getAuthHeaders() });

export const updatePricing = async (pricingTiers: any[]) =>
  fetchJSON(`${API_BASE}/api/users/updatePricing`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ pricingTiers }),
  });

// ===========================
// PAYMENT APIs
// ===========================
export const createOrder = async (amount: number) =>
  fetchJSON(`${API_BASE}/api/payment/create-order`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });

export const verifyPayment = async (data: any) =>
  fetchJSON(`${API_BASE}/api/payment/verify-payment`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

// ===========================
// WALLET APIs
// ===========================
export const getWalletBalance = async () =>
  fetchJSON(`${API_BASE}/api/wallet/balance`, {
    headers: getAuthHeaders(),
  });

export const getWalletTransactions = async () =>
  fetchJSON(`${API_BASE}/api/wallet/transactions`, {
    headers: getAuthHeaders(),
  });

export const updateBankDetails = async (details: any) =>
  fetchJSON(`${API_BASE}/api/wallet/bank-details`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(details),
  });

export const requestWithdrawal = async (amount: number, method: string) =>
  fetchJSON(`${API_BASE}/api/wallet/withdraw`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, method }),
  });


  export const useWalletForCall = async (data: any) =>
  fetchJSON(`${API_BASE}/api/wallet/use-for-call`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });




// PURPOSE: API calls for waiting notifications

/**
 * Request notification when a user comes online
 */
const createWaitingNotification = async (targetUserId: string) => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/wait`, {  // ✅ ADDED /api/
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ targetUserId }),
  });
  return await res.json();
};

/**
 * Cancel waiting notification
 */
const cancelWaitingNotification = async (targetUserId: string) => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/wait/${targetUserId}`, {  // ✅ ADDED /api/
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await res.json();
};

/**
 * Get my waiting notifications
 */
const getMyWaitingNotifications = async () => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/my-waiting`, {  // ✅ ADDED /api/
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await res.json();
};

/**
 * Save web push subscription
 */
const savePushSubscription = async (userId: string, subscription: any) =>
  fetchJSON(`${API_BASE}/api/push/save-subscription`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, subscription }),
  });


  /**
 * Dismiss a waiting notification (delete it)
 */
const dismissWaitingNotification = async (notificationId: string) => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/dismiss/${notificationId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await res.json();
};



// ===========================
// DEFAULT EXPORT
// ===========================
const api = {
  getOnlineUsers,
  getMe,
  createOrder,
  verifyPayment,
  updatePricing,
  getWalletBalance,
  getWalletTransactions,
  updateBankDetails,
  requestWithdrawal,
  useWalletForCall,
  createWaitingNotification,
  cancelWaitingNotification,
  getMyWaitingNotifications,
  savePushSubscription,
  dismissWaitingNotification,
};

export default api;