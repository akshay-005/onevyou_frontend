 // frontend/src/pages/UnifiedDashboard.tsx
  import React, { useEffect, useState, useMemo, useRef } from "react";
  import { useNavigate } from "react-router-dom";
  import {
    Avatar,
    AvatarImage,
    AvatarFallback, 
  } from "@/components/ui/avatar";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Switch } from "@/components/ui/switch";
  import { Label } from "@/components/ui/label";
  import {
    Search,
    Bell,
    Settings,
    LogOut,
    Wallet,
    Share2,
    Copy,
    HelpCircle,
    Shield,
    Trash2,
    UserPlus,
    IndianRupee,
    Plus,
    X,
  } from "lucide-react";
  import { Badge } from "@/components/ui/badge";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "@/components/ui/dialog";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";

  import { useToast } from "@/hooks/use-toast";
  import { useSocket } from "@/utils/socket";
  import api from "@/utils/api";

  import WalletCard from "@/components/WalletCard";
  import PricingModal from "@/components/PricingModal";
  import NotificationPanel from "@/components/NotificationPanel";
  import EarningsCard from "@/components/EarningsCard";
  import CallHistory from "@/components/CallHistory";
  import TeacherCard from "@/components/TeacherCard";
  import { clearUserSession } from "@/utils/storage";
  import { disconnectSocket } from "@/utils/socket";
  import OfflineNotificationDialog from "@/components/OfflineNotificationDialog";
  import {
    Instagram,
    Facebook,
    MessageCircle,
    Linkedin,
  } from "lucide-react";

  const UnifiedDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const socket = useSocket();

      // ✅ Listen for global toast events (e.g., reconnect notification)
    useEffect(() => {
      const handleAppToast = (e: any) => {
        const { title, description } = e.detail;
        toast({ title, description });
      };

      window.addEventListener("app-toast", handleAppToast);
      return () => window.removeEventListener("app-toast", handleAppToast);
    }, []);


    // UI state
  // Always start offline unless user explicitly toggles
// ✅ Restore saved toggle from localStorage (if exists)
const [isOnline, setIsOnline] = useState<boolean>(() => {
  const saved = localStorage.getItem("isOnline");
  return saved === "true"; // restore previous state
});




    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    //const [incomingCall, setIncomingCall] = useState<any | null>(null);
    //const [showIncoming, setShowIncoming] = useState(false);
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [onlineCount, setOnlineCount] = useState(0);
    const [pendingRequests, setPendingRequests] = useState(0);
    const [callRequests, setCallRequests] = useState<any[]>([]); // ✅ ADD THIS LINE

    // ✅ NEW: Ref to track if user manually toggled

    // ✅ NEW: Ref to track if user manually toggled (prevents auto-sync from overriding manual toggle)
    const userManuallyToggled = useRef(false);
    const initialLoadComplete = useRef(false);

    // Dialogs
    const [showHistory, setShowHistory] = useState(false);
    const [showEarnings, setShowEarnings] = useState(false);
    const [showPricingSettings, setShowPricingSettings] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Share link & sorting/filtering
    const [shareLink, setShareLink] = useState("");
    const [sortBy, setSortBy] = useState("all");
    const [filterBy, setFilterBy] = useState("all");

    // Teacher selection (for PricingModal)
    const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
    const [showPricingModal, setShowPricingModal] = useState(false);

    const [showOfflineDialog, setShowOfflineDialog] = useState(false);
    const [selectedOfflineTeacher, setSelectedOfflineTeacher] = useState<any | null>(null);
    const [notifiedUsers, setNotifiedUsers] = useState<Set<string>>(new Set());

    const [missedNotificationCount, setMissedNotificationCount] = useState(0);



    // Pricing Settings
    const [customDurations, setCustomDurations] = useState([
    { id: 1, minutes: 1, price: 39, isBase: true }
  ]);
    const [newDuration, setNewDuration] = useState({ minutes: "", price: "" });

    

  // ✅ FIXED: Load current user - only set toggle state once on initial load
  useEffect(() => {
    let mounted = true;
    api
      .getMe()
        .then((res) => {
    if (!mounted) return;
    if (res?.success) {
      setCurrentUser(res.user);

      if (!userManuallyToggled.current && !initialLoadComplete.current) {
        const saved = localStorage.getItem("isOnline");
        const restored = saved === "true";
        const finalState = restored ? true : false;
        console.log("Initial load: forcing isOnline =", finalState);
        setIsOnline(finalState);
        initialLoadComplete.current = true;
      }

      // ✅ NEW: Always fetch online users once after login (even if user is offline)
      setTimeout(() => {
        console.log("🔄 Initial fetch of online users after login");
        fetchOnlineUsers();
      }, 500);
    }
  })

      .catch((err) => {
        console.error("getMe error:", err);
        initialLoadComplete.current = true;
      });
    return () => {
      mounted = false;
    };
  }, []);



  // --- Web Push Subscription Setup ---
