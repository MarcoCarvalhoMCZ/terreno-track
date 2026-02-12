
CREATE OR REPLACE FUNCTION public.reorganizar_conta_corrente_fluxo(p_lote_id uuid, p_tipo_fluxo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_registro RECORD;
  v_saldo_acumulado NUMERIC := 0;
  v_count INTEGER := 0;
  v_venda RECORD;
  v_valor_esperado NUMERIC;
  v_venda_mov RECORD;
BEGIN
  -- ============================================================
  -- ETAPA 1: Buscar venda ativa do lote
  -- ============================================================
  SELECT v.id, v.valor_venda, COALESCE(v.valor_reforco, 0) AS valor_reforco, v.data_venda,
         l.quadra, l.numero_lote
  INTO v_venda
  FROM vendas v
  JOIN lotes l ON l.id = v.lote_id
  WHERE v.lote_id = p_lote_id AND v.status = 'ATIVA'
  LIMIT 1;

  IF v_venda.id IS NOT NULL THEN
    -- Calcular valor esperado para este fluxo
    IF p_tipo_fluxo = 'PARCELAMENTO' THEN
      v_valor_esperado := v_venda.valor_venda - v_venda.valor_reforco;
    ELSE
      v_valor_esperado := v_venda.valor_reforco;
    END IF;

    IF v_valor_esperado > 0 THEN
      -- Verificar se já existe registro de VENDA para este fluxo
      SELECT id, debito INTO v_venda_mov
      FROM conta_corrente_lote
      WHERE lote_id = p_lote_id
        AND tipo_fluxo = p_tipo_fluxo
        AND tipo_mov = 'VENDA'
      ORDER BY data_mov ASC, created_at ASC
      LIMIT 1;

      IF v_venda_mov.id IS NULL THEN
        INSERT INTO conta_corrente_lote (
          lote_id, venda_id, data_mov, tipo_mov, tipo_fluxo,
          descricao, debito, credito, saldo, referencia
        ) VALUES (
          p_lote_id, v_venda.id, v_venda.data_venda, 'VENDA', p_tipo_fluxo,
          'Venda do Lote - Quadra ' || v_venda.quadra || ' - Lote ' || v_venda.numero_lote,
          v_valor_esperado, 0, v_valor_esperado,
          TO_CHAR(v_venda.data_venda, 'YYYY-MM')
        );
        -- Get the new id for duplicate removal
        SELECT id INTO v_venda_mov
        FROM conta_corrente_lote
        WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo AND tipo_mov = 'VENDA'
        ORDER BY created_at DESC LIMIT 1;
      ELSIF v_venda_mov.debito IS DISTINCT FROM v_valor_esperado THEN
        UPDATE conta_corrente_lote
        SET debito = v_valor_esperado, credito = 0, venda_id = v_venda.id,
            data_mov = v_venda.data_venda,
            descricao = 'Venda do Lote - Quadra ' || v_venda.quadra || ' - Lote ' || v_venda.numero_lote,
            referencia = TO_CHAR(v_venda.data_venda, 'YYYY-MM'), updated_at = now()
        WHERE id = v_venda_mov.id;
      END IF;

      -- Remover registros de VENDA duplicados
      DELETE FROM conta_corrente_lote
      WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo
        AND tipo_mov = 'VENDA' AND id <> v_venda_mov.id;

    ELSIF v_valor_esperado = 0 THEN
      DELETE FROM conta_corrente_lote
      WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo AND tipo_mov = 'VENDA';
    END IF;
  END IF;

  -- ============================================================
  -- ETAPA 2: Remover registros duplicados (mesma data, tipo, valor, referência)
  -- ============================================================
  DELETE FROM conta_corrente_lote
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY lote_id, tipo_fluxo, data_mov, tipo_mov,
                       COALESCE(debito,0), COALESCE(credito,0), COALESCE(referencia,'')
          ORDER BY created_at ASC
        ) AS rn
      FROM conta_corrente_lote
      WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo AND tipo_mov <> 'VENDA'
    ) sub
    WHERE rn > 1
  );

  -- ============================================================
  -- ETAPA 3: Recalcular saldos sequencialmente
  -- ============================================================
  FOR v_registro IN 
    SELECT id, debito, credito 
    FROM conta_corrente_lote 
    WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo
    ORDER BY data_mov ASC, created_at ASC
  LOOP
    v_saldo_acumulado := v_saldo_acumulado + COALESCE(v_registro.debito, 0) - COALESCE(v_registro.credito, 0);
    UPDATE conta_corrente_lote SET saldo = v_saldo_acumulado WHERE id = v_registro.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;
