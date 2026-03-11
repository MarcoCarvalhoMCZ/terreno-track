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
import { formatCurrency, formatDocument } from "@/lib/formatters";
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

interface MapaEntry {
  id: string;
  tipo_movimento: string;
  conta_debito_id: string | null;
  conta_credito_id: string | null;
  historico_padrao: string | null;
  lancamento_pai_id: string | null;
  conta_debito: { id: string; codigo: string; descricao: string } | null;
  conta_credito: { id: string; codigo: string; descricao: string } | null;
}

interface SlipRow {
  data_mov: string;
  tipo_mov: string;
  quadra: string;
  numero_lote: string;
  comprador_nome: string | null;
  valor_venda: number | null;
  custo_contabil: number | null;
  debito_valor: number | null;
  credito_valor: number | null;
  conta_debito_codigo: string;
  conta_debito_descricao: string;
  conta_credito_codigo: string;
  conta_credito_descricao: string;
  historico: string;
  valor: number;
  is_second: boolean;
  data_venda: string | null;
  parcela: number | null;
}

interface HistoricoCtx {
  comprador: string | null;
  cpf_comprador: string | null;
  comprador_nome_2: string | null;
  cpf_comprador_2: string | null;
  quadra: string;
  lote: string;
  area_m2: number | null;
  matricula_ri: string | null;
  data_venda: string | null;
  valor_venda: number | null;
  valor_arras: number | null;
  valor_reforco: number | null;
  qtd_reforcos: number | null;
  valor_parcelamento: number | null;
  qtd_parcelas: number | null;
  valor: number;
  parcela: number | null;
}

