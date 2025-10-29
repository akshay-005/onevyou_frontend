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

  // ✅ Load and sort pricing tiers whenever teacher changes
  useEffect(() => {
    if (teacher?.pricingTiers && Array.isArray(teacher.pricingTiers)) {
      const sorted = [...teacher.pricingTiers].sort((a, b) => a.minutes - b.minutes);
      setSortedTiers(sorted);
      
      console.log("💰 PricingModal loaded with tiers:", sorted);
      
      // Auto-select first tier (usually 1 minute)
      if (sorted.length > 0 && !selectedDuration) {
        setSelectedDuration(sorted[0].minutes);
      }
    } else {
      console.warn("⚠️ No pricing tiers found, using default");
      setSortedTiers([{ minutes: 1, price: 39 }]);
      setSelectedDuration(1);
    }
  }, [teacher]);

  // ✅ Load user data on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { user } = getUserSession();
        
        if (user) {
          setCurrentUser(user);
        } else {
          const response = await api.getMe();
          if (response?.success && response?.user) {
            setCurrentUser(response.user);
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

    // ✅ CLOSE MODAL BEFORE OPENING RAZORPAY
    onClose();

    try {
      const orderRes = await api.createOrder(tier.price);
      if (!orderRes.success || !orderRes.order)
        throw new Error("Order creation failed");
      
      const order = orderRes.order;
      const userPhone = getUserPhone();
      const userName = currentUser?.fullName || currentUser?.name || "User";
      const userEmail = currentUser?.email || "user@example.com";

      console.log("💳 Payment initiated:", {
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
        
        config: {
          display: {
            blocks: {
              banks: {
                name: 'Pay via UPI',
                instruments: [{ method: 'upi' }]
              }
            },
            sequence: ['block.banks'],
            preferences: { show_default_blocks: true }
          }
        },
        
        theme: { 
          color: "#5a67d8",
          backdrop_color: "rgba(0, 0, 0, 0.5)"
        },
        
        modal: {
          backdropclose: false,
          escape: true,
          handleback: true,
          confirm_close: true,
          ondismiss: function() {
            toast({
              title: "Payment Cancelled",
              description: "You can try again anytime",
            });
          },
          animation: true
        },
        
        retry: { enabled: true, max_count: 3 },
        
        notes: {
          teacher_id: teacher.id || teacher._id,
          duration: tier.minutes,
          teacher_name: teacher.name
        }
      };

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg backdrop-blur-lg bg-card/95 border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Connect with {teacher.name}
          </DialogTitle>

          <DialogDescription asChild>
            <div className="mt-2">
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="secondary" className="gap-1">
                  <Award className="h-3 w-3" />
                  {teacher.rating} ⭐
                </Badge>
                <Badge className="gap-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
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

        {/* Duration Selection - Show ALL Tiers */}
        <div className="space-y-4 py-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Select Duration
          </Label>
          
          <div className="grid grid-cols-2 gap-3">
            {sortedTiers.map((tier, index) => {
              const isSelected = selectedDuration === tier.minutes;
              const isPopular = index === Math.floor(sortedTiers.length / 2);
              
              return (
                <Button
                  key={tier.minutes}
                  variant={isSelected ? "default" : "outline"}
                  className={`relative h-auto flex-col py-4 transition-all ${
                    isPopular ? "ring-2 ring-primary shadow-lg" : ""
                  } ${isSelected ? "scale-105" : ""}`}
                  onClick={() => setSelectedDuration(tier.minutes)}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs border-0 px-2 py-0.5">
                      Popular
                    </Badge>
                  )}
                  
                  <div className="flex items-center gap-1 text-xl font-bold mb-1">
                    <IndianRupee className="h-5 w-5" />
                    {tier.price}
                  </div>
                  
                  <span className="text-sm opacity-80">
                    {tier.minutes} minute{tier.minutes > 1 ? 's' : ''}
                  </span>
                  
                  {isSelected && (
                    <Badge className="mt-2 bg-green-500 text-white text-xs">
                      Selected ✓
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {sortedTiers.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No pricing options available
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-3 pt-4 border-t">
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

          {/* Total Amount */}
          {selectedDuration && (
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedDuration} minute{selectedDuration > 1 ? 's' : ''} session
                  </p>
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center">
                  <IndianRupee className="h-6 w-6" />
                  {selectedPrice}
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
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90"
            onClick={handlePayment}
            disabled={!selectedDuration || !paymentMethod}
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