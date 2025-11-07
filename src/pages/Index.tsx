import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, Users, Clock, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const handleJoinAsFan = () => {
    navigate("/auth", { state: { userType: "fan" } });
  };

  const handleJoinAsCreator = () => {
    navigate("/auth", { state: { userType: "creator" } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <img src="/onevyou-uploads/82f7aa72-94f9-46fe-ab17-75a566659dbd.png" alt="ONEVYOU" className="h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ONEVYOU</h2>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Learn from Experts, One-on-One
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Connect instantly with skilled professionals for personalized video learning sessions. Pay per minute, learn at your pace.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              variant="default"
              onClick={handleJoinAsFan}
              className="text-lg px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              Get Started 💖
            </Button>
            {/*<Button 
              size="lg" 
              variant="accent"
              onClick={handleJoinAsCreator}
              className="text-lg px-8"
            >
              Join as a Celebrity ⭐️
            </Button>*/}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
              <Video className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Live Video Calls</h3>
            <p className="text-muted-foreground">
              High-quality 1-on-1 video sessions with instant connection
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-accent flex items-center justify-center">
              <Clock className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Pay Per Minute</h3>
            <p className="text-muted-foreground">
              Flexible pricing - only pay for the time you use
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Expert Teachers</h3>
            <p className="text-muted-foreground">
              Learn from verified professionals in various fields
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-accent flex items-center justify-center">
              <Shield className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Secure & Safe</h3>
            <p className="text-muted-foreground">
              Verified users and secure payment processing
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-4 py-16 bg-card/50 rounded-lg">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold text-lg mb-2">Choose Your Role</h3>
            <p className="text-muted-foreground">
              Sign up as a learner to find experts, or as a teacher to share your skills
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold text-lg mb-2">Connect Instantly</h3>
            <p className="text-muted-foreground">
              Browse available teachers or wait for learners to connect with you
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold text-lg mb-2">Start Learning</h3>
            <p className="text-muted-foreground">
              Enjoy personalized video sessions and pay only for the time used
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;