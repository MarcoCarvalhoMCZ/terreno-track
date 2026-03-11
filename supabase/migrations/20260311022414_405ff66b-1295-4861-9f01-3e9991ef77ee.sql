
CREATE TABLE public.parcelas_abertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  quadra TEXT NOT NULL,
  numero_lote TEXT NOT NULL,
  tipo_fluxo TEXT NOT NULL DEFAULT 'PARCELAMENTO',
  numero_parcela INTEGER NOT NULL,
  total_parcelas INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor_parcela NUMERIC NOT NULL DEFAULT 0,
  juros_percentual NUMERIC DEFAULT 0,
  valor_juros NUMERIC DEFAULT 0,
  valor_multa NUMERIC DEFAULT 0,
  total_devido NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ABERTO',
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  UNIQUE(lote_id, tipo_fluxo, numero_parcela)
);

ALTER TABLE public.parcelas_abertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage parcelas_abertas"
  ON public.parcelas_abertas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE POLICY "Authenticated can view parcelas_abertas"
  ON public.parcelas_abertas FOR SELECT TO authenticated
  USING (true);
