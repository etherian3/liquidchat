import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, UserPlus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UserListProps {
  currentUserId: string;
}

const UserList = ({ currentUserId }: UserListProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingRequests, setSendingRequests] = useState<string[]>([]);

  useEffect(() => {
    fetchAvailableUsers();
    
    // Subscribe to friendship changes to refresh available users
    const channel = supabase
      .channel('userlist_friendships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          console.log('Friendship change detected in UserList, refreshing...');
          fetchAvailableUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchAvailableUsers = async () => {
    try {
      console.log('Fetching available users for:', currentUserId);
      
      // Get all users except current user
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', currentUserId);

      if (usersError) throw usersError;

      // Get existing friendships to filter out users we already have relationships with
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

      if (friendshipsError) throw friendshipsError;

      console.log('Current friendships:', friendships);

      // Filter out users we already have friendships with (any status)
      const existingRelationships = new Set();
      friendships?.forEach(friendship => {
        if (friendship.requester_id === currentUserId) {
          existingRelationships.add(friendship.addressee_id);
        } else {
          existingRelationships.add(friendship.requester_id);
        }
      });

      console.log('Existing relationships:', Array.from(existingRelationships));

      const availableUsers = allUsers?.filter(user => 
        !existingRelationships.has(user.id)
      ) || [];

      console.log('Available users after filtering:', availableUsers);
      setUsers(availableUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string, username: string) => {
    setSendingRequests(prev => [...prev, targetUserId]);

    try {
      console.log('Sending friend request to:', targetUserId);
      
      // Check if friendship already exists in either direction
      const { data: existingFriendship, error: checkError } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFriendship) {
        toast({
          title: "Relationship already exists",
          description: "You already have a relationship with this user",
          variant: "destructive"
        });
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: currentUserId,
          addressee_id: targetUserId,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Friend request already exists",
            description: "You've already sent a friend request to this user",
            variant: "destructive"
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Friend request sent!",
          description: `Friend request sent to @${username}`
        });
        
        // Remove user from available list immediately
        setUsers(prev => prev.filter(user => user.id !== targetUserId));
      }
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    } finally {
      setSendingRequests(prev => prev.filter(id => id !== targetUserId));
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="text-center py-4 sm:py-8">
        <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2 sm:mb-4"></div>
        <p className="text-muted-foreground text-xs sm:text-sm">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold flex items-center">
          <User className="w-3 h-3 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Find Users</span>
          <span className="sm:hidden">Find</span>
        </h2>
      </div>

      <div className="mb-2 sm:mb-4">
        <div className="relative">
          <Search className="w-3 h-3 sm:w-4 sm:h-4 absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-card border-white/30 pl-8 sm:pl-10 h-8 sm:h-10 text-xs sm:text-sm"
            placeholder="Search users..."
          />
        </div>
      </div>

      <div className="flex-1 space-y-1 sm:space-y-2 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-4 sm:py-8">
            <User className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs sm:text-sm">
              {searchTerm ? 'No users found matching your search' : 'No available users to add'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="p-2 sm:p-3 rounded-lg glass-card hover:glass-effect transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback>
                      <User className="w-3 h-3 sm:w-5 sm:h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate text-xs sm:text-sm">
                      {user.display_name || user.username}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => sendFriendRequest(user.id, user.username)}
                  disabled={sendingRequests.includes(user.id)}
                  size="sm"
                  className="liquid-gradient text-white hover:opacity-90 h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  {sendingRequests.includes(user.id) ? (
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserList;
