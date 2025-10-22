// Auth.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  User,
  Phone,
  Chrome,
  Apple,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { storeUserSession } from "@/utils/storage";


type AuthMethod = "email" | "phone";
type UserType = "fan" | "creator";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [otpSent, setOtpSent] = useState(false);

  // User fields
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<UserType>("fan");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

  // endpoints
  const ENDPOINT = {
    sendOtp: `${API_BASE}/api/auth/send-otp`,
    verifyOtp: `${API_BASE}/api/auth/verify-otp`,
    checkUser: `${API_BASE}/api/auth/check-user`,
    register: `${API_BASE}/api/auth/register`,
    login: `${API_BASE}/api/auth/login`,
    googleAuth: `${API_BASE}/api/auth/google`,
  };

  useEffect(() => {
    // preserve the behavior in your original file: set userType from location.state if provided
    if ((location as any).state?.userType) {
      setUserType((location as any).state.userType);
    }
  }, [location]);

  const connectSocket = (token: string) => {
    try {
      const socket: Socket = io(API_BASE, {
        auth: { token },
        transports: ["websocket"],
      });
      socket.on("connect", () => console.log("Socket connected:", socket.id));
      socket.on("disconnect", () => console.log("Socket disconnected"));
      (window as any).socket = socket;
    } catch (err) {
      console.warn("Socket connect failed", err);
    }
  };

  const checkUserExists = async (identifier: string) => {
  try {
    // Detect whether the identifier is email or phone
    const payload = identifier.includes("@")
      ? { email: identifier }
      : { phoneNumber: identifier };

    const res = await fetch(ENDPOINT.checkUser, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // ✅ correct key now
    });

    const data = await res.json();
    console.log("checkUser response:", data);
    return data.exists === true;
  } catch (err) {
    console.warn("checkUserExists error", err);
    return false;
  }
};


  // SEND OTP used only for phone-based signup/login flows (keeps same backend contract)
  const handleSendOTP = async () => {
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Enter your full name", variant: "destructive" });
      return;
    }
    if (phoneNumber.trim().length < 6) {
      toast({ title: "Invalid phone", description: "Enter a valid phone number", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const identifier = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;

      const exists = await checkUserExists(identifier);
      if (exists) {
        toast({ title: "Account exists", description: "Use login instead.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const res = await fetch(ENDPOINT.sendOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: identifier, userName: fullName }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        toast({ title: "OTP Sent", description: `OTP sent to ${identifier}.` });
      } else {
        toast({ title: "Failed to send OTP", description: data.message || "Try again later", variant: "destructive" });
      }
    } catch (err) {
      console.error("sendOtp error", err);
      toast({ title: "Network error", description: "Could not reach server", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // SIGNUP flow: email signup uses password directly; phone signup uses OTP verification first then register
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      toast({ title: "Accept Terms", description: "Please agree to continue", variant: "destructive" });
      return;
    }

    // Email signup (no OTP required)
    if (authMethod === "email") {
      if (!fullName.trim()) {
        toast({ title: "Name required", description: "Enter your full name", variant: "destructive" });
        return;
      }
      if (!email.includes("@")) {
        toast({ title: "Invalid email", description: "Enter a valid email", variant: "destructive" });
        return;
      }
      if (!password || password.length < 6) {
        toast({ title: "Weak password", description: "Use at least 6 characters", variant: "destructive" });
        return;
      }

      setIsLoading(true);
      try {
        const payload: any = {
          fullName,
          password,
          email,
          roles: [userType],
          verified: true, // email flow we mark verified if backend doesn't require verification
          authMethod: "email",
        };
        const rres = await fetch(ENDPOINT.register, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const rdata = await rres.json();
        if (rres.ok && rdata.success) {
          storeUserSession(rdata.user, rdata.token);

          connectSocket(rdata.token);
          toast({ title: "Welcome!", description: "Account created successfully." });
          navigate("/profile-setup");
        } else {
          toast({ title: "Registration failed", description: rdata.message || "Try again", variant: "destructive" });
        }
      } catch (err) {
        console.error("email signup error", err);
        toast({ title: "Signup error", description: "Server error", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // Phone signup: verify OTP first, then register
    if (authMethod === "phone") {
      if (!otpSent) {
        toast({ title: "OTP required", description: "Send OTP first", variant: "destructive" });
        return;
      }
      if (!otp || otp.length < 4) {
        toast({ title: "Invalid OTP", description: "Enter the OTP", variant: "destructive" });
        return;
      }
      if (!password || password.length < 6) {
        toast({ title: "Weak password", description: "Use at least 6 characters", variant: "destructive" });
        return;
      }

      setIsLoading(true);
      try {
        const identifier = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;

        // Verify OTP
        const vres = await fetch(ENDPOINT.verifyOtp, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: identifier, otp }),
        });
        const vdata = await vres.json();
        if (!vres.ok || !vdata.valid) {
          toast({ title: "Invalid OTP", description: vdata.message || "Please check code", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        // Register
        const payload: any = {
          fullName,
          password,
          roles: [userType],
          verified: true,
          authMethod: "phone",
          phoneNumber: identifier,
        };

        const rres = await fetch(ENDPOINT.register, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const rdata = await rres.json();

        if (rres.ok && rdata.success) {
  storeUserSession(rdata.user, rdata.token);
  connectSocket(rdata.token);
  toast({ title: "Welcome!", description: "Account created successfully." });
  navigate("/profile-setup");
}

         else {
          toast({ title: "Registration failed", description: rdata.message || "Try again", variant: "destructive" });
        }
      } catch (err) {
        console.error("phone signup error", err);
        toast({ title: "Signup error", description: "Server error", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // LOGIN: uses identifier (phone or email) + password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const identifier = authMethod === "phone" ? (phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`) : email;

      if (!identifier) {
        toast({ title: "Missing identifier", description: "Enter email or phone", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!password) {
        toast({ title: "Missing password", description: "Enter password", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const res = await fetch(ENDPOINT.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
  storeUserSession(data.user, data.token);  // ✅ simplified helper
  connectSocket(data.token);
  toast({ title: "Logged in", description: `Welcome back, ${data.user.fullName}` });
  navigate(data.user.profileComplete ? "/dashboard" : "/profile-setup");

      } else {
        toast({ title: "Login failed", description: data.message || "Invalid credentials", variant: "destructive" });
      }
    } catch (err) {
      console.error("login error", err);
      toast({ title: "Login error", description: "Server not reachable", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => (window.location.href = ENDPOINT.googleAuth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

      {/* Decorative floating icons */}
      <div className="absolute top-20 left-20 animate-pulse">
        <Sparkles className="h-8 w-8 text-primary/40" />
      </div>
      <div className="absolute bottom-20 right-20 animate-pulse delay-150">
        <MessageCircle className="h-10 w-10 text-accent/40" />
      </div>

      <Card className="w-full max-w-md backdrop-blur-lg bg-card/90 border-primary/20 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl" />
        <div className="p-8 relative">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-2xl animate-pulse">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
              ONEVYOU
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Learn from the best, 1-on-1 video calls 📚✨
            </p>
          </div>

          <Tabs defaultValue="signup" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login" className="space-y-4 mt-6">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={authMethod === "phone" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("phone")}
                  className="flex-1"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Phone
                </Button>
                <Button
                  variant={authMethod === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("email")}
                  className="flex-1"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {authMethod === "phone" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="login-phone">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          className="pl-10"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="your@email.com"
                          className="pl-10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password-email">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password-email"
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </>
                )}
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleGoogleSignIn} className="hover:scale-105 transition-transform">
                  <Chrome className="mr-2 h-4 w-4" />
                  Google
                </Button>
                <Button variant="outline" onClick={() => toast({ title: "Apple Sign in", description: "Not wired up yet" })} className="hover:scale-105 transition-transform">
                  <Apple className="mr-2 h-4 w-4" />
                  Apple
                </Button>
              </div>
            </TabsContent>

            {/* SIGNUP */}
            <TabsContent value="signup" className="space-y-4 mt-6">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={authMethod === "phone" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("phone")}
                  className="flex-1"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Phone
                </Button>
                <Button
                  variant={authMethod === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthMethod("email")}
                  className="flex-1"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>

              <form id="signup-form" onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      className="pl-10"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {authMethod === "phone" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          className="pl-10"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {!otpSent ? (
                      <Button type="button" onClick={handleSendOTP} className="w-full" variant="accent" disabled={isLoading}>
                        {isLoading ? "Sending..." : "Send OTP"}
                      </Button>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="signup-otp">Enter OTP</Label>
                          <Input
                            id="signup-otp"
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            className="pl-3"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-password-phone">Create Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="signup-password-phone"
                              type="password"
                              placeholder="Create a password"
                              className="pl-10"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="your@email.com"
                          className="pl-10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Create a password"
                          className="pl-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-start space-x-2 py-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline" target="_blank">
                      Terms & Conditions
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  variant="accent"
                  disabled={
                    isLoading ||
                    (authMethod === "phone" && !otpSent) // require sending OTP first for phone signup
                  }
                >
                  {isLoading
                    ? "Processing..."
                    : authMethod === "phone"
                    ? otpSent
                      ? "Create account"
                      : "Send OTP First"
                    : "Sign Up"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleGoogleSignIn} className="hover:scale-105 transition-transform">
                  <Chrome className="mr-2 h-4 w-4" />
                  Google
                </Button>
                <Button variant="outline" onClick={() => toast({ title: "Apple Sign in", description: "Not wired up yet" })} className="hover:scale-105 transition-transform">
                  <Apple className="mr-2 h-4 w-4" />
                  Apple
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
