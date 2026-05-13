
-- 1. Add parcela_origem_id to vincular JUROS/MULTA to PARCELA recebida
ALTER TABLE public.conta_corrente_lote
ADD COLUMN IF NOT EXISTS parcela_origem_id uuid REFERENCES public.conta_corrente_lote(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conta_corrente_parcela_origem
ON public.conta_corrente_lote(parcela_origem_id);

-- 2. Auditoria de override manual de juros/multa
CREATE TABLE IF NOT EXISTS public.auditoria_mora_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_id uuid NOT NULL REFERENCES public.conta_corrente_lote(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_original numeric,
  valor_novo numeric,
  motivo text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_mora_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage auditoria_mora_override"
ON public.auditoria_mora_override
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE POLICY "Admins can view auditoria_mora_override"
ON public.auditoria_mora_override
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 3. Trigger: JUROS e MULTA devem estar vinculados a uma parcela recebida
CREATE OR REPLACE FUNCTION public.validar_vinculo_juros_multa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo_mov IN ('JUROS', 'MULTA') AND NEW.parcela_origem_id IS NULL THEN
    RAISE EXCEPTION 'Movimentos JUROS e MULTA devem estar vinculados a uma parcela recebida (parcela_origem_id obrigatório).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_vinculo_juros_multa ON public.conta_corrente_lote;
CREATE TRIGGER trg_validar_vinculo_juros_multa
BEFORE INSERT ON public.conta_corrente_lote
FOR EACH ROW
EXECUTE FUNCTION public.validar_vinculo_juros_multa();
