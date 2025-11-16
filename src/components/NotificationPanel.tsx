// frontend/src/components/NotificationPanel.tsx
// Enhanced version with Incoming and Missed tabs

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Phone, Check, X, Clock, IndianRupee, PlugZap, UserPlus, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocket } from "@/utils/socket";
import api from "@/utils/api";

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
  channelName?: string;
  fromUserId?: string;
  durationMin?: number;
}

interface NotificationPanelProps {
  requests?: ConnectionRequest[];
}

const NotificationPanel = ({ requests: externalRequests }: NotificationPanelProps) => {
  const { toast } = useToast();
  const [localRequests, setLocalRequests] = useState<ConnectionRequest[]>([]);
  const [waitingNotifications, setWaitingNotifications] = useState<any[]>([]);
  const socket = useSocket();
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [activeTab, setActiveTab] = useState("incoming");

  const handleDismissNotification = async (notification: any) => {
  try {
    // Just remove from local state (don't notify the waiting user)
    setWaitingNotifications(prev => 
      prev.filter(n => n._id !== notification._id)
    );
    
    // Optionally: Mark as expired in backend
    await api.cancelWaitingNotification(notification.waitingUserId._id);
    
    toast({
      title: "Notification Dismissed",
      description: "User will not be notified",
    });
  } catch (err) {
    console.error("Error dismissing notification:", err);
  }
};
  
  const requests = externalRequests || localRequests;
  
  console.log("📋 NotificationPanel requests:", requests.length);

  // ✅ Load waiting notifications (people who want to connect with me)
  useEffect(() => {
    const loadWaitingNotifications = async () => {
      try {
        const res = await api.getMyWaitingNotifications();
        if (res.success && res.notifications) {
          setWaitingNotifications(res.notifications);
          console.log("📬 Loaded waiting notifications:", res.notifications.length);
        }
      } catch (err) {
        console.error("Error loading notifications:", err);
      }
    };

    loadWaitingNotifications();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadWaitingNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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
      
      const newRequest = {
        id: data.callId,
        studentName: data.callerName || "Unknown",
        duration: `${data.durationMin || 1} min`,
        price: data.price || 0,
        time: "Just now",
        subject: "Incoming Call",
        channelName: data.channelName,
        fromUserId: data.fromUserId,
        durationMin: data.durationMin || 1,
      };
      
      setLocalRequests((prev) => [newRequest, ...prev]);
      
      // Switch to incoming tab when new call arrives
      setActiveTab("incoming");
      
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
      stopAllRingtones();
      setLocalRequests((prev) => 
        prev.filter((r) => r.id !== callId && r.channelName !== channelName)
      );

      toast({
        title: "Call Cancelled 🚫",
        description: "The caller cancelled the call.",
        variant: "destructive",
      });
    });

    socket.on("call:timeout", ({ callId, channelName }) => {
      console.log("⏰ Call timeout received:", { callId, channelName });
      stopAllRingtones();
      setLocalRequests((prev) => 
        prev.filter((r) => r.id !== callId && r.channelName !== channelName)
      );

      toast({
        title: "Call Timeout ⏰",
        description: "The caller didn't wait long enough.",
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
    stopAllRingtones();

    const callData = requests.find(r => r.id === request.id);
    if (!callData) return;

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

    setLocalRequests((r) => r.filter((req) => req.id !== request.id));

    window.dispatchEvent(new CustomEvent('call-request-handled', {
      detail: { requestId: request.id }
    }));

    const duration = parseInt(request.duration) || 1;
    setTimeout(() => {
      window.location.href = `/call/${callData.channelName}?role=callee&callId=${request.id}&fromUserId=${callData.fromUserId}&duration=${duration}`;
    }, 500);
  };

  const handleDecline = (requestId: string) => {
    if (!socket) return;

    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    stopAllRingtones();

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

  const handleNotifyWaiting = async (notification: any) => {
    try {
      // Send notification that I'm now available
      if (socket && socket.connected) {
        socket.emit("user:now-available", {
          targetUserId: notification.waitingUserId._id,
        });
        
        toast({
          title: "Notification Sent!",
          description: `${notification.waitingUserId.fullName} has been notified you're online`,
        });

        // Remove from list
        setWaitingNotifications(prev => 
          prev.filter(n => n._id !== notification._id)
        );
      }
    } catch (err) {
      console.error("Error notifying user:", err);
    }
  };

  const isConnecting = !socket || !isSocketReady;

  return (
    <Card className="p-4 h-[500px] bg-gradient-to-br from-background to-primary/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary animate-pulse" />
          Notifications
          {(requests.length > 0 || waitingNotifications.length > 0) && (
            <Badge variant="destructive" className="ml-2 animate-pulse">
              {requests.length + waitingNotifications.length} New
            </Badge>
          )}
        </h3>
        {isConnecting && (
          <Badge variant="outline" className="animate-pulse">
            <PlugZap className="h-3 w-3 mr-1" />
            Connecting...
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[420px]">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="incoming" className="relative">
            <Phone className="h-4 w-4 mr-2" />
            Incoming
            {requests.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-white">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="relative">
            <History className="h-4 w-4 mr-2" />
            Missed
            {waitingNotifications.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-blue-500">
                {waitingNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Incoming Calls */}
        <TabsContent value="incoming" className="h-[360px]">
          <ScrollArea className="h-full">
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
        </TabsContent>

        {/* Tab 2: Missed Attempts / Waiting Notifications */}
        <TabsContent value="waiting" className="h-[360px]">
          <ScrollArea className="h-full">
            {waitingNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No missed attempts</p>
                <p className="text-xs mt-2">Users waiting for you will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingNotifications.map((notification) => (
                  <Card
                  
                    key={notification._id}
                    className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800"
            
                  >
                    <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive/10"
              onClick={() => handleDismissNotification(notification)}
            >
              <X className="h-4 w-4" />
            </Button>
            
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {notification.waitingUserId?.profileImage ? (
                            <AvatarImage src={notification.waitingUserId.profileImage} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                              {notification.waitingUserId?.fullName?.[0] || "U"}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-semibold">
                            {notification.waitingUserId?.fullName || "Unknown User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Wants to connect with you
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
                        Waiting
                      </Badge>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90"
                      onClick={() => handleNotifyWaiting(notification)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Notify I'm Available
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default NotificationPanel;