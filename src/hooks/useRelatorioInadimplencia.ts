import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
 * Hook que lê da tabela parcelas_abertas + vendas para montar o relatório.
 */
export function useRelatorioInadimplencia() {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["relatorio-inadimplencia-data"],
    queryFn: async () => {
      // 1. Parcelas abertas
      // Somente parcelas já vencidas (vencimento < hoje)
      const hoje = new Date().toISOString().split("T")[0];
      const { data: parcelas, error: parcErr } = await supabase
        .from("parcelas_abertas")
        .select("*")
        .eq("status", "ABERTO")
        .lt("vencimento", hoje);

      if (parcErr) throw parcErr;
      if (!parcelas?.length) return { parcelas: [], vendas: [] };

      // 2. Vendas ativas com comprador
      const loteIds = [...new Set(parcelas.map(p => p.lote_id))];
      const { data: vendas, error: vendasErr } = await supabase
        .from("vendas")
        .select(`
          id, lote_id, comprador_pessoa_id, data_venda, valor_venda,
          comprador_nome_2, comprador_cpf_2,
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)
        `)
        .eq("status", "ATIVA")
        .in("lote_id", loteIds);

      if (vendasErr) throw vendasErr;

      return { parcelas, vendas: vendas || [] };
    },
  });

  const relatorio = useMemo((): RelatorioInadimplencia => {
    const resultado: RelatorioInadimplencia = {
      compradores: [],
      totalGeralDevido: 0,
      qtdTotalParcelasAtraso: 0,
      qtdLotesInadimplentes: 0,
    };

    if (!rawData?.parcelas?.length || !rawData.vendas?.length) return resultado;

    // Map vendas by lote_id
    const vendasByLote = new Map<string, any>();
    for (const v of rawData.vendas) {
      vendasByLote.set(v.lote_id, v);
    }

    // Group parcelas by lote_id
    const parcelasByLote = new Map<string, any[]>();
    for (const p of rawData.parcelas) {
      if (!parcelasByLote.has(p.lote_id)) parcelasByLote.set(p.lote_id, []);
      parcelasByLote.get(p.lote_id)!.push(p);
    }

    const compradoresMap = new Map<string, CompradorInadimplente>();

    for (const [loteId, parcelas] of parcelasByLote) {
      const venda = vendasByLote.get(loteId);
      if (!venda) continue;

      const comprador = venda.comprador as any;
      const parcelasAtraso: ParcelaAtrasoRelatorio[] = parcelas.map(p => ({
        numero: p.numero_parcela,
        totalParcelas: p.total_parcelas,
        tipoFluxo: p.tipo_fluxo as "PARCELAMENTO" | "REFORCO",
        vencimento: new Date(p.vencimento),
        valorParcela: p.valor_parcela,
        mesesAtraso: 0, // Simplified — juros_percentual gives the info
        jurosPercentual: p.juros_percentual,
        valorJuros: p.valor_juros,
        valorMulta: p.valor_multa,
        totalParcela: p.total_devido,
      }));

      const totalDevido = parcelasAtraso.reduce((sum, p) => sum + p.totalParcela, 0);

      const loteInadimplente: LoteInadimplente = {
        loteId,
        quadra: parcelas[0].quadra,
        numeroLote: parcelas[0].numero_lote,
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

    resultado.compradores = Array.from(compradoresMap.values()).sort(
      (a, b) => b.totalGeral - a.totalGeral,
    );
    resultado.totalGeralDevido = resultado.compradores.reduce((sum, c) => sum + c.totalGeral, 0);
    resultado.qtdTotalParcelasAtraso = resultado.compradores.reduce((sum, c) => sum + c.qtdParcelasAtraso, 0);
    resultado.qtdLotesInadimplentes = resultado.compradores.reduce((sum, c) => sum + c.lotes.length, 0);

    return resultado;
  }, [rawData]);

  return { relatorio, isLoading };
}
