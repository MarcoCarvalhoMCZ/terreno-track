-- 1. Restrict vendas SELECT to ADMIN/OPERADOR (PII)
DROP POLICY IF EXISTS "Authenticated can view vendas" ON public.vendas;
CREATE POLICY "Authorized roles can view vendas"
ON public.vendas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

-- 2. Restrict conta_corrente_lote SELECT to ADMIN/OPERADOR (cpf_cnpj_pagador)
DROP POLICY IF EXISTS "Authenticated can view conta_corrente_lote" ON public.conta_corrente_lote;
CREATE POLICY "Authorized roles can view conta_corrente_lote"
ON public.conta_corrente_lote FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

-- 3. Make venda-documentos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'venda-documentos';

-- 4. Set security_invoker on views (so RLS of caller applies)
ALTER VIEW public.vw_totalizacao_mensal_consolidada SET (security_invoker = true);
ALTER VIEW public.vw_totalizacao_mensal_por_lote SET (security_invoker = true);
ALTER VIEW public.vw_resumo_fluxo_lote SET (security_invoker = true);
ALTER VIEW public.vw_resumo_operacoes_lote SET (security_invoker = true);

-- 5. Add role checks to high-impact SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.executar_atualizacao_monetaria(p_competencia date, p_lote_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultado RECORD;
  v_count integer := 0;
  v_referencia text;
  v_data_registro date;
BEGIN
  IF NOT (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil ADMIN ou OPERADOR';
  END IF;

  v_referencia := TO_CHAR(p_competencia, 'YYYY-MM');
  v_data_registro := DATE_TRUNC('month', p_competencia) + INTERVAL '1 month';

  IF p_lote_id IS NOT NULL THEN
    DELETE FROM public.conta_corrente_lote
    WHERE lote_id = p_lote_id
      AND tipo_mov = 'ATUALIZACAO'
      AND referencia = v_referencia;
  END IF;

  FOR v_resultado IN 
    SELECT * FROM public.calcular_atualizacao_monetaria_lote(p_competencia, p_lote_id)
    WHERE valor_atualizacao > 0
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.conta_corrente_lote
      WHERE lote_id = v_resultado.lote_id
        AND tipo_mov = 'ATUALIZACAO'
        AND referencia = v_referencia
    ) THEN
      INSERT INTO public.conta_corrente_lote (
        lote_id, venda_id, data_mov, tipo_mov, descricao,
        percentual_calculo, debito, credito, saldo, referencia
      ) VALUES (
        v_resultado.lote_id, v_resultado.venda_id, v_data_registro,
        'ATUALIZACAO',
        'Atualização Monetária - ' || TO_CHAR(p_competencia, 'MM/YYYY'),
        v_resultado.percentual_aplicado, v_resultado.valor_atualizacao,
        0, v_resultado.novo_saldo, v_referencia
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reorganizar_todos_lotes()
 RETURNS TABLE(lote_id uuid, tipo_fluxo text, registros_processados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lote RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil ADMIN ou OPERADOR';
  END IF;

  FOR v_lote IN SELECT DISTINCT l.id FROM lotes l
  LOOP
    RETURN QUERY
    SELECT v_lote.id, r.tipo_fluxo, r.registros_processados
    FROM reorganizar_lote_completo(v_lote.id) r;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reorganizar_lote_completo(p_lote_id uuid)
 RETURNS TABLE(tipo_fluxo text, registros_processados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil ADMIN ou OPERADOR';
  END IF;

  RETURN QUERY
  SELECT 'PARCELAMENTO'::TEXT, reorganizar_conta_corrente_fluxo(p_lote_id, 'PARCELAMENTO');
  
  RETURN QUERY
  SELECT 'REFORCO'::TEXT, reorganizar_conta_corrente_fluxo(p_lote_id, 'REFORCO');
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_atualizacao_fluxo(p_lote_id uuid, p_tipo_fluxo text, p_competencia date, p_fator numeric, p_descricao text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo_anterior NUMERIC;
  v_valor_atualizacao NUMERIC;
  v_novo_saldo NUMERIC;
  v_novo_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil ADMIN ou OPERADOR';
  END IF;

  v_saldo_anterior := get_saldo_atualizado_fluxo(p_lote_id, p_tipo_fluxo);
  
  IF v_saldo_anterior <= 0 THEN
    RETURN NULL;
  END IF;
  
  v_valor_atualizacao := ROUND(v_saldo_anterior * (p_fator / 100), 2);
  v_novo_saldo := v_saldo_anterior + v_valor_atualizacao;
  
  INSERT INTO conta_corrente_lote (
    lote_id, tipo_fluxo, tipo_mov, data_mov, 
    debito, credito, saldo, percentual_calculo, 
    referencia, descricao
  ) VALUES (
    p_lote_id, p_tipo_fluxo, 'ATUALIZACAO', 
    DATE_TRUNC('month', p_competencia)::DATE,
    v_valor_atualizacao, 0, v_novo_saldo, p_fator,
    TO_CHAR(p_competencia, 'MM/YYYY'),
    COALESCE(p_descricao, 'Atualização monetária ' || p_tipo_fluxo)
  ) RETURNING id INTO v_novo_id;
  
  RETURN v_novo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerar_proximo_titulo_fluxo(p_lote_id uuid, p_tipo_fluxo text, p_vencimento date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor NUMERIC;
  v_saldo_atual NUMERIC;
  v_novo_id UUID;
  v_tipo_mov TEXT;
  v_descricao TEXT;
BEGIN
  IF NOT (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil ADMIN ou OPERADOR';
  END IF;

  v_valor := calcular_proximo_titulo_fluxo(p_lote_id, p_tipo_fluxo);
  
  IF v_valor <= 0 THEN
    RETURN NULL;
  END IF;
  
  v_saldo_atual := get_saldo_atualizado_fluxo(p_lote_id, p_tipo_fluxo);
  
  IF p_tipo_fluxo = 'PARCELAMENTO' THEN
    v_tipo_mov := 'GERACAO_PARCELA';
    v_descricao := 'Geração de título - Parcela';
  ELSE
    v_tipo_mov := 'GERACAO_REFORCO';
    v_descricao := 'Geração de título - Reforço';
  END IF;
  
  INSERT INTO conta_corrente_lote (
    lote_id, tipo_fluxo, tipo_mov, data_mov, vencimento,
    debito, credito, saldo, descricao
  ) VALUES (
    p_lote_id, p_tipo_fluxo, v_tipo_mov, CURRENT_DATE, 
    COALESCE(p_vencimento, CURRENT_DATE + INTERVAL '30 days'),
    v_valor, 0, v_saldo_atual, v_descricao
  ) RETURNING id INTO v_novo_id;
  
  RETURN v_novo_id;
END;
$function$;