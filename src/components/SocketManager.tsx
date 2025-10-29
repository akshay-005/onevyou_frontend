// src/components/SocketManager.tsx
import { useEffect } from "react";
import { useSocket, safeEmit } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function SocketManager() {
  const socket = useSocket();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    // Clear old listeners first
    socket.off("call:incoming");
    socket.off("call:timeout");
    socket.off("call:cancelled");

    // ✅ Handle incoming call (main fix)
    socket.on("call:incoming", (data) => {
      console.log("📥 Incoming call:", data);

      const { callId, channelName, callerName, price, durationMin } = data;

      // Store in localStorage for restoration if refresh happens
      localStorage.setItem("incomingCall", JSON.stringify(data));

      toast({
        title: `📞 Incoming call from ${callerName}`,
        description: `Duration: ${durationMin} min | ₹${price}`,
      });
    });

    // (Optional) Handle missed calls
    socket.on("call:timeout", (data) => {
      console.log("⏰ Call timeout:", data);
      localStorage.removeItem("incomingCall");
      toast({
        title: "Missed call",
        description: "The caller did not get a response.",
      });
    });

    // (Optional) Handle cancelled calls
    socket.on("call:cancelled", (data) => {
      console.log("🚫 Call cancelled:", data);
      localStorage.removeItem("incomingCall");
      toast({
        title: "Call Cancelled",
        description: "The caller cancelled the call.",
      });
    });

    // ✅ Cleanup listeners
    return () => {
      socket.off("call:incoming");
      socket.off("call:timeout");
      socket.off("call:cancelled");
    };
  }, [socket]);

  // ✅ Recover if user refreshes during incoming call
  useEffect(() => {
    const saved = localStorage.getItem("incomingCall");
    if (saved) {
      const data = JSON.parse(saved);
      console.log("🔁 Restoring pending incoming call:", data);
      toast({
        title: `📞 Incoming call from ${data.callerName}`,
        description: `Duration: ${data.durationMin} min | ₹${data.price}`,
      });
    }
  }, []);

  return null; // background listener only
}
