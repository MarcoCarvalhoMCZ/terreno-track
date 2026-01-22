import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, differenceInMonths, startOfMonth, isBefore, isAfter, isSameMonth, parseISO } from "date-fns";
import type { TipoConta } from "@/types/conta-corrente.types";

/**
 * Configurações de mora carregadas do banco
 */
export interface MoraConfig {
  juros_mora_percentual: number;
  multa_mora_percentual: number;
  criterio_juros_mora: "MES_SUBSEQUENTE" | "TOLERANCIA";
  tolerancia_dias_juros: number;
}

/**
 * Uma parcela com cálculo de atraso
 */
export interface ParcelaEmAtraso {
  numero: number;
  totalParcelas: number;
  vencimento: Date;
  valorParcela: number;
  mesesAtraso: number;
  jurosPercentual: number;
  valorJuros: number;
  valorMulta: number;
  totalParcela: number;
  isVencida: boolean;
  isPrimeiraAVencer: boolean;
  exibirQrCode: boolean;
}

/**
 * Resumo das parcelas em atraso
 */
export interface ResumoParcelasEmAtraso {
  parcelas: ParcelaEmAtraso[];
  totalDevido: number;
  isInadimplente: boolean;
}

/**
 * Hook para buscar configurações de mora
 */
export function useMoraConfig() {
  return useQuery({
    queryKey: ["configuracoes-mora"],
    queryFn: async (): Promise<MoraConfig> => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("juros_mora_percentual, multa_mora_percentual, criterio_juros_mora, tolerancia_dias_juros")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return {
        juros_mora_percentual: data?.juros_mora_percentual ?? 1.0,
        multa_mora_percentual: data?.multa_mora_percentual ?? 2.0,
        criterio_juros_mora: (data?.criterio_juros_mora as "MES_SUBSEQUENTE" | "TOLERANCIA") || "MES_SUBSEQUENTE",
        tolerancia_dias_juros: data?.tolerancia_dias_juros ?? 0,
      };
    },
  });
}

/**
 * Hook para buscar a data da última atualização monetária de um lote
 */
export function useUltimaAtualizacaoLote(loteId: string | null) {
  return useQuery({
    queryKey: ["ultima-atualizacao-lote", loteId],
    queryFn: async (): Promise<Date | null> => {
      if (!loteId) return null;
      
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("data_mov")
        .eq("lote_id", loteId)
        .eq("tipo_mov", "ATUALIZACAO")
        .order("data_mov", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.data_mov) return null;
      
      return parseISO(data.data_mov);
    },
    enabled: !!loteId,
  });
}

/**
 * Calcula a data a partir da qual os juros começam a incidir
 */
function calcularDataInicioJuros(
  vencimento: Date,
  criterio: "MES_SUBSEQUENTE" | "TOLERANCIA",
  toleranciaDias: number
): Date {
  if (criterio === "MES_SUBSEQUENTE") {
    // Primeiro dia do mês subsequente ao vencimento
    return startOfMonth(addMonths(vencimento, 1));
  } else {
    // Vencimento + tolerância em dias
    const dataComTolerancia = new Date(vencimento);
    dataComTolerancia.setDate(dataComTolerancia.getDate() + toleranciaDias);
    return dataComTolerancia;
  }
}

/**
 * Calcula os meses de atraso para incidência de juros
 */
function calcularMesesAtraso(
  vencimento: Date,
  dataAtual: Date,
  criterio: "MES_SUBSEQUENTE" | "TOLERANCIA",
  toleranciaDias: number
): number {
  const dataInicioJuros = calcularDataInicioJuros(vencimento, criterio, toleranciaDias);

  // Se ainda não passou da data de início de juros, não há atraso para juros
  if (!isAfter(dataAtual, dataInicioJuros)) {
    return 0;
  }

  // Calcular meses completos de atraso
  if (criterio === "MES_SUBSEQUENTE") {
    // Conta meses desde o primeiro dia do mês subsequente
    return differenceInMonths(dataAtual, dataInicioJuros) + 1;
  } else {
    // Para tolerância em dias, conta meses desde a data com tolerância
    return Math.max(0, differenceInMonths(dataAtual, dataInicioJuros) + 1);
  }
}

/**
 * Verifica se uma parcela está vencida (considerando tolerância)
 */
function isParcelaVencida(
  vencimento: Date,
  dataAtual: Date,
  criterio: "MES_SUBSEQUENTE" | "TOLERANCIA",
  toleranciaDias: number
): boolean {
  if (criterio === "TOLERANCIA" && toleranciaDias > 0) {
    const dataLimite = new Date(vencimento);
    dataLimite.setDate(dataLimite.getDate() + toleranciaDias);
    return isAfter(dataAtual, dataLimite);
  }
  return isAfter(dataAtual, vencimento);
}

interface VendaData {
  qtd_parcelas?: number | null;
  qtd_reforcos?: number | null;
  primeiro_vencimento_parcela?: string | null;
  primeiro_vencimento_reforco?: string | null;
  frequencia_parcelas_meses?: number | null;
  frequencia_reforcos_meses?: number | null;
}

