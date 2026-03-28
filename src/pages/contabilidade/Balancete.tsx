import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calculator, RefreshCw, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MESES_LABEL: Record<number, string> = {
  1: "JAN", 2: "FEV", 3: "MAR", 4: "ABR", 5: "MAI", 6: "JUN",
  7: "JUL", 8: "AGO", 9: "SET", 10: "OUT", 11: "NOV", 12: "DEZ",
};

const MESES_NOME: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

const DEBIT_ROWS = [
  { key: "VENDA", label: "(+) Vendas" },
  { key: "ATUALIZACAO", label: "(+) Atualização Monetária" },
  { key: "JUROS", label: "(+) Juros" },
  { key: "MULTA", label: "(+) Multa" },
];

const CREDIT_ROWS = [
  { key: "ARRAS", label: "(-) Arras/Sinal" },
  { key: "PARCELA", label: "(-) Parcelas Recebidas" },
  { key: "REFORCO", label: "(-) Reforços Recebidos" },
  { key: "AMORTIZACAO_ESPECIAL", label: "(-) Amortização Especial" },
];

const KNOWN_DEBIT_KEYS = new Set(["VENDA", "ATUALIZACAO", "JUROS", "MULTA"]);
const KNOWN_CREDIT_KEYS = new Set(["ARRAS", "PARCELA", "REFORCO", "AMORTIZACAO_ESPECIAL"]);

interface MovRow {
  data_mov: string;
  tipo_mov: string;
  debito: number | null;
  credito: number | null;
}

interface PeriodData {
  label: string;
  saldoAnterior: number;
  debitValues: Record<string, number>;
  totalDebitos: number;
  creditValues: Record<string, number>;
  totalCreditos: number;
  totalOutros: number;
  saldoFinal: number;
}

