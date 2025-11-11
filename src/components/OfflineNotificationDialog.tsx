// frontend/src/components/OfflineNotificationDialog.tsx
// Show dialog when user clicks on offline teacher

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bell, BellOff, Clock, Sparkles } from "lucide-react";
import api from "@/utils/api";
import { useToast } from "@/hooks/use-toast";

interface OfflineNotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: {
    id: string;
    _id?: string;
    name: string;
    fullName?: string;
    profileImage?: string;
    expertise?: string;
  };
}

const OfflineNotificationDialog: React.FC<OfflineNotificationDialogProps> = ({
  isOpen,
  onClose,
  teacher,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notificationSet, setNotificationSet] = useState(false);

  const teacherId = teacher._id || teacher.id;
  const teacherName = teacher.fullName || teacher.name;
  const initials = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleNotifyMe = async () => {
    setLoading(true);
    try {
      const res = await api.createWaitingNotification(teacherId);
      
      if (res.success) {
        setNotificationSet(true);
        toast({
          title: "🔔 Notification Set!",
          description: `We'll notify you when ${teacherName} comes online`,
        });
        
        // Close after 2 seconds
       {/* setTimeout(() => {
          onClose();
          setNotificationSet(false);
        }, 2000);  */} 


      } else if (res.alreadyOnline) {
        toast({
          title: "User is Online!",
          description: "They just came online. Try connecting now.",
        });
        onClose();
      } else {
        throw new Error(res.message || "Failed to set notification");
      }
    } catch (err: any) {
      console.error("Notification error:", err);
      toast({
        title: "Error",
        description: err.message || "Could not set notification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {!notificationSet ? (
          <>
            {/* Header */}
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-muted-foreground" />
                User is Offline
              </DialogTitle>
              <DialogDescription>
                {teacherName} is not available right now
              </DialogDescription>
            </DialogHeader>

            {/* Content */}
            <div className="space-y-6 py-4">
              {/* Teacher Card */}
              <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg border">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  {teacher.profileImage && (
                    <AvatarImage src={teacher.profileImage} alt={teacherName} />
                  )}
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{teacherName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {teacher.expertise || "Expert"}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-2 w-2 bg-gray-400 rounded-full" />
                    <span className="text-xs text-muted-foreground">Offline</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Get notified instantly
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      We'll send you a notification the moment {teacherName.split(" ")[0]} comes
                      online so you can connect right away
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
                disabled={loading}
              >
                <BellOff className="mr-2 h-4 w-4" />
                Maybe Later
              </Button>
              <Button
                onClick={handleNotifyMe}
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-primary"
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Notify Me When Available
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Success State */
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" />
                <div className="relative bg-green-500 rounded-full p-3">
                  <Bell className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Notification Set!
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                We'll alert you when {teacherName.split(" ")[0]} is online
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OfflineNotificationDialog;