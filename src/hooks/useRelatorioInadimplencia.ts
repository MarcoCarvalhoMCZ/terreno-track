import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, isSameMonth } from "date-fns";
import {
  calcularResumoLote,
  type MovimentoConta,
  type ParcelasControleRow,
  type DadosVenda,
} from "@/lib/calculo-financeiro";
import { calcularEncargosParcela } from "@/lib/calculo-mora";
import type { MoraConfig } from "@/lib/calculo-mora";

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

/**
 * Busca todos os dados necessários em bulk (vendas, movimentos, parcelas_controle).
 * Usa exatamente o mesmo motor (calcularResumoLote + calcularEncargosParcela) que a Consulta de Lote,
 * garantindo valores idênticos entre as telas.
 */
function useRelatorioData(moraConfig: MoraConfig | null | undefined) {
  return useQuery({
    queryKey: ["relatorio-inadimplencia-data"],
    queryFn: async () => {
      // 1. Vendas ativas com lote e comprador
      const { data: vendas, error: vendasErr } = await supabase
        .from("vendas")
        .select(`
          id, lote_id, comprador_pessoa_id, data_venda, valor_venda,
          qtd_parcelas, qtd_reforcos, frequencia_parcelas_meses, frequencia_reforcos_meses,
          primeiro_vencimento_parcela, primeiro_vencimento_reforco,
          valor_parcelamento, valor_reforco,
          comprador_nome_2, comprador_cpf_2,
          lote:lotes(quadra, numero_lote),
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)
        `)
        .eq("status", "ATIVA");

      if (vendasErr) throw vendasErr;
      if (!vendas || vendas.length === 0) return { vendas: [], movimentos: {}, parcelasControle: {} };

      // 2. Bulk fetch all movimentos
      const loteIds = [...new Set(vendas.map((v) => v.lote_id))];
      const allMovimentos: Record<string, MovimentoConta[]> = {};

      for (let i = 0; i < loteIds.length; i += 50) {
        const chunk = loteIds.slice(i, i + 50);
        const { data: movData, error: movErr } = await supabase
          .from("conta_corrente_lote")
          .select("lote_id, tipo_mov, tipo_fluxo, debito, credito, data_mov, vencimento, referencia, numero_parcela, sequencia_parcela")
          .in("lote_id", chunk)
          .order("data_mov", { ascending: true });

        if (movErr) throw movErr;
        for (const m of movData || []) {
          if (!allMovimentos[m.lote_id]) allMovimentos[m.lote_id] = [];
          allMovimentos[m.lote_id].push({
            tipo_mov: m.tipo_mov,
            tipo_fluxo: m.tipo_fluxo,
            debito: m.debito,
            credito: m.credito,
            data_mov: m.data_mov,
            vencimento: m.vencimento,
            referencia: m.referencia,
            numero_parcela: m.numero_parcela,
            sequencia_parcela: m.sequencia_parcela,
          });
        }
      }

      // 3. Bulk fetch parcelas_controle
      const { data: pcData, error: pcErr } = await supabase
        .from("parcelas_controle")
        .select("lote_id, tipo_fluxo, data_base, qtd_pagas_base")
        .in("lote_id", loteIds);

      if (pcErr) throw pcErr;
      const allParcControle: Record<string, ParcelasControleRow[]> = {};
      for (const pc of pcData || []) {
        if (!allParcControle[pc.lote_id]) allParcControle[pc.lote_id] = [];
        allParcControle[pc.lote_id].push({
          tipo_fluxo: pc.tipo_fluxo,
          data_base: pc.data_base,
          qtd_pagas_base: pc.qtd_pagas_base,
        });
      }

      return { vendas, movimentos: allMovimentos, parcelasControle: allParcControle };
    },
    enabled: !!moraConfig,
  });
}

