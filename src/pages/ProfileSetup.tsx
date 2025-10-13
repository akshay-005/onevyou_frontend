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
          // ✅ Only redirect if not editing
          if (!isEditMode) {
            navigate("/dashboard");
          } else {
            // ✅ Prefill existing data in edit mode
            setProfileImage(data.profile?.profileImage || "");
            setProfile((prev) => ({
              ...prev,
              bio: data.profile?.bio || "",
              expertise: data.profile?.skills?.join(", ") || "",
              ratePerMinute: String(data.profile?.ratePerMinute || "39"),
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

    // 🔒 Validation: Require profile picture
    if (!profileImage) {
      toast({
        title: "Profile photo required",
        description: "Please upload a profile picture to continue.",
        variant: "destructive",
      });
      return;
    }

    // 🔒 Validation: Require at least one social media link
    const hasSocial =
      profile.instagram.trim() ||
      profile.facebook.trim() ||
      profile.youtube.trim() ||
      profile.otherProfile.trim();

    if (!hasSocial) {
      toast({
        title: "At least one social media link required",
        description: "Please provide at least one social media profile link.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
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

      const profileData = {
        bio: profile.bio,
        skills: profile.expertise
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
        ratePerMinute: parseFloat(profile.ratePerMinute) || 39,
        profileImage,
        socialMedia: {
          instagram: profile.instagram,
          facebook: profile.facebook,
          youtube: profile.youtube,
          other: profile.otherProfile,
        },
      };

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
                  <Label htmlFor="expertise">List your skills</Label>
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
                    Separate skills with commas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
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

              {/* Social Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Social Media Links <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Add at least one social profile link
                </p>

                <div className="grid gap-4">
                  {[
                    {
                      id: "instagram",
                      icon: <Instagram />,
                      placeholder: "https://instagram.com/username",
                    },
                    {
                      id: "facebook",
                      icon: <Facebook />,
                      placeholder: "https://facebook.com/username",
                    },
                    {
                      id: "youtube",
                      icon: <Youtube />,
                      placeholder: "https://youtube.com/@username",
                    },
                    {
                      id: "otherProfile",
                      icon: <Plus />,
                      placeholder: "Add any other profile link",
                    },
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>
                        {field.id.replace(/([A-Z])/g, " $1")}
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
                          {field.icon}
                        </div>
                        <Input
                          id={field.id}
                          type="url"
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
