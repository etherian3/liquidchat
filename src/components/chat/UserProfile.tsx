import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, MessageCircle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface UserProfileProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
  currentUserId: string;
}

const UserProfile = ({
  userId,
  isOpen,
  onClose,
  onStartChat,
  currentUserId,
}: UserProfileProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId && isOpen) {
      fetchProfile();
    }
  }, [userId, isOpen]);

  const fetchProfile = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!userId || !onStartChat) return;

    try {
      const { data, error } = await supabase.rpc("create_direct_conversation", {
        friend_user_id: userId,
      });

      if (error) throw error;

      onStartChat(data);
      onClose();
      toast({
        title: "Chat started!",
        description: "You can now send messages",
      });
    } catch (error: any) {
      console.error("Error starting chat:", error);
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive",
      });
    }
  };

  if (!userId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-effect border-white/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 ring-4 ring-white/30">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback className="text-2xl">
                  <User className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <h3 className="text-xl font-bold">
                  {profile.display_name || profile.username}
                </h3>
                <p className="text-black">@{profile.username}</p>
              </div>
            </div>

            {profile.bio && (
              <div className="text-center">
                <p className="text-sm text-black">{profile.bio}</p>
              </div>
            )}

            <div className="flex items-center justify-center space-x-2 text-xs text-black">
              <Calendar className="w-4 h-4" />
              <span>
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>

            {userId !== currentUserId && onStartChat && (
              <div className="flex justify-center">
                <Button
                  onClick={handleStartChat}
                  className="liquid-gradient text-white hover:opacity-90 w-full"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Start Chat
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load profile</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfile;
