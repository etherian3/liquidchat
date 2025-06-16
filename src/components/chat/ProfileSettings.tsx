import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Upload, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface ProfileSettingsProps {
  profile: Profile;
  onClose: () => void;
  onProfileUpdate: (profile: Profile) => void;
}

const ProfileSettings = ({
  profile,
  onClose,
  onProfileUpdate,
}: ProfileSettingsProps) => {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      return null;
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    const uploadedUrl = await uploadAvatar(file);
    if (uploadedUrl) {
      setAvatarUrl(uploadedUrl);
      toast({
        title: "Avatar uploaded!",
        description: "Your avatar has been uploaded successfully.",
      });
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    }

    setUploading(false);
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully.",
      });

      onProfileUpdate(data);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-effect border-white/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Profile Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>
                  <User className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -bottom-2 -right-2 glass-card hover:glass-effect rounded-full w-8 h-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Upload className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </Button>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              className="hidden"
            />

            <div className="text-center">
              <p className="font-medium">@{profile.username}</p>
              <p className="text-sm text-black">
                Click camera icon to change avatar
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="glass-card border-white/30"
              placeholder="Enter your display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Input
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="glass-card border-white/30"
              placeholder="Tell us about yourself"
            />
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 glass-card hover:glass-effect"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || uploading}
              className="flex-1 liquid-gradient text-white hover:opacity-90"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettings;
