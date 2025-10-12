import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, IndianRupee, User } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CallHistory() {
  const [calls, setCalls] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_BASE}/api/calls/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setCalls(json.calls || []);
    } catch (err) {
      console.error("Call history fetch error:", err);
    }
  };

  useEffect(() => {
    fetchHistory();

    // 🔁 Auto-refresh when "refresh-dashboard" event is fired
    const handleRefresh = () => fetchHistory();
    window.addEventListener("refresh-dashboard", handleRefresh);
    return () => window.removeEventListener("refresh-dashboard", handleRefresh);
  }, []);

  if (!calls.length)
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
