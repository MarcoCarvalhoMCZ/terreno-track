import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, lastDayOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LoteResumo {
  loteId: string;
  quadra: string;
  numeroLote: string;
  loteLabel: string;
  reforcoMesRef: number;       // reforço vencendo no mês de referência
  reforcoAtrasado: number;     // reforços atrasados (antes do mês de referência)
  parcelamentoMesRef: number;  // parcela vencendo no mês de referência
  parcelamentoPorMes: Record<string, number>; // parcelas atrasadas por competência (com encargos)
}

export default function RelGerencialInadimplencia() {
  const [consultar, setConsultar] = useState(false);

  const { data: resultado, isLoading } = useQuery({
    queryKey: ["rel-gerencial-inadimplencia"],
    queryFn: async () => {
      // Buscar parcelas abertas diretamente da tabela persistida
      const { data: parcelas, error } = await supabase
        .from("parcelas_abertas")
        .select("*")
        .eq("status", "ABERTO")
        .order("quadra")
        .order("numero_lote")
        .order("vencimento");

      if (error) throw error;
      if (!parcelas || parcelas.length === 0) return { lotes: [], competencias: [] };

      // Determinar data de referência (max vencimento com dados)
      const allCompetencias = new Set<string>();
      const lotesMap = new Map<string, LoteResumo>();
      let maxDataRef = new Date(0);

      for (const p of parcelas) {
        const venc = new Date(p.vencimento);
        if (venc > maxDataRef) maxDataRef = venc;

        const key = p.lote_id;
        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            loteId: p.lote_id,
            quadra: p.quadra,
            numeroLote: p.numero_lote,
            loteLabel: `${p.quadra}-${p.numero_lote}`,
            reforcoMesRef: 0,
            reforcoAtrasado: 0,
            parcelamentoMesRef: 0,
            parcelamentoPorMes: {},
          });
        }

        const item = lotesMap.get(key)!;

        if (p.tipo_fluxo === "REFORCO") {
          // Para reforços, usar a mesma lógica: mês ref vs atrasado
          // Comparar com o vencimento mais recente do lote como proxy de data ref
          // Simplificar: se não há juros, é do mês; se há juros, é atrasado
          if (p.juros_percentual > 0) {
            item.reforcoAtrasado += p.total_devido;
          } else {
            item.reforcoMesRef += p.total_devido;
          }
        } else {
          // PARCELAMENTO
          if (p.juros_percentual > 0) {
            const comp = format(venc, "yyyy-MM");
            item.parcelamentoPorMes[comp] = (item.parcelamentoPorMes[comp] || 0) + p.total_devido;
            allCompetencias.add(comp);
          } else {
            item.parcelamentoMesRef += p.total_devido;
          }
        }
      }

      const lotes = Array.from(lotesMap.values())
        .filter(item => {
          const temReforco = item.reforcoMesRef > 0 || item.reforcoAtrasado > 0;
          const temParcela = item.parcelamentoMesRef > 0 || Object.keys(item.parcelamentoPorMes).length > 0;
          return temReforco || temParcela;
        })
        .sort((a, b) => {
          const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
          if (cmp !== 0) return cmp;
          return a.numeroLote.localeCompare(b.numeroLote, "pt-BR", { numeric: true });
        });

      const competencias = Array.from(allCompetencias).sort((a, b) => b.localeCompare(a));

      return { lotes, competencias, dataRef: maxDataRef.toISOString() };
    },
    enabled: consultar,
  });

  const totais = useMemo(() => {
    if (!resultado || resultado.lotes.length === 0) return null;
    const lots = resultado.lotes as LoteResumo[];
    const totReforcoMesRef = lots.reduce((s, l) => s + l.reforcoMesRef, 0);
    const totReforcoAtrasado = lots.reduce((s, l) => s + l.reforcoAtrasado, 0);
    const totParcelaMesRef = lots.reduce((s, l) => s + l.parcelamentoMesRef, 0);
    const totPorMes: Record<string, number> = {};
    for (const comp of resultado.competencias) {
      totPorMes[comp] = lots.reduce((s, l) => s + (l.parcelamentoPorMes[comp] || 0), 0);
    }
    return { totReforcoMesRef, totReforcoAtrasado, totParcelaMesRef, totPorMes };
  }, [resultado]);

  function formatComp(comp: string) {
    const [y, m] = comp.split("-");
    return `${m}/${y}`;
  }

  const dataRefFormatted = resultado?.dataRef
    ? new Date(resultado.dataRef).toLocaleDateString("pt-BR")
    : "";

  const mesRefLabel = resultado?.dataRef
    ? format(new Date(resultado.dataRef), "MM/yyyy")
    : "";

  function exportarPDF() {
    if (!resultado || resultado.lotes.length === 0 || !totais) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório Gerencial de Inadimplência", 14, 15);
    doc.setFontSize(8);
    doc.text(`Data referência: ${dataRefFormatted}    Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);

    const head = [
      "Lote",
      `Ref. ${mesRefLabel}`,
      "Ref. Atrasados",
      `Parc. ${mesRefLabel}`,
      ...resultado.competencias.map(formatComp),
    ];

    const body = resultado.lotes.map((l) => [
      l.loteLabel,
      l.reforcoMesRef > 0 ? formatCurrency(l.reforcoMesRef) : "",
      l.reforcoAtrasado > 0 ? formatCurrency(l.reforcoAtrasado) : "",
      l.parcelamentoMesRef > 0 ? formatCurrency(l.parcelamentoMesRef) : "",
      ...resultado.competencias.map((c) =>
        l.parcelamentoPorMes[c] ? formatCurrency(l.parcelamentoPorMes[c]) : ""
      ),
    ]);

    const foot = [
      "TOTAIS",
      totais.totReforcoMesRef > 0 ? formatCurrency(totais.totReforcoMesRef) : "",
      totais.totReforcoAtrasado > 0 ? formatCurrency(totais.totReforcoAtrasado) : "",
      totais.totParcelaMesRef > 0 ? formatCurrency(totais.totParcelaMesRef) : "",
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
          data.cell.styles.halign = data.column.index === 0 ? "left" : "right";
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
                    <th colSpan={1 + resultado.competencias.length} className="px-3 py-1 text-center font-bold bg-green-100 dark:bg-green-900/30">
                      PARCELAMENTO
                    </th>
                  </tr>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-1.5 text-right text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 border-r whitespace-nowrap">
                      {mesRefLabel}
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 border-r whitespace-nowrap">
                      Atrasados
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-semibold bg-green-50 dark:bg-green-900/10 border-r whitespace-nowrap">
                      {mesRefLabel}
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
                        {l.reforcoMesRef > 0 ? formatCurrency(l.reforcoMesRef) : ""}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono text-xs border-r ${l.reforcoAtrasado > 0 ? "text-destructive font-semibold" : ""}`}>
                        {l.reforcoAtrasado > 0 ? formatCurrency(l.reforcoAtrasado) : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs border-r">
                        {l.parcelamentoMesRef > 0 ? formatCurrency(l.parcelamentoMesRef) : ""}
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
                      {totais.totReforcoMesRef > 0 ? formatCurrency(totais.totReforcoMesRef) : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r text-destructive">
                      {totais.totReforcoAtrasado > 0 ? formatCurrency(totais.totReforcoAtrasado) : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r">
                      {totais.totParcelaMesRef > 0 ? formatCurrency(totais.totParcelaMesRef) : ""}
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
