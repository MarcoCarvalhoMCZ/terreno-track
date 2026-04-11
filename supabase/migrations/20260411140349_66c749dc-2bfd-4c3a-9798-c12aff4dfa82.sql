
-- Add column for default extract path pattern
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS pasta_extratos_padrao text DEFAULT 'extratos/{ano}-{mes}/';

-- Create storage bucket for batch extracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('extratos-lote', 'extratos-lote', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read files
CREATE POLICY "Authenticated can view extratos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'extratos-lote');

-- Allow admins and operators to upload/manage files
CREATE POLICY "Admins and operators can manage extratos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'extratos-lote'
  AND (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'OPERADOR'::public.app_role)
  )
);

CREATE POLICY "Admins and operators can update extratos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'extratos-lote'
  AND (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'OPERADOR'::public.app_role)
  )
);

CREATE POLICY "Admins and operators can delete extratos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'extratos-lote'
  AND (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'OPERADOR'::public.app_role)
  )
);
