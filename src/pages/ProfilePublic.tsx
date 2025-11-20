// frontend/src/pages/ProfilePublic.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IndianRupee, Instagram, Facebook, Youtube } from "lucide-react";
import api from "@/utils/api"; // if you have api helper; else use fetch

const ProfilePublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // If you have a centralized api util:
        if (api && api.getPublicProfile) {
          const res = await api.getPublicProfile(id);
          if (res.success) setProfile(res.profile);
        } else {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/profile/public/${id}`);
          const data = await res.json();
          if (res.ok && data.success) setProfile(data.profile);
        }
      } catch (err) {
        console.error("Fetch public profile error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!profile) return <div className="p-6">Profile not found</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-3xl mx-auto bg-card p-6 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {profile.profileImage ? (
              <AvatarImage src={profile.profileImage} alt={profile.fullName} />
            ) : (
              <AvatarFallback>{profile.fullName?.[0] || "U"}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{profile.fullName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1 text-sm">
                <IndianRupee className="h-4 w-4" /> <span>{profile.ratePerMinute}</span>
              </div>
              <div className="text-xs text-muted-foreground ml-2">
                {profile.skills?.slice(0, 6).join(", ")}
              </div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="mt-4 flex gap-3">
          {profile.socialMedia?.instagram && (
            <a href={profile.socialMedia.instagram.startsWith("http") ? profile.socialMedia.instagram : `https://instagram.com/${profile.socialMedia.instagram.replace("@","")}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm"><Instagram className="h-4 w-4" /></Button>
            </a>
          )}
          {profile.socialMedia?.facebook && (
            <a href={profile.socialMedia.facebook.startsWith("http") ? profile.socialMedia.facebook : `https://facebook.com/${profile.socialMedia.facebook}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm"><Facebook className="h-4 w-4" /></Button>
            </a>
          )}
          {profile.socialMedia?.youtube && (
            <a href={profile.socialMedia.youtube.startsWith("http") ? profile.socialMedia.youtube : `https://youtube.com/@${profile.socialMedia.youtube.replace("@","")}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm"><Youtube className="h-4 w-4" /></Button>
            </a>
          )}
        </div>

        {/* Pricing tiers */}
        <div className="mt-6">
          <h3 className="font-medium">Pricing</h3>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(profile.pricingTiers && profile.pricingTiers.length > 0 ? profile.pricingTiers : [{ minutes: 1, price: profile.ratePerMinute || 39 }]).map((t: any) => (
              <div key={t.minutes} className="p-3 border rounded text-center">
                <div className="font-semibold">₹{t.price}</div>
                <div className="text-xs text-muted-foreground">{t.minutes} min</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePublic;
