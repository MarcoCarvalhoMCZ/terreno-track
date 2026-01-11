-- Adicionar coluna tipo_fluxo para separar PARCELAMENTO e REFORCO
ALTER TABLE public.conta_corrente_lote 
ADD COLUMN IF NOT EXISTS tipo_fluxo TEXT DEFAULT 'PARCELAMENTO';

-- Atualizar registros existentes baseado no tipo_mov
UPDATE public.conta_corrente_lote 
SET tipo_fluxo = 'REFORCO' 
WHERE tipo_mov = 'REFORCO';

UPDATE public.conta_corrente_lote 
SET tipo_fluxo = 'PARCELAMENTO' 
WHERE tipo_fluxo IS NULL OR tipo_fluxo = '';

-- Adicionar constraint para tipo_fluxo
ALTER TABLE public.conta_corrente_lote 
ADD CONSTRAINT check_tipo_fluxo CHECK (tipo_fluxo IN ('PARCELAMENTO', 'REFORCO'));

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_conta_corrente_lote_tipo_fluxo ON public.conta_corrente_lote(tipo_fluxo);
CREATE INDEX IF NOT EXISTS idx_conta_corrente_lote_lote_fluxo ON public.conta_corrente_lote(lote_id, tipo_fluxo);

-- Função: Obter saldo atualizado por fluxo
CREATE OR REPLACE FUNCTION public.get_saldo_atualizado_fluxo(p_lote_id UUID, p_tipo_fluxo TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_saldo NUMERIC;
BEGIN
  SELECT COALESCE(
    (SELECT saldo FROM conta_corrente_lote 
     WHERE lote_id = p_lote_id 
     AND tipo_fluxo = p_tipo_fluxo
     ORDER BY data_mov DESC, created_at DESC 
     LIMIT 1), 0)
  INTO v_saldo;
  
  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Obter quantidade restante por fluxo
CREATE OR REPLACE FUNCTION public.get_qtd_restante_fluxo(p_lote_id UUID, p_tipo_fluxo TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_venda_id UUID;
  v_qtd_total INTEGER;
  v_qtd_pagas INTEGER;
BEGIN
  -- Buscar venda ativa do lote
  SELECT id, 
    CASE WHEN p_tipo_fluxo = 'PARCELAMENTO' THEN COALESCE(qtd_parcelas, 1)
         ELSE COALESCE(qtd_reforcos, 0) END
  INTO v_venda_id, v_qtd_total
  FROM vendas 
  WHERE lote_id = p_lote_id AND status = 'ATIVA'
  LIMIT 1;
  
  IF v_venda_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Contar pagamentos realizados para este fluxo
  SELECT COUNT(*) INTO v_qtd_pagas
  FROM conta_corrente_lote
  WHERE lote_id = p_lote_id
  AND tipo_fluxo = p_tipo_fluxo
  AND tipo_mov IN ('PARCELA', 'REFORCO')
  AND credito > 0;
  
  RETURN GREATEST(v_qtd_total - v_qtd_pagas, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Calcular valor do próximo título por fluxo (Bases Correntes)
CREATE OR REPLACE FUNCTION public.calcular_proximo_titulo_fluxo(p_lote_id UUID, p_tipo_fluxo TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_saldo NUMERIC;
  v_qtd_restante INTEGER;
BEGIN
  v_saldo := get_saldo_atualizado_fluxo(p_lote_id, p_tipo_fluxo);
  v_qtd_restante := get_qtd_restante_fluxo(p_lote_id, p_tipo_fluxo);
  
  IF v_qtd_restante <= 0 OR v_saldo <= 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(v_saldo / v_qtd_restante, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Gerar próximo título (registra na conta corrente)
CREATE OR REPLACE FUNCTION public.gerar_proximo_titulo_fluxo(
  p_lote_id UUID, 
  p_tipo_fluxo TEXT,
  p_vencimento DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_valor NUMERIC;
  v_saldo_atual NUMERIC;
  v_novo_id UUID;
  v_tipo_mov TEXT;
  v_descricao TEXT;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Aplicar atualização monetária por fluxo
CREATE OR REPLACE FUNCTION public.aplicar_atualizacao_fluxo(
  p_lote_id UUID,
  p_tipo_fluxo TEXT,
  p_competencia DATE,
  p_fator NUMERIC,
  p_descricao TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_saldo_anterior NUMERIC;
  v_valor_atualizacao NUMERIC;
  v_novo_saldo NUMERIC;
  v_novo_id UUID;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Recalcular saldos de um lote por fluxo (Reorganização)
CREATE OR REPLACE FUNCTION public.reorganizar_conta_corrente_fluxo(p_lote_id UUID, p_tipo_fluxo TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_registro RECORD;
  v_saldo_acumulado NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  FOR v_registro IN 
    SELECT id, debito, credito 
    FROM conta_corrente_lote 
    WHERE lote_id = p_lote_id AND tipo_fluxo = p_tipo_fluxo
    ORDER BY data_mov ASC, created_at ASC
  LOOP
    v_saldo_acumulado := v_saldo_acumulado + COALESCE(v_registro.debito, 0) - COALESCE(v_registro.credito, 0);
    
    UPDATE conta_corrente_lote 
    SET saldo = v_saldo_acumulado 
    WHERE id = v_registro.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Reorganização completa de um lote (ambos fluxos)
CREATE OR REPLACE FUNCTION public.reorganizar_lote_completo(p_lote_id UUID)
RETURNS TABLE(tipo_fluxo TEXT, registros_processados INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 'PARCELAMENTO'::TEXT, reorganizar_conta_corrente_fluxo(p_lote_id, 'PARCELAMENTO');
  
  RETURN QUERY
  SELECT 'REFORCO'::TEXT, reorganizar_conta_corrente_fluxo(p_lote_id, 'REFORCO');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Reorganização em lote (todos os lotes)
CREATE OR REPLACE FUNCTION public.reorganizar_todos_lotes()
RETURNS TABLE(lote_id UUID, tipo_fluxo TEXT, registros_processados INTEGER) AS $$
DECLARE
  v_lote RECORD;
BEGIN
  FOR v_lote IN SELECT DISTINCT l.id FROM lotes l
  LOOP
    RETURN QUERY
    SELECT v_lote.id, r.tipo_fluxo, r.registros_processados
    FROM reorganizar_lote_completo(v_lote.id) r;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- View: Resumo por fluxo
CREATE OR REPLACE VIEW public.vw_resumo_fluxo_lote AS
SELECT 
  l.id AS lote_id,
  l.quadra,
  l.numero_lote,
  'PARCELAMENTO' AS tipo_fluxo,
  get_saldo_atualizado_fluxo(l.id, 'PARCELAMENTO') AS saldo_atualizado,
  get_qtd_restante_fluxo(l.id, 'PARCELAMENTO') AS qtd_restante,
  calcular_proximo_titulo_fluxo(l.id, 'PARCELAMENTO') AS valor_proximo_titulo
FROM lotes l
WHERE EXISTS (SELECT 1 FROM vendas v WHERE v.lote_id = l.id AND v.status = 'ATIVA')
UNION ALL
SELECT 
  l.id AS lote_id,
  l.quadra,
  l.numero_lote,
  'REFORCO' AS tipo_fluxo,
  get_saldo_atualizado_fluxo(l.id, 'REFORCO') AS saldo_atualizado,
  get_qtd_restante_fluxo(l.id, 'REFORCO') AS qtd_restante,
  calcular_proximo_titulo_fluxo(l.id, 'REFORCO') AS valor_proximo_titulo
FROM lotes l
WHERE EXISTS (SELECT 1 FROM vendas v WHERE v.lote_id = l.id AND v.status = 'ATIVA' AND v.qtd_reforcos > 0);