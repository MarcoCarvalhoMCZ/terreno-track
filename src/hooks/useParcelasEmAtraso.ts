import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, startOfMonth, isBefore, isSameMonth, parseISO } from "date-fns";
import { calcularEncargosParcela } from "@/lib/calculo-mora";
import type { MoraConfig, CriterioJurosMora } from "@/lib/calculo-mora";
import type { TipoConta } from "@/types/conta-corrente.types";

// Re-export types from the shared lib so existing consumers don't break
export type { MoraConfig, CriterioJurosMora } from "@/lib/calculo-mora";
export { calcularEncargosParcela, calcularMesesAtraso, isParcelaVencida } from "@/lib/calculo-mora";

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
        criterio_juros_mora: (data?.criterio_juros_mora as CriterioJurosMora) || "MES_SUBSEQUENTE",
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

/**
 * Hook para calcular parcelas em atraso com juros e multa.
 * Usa a biblioteca centralizada `calculo-mora.ts` para todos os cálculos.
 */
export function useParcelasEmAtraso(
  tipoFluxo: TipoConta,
  venda: VendaData | null | undefined,
  resumo: ResumoLoteData | null | undefined,
  moraConfig: MoraConfig | null | undefined,
  ultimaAtualizacao?: Date | null,
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

    const dataAtual = ultimaAtualizacao ? ultimaAtualizacao : new Date();
    const isParcelamento = tipoFluxo === "PARCELAMENTO";

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

    // Gerar todas as parcelas a pagar
    const todasParcelas: ParcelaEmAtraso[] = [];
    let primeiraAVencerIdx = -1;

    for (let i = 0; i < qtdAPagar; i++) {
      const numeroParcela = qtdPagas + i + 1;
      const vencimento = addMonths(primeiroVencimento, (qtdPagas + i) * frequenciaMeses);

      // Usar a biblioteca centralizada para calcular encargos
      const encargos = calcularEncargosParcela(valorParcela, vencimento, dataAtual, moraConfig);

      if (!encargos.isVencida && primeiraAVencerIdx === -1) {
        primeiraAVencerIdx = i;
      }

      todasParcelas.push({
        numero: numeroParcela,
        totalParcelas: qtdTotal,
        vencimento,
        valorParcela,
        mesesAtraso: encargos.mesesAtraso,
        jurosPercentual: encargos.jurosPercentual,
        valorJuros: encargos.valorJuros,
        valorMulta: encargos.valorMulta,
        totalParcela: encargos.totalParcela,
        isVencida: encargos.isVencida,
        isPrimeiraAVencer: false,
        exibirQrCode: false,
      });

      if (encargos.isVencida) {
        resultado.isInadimplente = true;
      }
    }

    // Marcar a primeira a vencer
    if (primeiraAVencerIdx >= 0) {
      todasParcelas[primeiraAVencerIdx].isPrimeiraAVencer = true;
    }

    // Limite: nunca exceder o mês da última atualização monetária
    const limiteAtualiz = ultimaAtualizacao
      ? startOfMonth(addMonths(ultimaAtualizacao, 1))
      : null;

    // Filtrar parcelas: vencidas + primeira a vencer, respeitando o limite
    const parcelasFiltradas = todasParcelas.filter((p) => {
      if (limiteAtualiz && !isBefore(p.vencimento, limiteAtualiz) && !isSameMonth(p.vencimento, ultimaAtualizacao!)) {
        return false;
      }
      if (p.isVencida) return true;
      if (p.isPrimeiraAVencer) return true;
      return false;
    });

    if (isParcelamento) {
      resultado.parcelas = parcelasFiltradas.map((p) => ({
        ...p,
        exibirQrCode: p.isVencida
          ? true
          : (ultimaAtualizacao ? isSameMonth(p.vencimento, ultimaAtualizacao) : true),
      }));
    } else {
      resultado.parcelas = parcelasFiltradas.map((p) => ({
        ...p,
        exibirQrCode: true,
      }));
    }

    resultado.totalDevido = resultado.parcelas.reduce((acc, p) => acc + p.totalParcela, 0);

    return resultado;
  }, [tipoFluxo, venda, resumo, moraConfig, ultimaAtualizacao]);
}
