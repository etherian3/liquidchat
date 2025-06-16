
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ChatApp from '@/components/chat/ChatApp';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, LogIn, UserPlus } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 liquid-gradient rounded-full flex items-center justify-center animate-pulse-slow">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
      </div>
    );
  }

  if (user) {
    return <ChatApp />;
  }

  return (
    <div className="min-h-screen p-4 animate-fade-in">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 liquid-gradient rounded-full opacity-20 animate-float"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full opacity-15 animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <Card className="glass-effect p-12 text-center animate-scale-in">
          <div className="w-24 h-24 liquid-gradient rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-slow">
            <MessageCircle className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            LiquidChat
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the future of communication with real-time messaging, 
            beautiful liquid glass design, and seamless friend connections.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card p-6 rounded-xl">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 text-purple-500" />
              <h3 className="font-semibold mb-2">Real-time Chat</h3>
              <p className="text-sm text-muted-foreground">
                Instant messaging with image sharing and emoji support
              </p>
            </div>
            
            <div className="glass-card p-6 rounded-xl">
              <UserPlus className="w-8 h-8 mx-auto mb-3 text-blue-500" />
              <h3 className="font-semibold mb-2">Friend System</h3>
              <p className="text-sm text-muted-foreground">
                Add friends by username and start conversations
              </p>
            </div>
            
            <div className="glass-card p-6 rounded-xl">
              <LogIn className="w-8 h-8 mx-auto mb-3 text-pink-500" />
              <h3 className="font-semibold mb-2">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">
                Your conversations are protected and private
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/auth')}
              className="liquid-gradient text-white hover:opacity-90 transition-all duration-300 px-8 py-3"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Get Started
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
