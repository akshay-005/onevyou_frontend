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


import PricingModal from "@/components/PricingModal";
import NotificationPanel from "@/components/NotificationPanel";
import EarningsCard from "@/components/EarningsCard";
import CallHistory from "@/components/CallHistory";
import TeacherCard from "@/components/TeacherCard";
import { clearUserSession } from "@/utils/storage";
import { disconnectSocket } from "@/utils/socket";
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
 // 🧩 Always start offline by default
const [isOnline, setIsOnline] = useState<boolean>(() => {
  const saved = localStorage.getItem("isOnline");
  return saved === "true" ? true : false; // will still respect saved state
});


  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  //const [incomingCall, setIncomingCall] = useState<any | null>(null);
  //const [showIncoming, setShowIncoming] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [callRequests, setCallRequests] = useState<any[]>(() => {
  // ✅ Restore from localStorage on mount
  try {
    const saved = localStorage.getItem('pendingCallRequests');
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("🔄 Restored pending requests from localStorage:", parsed);
      return parsed;
    }
  } catch (err) {
    console.error("Failed to restore pending requests:", err);
  }
  return [];
});

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
  const [sortBy, setSortBy] = useState("name");
  const [filterBy, setFilterBy] = useState("all");

  // Teacher selection (for PricingModal)
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Pricing Settings
  const [customDurations, setCustomDurations] = useState([
    { id: 1, minutes: 1, price: 39, isBase: true },
    { id: 2, minutes: 5, price: 199, isBase: false },
    { id: 3, minutes: 10, price: 399, isBase: false },
  ]);
  const [newDuration, setNewDuration] = useState({ minutes: "", price: "" });

  // KEY SECTIONS TO REPLACE IN UnifiedDashboard.tsx

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
  // 🚫 Always default to offline after login/signup
  const saved = localStorage.getItem("isOnline");
  const restored = saved === "true"; // only restore if user explicitly chose ON before
  const finalState = restored ? true : false; // otherwise stay offline
  console.log("Initial load: forcing isOnline =", finalState);
  setIsOnline(finalState);
  initialLoadComplete.current = true;
}



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

// ✅ Sync pending requests count from restored data (SEPARATE useEffect)
useEffect(() => {
  if (callRequests.length > 0) {
    setPendingRequests(callRequests.length);
    console.log("🔄 Synced pending requests count:", callRequests.length);
  }
}, []); // Run once on mount

