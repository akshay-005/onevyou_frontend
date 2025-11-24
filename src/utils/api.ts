// frontend/src/utils/api.ts - OPTIMIZED VERSION

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ✅ Enhanced cache with better invalidation
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number;
}

const cache = new Map<string, CacheEntry>();

// ✅ REDUCED cache durations for faster updates
const CACHE_DURATION = {
  users: 15000,      // 15 seconds (reduced from 30s)
  profile: 60000,    // 1 minute (reduced from 5m)
  pricing: 30000,    // 30 seconds
  wallet: 10000,     // 10 seconds
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
    console.log("🗑️ All cache cleared");
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
  console.log(`🗑️ Cache cleared: ${pattern}`);
}

// ✅ Get Authorization headers (Cache-Control removed - not needed in requests)
function getAuthHeaders() {
  const token = localStorage.getItem("userToken");
  const headers: Record<string, string> = { 
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ✅ Helper to fetch JSON safely with caching AND retries
async function fetchJSON(
  url: string, 
  options: RequestInit = {}, 
  cacheKey?: string, 
  cacheDuration?: number,
  retries = 2
): Promise<any> {
  // Check cache first
  if (cacheKey && cacheDuration) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        // ✅ Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`❌ HTTP Error (attempt ${attempt + 1}):`, res.status, text);
        
        if (attempt < retries && res.status >= 500) {
          console.log(`🔄 Retrying in ${(attempt + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
          continue;
        }
        
        return { success: false, message: `HTTP ${res.status}` };
      }

      const data = await res.json();

      // Cache successful responses
      if (cacheKey && cacheDuration && data.success) {
        setCache(cacheKey, data, cacheDuration);
      }

      return data;
    } catch (err: any) {
      lastError = err;
      console.error(`❌ Fetch Error (attempt ${attempt + 1}):`, err.message);

      if (attempt < retries) {
        console.log(`🔄 Retrying in ${(attempt + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      }
    }
  }

  return { 
    success: false, 
    message: lastError?.message || "Network error",
    error: lastError 
  };
}

// ===========================
// USER APIs - OPTIMIZED
// ===========================

// ✅ IMPROVED: Pagination support with background prefetching
export const getOnlineUsers = async (page = 1, limit = 20) => {
  const cacheKey = `users:page:${page}`;
  
  const result = await fetchJSON(
    `${API_BASE}/api/users/all?page=${page}&limit=${limit}`,
    { headers: getAuthHeaders() },
    cacheKey,
    CACHE_DURATION.users
  );

  // ✅ Background prefetch next page if available
  if (result?.hasMore && page === 1) {
    setTimeout(() => {
      console.log("🔮 Prefetching page 2...");
      getOnlineUsers(2, limit).catch(() => {});
    }, 100);
  }

  return result;
};

// ✅ IMPROVED: Faster profile loading
export const getMe = async () => {
  const result = await fetchJSON(
    `${API_BASE}/api/users/me`,
    { headers: getAuthHeaders() },
    "profile:me",
    CACHE_DURATION.profile
  );

  return result;
};

export const updatePricing = async (pricingTiers: any[]) => {
  const result = await fetchJSON(`${API_BASE}/api/users/updatePricing`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ pricingTiers }),
  });

  if (result.success) {
    clearCache("pricing");
    clearCache("users");
    clearCache("profile");
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

// ✅ NEW: Warmup cache on app load
export const warmupCache = async () => {
  console.log("🔥 Warming up cache...");
  try {
    await Promise.all([
      getOnlineUsers(1, 20),
      getMe(),
    ]);
    console.log("✅ Cache warmed up");
  } catch (err) {
    console.error("❌ Cache warmup failed:", err);
  }
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
  warmupCache,
};

export default api;