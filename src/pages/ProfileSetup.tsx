import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Instagram, Facebook, Youtube, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = new URLSearchParams(location.search).get("edit") === "true";

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    expertise: "",
    instagram: "",
    facebook: "",
    youtube: "",
    otherProfile: "",
  });

  const API_BASE = import.meta.env.VITE_API_URL || "http://10.138.22.170:3001";
  const DEFAULT_RATE = 39; // Default rate: ₹39 per minute

  // ✅ FIXED: Validation helper for usernames and URLs
  const isValidSocialInput = (input: string, fieldId: string) => {
    if (!input.trim()) return false;

    // If it's a full URL
    if (input.startsWith("http")) {
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    }

    // If it's just a username (for Instagram, Facebook, YouTube)
    if (fieldId === "otherProfile") {
      // Other Profile field MUST be a valid URL
      return false;
    }

    // For Instagram, Facebook, YouTube - accept any non-empty username
    // Username rules: alphanumeric, dots, underscores, hyphens
    const usernameRegex = /^[@._\-a-zA-Z0-9]{1,}$/;
    return usernameRegex.test(input.replace("@", "")); // Remove @ if present
  };

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    const userData = localStorage.getItem("userData");

    if (!token || !userData) {
      navigate("/auth");
      return;
    }

    const user = JSON.parse(userData);
    if (user.fullName) {
      setProfile((prev) => ({ ...prev, name: user.fullName }));
    }

    const checkProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.success && data.profile?.bio) {
          if (!isEditMode) {
            navigate("/dashboard");
          } else {
            // Prefill existing data in edit mode
            setProfileImage(data.profile?.profileImage || "");
            setProfile((prev) => ({
              ...prev,
              bio: data.profile?.bio || "",
              expertise: data.profile?.skills?.join(", ") || "",
              instagram: data.profile?.socialMedia?.instagram || "",
              facebook: data.profile?.socialMedia?.facebook || "",
              youtube: data.profile?.socialMedia?.youtube || "",
              otherProfile: data.profile?.socialMedia?.other || "",
            }));
          }
        }
      } catch (err) {
        console.error("Profile check error:", err);
      }
    };

    checkProfile();
  }, [navigate, API_BASE, isEditMode]);

  // Handle image upload with file validation
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Image too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc).",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Comprehensive form validation and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation 1: Profile image
      if (!profileImage) {
        toast({
          title: "Profile photo required",
          description: "Please upload a profile picture to continue.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validation 2: Bio
      if (!profile.bio.trim()) {
        toast({
          title: "Bio is required",
          description: "Please add a bio describing your experience.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validation 3: Expertise/Skills
      if (!profile.expertise.trim()) {
        toast({
          title: "Skills are required",
          description: "Please list at least one skill.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // ✅ FIXED: Validation 4: Social media (accepts usernames or URLs)
      const validSocial = [
        { id: "instagram", value: profile.instagram },
        { id: "facebook", value: profile.facebook },
        { id: "youtube", value: profile.youtube },
        { id: "otherProfile", value: profile.otherProfile },
      ].filter((link) => isValidSocialInput(link.value, link.id));

      if (validSocial.length === 0) {
        toast({
          title: "Invalid social media links",
          description: "Please provide at least one valid social media username or profile URL.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get token
      const token = localStorage.getItem("userToken");
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in again",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Build profile data with deduplication and trimming
      const profileData = {
        bio: profile.bio.trim(),
        skills: profile.expertise
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s)
          .filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
        ratePerMinute: DEFAULT_RATE, // Always set to default rate
        profileImage,
        socialMedia: {
          instagram: profile.instagram.trim(),
          facebook: profile.facebook.trim(),
          youtube: profile.youtube.trim(),
          other: profile.otherProfile.trim(),
        },
      };

      console.log("📤 Sending profile data:", profileData);

      // Send to backend
      const response = await fetch(`${API_BASE}/api/profile/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Profile saved successfully:", data.user);

        // Verify critical fields were saved
        if (data.user?.profileImage) {
          console.log("✅ Profile image saved");
        } else {
          console.warn("⚠️ Profile image may not have been saved");
        }

        if (data.user?.socialMedia) {
          console.log("✅ Social media saved");
        } else {
          console.warn("⚠️ Social media may not have been saved");
        }

        toast({
          title: isEditMode ? "Profile Updated!" : "Profile Saved!",
          description: isEditMode
            ? "Your changes have been saved successfully."
            : "Your profile has been set up successfully.",
        });

        const userData = JSON.parse(localStorage.getItem("userData") || "{}");
        userData.profileComplete = true;
        localStorage.setItem("userData", JSON.stringify(userData));

        navigate("/dashboard");
      } else {
        throw new Error(data.message || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Profile setup error:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to save profile. Please try again.",
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
            <CardTitle className="text-2xl">
              {isEditMode ? "Edit Your Profile" : "Complete Your Profile"}
            </CardTitle>
            <CardDescription>
              {isEditMode
                ? "Update your profile details below"
                : "Tell us about yourself and what you can offer"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={profileImage} alt={profile.name} />
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
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      asChild
                    >
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        {isEditMode ? "Change Photo" : "Upload Photo"}
                      </span>
                    </Button>
                  </Label>
                </div>
                {!profileImage && (
                  <p className="text-sm text-red-500 font-medium">
                    Profile photo is required*
                  </p>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" value={profile.name} disabled />
                  <p className="text-xs text-muted-foreground">
                    Your name is set from your account
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expertise">
                    List your skills <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="expertise"
                    placeholder="e.g., Web Development, Mathematics, Music"
                    value={profile.expertise}
                    onChange={(e) =>
                      setProfile({ ...profile, expertise: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate skills with commas (duplicates will be removed)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">
                    Bio <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell others about your experience and what you can teach..."
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                    rows={4}
                    required
                  />
                </div>
              </div>

              {/* Social Links - Username only */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Social Media Links <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter your username only (we'll build the profile URL automatically)
                </p>

                <div className="grid gap-4">
                  {[
                    {
                      id: "instagram",
                      icon: <Instagram />,
                      placeholder: "akshay_dev_k",
                      label: "Instagram Username",
                      example: "example: @username or just username",
                    },
                    {
                      id: "facebook",
                      icon: <Facebook />,
                      placeholder: "akshay_dev_k",
                      label: "Facebook Username",
                      example: "example: your.username",
                    },
                    {
                      id: "youtube",
                      icon: <Youtube />,
                      placeholder: "akshay_dev_k",
                      label: "YouTube Channel Name",
                      example: "example: @channel_name or just channel_name",
                    },
                    {
                      id: "otherProfile",
                      icon: <Plus />,
                      placeholder: "https://example.com/profile",
                      label: "Other Profile (Optional)",
                      example: "enter full URL for other platforms",
                    },
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
                          {field.icon}
                        </div>
                        <Input
                          id={field.id}
                          type={field.id === "otherProfile" ? "url" : "text"}
                          placeholder={field.placeholder}
                          className="pl-10"
                          value={profile[field.id as keyof typeof profile]}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{field.example}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="accent"
                disabled={isLoading}
              >
                {isLoading
                  ? "Saving..."
                  : isEditMode
                  ? "Save Changes"
                  : "Complete Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetup;