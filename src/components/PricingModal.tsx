// REPLACE YOUR ENTIRE PricingModal.tsx FILE WITH THIS FIXED VERSION

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  IndianRupee,
  CreditCard,
  Smartphone,
  Award,
  TrendingUp,
  Sparkles,
  Video,
  Clock,
} from "lucide-react";
import api from "@/utils/api";
import { getUserSession } from "@/utils/storage";

const PREFETCH_KEY = (id: string) => `teacher_cache_${id}`;


interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (payload: {
    teacherId: string;
    minutes: number;
    price: number;
  }) => void;
  teacher: {
    id?: string;
    _id?: string;
    name: string;
    rating: number;
    expertise: string;
    pricingTiers: { minutes: number; price: number }[];
  };
}

const PricingModal = ({
  isOpen,
  onClose,
  onPaymentComplete,
  teacher,
}: PricingModalProps) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sortedTiers, setSortedTiers] = useState<{ minutes: number; price: number }[]>([]);
  const [walletBalance, setWalletBalance] = useState(0); 
  const [loadingTiers, setLoadingTiers] = useState(false);


  // ✅ Load and sort pricing tiers whenever teacher changes
 // ✅ Load and sort pricing tiers whenever teacher changes — merge prefetched cache for instant UI
useEffect(() => {
  try {
    // 1) prefer server-provided teacher.pricingTiers if present
    let tiers = (teacher?.pricingTiers && Array.isArray(teacher.pricingTiers))
      ? [...teacher.pricingTiers]
      : teacher?.profile?.pricingTiers ? [...teacher.profile.pricingTiers] : [{ minutes: 1, price: teacher?.ratePerMinute || 39 }];

    // 2) attempt to merge prefetched cache if it has valid pricing (sessionStorage)
    try {
      const tid = (teacher?.id || teacher?._id)?.toString();
      if (tid) {
        const cached = sessionStorage.getItem(PREFETCH_KEY(tid));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.pricingTiers && Array.isArray(parsed.pricingTiers) && parsed.pricingTiers.length > 0) {
            // prefer parsed pricing if current tiers are missing or shorter
            if (!tiers || tiers.length === 0 || parsed.pricingTiers.length >= tiers.length) {
              tiers = [...parsed.pricingTiers];
              if (import.meta.env.DEV) console.debug("Using cached pricingTiers from session for instant UI", tid);
            }
          }
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.debug("Failed to merge cached pricing", err);
    }

    // sort and set synchronously for instant render
    const sorted = tiers.sort((a, b) => a.minutes - b.minutes);
    setSortedTiers(sorted);

    if (sorted.length > 0) {
      setSelectedDuration(prev => prev === null ? sorted[0].minutes : prev);
      if (import.meta.env.DEV) console.debug("PricingModal loaded with tiers:", sorted);
    } else {
      setSortedTiers([{ minutes: 1, price: 39 }]);
      setSelectedDuration(prev => prev === null ? 1 : prev);
      if (import.meta.env.DEV) console.warn("⚠️ No pricing tiers found, using default");
    }
  } catch (e) {
    if (import.meta.env.DEV) console.debug("pricing tiers effect error", e);
  }
}, [teacher]);


  // ✅ Load user data and wallet balance on mount
