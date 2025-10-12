import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Star, IndianRupee, BookOpen, Instagram, Facebook, Youtube, Sparkles } from "lucide-react";

interface TeacherCardProps {
  teacher: {
    id: string;
    name: string;
    avatar: string;
    expertise: string;
    bio: string;
    rating: number;
    isOnline: boolean;
    socialMedia?: {
      instagram?: string;
      facebook?: string;
      youtube?: string;
    };
    pricingTiers: {
      minutes: number;
      price: number;
    }[];
  };
  onConnect: (teacherId: string) => void;
}

const TeacherCard = ({ teacher, onConnect }: TeacherCardProps) => {
  // Get starting price (minimum price)
  const startingPrice = Math.min(...teacher.pricingTiers.map(tier => tier.price));
  
  return (
    <Card className="group relative overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-2 bg-card border-border/40 backdrop-blur-sm">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Online Indicator - More elegant */}
      {teacher.isOnline && (
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
          <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all">
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-medium">
              {teacher.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-foreground leading-tight">{teacher.name}</h3>
            <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
              <BookOpen className="h-3 w-3 mr-1" />
              {teacher.expertise}
            </Badge>
          </div>
        </div>

        {/* Bio */}
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
          {teacher.bio}
        </p>

        {/* Social Media - More subtle */}
        {teacher.socialMedia && (
          <div className="flex gap-1">
            {teacher.socialMedia.instagram && (
              <a 
                href={`https://instagram.com/${teacher.socialMedia.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}
            {teacher.socialMedia.facebook && (
              <a 
                href={`https://facebook.com/${teacher.socialMedia.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Facebook className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}
            {teacher.socialMedia.youtube && (
              <a 
                href={`https://youtube.com/@${teacher.socialMedia.youtube.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Youtube className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}
          </div>
        )}

        {/* Stats - More elegant */}
        <div className="flex gap-3 py-3 border-y border-border/50">
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="font-semibold text-sm">{teacher.rating}</span>
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

        {/* Connect Button - More attractive */}
        <Button 
          className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300 text-sm font-medium py-2.5 group/btn"
          onClick={() => onConnect(teacher.id)}
          size="sm"
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