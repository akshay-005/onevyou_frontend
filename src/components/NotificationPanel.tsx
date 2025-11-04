// src/components/NotificationPanel.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Phone, Check, X, Clock, IndianRupee, PlugZap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSocket } from "@/utils/socket";


// ✅ Helper: Stop all ringtones safely
function stopAllRingtones() {
  const audios = document.querySelectorAll("audio");
  audios.forEach((a) => {
    try {
      a.pause();
      a.currentTime = 0;
      a.src = "";
    } catch (err) {
      console.warn("⚠️ Error stopping ringtone:", err);
    }
  });
}


interface ConnectionRequest {
  id: string;
  studentName: string;
  duration: string;
  price: number;
  time: string;
  subject: string;
  channelName?: string;        // ✅ ADD THIS
  fromUserId?: string;         // ✅ ADD THIS
  durationMin?: number;        // ✅ ADD THIS
}

interface NotificationPanelProps {
  requests?: ConnectionRequest[];
}

const NotificationPanel = ({ requests: externalRequests }: NotificationPanelProps) => {
  const { toast } = useToast();
  const [localRequests, setLocalRequests] = useState<ConnectionRequest[]>([]);
  const socket = useSocket();
  const [isSocketReady, setIsSocketReady] = useState(false);
  
  // ✅ Use external requests if provided, otherwise use local state
  const requests = externalRequests || localRequests;
  
  console.log("📋 NotificationPanel requests:", requests.length);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("✅ Socket connected inside NotificationPanel:", socket.id);
      setIsSocketReady(true);
    };
    

    const handleDisconnect = () => {
      console.log("⚠️ Socket disconnected");
      setIsSocketReady(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

   socket.on("call:incoming", (data) => {
  console.log("📞 NotificationPanel received incoming call:", data);
  console.log("Current requests before adding:", requests);
  
  const newRequest = {
    id: data.callId,
    studentName: data.callerName || "Unknown",
    duration: `${data.durationMin || 1} min`,
    price: data.price || 0,
    time: "Just now",
    subject: "Incoming Call",
    channelName: data.channelName,           // ✅ STORE THIS
    fromUserId: data.fromUserId,             // ✅ STORE THIS
    durationMin: data.durationMin || 1,      // ✅ STORE THIS
  };
  
  setLocalRequests((prev) => [newRequest, ...prev]);
  
  // Play incoming sound
  const audio = new Audio("/sounds/incoming.mp3");
  audio.loop = true;
  audio.play().catch(() => {});
  
  toast({
    title: "New Call Request! 📞",
    description: `${newRequest.studentName} wants to connect.`,
  });
});

   socket.on("call:cancelled", ({ callId, channelName }) => {
  console.log("📵 Call cancelled received:", { callId, channelName });
    stopAllRingtones(); // ✅ stop sound
  setLocalRequests((prev) => 
    prev.filter((r) => r.id !== callId && r.channelName !== channelName)
  );

  // Stop ringtone
  document.querySelectorAll("audio").forEach(a => {
    a.pause();
    a.src = "";
  });

  toast({
    title: "Call Cancelled 🚫",
    description: "The caller cancelled the call.",
    variant: "destructive",
  });
});


    socket.on("call:timeout", ({ callId, channelName }) => {
  console.log("⏰ Call timeout received:", { callId, channelName });

   stopAllRingtones(); // ✅ stop sound
  setLocalRequests((prev) => 
    prev.filter((r) => r.id !== callId && r.channelName !== channelName)
  );

  document.querySelectorAll("audio").forEach(a => {
    a.pause();
    a.src = "";
  });

  toast({
    title: "Call Timeout ⏰",
    description: "The caller didn’t wait long enough.",
    variant: "destructive",
  });
});


    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("call:incoming");
      socket.off("call:cancelled");
      socket.off("call:timeout");
    };
  }, [socket, toast]);

 const handleAccept = (request: ConnectionRequest) => {
  if (!socket) return;

 stopAllRingtones(); // ✅ stop all ringing


  // Get stored call data from request
  const callData = requests.find(r => r.id === request.id);
  if (!callData) return;

  // Notify backend
  socket.emit("call:response", {
    toUserId: callData.fromUserId,
    accepted: true,
    channelName: callData.channelName,
    callId: request.id,
  });
  

  toast({
    title: "Call Request Accepted! 📞",
    description: `Starting video call with ${request.studentName}...`,
  });

  // Remove from notifications
  setLocalRequests((r) => r.filter((req) => req.id !== request.id));

  // ✅ Dispatch with requestId
  window.dispatchEvent(new CustomEvent('call-request-handled', {
    detail: { requestId: request.id }
  }));

  // Navigate to call room

  // Navigate to call room
  const duration = parseInt(request.duration) || 1;
  setTimeout(() => {
    window.location.href = `/call/${callData.channelName}?role=callee&callId=${request.id}&fromUserId=${callData.fromUserId}&duration=${duration}`;
  }, 500);
};

  const handleDecline = (requestId: string) => {
  if (!socket) return;

  const request = requests.find(r => r.id === requestId);
  if (!request) return;

  stopAllRingtones(); // ✅ stop all ringing


  // Notify backend
  socket.emit("call:response", {
    toUserId: request.fromUserId,
    accepted: false,
    channelName: request.channelName,
    callId: requestId,
  });

  toast({
    title: "Request Declined",
    description: "The caller will be notified",
    variant: "destructive",
  });

   window.dispatchEvent(new CustomEvent('call-request-handled', {
    detail: { requestId: requestId }
  }));

  setLocalRequests((r) => r.filter((req) => req.id !== requestId));
};
  // Show connecting state inline instead of blocking entire panel
  const isConnecting = !socket || !isSocketReady;

   useEffect(() => {
    console.log("🔍 NotificationPanel - Requests:", requests.length);
    console.log("Socket ready:", isSocketReady);
  }, [requests, isSocketReady]);

 return (
    <Card className="p-4 h-[500px] bg-gradient-to-br from-background to-primary/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary animate-pulse" />
          Connection Requests
          {requests.length > 0 && (
            <Badge variant="destructive" className="ml-2 animate-pulse">
              {requests.length} New
            </Badge>
          )}
        </h3>
        {/* ✅ Show connection status as badge instead of blocking */}
        {isConnecting && (
          <Badge variant="outline" className="animate-pulse">
            <PlugZap className="h-3 w-3 mr-1" />
            Connecting...
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[420px]">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No pending requests</p>
            <p className="text-xs mt-2">Go online to receive requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 hover:scale-[1.02] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-white">
                        {request.studentName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{request.studentName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {request.time}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-primary to-accent text-white">
                    <IndianRupee className="h-3 w-3" />
                    {request.price}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs">
                    <Phone className="h-3 w-3 mr-1" />
                    {request.duration}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {request.subject}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90"
                    onClick={() => handleAccept(request)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDecline(request.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

export default NotificationPanel;