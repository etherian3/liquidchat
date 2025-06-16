
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Check, X, User, UserCheck, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
  requester_profile?: Profile;
  addressee_profile?: Profile;
}

interface FriendsProps {
  currentUserId: string;
  onStartChat: (conversationId: string) => void;
}

const Friends = ({ currentUserId, onStartChat }: FriendsProps) => {
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [acceptedFriends, setAcceptedFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string[]>([]);

  useEffect(() => {
    fetchFriendships();
    
    // Subscribe to friendship changes
    const channel = supabase
      .channel('friends_friendships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          console.log('Friendship change detected in Friends, refreshing...');
          fetchFriendships();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchFriendships = async () => {
    try {
      console.log('Fetching friendships for user:', currentUserId);
      
      // Get all friendships where user is either requester or addressee
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

      if (error) throw error;

      console.log('Raw friendships data:', friendships);

      // Get all unique user IDs to fetch profiles
      const userIds = new Set<string>();
      friendships?.forEach(friendship => {
        userIds.add(friendship.requester_id);
        userIds.add(friendship.addressee_id);
      });

      // Remove current user ID
      userIds.delete(currentUserId);

      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create profiles map
      const profilesMap = new Map<string, Profile>();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Enrich friendships with profile data
      const enrichedFriendships = friendships?.map(friendship => ({
        ...friendship,
        requester_profile: profilesMap.get(friendship.requester_id),
        addressee_profile: profilesMap.get(friendship.addressee_id)
      })) || [];

      console.log('Enriched friendships:', enrichedFriendships);

      // Separate pending and accepted friendships
      const pending = enrichedFriendships.filter(f => f.status === 'pending' && f.addressee_id === currentUserId);
      const accepted = enrichedFriendships.filter(f => f.status === 'accepted');

      // Remove duplicates from accepted friends (same friendship can appear twice)
      const uniqueAccepted = accepted.reduce((acc: Friendship[], current) => {
        const friendUserId = current.requester_id === currentUserId ? current.addressee_id : current.requester_id;
        const exists = acc.some(f => {
          const existingFriendId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
          return existingFriendId === friendUserId;
        });
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      console.log('Pending requests:', pending);
      console.log('Accepted friends (unique):', uniqueAccepted);

      setPendingRequests(pending);
      setAcceptedFriends(uniqueAccepted);
    } catch (error: any) {
      console.error('Error fetching friendships:', error);
      toast({
        title: "Error",
        description: "Failed to load friendships",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequest = async (friendshipId: string, action: 'accept' | 'decline') => {
    setActionLoading(prev => [...prev, friendshipId]);

    try {
      if (action === 'accept') {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendshipId);

        if (error) throw error;

        toast({
          title: "Friend request accepted!",
          description: "You can now start chatting with your new friend."
        });
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', friendshipId);

        if (error) throw error;

        toast({
          title: "Friend request declined",
          description: "The friend request has been removed."
        });
      }

      // Refresh friendships
      fetchFriendships();
    } catch (error: any) {
      console.error('Error handling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to handle friend request",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => prev.filter(id => id !== friendshipId));
    }
  };

  const startChatWithFriend = async (friendUserId: string) => {
    setActionLoading(prev => [...prev, friendUserId]);

    try {
      console.log('Starting chat with friend:', friendUserId);
      
      // Use the create_direct_conversation function
      const { data: conversationId, error } = await supabase
        .rpc('create_direct_conversation', { friend_user_id: friendUserId });

      if (error) {
        console.error('Error starting chat:', error);
        throw error;
      }

      console.log('Conversation created/found:', conversationId);
      onStartChat(conversationId);

      toast({
        title: "Chat started!",
        description: "You can now send messages to your friend."
      });
    } catch (error: any) {
      console.error('Error starting chat:', error);
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => prev.filter(id => id !== friendUserId));
    }
  };

  const getFriendProfile = (friendship: Friendship): Profile | null => {
    if (friendship.requester_id === currentUserId) {
      return friendship.addressee_profile || null;
    } else {
      return friendship.requester_profile || null;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4 sm:py-8">
        <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2 sm:mb-4"></div>
        <p className="text-muted-foreground text-xs sm:text-sm">Loading friends...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 sm:space-y-6">
      {/* Pending Friend Requests */}
      {pendingRequests.length > 0 && (
        <div>
          <div className="flex items-center mb-2 sm:mb-3">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-orange-500" />
            <h3 className="text-sm sm:text-base font-semibold">Pending Requests</h3>
            <Badge variant="secondary" className="ml-2 text-xs">
              {pendingRequests.length}
            </Badge>
          </div>
          <div className="space-y-1 sm:space-y-2">
            {pendingRequests.map((request) => {
              const friend = getFriendProfile(request);
              if (!friend) return null;

              return (
                <div
                  key={request.id}
                  className="p-2 sm:p-3 rounded-lg glass-card hover:glass-effect transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                        <AvatarImage src={friend.avatar_url || ''} />
                        <AvatarFallback>
                          <User className="w-3 h-3 sm:w-5 sm:h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate text-xs sm:text-sm">
                          {friend.display_name || friend.username}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-1 sm:space-x-2">
                      <Button
                        onClick={() => handleFriendRequest(request.id, 'accept')}
                        disabled={actionLoading.includes(request.id)}
                        size="sm"
                        className="liquid-gradient text-white hover:opacity-90 h-7 w-7 sm:h-8 sm:w-8 p-0"
                      >
                        {actionLoading.includes(request.id) ? (
                          <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleFriendRequest(request.id, 'decline')}
                        disabled={actionLoading.includes(request.id)}
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 text-red-500 hover:bg-red-50"
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="flex-1">
        <div className="flex items-center mb-2 sm:mb-3">
          <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500" />
          <h3 className="text-sm sm:text-base font-semibold">Friends</h3>
          <Badge variant="secondary" className="ml-2 text-xs">
            {acceptedFriends.length}
          </Badge>
        </div>

        {acceptedFriends.length === 0 ? (
          <div className="text-center py-4 sm:py-8">
            <UserCheck className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs sm:text-sm">
              No friends yet. Send some friend requests!
            </p>
          </div>
        ) : (
          <div className="space-y-1 sm:space-y-2">
            {acceptedFriends.map((friendship) => {
              const friend = getFriendProfile(friendship);
              if (!friend) return null;

              return (
                <div
                  key={friendship.id}
                  className="p-2 sm:p-3 rounded-lg glass-card hover:glass-effect transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                        <AvatarImage src={friend.avatar_url || ''} />
                        <AvatarFallback>
                          <User className="w-3 h-3 sm:w-5 sm:h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate text-xs sm:text-sm">
                          {friend.display_name || friend.username}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => startChatWithFriend(friend.id)}
                      disabled={actionLoading.includes(friend.id)}
                      size="sm"
                      className="liquid-gradient text-white hover:opacity-90 h-7 w-7 sm:h-8 sm:w-8 p-0"
                    >
                      {actionLoading.includes(friend.id) ? (
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
