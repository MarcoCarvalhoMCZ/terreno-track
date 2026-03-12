import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatCurrency, formatDocument } from "@/lib/formatters";
import { tiposMovimentoTodos, getTipoMovimentoLabel } from "@/constants/movimento";
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
  expressao_valor: string | null;
  conta_debito: { id: string; codigo: string; descricao: string; codigo_estruturado: string | null } | null;
  conta_credito: { id: string; codigo: string; descricao: string; codigo_estruturado: string | null } | null;
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
  conta_debito_estruturado: string;
  conta_debito_descricao: string;
  conta_credito_codigo: string;
  conta_credito_estruturado: string;
  conta_credito_descricao: string;
  historico: string;
  valor: number;
  is_second: boolean;
  data_venda: string | null;
  parcela: number | null;
  has_historico: boolean;
}

interface ListingGroup {
  conta_debito_codigo: string;
  conta_debito_estruturado: string;
  conta_credito_codigo: string;
  conta_credito_estruturado: string;
  tipo_mov: string;
  rows: ListingRow[];
}

interface ListingRow {
  quadra: string;
  numero_lote: string;
  comprador_nome: string | null;
  valor: number;
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
  custo_contabil: number | null;
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

  // Helper: replace both {var} and [var] syntax
  const r = (text: string, key: string, value: string) =>
    text.replace(new RegExp(`[{\\[]${key}[}\\]]`, "gi"), value);

  let result = template;
  result = r(result, "ql", `${ctx.quadra}-${ctx.lote}`);
  result = r(result, "comprador", ctx.comprador || "—");
  result = r(result, "cpf_comprador", formatDocument(ctx.cpf_comprador));
  result = r(result, "solidario", solidario);
  result = r(result, "comprador_2", ctx.comprador_nome_2 || "");
  result = r(result, "cpf_comprador_2", ctx.cpf_comprador_2 ? formatDocument(ctx.cpf_comprador_2) : "");
  result = r(result, "quadra", ctx.quadra);
  result = r(result, "lote", ctx.lote);
  result = r(result, "area", ctx.area_m2 != null ? String(ctx.area_m2) : "—");
  result = r(result, "matricula", ctx.matricula_ri || "—");
  result = r(result, "data_venda", ctx.data_venda ? format(new Date(ctx.data_venda + "T00:00:00"), "dd/MM/yyyy") : "—");
  result = r(result, "valor_venda", ctx.valor_venda != null ? formatCurrency(ctx.valor_venda) : "—");
  result = r(result, "valor_arras", ctx.valor_arras != null ? formatCurrency(ctx.valor_arras) : "—");
  result = r(result, "valor_reforco", ctx.valor_reforco != null ? formatCurrency(ctx.valor_reforco) : "—");
  result = r(result, "qtd_reforcos", ctx.qtd_reforcos != null ? String(ctx.qtd_reforcos) : "—");
  result = r(result, "valor_parcelamento", ctx.valor_parcelamento != null ? formatCurrency(ctx.valor_parcelamento) : "—");
  result = r(result, "qtd_parcelas", ctx.qtd_parcelas != null ? String(ctx.qtd_parcelas) : "—");
  result = r(result, "valor", formatCurrency(ctx.valor));
  result = r(result, "parcela", ctx.parcela != null ? String(ctx.parcela) : "—");
  result = r(result, "custo_contabil", ctx.custo_contabil != null ? formatCurrency(ctx.custo_contabil) : "—");
  result = r(result, "valor_atualizacao", formatCurrency(ctx.valor));
  result = r(result, "valor_juros", formatCurrency(ctx.valor));
  result = r(result, "valor_multa", formatCurrency(ctx.valor));
  return result;
}

