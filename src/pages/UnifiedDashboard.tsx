// frontend/src/pages/UnifiedDashboard.tsx
import React, { useEffect, useState, useMemo } from "react";
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
  Mail,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";

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

  // UI state
  const [isOnline, setIsOnline] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);

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

  // Load current user
  useEffect(() => {
    let mounted = true;
    api.getMe()
      .then((res) => {
        if (!mounted) return;
        if (res?.success) setCurrentUser(res.user);
      })
      .catch((err) => {
        console.error("getMe error:", err);
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
      }
    } catch (err) {
      console.error("❌ Fetch users error:", err);
    }
  };

  // Socket event handling (connect, incoming calls, user status, call responses)
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("✅ Socket connected:", socket.id);
      fetchOnlineUsers();
    };

    const onUserStatus = (payload: any) => {
      // payload: { userId, online }
      // refresh list to reflect new online statuses
      fetchOnlineUsers();
    };

    const onIncoming = (payload: any) => {
      console.log("📡 [SOCKET] call:incoming", payload);
      setIncomingCall(payload);
      setShowIncoming(true);
      toast({
        title: "📞 Incoming Call",
        description: `${payload.callerName || "Someone"} is calling you.`,
      });
    };

    const onCallResponse = (payload: any) => {
      console.log("📡 [SOCKET] call:response", payload);
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

    socket.on("connect", onConnect);
    socket.on("user:status", onUserStatus);
    socket.on("call:incoming", onIncoming);
    socket.on("call:response", onCallResponse);

    // initial population
    fetchOnlineUsers();

    return () => {
      socket.off("connect", onConnect);
      socket.off("user:status", onUserStatus);
      socket.off("call:incoming", onIncoming);
      socket.off("call:response", onCallResponse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentUser]);

  // Helper: open pricing modal for a teacher (this will start payment → call)
 const openPricingForTeacher = (teacher: any) => {
  // 🛡️ Ensure teacher.pricingTiers is always an array
  const safeTeacher = {
    ...teacher,
    pricingTiers: Array.isArray(teacher?.pricingTiers)
      ? teacher.pricingTiers
      : [{ minutes: 1, price: teacher?.ratePerMinute || 39 }],
  };

  setSelectedTeacher(safeTeacher);
  setShowPricingModal(true);
};


  // Called by PricingModal after payment is completed
  // NOTE: PricingModal must call this with { teacherId, minutes, price }
  const onPaymentComplete = (payload: { teacherId: string; minutes: number; price: number }) => {
  const channelName = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toUserId = payload.teacherId;
  const price = payload.price;

  if (!socket) {
    toast({ title: "Socket not connected", variant: "destructive" });
    return;
  }

  // 1️⃣ Inform user
  toast({
    title: "Payment successful 💰",
    description: "Starting your video call...",
  });

  // 2️⃣ Send call request to backend/teacher
  socket.emit("call:request", { toUserId, channelName, price });

  // 3️⃣ Navigate the caller immediately to the call screen
  // (This ensures caller joins the Agora room right away)
 // navigate(`/call/${channelName}`);

  // 4️⃣ Close pricing modal cleanly
  setShowPricingModal(false);
  setSelectedTeacher(null);
};

  // Click "Connect" handler (for user cards)
  const handleConnect = (userId: string, rate: number, userObj?: any) => {
    // If you want to route through a pricing/payment step, open PricingModal with the teacher data.
    // Here we open PricingModal passing teacher-like object (fallback).
    const teacherLike = userObj || { id: userId, name: "User", pricingTiers: [{ minutes: 1, price: rate || 39 }] };
    openPricingForTeacher(teacherLike);
  };

  // Toggle online status
  const handleOnlineToggle = (checked: boolean) => {
    setIsOnline(checked);
    if (!socket) {
      toast({ title: "Socket not connected" });
      return;
    }

    socket.emit("creator-status", {
      creatorId: currentUser?._id,
      isOnline: checked,
    });

    if (checked) {
      const link = `${window.location.origin}/connect/${Math.random().toString(36).substring(7)}`;
      setShareLink(link);
      setShowShareDialog(true);
      toast({ title: "✅ You're now online" });
    } else {
      toast({ title: "🔕 You're offline" });
    }
  };

  // Copy share link
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text || "");
    toast({
      title: "Link copied!",
      description: "Share this link with people so they can call you.",
    });
  };

  // Share handler used in share dialog (small helper)
  const shareOnSocial = (platform: string) => {
    const message = "I'm online and available for calls on ONEVYOU! Connect with me now: ";
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

  // Filter + sort the users list
  const filteredUsers = useMemo(() => {
    let list = users.filter((u) => {
      const name = u.fullName || u.profile?.name || u.phoneNumber || "User";
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (filterBy !== "all") {
      // simple filter by expertise-like field if available (skip if not)
      list = list.filter((u) =>
        (u.profile?.expertise || "").toLowerCase().includes(filterBy.toLowerCase())
      );
    }

    if (sortBy === "rate-high") list.sort((a, b) => (b.ratePerMinute || 0) - (a.ratePerMinute || 0));
    else if (sortBy === "rate-low") list.sort((a, b) => (a.ratePerMinute || 0) - (b.ratePerMinute || 0));
    else list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));

    return list;
  }, [users, searchTerm, sortBy, filterBy]);

  // Example static teachers for the visual "TeacherCard" grid (keeps the 'needed' look)
  const sampleTeachers = [
    {
      id: "t-1",
      name: "Sarah Johnson",
      expertise: "Web Development",
      rating: 4.9,
      isOnline: true,
      pricingTiers: [{ minutes: 1, price: 39 }, { minutes: 5, price: 199 }],
    },
    {
      id: "t-2",
      name: "Michael Chen",
      expertise: "Mathematics",
      rating: 4.8,
      isOnline: false,
      pricingTiers: [{ minutes: 1, price: 39 }, { minutes: 5, price: 149 }],
    },
    {
      id: "t-3",
      name: "Emily Davis",
      expertise: "Graphic Design",
      rating: 5.0,
      isOnline: true,
      pricingTiers: [{ minutes: 1, price: 39 }, { minutes: 7, price: 299 }],
    },
    {
      id: "t-4",
      name: "David Park",
      expertise: "Piano & Music Theory",
      rating: 4.7,
      isOnline: true,
      pricingTiers: [{ minutes: 1, price: 39 }, { minutes: 10, price: 499 }],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background relative">
      {/* subtle background pattern */}
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
            <img src="/lovable-uploads/82f7aa72-94f9-46fe-ab17-75a566659dbd.png" alt="ONEVYOU" className="h-9" />
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
            <Button variant="ghost" size="icon" onClick={() => setShowNotifications(true)} className="relative">
              <Bell className="h-5 w-5" />
              {isOnline && onlineCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-white rounded-full text-xs flex items-center justify-center">
                  {onlineCount}
                </span>
              )}
            </Button>

            {/* Unified Profile Dropdown (single menu -> launches dialogs) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {currentUser?.profileImage ? (
                      <AvatarImage src={currentUser.profileImage} alt={currentUser.fullName} />
                    ) : (
                      <AvatarFallback>{currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                    )}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <div>
                    <div className="font-medium">{currentUser?.fullName || "Your Profile"}</div>
                    <div className="text-xs text-muted-foreground">{currentUser?.profile?.expertise || ""}</div>
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
                  <Settings className="mr-2 h-4 w-4" /> Pricing Settings
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate("/profile-setup")}>
                  <Settings className="mr-2 h-4 w-4" /> Edit Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const inviteMessage = "Join me on ONEVYOU!";
                  window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage + " " + window.location.origin)}`, "_blank");
                }}>
                  <UserPlus className="mr-2 h-4 w-4" /> Invite Friends
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => {
                  setShowShareDialog(true);
                }}>
                  <Copy className="mr-2 h-4 w-4" /> Share Connect Link
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open("/help", "_blank")}>
                  <HelpCircle className="mr-2 h-4 w-4" /> Help & Support
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => window.open("/privacy", "_blank")}>
                  <Shield className="mr-2 h-4 w-4" /> Privacy Policy
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => {
                  if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                    toast({ title: "Account deletion requested" });
                    // call API to request deletion here if needed
                  }
                }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => {
                  localStorage.clear();
                  navigate("/");
                }}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8">
        {/* Top controls */}
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

        {/* Grid: show teachers (visual sample) and live users below */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-8">
          {sampleTeachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} onConnect={() => openPricingForTeacher(t)} />
          ))}
        </div>

        {/* Live users panel (from server) */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Available Users ({onlineCount})</h3>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredUsers.map((u) => (
              <div key={u._id} className="bg-card/60 border border-border/50 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{u.fullName || u.profile?.name || u.phoneNumber}</div>
                    <div className="text-sm text-muted-foreground">₹{u.ratePerMinute || 39}/min</div>
                  </div>
                  <div>
                    {u.online && <div className="text-green-500 text-sm">● Online</div>}
                    <Button size="sm" className="mt-3" onClick={() => handleConnect(u._id, u.ratePerMinute || 39, u)}>Connect</Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-muted-foreground">No users online right now.</div>
            )}
          </div>
        </div>
      </main>

      {/* Incoming call modal (component manages ringtone & accepting inside) */}
      <IncomingCallModal open={showIncoming} data={incomingCall} onClose={() => setShowIncoming(false)} />

      {/* Notification panel dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-lg p-0">
          <NotificationPanel />
        </DialogContent>
      </Dialog>

      {/* Share link dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Share Connect Link</DialogTitle>
            <DialogDescription>Share your connect link for instant calls</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input value={shareLink} readOnly />
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(shareLink)}><Copy /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => shareOnSocial("twitter")}>Twitter</Button>
              <Button variant="outline" onClick={() => shareOnSocial("facebook")}>Facebook</Button>
              <Button variant="outline" onClick={() => shareOnSocial("whatsapp")}>WhatsApp</Button>
              <Button variant="outline" onClick={() => shareOnSocial("linkedin")}>LinkedIn</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pricing modal (payment then start call) */}
      {selectedTeacher && (
        <PricingModal
          isOpen={showPricingModal}
          teacher={selectedTeacher}
          onClose={() => { setShowPricingModal(false); setSelectedTeacher(null); }}
          onPaymentComplete={onPaymentComplete} // IMPORTANT: PricingModal must call this after successful payment
        />
      )}

      {/* Pricing settings (for creator to edit pricing options) */}
      <Dialog open={showPricingSettings} onOpenChange={setShowPricingSettings}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Pricing</DialogTitle>
            <DialogDescription>Set the durations and prices you offer</DialogDescription>
          </DialogHeader>
          {/* Keep your existing settings UI here — simplified placeholder to avoid breaking */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Pricing settings UI (keeps your existing UI; replace with your component if you have one)</p>
            <div className="mt-4">
              <Button onClick={() => { setShowPricingSettings(false); toast({ title: "Pricing saved" }); }}>Save Pricing</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Earnings dialog */}
      <Dialog open={showEarnings} onOpenChange={setShowEarnings}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Earnings</DialogTitle>
          </DialogHeader>
          <EarningsCard />
        </DialogContent>
      </Dialog>

      {/* Call history dialog */}
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
