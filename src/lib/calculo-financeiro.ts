/**
 * Motor Financeiro Central - Sistema de Bases Correntes
 * 
 * Centraliza todos os cálculos financeiros do sistema:
 * - Saldo atualizado por fluxo
 * - Valor da próxima parcela/reforço (saldo ÷ parcelas restantes)
 * - Contagem de parcelas pagas/a pagar
 * - Vencimentos
 * 
 * Princípio: Nova parcela = saldo atualizado ÷ parcelas restantes
 * Nenhuma rotina de cálculo deve ser duplicada fora deste módulo.
 */

import { addMonths } from "date-fns";

// ── Tipos ───────────────────────────────────────────────────────

export interface MovimentoConta {
  tipo_mov: string;
  tipo_fluxo: string | null;
  debito: number | null;
  credito: number | null;
  data_mov: string;
  vencimento: string | null;
  referencia: string | null;
  numero_parcela: number | null;
  sequencia_parcela: number | null;
}

export interface ParcelasControleRow {
  tipo_fluxo: string;
  data_base: string;
  qtd_pagas_base: number;
}

export interface DadosVenda {
  qtd_parcelas: number | null;
  qtd_reforcos: number | null;
  frequencia_parcelas_meses: number | null;
  frequencia_reforcos_meses: number | null;
  primeiro_vencimento_parcela: string | null;
  primeiro_vencimento_reforco: string | null;
  valor_parcelamento: number | null;
  valor_reforco: number | null;
}

export interface ResumoFluxoCalc {
  totalVenda: number;
  totalAtualizacoes: number;
  totalJurosMora: number;
  totalMultasMora: number;
  totalRecebido: number;
  saldoReceber: number;
}

