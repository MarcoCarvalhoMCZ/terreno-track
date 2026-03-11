/**
 * Módulo de Parcelas Abertas (Contas a Receber)
 * 
 * Popula e mantém a tabela `parcelas_abertas` usando o mesmo motor
 * financeiro da Consulta de Lote (calcularResumoLote + calcularEncargosParcela).
 */

import { supabase } from "@/integrations/supabase/client";
import { addMonths, endOfMonth, isSameMonth } from "date-fns";
import {
  calcularResumoLote,
  type MovimentoConta,
  type ParcelasControleRow,
  type DadosVenda,
} from "@/lib/calculo-financeiro";
import { calcularEncargosParcela, type MoraConfig, type CriterioJurosMora } from "@/lib/calculo-mora";

// ── Helpers ─────────────────────────────────────────────────────

async function fetchMoraConfig(): Promise<MoraConfig> {
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
}

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Regeneração por lote ────────────────────────────────────────

/**
 * Regenera todas as parcelas abertas de um lote.
 * Deleta as existentes e insere as calculadas pelo motor financeiro.
 */
export async function regenerarParcelasAbertas(loteId: string): Promise<number> {
  // 1. Buscar venda ativa
  const { data: venda, error: vendaErr } = await supabase
    .from("vendas")
    .select(`
      id, lote_id, qtd_parcelas, qtd_reforcos, frequencia_parcelas_meses,
      frequencia_reforcos_meses, primeiro_vencimento_parcela, primeiro_vencimento_reforco,
      valor_parcelamento, valor_reforco,
      lote:lotes(quadra, numero_lote)
    `)
    .eq("lote_id", loteId)
    .eq("status", "ATIVA")
    .order("data_venda", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (vendaErr) throw vendaErr;
  if (!venda) {
    // Sem venda ativa — limpar parcelas abertas
    await supabase.from("parcelas_abertas").delete().eq("lote_id", loteId);
    return 0;
  }

  const lote = venda.lote as any;

  // 2. Buscar movimentos e parcelas_controle
  const [{ data: movData, error: movErr }, { data: pcData, error: pcErr }, moraConfig] = await Promise.all([
    supabase
      .from("conta_corrente_lote")
      .select("tipo_mov, tipo_fluxo, debito, credito, data_mov, vencimento, referencia, numero_parcela, sequencia_parcela")
      .eq("lote_id", loteId)
      .order("data_mov", { ascending: true }),
    supabase
      .from("parcelas_controle")
      .select("tipo_fluxo, data_base, qtd_pagas_base")
      .eq("lote_id", loteId),
    fetchMoraConfig(),
  ]);

  if (movErr) throw movErr;
  if (pcErr) throw pcErr;

  const movimentos: MovimentoConta[] = (movData || []).map((m: any) => ({
    tipo_mov: m.tipo_mov,
    tipo_fluxo: m.tipo_fluxo,
    debito: m.debito,
    credito: m.credito,
    data_mov: m.data_mov,
    vencimento: m.vencimento,
    referencia: m.referencia,
    numero_parcela: m.numero_parcela,
    sequencia_parcela: m.sequencia_parcela,
  }));

  const parcelasControle: ParcelasControleRow[] = (pcData || []).map((pc: any) => ({
    tipo_fluxo: pc.tipo_fluxo,
    data_base: pc.data_base,
    qtd_pagas_base: pc.qtd_pagas_base,
  }));

  // 3. Calcular resumo via motor financeiro
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

  // Data de referência: última ATUALIZACAO válida ou hoje
  const now = new Date();
  const maxValidYear = now.getFullYear() + 1;
  const lastAtMov = movimentos
    .filter(m => m.tipo_mov === "ATUALIZACAO" && new Date(m.data_mov).getFullYear() <= maxValidYear)
    .sort((a, b) => b.data_mov.localeCompare(a.data_mov))[0];
  const dataRef = lastAtMov ? new Date(lastAtMov.data_mov) : now;

  // 4. Gerar parcelas abertas
  const rows: any[] = [];

  const gerarParcelas = (
    tipoFluxo: "PARCELAMENTO" | "REFORCO",
    qtdAPagar: number,
    qtdPagas: number,
    qtdTotal: number,
    valorParcela: number,
    primeiroVenc: Date | null,
    freq: number,
  ) => {
    if (qtdAPagar <= 0 || !primeiroVenc) return;

    for (let i = 0; i < qtdAPagar; i++) {
      const venc = addMonths(primeiroVenc, (qtdPagas + i) * freq);
      if (venc > dataRef && !isSameMonth(venc, dataRef)) break;

      const encargos = calcularEncargosParcela(valorParcela, venc, dataRef, moraConfig);

      if (encargos.isVencida || isSameMonth(venc, dataRef)) {
        rows.push({
          lote_id: loteId,
          venda_id: venda.id,
          quadra: lote?.quadra || "",
          numero_lote: lote?.numero_lote || "",
          tipo_fluxo: tipoFluxo,
          numero_parcela: qtdPagas + i + 1,
          total_parcelas: qtdTotal,
          vencimento: venc.toISOString().split("T")[0],
          valor_parcela: valorParcela,
          juros_percentual: encargos.jurosPercentual,
          valor_juros: encargos.valorJuros,
          valor_multa: encargos.valorMulta,
          total_devido: encargos.totalParcela,
          status: "ABERTO",
        });
      }
    }
  };

  gerarParcelas(
    "PARCELAMENTO",
    resumo.qtdParcelasAPagar, resumo.qtdParcelasPagas,
    resumo.qtdParcelasContratadas, resumo.valorProximaParcela,
    resumo.primeiroVencimentoParcela, venda.frequencia_parcelas_meses || 1,
  );

  gerarParcelas(
    "REFORCO",
    resumo.qtdReforcosAPagar, resumo.qtdReforcosPagos,
    resumo.qtdReforcosContratados, resumo.valorProximoReforco,
    resumo.primeiroVencimentoReforco, venda.frequencia_reforcos_meses || 12,
  );

  // 5. Deletar existentes e inserir novas
  const { error: delErr } = await supabase
    .from("parcelas_abertas")
    .delete()
    .eq("lote_id", loteId);
  if (delErr) throw delErr;

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("parcelas_abertas")
      .insert(rows);
    if (insErr) throw insErr;
  }

  return rows.length;
}

