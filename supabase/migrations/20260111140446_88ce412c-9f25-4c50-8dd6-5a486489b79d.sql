
-- Atualizar função para registrar atualização monetária no PRIMEIRO DIA do mês seguinte
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
  v_referencia := TO_CHAR(p_competencia, 'YYYY-MM');
  
  -- Data de registro: primeiro dia do mês seguinte à competência
  v_data_registro := DATE_TRUNC('month', p_competencia) + INTERVAL '1 month';

  -- Se for recálculo individual, deletar registros anteriores do mês
  IF p_lote_id IS NOT NULL THEN
    DELETE FROM public.conta_corrente_lote
    WHERE lote_id = p_lote_id
      AND tipo_mov = 'ATUALIZACAO'
      AND referencia = v_referencia;
  END IF;

  -- Processar cálculos e inserir na conta corrente
  FOR v_resultado IN 
    SELECT * FROM public.calcular_atualizacao_monetaria_lote(p_competencia, p_lote_id)
    WHERE valor_atualizacao > 0
  LOOP
    -- Verificar se já existe atualização para este lote/mês (evitar duplicidade em lote)
    IF NOT EXISTS (
      SELECT 1 FROM public.conta_corrente_lote
      WHERE lote_id = v_resultado.lote_id
        AND tipo_mov = 'ATUALIZACAO'
        AND referencia = v_referencia
    ) THEN
      INSERT INTO public.conta_corrente_lote (
        lote_id,
        venda_id,
        data_mov,
        tipo_mov,
        descricao,
        percentual_calculo,
        debito,
        credito,
        saldo,
        referencia
      ) VALUES (
        v_resultado.lote_id,
        v_resultado.venda_id,
        v_data_registro,  -- Primeiro dia do mês seguinte
        'ATUALIZACAO',
        'Atualização Monetária - ' || TO_CHAR(p_competencia, 'MM/YYYY'),
        v_resultado.percentual_aplicado,
        v_resultado.valor_atualizacao,
        0,
        v_resultado.novo_saldo,
        v_referencia
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;
