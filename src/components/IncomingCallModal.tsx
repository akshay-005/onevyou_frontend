import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneIncoming, PhoneOff } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface IncomingCallModalProps {
  open: boolean;
  data: {
    callId: string;
    channelName: string;
    fromUserId?: string;
    callerId?: string;
    callerName?: string;
    durationMin?: number; // ✅ Added
    price?: number;
  } | null;
  onClose: () => void;
}

const IncomingCallModal = ({ open, data, onClose }: IncomingCallModalProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();
  const acceptedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open && !audioRef.current) {
      const audio = new Audio("/ringtone.mp3");
      audio.loop = true;
      audio.volume = 0.6;
      audio.play().catch((err) => console.warn("Audio autoplay blocked:", err));
      audioRef.current = audio;
    }

    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [open]);

  if (!data) return null;

  const handleAccept = () => {
    if (acceptedRef.current || !socket) return;
    acceptedRef.current = true;

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    console.log("📞 Accepting call:", data);

    // Notify backend
    socket.emit("call:response", {
      toUserId: data.fromUserId || data.callerId,
      accepted: true,
      channelName: data.channelName,
      callId: data.callId,
    });

    toast({
      title: "✅ Call Accepted",
      description: "Connecting...",
    });

    onClose();

    // ✅ CRITICAL FIX: Include duration parameter
    const duration = data.durationMin || 1;
    const url = `/call/${data.channelName}?duration=${duration}`;
    
    console.log(`➡️ Navigating to ${url}`);
    
    setTimeout(() => {
      navigate(url, {
        state: {
          callId: data.callId,
          channelName: data.channelName,
          fromUserId: data.fromUserId || data.callerId,
          durationMin: duration,
        },
      });
    }, 300);
  };

  const handleReject = () => {
    if (!socket) return;
    console.log("🚫 Rejecting call:", data);

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Notify backend
    socket.emit("call:response", {
      toUserId: data.fromUserId || data.callerId,
      accepted: false,
      channelName: data.channelName,
      callId: data.callId,
    });

    toast({
      title: "Call Declined",
      description: "You rejected the call.",
      variant: "destructive",
    });

    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-card to-background shadow-lg border border-border/30">
        <DialogHeader className="text-center">
          <DialogTitle className="text-lg font-semibold text-primary mb-2">
            📞 Incoming Call
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            {data.callerName || "Someone"} is calling you...
          </p>
          {data.durationMin && (
            <p className="text-xs text-muted-foreground mt-1">
              Duration: {data.durationMin} minute{data.durationMin > 1 ? 's' : ''}
            </p>
          )}
        </DialogHeader>

        <div className="flex justify-center gap-6 mt-6">
          <Button
            variant="destructive"
            className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition"
            onClick={handleReject}
          >
            <PhoneOff className="w-5 h-5" />
          </Button>

          <Button
            variant="default"
            className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700 shadow-lg hover:scale-105 transition"
            onClick={handleAccept}
          >
            <PhoneIncoming className="w-5 h-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallModal;