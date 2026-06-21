
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Screenshots are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own screenshot files" ON storage.objects;

CREATE POLICY "Users can view own screenshot files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'screenshots'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own screenshot files" ON storage.objects;
CREATE POLICY "Users can update own screenshot files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'screenshots'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'screenshots'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
