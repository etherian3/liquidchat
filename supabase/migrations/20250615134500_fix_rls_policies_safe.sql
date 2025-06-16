
-- Drop all existing RLS policies to start fresh
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.user_can_access_conversation(conversation_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_participants.conversation_id = $1 
    AND conversation_participants.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_conversation_creator(conversation_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = $1 
    AND conversations.created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Simple RLS policies using security definer functions
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  USING (public.user_can_access_conversation(id));

CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view conversation participants"
  ON public.conversation_participants
  FOR SELECT
  USING (public.user_can_access_conversation(conversation_id));

CREATE POLICY "Users can join conversations"
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR 
    public.user_is_conversation_creator(conversation_id)
  );

CREATE POLICY "Users can view their messages"
  ON public.messages
  FOR SELECT
  USING (public.user_can_access_conversation(conversation_id));

CREATE POLICY "Users can send messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND 
    public.user_can_access_conversation(conversation_id)
  );

CREATE POLICY "Users can update their messages"
  ON public.messages
  FOR UPDATE
  USING (sender_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
