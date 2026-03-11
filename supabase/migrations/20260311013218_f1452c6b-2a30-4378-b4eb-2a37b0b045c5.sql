
-- Add sequencia_parcela column to conta_corrente_lote
ALTER TABLE public.conta_corrente_lote
ADD COLUMN sequencia_parcela integer DEFAULT NULL;

-- Populate numero_parcela from referencia pattern "xx de yy" where not already set
UPDATE public.conta_corrente_lote
SET numero_parcela = (regexp_match(referencia, '(\d+)\s+de\s+\d+'))[1]::integer
WHERE numero_parcela IS NULL
  AND referencia ~ '^\d+\s+de\s+\d+'
  AND tipo_mov IN ('PARCELA', 'REFORCO')
  AND (credito > 0 OR debito > 0);

-- Populate sequencia_parcela using window function: 
-- For each (lote_id, tipo_fluxo, numero_parcela), assign row_number ordered by data_mov, created_at
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lote_id, tipo_fluxo, numero_parcela
           ORDER BY data_mov ASC, created_at ASC
         ) AS seq
  FROM public.conta_corrente_lote
  WHERE numero_parcela IS NOT NULL
    AND tipo_mov IN ('PARCELA', 'REFORCO')
)
UPDATE public.conta_corrente_lote c
SET sequencia_parcela = r.seq
FROM ranked r
WHERE c.id = r.id;
