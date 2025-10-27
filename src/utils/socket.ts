// frontend/src/utils/socket.tsx - COMPLETE FIXED VERSION
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { getUserSession } from "./storage";

let socketInstance: Socket | null = null;

/**
 * Safe emit with automatic userId injection and retry logic
 */
export const safeEmit = (event: string, data: any = {}) => {
  // Always try to inject userId if not present
  const { userId } = getUserSession();
  
  if (userId && !data.userId) {
    data.userId = userId;
  }

  if (socketInstance && socketInstance.connected) {
    socketInstance.emit(event, data);
    console.log(`✅ Emitted ${event}:`, data);
  } else {
    console.warn(`⚠️ Socket not ready, retrying ${event} in 1s...`);
    setTimeout(() => {
      if (socketInstance && socketInstance.connected) {
        const { userId: retryUserId } = getUserSession();
        if (retryUserId && !data.userId) {
          data.userId = retryUserId;
        }
        
        socketInstance.emit(event, data);
        console.log(`✅ Retry successful for ${event}`);
      } else {
        console.error(`🚫 Socket still not connected, ${event} failed`);
      }
    }, 1000);
  }
};

const SocketContext = createContext<Socket | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: ProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const { token, userId } = getUserSession();

    // No token = no connection
    if (!token) {
      console.warn("⚠️ No token found, skipping socket connection");
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setSocket(null);
      }
      return;
    }

    // Prevent duplicate connections
    if (socketInstance && socketInstance.connected) {
      console.log("⚙️ Socket already connected, reusing instance");
      setSocket(socketInstance);
      return;
    }

    const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/api\/?$/, "");
    console.log("🔌 Connecting to Socket.IO:", baseURL);

    const s = io(baseURL, {
      auth: { token },
      query: { 
        session: Date.now().toString(),
        userId: userId || undefined
      },
      transports: ["websocket", "polling"], // Allow both transports
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      upgrade: true, // Allow transport upgrade
      rememberUpgrade: true
    });

    // Attach userId to socket instance
    if (userId) {
      (s as any).myUserId = userId;
      console.log("🧠 userId attached to socket:", userId);
    }

    socketInstance = s;

    // ===== CONNECTION HANDLERS =====
    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);
      console.log("🔗 Transport:", s.io.engine.transport.name);

      // Ensure userId is available
      const { userId: currentUserId } = getUserSession();
      if (currentUserId) {
        (s as any).myUserId = currentUserId;
      }

      // Restore online status from localStorage
      const savedOnlineState = localStorage.getItem("isOnline");
      const isOnline = savedOnlineState ? JSON.parse(savedOnlineState) : false; // 🧩 default offline


      if (currentUserId) {
        s.emit("user:status:update", { 
          userId: currentUserId, 
          isOnline 
        });
        console.log("🔄 Restored online state:", isOnline);
      } else {
        console.warn("⚠️ No userId available on connect");
      }
    });

    s.on("reconnect", (attemptNumber) => {
      console.log(`♻️ Reconnected after ${attemptNumber} attempts`);
      
      // Dispatch custom event for UI notification
      if (typeof window !== "undefined") {
        const event = new CustomEvent("app-toast", {
          detail: {
            title: "Reconnected",
            description: "Connection restored successfully",
          },
        });
        window.dispatchEvent(event);
      }

      // Re-sync online status after reconnect
      const { userId: currentUserId } = getUserSession();
      const savedOnlineState = localStorage.getItem("isOnline");
      const isOnline = savedOnlineState ? JSON.parse(savedOnlineState) : true;

      if (currentUserId && s.connected) {
        s.emit("user:status:update", { 
          userId: currentUserId, 
          isOnline 
        });
        console.log("🔄 Re-synced status after reconnect");
      }
    });

    s.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnect attempt ${attemptNumber}...`);
    });

    s.on("reconnect_error", (err) => {
      console.warn("⚠️ Reconnect error:", err.message);
    });

    s.on("reconnect_failed", () => {
      console.error("🚫 Reconnection failed after max attempts");
      
      if (typeof window !== "undefined") {
        const event = new CustomEvent("app-toast", {
          detail: {
            title: "Connection Lost",
            description: "Please refresh the page",
            variant: "destructive"
          },
        });
        window.dispatchEvent(event);
      }
    });

    s.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      
      if (reason === "io server disconnect") {
        // Server kicked us, try to reconnect manually
        console.log("🔄 Server disconnected us, attempting manual reconnect...");
        setTimeout(() => s.connect(), 1000);
      } else if (reason === "transport close" || reason === "transport error") {
        console.log("🔄 Transport issue, will auto-reconnect...");
      }
    });

    s.on("connect_error", (err) => {
      console.error("🚫 Connection error:", err.message);
      
      // If token expired, clear session and redirect to login
      if (err.message.includes("Authentication") || err.message.includes("token")) {
        console.error("🔑 Authentication failed, clearing session");
        localStorage.removeItem("userToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userData");
        window.location.href = "/";
      }
    });

    s.on("error", (err) => {
      console.error("🚫 Socket error:", err);
    });

    // Monitor transport upgrades
    s.io.engine.on("upgrade", (transport) => {
      console.log("📡 Transport upgraded to:", transport.name);
    });

    setSocket(s);

    // Listen for userId changes (e.g., after login)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "userId" && e.newValue && socketInstance) {
        (socketInstance as any).myUserId = e.newValue;
        console.log("🧩 userId updated dynamically:", e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Cleanup function
    return () => {
      console.log("🧹 Socket cleanup (preserving connection)");
      window.removeEventListener("storage", handleStorageChange);
      
      // Remove all listeners but keep socket alive
      s.removeAllListeners();
      
      // Store reference globally
      socketInstance = s;
    };
  }, []); // Run only once on mount

  return React.createElement(SocketContext.Provider, { value: socket }, children);
};

/**
 * Hook to use socket anywhere in the app
 */
export const useSocket = (): Socket | null => {
  const socket = useContext(SocketContext);
  if (socket === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return socket;
};

/**
 * Get socket instance directly (for use outside React components)
 */
export const getSocketInstance = (): Socket | null => {
  return socketInstance;
};

/**
 * Force disconnect socket (use on logout)
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    console.log("🔌 Manually disconnecting socket");
    socketInstance.disconnect();
    socketInstance = null;
  }
};

/**
 * Force reconnect socket (use after login)
 */
export const reconnectSocket = () => {
  if (socketInstance && !socketInstance.connected) {
    console.log("🔌 Manually reconnecting socket");
    socketInstance.connect();
  }
};