// ── Regeneração em lote (todos os lotes ativos) ─────────────────

/**
 * Regenera parcelas abertas para todos os lotes com vendas ativas.
 */
export async function regenerarTodasParcelasAbertas(): Promise<number> {
  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("lote_id")
    .eq("status", "ATIVA");

  if (error) throw error;
  if (!vendas?.length) return 0;

  const loteIds = [...new Set(vendas.map(v => v.lote_id))];
  let total = 0;

  for (const lid of loteIds) {
    try {
      total += await regenerarParcelasAbertas(lid);
    } catch (e) {
      console.error(`Erro ao regenerar parcelas_abertas para lote ${lid}:`, e);
    }
  }

  return total;
}

// ── Marcar parcela como paga ────────────────────────────────────

/**
 * Marca uma parcela como paga ou deleta o registro.
 */
export async function marcarParcelaPaga(
  loteId: string,
  tipoFluxo: string,
  numeroParcela: number,
  dataPagamento: string,
): Promise<void> {
  const { error } = await supabase
    .from("parcelas_abertas")
    .update({
      status: "PAGO",
      data_pagamento: dataPagamento,
      updated_at: new Date().toISOString(),
    })
    .eq("lote_id", loteId)
    .eq("tipo_fluxo", tipoFluxo)
    .eq("numero_parcela", numeroParcela);

  if (error) throw error;
}
