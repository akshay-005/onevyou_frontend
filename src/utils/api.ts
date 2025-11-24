// frontend/src/utils/api.ts - OPTIMIZED VERSION WITH CACHING

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ✅ Cache management
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_DURATION = {
  users: 30000, // 30 seconds - users list changes frequently when people go online/offline
  profile: 300000, // 5 minutes - profile data rarely changes
  pricing: 60000, // 1 minute - pricing updates should be quick
  wallet: 10000, // 10 seconds - wallet balance needs to be fresh
};

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.expiresIn) {
    cache.delete(key);
    return null;
  }
  
  console.log(`✅ Cache hit: ${key}`);
  return entry.data;
}

function setCache(key: string, data: any, expiresIn: number) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expiresIn,
  });
}

function clearCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ✅ Get Authorization headers
function getAuthHeaders() {
  const token = localStorage.getItem("userToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ✅ Helper to fetch JSON safely with caching
async function fetchJSON(url: string, options: RequestInit = {}, cacheKey?: string, cacheDuration?: number) {
  // Check cache first
  if (cacheKey && cacheDuration) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      console.error("❌ HTTP Error:", res.status, text);
      return { success: false, message: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    
    // Cache successful responses
    if (cacheKey && cacheDuration && data.success) {
      setCache(cacheKey, data, cacheDuration);
    }
    
    return data;
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    return { success: false, message: "Network error" };
  }
}

// ===========================
// USER APIs
// ===========================
export const getOnlineUsers = async () =>
  fetchJSON(
    `${API_BASE}/api/users/all`, 
    { headers: getAuthHeaders() },
    "users:all",
    CACHE_DURATION.users
  );

export const getMe = async () =>
  fetchJSON(
    `${API_BASE}/api/users/me`, 
    { headers: getAuthHeaders() },
    "profile:me",
    CACHE_DURATION.profile
  );

export const updatePricing = async (pricingTiers: any[]) => {
  const result = await fetchJSON(`${API_BASE}/api/users/updatePricing`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ pricingTiers }),
  });
  
  // Clear cache after update
  if (result.success) {
    clearCache("pricing");
    clearCache("users");
  }
  
  return result;
};

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
  fetchJSON(
    `${API_BASE}/api/wallet/balance`,
    { headers: getAuthHeaders() },
    "wallet:balance",
    CACHE_DURATION.wallet
  );

export const getWalletTransactions = async () =>
  fetchJSON(
    `${API_BASE}/api/wallet/transactions`,
    { headers: getAuthHeaders() },
    "wallet:transactions",
    CACHE_DURATION.wallet
  );

export const updateBankDetails = async (details: any) => {
  const result = await fetchJSON(`${API_BASE}/api/wallet/bank-details`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(details),
  });
  
  if (result.success) {
    clearCache("wallet");
  }
  
  return result;
};

export const requestWithdrawal = async (amount: number, method: string) => {
  const result = await fetchJSON(`${API_BASE}/api/wallet/withdraw`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount, method }),
  });
  
  if (result.success) {
    clearCache("wallet");
  }
  
  return result;
};

export const useWalletForCall = async (data: any) => {
  const result = await fetchJSON(`${API_BASE}/api/wallet/use-for-call`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  
  if (result.success) {
    clearCache("wallet");
  }
  
  return result;
};

// ===========================
// NOTIFICATION APIs
// ===========================
const createWaitingNotification = async (targetUserId: string) => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/wait`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ targetUserId }),
  });
  return await res.json();
};

const cancelWaitingNotification = async (targetUserId: string) => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/wait/${targetUserId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await res.json();
};

const getMyWaitingNotifications = async () => {
  const token = localStorage.getItem("userToken");
  const res = await fetch(`${API_BASE}/api/notifications/my-waiting`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await res.json();
};

const savePushSubscription = async (userId: string, subscription: any) =>
  fetchJSON(`${API_BASE}/api/push/save-subscription`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, subscription }),
  });

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
// CACHE CONTROL
// ===========================
export const invalidateCache = (pattern?: string) => {
  clearCache(pattern);
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
  invalidateCache,
};

export default api;