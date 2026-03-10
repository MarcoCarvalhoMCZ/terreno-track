
-- 1. Add missing columns to contas_contabeis (Plano de Contas)
ALTER TABLE public.contas_contabeis
  ADD COLUMN IF NOT EXISTS codigo_estruturado text,
  ADD COLUMN IF NOT EXISTS tipo_conta text,
  ADD COLUMN IF NOT EXISTS natureza_saldo text;

-- 2. Create mapa_movimento_conta table
CREATE TABLE IF NOT EXISTS public.mapa_movimento_conta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_movimento text NOT NULL,
  conta_contabil_id uuid NOT NULL REFERENCES public.contas_contabeis(id) ON DELETE CASCADE,
  natureza_lancamento text NOT NULL CHECK (natureza_lancamento IN ('D', 'C')),
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  UNIQUE(tipo_movimento, natureza_lancamento)
);

ALTER TABLE public.mapa_movimento_conta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage mapa_movimento_conta"
  ON public.mapa_movimento_conta FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE POLICY "Authenticated can view mapa_movimento_conta"
  ON public.mapa_movimento_conta FOR SELECT TO authenticated
  USING (true);

-- 3. Create consolidacao_contabil table
CREATE TABLE IF NOT EXISTS public.consolidacao_contabil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  conta_contabil_id uuid NOT NULL REFERENCES public.contas_contabeis(id) ON DELETE CASCADE,
  valor_debito numeric DEFAULT 0,
  valor_credito numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  UNIQUE(ano, mes, conta_contabil_id)
);

ALTER TABLE public.consolidacao_contabil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage consolidacao_contabil"
  ON public.consolidacao_contabil FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE POLICY "Authenticated can view consolidacao_contabil"
  ON public.consolidacao_contabil FOR SELECT TO authenticated
  USING (true);
