// ✅ Unified API utility (local only)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ✅ Get Authorization headers
function getAuthHeaders() {
  const token = localStorage.getItem("userToken"); // unified key
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ✅ Helper to fetch JSON safely
async function fetchJSON(url, options = {}) {
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

// ✅ Online Users
export const getOnlineUsers = async () =>
  fetchJSON(`${API_BASE}/api/users/online`, { headers: getAuthHeaders() });

// ✅ Current User
export const getMe = async () =>
  fetchJSON(`${API_BASE}/api/users/me`, { headers: getAuthHeaders() });



// 🔹 Create Razorpay Order
export const createOrder = async (amount) =>
  fetchJSON(`${API_BASE}/api/payment/create-order`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });

// 🔹 Verify Razorpay Payment
export const verifyPayment = async (data) =>
  fetchJSON(`${API_BASE}/api/payment/verify-payment`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

// ✅ Export everything
const api = { getOnlineUsers, getMe, createOrder, verifyPayment };
export default api;