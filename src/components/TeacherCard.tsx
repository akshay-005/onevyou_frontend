import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Star, IndianRupee, BookOpen, Instagram, Facebook, Youtube, Sparkles } from "lucide-react";
import { useRef } from "react";


// avoid duplicate concurrent prefetches across cards
const inflightPrefetch = (window as any).__onevyou_inflight_prefetch__ || new Set<string>();
(window as any).__onevyou_inflight_prefetch__ = inflightPrefetch;



// ---------- PREFETCH HELPERS ----------
const PREFETCH_KEY = (id: string) => `teacher_cache_${id}`;
async function prefetchTeacher(teacherId: string) {
  try {
    if (!teacherId || teacherId.length < 6) return; // quick validation
    const key = PREFETCH_KEY(teacherId);

    // already cached -> skip
    if (sessionStorage.getItem(key)) return;

    // already inflight -> skip
    if (inflightPrefetch.has(teacherId)) return;
    inflightPrefetch.add(teacherId);

    const baseUrl = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${baseUrl}/api/users/get?userId=${teacherId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("userToken")}` },
    });

    if (!res.ok) {
      // If 404, cache a small sentinel so we don't refetch repeatedly
      if (res.status === 404) {
        try { sessionStorage.setItem(key, JSON.stringify({ _missing: true, ts: Date.now() })); } catch(e){}
      }
      return;
    }

    const json = await res.json();
    if (json?.success && json.user) {
      const small = {
        _id: json.user._id,
        name: json.user.fullName || json.user.name,
        pricingTiers: json.user.pricingTiers || json.user.profile?.pricingTiers || [],
        expertise: json.user.skills?.[0] || json.user.expertise || "",
        rating: json.user.profile?.rating || json.user.rating || 4.8,
      };
      try { sessionStorage.setItem(key, JSON.stringify(small)); } catch(e) {}
    }
  } catch (e) {
    if (import.meta.env.DEV) console.debug("prefetchTeacher failed", e);
  } finally {
    inflightPrefetch.delete(teacherId);
  }
}



interface TeacherCardProps {
  teacher: {
    _id?: string;
    id?: string;
    name?: string;
    fullName?: string;
    profileImage?: string;
    avatar?: string;
    expertise?: string;
    bio?: string;
    profile?: {
      bio?: string;
      skills?: string[];
      rating?: number;
      pricingTiers?: { minutes: number; price: number }[];
      socialMedia?: {
        instagram?: string;
        facebook?: string;
        youtube?: string;
      };
    };
    rating?: number;
    isOnline?: boolean;
    online?: boolean;
    socialMedia?: {
      instagram?: string;
      facebook?: string;
      youtube?: string;
    };
    pricingTiers?: {
      minutes: number;
      price: number;
    }[];
    ratePerMinute?: number;
    skill?: string;
    about?: string;
  };
  onConnect: (teacherId: string) => void;
}

const TeacherCard = ({ teacher, onConnect }: TeacherCardProps) => {
  // Extract data with fallbacks - handle multiple data structure formats
  const teacherId = teacher._id || teacher.id || "";
  const displayName = teacher.fullName || teacher.name || "User";
  const profileImage = teacher.profileImage || teacher.avatar || "";
  // inside component
  const prefetchTimerRef = useRef<number | null>(null);

  
  // Skills - check array first, then fallback
  const skillsArray = Array.isArray(teacher.skills) ? teacher.skills : (teacher.profile?.skills || []);
  const expertise = skillsArray.length > 0 ? skillsArray[0] : (teacher.expertise || teacher.skill || "Skill not specified");
  
  // Bio - try direct field first
  const bio = teacher.bio || teacher.profile?.bio || teacher.about || "No description available";
  
  const rating = teacher.rating || teacher.profile?.rating || 4.8;
  const isOnline = teacher.isOnline !== undefined ? teacher.isOnline : teacher.online || false;
  
  // Social media from either top-level or nested profile
  const socialMedia = teacher.socialMedia || teacher.profile?.socialMedia || {};
  
  // Pricing tiers - ensure it's an array
  const pricingTiers = Array.isArray(teacher.pricingTiers)
    ? teacher.pricingTiers
    : teacher.profile?.pricingTiers || [
        { minutes: 1, price: teacher.ratePerMinute || 39 }
      ];

  // Get starting price (minimum price)
  const startingPrice = pricingTiers.length
  ? Math.min(...pricingTiers.map(tier => tier.price || 0))
  : teacher.ratePerMinute || 39;

  
  // Get initials for avatar fallback
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Helper to build proper social URLs and fix common typos
  const buildSocialUrl = (username: string, platform: string) => {
    if (!username) return "";
    
    // If it's already a full URL, fix typos and return
    if (username.startsWith("http")) {
      let url = username;
      // Fix common typos
      url = url.replace("intagram.com", "instagram.com"); // typo fix
      url = url.replace("youtube.com/@", "youtube.com/@"); // ensure correct format
      return url;
    }
    
    // Build URL from username
    const cleaned = username.replace("@", "").trim();
    
    const baseUrls: { [key: string]: string } = {
      instagram: `https://instagram.com/${cleaned}`,
      facebook: `https://facebook.com/${cleaned}`,
      youtube: `https://youtube.com/@${cleaned}`,
    };
    
    return baseUrls[platform] || "";
  };


  return (
    <Card className="group relative overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-2 bg-card border-border/40 backdrop-blur-sm">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Online Indicator */}
      {isOnline && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" />
              <div className="relative bg-green-500 rounded-full h-2 w-2" />
            </div>
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
        </div>
      )}

      <CardContent className="p-5 space-y-4 relative">
        {/* Header with Avatar and Name */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all flex-shrink-0">
            {profileImage && (
              <AvatarImage 
                src={profileImage} 
                alt={displayName}
                className="object-cover"
                loading="lazy"
              />
            )}
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground leading-tight truncate">
              {displayName}
            </h3>
            <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
              <BookOpen className="h-3 w-3 mr-1" />
              <span className="truncate">{expertise}</span>
            </Badge>
          </div>
        </div>

        {/* Bio */}
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
          {bio}
        </p>

        {/* Social Media Icons */}
        {(socialMedia.instagram || socialMedia.facebook || socialMedia.youtube) && (
          <div className="flex gap-1">
            {socialMedia.instagram && (
              <a 
                href={buildSocialUrl(socialMedia.instagram, "instagram")}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Instagram"
              >
                <Instagram className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            )}
            {socialMedia.facebook && (
              <a 
                href={buildSocialUrl(socialMedia.facebook, "facebook")}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Facebook"
              >
                <Facebook className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            )}
            {socialMedia.youtube && (
              <a 
                href={buildSocialUrl(socialMedia.youtube, "youtube")}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="YouTube"
              >
                <Youtube className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            )}
          </div>
        )}

        {/* Stats - Rating & Price */}
        <div className="flex gap-3 py-3 border-y border-border/50">
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="font-semibold text-sm">{rating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Rating</p>
          </div>
          <div className="w-px bg-border/50" />
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-0.5 font-semibold text-sm">
              <IndianRupee className="h-3.5 w-3.5" />
              <span>{startingPrice}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Starting</p>
          </div>
        </div>

        {/* Connect Button */}
{/* Connect Button - debounced prefetch + instant open */}
<Button
  className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300 text-sm font-medium py-2.5 group/btn"
  size="sm"
  onMouseEnter={() => {
    // skip if teacher already has pricing or cache exists
    if ((pricingTiers && pricingTiers.length > 0) || sessionStorage.getItem(PREFETCH_KEY(teacherId))) return;
    // debounce short hover to avoid spam
    if (prefetchTimerRef.current) window.clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchTeacher(teacherId).catch(() => {});
      prefetchTimerRef.current = null;
    }, 300);
  }}
  onMouseLeave={() => {
    if (prefetchTimerRef.current) {
      window.clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }}
  onFocus={() => {
    // keyboard: prefetch immediately if needed
    if ((pricingTiers && pricingTiers.length > 0) || sessionStorage.getItem(PREFETCH_KEY(teacherId))) return;
    prefetchTeacher(teacherId).catch(() => {});
  }}
  onClick={() => {
    // open immediately (synchronous)
    onConnect(teacherId);
    // background prefetch if needed
    if (!(pricingTiers && pricingTiers.length > 0) && !sessionStorage.getItem(PREFETCH_KEY(teacherId))) {
      prefetchTeacher(teacherId).catch(() => {});
    }
  }}
>
  <Video className="mr-2 h-3.5 w-3.5 group-hover/btn:animate-pulse" />
  Connect Now
  <Sparkles className="ml-1.5 h-3 w-3 opacity-60" />
</Button>


      </CardContent>
    </Card>
  );
};

export default TeacherCard;