function resolveExpressaoValor(
  expressao: string | null,
  mov: any,
  lote: any,
  venda: any
): number | null {
  if (!expressao) return null;

  const parts = expressao.split("+").map(s => s.trim());
  let total = 0;

  for (const part of parts) {
    switch (part) {
      case "valor":
        total += Number(mov.debito || 0) + Number(mov.credito || 0);
        break;
      case "valor_venda":
        total += Number(venda?.valor_venda || 0);
        break;
      case "valor_arras":
        total += Number(venda?.valor_arras || 0);
        break;
      case "valor_parcelamento":
        total += Number(venda?.valor_parcelamento || 0);
        break;
      case "valor_reforco":
        total += Number(venda?.valor_reforco || 0);
        break;
      case "custo_contabil":
        total += Number(lote?.custo_contabil || 0);
        break;
      case "valor_atualizacao":
        total += Number(mov.debito || 0) + Number(mov.credito || 0);
        break;
      case "valor_juros":
        total += Number(mov.debito || 0);
        break;
      case "valor_multa":
        total += Number(mov.debito || 0);
        break;
      default:
        total += Number(mov.debito || 0) + Number(mov.credito || 0);
    }
  }

  return total;
}

function formatContaSlip(codigo: string, estruturado: string): string {
  if (!codigo) return "—";
  if (estruturado) return `${codigo} / ${estruturado}`;
  return codigo;
}

function normalizeMovimentosParaSlip(movimentos: any[]) {
  const movimentosConsolidados: any[] = [];
  const vendaInicialPorChave = new Map<string, any>();

  for (const mov of movimentos) {
    const debito = Number(mov.debito || 0);
    const credito = Number(mov.credito || 0);
    const isVendaInicial = mov.tipo_mov === "VENDA" && !!mov.venda_id && debito > 0 && credito === 0;

    if (!isVendaInicial) {
      movimentosConsolidados.push(mov);
      continue;
    }

    const key = `${mov.venda_id}-${mov.data_mov}`;
    const valorVenda = Number(mov.venda?.valor_venda ?? debito);
    const existente = vendaInicialPorChave.get(key);

    if (!existente) {
      const consolidado = { ...mov, debito: valorVenda, credito: 0 };
      vendaInicialPorChave.set(key, consolidado);
      movimentosConsolidados.push(consolidado);
      continue;
    }

    existente.debito = valorVenda;
    existente.credito = 0;
  }

  return movimentosConsolidados;
}

function resolveCompradores(venda: any) {
  const compradorPrincipal =
    venda?.comprador_nome_1 ||
    venda?.comprador?.nome_razao ||
    venda?.comprador_nome_2 ||
    null;

  const cpfPrincipal =
    venda?.comprador_cpf_1 ||
    venda?.comprador?.cpf_cnpj ||
    venda?.comprador_cpf_2 ||
    null;

  const compradorSecundarioOriginal = venda?.comprador_nome_2 || null;
  const cpfSecundarioOriginal = venda?.comprador_cpf_2 || null;

  const compradorSecundario =
    compradorSecundarioOriginal && compradorSecundarioOriginal !== compradorPrincipal
      ? compradorSecundarioOriginal
      : null;

  return {
    comprador: compradorPrincipal,
    cpfComprador: cpfPrincipal,
    comprador2: compradorSecundario,
    cpfComprador2: compradorSecundario ? cpfSecundarioOriginal : null,
  };
}

