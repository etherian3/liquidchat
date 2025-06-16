
-- Add delete policy for messages that was missing
CREATE POLICY "Users can delete their messages"
  ON public.messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- Enable realtime for conversation_participants table (if not already enabled)
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    END IF;
END $$;

-- Enable realtime for conversations table (if not already enabled)
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
END $$;
