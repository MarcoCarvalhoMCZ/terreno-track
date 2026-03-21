ALTER TABLE public.conta_corrente_lote
DROP CONSTRAINT IF EXISTS conta_corrente_lote_tipo_mov_check;

ALTER TABLE public.conta_corrente_lote
ADD CONSTRAINT conta_corrente_lote_tipo_mov_check
CHECK (
  tipo_mov = ANY (
    ARRAY[
      'VENDA'::text,
      'ARRAS'::text,
      'PARCELA'::text,
      'REFORCO'::text,
      'JUROS'::text,
      'MULTA'::text,
      'ATUALIZACAO'::text,
      'DESCONTO'::text,
      'AMORTIZACAO_ESPECIAL'::text,
      'ESTORNO'::text,
      'OUTROS'::text
    ]
  )
);