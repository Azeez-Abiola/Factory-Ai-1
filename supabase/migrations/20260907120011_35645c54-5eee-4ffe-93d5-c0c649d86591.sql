CREATE POLICY "Tenant members can view alert evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'alert-evidence'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);