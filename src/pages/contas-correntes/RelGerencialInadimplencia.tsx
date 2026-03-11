import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, format, differenceInCalendarMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useMoraConfig } from "@/hooks/useParcelasEmAtraso";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LoteResumo {
  loteId: string;
  quadra: string;
  numeroLote: string;
  loteLabel: string;
  // Reforços
  reforcoAnual: number;
  reforcoAtrasado: number;
  // Parcelamento por competência (YYYY-MM -> valor)
  parcelamentoPorMes: Record<string, number>;
}

export default function RelGerencialInadimplencia() {
  const [consultar, setConsultar] = useState(false);
  const { data: moraConfig } = useMoraConfig();

  const { data: resultado, isLoading } = useQuery({
    queryKey: ["rel-gerencial-inadimplencia"],
    queryFn: async () => {
      // 1. Vendas ativas com dados de lote e parcelas
      const { data: vendas, error: vendasErr } = await supabase
        .from("vendas")
        .select(`
          id, lote_id, comprador_pessoa_id, data_venda, valor_venda,
          qtd_parcelas, qtd_reforcos, frequencia_parcelas_meses, frequencia_reforcos_meses,
          primeiro_vencimento_parcela, primeiro_vencimento_reforco,
          lote:lotes(quadra, numero_lote)
        `)
        .eq("status", "ATIVA");

      if (vendasErr) throw vendasErr;
      if (!vendas || vendas.length === 0) return { lotes: [], competencias: [] };

      // 2. Pagamentos realizados (contagem por lote/fluxo)
      const { data: pagData, error: pagErr } = await supabase
        .from("conta_corrente_lote")
        .select("lote_id, tipo_fluxo, tipo_mov, credito")
        .in("tipo_mov", ["PARCELA", "REFORCO"])
        .gt("credito", 0);

      if (pagErr) throw pagErr;

      const pagamentos: Record<string, { parcelamento: number; reforco: number }> = {};
      (pagData || []).forEach((p: any) => {
        if (!pagamentos[p.lote_id]) pagamentos[p.lote_id] = { parcelamento: 0, reforco: 0 };
        if (p.tipo_fluxo === "PARCELAMENTO") pagamentos[p.lote_id].parcelamento++;
        else if (p.tipo_fluxo === "REFORCO") pagamentos[p.lote_id].reforco++;
      });

      // 3. Saldos por fluxo
      const { data: saldosData, error: saldosErr } = await supabase
        .from("vw_resumo_fluxo_lote")
        .select("lote_id, tipo_fluxo, saldo_atualizado, qtd_restante");

      if (saldosErr) throw saldosErr;

      const saldos: Record<string, Record<string, { saldo: number; qtdRestante: number }>> = {};
      (saldosData || []).forEach((s: any) => {
        if (!saldos[s.lote_id]) saldos[s.lote_id] = {};
        saldos[s.lote_id][s.tipo_fluxo] = {
          saldo: s.saldo_atualizado || 0,
          qtdRestante: s.qtd_restante || 0,
        };
      });

      const dataAtual = new Date();
      const anoAtual = dataAtual.getFullYear();
      const allCompetencias = new Set<string>();
      const lotes: LoteResumo[] = [];

      for (const venda of vendas) {
        const lote = venda.lote as any;
        if (!lote) continue;

        const pag = pagamentos[venda.lote_id] || { parcelamento: 0, reforco: 0 };
        const saldoLote = saldos[venda.lote_id] || {};

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

        // Calcular reforços em atraso
        if (venda.qtd_reforcos && venda.primeiro_vencimento_reforco) {
          const qtdTotal = venda.qtd_reforcos;
          const qtdPagas = pag.reforco;
          const qtdAPagar = Math.max(0, qtdTotal - qtdPagas);
          const saldoReforco = saldoLote["REFORCO"]?.saldo || 0;
          const valorReforco = qtdAPagar > 0 ? saldoReforco / qtdAPagar : 0;
          const primeiroVenc = new Date(venda.primeiro_vencimento_reforco);
          const freq = venda.frequencia_reforcos_meses || 12;

          let reforcoAno = 0;
          let reforcoAtrasado = 0;

          for (let i = 0; i < qtdAPagar; i++) {
            const venc = addMonths(primeiroVenc, (qtdPagas + i) * freq);
            if (venc > dataAtual) break; // não vencida ainda
            if (venc.getFullYear() === anoAtual) {
              reforcoAno += valorReforco;
            } else {
              reforcoAtrasado += valorReforco;
            }
          }
          item.reforcoAnual = reforcoAno;
          item.reforcoAtrasado = reforcoAtrasado;
        }

        // Calcular parcelas em atraso por mês
        if (venda.qtd_parcelas && venda.primeiro_vencimento_parcela) {
          const qtdTotal = venda.qtd_parcelas;
          const qtdPagas = pag.parcelamento;
          const qtdAPagar = Math.max(0, qtdTotal - qtdPagas);
          const saldoParc = saldoLote["PARCELAMENTO"]?.saldo || 0;
          const valorParcela = qtdAPagar > 0 ? saldoParc / qtdAPagar : 0;
          const primeiroVenc = new Date(venda.primeiro_vencimento_parcela);
          const freq = venda.frequencia_parcelas_meses || 1;

          for (let i = 0; i < qtdAPagar; i++) {
            const venc = addMonths(primeiroVenc, (qtdPagas + i) * freq);
            if (venc > dataAtual) break; // não vencida ainda
            const comp = format(venc, "yyyy-MM");
            item.parcelamentoPorMes[comp] = (item.parcelamentoPorMes[comp] || 0) + valorParcela;
            allCompetencias.add(comp);
          }
        }

        // Só incluir se tem algo em atraso
        const temReforco = item.reforcoAnual > 0 || item.reforcoAtrasado > 0;
        const temParcela = Object.keys(item.parcelamentoPorMes).length > 0;
        if (temReforco || temParcela) {
          lotes.push(item);
        }
      }

      // Ordenar lotes
      lotes.sort((a, b) => {
        const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
        if (cmp !== 0) return cmp;
        return a.numeroLote.localeCompare(b.numeroLote, "pt-BR", { numeric: true });
      });

      // Competências em ordem decrescente
      const competencias = Array.from(allCompetencias).sort((a, b) => b.localeCompare(a));

      return { lotes, competencias };
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

  function exportarPDF() {
    if (!resultado || resultado.lotes.length === 0 || !totais) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const titulo = "Relatório Gerencial de Inadimplência";

    doc.setFontSize(14);
    doc.text(titulo, 14, 15);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);

    const head = [
      "Lote",
      `Reforços ${new Date().getFullYear()}`,
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
                      {new Date().getFullYear()}
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
