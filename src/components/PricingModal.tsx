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
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  IndianRupee,
  CreditCard,
  Smartphone,
  Award,
  TrendingUp,
  Sparkles,
  Video,
} from "lucide-react";

// ✅ Import helpers
import api from "@/utils/api";
import { getUserSession } from "@/utils/storage";

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
  const [selectedDuration, setSelectedDuration] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  // ✅ Store current user data
  const [currentUser, setCurrentUser] = useState<any>(null);

  const sortedTiers = [...teacher.pricingTiers].sort(
    (a, b) => a.minutes - b.minutes
  );

  const durations = sortedTiers.map((tier, index) => ({
    value: `${tier.minutes}`,
    label: `${tier.minutes} minute${tier.minutes > 1 ? "s" : ""}`,
    price: tier.price,
    popular: index === Math.floor(sortedTiers.length / 2),
  }));

  durations.push({
    value: "custom",
    label: "Custom duration",
    price: 0,
    popular: false,
  });

  // ✅ Load user data on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { user } = getUserSession();
        
        if (user) {
          setCurrentUser(user);
          console.log("✅ Loaded user from localStorage:", user);
        } else {
          const response = await api.getMe();
          if (response?.success && response?.user) {
            setCurrentUser(response.user);
            console.log("✅ Fetched user from API:", response.user);
          }
        }
      } catch (err) {
        console.error("❌ Error loading user:", err);
      }
    };

    if (isOpen) {
      loadUser();
    }
  }, [isOpen]);

  useEffect(() => {
    const popularOption = durations.find((d) => d.popular);
    if (popularOption) setSelectedDuration(popularOption.value);
  }, []);

  const getPrice = () => {
    if (selectedDuration === "custom" && customMinutes) {
      const minutes = parseInt(customMinutes);
      const baseTier =
        sortedTiers.find((tier) => tier.minutes >= minutes) ||
        sortedTiers[sortedTiers.length - 1];
      const pricePerMinute = baseTier.price / baseTier.minutes;
      return Math.max(39, Math.round(pricePerMinute * minutes));
    }
    const duration = durations.find((d) => d.value === selectedDuration);
    return duration?.price || 0;
  };

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
    if (!paymentMethod) {
      toast({
        title: "Select Payment Method",
        description: "Please select a payment method to continue",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDuration && !customMinutes) {
      toast({
        title: "Select Duration",
        description: "Please choose or enter a duration before continuing.",
        variant: "destructive",
      });
      return;
    }

    const minutes =
      selectedDuration === "custom"
        ? parseInt(customMinutes)
        : parseInt(selectedDuration);
    const price = getPrice();

    // ✅ CLOSE YOUR MODAL BEFORE OPENING RAZORPAY
    onClose();

    try {
      // 🔹 1️⃣ Create order in backend
      const orderRes = await api.createOrder(price);
      if (!orderRes.success || !orderRes.order)
        throw new Error("Order creation failed");
      const order = orderRes.order;

      // ✅ Extract user data for prefill
      const userPhone = getUserPhone();
      const userName = currentUser?.fullName || currentUser?.name || "User";
      const userEmail = currentUser?.email || "user@example.com";

      console.log("💳 Payment prefill data:", {
        name: userName,
        email: userEmail,
        phone: userPhone,
        amount: price,
      });

      // 🔹 2️⃣ Prepare Razorpay checkout options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "ONEVYOU",
        description: `${minutes} minutes with ${teacher.name}`,
        order_id: order.id,
        
        // 🧠 This runs automatically when payment succeeds
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
                minutes,
                price,
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

        // ✅ Real user data
        prefill: {
          name: userName,
          email: userEmail,
          contact: userPhone,
        },
        
        // ✅ Payment method preferences (UPI first)
        config: {
          display: {
            blocks: {
              banks: {
                name: 'Pay via UPI',
                instruments: [
                  {
                    method: 'upi'
                  }
                ]
              }
            },
            sequence: ['block.banks'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        
        theme: { 
          color: "#5a67d8",
          backdrop_color: "rgba(0, 0, 0, 0.5)"
        },
        
        // ✅ Modal customization
        modal: {
          backdropclose: false,
          escape: true,
          handleback: true,
          confirm_close: true,
          ondismiss: function() {
            console.log("Payment modal closed by user");
            toast({
              title: "Payment Cancelled",
              description: "You can try again anytime",
            });
          },
          animation: true
        },
        
        // ✅ Retry on failure
        retry: {
          enabled: true,
          max_count: 3
        },
        
        // ✅ Optional: Add notes for tracking
        notes: {
          teacher_id: teacher.id || teacher._id,
          duration: minutes,
          teacher_name: teacher.name
        }
      };

      // 🔹 3️⃣ Open Razorpay widget with proper error handling
      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
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

  const totalAmount = getPrice();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg backdrop-blur-lg bg-card/95 border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-flow bg-clip-text text-transparent">
            Connect with {teacher.name}
          </DialogTitle>

          <DialogDescription asChild>
            <div className="mt-2">
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="secondary" className="gap-1">
                  <Award className="h-3 w-3" />
                  {teacher.rating} ⭐
                </Badge>
                <Badge className="gap-1 bg-gradient-flow text-white border-0">
                  <TrendingUp className="h-3 w-3" />
                  {teacher.expertise}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Live indicator */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-sm font-medium">
            🔥 {Math.floor(Math.random() * 20) + 5} students learning with{" "}
            {teacher.name} right now!
          </p>
        </div>

        {/* Duration Selection */}
        <div className="space-y-4 py-4">
          <Label className="text-base font-semibold">Select Duration</Label>
          <div className="grid grid-cols-2 gap-2">
            {durations
              .filter((d) => d.value !== "custom")
              .map((duration) => (
                <Button
                  key={duration.value}
                  variant={
                    selectedDuration === duration.value ? "default" : "outline"
                  }
                  className={`relative h-auto flex-col py-3 ${
                    duration.popular ? "ring-2 ring-primary shadow-md" : ""
                  }`}
                  onClick={() => setSelectedDuration(duration.value)}
                >
                  {duration.popular && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-flow text-white text-xs border-0 px-2 py-0.5">
                      Popular
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-lg font-bold">
                    <IndianRupee className="h-4 w-4" />
                    {duration.price}
                  </div>
                  <span className="text-xs opacity-80">{duration.label}</span>
                </Button>
              ))}
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentMethod === "upi" ? "default" : "outline"}
                className="flex-col h-auto py-3"
                onClick={() => setPaymentMethod("upi")}
              >
                <Smartphone className="h-5 w-5 mb-1" />
                <span className="text-xs">UPI</span>
              </Button>

              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                className="flex-col h-auto py-3"
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="h-5 w-5 mb-1" />
                <span className="text-xs">Card</span>
              </Button>

              <Button
                variant={paymentMethod === "wallet" ? "default" : "outline"}
                className="flex-col h-auto py-3"
                onClick={() => setPaymentMethod("wallet")}
              >
                <IndianRupee className="h-5 w-5 mb-1" />
                <span className="text-xs">Wallet</span>
              </Button>
            </div>
          </div>

          {/* Total */}
          {(selectedDuration || customMinutes) && (
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold bg-gradient-flow bg-clip-text text-transparent flex items-center">
                  <IndianRupee className="h-5 w-5" />
                  {totalAmount}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-flow hover:opacity-90"
            onClick={handlePayment}
            disabled={
              (!selectedDuration ||
                (selectedDuration === "custom" && !customMinutes)) ||
              !paymentMethod
            }
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