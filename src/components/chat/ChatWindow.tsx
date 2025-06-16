import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, Image as ImageIcon, User, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import UserProfile from './UserProfile';

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
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Clean up existing subscription first
    if (channelRef.current) {
      console.log('Cleaning up existing chat subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (conversationId && currentUser) {
      console.log('Setting up chat for conversation:', conversationId);
      fetchMessages();
      subscribeToMessages();
    } else {
      console.log('Missing conversationId or currentUser:', { conversationId, currentUser: !!currentUser });
      setMessages([]);
    }

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up chat subscription on unmount');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!conversationId || !currentUser) {
      console.log('Cannot fetch messages - missing conversationId or currentUser');
      return;
    }

    try {
      console.log('Fetching messages for conversation:', conversationId);
      setLoading(true);

      // Fetch messages directly - RLS policies will handle access control
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, image_url, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        if (messagesError.message.includes('row-level security')) {
          toast({
            title: "Access Denied",
            description: "You don't have access to this conversation",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to load messages. Please try again.",
            variant: "destructive"
          });
        }
        return;
      }

      console.log('Fetched messages:', messagesData);

      // Get unique sender IDs
      const senderIds = [...new Set(messagesData?.map(msg => msg.sender_id) || [])];

      if (senderIds.length > 0) {
        // Fetch profiles for all senders
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', senderIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Create a map of profiles by user ID
        const profilesMap = new Map();
        profilesData?.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });

        // Transform messages to match expected format
        const transformedMessages: Message[] = (messagesData || []).map(msg => {
          const profile = profilesMap.get(msg.sender_id);
          return {
            id: msg.id,
            content: msg.content,
            image_url: msg.image_url,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
            sender_profile: profile ? {
              username: profile.username,
              display_name: profile.display_name || profile.username,
              avatar_url: profile.avatar_url
            } : {
              username: 'Unknown User',
              display_name: 'Unknown User',
              avatar_url: null
            }
          };
        });

        console.log('Transformed messages:', transformedMessages);
        setMessages(transformedMessages);
      } else {
        setMessages([]);
      }

    } catch (error: any) {
      console.error('Unexpected error fetching messages:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId || !currentUser) return;

    // Make sure we don't have an existing channel
    if (channelRef.current) {
      console.log('Removing existing channel before creating new subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log('Setting up real-time subscription for conversation:', conversationId);

    // Create a unique channel name to avoid conflicts
    const channelName = `messages_${conversationId}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          console.log('New message received via real-time:', payload);
          
          try {
            // Fetch the sender's profile
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', payload.new.sender_id)
              .single();

            if (profileError) {
              console.error('Error fetching sender profile:', profileError);
            }

            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content,
              image_url: payload.new.image_url,
              created_at: payload.new.created_at,
              sender_id: payload.new.sender_id,
              sender_profile: profileData ? {
                username: profileData.username,
                display_name: profileData.display_name || profileData.username,
                avatar_url: profileData.avatar_url
              } : {
                username: 'Unknown User',
                display_name: 'Unknown User',
                avatar_url: null
              }
            };

            console.log('Adding new message to state:', newMessage);
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('Message already exists, skipping duplicate');
                return prev;
              }
              return [...prev, newMessage];
            });
          } catch (error) {
            console.error('Error processing new message:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Message deleted via real-time:', payload);
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
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

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('message-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('message-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSendMessage = async () => {
    if (!conversationId || !currentUser || (!newMessage.trim() && !selectedImage)) return;

    setLoading(true);

    try {
      console.log('Sending message to conversation:', conversationId);
      
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          toast({
            title: "Error",
            description: "Failed to upload image",
            variant: "destructive"
          });
          return;
        }
      }

      const messageData = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: newMessage.trim() || null,
        image_url: imageUrl,
        message_type: (imageUrl ? 'image' : 'text') as 'text' | 'image' | 'emoji'
      };

      console.log('Inserting message:', messageData);

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) {
        console.error('Error inserting message:', error);
        throw error;
      }

      console.log('Message sent successfully');
      setNewMessage('');
      setSelectedImage(null);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
            <h3 className="text-lg sm:text-xl font-semibold text-muted-foreground mb-1">Select a conversation</h3>
            <p className="text-sm text-muted-foreground/80">Choose a chat from the sidebar to start messaging</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-effect p-4 sm:p-6 h-[500px] sm:h-[600px] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-3 animate-fade-in">
                <Avatar 
                  className="w-8 h-8 sm:w-10 sm:h-10 ring-2 ring-white/30 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                  onClick={() => handleAvatarClick(message.sender_id)}
                >
                  <AvatarImage src={message.sender_profile.avatar_url || ''} />
                  <AvatarFallback><User className="w-4 h-4 sm:w-5 sm:h-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="font-medium text-xs sm:text-sm cursor-pointer hover:underline truncate"
                      onClick={() => handleAvatarClick(message.sender_id)}
                    >
                      {message.sender_profile.display_name || message.sender_profile.username}
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
                        onClick={() => window.open(message.image_url!, '_blank')}
                      />
                    )}
                    {message.content && (
                      <p className="text-xs sm:text-sm leading-relaxed break-words">{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="space-y-3">
          {selectedImage && (
            <div className="flex items-center space-x-3 p-3 glass-card rounded-lg animate-scale-in">
              <img 
                src={URL.createObjectURL(selectedImage)} 
                alt="Selected" 
                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg shadow-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm">Image ready to send</p>
                <p className="text-xs text-muted-foreground truncate">{selectedImage.name}</p>
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
                className="glass-card border-white/30 py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base"
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
        currentUserId={currentUser?.id || ''}
      />
    </>
  );
};

export default ChatWindow;
