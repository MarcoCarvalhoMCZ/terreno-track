import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, format, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  calcularResumoLote,
  type MovimentoConta,
  type ParcelasControleRow,
  type DadosVenda,
} from "@/lib/calculo-financeiro";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LoteResumo {
  loteId: string;
  quadra: string;
  numeroLote: string;
  loteLabel: string;
  reforcoAnual: number;
  reforcoAtrasado: number;
  parcelamentoPorMes: Record<string, number>;
}

export default function RelGerencialInadimplencia() {
  const [consultar, setConsultar] = useState(false);

  const { data: resultado, isLoading } = useQuery({
    queryKey: ["rel-gerencial-inadimplencia"],
    queryFn: async () => {
      // 1. Vendas ativas
      const { data: vendas, error: vendasErr } = await supabase
        .from("vendas")
        .select(`
          id, lote_id, comprador_pessoa_id, data_venda, valor_venda,
          qtd_parcelas, qtd_reforcos, frequencia_parcelas_meses, frequencia_reforcos_meses,
          primeiro_vencimento_parcela, primeiro_vencimento_reforco,
          valor_parcelamento, valor_reforco,
          lote:lotes(quadra, numero_lote)
        `)
        .eq("status", "ATIVA");

      if (vendasErr) throw vendasErr;
      if (!vendas || vendas.length === 0) return { lotes: [], competencias: [] };

      // 2. ALL movimentos (bulk fetch, grouped in memory)
      const loteIds = [...new Set(vendas.map((v) => v.lote_id))];
      const allMovimentos: Record<string, MovimentoConta[]> = {};

      // Fetch in chunks of 50 lote_ids to avoid URL length issues
      for (let i = 0; i < loteIds.length; i += 50) {
        const chunk = loteIds.slice(i, i + 50);
        const { data: movData, error: movErr } = await supabase
          .from("conta_corrente_lote")
          .select("lote_id, tipo_mov, tipo_fluxo, debito, credito, data_mov, vencimento, referencia")
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
          });
        }
      }

      // 3. ALL parcelas_controle
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

      // 4. Determine reference date: last day of month of last ATUALIZACAO across all lots
      let dataRef = new Date();
      const { data: lastAtData } = await supabase
        .from("conta_corrente_lote")
        .select("data_mov")
        .eq("tipo_mov", "ATUALIZACAO")
        .order("data_mov", { ascending: false })
        .limit(1);

      if (lastAtData && lastAtData.length > 0) {
        dataRef = endOfMonth(new Date(lastAtData[0].data_mov));
      }

      const anoRef = dataRef.getFullYear();
      const allCompetencias = new Set<string>();
      const lotes: LoteResumo[] = [];

      for (const venda of vendas) {
        const lote = venda.lote as any;
        if (!lote) continue;

        const movimentos = allMovimentos[venda.lote_id] || [];
        const parcelasControle = allParcControle[venda.lote_id] || [];

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

        const loteLabel = `${lote.quadra}-${lote.numero_lote}`;
        const item: LoteResumo = {
          loteId: venda.lote_id,
          quadra: lote.quadra,
          numeroLote: lote.numero_lote,
          loteLabel,
          reforcoAnual: 0,
          reforcoAtrasado: 0,
          parcelamentoPorMes: {},
        };

        // Reforços em atraso (using central engine values)
        if (resumo.qtdReforcosAPagar > 0 && resumo.primeiroVencimentoReforco) {
          const freq = venda.frequencia_reforcos_meses || 12;
          const valorReforco = resumo.valorProximoReforco;

          for (let i = 0; i < resumo.qtdReforcosAPagar; i++) {
            const venc = addMonths(resumo.primeiroVencimentoReforco, (resumo.qtdReforcosPagos + i) * freq);
            if (venc > dataRef) break;
            if (venc.getFullYear() === anoRef) {
              item.reforcoAnual += valorReforco;
            } else {
              item.reforcoAtrasado += valorReforco;
            }
          }
        }

        // Parcelas em atraso por competência (using central engine values)
        if (resumo.qtdParcelasAPagar > 0 && resumo.primeiroVencimentoParcela) {
          const freq = venda.frequencia_parcelas_meses || 1;
          const valorParcela = resumo.valorProximaParcela;

          for (let i = 0; i < resumo.qtdParcelasAPagar; i++) {
            const venc = addMonths(resumo.primeiroVencimentoParcela, (resumo.qtdParcelasPagas + i) * freq);
            if (venc > dataRef) break;
            const comp = format(venc, "yyyy-MM");
            item.parcelamentoPorMes[comp] = (item.parcelamentoPorMes[comp] || 0) + valorParcela;
            allCompetencias.add(comp);
          }
        }

        const temReforco = item.reforcoAnual > 0 || item.reforcoAtrasado > 0;
        const temParcela = Object.keys(item.parcelamentoPorMes).length > 0;
        if (temReforco || temParcela) {
          lotes.push(item);
        }
      }

      lotes.sort((a, b) => {
        const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
        if (cmp !== 0) return cmp;
        return a.numeroLote.localeCompare(b.numeroLote, "pt-BR", { numeric: true });
      });

      const competencias = Array.from(allCompetencias).sort((a, b) => b.localeCompare(a));

      return { lotes, competencias, dataRef: dataRef.toISOString() };
    },
    enabled: consultar,
  });

  const totais = useMemo(() => {
    if (!resultado || resultado.lotes.length === 0) return null;
    const totReforcoAnual = resultado.lotes.reduce((s, l) => s + l.reforcoAnual, 0);
    const totReforcoAtrasado = resultado.lotes.reduce((s, l) => s + l.reforcoAtrasado, 0);
    const totPorMes: Record<string, number> = {};
    for (const comp of resultado.competencias) {
      totPorMes[comp] = resultado.lotes.reduce((s, l) => s + (l.parcelamentoPorMes[comp] || 0), 0);
    }
    return { totReforcoAnual, totReforcoAtrasado, totPorMes };
  }, [resultado]);

  function formatComp(comp: string) {
    const [y, m] = comp.split("-");
    return `${m}/${y}`;
  }

  const dataRefFormatted = resultado?.dataRef
    ? new Date(resultado.dataRef).toLocaleDateString("pt-BR")
    : "";

  function exportarPDF() {
    if (!resultado || resultado.lotes.length === 0 || !totais) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const titulo = "Relatório Gerencial de Inadimplência";

    doc.setFontSize(14);
    doc.text(titulo, 14, 15);
    doc.setFontSize(8);
    doc.text(`Data referência: ${dataRefFormatted}    Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);

    const anoRef = resultado.dataRef ? new Date(resultado.dataRef).getFullYear() : new Date().getFullYear();
    const head = [
      "Lote",
      `Reforços ${anoRef}`,
      "Ref. Atrasados",
      ...resultado.competencias.map(formatComp),
    ];

    const body = resultado.lotes.map((l) => [
      l.loteLabel,
      l.reforcoAnual > 0 ? formatCurrency(l.reforcoAnual) : "",
      l.reforcoAtrasado > 0 ? formatCurrency(l.reforcoAtrasado) : "",
      ...resultado.competencias.map((c) =>
        l.parcelamentoPorMes[c] ? formatCurrency(l.parcelamentoPorMes[c]) : ""
      ),
    ]);

    const foot = [
      "TOTAIS",
      totais.totReforcoAnual > 0 ? formatCurrency(totais.totReforcoAnual) : "",
      totais.totReforcoAtrasado > 0 ? formatCurrency(totais.totReforcoAtrasado) : "",
      ...resultado.competencias.map((c) =>
        totais.totPorMes[c] > 0 ? formatCurrency(totais.totPorMes[c]) : ""
      ),
    ];

    autoTable(doc, {
      startY: 25,
      head: [head],
      body,
      foot: [foot],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 7 },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: Object.fromEntries(
        Array.from({ length: head.length }, (_, i) => [i, i >= 1 ? { halign: "right" as const } : {}])
      ),
      didParseCell: (data) => {
        if (data.section === "foot") {
          data.cell.styles.halign = "right";
        }
        if (data.section === "foot" && data.column.index === 0) {
          data.cell.styles.halign = "left";
        }
      },
    });

    doc.save("rel_gerencial_inadimplencia.pdf");
  }

  const anoRef = resultado?.dataRef ? new Date(resultado.dataRef).getFullYear() : new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Rel. Gerencial de Inadimplência</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <Button onClick={() => setConsultar(true)}>
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
            {resultado && resultado.lotes.length > 0 && (
              <Button variant="outline" onClick={exportarPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
            {dataRefFormatted && (
              <span className="text-sm text-muted-foreground ml-4">
                Data referência: <strong>{dataRefFormatted}</strong>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      )}

      {resultado && resultado.lotes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma inadimplência encontrada.
        </div>
      )}

      {resultado && resultado.lotes.length > 0 && totais && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inadimplência por Lote e Competência</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th rowSpan={2} className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-bold border-r">
                      LOTES
                    </th>
                    <th colSpan={2} className="px-3 py-1 text-center font-bold bg-amber-100 dark:bg-amber-900/30 border-r">
                      REFORÇOS
                    </th>
                    <th colSpan={resultado.competencias.length} className="px-3 py-1 text-center font-bold bg-green-100 dark:bg-green-900/30">
                      PARCELAMENTO
                    </th>
                  </tr>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-1.5 text-right text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 border-r whitespace-nowrap">
                      {anoRef}
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 border-r whitespace-nowrap">
                      Atrasados
                    </th>
                    {resultado.competencias.map((c) => (
                      <th key={c} className="px-3 py-1.5 text-right text-xs font-semibold bg-green-50 dark:bg-green-900/10 whitespace-nowrap">
                        {formatComp(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.lotes.map((l, i) => (
                    <tr key={l.loteId} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="sticky left-0 z-10 px-3 py-1.5 font-medium border-r bg-inherit whitespace-nowrap">
                        {l.loteLabel}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs border-r">
                        {l.reforcoAnual > 0 ? formatCurrency(l.reforcoAnual) : ""}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono text-xs border-r ${l.reforcoAtrasado > 0 ? "text-destructive font-semibold" : ""}`}>
                        {l.reforcoAtrasado > 0 ? formatCurrency(l.reforcoAtrasado) : ""}
                      </td>
                      {resultado.competencias.map((c) => {
                        const val = l.parcelamentoPorMes[c];
                        return (
                          <td key={c} className="px-3 py-1.5 text-right font-mono text-xs">
                            {val ? formatCurrency(val) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-bold">
                    <td className="sticky left-0 z-10 px-3 py-2 bg-muted/50 border-r">TOTAIS</td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r">
                      {totais.totReforcoAnual > 0 ? formatCurrency(totais.totReforcoAnual) : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r text-destructive">
                      {totais.totReforcoAtrasado > 0 ? formatCurrency(totais.totReforcoAtrasado) : ""}
                    </td>
                    {resultado.competencias.map((c) => (
                      <td key={c} className="px-3 py-2 text-right font-mono text-xs">
                        {totais.totPorMes[c] > 0 ? formatCurrency(totais.totPorMes[c]) : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
