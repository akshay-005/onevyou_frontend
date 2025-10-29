// src/components/SocketManager.tsx
import { useEffect, useState } from "react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";
import { getUserSession } from "@/utils/storage";

export default function SocketManager() {
  const socket = useSocket();
  const { toast } = useToast();
  const [liveCalls, setLiveCalls] = useState<any[]>([]);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

  // ✅ Fetch only currently live calls (on refresh or reconnect)
  const fetchActiveCalls = async () => {
    try {
      const { userId } = getUserSession();
      if (!userId) return;

      const res = await fetch(`${API_BASE}/api/calls/active/${userId}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.calls)) {
        setLiveCalls(data.calls);
        localStorage.setItem("activeCalls", JSON.stringify(data.calls));
        console.log("📡 Synced live calls:", data.calls);
      } else {
        setLiveCalls([]);
        localStorage.removeItem("activeCalls");
      }
    } catch (err) {
      console.error("❌ Failed to fetch active calls:", err);
    }
  };

  // ✅ Handle incoming socket events
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: any) => {
      console.log("📥 Incoming call:", data);
      setLiveCalls((prev) => {
        const exists = prev.find((c) => c.channelName === data.channelName);
        return exists ? prev : [...prev, data];
      });

      toast({
        title: `📞 Incoming call from ${data.callerName}`,
        description: `Duration: ${data.durationMin} min | ₹${data.price}`,
      });
    };

    const handleEnd = (data: any) => {
      console.log("📴 Removing call:", data.channelName);
      setLiveCalls((prev) => prev.filter((c) => c.channelName !== data.channelName));
    };

    // Attach listeners
    socket.on("call:incoming", handleIncoming);
    socket.on("call:timeout", handleEnd);
    socket.on("call:cancelled", handleEnd);
    socket.on("call:ended", handleEnd);

    // On reconnect, verify actual live calls
    socket.on("connect", fetchActiveCalls);
    socket.on("reconnect", fetchActiveCalls);
    socket.on("call:active:update", fetchActiveCalls);


    // Fetch active calls initially
    fetchActiveCalls();

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:timeout", handleEnd);
      socket.off("call:cancelled", handleEnd);
      socket.off("call:ended", handleEnd);
      socket.off("connect", fetchActiveCalls);
      socket.off("reconnect", fetchActiveCalls);
      socket.off("call:active:update", fetchActiveCalls);

    };
  }, [socket]);

  // ✅ On page refresh, restore only truly active calls
  useEffect(() => {
    const saved = localStorage.getItem("activeCalls");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLiveCalls(parsed);
          parsed.forEach((call) => {
            toast({
              title: `📞 Incoming call from ${call.callerName}`,
              description: `Duration: ${call.durationMin} min | ₹${call.price}`,
            });
          });
        }
      } catch (err) {
        console.warn("Failed to parse saved activeCalls:", err);
      }
    }
  }, []);

  return null;
}
