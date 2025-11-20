// frontend/src/pages/ProfilePublic.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import PricingModal from "@/components/PricingModal";
import { IndianRupee } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const getCurrentUserFromStorage = () => {
  try {
    const token = localStorage.getItem("userToken");
    const data = localStorage.getItem("userData");
    if (!token || !data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const ProfilePublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return setLoading(false);
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/profile/public/${id}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setProfile(data.profile);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Fetch public profile error:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!profile) return <div className="p-6">Profile not found</div>;

  const isOnline = profile.isOnline ?? profile.online ?? false;
  const currentUser = getCurrentUserFromStorage();

  const handleConnectClick = () => {
    // Not logged in -> send to auth (your app uses /auth in profile setup)
    if (!currentUser) {
      const next = encodeURIComponent(`/profile/${id}`);
      navigate(`/auth?next=${next}`);
      return;
    }

    // If logged in but the profile is offline -> show offline badge/notice
    if (!isOnline) {
      // Replace alert with toast if you have toast hook
      alert("This user is currently offline. You can still request; they will respond when available.");
      return;
    }

    // User is logged in and teacher is online -> open PricingModal
    setPricingOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-3xl mx-auto bg-card p-6 rounded-lg shadow">
        {/* Header */}
        <div className="flex gap-4 items-center">
          <Avatar className="h-20 w-20">
            {profile.profileImage ? (
              <AvatarImage src={profile.profileImage} alt={profile.fullName || profile.name} />
            ) : (
              <AvatarFallback>{(profile.fullName || profile.name || "U").charAt(0)}</AvatarFallback>
            )}
          </Avatar>

          <div>
            <h1 className="text-2xl font-semibold">{profile.fullName || profile.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm">
                <IndianRupee className="h-4 w-4" />
                <span>{profile.ratePerMinute ?? profile.rate ?? 39}</span>
              </div>
              {!isOnline && (
                <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Connect button (replaces full pricing grid on public page) */}
        <div className="mt-6">
          <div className="flex items-center gap-4">
            <Button onClick={handleConnectClick} className="px-6 py-3" variant="default">
              Connect now
            </Button>

            {/* If offline, show small message */}
            {!isOnline && (
              <div className="text-sm text-muted-foreground">
                Currently offline — user will respond when available.
              </div>
            )}
          </div>
        </div>

        {/* Optional short skills list */}
        {Array.isArray(profile.skills) && profile.skills.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium">Skills</h3>
            <div className="text-sm text-muted-foreground mt-1">
              {profile.skills.slice(0, 6).join(", ")}
            </div>
          </div>
        )}
      </div>

      {/* PricingModal controlled here. PricingModal in your project already supports isOpen/onClose/teacher props. */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        teacher={{
          _id: profile._id || profile.id,
          name: profile.fullName || profile.name,
          rating: profile.rating ?? 4.8,
          expertise: profile.skills?.[0] ?? "",
          pricingTiers: profile.pricingTiers ?? (profile.ratePerMinute ? [{ minutes: 1, price: profile.ratePerMinute }] : [{ minutes: 1, price: 39 }])
        }}
        onPaymentComplete={(payload) => {
          // After successful payment you can navigate to call/session page or show a toast
          setPricingOpen(false);
          // example: navigate(`/call/${payload.teacherId}`)
        }}
      />
    </div>
  );
};

export default ProfilePublic;
