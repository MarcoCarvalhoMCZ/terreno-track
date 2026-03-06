import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { calcularEncargosParcela } from "@/lib/calculo-mora";
import type { MoraConfig } from "@/lib/calculo-mora";

/**
 * Venda com dados do lote e comprador
 */
interface VendaParaRelatorio {
  id: string;
  lote_id: string;
  quadra: string;
  numero_lote: string;
  comprador_pessoa_id: string;
  comprador_nome: string;
  comprador_cpf: string | null;
  comprador_nome_2: string | null;
  comprador_cpf_2: string | null;
  data_venda: string;
  valor_venda: number;
  qtd_parcelas: number;
  qtd_reforcos: number;
  frequencia_parcelas_meses: number;
  frequencia_reforcos_meses: number;
  primeiro_vencimento_parcela: string | null;
  primeiro_vencimento_reforco: string | null;
}

/**
 * Parcela em atraso para o relatório
 */
export interface ParcelaAtrasoRelatorio {
  numero: number;
  totalParcelas: number;
  tipoFluxo: "PARCELAMENTO" | "REFORCO";
  vencimento: Date;
  valorParcela: number;
  mesesAtraso: number;
  jurosPercentual: number;
  valorJuros: number;
  valorMulta: number;
  totalParcela: number;
}

/**
 * Lote com parcelas em atraso
 */
export interface LoteInadimplente {
  loteId: string;
  quadra: string;
  numeroLote: string;
  vendaId: string;
  dataVenda: string;
  valorVenda: number;
  parcelasAtraso: ParcelaAtrasoRelatorio[];
  totalDevido: number;
}

/**
 * Comprador com lotes inadimplentes
 */
export interface CompradorInadimplente {
  compradorId: string;
  nome: string;
  cpf: string | null;
  nome2: string | null;
  cpf2: string | null;
  lotes: LoteInadimplente[];
  totalGeral: number;
  qtdParcelasAtraso: number;
}

/**
 * Resultado do relatório
 */
export interface RelatorioInadimplencia {
  compradores: CompradorInadimplente[];
  totalGeralDevido: number;
  qtdTotalParcelasAtraso: number;
  qtdLotesInadimplentes: number;
}

function useVendasAtivas() {
  return useQuery({
    queryKey: ["vendas-ativas-relatorio"],
    queryFn: async (): Promise<VendaParaRelatorio[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select(`
          id,
          lote_id,
          comprador_pessoa_id,
          data_venda,
          valor_venda,
          qtd_parcelas,
          qtd_reforcos,
          frequencia_parcelas_meses,
          frequencia_reforcos_meses,
          primeiro_vencimento_parcela,
          primeiro_vencimento_reforco,
          comprador_nome_2,
          comprador_cpf_2,
          lote:lotes(quadra, numero_lote),
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)
        `)
        .eq("status", "ATIVA");

      if (error) throw error;

      return (data || []).map((v: any) => ({
        id: v.id,
        lote_id: v.lote_id,
        quadra: v.lote?.quadra || "",
        numero_lote: v.lote?.numero_lote || "",
        comprador_pessoa_id: v.comprador_pessoa_id,
        comprador_nome: v.comprador?.nome_razao || "Comprador não identificado",
        comprador_cpf: v.comprador?.cpf_cnpj || null,
        comprador_nome_2: v.comprador_nome_2 || null,
        comprador_cpf_2: v.comprador_cpf_2 || null,
        data_venda: v.data_venda,
        valor_venda: v.valor_venda || 0,
        qtd_parcelas: v.qtd_parcelas || 1,
        qtd_reforcos: v.qtd_reforcos || 0,
        frequencia_parcelas_meses: v.frequencia_parcelas_meses || 1,
        frequencia_reforcos_meses: v.frequencia_reforcos_meses || 12,
        primeiro_vencimento_parcela: v.primeiro_vencimento_parcela || null,
        primeiro_vencimento_reforco: v.primeiro_vencimento_reforco || null,
      }));
    },
  });
}

function usePagamentosRealizados() {
  return useQuery({
    queryKey: ["pagamentos-realizados-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("lote_id, tipo_fluxo, tipo_mov, credito")
        .in("tipo_mov", ["PARCELA", "REFORCO"])
        .gt("credito", 0);

      if (error) throw error;

      const pagamentos: Record<string, { parcelamento: number; reforco: number }> = {};
      (data || []).forEach((p: any) => {
        if (!pagamentos[p.lote_id]) {
          pagamentos[p.lote_id] = { parcelamento: 0, reforco: 0 };
        }
        if (p.tipo_fluxo === "PARCELAMENTO") {
          pagamentos[p.lote_id].parcelamento++;
        } else if (p.tipo_fluxo === "REFORCO") {
          pagamentos[p.lote_id].reforco++;
        }
      });

      return pagamentos;
    },
  });
}

function useSaldosPorLote() {
  return useQuery({
    queryKey: ["saldos-por-lote-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_resumo_fluxo_lote")
        .select("lote_id, tipo_fluxo, saldo_atualizado, qtd_restante");

      if (error) throw error;

      const saldos: Record<string, Record<string, { saldo: number; qtdRestante: number }>> = {};
      (data || []).forEach((s: any) => {
        if (!saldos[s.lote_id]) {
          saldos[s.lote_id] = {};
        }
        saldos[s.lote_id][s.tipo_fluxo] = {
          saldo: s.saldo_atualizado || 0,
          qtdRestante: s.qtd_restante || 0,
        };
      });

      return saldos;
    },
  });
}