function resolveHistorico(template: string | null, ctx: HistoricoCtx): string {
  if (!template) return "";

  const solidario = ctx.comprador_nome_2
    ? `E ${ctx.comprador_nome_2} (CPF ${formatDocument(ctx.cpf_comprador_2)}) `
    : "";

  return template
    .replace(/\{ql\}/g, `${ctx.quadra}-${ctx.lote}`)
    .replace(/\{comprador\}/g, ctx.comprador || "—")
    .replace(/\{cpf_comprador\}/g, formatDocument(ctx.cpf_comprador))
    .replace(/\{solidario\}/g, solidario)
    .replace(/\{comprador_2\}/g, ctx.comprador_nome_2 || "")
    .replace(/\{cpf_comprador_2\}/g, ctx.cpf_comprador_2 ? formatDocument(ctx.cpf_comprador_2) : "")
    .replace(/\{quadra\}/g, ctx.quadra)
    .replace(/\{lote\}/g, ctx.lote)
    .replace(/\{area\}/g, ctx.area_m2 != null ? String(ctx.area_m2) : "—")
    .replace(/\{matricula\}/g, ctx.matricula_ri || "—")
    .replace(/\{data_venda\}/g, ctx.data_venda ? format(new Date(ctx.data_venda + "T00:00:00"), "dd/MM/yyyy") : "—")
    .replace(/\{valor_venda\}/g, ctx.valor_venda != null ? formatCurrency(ctx.valor_venda) : "—")
    .replace(/\{valor_arras\}/g, ctx.valor_arras != null ? formatCurrency(ctx.valor_arras) : "—")
    .replace(/\{valor_reforco\}/g, ctx.valor_reforco != null ? formatCurrency(ctx.valor_reforco) : "—")
    .replace(/\{qtd_reforcos\}/g, ctx.qtd_reforcos != null ? String(ctx.qtd_reforcos) : "—")
    .replace(/\{valor_parcelamento\}/g, ctx.valor_parcelamento != null ? formatCurrency(ctx.valor_parcelamento) : "—")
    .replace(/\{qtd_parcelas\}/g, ctx.qtd_parcelas != null ? String(ctx.qtd_parcelas) : "—")
    .replace(/\{valor\}/g, formatCurrency(ctx.valor))
    .replace(/\{parcela\}/g, ctx.parcela != null ? String(ctx.parcela) : "—");
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
      return data as { id: string; codigo: string; descricao: string }[];
    },
  });

  const { data: mapa } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*, conta_debito:contas_contabeis!mapa_movimento_conta_conta_debito_id_fkey(id, codigo, descricao), conta_credito:contas_contabeis!mapa_movimento_conta_conta_credito_id_fkey(id, codigo, descricao)");
      if (error) throw error;
      return data as unknown as MapaEntry[];
    },
  });

  const startDate = `${ano}-${mes.padStart(2, "0")}-01`;
  const endDate = `${ano}-${mes.padStart(2, "0")}-31`;

  const { data: movimentos, isLoading } = useQuery({
    queryKey: ["slip-contabil-movimentos", ano, mes],
    queryFn: async () => {
      const pageSize = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("conta_corrente_lote")
          .select(`
            data_mov, tipo_mov, debito, credito, venda_id, numero_parcela,
            lote:lotes(quadra, numero_lote, custo_contabil, area_m2, matricula_ri),
            venda:vendas(valor_venda, comprador_nome_1, comprador_cpf_1, comprador_nome_2, comprador_cpf_2, data_venda, valor_arras, valor_reforco, qtd_reforcos, valor_parcelamento, qtd_parcelas)
          `)
          .gte("data_mov", startDate)
          .lte("data_mov", endDate)
          .order("data_mov")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < pageSize) hasMore = false;
        else from += pageSize;
      }
      return allData;
    },
  });

  const slipRows = useMemo(() => {
    if (!movimentos || !mapa) return [];

    // Separate parent and child mappings
    const parentMappings = mapa.filter((m) => !m.lancamento_pai_id);
    const childMappings = mapa.filter((m) => !!m.lancamento_pai_id);

    const rows: SlipRow[] = [];

    for (const mov of movimentos) {
      const mappings = parentMappings.filter((m) => m.tipo_movimento === mov.tipo_mov);
      if (!mappings.length) continue;

      const valor = Number(mov.debito || 0) + Number(mov.credito || 0);
      const lote = mov.lote as any;
      const venda = mov.venda as any;

      const ctx = {
        comprador: venda?.comprador_nome_1 || null,
        quadra: lote?.quadra || "-",
        lote: lote?.numero_lote || "-",
        data_venda: venda?.data_venda || null,
        valor_venda: mov.tipo_mov === "VENDA" ? venda?.valor_venda : null,
        valor,
        parcela: mov.numero_parcela || null,
      };

      for (const mapping of mappings) {
        rows.push({
          data_mov: mov.data_mov,
          tipo_mov: mov.tipo_mov,
          quadra: ctx.quadra,
          numero_lote: ctx.lote,
          comprador_nome: ctx.comprador,
          valor_venda: ctx.valor_venda,
          custo_contabil: mov.tipo_mov === "VENDA" ? lote?.custo_contabil : null,
          debito_valor: mov.debito,
          credito_valor: mov.credito,
          conta_debito_codigo: mapping.conta_debito?.codigo || "",
          conta_debito_descricao: mapping.conta_debito?.descricao || "",
          conta_credito_codigo: mapping.conta_credito?.codigo || "",
          conta_credito_descricao: mapping.conta_credito?.descricao || "",
          historico: resolveHistorico(mapping.historico_padrao, ctx),
          valor,
          is_second: false,
          data_venda: ctx.data_venda,
          parcela: ctx.parcela,
        });

        // Check for linked second entry
        const child = childMappings.find((c) => c.lancamento_pai_id === mapping.id);
        if (child) {
          rows.push({
            data_mov: mov.data_mov,
            tipo_mov: mov.tipo_mov,
            quadra: ctx.quadra,
            numero_lote: ctx.lote,
            comprador_nome: ctx.comprador,
            valor_venda: ctx.valor_venda,
            custo_contabil: mov.tipo_mov === "VENDA" ? lote?.custo_contabil : null,
            debito_valor: mov.debito,
            credito_valor: mov.credito,
            conta_debito_codigo: child.conta_debito?.codigo || "",
            conta_debito_descricao: child.conta_debito?.descricao || "",
            conta_credito_codigo: child.conta_credito?.codigo || "",
            conta_credito_descricao: child.conta_credito?.descricao || "",
            historico: resolveHistorico(child.historico_padrao, ctx),
            valor,
            is_second: true,
            data_venda: ctx.data_venda,
            parcela: ctx.parcela,
          });
        }
      }
    }

    return rows;
  }, [movimentos, mapa]);

  const filteredRows = useMemo(() => {
    if (contaFiltro === "ALL") return slipRows;
    return slipRows.filter(
      (r) => r.conta_debito_codigo === contaFiltro || r.conta_credito_codigo === contaFiltro
    );
  }, [slipRows, contaFiltro]);

  const totalValor = useMemo(() => {
    // Sum only non-second entries to avoid double counting
    return filteredRows.filter((r) => !r.is_second).reduce((s, r) => s + r.valor, 0);
  }, [filteredRows]);

  const mesLabel = MESES_LABEL.find((m) => m.value === mes)?.label || "";

  const contaLabel = (codigo: string, descricao: string) => {
    if (!codigo) return "—";
    return `${codigo} – ${descricao}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`SLIP CONTÁBIL – ${mesLabel.toUpperCase()}/${ano}`, 14, 15);
    doc.setFontSize(10);
    let startY = 22;
    if (contaFiltro !== "ALL") {
      const contaSel = contas?.find((c) => c.codigo === contaFiltro);
      doc.text(`Conta: ${contaFiltro}${contaSel ? ` – ${contaSel.descricao}` : ""}`, 14, 22);
      startY = 28;
    }

    const headers = ["Data", "Débito", "Crédito", "Quadra/Lote", "Valor R$", "Histórico"];

    const body = filteredRows.map((r) => [
      format(new Date(r.data_mov + "T00:00:00"), "dd/MM"),
      contaLabel(r.conta_debito_codigo, r.conta_debito_descricao),
      contaLabel(r.conta_credito_codigo, r.conta_credito_descricao),
      `${r.quadra}-${r.numero_lote}`,
      formatCurrency(r.valor),
      r.historico || "-",
    ]);

    const footerRow = ["TOTAL", "", "", "", formatCurrency(totalValor), ""];

    autoTable(doc, {
      head: [headers],
      body: [...body, footerRow],
      startY,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 87, 55] },
      columnStyles: {
        5: { cellWidth: 60 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
        // Highlight second entries
        if (data.row.index < body.length && filteredRows[data.row.index]?.is_second) {
          data.cell.styles.textColor = [100, 100, 100];
          data.cell.styles.fontStyle = "italic";
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
          <p className="text-muted-foreground">Partidas Dobradas — Detalhamento contábil dos movimentos por período</p>
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
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5" />
            Slip Contábil – {mesLabel}/{ano}
            {contaFiltro !== "ALL" && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Conta: {contaFiltro} – {contas?.find((c) => c.codigo === contaFiltro)?.descricao || ""}
              </span>
            )}
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
                    <TableHead>Débito</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Quadra/Lote</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                    <TableHead>Histórico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, idx) => (
                    <TableRow key={idx} className={row.is_second ? "bg-muted/30" : ""}>
                      <TableCell>
                        {format(new Date(row.data_mov + "T00:00:00"), "dd/MM/yyyy")}
                        {row.is_second && <span className="text-xs text-muted-foreground ml-1">(2º)</span>}
                      </TableCell>
                      <TableCell>
                        {row.conta_debito_codigo ? (
                          <>
                            <span className="font-mono text-xs">{row.conta_debito_codigo}</span>
                            <span className="ml-1 text-muted-foreground text-xs">– {row.conta_debito_descricao}</span>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {row.conta_credito_codigo ? (
                          <>
                            <span className="font-mono text-xs">{row.conta_credito_codigo}</span>
                            <span className="ml-1 text-muted-foreground text-xs">– {row.conta_credito_descricao}</span>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{row.quadra}-{row.numero_lote}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(row.valor)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {row.historico || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatCurrency(totalValor)}
                    </TableCell>
                    <TableCell />
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
