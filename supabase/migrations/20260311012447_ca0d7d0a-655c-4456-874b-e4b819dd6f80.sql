
-- Fix corrupted ATUALIZACAO record with year 252025 -> should be 2025-10-01
UPDATE conta_corrente_lote
SET data_mov = '2025-10-01'
WHERE id = 'b39ff845-41ce-47bc-a4a5-655a3dea88ab'
AND data_mov = '252025-10-01';
