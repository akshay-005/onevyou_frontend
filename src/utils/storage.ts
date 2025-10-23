// frontend/src/utils/storage.ts - Enhanced with helpers

/**
 * Store user session data after successful login
 */
export const storeUserSession = (user: any, token: string) => {
  if (!user || !token) {
    console.warn("⚠️ Invalid session data provided");
    return;
  }

  try {
    localStorage.setItem("userToken", token);
    localStorage.setItem("userData", JSON.stringify(user));
    localStorage.setItem("userId", user._id);
    
    // Set initial online state
    localStorage.setItem("isOnline", "true");
    
    console.log("✅ User session stored:", user._id);
  } catch (err) {
    console.error("❌ Failed to store session:", err);
  }
};

/**
 * Get current user session
 */
export const getUserSession = () => {
  try {
    const token = localStorage.getItem("userToken");
    const userRaw = localStorage.getItem("userData");
    const userId = localStorage.getItem("userId");
    const user = userRaw ? JSON.parse(userRaw) : null;
    
    return { token, user, userId };
  } catch (err) {
    console.error("❌ Failed to get session:", err);
    return { token: null, user: null, userId: null };
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const { token, userId } = getUserSession();
  return !!(token && userId);
};

/**
 * Clear user session (use on logout)
 */
export const clearUserSession = () => {
  try {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userData");
    localStorage.removeItem("userId");
    localStorage.removeItem("isOnline");
    
    console.log("✅ User session cleared");
  } catch (err) {
    console.error("❌ Failed to clear session:", err);
  }
};

/**
 * Update user data in localStorage
 */
export const updateUserData = (updates: Partial<any>) => {
  try {
    const { user } = getUserSession();
    if (!user) {
      console.warn("⚠️ No user data to update");
      return;
    }
    
    const updatedUser = { ...user, ...updates };
    localStorage.setItem("userData", JSON.stringify(updatedUser));
    
    console.log("✅ User data updated");
  } catch (err) {
    console.error("❌ Failed to update user data:", err);
  }
};

/**
 * Get/Set online status
 */
export const getOnlineStatus = (): boolean => {
  try {
    const status = localStorage.getItem("isOnline");
    return status === "true";
  } catch {
    return false;
  }
};

export const setOnlineStatus = (isOnline: boolean) => {
  try {
    localStorage.setItem("isOnline", JSON.stringify(isOnline));
  } catch (err) {
    console.error("❌ Failed to set online status:", err);
  }
};

/**
 * Get user ID quickly
 */
export const getUserId = (): string | null => {
  return localStorage.getItem("userId");
};

/**
 * Get auth token quickly
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem("userToken");
};