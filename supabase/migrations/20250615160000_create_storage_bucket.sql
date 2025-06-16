
-- Create storage bucket for message images
INSERT INTO storage.buckets (id, name, public) VALUES ('message-images', 'message-images', true);

-- Create policy to allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'message-images' AND auth.role() = 'authenticated');

-- Create policy to allow public access to images
CREATE POLICY "Allow public access" ON storage.objects FOR SELECT USING (bucket_id = 'message-images');

-- Create policy to allow users to delete their own images
CREATE POLICY "Allow users to delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'message-images' AND auth.uid()::text = (storage.foldername(name))[1]);
