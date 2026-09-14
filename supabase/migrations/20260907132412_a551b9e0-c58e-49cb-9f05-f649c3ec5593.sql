ALTER TABLE public.ai_analysis_config
  ADD COLUMN IF NOT EXISTS reference_images jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Tenant members read ppe reference"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ppe-reference'
  AND EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members upload ppe reference"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ppe-reference'
  AND EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members delete ppe reference"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ppe-reference'
  AND EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);