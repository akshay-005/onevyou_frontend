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

import IncomingCallModal from "@/components/IncomingCallModal";
import PricingModal from "@/components/PricingModal";
import NotificationPanel from "@/components/NotificationPanel";
import EarningsCard from "@/components/EarningsCard";
import CallHistory from "@/components/CallHistory";
import TeacherCard from "@/components/TeacherCard";

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
  const [isOnline, setIsOnline] = useState<boolean>(() => {
  // ✅ Restore from localStorage on load
  const saved = localStorage.getItem("isOnline");
  return saved === "true";
});

  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);

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
        // ✅ Only set toggle if not manually toggled and first time loading
        if (!userManuallyToggled.current && !initialLoadComplete.current) {
  const saved = localStorage.getItem("isOnline");
  const restored = saved === null ? res.user.online : saved === "true";
  console.log("Initial load: setting isOnline to", restored);
  setIsOnline(restored);
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
    setIncomingCall(payload);
    setShowIncoming(true);
    toast({
      title: "Incoming Call",
      description: `${payload.callerName || "Someone"} is calling you.`,
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
    // ✅ Fetch fresh online users after going online
    setTimeout(() => fetchOnlineUsers(), 200);
  } else {
    toast({ title: "You're now Offline" });
    // ✅ Clear users list when offline
    setUsers([]);
  }

  // ✅ Reset the ref after a short delay to allow state sync
  setTimeout(() => {
    userManuallyToggled.current = false;
    console.log("Manual toggle complete, sync re-enabled");
  }, 1000);
};

// Add these functions to UnifiedDashboard.tsx right after handleOnlineToggle

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

  socket.emit("call:request", { toUserId, channelName, price });

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
              src="/lovable-uploads/82f7aa72-94f9-46fe-ab17-75a566659dbd.png"
              alt="ONEVYOU"
              className="h-9"
            />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              ONEVYOU
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Online toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={isOnline} onCheckedChange={handleOnlineToggle} />
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
              {isOnline && onlineCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs">
                  {onlineCount}
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
    if (socket) {
      console.log("Disconnecting socket on logout...");
      socket.disconnect();
    }
    // ✅ Remove only login-related data and saved toggle state
    localStorage.removeItem("userToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("isOnline");
    navigate("/");
  }}
>
  <LogOut className="mr-2 h-4 w-4" /> Logout
</DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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

      {/* Modals */}
      <IncomingCallModal
        open={showIncoming}
        data={incomingCall}
        onClose={() => setShowIncoming(false)}
      />

      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-lg p-0">
          <NotificationPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Share Connect Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input value={shareLink} readOnly />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(shareLink)}
              >
                <Copy />
              </Button>
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