export default function SlipContabil() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [tipoMovFiltro, setTipoMovFiltro] = useState<string>("ALL");

  const { data: mapa } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*, conta_debito:contas_contabeis!mapa_movimento_conta_conta_debito_id_fkey(id, codigo, descricao, codigo_estruturado), conta_credito:contas_contabeis!mapa_movimento_conta_conta_credito_id_fkey(id, codigo, descricao, codigo_estruturado)");
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
            data_mov, tipo_mov, debito, credito, venda_id, numero_parcela, lote_id,
            lote:lotes(quadra, numero_lote, custo_contabil, area_m2, matricula_ri),
            venda:vendas(valor_venda, comprador_nome_1, comprador_cpf_1, comprador_nome_2, comprador_cpf_2, data_venda, valor_arras, valor_reforco, qtd_reforcos, valor_parcelamento, qtd_parcelas, comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj))
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

    const parentMappings = mapa.filter((m) => !m.lancamento_pai_id);
    const childMappings = mapa.filter((m) => !!m.lancamento_pai_id);
    const movimentosNormalizados = normalizeMovimentosParaSlip(movimentos);

    // Build lote_id -> venda lookup for movements without direct venda
    const vendaPorLote = new Map<string, any>();
    for (const mov of movimentos) {
      if (mov.venda && mov.lote_id && !vendaPorLote.has(mov.lote_id)) {
        vendaPorLote.set(mov.lote_id, mov.venda);
      }
    }

    const rows: SlipRow[] = [];

    for (const mov of movimentosNormalizados) {
      const mappings = parentMappings.filter((m) => m.tipo_movimento === mov.tipo_mov);
      if (!mappings.length) continue;

      const valor = Number(mov.debito || 0) + Number(mov.credito || 0);
      const lote = mov.lote as any;
      const venda = (mov.venda || vendaPorLote.get(mov.lote_id)) as any;
      const compradores = resolveCompradores(venda);

      const ctx: HistoricoCtx = {
        comprador: compradores.comprador,
        cpf_comprador: compradores.cpfComprador,
        comprador_nome_2: compradores.comprador2,
        cpf_comprador_2: compradores.cpfComprador2,
        quadra: lote?.quadra || "-",
        lote: lote?.numero_lote || "-",
        area_m2: lote?.area_m2 ?? null,
        matricula_ri: lote?.matricula_ri || null,
        custo_contabil: lote?.custo_contabil ?? null,
        data_venda: venda?.data_venda || null,
        valor_venda: venda?.valor_venda ?? null,
        valor_arras: venda?.valor_arras ?? null,
        valor_reforco: venda?.valor_reforco ?? null,
        qtd_reforcos: venda?.qtd_reforcos ?? null,
        valor_parcelamento: venda?.valor_parcelamento ?? null,
        qtd_parcelas: venda?.qtd_parcelas ?? null,
        valor,
        parcela: mov.numero_parcela || null,
      };

      for (const mapping of mappings) {
        const valorResolv = resolveExpressaoValor(mapping.expressao_valor, mov, lote, venda) ?? valor;
        const ctxComValor = { ...ctx, valor: valorResolv };

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
          conta_debito_estruturado: mapping.conta_debito?.codigo_estruturado || "",
          conta_debito_descricao: mapping.conta_debito?.descricao || "",
          conta_credito_codigo: mapping.conta_credito?.codigo || "",
          conta_credito_estruturado: mapping.conta_credito?.codigo_estruturado || "",
          conta_credito_descricao: mapping.conta_credito?.descricao || "",
          historico: resolveHistorico(mapping.historico_padrao, ctxComValor),
          valor: valorResolv,
          is_second: false,
          data_venda: ctx.data_venda,
          parcela: ctx.parcela,
          has_historico: !!mapping.historico_padrao,
        });

        const child = childMappings.find((c) => c.lancamento_pai_id === mapping.id);
        if (child) {
          const valorChild = resolveExpressaoValor(child.expressao_valor, mov, lote, venda) ?? valor;
          const ctxChild = { ...ctx, valor: valorChild };

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
            conta_debito_estruturado: child.conta_debito?.codigo_estruturado || "",
            conta_debito_descricao: child.conta_debito?.descricao || "",
            conta_credito_codigo: child.conta_credito?.codigo || "",
            conta_credito_estruturado: child.conta_credito?.codigo_estruturado || "",
            conta_credito_descricao: child.conta_credito?.descricao || "",
          historico: resolveHistorico(child.historico_padrao, ctxChild),
            valor: valorChild,
            is_second: true,
            data_venda: ctx.data_venda,
            parcela: ctx.parcela,
            has_historico: !!child.historico_padrao,
          });
        }
      }
    }

    // Sort all rows by quadra + lote
    rows.sort((a, b) => {
      const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
      if (cmp !== 0) return cmp;
      return a.numero_lote.localeCompare(b.numero_lote, "pt-BR", { numeric: true });
    });

    return rows;
  }, [movimentos, mapa]);

  const filteredRows = useMemo(() => {
    if (tipoMovFiltro === "ALL") return slipRows;
    return slipRows.filter((r) => r.tipo_mov === tipoMovFiltro);
  }, [slipRows, tipoMovFiltro]);

  // Split into rows with historico (detailed) and without (listing)
  const rowsWithHistorico = useMemo(() => filteredRows.filter((r) => r.has_historico), [filteredRows]);
  const rowsWithoutHistorico = useMemo(() => filteredRows.filter((r) => !r.has_historico && !r.is_second), [filteredRows]);

  // Group rows without historico by account pair + tipo_mov
  const listingGroups = useMemo((): ListingGroup[] => {
    if (!rowsWithoutHistorico.length) return [];
    const groupMap = new Map<string, ListingGroup>();
    for (const row of rowsWithoutHistorico) {
      const key = `${row.conta_debito_codigo}|${row.conta_credito_codigo}|${row.tipo_mov}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          conta_debito_codigo: row.conta_debito_codigo,
          conta_debito_estruturado: row.conta_debito_estruturado,
          conta_credito_codigo: row.conta_credito_codigo,
          conta_credito_estruturado: row.conta_credito_estruturado,
          tipo_mov: row.tipo_mov,
          rows: [],
        });
      }
      const firstName = row.comprador_nome?.split(" ")[0] || "—";
      groupMap.get(key)!.rows.push({
        quadra: row.quadra,
        numero_lote: row.numero_lote,
        comprador_nome: firstName,
        valor: row.valor,
      });
    }
    // Sort rows within each group by quadra + lote
    const sortFn = (a: ListingRow, b: ListingRow) => {
      const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
      if (cmp !== 0) return cmp;
      return a.numero_lote.localeCompare(b.numero_lote, "pt-BR", { numeric: true });
    };
    const groups = Array.from(groupMap.values());
    for (const g of groups) g.rows.sort(sortFn);
    return groups;
  }, [rowsWithoutHistorico]);

  const totalValor = useMemo(() => {
    return filteredRows.filter((r) => !r.is_second).reduce((s, r) => s + r.valor, 0);
  }, [filteredRows]);

  const mesLabel = MESES_LABEL.find((m) => m.value === mes)?.label || "";
  const tipoMovLabel = tipoMovFiltro !== "ALL" ? getTipoMovimentoLabel(tipoMovFiltro) : "";

  // Get unique tipo_mov values present in data for the filter
  const tiposPresentes = useMemo(() => {
    if (!slipRows.length) return [];
    const unique = [...new Set(slipRows.map((r) => r.tipo_mov))];
    return tiposMovimentoTodos.filter((t) => unique.includes(t.value));
  }, [slipRows]);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`SLIP CONTÁBIL – ${mesLabel.toUpperCase()}/${ano}`, 14, 15);
    doc.setFontSize(10);
    let startY = 22;
    if (tipoMovFiltro !== "ALL") {
      doc.text(`Tipo: ${tipoMovLabel}`, 14, 22);
      startY = 28;
    }

    // Detailed rows (with historico)
    if (rowsWithHistorico.length > 0) {
      const headers = ["Data", "Débito", "Crédito", "Valor R$", "Histórico"];
      const body = rowsWithHistorico.map((r) => [
        format(new Date(r.data_mov + "T00:00:00"), "dd/MM/yyyy"),
        formatContaSlip(r.conta_debito_codigo, r.conta_debito_estruturado),
        formatContaSlip(r.conta_credito_codigo, r.conta_credito_estruturado),
        formatCurrency(r.valor),
        r.historico || "-",
      ]);

      autoTable(doc, {
        head: [headers],
        body,
        startY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 87, 55] },
        columnStyles: { 4: { cellWidth: 80 } },
        didParseCell: (data: any) => {
          if (data.row.index < body.length && rowsWithHistorico[data.row.index]?.is_second) {
            data.cell.styles.textColor = [100, 100, 100];
            data.cell.styles.fontStyle = "italic";
          }
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Listing groups (without historico)
    for (const group of listingGroups) {
      const groupTotal = group.rows.reduce((s, r) => s + r.valor, 0);
      doc.setFontSize(9);
      doc.text(`${getTipoMovimentoLabel(group.tipo_mov)}`, 14, startY);
      startY += 4;
      doc.text(`Débito: ${formatContaSlip(group.conta_debito_codigo, group.conta_debito_estruturado)}`, 14, startY);
      startY += 4;
      doc.text(`Crédito: ${formatContaSlip(group.conta_credito_codigo, group.conta_credito_estruturado)}`, 14, startY);
      startY += 2;

      const listHeaders = ["Lote", "Comprador", "Valor R$"];
      const listBody = group.rows.map((lr) => [
        `${lr.quadra}-${lr.numero_lote}`,
        lr.comprador_nome || "—",
        formatCurrency(lr.valor),
      ]);
      const listFooter = ["TOTAL", "", formatCurrency(groupTotal)];

      autoTable(doc, {
        head: [listHeaders],
        body: [...listBody, listFooter],
        startY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 87, 55] },
        didParseCell: (data: any) => {
          if (data.row.index === listBody.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Total geral
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: ${formatCurrency(totalValor)}`, 14, startY);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>Tipo de Movimento</Label>
              <Select value={tipoMovFiltro} onValueChange={setTipoMovFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os tipos</SelectItem>
                  {tiposPresentes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slip entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5" />
            Slip Contábil – {mesLabel}/{ano}
            {tipoMovFiltro !== "ALL" && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Tipo: {tipoMovLabel}
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
            <div className="space-y-0">
              {/* Rows WITH historico - detailed view */}
              {rowsWithHistorico.map((row, idx) => (
                <div key={`h-${idx}`}>
                  <div className={`py-3 px-4 space-y-1 ${row.is_second ? "bg-muted/30 pl-8" : ""}`}>
                    {row.is_second && (
                      <span className="text-xs text-muted-foreground font-medium">↳ 2º lançamento vinculado</span>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-x-4 gap-y-1">
                      <div>
                        <span className="text-xs text-muted-foreground">Data</span>
                        <p className="font-medium text-sm">
                          {format(new Date(row.data_mov + "T00:00:00"), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-xs text-muted-foreground">Débito: </span>
                          <span className="font-mono text-sm">
                            {formatContaSlip(row.conta_debito_codigo, row.conta_debito_estruturado)}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Crédito: </span>
                          <span className="font-mono text-sm">
                            {formatContaSlip(row.conta_credito_codigo, row.conta_credito_estruturado)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">Valor R$</span>
                        <p className="font-mono font-bold text-sm text-primary">
                          {formatCurrency(row.valor)}
                        </p>
                      </div>
                    </div>
                    {row.historico && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">Histórico: </span>
                        <span className="text-sm">{row.historico}</span>
                      </div>
                    )}
                  </div>
                  {idx < rowsWithHistorico.length - 1 && <Separator />}
                </div>
              ))}

              {/* Rows WITHOUT historico - grouped table listing */}
              {listingGroups.map((group, gIdx) => {
                const groupTotal = group.rows.reduce((s, r) => s + r.valor, 0);
                return (
                  <div key={`g-${gIdx}`} className="mt-4">
                    <Separator />
                    <div className="py-3 px-4 bg-muted/40 space-y-1">
                      <p className="font-semibold text-sm">{getTipoMovimentoLabel(group.tipo_mov)}</p>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Débito: </span>
                        <span className="font-mono">{formatContaSlip(group.conta_debito_codigo, group.conta_debito_estruturado)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Crédito: </span>
                        <span className="font-mono">{formatContaSlip(group.conta_credito_codigo, group.conta_credito_estruturado)}</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left py-2 px-4 font-medium">Lote</th>
                          <th className="text-left py-2 px-4 font-medium">Comprador</th>
                          <th className="text-right py-2 px-4 font-medium">Valor R$</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((lr, lIdx) => (
                          <tr key={lIdx} className="border-b last:border-b-0">
                            <td className="py-1.5 px-4 font-mono">{lr.quadra}-{lr.numero_lote}</td>
                            <td className="py-1.5 px-4">{lr.comprador_nome}</td>
                            <td className="py-1.5 px-4 text-right font-mono">{formatCurrency(lr.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 font-bold">
                          <td className="py-2 px-4" colSpan={2}>TOTAL</td>
                          <td className="py-2 px-4 text-right font-mono text-primary">{formatCurrency(groupTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}

              <Separator className="mt-4" />
              <div className="py-3 px-4 flex justify-between items-center bg-muted/20">
                <span className="font-bold">TOTAL GERAL</span>
                <span className="font-mono font-bold text-primary text-lg">
                  {formatCurrency(totalValor)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}