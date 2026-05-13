CREATE TABLE IF NOT EXISTS public.mensagem_extrato_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem text,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagem_extrato_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and operators can manage mensagem_extrato_historico" ON public.mensagem_extrato_historico;
CREATE POLICY "Admins and operators can manage mensagem_extrato_historico"
ON public.mensagem_extrato_historico
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

CREATE OR REPLACE FUNCTION public.tg_configuracoes_mensagem_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.mensagem_extrato, '') IS DISTINCT FROM COALESCE(OLD.mensagem_extrato, '') THEN
    INSERT INTO public.mensagem_extrato_historico (mensagem, alterado_por, alterado_em)
    VALUES (OLD.mensagem_extrato, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_configuracoes_mensagem_historico ON public.configuracoes;
CREATE TRIGGER tg_configuracoes_mensagem_historico
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.tg_configuracoes_mensagem_historico();

CREATE INDEX IF NOT EXISTS idx_mensagem_extrato_historico_alterado_em
  ON public.mensagem_extrato_historico (alterado_em DESC);