-- A) AJUSTES E INCLUSÕES DE CAMPOS NA TABELA VENDAS

-- 1️⃣ Adicionar campos dos compradores
ALTER TABLE public.vendas 
ADD COLUMN comprador_nome_1 text,
ADD COLUMN comprador_cpf_1 text,
ADD COLUMN comprador_nome_2 text,
ADD COLUMN comprador_cpf_2 text;

-- 2️⃣ Criar enum para tipo de atualização monetária
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_atualizacao_monetaria') THEN
    CREATE TYPE tipo_atualizacao_monetaria AS ENUM ('IGPM', 'MEDIA');
  END IF;
END $$;

-- Adicionar campo de tipo de atualização e defasagem
ALTER TABLE public.vendas 
ADD COLUMN tipo_atualizacao tipo_atualizacao_monetaria DEFAULT 'IGPM',
ADD COLUMN defasagem_indice integer DEFAULT 1;

-- Comentários para documentação
COMMENT ON COLUMN public.vendas.comprador_nome_1 IS 'Nome do 1º comprador (solidário)';
COMMENT ON COLUMN public.vendas.comprador_cpf_1 IS 'CPF do 1º comprador';
COMMENT ON COLUMN public.vendas.comprador_nome_2 IS 'Nome do 2º comprador (solidário, opcional)';
COMMENT ON COLUMN public.vendas.comprador_cpf_2 IS 'CPF do 2º comprador (opcional)';
COMMENT ON COLUMN public.vendas.tipo_atualizacao IS 'Tipo de índice de atualização monetária (IGPM ou MEDIA)';
COMMENT ON COLUMN public.vendas.defasagem_indice IS 'Defasagem do índice em meses (1 = mês anterior, 2 = dois meses anteriores)';

-- B) TRIGGER PARA AÇÕES AUTOMÁTICAS AO GRAVAR UMA VENDA

-- Função para atualizar observações do lote e criar lançamento na conta corrente
CREATE OR REPLACE FUNCTION public.handle_venda_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_quadra text;
  v_numero_lote text;
  v_descricao_lote text;
  v_observacao_lote text;
  v_saldo_anterior numeric;
BEGIN
  -- Buscar informações do lote
  SELECT quadra, numero_lote 
  INTO v_quadra, v_numero_lote
  FROM public.lotes 
  WHERE id = NEW.lote_id;

  -- Montar descrição do lote
  v_descricao_lote := 'Quadra ' || v_quadra || ' – Lote ' || v_numero_lote;

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

  -- 2️⃣ Calcular saldo anterior da conta corrente do lote
  SELECT COALESCE(SUM(debito) - SUM(credito), 0)
  INTO v_saldo_anterior
  FROM public.conta_corrente_lote
  WHERE lote_id = NEW.lote_id;

  -- 3️⃣ Criar lançamento automático na conta corrente
  INSERT INTO public.conta_corrente_lote (
    lote_id,
    venda_id,
    data_mov,
    tipo_mov,
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
    v_descricao_lote,
    NEW.valor_venda,
    0,
    v_saldo_anterior + NEW.valor_venda,
    TO_CHAR(NEW.data_venda, 'YYYY-MM')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para inserção de vendas
DROP TRIGGER IF EXISTS trigger_handle_venda_insert ON public.vendas;
CREATE TRIGGER trigger_handle_venda_insert
  AFTER INSERT ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_venda_insert();

-- C) FUNÇÃO PARA CÁLCULO DE ATUALIZAÇÃO MONETÁRIA EM LOTE

CREATE OR REPLACE FUNCTION public.calcular_atualizacao_monetaria_lote(
  p_competencia date,
  p_lote_id uuid DEFAULT NULL
)
RETURNS TABLE(
  lote_id uuid,
  venda_id uuid,
  saldo_anterior numeric,
  percentual_aplicado numeric,
  valor_atualizacao numeric,
  novo_saldo numeric
) AS $$
DECLARE
  v_venda RECORD;
  v_saldo numeric;
  v_percentual numeric;
  v_valor_atualizacao numeric;
  v_competencia_indice date;
  v_primeiro_mes_atualizacao date;
BEGIN
  -- Processar vendas ativas (ou apenas uma se p_lote_id for informado)
  FOR v_venda IN 
    SELECT v.id as venda_id, v.lote_id, v.data_venda, v.tipo_atualizacao, v.defasagem_indice
    FROM public.vendas v
    WHERE v.status = 'ATIVA'
      AND (p_lote_id IS NULL OR v.lote_id = p_lote_id)
  LOOP
    -- Verificar se a venda já pode receber atualização (primeiro dia do mês subsequente à compra)
    v_primeiro_mes_atualizacao := DATE_TRUNC('month', v_venda.data_venda) + INTERVAL '1 month';
    
    IF p_competencia >= v_primeiro_mes_atualizacao THEN
      -- Calcular competência do índice com base na defasagem
      v_competencia_indice := p_competencia - (COALESCE(v_venda.defasagem_indice, 1) * INTERVAL '1 month');
      
      -- Buscar o índice de atualização
      SELECT iav.fator INTO v_percentual
      FROM public.indicadores_atualizacao ia
      JOIN public.indicadores_atualizacao_valores iav ON ia.id = iav.indicador_id
      WHERE UPPER(ia.nome) = v_venda.tipo_atualizacao::text
        AND iav.competencia = DATE_TRUNC('month', v_competencia_indice)
      ORDER BY iav.competencia DESC
      LIMIT 1;

      -- Se não encontrar índice, usar 0
      v_percentual := COALESCE(v_percentual, 0);

      -- Calcular saldo atual do lote (Sistema de Bases Correntes)
      SELECT COALESCE(SUM(debito) - SUM(credito), 0)
      INTO v_saldo
      FROM public.conta_corrente_lote
      WHERE conta_corrente_lote.lote_id = v_venda.lote_id;

      -- Calcular valor da atualização
      v_valor_atualizacao := ROUND(v_saldo * (v_percentual / 100), 2);

      -- Retornar resultado
      lote_id := v_venda.lote_id;
      venda_id := v_venda.venda_id;
      saldo_anterior := v_saldo;
      percentual_aplicado := v_percentual;
      valor_atualizacao := v_valor_atualizacao;
      novo_saldo := v_saldo + v_valor_atualizacao;
      
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- D) FUNÇÃO PARA EXECUTAR ATUALIZAÇÃO MONETÁRIA (GRAVA NA CONTA CORRENTE)

CREATE OR REPLACE FUNCTION public.executar_atualizacao_monetaria(
  p_competencia date,
  p_lote_id uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_resultado RECORD;
  v_count integer := 0;
  v_referencia text;
BEGIN
  v_referencia := TO_CHAR(p_competencia, 'YYYY-MM');

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
        p_competencia,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- E) FUNÇÃO PARA RECALCULAR SALDO DE UM LOTE (BASE CORRENTE)

CREATE OR REPLACE FUNCTION public.recalcular_saldo_lote(p_lote_id uuid)
RETURNS numeric AS $$
DECLARE
  v_saldo numeric := 0;
  v_mov RECORD;
BEGIN
  -- Recalcular saldo sequencialmente por data
  FOR v_mov IN 
    SELECT id, debito, credito
    FROM public.conta_corrente_lote
    WHERE lote_id = p_lote_id
    ORDER BY data_mov, created_at
  LOOP
    v_saldo := v_saldo + COALESCE(v_mov.debito, 0) - COALESCE(v_mov.credito, 0);
    
    UPDATE public.conta_corrente_lote
    SET saldo = v_saldo
    WHERE id = v_mov.id;
  END LOOP;

  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;