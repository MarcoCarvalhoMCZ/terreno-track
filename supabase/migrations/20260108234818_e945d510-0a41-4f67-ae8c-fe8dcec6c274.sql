-- Fix security definer views by recreating them with SECURITY INVOKER
DROP VIEW IF EXISTS public.vw_resumo_operacoes_lote;
DROP VIEW IF EXISTS public.vw_totalizacao_mensal_por_lote;
DROP VIEW IF EXISTS public.vw_totalizacao_mensal_consolidada;

CREATE VIEW public.vw_resumo_operacoes_lote 
WITH (security_invoker = true)
AS
SELECT 
  l.id as lote_id,
  l.quadra,
  l.numero_lote,
  DATE_TRUNC('month', cc.data_mov)::DATE as competencia,
  COALESCE(SUM(cc.debito), 0) as total_debitos,
  COALESCE(SUM(cc.credito), 0) as total_creditos,
  COALESCE(SUM(cc.credito) - SUM(cc.debito), 0) as saldo_periodo
FROM public.lotes l
LEFT JOIN public.conta_corrente_lote cc ON l.id = cc.lote_id
GROUP BY l.id, l.quadra, l.numero_lote, DATE_TRUNC('month', cc.data_mov);

CREATE VIEW public.vw_totalizacao_mensal_por_lote 
WITH (security_invoker = true)
AS
SELECT 
  l.id as lote_id,
  l.quadra,
  l.numero_lote,
  DATE_TRUNC('month', cc.data_mov)::DATE as competencia,
  COALESCE(SUM(cc.debito), 0) as total_debitos,
  COALESCE(SUM(cc.credito), 0) as total_creditos,
  COALESCE(SUM(cc.credito) - SUM(cc.debito), 0) as saldo_final
FROM public.lotes l
LEFT JOIN public.conta_corrente_lote cc ON l.id = cc.lote_id
WHERE cc.data_mov IS NOT NULL
GROUP BY l.id, l.quadra, l.numero_lote, DATE_TRUNC('month', cc.data_mov)
ORDER BY competencia DESC, l.quadra, l.numero_lote;

CREATE VIEW public.vw_totalizacao_mensal_consolidada 
WITH (security_invoker = true)
AS
SELECT 
  DATE_TRUNC('month', data_mov)::DATE as competencia,
  COALESCE(SUM(debito), 0) as total_debitos,
  COALESCE(SUM(credito), 0) as total_creditos,
  COALESCE(SUM(credito) - SUM(debito), 0) as saldo_final
FROM public.conta_corrente_lote
WHERE data_mov IS NOT NULL
GROUP BY DATE_TRUNC('month', data_mov)
ORDER BY competencia DESC;