-- Corrigir datas de Atualização Monetária: definir como primeiro dia do mês atual
UPDATE conta_corrente_lote
SET 
  data_mov = date_trunc('month', data_mov)::date,
  updated_at = now()
WHERE tipo_mov = 'ATUALIZACAO';