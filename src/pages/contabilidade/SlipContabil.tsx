import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getTipoMovimentoLabel } from "@/constants/movimento";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MESES_LABEL = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
  { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
}

interface SlipRow {
  data_mov: string;
  tipo_mov: string;
  quadra: string;
  numero_lote: string;
  comprador_nome: string | null;
  valor_venda: number | null;
  custo_contabil: number | null;
  debito: number | null;
  credito: number | null;
  conta_codigo: string;
  conta_descricao: string;
  natureza_lancamento: string;
  valor: number;
}

export default function SlipContabil() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [contaFiltro, setContaFiltro] = useState<string>("ALL");

  const { data: contas } = useQuery({
    queryKey: ["contas-contabeis-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as ContaContabil[];
    },
  });

  const { data: mapa } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*, conta_contabil:contas_contabeis(id, codigo, descricao)");
      if (error) throw error;
      return data as unknown as {
        tipo_movimento: string;
        conta_contabil_id: string;
        natureza_lancamento: string;
        conta_contabil: { id: string; codigo: string; descricao: string };
      }[];
    },
  });

  const startDate = `${ano}-${mes.padStart(2, "0")}-01`;
  const endDate = `${ano}-${mes.padStart(2, "0")}-31`;

  const { data: movimentos, isLoading } = useQuery({
    queryKey: ["slip-contabil-movimentos", ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select(`
          data_mov, tipo_mov, debito, credito, venda_id,
          lote:lotes(quadra, numero_lote, custo_contabil),
          venda:vendas(valor_venda, comprador_nome_1)
        `)
        .gte("data_mov", startDate)
        .lte("data_mov", endDate)
        .order("data_mov");
      if (error) throw error;
      return data as any[];
    },
  });

  // Build slip rows
  const slipRows = useMemo(() => {
    if (!movimentos || !mapa) return [];

    const rows: SlipRow[] = [];

    for (const mov of movimentos) {
      const mappings = mapa.filter((m) => m.tipo_movimento === mov.tipo_mov);
      if (!mappings.length) continue;

      const valor = Number(mov.debito || 0) + Number(mov.credito || 0);
      const lote = mov.lote as any;
      const venda = mov.venda as any;

      for (const mapping of mappings) {
        rows.push({
          data_mov: mov.data_mov,
          tipo_mov: mov.tipo_mov,
          quadra: lote?.quadra || "-",
          numero_lote: lote?.numero_lote || "-",
          comprador_nome: venda?.comprador_nome_1 || null,
          valor_venda: mov.tipo_mov === "VENDA" ? venda?.valor_venda : null,
          custo_contabil: mov.tipo_mov === "VENDA" ? lote?.custo_contabil : null,
          debito: mov.debito,
          credito: mov.credito,
          conta_codigo: mapping.conta_contabil.codigo,
          conta_descricao: mapping.conta_contabil.descricao,
          natureza_lancamento: mapping.natureza_lancamento,
          valor,
        });
      }
    }

    return rows;
  }, [movimentos, mapa]);

  const filteredRows = useMemo(() => {
    if (contaFiltro === "ALL") return slipRows;
    return slipRows.filter((r) => r.conta_codigo === contaFiltro);
  }, [slipRows, contaFiltro]);

  const totalValor = filteredRows.reduce((s, r) => s + r.valor, 0);

  const mesLabel = MESES_LABEL.find((m) => m.value === mes)?.label || "";

  // PDF export
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`SLIP CONTÁBIL – ${mesLabel.toUpperCase()}/${ano}`, 14, 15);
    doc.setFontSize(10);
    if (contaFiltro !== "ALL") {
      const contaSel = contas?.find((c) => c.codigo === contaFiltro);
      doc.text(`Conta: ${contaFiltro}${contaSel ? ` – ${contaSel.descricao}` : ""}`, 14, 22);
    }

    const isVendaPresent = filteredRows.some((r) => r.tipo_mov === "VENDA");

    const headers = ["Data", "Conta", "Tipo Movimento", "Quadra/Lote", "Cliente", "Valor"];
    if (isVendaPresent) {
      headers.splice(5, 0, "Valor Venda", "Custo Contábil");
    }

    const body = filteredRows.map((r) => {
      const row = [
        format(new Date(r.data_mov + "T00:00:00"), "dd/MM"),
        `${r.conta_codigo} – ${r.conta_descricao}`,
        getTipoMovimentoLabel(r.tipo_mov),
        `${r.quadra}-${r.numero_lote}`,
        r.comprador_nome || "-",
        formatCurrency(r.valor),
      ];
      if (isVendaPresent) {
        row.splice(5, 0,
          r.valor_venda !== null ? formatCurrency(r.valor_venda) : "-",
          r.custo_contabil !== null ? formatCurrency(r.custo_contabil) : "-"
        );
      }
      return row;
    });

    const totalColSpan = headers.length - 1;
    const footerRow = Array(headers.length).fill("");
    footerRow[0] = "TOTAL";
    footerRow[headers.length - 1] = formatCurrency(totalValor);

    autoTable(doc, {
      head: [headers],
      body: [...body, footerRow],
      startY: contaFiltro !== "ALL" ? 28 : 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 87, 55] },
      didParseCell: (data: any) => {
        if (data.row.index === body.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    doc.save(`slip-contabil-${ano}-${mes.padStart(2, "0")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Slip Contábil</h1>
          <p className="text-muted-foreground">Detalhamento contábil dos movimentos por período</p>
        </div>
        <Button onClick={exportPDF} disabled={!filteredRows.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-bold text-lg w-16 text-center">{ano}</span>
                <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_LABEL.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Contábil (opcional)</Label>
              <Select value={contaFiltro} onValueChange={setContaFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  {contas?.map((c) => (
                    <SelectItem key={c.id} value={c.codigo}>{c.codigo} – {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slip table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Slip Contábil – {mesLabel}/{ano}
            {filteredRows.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredRows.length} lançamentos)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><span className="text-muted-foreground">Carregando...</span></div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum lançamento contábil para o período selecionado.</p>
              <p className="text-sm text-muted-foreground">Verifique se o Mapa de Movimentos está configurado.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conta Contábil</TableHead>
                    <TableHead>Tipo Movimento</TableHead>
                    <TableHead>Quadra/Lote</TableHead>
                    <TableHead>Cliente</TableHead>
                    {filteredRows.some((r) => r.tipo_mov === "VENDA") && (
                      <>
                        <TableHead className="text-right">Valor Venda</TableHead>
                        <TableHead className="text-right">Custo Contábil</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{format(new Date(row.data_mov + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{row.conta_codigo}</span>
                        <span className="ml-1 text-muted-foreground">– {row.conta_descricao}</span>
                      </TableCell>
                      <TableCell>{getTipoMovimentoLabel(row.tipo_mov)}</TableCell>
                      <TableCell>{row.quadra}-{row.numero_lote}</TableCell>
                      <TableCell>{row.comprador_nome || "-"}</TableCell>
                      {filteredRows.some((r) => r.tipo_mov === "VENDA") && (
                        <>
                          <TableCell className="text-right font-mono">
                            {row.valor_venda !== null ? formatCurrency(row.valor_venda) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.custo_contabil !== null ? formatCurrency(row.custo_contabil) : "-"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(row.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={filteredRows.some((r) => r.tipo_mov === "VENDA") ? 7 : 5} className="font-bold">
                      TOTAL
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatCurrency(totalValor)}
                    </TableCell>
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
