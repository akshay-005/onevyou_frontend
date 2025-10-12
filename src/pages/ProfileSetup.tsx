import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Instagram, Facebook, Youtube, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    expertise: "",
    ratePerMinute: "39",
    instagram: "",
    facebook: "",
    youtube: "",
    otherProfile: "",
  });

  const API_BASE = import.meta.env.VITE_API_URL || "http://10.138.22.170:3001";

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    const userData = localStorage.getItem("userData");
    
    if (!token || !userData) {
      navigate("/auth");
      return;
    }

    // Pre-fill name from userData
    const user = JSON.parse(userData);
    if (user.fullName) {
      setProfile(prev => ({ ...prev, name: user.fullName }));
    }

    // Check if profile already completed
    const checkProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && data.profile?.bio) {
          // Profile already completed, go to dashboard
          console.log("Navigating to dashboard...");

          navigate("/dashboard");
        }
      } catch (err) {
        console.error("Profile check error:", err);
      }
    };

    checkProfile();
  }, [navigate, API_BASE]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = localStorage.getItem("userToken");
      
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in again",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      // Prepare profile data
      const profileData = {
        bio: profile.bio,
        skills: profile.expertise.split(",").map(s => s.trim()).filter(s => s),
        ratePerMinute: parseFloat(profile.ratePerMinute) || 39,
        profileImage,
        socialMedia: {
          instagram: profile.instagram,
          facebook: profile.facebook,
          youtube: profile.youtube,
          other: profile.otherProfile
        }
      };

      console.log("Sending profile data:", profileData);

      const response = await fetch(`${API_BASE}/api/profile/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();
      
      console.log("Response:", response.status, data);

      if (response.ok && data.success) {
        toast({
          title: "Profile Saved!",
          description: "Your profile has been set up successfully.",
        });

        // Update localStorage userData with profileComplete flag
        const userData = JSON.parse(localStorage.getItem("userData") || "{}");
        userData.profileComplete = true;
        localStorage.setItem("userData", JSON.stringify(userData));
        console.log("Navigating to dashboard...");


        navigate("/dashboard");
      } else {
        throw new Error(data.message || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Profile setup error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="max-w-2xl mx-auto mt-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <CardDescription>
              Tell us about yourself and what you can offer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={profileImage} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-3xl">
                    {profile.name ? profile.name[0].toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="relative">
                  <input
                    type="file"
                    id="avatar"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <Label htmlFor="avatar">
                    <Button type="button" variant="outline" className="cursor-pointer" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Photo
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Your name is set from your account</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expertise">List your skills</Label>
                  <Input
                    id="expertise"
                    placeholder="e.g., Web Development, Mathematics, Music"
                    value={profile.expertise}
                    onChange={(e) => setProfile({ ...profile, expertise: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Separate skills with commas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ratePerMinute">Rate per Minute (₹)</Label>
                  <Input
                    id="ratePerMinute"
                    type="number"
                    placeholder="39"
                    value={profile.ratePerMinute}
                    onChange={(e) => setProfile({ ...profile, ratePerMinute: e.target.value })}
                    min="10"
                    step="10"
                  />
                  <p className="text-xs text-muted-foreground">Default: ₹39/min</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell others about your experience and what you can teach..."
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                    required
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Social Media Links (Optional)</h3>
                
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="instagram"
                        type="url"
                        placeholder="https://instagram.com/username"
                        className="pl-10"
                        value={profile.instagram}
                        onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <div className="relative">
                      <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="facebook"
                        type="url"
                        placeholder="https://facebook.com/username"
                        className="pl-10"
                        value={profile.facebook}
                        onChange={(e) => setProfile({ ...profile, facebook: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube</Label>
                    <div className="relative">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="youtube"
                        type="url"
                        placeholder="https://youtube.com/@username"
                        className="pl-10"
                        value={profile.youtube}
                        onChange={(e) => setProfile({ ...profile, youtube: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otherProfile">Other Profile Link</Label>
                    <div className="relative">
                      <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="otherProfile"
                        type="url"
                        placeholder="Add any other profile link"
                        className="pl-10"
                        value={profile.otherProfile}
                        onChange={(e) => setProfile({ ...profile, otherProfile: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" variant="accent" disabled={isLoading}>
                {isLoading ? "Saving..." : "Complete Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetup;