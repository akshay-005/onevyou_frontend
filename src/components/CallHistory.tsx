import { useSocket } from "@/utils/socket";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, IndianRupee, User, PlugZap } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CallHistory() {
  const [calls, setCalls] = useState<any[]>([]);
  const socket = useSocket();
  const [isSocketReady, setIsSocketReady] = useState(false);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("userToken");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/calls/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setCalls(json.calls || []);
    } catch (err) {
      console.error("❌ Call history fetch error:", err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("✅ Socket connected (CallHistory)");
      setIsSocketReady(true);
    };
    const handleDisconnect = () => {
      console.log("⚠️ Socket disconnected (CallHistory)");
      setIsSocketReady(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("refresh-history", fetchHistory);
    socket.on("call:ended", fetchHistory);

    // ✅ Key fix: if already connected, mark ready immediately
    if (socket.connected) {
      console.log("⚡ Socket already connected, setting isSocketReady = true");
      setIsSocketReady(true);
    }

    // Initial load
    fetchHistory();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("refresh-history", fetchHistory);
      socket.off("call:ended", fetchHistory);
    };
  }, [socket]);

  useEffect(() => {
    window.addEventListener("refresh-dashboard", fetchHistory);
    return () => window.removeEventListener("refresh-dashboard", fetchHistory);
  }, []);

  // 🧩 Show connecting only if socket not ready yet
  if (!socket || !isSocketReady) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
        <PlugZap className="h-10 w-10 mb-3 animate-spin text-primary" />
        <p className="font-medium">Connecting to server...</p>
      </Card>
    );
  }

  // 🧩 Show empty message if no calls
  if (!calls.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No previous calls found.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ✅ Show call history
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Recent Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {calls.map((call) => (
          <div
            key={call._id}
            className="border rounded-md p-3 flex justify-between items-center hover:bg-muted/50 transition"
          >
            <div>
              <p className="font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {call.callee?.fullName || "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(call.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm flex items-center justify-end gap-1">
                <IndianRupee className="h-3 w-3" /> {call.price || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {call.durationSec ? Math.round(call.durationSec / 60) : 0} min
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
