import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Phone, Check, X, Clock, IndianRupee, } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSocket } from "@/utils/socket";

interface ConnectionRequest {
  id: string;
  studentName: string;
  duration: string;
  price: number;
  time: string;
  subject: string;
}



const NotificationPanel = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ConnectionRequest[]>([ ]);

  useEffect(() => {
  const socket = useSocket();
  if (!socket) return;

  socket.on("call:incoming", (data) => {
    const newRequest = {
      id: data.callId,
      studentName: data.callerName || "Unknown",
      duration: `${data.durationMin || 1} min`,
      price: data.price || 0,
      time: "Just now",
      subject: "Incoming Call",
    };
    setRequests((prev) => [newRequest, ...prev]);
    toast({
      title: "New Call Request! 📞",
      description: `${newRequest.studentName} wants to connect.`,
    });
  });

  socket.on("call:cancelled", ({ callId }) => {
    setRequests((prev) => prev.filter((r) => r.id !== callId));
  });

  socket.on("call:timeout", ({ callId }) => {
    setRequests((prev) => prev.filter((r) => r.id !== callId));
  });

  return () => {
    socket.off("call:incoming");
    socket.off("call:cancelled");
    socket.off("call:timeout");
  };
}, []);

  const handleAccept = (request: ConnectionRequest) => {
    toast({
      title: "Call Request Accepted! 📞",
      description: `Starting video call with ${request.studentName}...`,
    });
    // Simulate video call initiation
    setTimeout(() => {
      window.open("https://meet.google.com", "_blank");
    }, 1000);
    setRequests(requests.filter(r => r.id !== request.id));
  };

  const handleDecline = (requestId: string) => {
    toast({
      title: "Request Declined",
      description: "The student will be notified",
    });
    setRequests(requests.filter(r => r.id !== requestId));
  };

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
                        {request.studentName.split(' ').map(n => n[0]).join('')}
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