import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, MessageCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "https://onevyou.onrender.com";

const ForgotPassword: React.FC = () => {
  const [identifier, setIdentifier] = useState(""); // email or phone
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSendOtp = async () => {
    if (!identifier.trim()) {
      toast({ title: "Missing info", description: "Enter email or phone", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSent(true);
        toast({ title: "OTP Sent", description: "Check your WhatsApp or Email" });
      } else {
        toast({ title: "Failed", description: data.message || "Could not send OTP", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Network Error", description: "Server not reachable", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword) {
      toast({ title: "Missing info", description: "Enter OTP and new password", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp, newPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast({ title: "Password Reset", description: "You can now log in with your new password" });
        // ✅ FIXED: Navigate to /auth instead of /login
        navigate("/auth");
      } else {
        toast({ title: "Failed", description: data.message || "Invalid OTP", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Server error", description: "Try again later", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 p-4 relative">
      {/* Background sparkles */}
      <div className="absolute top-20 left-20 animate-pulse">
        <Sparkles className="h-8 w-8 text-primary/40" />
      </div>
      <div className="absolute bottom-20 right-20 animate-pulse delay-150">
        <MessageCircle className="h-10 w-10 text-accent/40" />
      </div>

      <Card className="w-full max-w-md p-8 shadow-2xl bg-card/90 backdrop-blur relative z-10 border-primary/10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Forgot Password
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Reset your password securely using OTP verification
          </p>
        </div>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email or Phone</Label>
              <Input
                type="text"
                placeholder="Enter your registered email or phone"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>

            <p className="text-center text-sm mt-2 text-muted-foreground">
              Remembered your password?{" "}
              <span
                onClick={() => navigate("/auth")}
                className="text-primary hover:underline cursor-pointer"
              >
                Back to Login
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>OTP</Label>
              <Input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <Button onClick={handleResetPassword} className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;