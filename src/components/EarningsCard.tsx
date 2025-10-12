import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, PhoneCall } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function EarningsCard() {
  const [data, setData] = useState<any>(null);

  const fetchEarnings = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_BASE}/api/calls/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json.earnings || {});
    } catch (err) {
      console.error("Earnings fetch error:", err);
    }
  };

  useEffect(() => {
    fetchEarnings();

    // 🔁 Listen for dashboard refresh trigger
    const handleRefresh = () => fetchEarnings();
    window.addEventListener("refresh-dashboard", handleRefresh);
    return () => window.removeEventListener("refresh-dashboard", handleRefresh);
  }, []);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-primary" /> Earnings Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
              <TrendingUp className="h-6 w-6 mb-1 text-primary" />
              <p className="font-semibold text-lg">
                ₹{data.totalEarnings?.toFixed(0) || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Earnings</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10 flex flex-col items-center justify-center">
              <PhoneCall className="h-6 w-6 mb-1 text-accent" />
              <p className="font-semibold text-lg">{data.totalCalls || 0}</p>
              <p className="text-xs text-muted-foreground">Total Calls</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
