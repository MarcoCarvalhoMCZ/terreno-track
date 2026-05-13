import { addMonths, differenceInDays, differenceInMonths, startOfMonth, isAfter, isBefore } from "date-fns";

/**
 * Critério de incidência de juros de mora.
 * - MES_SUBSEQUENTE: juros começam no 1º dia do mês seguinte ao vencimento
 * - TOLERANCIA: juros começam após N dias de tolerância
 * - PRO_RATA_DIA: juros calculados proporcionalmente aos dias em atraso (preparado)
 * - FIXO_MENSAL: aplica mês cheio independentemente da quantidade de dias (preparado)
 */
export type CriterioJurosMora = "MES_SUBSEQUENTE" | "TOLERANCIA" | "PRO_RATA_DIA" | "FIXO_MENSAL";

/**
 * Configurações de mora (juros + multa)
 */
export interface MoraConfig {
  juros_mora_percentual: number;
  multa_mora_percentual: number;
  criterio_juros_mora: CriterioJurosMora;
  tolerancia_dias_juros: number;
}

/**
 * Resultado do cálculo de encargos de mora para uma parcela
 */
export interface EncargosCalculados {
  diasAtraso: number;
  mesesAtraso: number;
  jurosPercentual: number;
  valorJuros: number;
  valorMulta: number;
  totalParcela: number;
  isVencida: boolean;
  toleranciaAplicada: boolean;
}

/**
 * Calcula a data a partir da qual os juros começam a incidir.
 *
 * - MES_SUBSEQUENTE: primeiro dia do mês seguinte ao vencimento
 * - TOLERANCIA: vencimento + N dias de tolerância
 */
export function calcularDataInicioJuros(
  vencimento: Date,
  criterio: CriterioJurosMora,
  toleranciaDias: number,
): Date {
  // PRO_RATA_DIA e FIXO_MENSAL: começam imediatamente após o vencimento
  if (criterio === "MES_SUBSEQUENTE") {
    return startOfMonth(addMonths(vencimento, 1));
  }
  if (criterio === "TOLERANCIA") {
    const dataComTolerancia = new Date(vencimento);
    dataComTolerancia.setDate(dataComTolerancia.getDate() + toleranciaDias);
    return dataComTolerancia;
  }
  // PRO_RATA_DIA / FIXO_MENSAL: dia seguinte ao vencimento
  const diaSeguinte = new Date(vencimento);
  diaSeguinte.setDate(diaSeguinte.getDate() + 1);
  return diaSeguinte;
}

/**
 * Calcula os meses completos de atraso para incidência de juros.
 * Usa comparação >= (não estritamente >) para a data de início.
 */
export function calcularMesesAtraso(
  vencimento: Date,
  dataReferencia: Date,
  criterio: CriterioJurosMora,
  toleranciaDias: number,
): number {
  const dataInicioJuros = calcularDataInicioJuros(vencimento, criterio, toleranciaDias);

  // Se dataReferencia < dataInicioJuros → sem atraso
  if (isBefore(dataReferencia, dataInicioJuros)) {
    return 0;
  }

  // Meses completos desde o início dos juros (+1 porque o próprio mês de início já conta)
  return differenceInMonths(dataReferencia, dataInicioJuros) + 1;
}

/**
 * Verifica se uma parcela está vencida na data de referência,
 * considerando tolerância quando aplicável.
 */
export function isParcelaVencida(
  vencimento: Date,
  dataReferencia: Date,
  criterio: CriterioJurosMora,
  toleranciaDias: number,
): boolean {
  if (criterio === "TOLERANCIA" && toleranciaDias > 0) {
    const dataLimite = new Date(vencimento);
    dataLimite.setDate(dataLimite.getDate() + toleranciaDias);
    return isAfter(dataReferencia, dataLimite);
  }
  return isAfter(dataReferencia, vencimento);
}

/**
 * Calcula todos os encargos de mora (juros + multa) para uma parcela.
 * Multa só é aplicada quando há juros (mesesAtraso > 0).
 */
export function calcularEncargosParcela(
  valorParcela: number,
  vencimento: Date,
  dataReferencia: Date,
  config: MoraConfig,
): EncargosCalculados {
  const { juros_mora_percentual, multa_mora_percentual, criterio_juros_mora, tolerancia_dias_juros } = config;

  const diasAtraso = Math.max(0, differenceInDays(dataReferencia, vencimento));
  const vencida = isParcelaVencida(vencimento, dataReferencia, criterio_juros_mora, tolerancia_dias_juros);

  // Tolerância aplicada: tem dias de atraso mas dentro da tolerância
  const toleranciaAplicada =
    criterio_juros_mora === "TOLERANCIA" &&
    diasAtraso > 0 &&
    diasAtraso <= tolerancia_dias_juros;

  const mesesAtraso = vencida
    ? calcularMesesAtraso(vencimento, dataReferencia, criterio_juros_mora, tolerancia_dias_juros)
    : 0;

  let jurosPercentual = 0;
  let valorJuros = 0;

  if (vencida) {
    if (criterio_juros_mora === "PRO_RATA_DIA") {
      // Juros proporcionais aos dias: % mensal / 30 * dias
      const taxaDiaria = juros_mora_percentual / 30;
      jurosPercentual = taxaDiaria * diasAtraso;
      valorJuros = valorParcela * (jurosPercentual / 100);
    } else if (criterio_juros_mora === "FIXO_MENSAL") {
      // Mês cheio independentemente: 1 mês fixo se houver atraso
      jurosPercentual = juros_mora_percentual;
      valorJuros = valorParcela * (jurosPercentual / 100);
    } else {
      // MES_SUBSEQUENTE / TOLERANCIA: mês a mês
      jurosPercentual = mesesAtraso * juros_mora_percentual;
      valorJuros = valorParcela * (jurosPercentual / 100);
    }
  }

  // Multa só quando há juros efetivos
  const valorMulta = valorJuros > 0 ? valorParcela * (multa_mora_percentual / 100) : 0;
  const totalParcela = valorParcela + valorJuros + valorMulta;

  return {
    diasAtraso,
    mesesAtraso,
    jurosPercentual,
    valorJuros,
    valorMulta,
    totalParcela,
    isVencida: vencida,
    toleranciaAplicada,
  };
}