interface ResumoLoteData {
  qtdParcelasPagas: number;
  qtdParcelasAPagar: number;
  qtdReforcosPagos: number;
  qtdReforcosAPagar: number;
  valorProximaParcela: number;
  valorProximoReforco: number;
  primeiroVencimentoParcela: Date | null;
  primeiroVencimentoReforco: Date | null;
}

interface UseParcelasParams {
  tipoFluxo: TipoConta;
  venda: VendaData | null | undefined;
  resumo: ResumoLoteData | null | undefined;
  moraConfig: MoraConfig | null | undefined;
  ultimaAtualizacao: Date | null | undefined;
}

/**
 * Hook para calcular parcelas em atraso com juros e multa
 * QR codes só aparecem para parcelas vencidas + primeira a vencer, 
 * mas apenas se estiverem no mesmo mês da última atualização monetária
 */
export function useParcelasEmAtraso(
  tipoFluxo: TipoConta,
  venda: VendaData | null | undefined,
  resumo: ResumoLoteData | null | undefined,
  moraConfig: MoraConfig | null | undefined,
  ultimaAtualizacao?: Date | null
): ResumoParcelasEmAtraso {
  return useMemo(() => {
    const resultado: ResumoParcelasEmAtraso = {
      parcelas: [],
      totalDevido: 0,
      isInadimplente: false,
    };

    if (!venda || !resumo || !moraConfig) {
      return resultado;
    }

    const dataAtual = new Date();
    const isParcelamento = tipoFluxo === "PARCELAMENTO";

    // Configurações do fluxo
    const qtdPagas = isParcelamento ? resumo.qtdParcelasPagas : resumo.qtdReforcosPagos;
    const qtdAPagar = isParcelamento ? resumo.qtdParcelasAPagar : resumo.qtdReforcosAPagar;
    const qtdTotal = isParcelamento ? (venda.qtd_parcelas || 0) : (venda.qtd_reforcos || 0);
    const valorParcela = isParcelamento ? resumo.valorProximaParcela : resumo.valorProximoReforco;
    const primeiroVencimento = isParcelamento ? resumo.primeiroVencimentoParcela : resumo.primeiroVencimentoReforco;
    const frequenciaMeses = isParcelamento 
      ? (venda.frequencia_parcelas_meses || 1) 
      : (venda.frequencia_reforcos_meses || 12);

    if (qtdAPagar <= 0 || valorParcela <= 0 || !primeiroVencimento) {
      return resultado;
    }

    const { juros_mora_percentual, multa_mora_percentual, criterio_juros_mora, tolerancia_dias_juros } = moraConfig;

    // Primeiro, gerar todas as parcelas a pagar
    const todasParcelas: ParcelaEmAtraso[] = [];
    let primeiraAVencerIdx = -1;

    for (let i = 0; i < qtdAPagar; i++) {
      const numeroParcela = qtdPagas + i + 1;
      const vencimento = addMonths(primeiroVencimento, (qtdPagas + i) * frequenciaMeses);
      
      const vencida = isParcelaVencida(vencimento, dataAtual, criterio_juros_mora, tolerancia_dias_juros);
      const mesesAtraso = vencida 
        ? calcularMesesAtraso(vencimento, dataAtual, criterio_juros_mora, tolerancia_dias_juros)
        : 0;
      
      // Juros incide sobre o valor da parcela, proporcional aos meses
      const jurosPercentual = mesesAtraso * juros_mora_percentual;
      const valorJuros = valorParcela * (jurosPercentual / 100);
      
      // Multa incide apenas uma vez sobre o valor da parcela (se vencida)
      const valorMulta = vencida ? valorParcela * (multa_mora_percentual / 100) : 0;
      
      const totalParcela = valorParcela + valorJuros + valorMulta;

      // Identificar primeira parcela a vencer (não vencida)
      if (!vencida && primeiraAVencerIdx === -1) {
        primeiraAVencerIdx = i;
      }

      todasParcelas.push({
        numero: numeroParcela,
        totalParcelas: qtdTotal,
        vencimento,
        valorParcela,
        mesesAtraso,
        jurosPercentual,
        valorJuros,
        valorMulta,
        totalParcela,
        isVencida: vencida,
        isPrimeiraAVencer: false, // será definido depois
        exibirQrCode: false, // será definido depois
      });

      if (vencida) {
        resultado.isInadimplente = true;
      }
    }

    // Marcar a primeira a vencer
    if (primeiraAVencerIdx >= 0) {
      todasParcelas[primeiraAVencerIdx].isPrimeiraAVencer = true;
    }

    // Filtrar: apenas vencidas + primeira a vencer
    resultado.parcelas = todasParcelas.filter(p => p.isVencida || p.isPrimeiraAVencer);
    
    // Definir quais parcelas podem exibir QR code:
    // Apenas se estiverem no mesmo mês da última atualização monetária
    resultado.parcelas = resultado.parcelas.map(p => ({
      ...p,
      exibirQrCode: ultimaAtualizacao 
        ? isSameMonth(p.vencimento, ultimaAtualizacao)
        : true, // Se não há atualização, exibe todos (fallback)
    }));
    
    resultado.totalDevido = resultado.parcelas.reduce((acc, p) => acc + p.totalParcela, 0);

    return resultado;
  }, [tipoFluxo, venda, resumo, moraConfig, ultimaAtualizacao]);
}