// ✅ Non-blocking: use cached session + background refresh (instant UI)
useEffect(() => {
  let cancelled = false;

  const loadInitial = async () => {
    try {
      // 1) Try session cached teacher/pricing for instant UI (prefetch from TeacherCard)
      const tid = (teacher?.id || teacher?._id)?.toString();
      if (tid) {
        const cached = sessionStorage.getItem(PREFETCH_KEY(tid));
        if (cached) {
          if (import.meta.env.DEV) console.debug("Using prefetched teacher data", tid);
          // we don't overwrite sortedTiers here to avoid side-effects — sortedTiers is derived from `teacher` prop
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.debug("prefetch read failed", e);
    }

    // 2) Load current user quickly from session, then fetch fresh in background
    try {
      const session = getUserSession?.();
      if (session?.user) {
        setCurrentUser(session.user);
      } else {
        api.getMe()
          .then((res) => { if (!cancelled && res?.success) setCurrentUser(res.user); })
          .catch(() => {});
      }
    } catch (e) {
      if (import.meta.env.DEV) console.debug("getUserSession failed", e);
    }

    // 3) Wallet: use sessionStorage first, then fetch in background
    try {
      const wb = sessionStorage.getItem("walletBalance");
      if (wb) setWalletBalance(Number(wb));
    } catch (e) {}

    (async () => {
      try {
        const walletRes = await api.getWalletBalance();
        if (!cancelled && walletRes?.success) {
          setWalletBalance(walletRes.wallet.availableBalance);
          try { sessionStorage.setItem("walletBalance", String(walletRes.wallet.availableBalance)); } catch(e){}
          if (import.meta.env.DEV) console.debug("Wallet refreshed in background");
        }
      } catch (err) {
        if (import.meta.env.DEV) console.debug("wallet fetch failed", err);
      }
    })();

    // 4) Background refresh: fetch fresh teacher/pricing and update session cache
    if (teacher?.id || teacher?._id) {
      setLoadingTiers(true);
      const tid = (teacher.id || teacher._id).toString();
      (async () => {
        try {
          const baseUrl = import.meta.env.VITE_API_URL || "";
          const res = await fetch(`${baseUrl}/api/users/get?userId=${tid}`, {
  headers: { Authorization: `Bearer ${localStorage.getItem("userToken")}` },
});

          if (!res.ok) {
            setLoadingTiers(false);
            return;
          }
          const json = await res.json();
          if (json?.success && json.user) {
            const small = {
              _id: json.user._id,
              name: json.user.fullName || json.user.name,
              pricingTiers: json.user.pricingTiers || json.user.profile?.pricingTiers || [],
              expertise: json.user.skills?.[0] || json.user.expertise || "",
              rating: json.user.profile?.rating || json.user.rating || 4.8,
            };
            try { sessionStorage.setItem(PREFETCH_KEY(tid), JSON.stringify(small)); } catch(e){}
            if (!cancelled && import.meta.env.DEV) console.debug("Prefetch cache updated for", tid);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.debug("Error fetching teacher details:", err);
        } finally {
          if (!cancelled) setLoadingTiers(false);
        }
      })();
    }
  };

  if (isOpen) loadInitial();

  return () => {
    cancelled = true;
  };
}, [isOpen, teacher]);


  // ✅ Get selected tier details
  const getSelectedTier = () => {
    return sortedTiers.find(t => t.minutes === selectedDuration);
  };

  const selectedPrice = getSelectedTier()?.price || 0;

  // ✅ Extract phone number from user data
  const getUserPhone = () => {
    if (!currentUser) return "9999999999";
    
    return (
      currentUser.phoneNumber || 
      currentUser.phone || 
      currentUser.mobile ||
      currentUser.profile?.phoneNumber ||
      "9999999999"
    );
  };

  // ✅ Handles Razorpay Payment Flow
  const handlePayment = async () => {
    console.log("🎯 Payment button clicked", { 
      selectedDuration, 
      paymentMethod,
      selectedPrice 
    });

    if (!paymentMethod) {
      toast({
        title: "Select Payment Method",
        description: "Please select a payment method to continue",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDuration) {
      toast({
        title: "Select Duration",
        description: "Please choose a duration before continuing.",
        variant: "destructive",
      });
      return;
    }

    const tier = getSelectedTier();
    if (!tier) {
      toast({
        title: "Error",
        description: "Invalid duration selected",
        variant: "destructive",
      });
      return;
    }
   console.log("💳 Initiating payment for:", tier);

// ✅ CLOSE MODAL BEFORE OPENING RAZORPAY
onClose();

try {
  // ✅ NEW: Check wallet balance first
 // ✅ NEW: Respect user's chosen payment method
if (paymentMethod === "wallet") {
  if (walletBalance >= tier.price) {
    console.log("💰 Paying via wallet");
    
    const useWalletRes = await api.useWalletForCall({
      teacherId: teacher.id || teacher._id,
      amount: tier.price,
      duration: tier.minutes,
    });

    if (useWalletRes.success) {
      toast({
        title: "✅ Paid from Wallet",
        description: `₹${tier.price} deducted. Starting your call...`,
      });
      onPaymentComplete({
        teacherId: teacher.id || teacher._id || teacher.name,
        minutes: tier.minutes,
        price: tier.price,
      });
      return; // ✅ Done
    } else {
      toast({
        title: "Wallet Payment Failed",
        description: useWalletRes.message || "Please try Razorpay",
        variant: "destructive",
      });
      return; // ❌ Stop — do NOT automatically open Razorpay
    }
  } else {
    toast({
      title: "Insufficient Wallet Balance",
      description: `You need ₹${tier.price - walletBalance} more to use wallet.`,
      variant: "destructive",
    });
    return;
  }
}

  
  // ✅ Wallet insufficient or failed → use Razorpay
  console.log("💳 Using Razorpay for payment");
  const orderRes = await api.createOrder(tier.price);
  
  if (!orderRes.success || !orderRes.order)
    throw new Error("Order creation failed");

  // (⚙️ KEEP your existing Razorpay options and handler logic here — unchanged)
  const order = orderRes.order;
const userPhone = getUserPhone();
const userName = currentUser?.fullName || currentUser?.name || "User";
const userEmail = currentUser?.email || "user@example.com";

console.log("💳 Payment order created:", {
  minutes: tier.minutes,
  price: tier.price,
  teacher: teacher.name
});

const options = {
  key: import.meta.env.VITE_RAZORPAY_KEY_ID,
  amount: order.amount,
  currency: order.currency,
  name: "ONEVYOU",
  description: `${tier.minutes} minutes with ${teacher.name}`,
  order_id: order.id,

  handler: async function (response: any) {
    try {
      const verifyRes = await api.verifyPayment(response);
      if (verifyRes.success) {
        toast({
          title: "Payment Successful!",
          description: "Starting your video call...",
        });
        onPaymentComplete({
          teacherId: teacher.id || teacher._id || teacher.name,
          minutes: tier.minutes,
          price: tier.price,
        });
      } else {
        toast({
          title: "Payment Verification Failed",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Payment verification error:", err);
      toast({
        title: "Verification Error",
        description: "Could not verify payment",
        variant: "destructive",
      });
    }
  },

  prefill: {
    name: userName,
    email: userEmail,
    contact: userPhone,
  },

  theme: {
    color: "#5a67d8",
    backdrop_color: "rgba(0, 0, 0, 0.5)"
  },

  modal: {
    ondismiss: function () {
      toast({
        title: "Payment Cancelled",
        description: "You can try again anytime",
      });
    },
  },

  retry: { enabled: true, max_count: 3 },

  notes: {
    teacher_id: teacher.id || teacher._id,
    duration: tier.minutes,
    teacher_name: teacher.name
  }
};

const rzp = new (window as any).Razorpay(options);

rzp.on("payment.failed", function (response: any) {
  console.error("Payment failed:", response.error);
  toast({
    title: "Payment Failed",
    description: response.error.description || "Please try again",
    variant: "destructive",
  });
});

rzp.open();


    } catch (err) {
      console.error("❌ Payment Error:", err);
      toast({
        title: "Payment Error",
        description: "Something went wrong while processing payment.",
        variant: "destructive",
      });
    }
  };

  // ✅ Check if button should be enabled
  const isButtonEnabled = selectedDuration !== null && paymentMethod !== "";
  
  if (import.meta.env.DEV) console.debug("🔘 Button state:", { isButtonEnabled, selectedDuration, paymentMethod });
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Connect with {teacher.name}
          </DialogTitle>

          <DialogDescription asChild>
            <div className="mt-2">
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Award className="h-3 w-3" />
                  {teacher.rating} ⭐
                </Badge>
                <Badge className="gap-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  {teacher.expertise}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

{/* ✅ NEW: Show Wallet Balance */}
{walletBalance > 0 && (
  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mx-6 mt-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
          <IndianRupee className="h-4 w-4" />
          Wallet Balance: ₹{walletBalance}
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
          {walletBalance >= selectedPrice 
            ? "✓ You can pay from your wallet!" 
            : `Need ₹${selectedPrice - walletBalance} more to use wallet`}
        </p>
      </div>
      {walletBalance >= selectedPrice && (
        <Badge className="bg-green-600 text-white">
          Available
        </Badge>
      )}
    </div>
  </div>
)}

{/* ✅ Scrollable content area */}
<div className="flex-1 overflow-y-auto px-1">
          {/* Live indicator */}

          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-2.5 flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
            <p className="text-xs font-medium">
              🔥 {Math.floor(Math.random() * 20) + 5} students learning with {teacher.name} right now!
            </p>
          </div>

          {/* Duration Selection - Compact */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select Duration
            </Label>
            
            <div className="grid grid-cols-2 gap-2">
              {sortedTiers.map((tier, index) => {
                const isSelected = selectedDuration === tier.minutes;
                const isPopular = index === Math.floor(sortedTiers.length / 2);
                
                return (
                  <Button
                    key={tier.minutes}
                    variant={isSelected ? "default" : "outline"}
                    className={`relative h-auto flex-col py-2.5 transition-all ${
                      isPopular ? "ring-2 ring-primary shadow-md" : ""
                    } ${isSelected ? "scale-105" : "hover:scale-102"}`}
                    onClick={() => {
                      setSelectedDuration(tier.minutes);
                      console.log("✅ Selected duration:", tier.minutes);
                    }}
                  >
                    {isPopular && (
                      <Badge className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] border-0 px-1.5 py-0.5">
                        Popular
                      </Badge>
                    )}
                    
                    <div className="flex items-center gap-0.5 text-lg font-bold mb-0.5">
                      <IndianRupee className="h-4 w-4" />
                      {tier.price}
                    </div>
                    
                    <span className="text-xs opacity-80">
                      {tier.minutes} min{tier.minutes > 1 ? 's' : ''}
                    </span>
                    
                    {isSelected && (
                      <Badge className="mt-1.5 bg-green-500 text-white text-[10px] px-1.5 py-0.5">
                        Selected ✓
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>

            {sortedTiers.length === 0 && (
              <div className="text-center text-muted-foreground py-3 text-sm">
                No pricing options available
              </div>
            )}

            {/* Payment Methods - Compact */}
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === "upi" ? "default" : "outline"}
                  className="flex-col h-auto py-2.5"
                  onClick={() => {
                    setPaymentMethod("upi");
                    console.log("✅ Selected payment: UPI");
                  }}
                >
                  <Smartphone className="h-4 w-4 mb-0.5" />
                  <span className="text-xs">UPI</span>
                </Button>

                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  className="flex-col h-auto py-2.5"
                  onClick={() => {
                    setPaymentMethod("card");
                    console.log("✅ Selected payment: Card");
                  }}
                >
                  <CreditCard className="h-4 w-4 mb-0.5" />
                  <span className="text-xs">Card</span>
                </Button>

                <Button
                  variant={paymentMethod === "wallet" ? "default" : "outline"}
                  className="flex-col h-auto py-2.5"
                  onClick={() => {
                    setPaymentMethod("wallet");
                    console.log("✅ Selected payment: Wallet");
                  }}
                >
                  <IndianRupee className="h-4 w-4 mb-0.5" />
                  <span className="text-xs">Wallet</span>
                </Button>
              </div>
            </div>

            {/* Total Amount - Compact */}
            {selectedDuration && (
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-3 border border-primary/20 mt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedDuration} minute{selectedDuration > 1 ? 's' : ''} session
                    </p>
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    {selectedPrice}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ Fixed footer */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 disabled:opacity-50"
            onClick={handlePayment}
            disabled={!isButtonEnabled}
          >
            <Video className="mr-2 h-4 w-4" />
            Start Learning Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;