-- Remove old check constraint and add new one with all movement types
ALTER TABLE public.conta_corrente_lote DROP CONSTRAINT IF EXISTS conta_corrente_lote_tipo_mov_check;

ALTER TABLE public.conta_corrente_lote 
ADD CONSTRAINT conta_corrente_lote_tipo_mov_check 
CHECK (tipo_mov IN ('VENDA', 'ARRAS', 'PARCELA', 'REFORCO', 'JUROS', 'MULTA', 'ATUALIZACAO', 'DESCONTO', 'ESTORNO', 'OUTROS'));