useEffect(() => {
  const handleRequestHandled = (e: any) => {
    const requestId = e.detail?.requestId;
    console.log("🗑️ Removing request:", requestId);
    
    if (requestId) {
      setCallRequests(prev => {
        const updated = prev.filter(r => r.id !== requestId);
        // ✅ UPDATE localStorage
        if (updated.length === 0) {
          localStorage.removeItem('pendingCallRequests');
        } else {
          localStorage.setItem('pendingCallRequests', JSON.stringify(updated));
        }
        return updated;
      });
    }
    setPendingRequests(prev => Math.max(0, prev - 1));
  };

  window.addEventListener('call-request-handled', handleRequestHandled);
  return () => window.removeEventListener('call-request-handled', handleRequestHandled);
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

  const onUserStatus = (update: any) => {
    const myUserId = currentUser?._id || localStorage.getItem("userId");
    console.log("user:status event", update, "myUserId:", myUserId);

    // ✅ If this is OUR status update and we manually toggled, don't override local state
    if (update.userId === myUserId && userManuallyToggled.current) {
      console.log("Ignoring our own status broadcast (manual toggle in progress)");
      return;
    }

    setUsers((prev) => {
      const updated = prev.map((u) =>
        u._id === update.userId ? { ...u, online: update.isOnline } : u
      );
      const onlineUsers = updated.filter((u) => u.online);
      setOnlineCount(onlineUsers.length);
      return updated;
    });
  };

 const onIncoming = (payload: any) => {
  console.log("📞 Incoming call (Dashboard, silent sync):", payload);

  // ✅ Avoid duplicate — already handled by NotificationPanel
  const existing = callRequests.find((r) => r.id === payload.callId);
  if (existing) {
    console.log("🟡 Duplicate incoming detected, skipping...");
    return;
  }

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

  // ✅ Update state + localStorage only (no ringtone or toast)
  setCallRequests((prev) => {
    const updated = [newRequest, ...prev];
    localStorage.setItem("pendingCallRequests", JSON.stringify(updated));
    return updated;
  });

  setPendingRequests((prev) => prev + 1);
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

  // Register all listeners
  socket.on("connect", onConnect);
  socket.on("user:status", onUserStatus);
  socket.on("call:incoming", onIncoming);
  socket.on("call:response", onCallResponse);

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
  setUsers([]);
  setShowShareDialog(false);
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

const openPricingForTeacher = (teacher: any) => {
  const safeTeacher = {
    ...teacher,
    pricingTiers: Array.isArray(teacher?.pricingTiers)
      ? teacher.pricingTiers
      : [{ minutes: 1, price: teacher?.ratePerMinute || 39 }],
  };
  setSelectedTeacher(safeTeacher);
  setShowPricingModal(true);
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

  // Sorting
  if (sortBy === "rate-high") {
    list.sort((a, b) => (b.ratePerMinute || 0) - (a.ratePerMinute || 0));
  } else if (sortBy === "rate-low") {
    list.sort((a, b) => (a.ratePerMinute || 0) - (b.ratePerMinute || 0));
  } else if (sortBy === "skill") {
    // Sort by first skill alphabetically
    list.sort((a, b) => {
      const skillA = Array.isArray(a.skills) ? a.skills[0] : "";
      const skillB = Array.isArray(b.skills) ? b.skills[0] : "";
      return (skillA || "").localeCompare(skillB || "");
    });
  } else {
    // Default: sort by name
    list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }

  console.log("Filtered users:", list.length, "Sort:", sortBy, "Filter:", filterBy);
  return list;
}, [users, searchTerm, sortBy, filterBy]);

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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/onevyou-uploads/82f7aa72-94f9-46fe-ab17-75a566659dbd.png"
              alt="ONEVYOU"
              className="h-9"
            />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              ONEVYOU
            </h1>
          </div>

          <div className="flex items-center gap-4">
           {/* Online toggle with green blink indicator */}
<div className="flex items-center gap-3">
  <div className="relative flex items-center gap-2">
    <Switch checked={isOnline} onCheckedChange={handleOnlineToggle} />
    {isOnline && (
      <div className="relative w-3 h-3">
        <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse"></div>
        <div className="absolute inset-1 bg-green-400 rounded-full"></div>
      </div>
    )}
  </div>
  <Label>{isOnline ? "Online" : "Offline"}</Label>
</div>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(true)}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {pendingRequests > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs">
                  {pendingRequests}
                </Badge>
              )}
            </Button>

            {/* Profile dropdown */}
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
                <DropdownMenuLabel>
                  <div className="font-medium">
                    {currentUser?.fullName || "Your Profile"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setShowEarnings(true)}>
                  <Wallet className="mr-2 h-4 w-4" /> Earnings
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setShowHistory(true)}>
                  <Share2 className="mr-2 h-4 w-4" /> Call History
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setShowPricingSettings(true)}>
                  <IndianRupee className="mr-2 h-4 w-4" /> Set Pricing 
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate("/profile-setup?edit=true")}
                >
                  <Settings className="mr-2 h-4 w-4" /> Edit Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    window.open("/help", "_blank")
                  }
                >
                  <HelpCircle className="mr-2 h-4 w-4" /> Help & Support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("/privacy", "_blank")}
                >
                  <Shield className="mr-2 h-4 w-4" /> Privacy Policy
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        "Are you sure you want to delete your account? This action cannot be undone."
                      )
                    ) {
                      toast({ title: "Account deletion requested" });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </DropdownMenuItem>

                <DropdownMenuItem
  onClick={() => {
    console.log("🚪 Logging out...");
    
    // 1. Disconnect socket first
    if (socket) {
      console.log("🔌 Disconnecting socket...");
      disconnectSocket();
    }
    
    // 2. Clear all session data
    clearUserSession();
    
    // 3. Clear any other app-specific data
    localStorage.removeItem("lastVisited");
    
    // 4. Show toast
    toast({ 
      title: "Logged Out", 
      description: "You have been logged out successfully" 
    });
    
    // 5. Redirect to home with slight delay for toast to show
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 500);
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
                <SelectItem value="all">All</SelectItem>
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
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="rate-high">Rate: High → Low</SelectItem>
                <SelectItem value="rate-low">Rate: Low → High</SelectItem>
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

      <Dialog open={showPricingSettings} onOpenChange={setShowPricingSettings}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Your Pricing</DialogTitle>
            <DialogDescription>
              Set custom durations and prices for your calls
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {customDurations
              .filter((d) => d.isBase)
              .map((base) => (
                <div
                  key={base.id}
                  className="bg-primary/10 p-3 rounded-lg flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Base</Badge>
                    <span className="font-medium">{base.minutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="h-4 w-4" />
                    <span className="font-bold">{base.price}</span>
                  </div>
                </div>
              ))}

            {customDurations
              .filter((d) => !d.isBase)
              .map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border rounded-lg p-2"
                >
                  <div className="flex items-center gap-2">
                    <span>{d.minutes} min</span>
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={d.price}
                        onChange={(e) => {
                          const updated = customDurations.map((cd) =>
                            cd.id === d.id
                              ? { ...cd, price: parseInt(e.target.value) || 0 }
                              : cd
                          );
                          setCustomDurations(updated);
                        }}
                        className="w-20 h-8"
                      />
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setCustomDurations(
                        customDurations.filter((cd) => cd.id !== d.id)
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

            <div className="flex items-center gap-2">
              <Input
                placeholder="Minutes"
                type="number"
                className="w-24"
                value={newDuration.minutes}
                onChange={(e) =>
                  setNewDuration({ ...newDuration, minutes: e.target.value })
                }
              />
              <Input
                placeholder="Price"
                type="number"
                className="w-24"
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

            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20, 30, 60].map((min) => (
                <Button
                  key={min}
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCustomDurations([
                      ...customDurations,
                      {
                        id: Date.now() + min,
                        minutes: min,
                        price: min * 39,
                        isBase: false,
                      },
                    ])
                  }
                >
                  {min} min - ₹{min * 39}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => {
              setShowPricingSettings(false);
              toast({
                title: "Saved",
                description: "Your pricing settings have been updated",
              });
            }}
          >
            Save Pricing
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showEarnings} onOpenChange={setShowEarnings}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Earnings</DialogTitle>
          </DialogHeader>
          <EarningsCard />
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
    </div>
  );
};

export default UnifiedDashboard;