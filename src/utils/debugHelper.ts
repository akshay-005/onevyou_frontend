// frontend/src/utils/debugHelper.ts
// Add this file and import it in your main App.tsx for easy debugging

import { getUserSession } from "./storage";
import { getSocketInstance } from "./socket";

/**
 * Debug helper to check system status
 * Usage: window.debugSystem() in browser console
 */
export const setupDebugHelpers = () => {
  if (typeof window === "undefined") return;

  // Make debug function globally available
  (window as any).debugSystem = () => {
    console.log("🔍 === System Debug Info ===");
    
    // Check localStorage
    const { token, userId, user } = getUserSession();
    console.log("📦 localStorage:");
    console.log("  - Token:", token ? "✅ Present" : "❌ Missing");
    console.log("  - User ID:", userId || "❌ Missing");
    console.log("  - User Name:", user?.fullName || "❌ Missing");
    console.log("  - Online Status:", localStorage.getItem("isOnline"));

    // Check socket
    const socket = getSocketInstance();
    console.log("\n🔌 Socket Status:");
    console.log("  - Instance:", socket ? "✅ Created" : "❌ Not created");
    console.log("  - Connected:", socket?.connected ? "✅ Yes" : "❌ No");
    console.log("  - Socket ID:", socket?.id || "N/A");
    console.log("  - User ID attached:", (socket as any)?.myUserId || "❌ Missing");

    // Check media permissions
    console.log("\n🎥 Media Permissions:");
    navigator.permissions?.query({ name: "microphone" as any })
      .then(result => console.log("  - Microphone:", result.state))
      .catch(() => console.log("  - Microphone: Unable to check"));
    
    navigator.permissions?.query({ name: "camera" as any })
      .then(result => console.log("  - Camera:", result.state))
      .catch(() => console.log("  - Camera: Unable to check"));

    // Check API connectivity
    console.log("\n🌐 API Status:");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
    console.log("  - API Base URL:", apiBase);
    fetch(`${apiBase}/api/health`)
      .then(res => res.json())
      .then(() => console.log("  - Health Check: ✅ Connected"))
      .catch(() => console.log("  - Health Check: ❌ Failed"));

    console.log("\n=========================");
  };

  // Quick socket reconnect helper
  (window as any).reconnectSocket = () => {
    const socket = getSocketInstance();
    if (socket) {
      console.log("🔄 Reconnecting socket...");
      socket.connect();
    } else {
      console.log("❌ No socket instance found");
    }
  };

  // Quick localStorage clear helper
  (window as any).clearSession = () => {
    console.log("🧹 Clearing session data...");
    localStorage.clear();
    console.log("✅ Session cleared. Please refresh the page.");
  };

  // Check if user is in a call
  (window as any).checkCallStatus = () => {
    const inCall = document.querySelector('[class*="CallRoom"]') !== null;
    console.log("📞 In Call:", inCall ? "✅ Yes" : "❌ No");
    
    if (inCall) {
      console.log("Call Details:");
      console.log("  - Channel:", window.location.pathname.split("/call/")[1]);
      console.log("  - Duration:", document.querySelector('[class*="timer"]')?.textContent);
    }
  };

  console.log("🛠️ Debug helpers loaded!");
  console.log("Available commands:");
  console.log("  - window.debugSystem() - Full system check");
  console.log("  - window.reconnectSocket() - Reconnect socket");
  console.log("  - window.clearSession() - Clear localStorage");
  console.log("  - window.checkCallStatus() - Check call status");
};

/**
 * Auto-detect common issues
 */
export const autoDetectIssues = () => {
  setTimeout(() => {
    const issues: string[] = [];
    
    const { token, userId } = getUserSession();
    const socket = getSocketInstance();

    // Check for common issues
    if (!token) issues.push("No auth token found");
    if (!userId) issues.push("No user ID found");
    if (!socket) issues.push("Socket not initialized");
    if (socket && !socket.connected) issues.push("Socket not connected");
    if (socket && !(socket as any).myUserId) issues.push("Socket missing userId");

    if (issues.length > 0) {
      console.warn("⚠️ Detected issues:");
      issues.forEach(issue => console.warn(`  - ${issue}`));
      console.log("Run window.debugSystem() for more details");
    } else {
      console.log("✅ No issues detected");
    }
  }, 2000);
};

// Call setup on import
setupDebugHelpers();
autoDetectIssues();