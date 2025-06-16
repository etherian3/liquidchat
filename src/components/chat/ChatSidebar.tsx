import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, MessageCircle } from 'lucide-react';
import UserList from './UserList';
import Friends from './Friends';

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onRefreshConversations: () => void;
  currentUserId: string;
}

const ChatSidebar = ({ 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  onRefreshConversations,
  currentUserId
}: ChatSidebarProps) => {
  const formatConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    return conversation.is_group ? 'Group Chat' : 'Direct Message';
  };

  const handleStartChat = (conversationId: string) => {
    onSelectConversation(conversationId);
    onRefreshConversations();
  };

  return (
    <Card className="glass-effect p-3 sm:p-4 h-full flex-1 min-h-0 flex flex-col">
      <Tabs defaultValue="chats" className="flex-1 flex flex-col">
        <TabsList className="glass-card w-full grid grid-cols-3 h-9 sm:h-10 text-xs sm:text-sm mb-3">
          <TabsTrigger value="chats" className="px-2 sm:px-3">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Chats</span>
          </TabsTrigger>
          <TabsTrigger value="friends" className="px-2 sm:px-3">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Friends</span>
          </TabsTrigger>
          <TabsTrigger value="add" className="px-2 sm:px-3">
            <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Add</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="flex-1 overflow-hidden">
          <div className="h-full space-y-1 overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground/50" />
                <h4 className="font-medium text-sm sm:text-base text-muted-foreground mb-1">No conversations yet</h4>
                <p className="text-xs sm:text-sm text-muted-foreground/80">
                  Add friends to start chatting!
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                    selectedConversation === conversation.id
                      ? 'glass-effect shadow-lg'
                      : 'glass-card hover:glass-effect'
                  }`}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 ring-2 ring-white/20">
                      <AvatarImage src={conversation.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        {conversation.is_group ? <Users className="w-4 h-4 sm:w-5 sm:h-5" /> : <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-sm sm:text-base leading-tight">
                        {formatConversationName(conversation)}
                      </h3>
                      <p className="text-xs text-muted-foreground/70 leading-tight">
                        {new Date(conversation.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="friends" className="flex-1 overflow-hidden">
          <Friends 
            currentUserId={currentUserId}
            onStartChat={handleStartChat}
          />
        </TabsContent>

        <TabsContent value="add" className="flex-1 overflow-hidden">
          <UserList currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ChatSidebar;