useEffect(() => {
  if (!currentUser?._id) return;

  // ✅ ADD THIS: Request permission immediately when user logs in
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      console.log("⚠️ Notifications not supported");
      return;
    }

     // Show permission dialog
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      console.log("🔔 Notification permission:", permission);
      
      if (permission === "granted") {
        toast({
          title: "🔔 Notifications Enabled",
          description: "You'll get alerts when users come online",
        });
      }
    }
  };

   // Request permission first
  requestPushPermission();

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    try {
      // Check if service worker and push are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log("⚠️ Push notifications not supported in this browser");
        return;
      }

      // ✅ FIXED: Check if VAPID key exists
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("⚠️ VAPID public key not configured");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      
      if (Notification.permission !== "granted") {
        console.warn("🔕 Push permission not granted");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // ✅ FIXED: Use proper API call
      const res = await api.savePushSubscription(currentUser._id, subscription);
      
      if (res.success) {
        console.log("✅ Push subscription saved successfully!");
      } else {
        console.error("❌ Failed to save push subscription:", res);
      }
    } catch (err) {
      console.error("❌ Push subscription failed:", err);
    }
  };

  subscribeToPush();
}, [currentUser]);



  

  // ✅ Load user's saved pricing tiers
  useEffect(() => {
    if (currentUser?.pricingTiers && Array.isArray(currentUser.pricingTiers)) {
      console.log("📊 Loading user's saved pricing:", currentUser.pricingTiers);
      
      const tiers = currentUser.pricingTiers.map((tier, index) => ({
        id: Date.now() + index,
        minutes: tier.minutes,
        price: tier.price,
        isBase: tier.minutes === 1
      }));
      
      // Ensure 1-minute base tier exists
      if (!tiers.find(t => t.minutes === 1)) {
        console.warn("⚠️ No 1-minute tier found, adding default");
        tiers.unshift({ 
          id: Date.now(), 
          minutes: 1, 
          price: currentUser.ratePerMinute || 39, 
          isBase: true 
        });
      }
      
      tiers.sort((a, b) => a.minutes - b.minutes);
      setCustomDurations(tiers);
      console.log("✅ Pricing tiers loaded:", tiers);
    }
  }, [currentUser]);


  useEffect(() => {
    const handleRequestHandled = (e: any) => {
      const requestId = e.detail?.requestId;
      console.log("🗑️ Removing request:", requestId);
      
      if (requestId) {
        setCallRequests(prev => prev.filter(r => r.id !== requestId));
      }
      setPendingRequests(prev => Math.max(0, prev - 1));
    };

    window.addEventListener('call-request-handled', handleRequestHandled);
    return () => window.removeEventListener('call-request-handled', handleRequestHandled);
  }, []);


  // ✅ Fetch missed notifications count
useEffect(() => {
  const fetchMissedCount = async () => {
    try {
      const res = await api.getMyWaitingNotifications();
      if (res.success && res.notifications) {
        setMissedNotificationCount(res.notifications.length);
      }
    } catch (err) {
      console.error("Error fetching missed count:", err);
    }
  };

  fetchMissedCount();
  
  // Refresh every 30 seconds
  const interval = setInterval(fetchMissedCount, 30000);
  return () => clearInterval(interval);
}, []);

