
-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logotipos', 'logotipos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to view logos
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logotipos');

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logotipos' AND auth.role() = 'authenticated');

-- Allow authenticated users to update logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logotipos' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logotipos' AND auth.role() = 'authenticated');
