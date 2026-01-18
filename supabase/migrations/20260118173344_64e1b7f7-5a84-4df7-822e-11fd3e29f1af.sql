-- Atualizar a função handle_venda_insert para criar lançamentos separados em PARCELAMENTO e REFORÇO
CREATE OR REPLACE FUNCTION public.handle_venda_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quadra text;
  v_numero_lote text;
  v_descricao_lote text;
  v_observacao_lote text;
  v_saldo_parcelamento numeric;
  v_saldo_reforco numeric;
  v_valor_parcelamento numeric;
  v_valor_reforco numeric;
BEGIN
  -- Buscar informações do lote
  SELECT quadra, numero_lote 
  INTO v_quadra, v_numero_lote
  FROM public.lotes 
  WHERE id = NEW.lote_id;

  -- Montar descrição do lote
  v_descricao_lote := 'Venda do Lote - Quadra ' || v_quadra || ' - Lote ' || v_numero_lote;

  -- Montar observação do lote vendido
  v_observacao_lote := 'Lote vendido em ' || TO_CHAR(NEW.data_venda, 'DD/MM/YYYY') || ' para o comprador ' || COALESCE(NEW.comprador_nome_1, '');
  
  IF NEW.comprador_nome_2 IS NOT NULL AND NEW.comprador_nome_2 <> '' THEN
    v_observacao_lote := v_observacao_lote || ' / ' || NEW.comprador_nome_2;
  END IF;

  -- 1️⃣ Atualizar observações do lote
  UPDATE public.lotes 
  SET observacoes = v_observacao_lote,
      updated_at = now()
  WHERE id = NEW.lote_id;

  -- Calcular valores para PARCELAMENTO e REFORÇO
  v_valor_reforco := COALESCE(NEW.valor_reforco, 0);
  v_valor_parcelamento := NEW.valor_venda - v_valor_reforco;

  -- 2️⃣ Calcular saldo anterior da conta corrente do lote para PARCELAMENTO
  SELECT COALESCE(SUM(COALESCE(debito, 0)) - SUM(COALESCE(credito, 0)), 0)
  INTO v_saldo_parcelamento
  FROM public.conta_corrente_lote
  WHERE lote_id = NEW.lote_id AND tipo_fluxo = 'PARCELAMENTO';

  -- 3️⃣ Criar lançamento na conta corrente para PARCELAMENTO
  IF v_valor_parcelamento > 0 THEN
    INSERT INTO public.conta_corrente_lote (
      lote_id,
      venda_id,
      data_mov,
      tipo_mov,
      tipo_fluxo,
      descricao,
      debito,
      credito,
      saldo,
      referencia
    ) VALUES (
      NEW.lote_id,
      NEW.id,
      NEW.data_venda,
      'VENDA',
      'PARCELAMENTO',
      v_descricao_lote,
      v_valor_parcelamento,
      0,
      v_saldo_parcelamento + v_valor_parcelamento,
      TO_CHAR(NEW.data_venda, 'YYYY-MM')
    );
  END IF;

  -- 4️⃣ Calcular saldo anterior para REFORÇO
  SELECT COALESCE(SUM(COALESCE(debito, 0)) - SUM(COALESCE(credito, 0)), 0)
  INTO v_saldo_reforco
  FROM public.conta_corrente_lote
  WHERE lote_id = NEW.lote_id AND tipo_fluxo = 'REFORCO';

  -- 5️⃣ Criar lançamento na conta corrente para REFORÇO (se houver valor de reforço)
  IF v_valor_reforco > 0 THEN
    INSERT INTO public.conta_corrente_lote (
      lote_id,
      venda_id,
      data_mov,
      tipo_mov,
      tipo_fluxo,
      descricao,
      debito,
      credito,
      saldo,
      referencia
    ) VALUES (
      NEW.lote_id,
      NEW.id,
      NEW.data_venda,
      'VENDA',
      'REFORCO',
      v_descricao_lote,
      v_valor_reforco,
      0,
      v_saldo_reforco + v_valor_reforco,
      TO_CHAR(NEW.data_venda, 'YYYY-MM')
    );
  END IF;

  RETURN NEW;
END;
$function$;