-- Adicionar novos campos de parcelamento e reforço na tabela vendas
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS valor_parcelamento numeric,
ADD COLUMN IF NOT EXISTS qtd_parcelas integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS frequencia_parcelas_meses integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS valor_reforco numeric,
ADD COLUMN IF NOT EXISTS qtd_reforcos integer,
ADD COLUMN IF NOT EXISTS frequencia_reforcos_meses integer;

-- Comentários para documentação
COMMENT ON COLUMN public.vendas.valor_parcelamento IS 'Valor de cada parcela';
COMMENT ON COLUMN public.vendas.qtd_parcelas IS 'Quantidade de parcelas';
COMMENT ON COLUMN public.vendas.frequencia_parcelas_meses IS 'Frequência das parcelas em meses (1=mensal, 2=bimestral, etc)';
COMMENT ON COLUMN public.vendas.valor_reforco IS 'Valor de cada reforço';
COMMENT ON COLUMN public.vendas.qtd_reforcos IS 'Quantidade de reforços';
COMMENT ON COLUMN public.vendas.frequencia_reforcos_meses IS 'Frequência dos reforços em meses';