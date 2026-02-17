-- Storage policies for the receipts bucket.
-- Allow anonymous uploads and reads (Phase 1 has no Supabase Auth).

CREATE POLICY "Allow public uploads"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow public reads"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'receipts');
