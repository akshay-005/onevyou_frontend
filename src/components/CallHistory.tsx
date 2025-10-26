import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, IndianRupee } from "lucide-react";
import { getAuthToken, getUserId } from "@/utils/storage";
import { useSocket } from "@/utils/socket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CallHistory() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const fetchHistory = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn("⚠️ No auth token found");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/calls/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      console.log("📜 Call history response:", json);
      setCalls(json.calls || []);
    } catch (err) {
      console.error("Call history fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const handleRefresh = () => fetchHistory();
    if (socket) {
      socket.on("refresh-history", handleRefresh);
      socket.on("call:ended", handleRefresh);
    }

    window.addEventListener("refresh-dashboard", handleRefresh);

    return () => {
      if (socket) {
        socket.off("refresh-history", handleRefresh);
        socket.off("call:ended", handleRefresh);
      }
      window.removeEventListener("refresh-dashboard", handleRefresh);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 animate-spin text-primary" />
        <p className="font-medium">Loading Recent Calls...</p>
      </div>
    );
  }

  if (!calls.length) {
    return (
      <div className="rounded-2xl shadow-lg border border-gray-200 bg-white p-4 text-center text-sm text-muted-foreground">
        No previous calls found.
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-xl border border-gray-200 bg-white overflow-hidden">
      {/* Fixed Header */}
      <CardHeader className="sticky top-0 bg-white/90 backdrop-blur-sm border-b flex items-center gap-2 px-5 py-3">
        <Clock className="h-5 w-5 text-primary" />
        <CardTitle className="text-base font-semibold text-gray-800">
          Recent Calls
        </CardTitle>
      </CardHeader>

      {/* Scrollable List */}
      <CardContent className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {calls.map((call) => {
          const currentUserId = getUserId();
          const isOutgoing = call.caller?._id === currentUserId;
          const otherUser = isOutgoing
            ? call.callee?.fullName
            : call.caller?.fullName;
          const direction = isOutgoing ? "Outgoing" : "Incoming";

          return (
            <div
              key={call._id}
              className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
            >
              {/* Left side */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center font-medium">
                  {otherUser?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    {otherUser || "Unknown"}
                    <span
                      className={`text-xs px-2 py-[2px] rounded-full ${
                        isOutgoing
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {direction}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(call.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Right side */}
              <div className="text-right min-w-[60px]">
                <p className="text-sm text-gray-800 flex items-center justify-end gap-1">
                  <IndianRupee className="h-3 w-3" /> {call.price || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {call.durationSec ? Math.round(call.durationSec / 60) : 0} min
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
