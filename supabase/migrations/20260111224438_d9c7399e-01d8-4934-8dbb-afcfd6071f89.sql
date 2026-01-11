-- Adicionar campos de 1º vencimento para Parcelamento e Reforço na tabela vendas
ALTER TABLE public.vendas
ADD COLUMN primeiro_vencimento_parcela date,
ADD COLUMN primeiro_vencimento_reforco date;

-- Comentários para documentação
COMMENT ON COLUMN public.vendas.primeiro_vencimento_parcela IS 'Data do primeiro vencimento do parcelamento';
COMMENT ON COLUMN public.vendas.primeiro_vencimento_reforco IS 'Data do primeiro vencimento do reforço';