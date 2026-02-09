
-- Tabela de controle de parcelas pagas (baseline)
CREATE TABLE public.parcelas_controle (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES public.lotes(id),
  tipo_fluxo text NOT NULL DEFAULT 'PARCELAMENTO',
  data_base date NOT NULL,
  qtd_pagas_base integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  UNIQUE(lote_id, tipo_fluxo)
);

-- Enable RLS
ALTER TABLE public.parcelas_controle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage parcelas_controle"
ON public.parcelas_controle FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE POLICY "Authenticated can view parcelas_controle"
ON public.parcelas_controle FOR SELECT
USING (true);
