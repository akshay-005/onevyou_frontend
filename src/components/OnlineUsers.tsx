// src/components/OnlineUsers.tsx
import { useEffect, useState } from "react";
import useSocket from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type UserLite = {
  _id: string;
  fullName: string;
  skills?: string[];
  online?: boolean;
  ratePerMinute?: number;
  callLink?: string;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export default function OnlineUsers() {
  const socketRef = useSocket();
  const [users, setUsers] = useState<UserLite[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // initial fetch
    const fetchOnline = async () => {
      const res = await fetch(`${API_BASE}/users?online=true`);
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    };
    fetchOnline();
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onUserStatus = (payload: { userId: string; online: boolean }) => {
      setUsers((prev) => {
        if (payload.online) {
          // optimistic: fetch user details (or add placeholder)
          fetch(`${API_BASE}/users?online=true`).then((r) => r.json()).then((d) => {
            if (d.success) setUsers(d.users || []);
          });
        } else {
          return prev.filter((u) => u._id !== payload.userId);
        }
        return prev;
      });
    };

    {/*const onIncomingCall = (payload: any) => {
      // If this client receives incoming_call (meaning they are the callee)
      toast({ title: "Incoming call", description: `${payload.from?.name} is calling...` });
      // you could also store in state to show an incoming call modal
    }; */}

    socket.on("user:status", onUserStatus);
    
    //socket.on("incoming_call", onIncomingCall);

    return () => {
      socket.off("user:status", onUserStatus);
      //socket.off("incoming_call", onIncomingCall);
    };
  }, [socketRef, toast]);

  const startCall = async (targetId: string) => {
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_BASE}/calls/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (data.success) {
        // redirect to call page (or open modal)
        window.location.href = `/call/${data.sessionId}`;
      } else {
        toast({ title: "Call failed", description: data.message || "Try again", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Call error", description: "Server not reachable", variant: "destructive" });
    }
  };

  return (
    <div>
      <h3 className="font-medium mb-2">Online Now</h3>
      <div className="space-y-2">
        {users.length === 0 && <p className="text-sm text-muted-foreground">No one online right now</p>}
        {users.map((u) => (
          <div key={u._id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <div className="font-medium">{u.fullName}</div>
              <div className="text-xs text-muted-foreground">{u.skills?.join(", ")}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm">₹{u.ratePerMinute}/min</div>
              <Button size="sm" onClick={() => startCall(u._id)}>Call</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
