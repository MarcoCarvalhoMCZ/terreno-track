-- Adicionar campos de mora (atraso) na tabela configuracoes
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS juros_mora_percentual numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS multa_mora_percentual numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS criterio_juros_mora text DEFAULT 'MES_SUBSEQUENTE',
ADD COLUMN IF NOT EXISTS tolerancia_dias_juros integer DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.configuracoes.juros_mora_percentual IS 'Percentual de juros de mora mensal (ex: 1.0 = 1% ao mês)';
COMMENT ON COLUMN public.configuracoes.multa_mora_percentual IS 'Percentual de multa por atraso (ex: 2.0 = 2%)';
COMMENT ON COLUMN public.configuracoes.criterio_juros_mora IS 'Critério para cálculo de juros: MES_SUBSEQUENTE ou TOLERANCIA';
COMMENT ON COLUMN public.configuracoes.tolerancia_dias_juros IS 'Número de dias de tolerância após vencimento para início da cobrança de juros';