export interface ResumoLoteCalc {
  parcelamento: ResumoFluxoCalc;
  reforco: ResumoFluxoCalc;
  qtdParcelasContratadas: number;
  qtdParcelasPagas: number;
  qtdParcelasAPagar: number;
  qtdReforcosContratados: number;
  qtdReforcosPagos: number;
  qtdReforcosAPagar: number;
  valorProximaParcela: number;
  vencimentoProximaParcela: Date | null;
  valorProximoReforco: number;
  vencimentoProximoReforco: Date | null;
  primeiroVencimentoParcela: Date | null;
  primeiroVencimentoReforco: Date | null;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Tipos de movimento que NUNCA contam como parcela paga (quantidade). */
const TIPOS_EXCLUIDOS_CONTAGEM: string[] = [
  "SINAL", "ENTRADA_PARCELA", "AMORTIZACAO_ESPECIAL",
];

const isArrasSinal = (referencia: string | null): boolean => {
  if (!referencia) return false;
  const lower = referencia.toLowerCase();
  return lower.includes("arras") || lower.includes("sinal");
};

/**
 * Calcula totais de um fluxo a partir dos movimentos.
 */
export function calcularTotaisFluxo(movimentos: MovimentoConta[]): ResumoFluxoCalc {
  const totalVenda = movimentos
    .filter(m => ["VENDA", "ENTRADA_PARCELA", "SINAL", "REFORCO", "PARCELA"].includes(m.tipo_mov))
    .reduce((acc, m) => acc + (m.debito || 0), 0);

  const totalAtualizacoes = movimentos
    .filter(m => m.tipo_mov === "ATUALIZACAO")
    .reduce((acc, m) => acc + (m.debito || 0), 0);

  const totalJurosMora = movimentos
    .filter(m => m.tipo_mov === "JUROS_MORA")
    .reduce((acc, m) => acc + (m.debito || 0), 0);

  const totalMultasMora = movimentos
    .filter(m => m.tipo_mov === "MULTA_MORA")
    .reduce((acc, m) => acc + (m.debito || 0), 0);

  const totalRecebido = movimentos.reduce((acc, m) => acc + (m.credito || 0), 0);
  const saldoReceber = movimentos.reduce((acc, m) => acc + (m.debito || 0) - (m.credito || 0), 0);

  return { totalVenda, totalAtualizacoes, totalJurosMora, totalMultasMora, totalRecebido, saldoReceber };
}

/**
 * Conta pagamentos realizados considerando baseline de parcelas_controle.
 * Usa numero_parcela para contar parcelas DISTINTAS (evita contar pagamentos
 * parcelados da mesma parcela como parcelas diferentes).
 * Fallback: se nenhum movimento tiver numero_parcela, conta linhas como antes.
 */
export function contarPagamentos(
  movimentos: MovimentoConta[],
  baseline: ParcelasControleRow | null,
): number {
  const pagamentos = movimentos.filter(m => {
    const isPagamento = (m.credito || 0) > 0 &&
      !isArrasSinal(m.referencia) &&
      ["PARCELA", "REFORCO"].includes(m.tipo_mov);
    if (!isPagamento) return false;
    if (baseline && m.data_mov <= baseline.data_base) return false;
    return true;
  });

  // Se há numero_parcela preenchido, contar parcelas distintas
  const comNumeroParcela = pagamentos.filter(m => m.numero_parcela != null);
  if (comNumeroParcela.length > 0) {
    const parcelasDistintas = new Set(comNumeroParcela.map(m => m.numero_parcela!));
    // Somar também pagamentos sem numero_parcela (legados não parseados)
    // mas APENAS os que possuem vencimento (exclui arras/sinal sem vencimento)
    const semNumeroParcela = pagamentos.filter(m => m.numero_parcela == null && m.vencimento).length;
    return parcelasDistintas.size + semNumeroParcela;
  }

  // Fallback: contar linhas (comportamento antigo)
  return pagamentos.length;
}

/**
 * Calcula o valor da próxima parcela/reforço pelo Sistema de Bases Correntes.
 * Fallback: se saldo for 0 mas há parcelas contratadas, usa valor_contratado / qtd_total.
 */
export function calcularValorProximo(
  saldoReceber: number,
  qtdAPagar: number,
  valorContratado: number,
  qtdTotal: number,
): number {
  if (qtdAPagar <= 0) return 0;
  if (saldoReceber > 0) return saldoReceber / qtdAPagar;
  if (qtdTotal > 0) return (valorContratado || 0) / qtdTotal;
  return 0;
}

/**
 * Determina o primeiro vencimento de um fluxo.
 */
function resolverPrimeiroVencimento(
  vendaPrimeiroVenc: string | null,
  movimentos: MovimentoConta[],
  tipoMov: string,
): Date | null {
  if (vendaPrimeiroVenc) return new Date(vendaPrimeiroVenc);

  const primeiro = movimentos.find(m =>
    m.tipo_mov === tipoMov && m.vencimento && !isArrasSinal(m.referencia),
  );
  return primeiro?.vencimento ? new Date(primeiro.vencimento) : null;
}

// ── Motor principal ─────────────────────────────────────────────

/**
 * Calcula o resumo completo do lote com base nos movimentos e dados da venda.
 * Este é o ponto único de verdade para todos os cálculos financeiros.
 */
export function calcularResumoLote(
  todosMovimentos: MovimentoConta[],
  parcelasControle: ParcelasControleRow[],
  venda: DadosVenda,
): ResumoLoteCalc {
  const movParcelamento = todosMovimentos.filter(m => m.tipo_fluxo === "PARCELAMENTO");
  const movReforco = todosMovimentos.filter(m => m.tipo_fluxo === "REFORCO");

  const parcelamentoTotais = calcularTotaisFluxo(movParcelamento);
  const reforcoTotais = calcularTotaisFluxo(movReforco);

  // Baselines
  const parcelamentoBaseline = parcelasControle.find(c => c.tipo_fluxo === "PARCELAMENTO") || null;
  const reforcoBaseline = parcelasControle.find(c => c.tipo_fluxo === "REFORCO") || null;

  // Contagem de parcelas pagas
  const qtdParcelasPagas = (parcelamentoBaseline?.qtd_pagas_base || 0) + contarPagamentos(movParcelamento, parcelamentoBaseline);
  const qtdReforcosPagos = (reforcoBaseline?.qtd_pagas_base || 0) + contarPagamentos(movReforco, reforcoBaseline);

  const qtdParcelasContratadas = venda.qtd_parcelas || 0;
  const qtdReforcosContratados = venda.qtd_reforcos || 0;

  const qtdParcelasAPagar = Math.max(0, qtdParcelasContratadas - qtdParcelasPagas);
  const qtdReforcosAPagar = Math.max(0, qtdReforcosContratados - qtdReforcosPagos);

  // Valores próximos (Bases Correntes)
  const valorProximaParcela = calcularValorProximo(
    parcelamentoTotais.saldoReceber, qtdParcelasAPagar,
    venda.valor_parcelamento || 0, qtdParcelasContratadas,
  );
  const valorProximoReforco = calcularValorProximo(
    reforcoTotais.saldoReceber, qtdReforcosAPagar,
    venda.valor_reforco || 0, qtdReforcosContratados,
  );

  // Vencimentos
  const primeiroVencimentoParcela = resolverPrimeiroVencimento(
    venda.primeiro_vencimento_parcela, movParcelamento, "PARCELA",
  );
  const primeiroVencimentoReforco = resolverPrimeiroVencimento(
    venda.primeiro_vencimento_reforco, movReforco, "REFORCO",
  );

  const freqParcelas = venda.frequencia_parcelas_meses || 1;
  const freqReforcos = venda.frequencia_reforcos_meses || 12;

  const vencimentoProximaParcela = primeiroVencimentoParcela && qtdParcelasAPagar > 0
    ? addMonths(primeiroVencimentoParcela, qtdParcelasPagas * freqParcelas)
    : null;

  const vencimentoProximoReforco = primeiroVencimentoReforco && qtdReforcosAPagar > 0
    ? addMonths(primeiroVencimentoReforco, qtdReforcosPagos * freqReforcos)
    : null;

  return {
    parcelamento: parcelamentoTotais,
    reforco: reforcoTotais,
    qtdParcelasContratadas,
    qtdParcelasPagas,
    qtdParcelasAPagar,
    qtdReforcosContratados,
    qtdReforcosPagos,
    qtdReforcosAPagar,
    valorProximaParcela,
    vencimentoProximaParcela,
    valorProximoReforco,
    vencimentoProximoReforco,
    primeiroVencimentoParcela,
    primeiroVencimentoReforco,
  };
}