export default function Balancete() {
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [modo, setModo] = useState<"anual" | "periodo">("anual");
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(6);

  // Fetch lot IDs with active/quitada sales
  const { data: lotesAtivos } = useQuery({
    queryKey: ["balancete-lotes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("lote_id")
        .in("status", ["ATIVA", "QUITADA"]);
      if (error) throw error;
      return new Set((data || []).map((v) => v.lote_id));
    },
  });

  // Fetch ALL movements up to end of selected year (paginated), filtered by active lots
  const { data: allMovimentos, isLoading } = useQuery({
    queryKey: ["balancete-movimentos", ano, lotesAtivos ? Array.from(lotesAtivos).sort().join(",") : ""],
    queryFn: async () => {
      if (!lotesAtivos || lotesAtivos.size === 0) return [];
      const endDate = `${ano}-12-31`;
      const loteIds = Array.from(lotesAtivos);
      const pageSize = 1000;
      let all: MovRow[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("conta_corrente_lote")
          .select("data_mov, tipo_mov, debito, credito")
          .in("lote_id", loteIds)
          .lte("data_mov", endDate)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all = all.concat((data || []) as MovRow[]);
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }
      return all;
    },
    enabled: !!lotesAtivos && lotesAtivos.size > 0,
  });

  // Constrain mesFim when mesInicio changes
  const effectiveMesFim = useMemo(() => {
    if (modo === "anual") return 12;
    const maxEnd = Math.min(mesInicio + 5, 12);
    return Math.min(Math.max(mesFim, mesInicio), maxEnd);
  }, [modo, mesInicio, mesFim]);

  // Build period columns
  const periodos = useMemo(() => {
    if (modo === "anual") {
      return [{ label: String(ano), startDate: `${ano}-01-01`, endDate: `${ano}-12-31` }];
    }
    const result = [];
    for (let m = mesInicio; m <= effectiveMesFim; m++) {
      const mm = String(m).padStart(2, "0");
      const lastDay = new Date(ano, m, 0).getDate();
      result.push({
        label: `${MESES_LABEL[m]}/${String(ano).slice(2)}`,
        startDate: `${ano}-${mm}-01`,
        endDate: `${ano}-${mm}-${String(lastDay).padStart(2, "0")}`,
      });
    }
    return result;
  }, [ano, modo, mesInicio, effectiveMesFim]);

  // Compute table data per period
  const tableData = useMemo((): PeriodData[] | null => {
    if (!allMovimentos) return null;

    return periodos.map((periodo) => {
      const saldoAnterior = allMovimentos
        .filter((m) => m.data_mov < periodo.startDate)
        .reduce((s, m) => s + (Number(m.debito || 0) - Number(m.credito || 0)), 0);

      const periodMovs = allMovimentos.filter(
        (m) => m.data_mov >= periodo.startDate && m.data_mov <= periodo.endDate
      );

      const byTipo: Record<string, { debito: number; credito: number }> = {};
      for (const m of periodMovs) {
        if (!byTipo[m.tipo_mov]) byTipo[m.tipo_mov] = { debito: 0, credito: 0 };
        byTipo[m.tipo_mov].debito += Number(m.debito || 0);
        byTipo[m.tipo_mov].credito += Number(m.credito || 0);
      }

      const debitValues: Record<string, number> = {};
      let totalDebitos = 0;
      for (const row of DEBIT_ROWS) {
        // Use net value (debito - credito) for debit rows to handle deflation (e.g. negative ATUALIZACAO)
        const debito = byTipo[row.key]?.debito || 0;
        const credito = byTipo[row.key]?.credito || 0;
        const val = debito - credito;
        debitValues[row.key] = val;
        totalDebitos += val;
      }

      const creditValues: Record<string, number> = {};
      let totalCreditos = 0;
      for (const row of CREDIT_ROWS) {
        // Use net value (credito - debito) for credit rows
        const credito = byTipo[row.key]?.credito || 0;
        const debito = byTipo[row.key]?.debito || 0;
        const val = credito - debito;
        creditValues[row.key] = val;
        totalCreditos += val;
      }

      // "Outros" = tipos não categorizados + lado oposto ignorado dos categorizados
      let totalOutros = 0;
      for (const [key, vals] of Object.entries(byTipo)) {
        if (KNOWN_DEBIT_KEYS.has(key)) {
          // Credito side of debit types was ignored above
          totalOutros -= vals.credito;
        } else if (KNOWN_CREDIT_KEYS.has(key)) {
          // Debito side of credit types was ignored above
          totalOutros += vals.debito;
        } else {
          totalOutros += vals.debito - vals.credito;
        }
      }

      return {
        label: periodo.label,
        saldoAnterior,
        debitValues,
        totalDebitos,
        creditValues,
        totalCreditos,
        totalOutros,
        saldoFinal: saldoAnterior + totalDebitos - totalCreditos + totalOutros,
      };
    });
  }, [allMovimentos, periodos]);

  // Totals column (when multiple periods)
  const totaisCol = useMemo((): PeriodData | null => {
    if (!tableData || tableData.length <= 1) return null;
    const result: PeriodData = {
      label: "TOTAL",
      saldoAnterior: tableData[0].saldoAnterior,
      debitValues: {},
      totalDebitos: 0,
      creditValues: {},
      totalCreditos: 0,
      totalOutros: 0,
      saldoFinal: tableData[tableData.length - 1].saldoFinal,
    };
    for (const row of DEBIT_ROWS) result.debitValues[row.key] = 0;
    for (const row of CREDIT_ROWS) result.creditValues[row.key] = 0;
    for (const col of tableData) {
      for (const row of DEBIT_ROWS) result.debitValues[row.key] += col.debitValues[row.key] || 0;
      result.totalDebitos += col.totalDebitos;
      for (const row of CREDIT_ROWS) result.creditValues[row.key] += col.creditValues[row.key] || 0;
      result.totalCreditos += col.totalCreditos;
      result.totalOutros += col.totalOutros;
    }
    return result;
  }, [tableData]);

  const columns = useMemo(() => {
    const cols = tableData || [];
    return totaisCol ? [...cols, totaisCol] : cols;
  }, [tableData, totaisCol]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["balancete-movimentos"] });
    toast.success("Dados atualizados com sucesso.");
  };

  const exportarPDF = () => {
    if (!columns || columns.length === 0) return;

    const isLandscape = columns.length > 2;
    const doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a4" });

    const titulo = modo === "anual"
      ? `Balancete do Loteamento - ${ano}`
      : `Balancete do Loteamento - ${MESES_LABEL[mesInicio]}–${MESES_LABEL[effectiveMesFim]}/${ano}`;

    doc.setFontSize(14);
    doc.text(titulo, 14, 16);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);

    const head = ["Movimento", ...columns.map((c) => c.label)];

    const fmtVal = (v: number, dash = true) => (v === 0 && dash ? "-" : formatCurrency(v));

    const body: string[][] = [];

    // Saldo Anterior
    body.push(["(+) Saldo Anterior", ...columns.map((c) => formatCurrency(c.saldoAnterior))]);

    // Debits
    for (const row of DEBIT_ROWS) {
      body.push([row.label, ...columns.map((c) => fmtVal(c.debitValues[row.key] || 0))]);
    }
    body.push(["Subtotal Débitos", ...columns.map((c) => formatCurrency(c.totalDebitos))]);

    // Credits
    for (const row of CREDIT_ROWS) {
      body.push([row.label, ...columns.map((c) => fmtVal(c.creditValues[row.key] || 0))]);
    }
    body.push(["Subtotal Créditos", ...columns.map((c) => formatCurrency(c.totalCreditos))]);

    // Outros
    body.push(["(±) Outros/Ajustes", ...columns.map((c) => fmtVal(c.totalOutros))]);
    body.push(["Subtotal Outros", ...columns.map((c) => formatCurrency(c.totalOutros))]);

    // Saldo Final
    body.push(["(=) Saldo Final", ...columns.map((c) => formatCurrency(c.saldoFinal))]);

    const subtotalRowIndices = new Set([
      DEBIT_ROWS.length + 1, // after debits + saldo anterior
      DEBIT_ROWS.length + 1 + CREDIT_ROWS.length + 1, // after credits
      body.length - 2, // subtotal outros
    ]);
    const saldoAnteriorIdx = 0;
    const saldoFinalIdx = body.length - 1;

    autoTable(doc, {
      startY: 26,
      head: [head],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      columnStyles: Object.fromEntries(
        columns.map((_, i) => [i + 1, { halign: "right" as const }])
      ),
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const rowIdx = data.row.index;
        // Saldo Anterior row
        if (rowIdx === saldoAnteriorIdx) {
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.fontStyle = "bold";
        }
        // Subtotal rows
        if (subtotalRowIndices.has(rowIdx)) {
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.fontStyle = "bold";
        }
        // Saldo Final row
        if (rowIdx === saldoFinalIdx) {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const nomeArq = modo === "anual"
      ? `balancete_${ano}.pdf`
      : `balancete_${MESES_LABEL[mesInicio]}_${MESES_LABEL[effectiveMesFim]}_${ano}.pdf`;
    doc.save(nomeArq);
  };

  const renderValueCell = (value: number, isBold = false, isTotal = false) => (
    <TableCell
      className={`text-right font-mono text-sm ${isBold ? "font-bold" : ""} ${isTotal ? "text-primary" : ""} ${value < 0 ? "text-destructive" : ""}`}
    >
      {formatCurrency(value)}
    </TableCell>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balancete do Loteamento</h1>
          <p className="text-muted-foreground">Demonstrativo por tipos de movimento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Dados
          </Button>
          {columns.length > 0 && (
            <Button variant="outline" onClick={exportarPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Period controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl font-bold">{ano}</span>
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Select value={modo} onValueChange={(v) => setModo(v as "anual" | "periodo")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anual">Anual</SelectItem>
            <SelectItem value="periodo">Período</SelectItem>
          </SelectContent>
        </Select>

        {modo === "periodo" && (
          <>
            <Select value={String(mesInicio)} onValueChange={(v) => setMesInicio(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês início" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{MESES_NOME[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">até</span>
            <Select value={String(effectiveMesFim)} onValueChange={(v) => setMesFim(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês fim" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.min(6, 12 - mesInicio + 1) }, (_, i) => mesInicio + i).map((m) => (
                  <SelectItem key={m} value={String(m)}>{MESES_NOME[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Balancete {modo === "anual" ? ano : `${MESES_LABEL[mesInicio]}–${MESES_LABEL[effectiveMesFim]}/${ano}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="text-muted-foreground">Carregando...</span>
            </div>
          ) : !tableData || columns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[250px]">Movimento</TableHead>
                    {columns.map((col) => (
                      <TableHead
                        key={col.label}
                        className={`text-right min-w-[130px] ${col.label === "TOTAL" ? "font-bold bg-muted/30" : ""}`}
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Saldo Anterior */}
                  <TableRow className="bg-muted/20">
                    <TableCell className="sticky left-0 bg-muted/20 z-10 font-semibold">(+) Saldo Anterior</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.label} className={`text-right font-mono text-sm font-semibold ${col.label === "TOTAL" ? "bg-muted/30" : ""}`}>
                        {formatCurrency(col.saldoAnterior)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Separator */}
                  <TableRow><TableCell colSpan={columns.length + 1} className="h-1 p-0 bg-border/50" /></TableRow>

                  {/* Debit rows */}
                  {DEBIT_ROWS.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="sticky left-0 bg-background z-10">{row.label}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.label} className={`text-right font-mono text-sm ${col.label === "TOTAL" ? "bg-muted/30" : ""}`}>
                          {col.debitValues[row.key] ? formatCurrency(col.debitValues[row.key]) : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* Subtotal débitos */}
                  <TableRow className="bg-muted/10 border-t">
                    <TableCell className="sticky left-0 bg-muted/10 z-10 font-bold text-sm">Subtotal Débitos</TableCell>
                    {columns.map((col) => renderValueCell(col.totalDebitos, true, col.label === "TOTAL"))}
                  </TableRow>

                  {/* Separator */}
                  <TableRow><TableCell colSpan={columns.length + 1} className="h-1 p-0 bg-border/50" /></TableRow>

                  {/* Credit rows */}
                  {CREDIT_ROWS.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="sticky left-0 bg-background z-10">{row.label}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.label} className={`text-right font-mono text-sm ${col.label === "TOTAL" ? "bg-muted/30" : ""}`}>
                          {col.creditValues[row.key] ? formatCurrency(col.creditValues[row.key]) : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* Subtotal créditos */}
                  <TableRow className="bg-muted/10 border-t">
                    <TableCell className="sticky left-0 bg-muted/10 z-10 font-bold text-sm">Subtotal Créditos</TableCell>
                    {columns.map((col) => renderValueCell(col.totalCreditos, true, col.label === "TOTAL"))}
                  </TableRow>

                  {/* Separator */}
                  <TableRow><TableCell colSpan={columns.length + 1} className="h-1 p-0 bg-border/50" /></TableRow>

                  {/* Others */}
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10">(±) Outros/Ajustes</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.label} className={`text-right font-mono text-sm ${col.totalOutros < 0 ? "text-destructive" : ""} ${col.label === "TOTAL" ? "bg-muted/30" : ""}`}>
                        {col.totalOutros !== 0 ? formatCurrency(col.totalOutros) : "-"}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Subtotal outros */}
                  <TableRow className="bg-muted/10 border-t">
                    <TableCell className="sticky left-0 bg-muted/10 z-10 font-bold text-sm">Subtotal Outros</TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.label} className={`text-right font-mono text-sm font-bold ${col.totalOutros < 0 ? "text-destructive" : ""} ${col.label === "TOTAL" ? "text-primary" : ""}`}>
                        {formatCurrency(col.totalOutros)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>

                {/* Saldo Final */}
                <TableFooter>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-muted/50 z-10 font-bold">(=) Saldo Final</TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col.label}
                        className={`text-right font-mono font-bold ${col.saldoFinal < 0 ? "text-destructive" : "text-primary"} ${col.label === "TOTAL" ? "bg-muted/30" : ""}`}
                      >
                        {formatCurrency(col.saldoFinal)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
