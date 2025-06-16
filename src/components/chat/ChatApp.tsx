import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, MessageCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import ProfileSettings from "./ProfileSettings";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const ChatApp = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchConversations();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversation_participants")
      .select(
        `
        conversation_id,
        conversations (
          id,
          name,
          is_group,
          avatar_url,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } else {
      const convos = data
        .map((item) => item.conversations)
        .filter(Boolean) as Conversation[];
      setConversations(convos);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowMobileChat(true);
  };

  const handleBackToSidebar = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 liquid-gradient rounded-full flex items-center justify-center animate-pulse-slow">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen min-h-screen p-2 sm:p-4 flex flex-col animate-fade-in">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 liquid-gradient rounded-full opacity-20 animate-float"></div>
        <div
          className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full opacity-20 animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-32 left-1/4 w-40 h-40 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full opacity-15 animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="w-full h-full flex flex-col flex-1 relative z-10">
        {/* Header sticky/fixed dengan logo dan style asli */}
        <div className="fixed top-0 left-0 w-full z-30 bg-white/80 backdrop-blur-md shadow-md rounded-t-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Back button for mobile when in chat view */}
            {showMobileChat && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden glass-card hover:glass-effect transition-all duration-300 h-9 w-9"
                onClick={handleBackToSidebar}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {/* Logo LiquidChat */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 liquid-gradient rounded-full flex items-center justify-center animate-pulse-slow">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                LiquidChat
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Welcome, {profile?.display_name || profile?.username}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="glass-card hover:glass-effect transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="glass-card hover:glass-effect transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative flex-1 flex flex-col h-full pt-[72px]">
          {/* Mobile Layout - Show either sidebar or chat */}
          <div className="lg:hidden h-full flex flex-col flex-1 overflow-hidden">
            {!showMobileChat ? (
              <ChatSidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onRefreshConversations={fetchConversations}
                currentUserId={user?.id || ""}
              />
            ) : (
              <ChatWindow
                conversationId={selectedConversation}
                currentUser={user}
              />
            )}
          </div>

          {/* Desktop Layout - Show both sidebar and chat */}
          <div className="hidden lg:flex gap-4 h-full flex-1">
            <div className="w-80 flex-shrink-0 h-full">
              <ChatSidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onRefreshConversations={fetchConversations}
                currentUserId={user?.id || ""}
              />
            </div>

            <div className="flex-1 min-w-0 h-full">
              <ChatWindow
                conversationId={selectedConversation}
                currentUser={user}
              />
            </div>
          </div>
        </div>

        {showSettings && profile && (
          <ProfileSettings
            profile={profile}
            onClose={() => setShowSettings(false)}
            onProfileUpdate={(updatedProfile) => {
              setProfile(updatedProfile);
              setShowSettings(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatApp;
