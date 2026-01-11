-- Corrigir datas de Atualização Monetária: último dia do mês → primeiro dia do mês seguinte
UPDATE conta_corrente_lote
SET 
  data_mov = (date_trunc('month', data_mov) + interval '1 month')::date,
  updated_at = now()
WHERE tipo_mov = 'ATUALIZACAO';