export function useRelatorioInadimplencia(moraConfig: MoraConfig | null | undefined) {
  const { data: rawData, isLoading } = useRelatorioData(moraConfig);

  const relatorio = useMemo((): RelatorioInadimplencia => {
    const resultado: RelatorioInadimplencia = {
      compradores: [],
      totalGeralDevido: 0,
      qtdTotalParcelasAtraso: 0,
      qtdLotesInadimplentes: 0,
    };

    if (!rawData || !rawData.vendas.length || !moraConfig) return resultado;

    const compradoresMap = new Map<string, CompradorInadimplente>();

    for (const venda of rawData.vendas) {
      const lote = venda.lote as any;
      const comprador = venda.comprador as any;
      if (!lote) continue;

      const movimentos = rawData.movimentos[venda.lote_id] || [];
      const parcelasControle = rawData.parcelasControle[venda.lote_id] || [];

      // Same reference date as Consulta de Lote: raw date of last ATUALIZACAO
      // Filter out corrupted dates (future beyond current year + 1)
      const now = new Date();
      const maxValidYear = now.getFullYear() + 1;
      const lastAtMov = movimentos
        .filter(m => m.tipo_mov === "ATUALIZACAO" && new Date(m.data_mov).getFullYear() <= maxValidYear)
        .sort((a, b) => b.data_mov.localeCompare(a.data_mov))[0];

      const dataRef = lastAtMov
        ? new Date(lastAtMov.data_mov)
        : now;

      // Use the SAME engine as Consulta de Lote
      const dadosVenda: DadosVenda = {
        qtd_parcelas: venda.qtd_parcelas,
        qtd_reforcos: venda.qtd_reforcos,
        frequencia_parcelas_meses: venda.frequencia_parcelas_meses,
        frequencia_reforcos_meses: venda.frequencia_reforcos_meses,
        primeiro_vencimento_parcela: venda.primeiro_vencimento_parcela,
        primeiro_vencimento_reforco: venda.primeiro_vencimento_reforco,
        valor_parcelamento: venda.valor_parcelamento,
        valor_reforco: venda.valor_reforco,
      };

      const resumo = calcularResumoLote(movimentos, parcelasControle, dadosVenda);

      const parcelasAtraso: ParcelaAtrasoRelatorio[] = [];

      // --- PARCELAMENTO ---
      if (resumo.qtdParcelasAPagar > 0 && resumo.primeiroVencimentoParcela) {
        const freq = venda.frequencia_parcelas_meses || 1;
        const qtdTotal = venda.qtd_parcelas || 0;

        for (let i = 0; i < resumo.qtdParcelasAPagar; i++) {
          const venc = addMonths(resumo.primeiroVencimentoParcela, (resumo.qtdParcelasPagas + i) * freq);
          if (venc > dataRef) break; // same cutoff as Consulta de Lote

          const encargos = calcularEncargosParcela(resumo.valorProximaParcela, venc, dataRef, moraConfig);

          // Include overdue AND same-month (a vencer) — matching Consulta de Lote
          if (encargos.isVencida || isSameMonth(venc, dataRef)) {
            parcelasAtraso.push({
              numero: resumo.qtdParcelasPagas + i + 1,
              totalParcelas: qtdTotal,
              tipoFluxo: "PARCELAMENTO",
              vencimento: venc,
              valorParcela: resumo.valorProximaParcela,
              mesesAtraso: encargos.mesesAtraso,
              jurosPercentual: encargos.jurosPercentual,
              valorJuros: encargos.valorJuros,
              valorMulta: encargos.valorMulta,
              totalParcela: encargos.totalParcela,
            });
          }
        }
      }

      // --- REFORÇOS ---
      if (resumo.qtdReforcosAPagar > 0 && resumo.primeiroVencimentoReforco) {
        const freq = venda.frequencia_reforcos_meses || 12;
        const qtdTotal = venda.qtd_reforcos || 0;

        for (let i = 0; i < resumo.qtdReforcosAPagar; i++) {
          const venc = addMonths(resumo.primeiroVencimentoReforco, (resumo.qtdReforcosPagos + i) * freq);
          if (venc > dataRef) break;

          const encargos = calcularEncargosParcela(resumo.valorProximoReforco, venc, dataRef, moraConfig);

          if (encargos.isVencida || isSameMonth(venc, dataRef)) {
            parcelasAtraso.push({
              numero: resumo.qtdReforcosPagos + i + 1,
              totalParcelas: qtdTotal,
              tipoFluxo: "REFORCO",
              vencimento: venc,
              valorParcela: resumo.valorProximoReforco,
              mesesAtraso: encargos.mesesAtraso,
              jurosPercentual: encargos.jurosPercentual,
              valorJuros: encargos.valorJuros,
              valorMulta: encargos.valorMulta,
              totalParcela: encargos.totalParcela,
            });
          }
        }
      }

      if (parcelasAtraso.length > 0) {
        const totalDevido = parcelasAtraso.reduce((sum, p) => sum + p.totalParcela, 0);

        const loteInadimplente: LoteInadimplente = {
          loteId: venda.lote_id,
          quadra: lote.quadra || "",
          numeroLote: lote.numero_lote || "",
          vendaId: venda.id,
          dataVenda: venda.data_venda,
          valorVenda: venda.valor_venda || 0,
          parcelasAtraso,
          totalDevido,
        };

        const compradorId = venda.comprador_pessoa_id;
        if (!compradoresMap.has(compradorId)) {
          compradoresMap.set(compradorId, {
            compradorId,
            nome: comprador?.nome_razao || "Comprador não identificado",
            cpf: comprador?.cpf_cnpj || null,
            nome2: venda.comprador_nome_2 || null,
            cpf2: venda.comprador_cpf_2 || null,
            lotes: [],
            totalGeral: 0,
            qtdParcelasAtraso: 0,
          });
        }

        const comp = compradoresMap.get(compradorId)!;
        comp.lotes.push(loteInadimplente);
        comp.totalGeral += totalDevido;
        comp.qtdParcelasAtraso += parcelasAtraso.length;
      }
    }

    resultado.compradores = Array.from(compradoresMap.values()).sort(
      (a, b) => b.totalGeral - a.totalGeral,
    );
    resultado.totalGeralDevido = resultado.compradores.reduce((sum, c) => sum + c.totalGeral, 0);
    resultado.qtdTotalParcelasAtraso = resultado.compradores.reduce((sum, c) => sum + c.qtdParcelasAtraso, 0);
    resultado.qtdLotesInadimplentes = resultado.compradores.reduce((sum, c) => sum + c.lotes.length, 0);

    return resultado;
  }, [rawData, moraConfig]);

  return { relatorio, isLoading };
}
