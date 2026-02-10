
-- Create table for sale documents
CREATE TABLE public.venda_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID DEFAULT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID DEFAULT NULL
);

ALTER TABLE public.venda_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view venda_documentos"
  ON public.venda_documentos FOR SELECT USING (true);

CREATE POLICY "Admins and operators can manage venda_documentos"
  ON public.venda_documentos FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

-- Create storage bucket for sale documents
INSERT INTO storage.buckets (id, name, public) VALUES ('venda-documentos', 'venda-documentos', true);

-- Storage policies
CREATE POLICY "Authenticated can view venda documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'venda-documentos');

CREATE POLICY "Admins and operators can upload venda documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'venda-documentos' AND (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)));

CREATE POLICY "Admins and operators can delete venda documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'venda-documentos' AND (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)));