function processarFluxo(
  venda: VendaParaRelatorio,
  tipoFluxo: "PARCELAMENTO" | "REFORCO",
  qtdPagas: number,
  saldoFluxo: number,
  dataAtual: Date,
  moraConfig: MoraConfig,
): ParcelaAtrasoRelatorio[] {
  const isParcelamento = tipoFluxo === "PARCELAMENTO";
  const qtdTotal = isParcelamento ? venda.qtd_parcelas : venda.qtd_reforcos;
  const primeiroVencStr = isParcelamento ? venda.primeiro_vencimento_parcela : venda.primeiro_vencimento_reforco;
  const frequencia = isParcelamento ? venda.frequencia_parcelas_meses : venda.frequencia_reforcos_meses;

  if (!primeiroVencStr || qtdTotal <= 0) return [];

  const qtdAPagar = Math.max(0, qtdTotal - qtdPagas);
  const valorParcela = qtdAPagar > 0 ? saldoFluxo / qtdAPagar : 0;
  const primeiroVencimento = new Date(primeiroVencStr);
  const resultado: ParcelaAtrasoRelatorio[] = [];

  for (let i = 0; i < qtdAPagar; i++) {
    const numeroParcela = qtdPagas + i + 1;
    const vencimento = addMonths(primeiroVencimento, (qtdPagas + i) * frequencia);

    const encargos = calcularEncargosParcela(valorParcela, vencimento, dataAtual, moraConfig);

    if (encargos.isVencida) {
      resultado.push({
        numero: numeroParcela,
        totalParcelas: qtdTotal,
        tipoFluxo,
        vencimento,
        valorParcela,
        mesesAtraso: encargos.mesesAtraso,
        jurosPercentual: encargos.jurosPercentual,
        valorJuros: encargos.valorJuros,
        valorMulta: encargos.valorMulta,
        totalParcela: encargos.totalParcela,
      });
    }
  }

  return resultado;
}

export function useRelatorioInadimplencia(moraConfig: MoraConfig | null | undefined) {
  const { data: vendas, isLoading: loadingVendas } = useVendasAtivas();
  const { data: pagamentos, isLoading: loadingPagamentos } = usePagamentosRealizados();
  const { data: saldos, isLoading: loadingSaldos } = useSaldosPorLote();

  const isLoading = loadingVendas || loadingPagamentos || loadingSaldos;

  const relatorio = useMemo((): RelatorioInadimplencia => {
    const resultado: RelatorioInadimplencia = {
      compradores: [],
      totalGeralDevido: 0,
      qtdTotalParcelasAtraso: 0,
      qtdLotesInadimplentes: 0,
    };

    if (!vendas || !pagamentos || !saldos || !moraConfig) {
      return resultado;
    }

    const dataAtual = new Date();
    const compradoresMap = new Map<string, CompradorInadimplente>();

    for (const venda of vendas) {
      const pagLote = pagamentos[venda.lote_id] || { parcelamento: 0, reforco: 0 };
      const saldoLote = saldos[venda.lote_id] || {};

      const parcelasAtraso: ParcelaAtrasoRelatorio[] = [
        ...processarFluxo(venda, "PARCELAMENTO", pagLote.parcelamento, saldoLote["PARCELAMENTO"]?.saldo || 0, dataAtual, moraConfig),
        ...processarFluxo(venda, "REFORCO", pagLote.reforco, saldoLote["REFORCO"]?.saldo || 0, dataAtual, moraConfig),
      ];

      if (parcelasAtraso.length > 0) {
        const totalDevido = parcelasAtraso.reduce((sum, p) => sum + p.totalParcela, 0);

        const loteInadimplente: LoteInadimplente = {
          loteId: venda.lote_id,
          quadra: venda.quadra,
          numeroLote: venda.numero_lote,
          vendaId: venda.id,
          dataVenda: venda.data_venda,
          valorVenda: venda.valor_venda,
          parcelasAtraso,
          totalDevido,
        };

        if (!compradoresMap.has(venda.comprador_pessoa_id)) {
          compradoresMap.set(venda.comprador_pessoa_id, {
            compradorId: venda.comprador_pessoa_id,
            nome: venda.comprador_nome,
            cpf: venda.comprador_cpf,
            nome2: venda.comprador_nome_2,
            cpf2: venda.comprador_cpf_2,
            lotes: [],
            totalGeral: 0,
            qtdParcelasAtraso: 0,
          });
        }

        const comprador = compradoresMap.get(venda.comprador_pessoa_id)!;
        comprador.lotes.push(loteInadimplente);
        comprador.totalGeral += totalDevido;
        comprador.qtdParcelasAtraso += parcelasAtraso.length;
      }
    }

    resultado.compradores = Array.from(compradoresMap.values()).sort(
      (a, b) => b.totalGeral - a.totalGeral,
    );

    resultado.totalGeralDevido = resultado.compradores.reduce((sum, c) => sum + c.totalGeral, 0);
    resultado.qtdTotalParcelasAtraso = resultado.compradores.reduce((sum, c) => sum + c.qtdParcelasAtraso, 0);
    resultado.qtdLotesInadimplentes = resultado.compradores.reduce((sum, c) => sum + c.lotes.length, 0);

    return resultado;
  }, [vendas, pagamentos, saldos, moraConfig]);

  return { relatorio, isLoading };
}
