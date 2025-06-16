import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, Image as ImageIcon, User, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import UserProfile from "./UserProfile";

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  sender_id: string;
  sender_profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface ChatWindowProps {
  conversationId: string | null;
  currentUser: SupabaseUser | null;
}

const ChatWindow = ({ conversationId, currentUser }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  useEffect(() => {
    // Clean up existing subscription first
    if (channelRef.current) {
      console.log("Cleaning up existing chat subscription");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (conversationId && currentUser) {
      console.log("Setting up chat for conversation:", conversationId);
      fetchMessages();
      subscribeToMessages();
    } else {
      console.log("Missing conversationId or currentUser:", {
        conversationId,
        currentUser: !!currentUser,
      });
      setMessages([]);
    }

    return () => {
      if (channelRef.current) {
        console.log("Cleaning up chat subscription on unmount");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUser]);

  useEffect(() => {
    setHasInitialScrolled(false);
  }, [conversationId]);

  useEffect(() => {
    if (!hasInitialScrolled && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
        setHasInitialScrolled(true);
      }, 300);
    }
    // eslint-disable-next-line
  }, [messages, hasInitialScrolled]);

  // Scroll ke bawah setiap kali pesan baru dikirim oleh user sendiri
  const prevMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    if (messages.length > 0 && prevMessagesRef.current.length > 0) {
      const prevLast = prevMessagesRef.current[prevMessagesRef.current.length - 1];
      const currLast = messages[messages.length - 1];
      // Jika pesan terakhir berubah dan pengirimnya adalah user sendiri, scroll ke bawah
      if (currLast && prevLast && currLast.id !== prevLast.id && currLast.sender_id === currentUser?.id) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
    prevMessagesRef.current = messages;
  }, [messages, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async (beforeId: string | null = null, append = false) => {
    if (!conversationId || !currentUser) return;
    try {
      setLoading(!append); // loading utama hanya saat pertama buka
      setIsLoadingMore(append);
      let query = supabase
        .from("messages")
        .select("id, content, image_url, created_at, sender_id")
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (beforeId && messages.length > 0) {
        // Ambil pesan yang lebih lama dari pesan pertama yang ada
        const oldestMsg = messages[0];
        query = query.lt("created_at", oldestMsg.created_at);
      }
      const { data: messagesData, error: messagesError } = await query;
      if (messagesError) return;
      // Get unique sender IDs
      const senderIds = [...new Set(messagesData?.map((msg) => msg.sender_id) || [])];
      let profilesMap = new Map();
      if (senderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", senderIds);
        profilesData?.forEach((profile) => {
          profilesMap.set(profile.id, profile);
        });
      }
      const transformedMessages: Message[] = (messagesData || [])
        .reverse()
        .map((msg) => {
          const profile = profilesMap.get(msg.sender_id);
          return {
            id: msg.id,
            content: msg.content,
            image_url: msg.image_url,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
            sender_profile: profile
              ? {
                  username: profile.username,
                  display_name: profile.display_name || profile.username,
                  avatar_url: profile.avatar_url,
                }
              : {
                  username: "Unknown User",
                  display_name: "Unknown User",
                  avatar_url: null,
                },
          };
        });
      if (append) {
        setMessages((prev) => [...transformedMessages, ...prev]);
      } else {
        setMessages(transformedMessages);
      }
      setHasMore((messagesData || []).length === 50);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId || !currentUser) return;

    // Make sure we don't have an existing channel
    if (channelRef.current) {
      console.log("Removing existing channel before creating new subscription");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log(
      "Setting up real-time subscription for conversation:",
      conversationId
    );

    // Create a unique channel name to avoid conflicts
    const channelName = `messages_${conversationId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log("New message received via real-time:", payload);

          try {
            // Fetch the sender's profile
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", payload.new.sender_id)
              .single();

            if (profileError) {
              console.error("Error fetching sender profile:", profileError);
            }

            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content,
              image_url: payload.new.image_url,
              created_at: payload.new.created_at,
              sender_id: payload.new.sender_id,
              sender_profile: profileData
                ? {
                    username: profileData.username,
                    display_name:
                      profileData.display_name || profileData.username,
                    avatar_url: profileData.avatar_url,
                  }
                : {
                    username: "Unknown User",
                    display_name: "Unknown User",
                    avatar_url: null,
                  },
            };

            console.log("Adding new message to state:", newMessage);
            setMessages((prev) => {
              // Check if message already exists to prevent duplicates
              const exists = prev.some((msg) => msg.id === newMessage.id);
              if (exists) {
                console.log("Message already exists, skipping duplicate");
                return prev;
              }
              return [...prev, newMessage];
            });
          } catch (error) {
            console.error("Error processing new message:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("Message deleted via real-time:", payload);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to real-time updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Channel subscription error");
          // Clean up the failed channel
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      });

    // Store the channel reference
    channelRef.current = channel;
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!currentUser) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("message-images")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from("message-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSendMessage = async () => {
    if (
      !conversationId ||
      !currentUser ||
      (!newMessage.trim() && !selectedImage)
    )
      return;

    let isUploading = false;
    try {
      let imageUrl = null;
      if (selectedImage) {
        isUploading = true;
        setLoading(true);
        imageUrl = await uploadImage(selectedImage);
        setLoading(false);
        if (!imageUrl) {
          toast({
            title: "Error",
            description: "Failed to upload image",
            variant: "destructive",
          });
          return;
        }
      }

      const messageData = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: newMessage.trim() || null,
        image_url: imageUrl,
        message_type: (imageUrl ? "image" : "text") as
          | "text"
          | "image"
          | "emoji",
      };

      await supabase.from("messages").insert(messageData);
      setNewMessage("");
      setSelectedImage(null);
      // Scroll ke bawah langsung setelah kirim pesan
      setTimeout(() => scrollToBottom(), 100);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
      if (isUploading) setLoading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAvatarClick = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfile(true);
  };

  if (!conversationId) {
    return (
      <Card className="glass-effect p-6 h-[400px] sm:h-[500px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/50" />
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-muted-foreground mb-1">
              Select a conversation
            </h3>
            <p className="text-sm text-muted-foreground/80">
              Choose a chat from the sidebar to start messaging
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-effect p-0 sm:p-0 flex flex-col flex-1 h-full max-h-full">
        {/* Area pesan */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0 py-2 px-2 sm:px-4 pb-11">
          {hasMore && (
            <div className="flex justify-center mb-2">
              <Button size="sm" variant="outline" onClick={() => fetchMessages(messages[0]?.id, true)} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-muted-foreground">
                  Loading messages...
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No messages yet. Start the conversation!
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="flex items-start space-x-3 animate-fade-in"
              >
                <Avatar
                  className="w-8 h-8 sm:w-10 sm:h-10 ring-2 ring-white/30 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                  onClick={() => handleAvatarClick(message.sender_id)}
                >
                  <AvatarImage src={message.sender_profile.avatar_url || ""} />
                  <AvatarFallback>
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span
                      className="font-medium text-xs sm:text-sm cursor-pointer hover:underline truncate"
                      onClick={() => handleAvatarClick(message.sender_id)}
                    >
                      {message.sender_profile.display_name ||
                        message.sender_profile.username}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="chat-bubble p-3 rounded-2xl max-w-xs sm:max-w-md">
                    {message.image_url && (
                      <img
                        src={message.image_url}
                        alt="Shared image"
                        className="w-full max-w-sm rounded-lg mb-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() =>
                          window.open(message.image_url!, "_blank")
                        }
                      />
                    )}
                    {message.content && (
                      <p className="text-xs sm:text-sm leading-relaxed break-words">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="space-y-3 fixed bottom-0 left-0 w-full z-30 mb-2 px-2 sm:px-4">
          {selectedImage && (
            <div className="flex items-center space-x-3 p-3 glass-card rounded-lg animate-scale-in">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Selected"
                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg shadow-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm">
                  Image ready to send
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedImage.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
                className="text-red-500 hover:text-red-600 flex-shrink-0"
              >
                Remove
              </Button>
            </div>
          )}

          <div className="flex items-end space-x-2 sm:space-x-3">
            <div className="flex-1 min-w-0">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="glass-card border-white/30 py-2 sm:py-3 px-3 sm:px-4 sm:text-base"
                disabled={loading}
              />
            </div>

            <div className="flex space-x-2 flex-shrink-0">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageSelect}
                className="hidden"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="glass-card hover:glass-effect transition-all duration-300 h-10 w-10"
                disabled={loading}
              >
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              <Button
                onClick={handleSendMessage}
                disabled={loading || (!newMessage.trim() && !selectedImage)}
                className="liquid-gradient text-white hover:opacity-90 transition-all duration-300 px-4 sm:px-6 h-10"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <UserProfile
        userId={selectedUserId}
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        currentUserId={currentUser?.id || ""}
      />
    </>
  );
};

export default ChatWindow;