// ✅ Listen for dismissed notifications
useEffect(() => {
  const handleNotificationDismissed = () => {
    // Refresh missed count
    api.getMyWaitingNotifications().then((res) => {
      if (res.success && res.notifications) {
        setMissedNotificationCount(res.notifications.length);
      }
    });
  };

  window.addEventListener('notification-dismissed', handleNotificationDismissed);
  return () => window.removeEventListener('notification-dismissed', handleNotificationDismissed);
}, []);

  // Fetch online users
  const fetchOnlineUsers = async () => {
    try {
      const json = await api.getOnlineUsers();
      if (json?.success) {
        const all = json.users || [];
        const myId = currentUser?._id || localStorage.getItem("userId");
        const others = all.filter((u: any) => u._id !== myId);
        setUsers(others);
        setOnlineCount(others.length);
        console.log("Fetched online users:", others.length);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  // ✅ FIXED: Socket event handling - removed problematic dependency array
  useEffect(() => {
    if (!socket) {
      console.log("Socket not ready");
      return;
    }

    console.log("Setting up socket listeners");

    const onConnect = () => {
      console.log("Socket connected:", socket.id);
      // ✅ ALWAYS fetch users when socket connects (don't check initialLoadComplete)
      fetchOnlineUsers();
        // ✅ Re-sync last known online status when reconnecting
    const savedStatus = localStorage.getItem("isOnline") === "true";
    socket.emit("user:status:update", {
      userId: currentUser?._id || localStorage.getItem("userId"),
      isOnline: savedStatus,
    });
    console.log("🔄 Restored online status from localStorage:", savedStatus);

    };

  const onUserStatus = async (update: any) => {
  const myUserId = currentUser?._id || localStorage.getItem("userId");
  console.log("📡 user:status event", update, "myUserId:", myUserId);

  // Ignore own broadcast during manual toggle
  if (update.userId === myUserId && userManuallyToggled.current) {
    console.log("⏭️ Ignoring our own status broadcast (manual toggle in progress)");
    return;
  }

  setUsers((prev) => {
    const exists = prev.some((u) => u._id === update.userId);
    let updated = prev;

    if (exists) {
      // ✅ Update existing user's online status
      updated = prev.map((u) => {
        if (u._id === update.userId) {
          // Merge fresh data if available from broadcast
          if (update.userData) {
            return {
              ...u,
              online: update.isOnline,
              fullName: update.userData.fullName || u.fullName,
              profileImage: update.userData.profileImage || u.profileImage,
              bio: update.userData.bio || u.bio,
              skills: update.userData.skills || u.skills,
              socialMedia: update.userData.socialMedia || u.socialMedia,
              ratePerMinute: update.userData.ratePerMinute || u.ratePerMinute,
              pricingTiers: update.userData.pricingTiers || u.pricingTiers,
              rating: update.userData.rating || u.rating,
            };
          } else {
            return { ...u, online: update.isOnline };
          }
        }
        return u;
      });
      console.log(`✅ Updated existing user ${update.userId}: online=${update.isOnline}`);
    } else if (update.isOnline && update.userData) {
      // ✅ Add new user directly from broadcast data
      const newUser = {
        ...update.userData,
        online: true,
      };
      updated = [...prev, newUser];
      console.log("✨ Added new online user from broadcast:", newUser.fullName || newUser._id);
    } else if (update.isOnline && !update.userData) {
      // ✅ Fallback: Fetch user data if not included in broadcast
      console.log("⚠️ No userData in broadcast, fetching from API...");
      fetch(`${import.meta.env.VITE_API_URL || "https://onevyou.onrender.com"}/api/users/all`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("userToken")}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.users)) {
            const newUser = data.users.find((u) => u._id === update.userId);
            if (newUser) {
              setUsers((prevList) => {
                const exists = prevList.some((u) => u._id === newUser._id);
                if (!exists) {
                  return [...prevList, { ...newUser, online: true }];
                }
                return prevList.map((u) =>
                  u._id === newUser._id ? { ...u, online: true } : u
                );
              });
              console.log("✨ Fetched and added new user:", newUser.fullName || newUser._id);
            }
          }
        })
        .catch((err) => console.error("❌ Failed to fetch new online user:", err));
    }

    // ✅ Deduplicate to be safe
    const unique = updated.filter(
      (u, index, self) => index === self.findIndex((x) => x._id === u._id)
    );

    // ✅ Update online count
    const onlineUsers = unique.filter((u) => u.online);
    setOnlineCount(onlineUsers.length);
    
    console.log(`📊 Total users: ${unique.length}, Online: ${onlineUsers.length}`);
    return unique;
  });
};

  const onIncoming = (payload: any) => {
      console.log("📞 Dashboard received incoming call:", payload);
      
      // ✅ Create full request object
      const newRequest = {
        id: payload.callId,
        studentName: payload.callerName || "Unknown",
        duration: `${payload.durationMin || 1} min`,
        price: payload.price || 0,
        time: "Just now",
        subject: "Incoming Call",
        channelName: payload.channelName,
        fromUserId: payload.fromUserId,
        durationMin: payload.durationMin || 1,
      };
      
      // ✅ Store in state
      setCallRequests(prev => [newRequest, ...prev]);
      setPendingRequests(prev => prev + 1);
      
      console.log("✅ Stored request:", newRequest);
      
      toast({
        title: "📞 New Call Request",
        description: `${payload.callerName || "Someone"} wants to connect`,
      });
    };

    const onCallResponse = (payload: any) => {
      if (payload.accepted && payload.channelName) {
        navigate(`/call/${payload.channelName}`);
      } else {
        toast({
          title: "Call Rejected",
          description: "The other user declined the call.",
          variant: "destructive",
        });
      }
    };

    // ✅ Listen for pricing updates in real time
const onPricingUpdate = (update: any) => {
  setUsers((prev) =>
    prev.map((u) =>
      u._id === update.userId
        ? { ...u, pricingTiers: update.pricingTiers }
        : u
    )
  );

  // ✅ If currently selected teacher matches, refresh their data too
  setSelectedTeacher((prev) => {
    if (prev && (prev._id === update.userId || prev.id === update.userId)) {
      return { ...prev, pricingTiers: update.pricingTiers };
    }
    return prev;
  });

  console.log("💰 Pricing updated for:", update.userId);
};

// ✅ NEW: Listen for wallet updates (refunds/earnings) - SEPARATE FUNCTION!
const onWalletUpdated = (data: any) => {
  if (data.isRefund) {
    toast({
      title: "💸 Instant Refund Processed",
      description: `₹${data.amount} added to your wallet. ${data.message}`,
      duration: 5000,
    });
  } else {
    toast({
      title: "💰 Earnings Received",
      description: `You earned ₹${data.amount} from your last call!`,
      duration: 5000,
    });
  }
  
  // Refresh wallet display
  window.dispatchEvent(new Event("wallet-updated"));
};


// PURPOSE: Show notification when a user you're waiting for comes online

const onUserNowOnline = (data: any) => {
  console.log("🎉 User came online event received:", data);
  
  // ✅ Check if we already notified about this user in this session
  if (notifiedUsers.has(data.userId)) {
    console.log("⏭️ Already notified about this user, skipping");
    return;
  }
  
  // ✅ Mark as notified
  setNotifiedUsers(prev => new Set(prev).add(data.userId));
  
  toast({
    title: "🎉 User is Now Online!",
    description: `${data.userName} just came online. Connect now!`,
    duration: 8000,
    action: (
      <Button
        size="sm"
        onClick={() => {
          // Find the user and open pricing modal
          const user = users.find(u => u._id === data.userId);
          if (user) {
            openPricingForTeacher(user);
          }
        }}
      >
        Connect
      </Button>
    ),
  });
  
  // Refresh users list to show them as online
  fetchOnlineUsers();
};




    // Register all listeners
    socket.on("connect", onConnect);
    socket.on("user:status", onUserStatus);
    socket.on("call:incoming", onIncoming);
    socket.on("call:response", onCallResponse);
    socket.on("user:pricing:update", onPricingUpdate);
    socket.on("wallet:updated", onWalletUpdated);
    socket.on("user:now-online", onUserNowOnline);


    // If already connected, call onConnect immediately
    if (socket.connected) {
      console.log("Socket already connected, calling onConnect");
      onConnect();
    }

    // Cleanup
    return () => {
      console.log("Cleaning up socket listeners");
      socket.off("connect", onConnect);
      socket.off("user:status", onUserStatus);
      socket.off("call:incoming", onIncoming);
      socket.off("call:response", onCallResponse);
      socket.off("user:pricing:update", onPricingUpdate);
      socket.off("wallet:updated", onWalletUpdated);
      socket.off("user:now-online", onUserNowOnline);


    };
  }, [socket]); // ✅ ONLY depend on socket object itself, not socket.connected

  // ✅ Keep toggle state persistent and synced automatically
  useEffect(() => {
    // Save to localStorage every time user changes online state
    localStorage.setItem("isOnline", isOnline.toString());

    // Send to backend if socket is connected and user exists
    if (socket && socket.connected && currentUser?._id) {
      socket.emit("user:status:update", {
        userId: currentUser._id,
        isOnline,
      });
      console.log("📡 Auto-sync user status to backend:", isOnline);
    }
  }, [isOnline]);


  // ✅ FIXED: Toggle with immediate socket emit
  const handleOnlineToggle = (checked: boolean) => {
    if (!socket) {
      toast({ title: "Socket not connected", variant: "destructive" });
      setIsOnline(false);
      return;
    }

    // ✅ Share on social media including Instagram
  const shareOnSocial = (platform: string) => {
    const message =
      "I'm online and available for calls on ONEVYOU! Connect with me now: ";
    const encodedMessage = encodeURIComponent(message);
    const encodedUrl = encodeURIComponent(shareLink);

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`,
      whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`,
      instagram: `https://www.instagram.com/`, // Instagram doesn't support direct sharing
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };

    if (platform === "instagram") {
      // For Instagram, copy link and show message
      copyToClipboard(shareLink);
      toast({
        title: "Link Copied!",
        description: "Share this link in your Instagram bio or story.",
      });
      return;
    }

    if (urls[platform]) window.open(urls[platform], "_blank");
  };

    


    // ✅ Mark that user manually toggled
    userManuallyToggled.current = true;
    console.log("User toggled:", checked);

    // ✅ Update local state immediately
    setIsOnline(checked);

    // ✅ Emit to server immediately
    socket.emit("user:status:update", {
      userId: currentUser?._id,
      isOnline: checked,
    });
      // ✅ Save user’s chosen state to persist across refreshes
    localStorage.setItem("isOnline", JSON.stringify(checked));


    if (checked) {
    toast({ title: "You're now Online" });
    
    // ✅ Generate share link
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/profile/${currentUser?._id}`;
    setShareLink(link);
    
    // ✅ Show share dialog automatically
    setTimeout(() => setShowShareDialog(true), 500);
    
    // ✅ Fetch fresh online users after going online
    setTimeout(() => fetchOnlineUsers(), 200);
  } else {
  toast({ title: "You're now Offline" });
  setShowShareDialog(false);

  // ✅ Still show others even if you go offline
  // Just refresh list instead of clearing it
  setTimeout(() => fetchOnlineUsers(), 300);
}


    // ✅ Reset the ref after a short delay to allow state sync
    setTimeout(() => {
      userManuallyToggled.current = false;
      console.log("Manual toggle complete, sync re-enabled");
    }, 1000);
  };



  // ✅ Payment complete → emit call request
  const onPaymentComplete = (payload: {
    teacherId: string;
    minutes: number;
    price: number;
  }) => {
    const channelName = `call-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const toUserId = payload.teacherId;
    const price = payload.price;

    if (!socket) {
      toast({ title: "Socket not connected", variant: "destructive" });
      return;
    }

    toast({
      title: "Payment successful",
      description: "Starting your video call...",
    });

    socket.emit("call:request", { toUserId, channelName, price, durationMin: payload.minutes });

  // 🔹 Immediately open CallRoom as CALLER
  navigate(`/call/${channelName}?role=caller&duration=${payload.minutes}`);

  setShowPricingModal(false);
  setSelectedTeacher(null);

  };

  //  open Pricing For Teacher function 

  const openPricingForTeacher = async (teacher: any) => {
  try {
    console.log("🔍 Opening pricing modal for:", teacher.fullName || teacher.name);
    
    // ✅ NEW: Check if user is offline
    if (!teacher.online && teacher.online !== undefined) {
      console.log("⚠️ User is offline, showing notification dialog");
      setSelectedOfflineTeacher({
        id: teacher._id || teacher.id,
        _id: teacher._id || teacher.id,
        name: teacher.fullName || teacher.name || "User",
        fullName: teacher.fullName || teacher.name || "User",
        profileImage: teacher.profileImage,
        expertise: teacher.skills?.[0] || teacher.expertise || "Expert",
      });
      setShowOfflineDialog(true);
      return; // ✅ Exit early - don't show pricing modal
    }

    // ✅ REST OF EXISTING CODE FOR ONLINE USERS
    console.log("📊 Current teacher data:", {
      id: teacher._id,
      tiers: teacher.pricingTiers,
      rate: teacher.ratePerMinute
    });

    const freshRes = await api.getOnlineUsers();
    
    let freshTeacher = teacher;
    
    if (freshRes?.success && Array.isArray(freshRes.users)) {
      const found = freshRes.users.find((u: any) => 
        u._id === teacher._id || u._id === teacher.id
      );
      
      if (found) {
        freshTeacher = found;
        console.log("✅ Fetched fresh teacher data:", {
          name: found.fullName,
          tiers: found.pricingTiers,
          rate: found.ratePerMinute
        });
      }
    }

    const pricingTiers = Array.isArray(freshTeacher?.pricingTiers) && freshTeacher.pricingTiers.length > 0
      ? freshTeacher.pricingTiers
      : [{ minutes: 1, price: freshTeacher?.ratePerMinute || 39 }];

    console.log("💰 Final pricing tiers to display:", pricingTiers);

    const safeTeacher = {
      id: freshTeacher._id || freshTeacher.id,
      _id: freshTeacher._id || freshTeacher.id,
      name: freshTeacher.fullName || freshTeacher.name || "User",
      rating: freshTeacher.rating || freshTeacher.profile?.rating || 4.8,
      expertise: freshTeacher.skills?.[0] || freshTeacher.expertise || "Expert",
      pricingTiers: pricingTiers.sort((a, b) => a.minutes - b.minutes),
      ratePerMinute: freshTeacher.ratePerMinute || pricingTiers[0]?.price || 39
    };

    console.log("🎯 Opening modal with teacher:", safeTeacher);
    
    setSelectedTeacher(safeTeacher);
    setShowPricingModal(true);
  } catch (err) {
    console.error("❌ Error fetching latest teacher data:", err);
    
    const fallbackTiers = Array.isArray(teacher?.pricingTiers) && teacher.pricingTiers.length > 0
      ? teacher.pricingTiers
      : [{ minutes: 1, price: teacher?.ratePerMinute || 39 }];
    
    setSelectedTeacher({
      id: teacher._id || teacher.id,
      _id: teacher._id || teacher.id,
      name: teacher.fullName || teacher.name || "User",
      rating: teacher.rating || 4.8,
      expertise: teacher.skills?.[0] || "Expert",
      pricingTiers: fallbackTiers,
      ratePerMinute: teacher.ratePerMinute || 39
    });
    setShowPricingModal(true);
  }
};

  const handleConnect = (userId: string, rate: number, userObj?: any) => {
    const teacherLike =
      userObj || {
        id: userId,
        name: "User",
        pricingTiers: [{ minutes: 1, price: rate || 39 }],
      };
    openPricingForTeacher(teacherLike);
  };

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text || "");
      toast({
        title: "Link copied!",
        description: "Share this link with people so they can call you.",
      });
    };

    const shareOnSocial = (platform: string) => {
      const message =
        "I'm online and available for calls on ONEVYOU! Connect with me now: ";
      const encodedMessage = encodeURIComponent(message);
      const encodedUrl = encodeURIComponent(shareLink);

      const urls: Record<string, string> = {
        twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`,
        whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      };  

      if (urls[platform]) window.open(urls[platform], "_blank");
    };

    // Filter & sort
   const filteredUsers = useMemo(() => {
  let list = users.filter((u) => {
    // Search by name, bio, AND skills
    const name = u.fullName || u.profile?.name || u.phoneNumber || "User";
    const bio = u.bio || u.profile?.bio || u.about || "";
    const skillsText = Array.isArray(u.skills) 
      ? u.skills.join(" ").toLowerCase() 
      : (u.profile?.skills || []).join(" ").toLowerCase();
    
    const searchLower = searchTerm.toLowerCase();
    
    // Match if search term found in name, bio, or skills
    return (
      name.toLowerCase().includes(searchLower) ||
      bio.toLowerCase().includes(searchLower) ||
      skillsText.includes(searchLower)
    );
  });

  // Filter by category/expertise
  if (filterBy !== "all") {
    list = list.filter((u) => {
      const skills = Array.isArray(u.skills) ? u.skills : (u.profile?.skills || []);
      const skillsText = skills.join(" ").toLowerCase();
      return skillsText.includes(filterBy.toLowerCase());
    });
  }

  // ✅ NEW SORTING LOGIC
  if (sortBy === "all") {
    // Default: sort by name
    list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  } else if (sortBy === "online") {
    // Online users first, then by name
    list.sort((a, b) => {
      if (a.online === b.online) {
        return (a.fullName || "").localeCompare(b.fullName || "");
      }
      return a.online ? -1 : 1;
    });
  } else if (sortBy === "rating") {
    // Highest rated first
    list.sort((a, b) => {
      const ratingA = a.rating || a.profile?.rating || 0;
      const ratingB = b.rating || b.profile?.rating || 0;
      return ratingB - ratingA;
    });
  } else if (sortBy === "rate-high") {
    // Highest price first
    list.sort((a, b) => (b.ratePerMinute || 0) - (a.ratePerMinute || 0));
  } else if (sortBy === "rate-low") {
    // Lowest price first
    list.sort((a, b) => (a.ratePerMinute || 0) - (b.ratePerMinute || 0));
  }

  console.log("Filtered users:", list.length, "Sort:", sortBy, "Filter:", filterBy);
  return list;
}, [users, searchTerm, sortBy, filterBy]);


  // 🧮 Helper to get minimum allowed price
  const getMinimumPrice = (minutes: number): number => {
    if (!minutes || minutes <= 0) return 0;
    return 39 + (minutes - 1) * 10;
  };


    // --- UI ---
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background relative">
        <div
          className="fixed inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Header */}
        <header className="bg-card/60 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between">
  {/* Left: Logo and Name */}
  <div className="flex items-center gap-2 sm:gap-3">
    <img
      src="/onevyou-uploads/82f7aa72-94f9-46fe-ab17-75a566659dbd.png"
      alt="ONEVYOU"
      className="h-8 sm:h-9"
    />
    <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent whitespace-nowrap">
      ONEVYOU
    </h1>
  </div>

  {/* Right: Toggle + Notifications + Profile */}
  <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end w-auto sm:w-auto">
    {/* Toggle */}
    <div className="flex items-center gap-2">
      <Switch checked={isOnline} onCheckedChange={handleOnlineToggle} />
      {isOnline && (
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse"></div>
          <div className="absolute inset-1 bg-green-400 rounded-full"></div>
        </div>
      )}
      <Label className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</Label>
    </div>

    {/* Notifications */}
    <Button
  variant="ghost"
  size="icon"
  onClick={() => setShowNotifications(true)}
  className="relative"
>
  <Bell className="h-5 w-5" />
  {/* ✅ Show total of incoming + missed */}
  {(pendingRequests + missedNotificationCount) > 0 && (
    <Badge className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs">
      {pendingRequests + missedNotificationCount}
    </Badge>
  )}
</Button>

    {/* Profile dropdown (kept visible) */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Avatar className="h-8 w-8">
            {currentUser?.profileImage ? (
              <AvatarImage
                src={currentUser.profileImage}
                alt={currentUser.fullName}
              />
            ) : (
              <AvatarFallback>
                {currentUser?.fullName
                  ? currentUser.fullName.charAt(0).toUpperCase()
                  : "U"}
              </AvatarFallback>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Keep all dropdown items as is */}
        <DropdownMenuLabel>
          <div className="font-medium">
            {currentUser?.fullName || "Your Profile"}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowEarnings(true)}>
          <Wallet className="mr-2 h-4 w-4" /> Wallet & Earnings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowHistory(true)}>
          <Share2 className="mr-2 h-4 w-4" /> Call History
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowPricingSettings(true)}>
          <IndianRupee className="mr-2 h-4 w-4" /> Set Pricing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/profile-setup?edit=true")}>
          <Settings className="mr-2 h-4 w-4" /> Edit Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.open("/help", "_blank")}>
          <HelpCircle className="mr-2 h-4 w-4" /> Help & Support
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("/privacy", "_blank")}>
          <Shield className="mr-2 h-4 w-4" /> Privacy Policy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            if (confirm("Are you sure you want to delete your account?")) {
              toast({ title: "Account deletion requested" });
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (socket) disconnectSocket();
            clearUserSession();
            localStorage.setItem("isOnline", "false");
            toast({
              title: "Logged Out",
              description: "You have been logged out successfully",
            });
            setTimeout(() => navigate("/", { replace: true }), 500);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
</header>
            
        

        {/* ✅ ADD THIS ENTIRE SECTION: */}
        {pendingRequests > 0 && (
          <div className="container mx-auto px-6 py-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    {pendingRequests}
                  </Badge>
                </div>
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    You have {pendingRequests} new connection request{pendingRequests > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Students are waiting to learn from you
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                onClick={() => setShowNotifications(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Requests
              </Button>
            </div>
          </div>
        )}


        {/* Main */}
        <main className="container mx-auto px-6 py-8">
          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teachers, users or expertise..."
                className="pl-10 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Field</SelectItem>
                  <SelectItem value="web">Web Development</SelectItem>
                  <SelectItem value="math">Mathematics</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
  <SelectTrigger className="w-[160px]">
    <SelectValue placeholder="Sort by" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Users</SelectItem>
    <SelectItem value="online">Online First</SelectItem>
    <SelectItem value="rating">Highest Rated</SelectItem>
    <SelectItem value="rate-low">Price: Low to High</SelectItem>
    <SelectItem value="rate-high">Price: High to Low</SelectItem>
  </SelectContent>
</Select>
            </div>
          </div>

          {/* Available users */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">
              Available Users ({onlineCount})
            </h3>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredUsers.map((u, i) => {
    console.log("🎨 Rendering card for user:", {
      name: u.fullName,
      bio: u.bio,
      skills: u.skills,
      hasImage: !!u.profileImage,
    });

    return (
      <TeacherCard
        key={u._id || i}
        teacher={{
          _id: u._id,
          id: u._id, // Both _id and id for compatibility
          fullName: u.fullName,
          name: u.fullName || u.profile?.name || u.phoneNumber || "User",
          profileImage: u.profileImage, // Direct from API
          bio: u.bio, // Direct from API
          skills: u.skills, // Direct from API (array)
          expertise: u.skills?.[0] || "Skill not specified", // First skill
          rating: u.profile?.rating || 4.8,
          isOnline: u.online,
          online: u.online,
          socialMedia: u.socialMedia, // Direct from API
          pricingTiers: Array.isArray(u.pricingTiers)
            ? u.pricingTiers
            : [
                { minutes: 1, price: u.ratePerMinute || 39 },
                ...(u.profile?.pricingTiers || []),
              ],
          ratePerMinute: u.ratePerMinute || 39,
        }}
        onConnect={() =>
          handleConnect(u._id, u.ratePerMinute || 39, u)
        }
      />
    );
  })}

              {filteredUsers.length === 0 && (
                <div className="text-muted-foreground">
                  No users online right now.
                </div>
              )}
            </div>
          </div>
        </main>

        
  <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
          <DialogContent className="sm:max-w-lg p-0">
            <NotificationPanel requests={callRequests} />
          </DialogContent>
        </Dialog>

        {/* ✅ IMPROVED: Share Dialog with Instagram and other platforms */}
  <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" /> You're Now Online!
        </DialogTitle>
        <DialogDescription>
          Share your link on social media to let people know you're available for calls
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 py-4">
        {/* Share Link */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Your Share Link</Label>
          <div className="flex gap-2">
            <Input 
              value={shareLink} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => copyToClipboard(shareLink)}
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Share on Social Media */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Share on Social Media</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => shareOnSocial("twitter")}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
              </svg>
              Twitter
            </Button>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => shareOnSocial("facebook")}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => shareOnSocial("whatsapp")}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => shareOnSocial("instagram")}
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </Button>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => shareOnSocial("linkedin")}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Your link is active while you're online. When someone clicks your link, they'll be able to request a call with you instantly.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>

        {selectedTeacher && (
          <PricingModal
            isOpen={showPricingModal}
            teacher={selectedTeacher}
            onClose={() => {
              setShowPricingModal(false);
              setSelectedTeacher(null);
            }}
            onPaymentComplete={onPaymentComplete}
          />
        )}

        

      

          {/*PRICING SETTINGS DIALOG*/} 

  <Dialog open={showPricingSettings} onOpenChange={setShowPricingSettings}>
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Manage Your Pricing</DialogTitle>
        <DialogDescription>
          Set custom durations and prices. Minimum: ₹39 for 1 min, +₹10 per additional minute.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Base Pricing (1 minute) - Always shown, editable */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Base Rate (1 minute)</Label>
          <div className="flex items-center gap-3 bg-primary/10 p-4 rounded-lg border border-primary/20">
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2">Required</Badge>
              <div className="flex items-center gap-2">
                <span className="font-medium">1 minute</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min="39"
                value={customDurations.find(d => d.minutes === 1)?.price || 39}
                onChange={(e) => {
                  const newPrice = Math.max(39, parseInt(e.target.value) || 39);
                  setCustomDurations(prev => {
                    const updated = prev.map(d => 
                      d.minutes === 1 ? { ...d, price: newPrice } : d
                    );
                    // If 1-min tier doesn't exist, add it
                    if (!updated.find(d => d.minutes === 1)) {
                      updated.unshift({ id: Date.now(), minutes: 1, price: newPrice, isBase: true });
                    }
                    return updated;
                  });
                }}
                className={`w-24 h-10 text-center font-semibold ${
                  (customDurations.find(d => d.minutes === 1)?.price || 39) < 39 
                    ? "border-red-500" 
                    : "border-green-500"
                }`}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum allowed: ₹39
          </p>
        </div>

        {/* Custom Duration Tiers */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Custom Duration Packages</Label>
          {customDurations
            .filter(d => d.minutes !== 1)
            .sort((a, b) => a.minutes - b.minutes)
            .map((d) => {
              const minPrice = getMinimumPrice(d.minutes);
              const isValid = d.price >= minPrice;
              
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 border rounded-lg p-3 transition-all ${
                    isValid 
                      ? "border-border bg-card" 
                      : "border-red-300 bg-red-50 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{d.minutes} minutes</span>
                      {!isValid && (
                        <Badge variant="destructive" className="text-xs">
                          Below minimum
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs ${
                      isValid ? "text-muted-foreground" : "text-red-600 dark:text-red-400"
                    }`}>
                      Minimum: ₹{minPrice} {isValid && "✓"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={minPrice}
                        value={d.price}
                        onChange={(e) => {
                          const newPrice = parseInt(e.target.value) || 0;
                          setCustomDurations(prev =>
                            prev.map(cd =>
                              cd.id === d.id ? { ...cd, price: newPrice } : cd
                            )
                          );
                        }}
                        className={`w-24 h-9 text-center ${
                          isValid ? "border-green-500" : "border-red-500"
                        }`}
                      />
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setCustomDurations(prev => 
                          prev.filter(cd => cd.id !== d.id)
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Add New Duration */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-sm font-medium">Add Custom Duration</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Minutes"
              type="number"
              min="2"
              className="w-28"
              value={newDuration.minutes}
              onChange={(e) =>
                setNewDuration({ ...newDuration, minutes: e.target.value })
              }
            />
            <Input
              placeholder={`Min: ₹${newDuration.minutes ? getMinimumPrice(parseInt(newDuration.minutes)) : '49'}`}
              type="number"
              className="w-28"
              value={newDuration.price}
              onChange={(e) =>
                setNewDuration({ ...newDuration, price: e.target.value })
              }
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                if (newDuration.minutes && newDuration.price) {
                  const minutes = parseInt(newDuration.minutes);
                  const price = parseInt(newDuration.price);
                  const minPrice = getMinimumPrice(minutes);

                  if (minutes < 1) {
                    toast({
                      title: "Invalid Duration",
                      description: "Duration must be at least 1 minute",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (price < minPrice) {
                    toast({
                      title: "Invalid Price",
                      description: `Minimum price for ${minutes} min is ₹${minPrice}`,
                      variant: "destructive",
                    });
                    return;
                  }

                  // Check for duplicate
                  if (customDurations.find(d => d.minutes === minutes)) {
                    toast({
                      title: "Duplicate Duration",
                      description: `${minutes}-minute option already exists`,
                      variant: "destructive",
                    });
                    return;
                  }

                  setCustomDurations([
                    ...customDurations,
                    {
                      id: Date.now(),
                      minutes,
                      price,
                      isBase: false,
                    },
                  ]);
                  setNewDuration({ minutes: "", price: "" });
                  toast({
                    title: "Added",
                    description: `${minutes}-minute option added`,
                  });
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Formula: ₹39 base + ₹10 per additional minute
          </p>
        </div>

        {/* Quick Add Buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Add Packages</Label>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 30, 60].map((min) => {
              const price = getMinimumPrice(min);
              const exists = customDurations.find(d => d.minutes === min);
              
              return (
                <Button
                  key={min}
                  size="sm"
                  variant={exists ? "secondary" : "outline"}
                  disabled={exists}
                  onClick={() => {
                    setCustomDurations([
                      ...customDurations,
                      {
                        id: Date.now() + min,
                        minutes: min,
                        price: price,
                        isBase: false,
                      },
                    ]);
                  }}
                  className="text-xs"
                >
                  {exists && "✓ "}
                  {min}m - ₹{price}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button
        className="w-full"
        onClick={async () => {
          // Validate all tiers
          const invalid = customDurations.find(
            (d) => d.price < getMinimumPrice(d.minutes)
          );
          
          if (invalid) {
            toast({
              title: "Invalid Pricing",
              description: `${invalid.minutes}m must be at least ₹${getMinimumPrice(invalid.minutes)}`,
              variant: "destructive",
            });
            return;
          }

          // Ensure 1-minute base tier exists
          if (!customDurations.find(d => d.minutes === 1)) {
            customDurations.unshift({
              id: Date.now(),
              minutes: 1,
              price: 39,
              isBase: true
            });
          }

          try {
            const cleanedTiers = customDurations
              .map((d) => ({
                minutes: d.minutes,
                price: d.price,
              }))
              .sort((a, b) => a.minutes - b.minutes);

            console.log("💾 Saving pricing tiers:", cleanedTiers);

            const res = await api.updatePricing(cleanedTiers);

            if (res.success) {
              toast({
                title: "✅ Pricing Saved",
                description: "Your pricing has been updated successfully.",
              });

              // Refresh current user data
              const userData = await api.getMe();
              if (userData?.success && userData?.user) {
                setCurrentUser(userData.user);
              }

              // Refresh online users
              fetchOnlineUsers();

              setShowPricingSettings(false);
            } else {
              toast({
                title: "Error",
                description: res.message || "Failed to update pricing.",
                variant: "destructive",
              });
            }
          } catch (err) {
            console.error("❌ Save pricing error:", err);
            toast({
              title: "Server Error",
              description: "Could not update pricing. Try again later.",
              variant: "destructive",
            });
          }
        }}
      >
        Save Pricing
      </Button>
    </DialogContent>
  </Dialog>

        <Dialog open={showEarnings} onOpenChange={setShowEarnings}>
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Wallet & Earnings</DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        <WalletCard />
        <EarningsCard />
      </div>
    </DialogContent>
  </Dialog>

        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Call History</DialogTitle>
            </DialogHeader>
            <CallHistory />
          </DialogContent>
        </Dialog>

        {/* ✅ ADD THIS - Offline Notification Dialog */}
{selectedOfflineTeacher && (
  <OfflineNotificationDialog
    isOpen={showOfflineDialog}
    onClose={() => {
      setShowOfflineDialog(false);
      setSelectedOfflineTeacher(null);
    }}
    teacher={selectedOfflineTeacher}
  />
)}
      </div>
    );
  };

  
  export default UnifiedDashboard;