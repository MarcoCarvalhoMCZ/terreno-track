-- Fix ATUALIZACAO records that have negative debito values
-- These should have the absolute value in credito instead
UPDATE public.conta_corrente_lote
SET credito = ABS(debito),
    debito = 0,
    updated_at = now()
WHERE tipo_mov = 'ATUALIZACAO'
  AND debito < 0;