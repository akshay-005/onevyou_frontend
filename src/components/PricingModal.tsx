import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  IndianRupee,
  Clock,
  CreditCard,
  Smartphone,
  Award,
  TrendingUp,
  Sparkles,
  Video,
} from "lucide-react";

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

  // Sort pricing tiers by minutes
  const sortedTiers = [...teacher.pricingTiers].sort(
    (a, b) => a.minutes - b.minutes
  );

  // Format durations for display
  const durations = sortedTiers.map((tier, index) => ({
    value: `${tier.minutes}`,
    label: `${tier.minutes} minute${tier.minutes > 1 ? "s" : ""}`,
    price: tier.price,
    popular: index === Math.floor(sortedTiers.length / 2),
  }));

  // Add custom option
  durations.push({
    value: "custom",
    label: "Custom duration",
    price: 0,
    popular: false,
  });

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

  const handlePayment = () => {
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

    toast({
      title: "Processing Payment",
      description: `Connecting you with ${teacher.name}...`,
    });

    setTimeout(() => {
      toast({
        title: "Payment Successful!",
        description: "Starting your video call...",
      });

      const minutes =
        selectedDuration === "custom"
          ? parseInt(customMinutes)
          : parseInt(selectedDuration);
      const price = getPrice();

      onPaymentComplete({
        teacherId: teacher.id || teacher._id || teacher.name,
        minutes,
        price,
      });

      onClose();
    }, 2000);
  };

  const totalAmount = getPrice();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg backdrop-blur-lg bg-card/95 border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-flow bg-clip-text text-transparent">
            Connect with {teacher.name}
          </DialogTitle>

          {/* ✅ FIXED: Proper wrapping for badges */}
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

        <div className="space-y-4 py-4">
          <Label className="text-base font-semibold">Select Duration</Label>

          {/* Duration Buttons */}
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

          {/*Custom Duration */}
          {/*<Card
            className={`p-3 cursor-pointer transition-all ${
              selectedDuration === "custom" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedDuration("custom")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroup
                value={selectedDuration}
                onValueChange={setSelectedDuration}
              >
                <RadioGroupItem value="custom" id="custom" />
              </RadioGroup>
              <Label htmlFor="custom" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Custom duration
                  </span>
                  {selectedDuration === "custom" && customMinutes && (
                    <span className="font-bold text-lg flex items-center">
                      <IndianRupee className="h-4 w-4" />
                      {getPrice()}
                    </span>
                  )}
                </div>
              </Label>
            </div>
            {selectedDuration === "custom" && (
              <div className="mt-3">
                <Input
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Enter minutes"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </Card> */}

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

          {/* Total Amount */}
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
