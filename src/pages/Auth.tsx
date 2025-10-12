import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Chrome, Sparkles } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";

type AuthMethod = "email" | "phone";
type UserType = "fan" | "creator";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [otpSent, setOtpSent] = useState(false);
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

  // ✅ All endpoints under /api/auth
  const ENDPOINT = {
    sendOtp: `${API_BASE}/api/auth/send-otp`,
    verifyOtp: `${API_BASE}/api/auth/verify-otp`,
    checkUser: `${API_BASE}/api/auth/check-user`,
    register: `${API_BASE}/api/auth/register`,
    login: `${API_BASE}/api/auth/login`,
    googleAuth: `${API_BASE}/api/auth/google`,
  };

  useEffect(() => {
    if ((location as any).state?.userType) {
      setUserType((location as any).state.userType);
    }
  }, [location]);

  const connectSocket = (token: string) => {
    const socket: Socket = io(API_BASE, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.on("connect", () => console.log("Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("Socket disconnected"));
    (window as any).socket = socket;
  };

  const checkUserExists = async (identifier: string) => {
    try {
      const res = await fetch(ENDPOINT.checkUser, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      return data.exists === true;
    } catch {
      return false;
    }
  };

  const handleSendOTP = async () => {
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Enter your full name", variant: "destructive" });
      return;
    }
    if (authMethod === "phone" && phoneNumber.trim().length < 6) {
      toast({ title: "Invalid phone", description: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    if (authMethod === "email" && !email.includes("@")) {
      toast({ title: "Invalid email", description: "Enter a valid email", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const identifier =
        authMethod === "phone"
          ? (phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`)
          : email;

      const exists = await checkUserExists(identifier);
      if (exists) {
        toast({ title: "Account exists", description: "Login instead.", variant: "destructive" });
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
        toast({ title: "OTP Sent", description: `OTP sent to ${authMethod}.` });
      } else {
        toast({ title: "Failed to send OTP", description: data.message || "Try again later", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach server", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      toast({ title: "Accept Terms", description: "Please agree to continue", variant: "destructive" });
      return;
    }
    if (!password || password.length < 6) {
      toast({ title: "Weak password", description: "Use at least 6 characters", variant: "destructive" });
      return;
    }
    if (!otpSent) {
      toast({ title: "OTP required", description: "Send OTP first", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const identifier =
        authMethod === "phone"
          ? (phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`)
          : email;

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

      const payload: any = {
        fullName,
        password,
        roles: [userType],
        verified: true,
        authMethod,
      };
      if (authMethod === "phone") payload.phoneNumber = identifier;
      if (authMethod === "email") payload.email = identifier;

      const rres = await fetch(ENDPOINT.register, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const rdata = await rres.json();

      if (rres.ok && rdata.success) {
        localStorage.setItem("userToken", rdata.token);
        localStorage.setItem("userData", JSON.stringify(rdata.user));
        connectSocket(rdata.token);
        toast({ title: "Welcome!", description: "Account created successfully." });
        navigate("/profile-setup");
      } else {
        toast({ title: "Registration failed", description: rdata.message || "Try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Signup error", description: "Server error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const identifier =
        authMethod === "phone"
          ? (phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`)
          : email;

      const res = await fetch(ENDPOINT.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("userToken", data.token);
        localStorage.setItem("userData", JSON.stringify(data.user));
        connectSocket(data.token);
        toast({ title: "Logged in", description: `Welcome back, ${data.user.fullName}` });
        navigate(data.user.profileComplete ? "/dashboard" : "/profile-setup");
      } else {
        toast({ title: "Login failed", description: data.message || "Invalid credentials", variant: "destructive" });
      }
    } catch {
      toast({ title: "Login error", description: "Server not reachable", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => (window.location.href = ENDPOINT.googleAuth);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        <div className="text-center mb-6">
          <Sparkles className="h-8 w-8 mx-auto text-primary mb-2" />
          <h1 className="text-3xl font-bold">ONEVYOU</h1>
          <p className="text-sm text-muted-foreground">Connect with anyone, earn together</p>
        </div>

        {/* ✅ Restored Tabs Section */}
        <Tabs defaultValue="signup">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          {/* LOGIN */}
          <TabsContent value="login" className="mt-6 space-y-4">
            <div className="flex gap-2">
              <Button variant={authMethod === "phone" ? "default" : "outline"} onClick={() => setAuthMethod("phone")}>Phone</Button>
              <Button variant={authMethod === "email" ? "default" : "outline"} onClick={() => setAuthMethod("email")}>Email</Button>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              {authMethod === "phone" ? (
                <Input placeholder="+91 98765 43210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              ) : (
                <Input placeholder="you@domain.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}

              <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Logging..." : "Login"}</Button>
            </form>

            <Button variant="outline" onClick={handleGoogleSignIn} className="w-full">
              <Chrome className="mr-2" /> Sign in with Google
            </Button>
          </TabsContent>

          {/* SIGNUP */}
          <TabsContent value="signup" className="mt-6 space-y-4">
            <div>
              <Label>Join as</Label>
              <RadioGroup value={userType} onValueChange={(val) => setUserType(val as UserType)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2 p-2 border rounded">
                  <RadioGroupItem value="fan" id="fan" />
                  <Label htmlFor="fan">Fan</Label>
                </div>
                <div className="flex items-center gap-2 p-2 border rounded">
                  <RadioGroupItem value="creator" id="creator" />
                  <Label htmlFor="creator">Creator</Label>
                </div>
              </RadioGroup>
            </div>

            <form id="signup-form" onSubmit={handleSignup} className="space-y-3">
              <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              {authMethod === "phone" ? (
                <Input placeholder="+91 98765 43210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              ) : (
                <Input placeholder="you@domain.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}
              <Input placeholder="Password (min 6 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

              {!otpSent ? (
                <Button type="button" onClick={handleSendOTP} className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send OTP"}
                </Button>
              ) : (
                <Input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
              )}

              <div className="flex items-center gap-2">
                <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(c) => setAgreedToTerms(c as boolean)} />
                <Label className="text-sm">I agree to <Link to="/terms">Terms</Link> & <Link to="/privacy">Privacy</Link></Label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !otpSent}>
                {isLoading ? "Processing..." : "Create Account"}
              </Button>
            </form>

            <Button variant="outline" onClick={handleGoogleSignIn} className="w-full">
              <Chrome className="mr-2" /> Sign up with Google
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
