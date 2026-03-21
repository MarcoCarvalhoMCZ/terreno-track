import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MESES = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

interface LoteSaldo {
  quadra: string;
  numero_lote: string;
  comprador_nome: string;
  saldoParcelamento: number;
  saldoReforco: number;
  saldoTotal: number;
}

export default function SaldoLotes() {
  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [consultar, setConsultar] = useState(false);

  const anosDisponiveis = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 10 }, (_, i) => String(current - i));
  }, []);

  // Data limite: último dia do mês selecionado
  const dataLimite = useMemo(() => {
    const m = parseInt(mes);
    const a = parseInt(ano);
    const lastDay = new Date(a, m, 0).getDate();
    return `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`;
  }, [mes, ano]);

  const { data: resultado, isLoading } = useQuery({
    queryKey: ["saldo-lotes", dataLimite],
    queryFn: async () => {
      // Buscar todos os lotes vendidos com comprador
      const { data: vendas, error: vendasErr } = await supabase
        .from("vendas")
        .select("lote_id, comprador_nome_1, comprador_pessoa_id, pessoas!vendas_comprador_pessoa_id_fkey(nome_razao), lotes!vendas_lote_id_fkey(quadra, numero_lote)")
        .in("status", ["ATIVA", "QUITADA"])
        .order("lote_id");

      if (vendasErr) throw vendasErr;

      // Filtrar apenas lotes com vendas ativas
      const loteIds = Array.from(new Set((vendas || []).map(v => v.lote_id)));
      if (loteIds.length === 0) return [];

      // Buscar movimentos até a data limite para calcular saldo (paginado)
      const pageSize = 1000;
      let allMovimentos: { lote_id: string; debito: number | null; credito: number | null }[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page, error: movErr } = await supabase
          .from("conta_corrente_lote")
          .select("lote_id, debito, credito")
          .in("lote_id", loteIds)
          .lte("data_mov", dataLimite)
          .range(from, from + pageSize - 1);
        if (movErr) throw movErr;
        allMovimentos = allMovimentos.concat(page || []);
        hasMore = (page?.length || 0) === pageSize;
        from += pageSize;
      }

      // Agrupar saldos por lote
      const saldoMap = new Map<string, number>();
      for (const mov of allMovimentos) {
        const prev = saldoMap.get(mov.lote_id) || 0;
        saldoMap.set(mov.lote_id, prev + (mov.debito || 0) - (mov.credito || 0));
      }

      // Montar resultado
      const items: LoteSaldo[] = [];
      for (const v of vendas || []) {
        const lote = v.lotes as any;
        if (!lote) continue;
        const saldo = saldoMap.get(v.lote_id) || 0;
        const nome = v.comprador_nome_1 || (v.pessoas as any)?.nome_razao || "-";
        const primeiroNome = nome.split(" ")[0];
        items.push({
          quadra: lote.quadra,
          numero_lote: lote.numero_lote,
          comprador_nome: primeiroNome,
          saldo,
        });
      }

      // Ordenar por quadra + lote
      items.sort((a, b) => {
        const cmp = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
        if (cmp !== 0) return cmp;
        return a.numero_lote.localeCompare(b.numero_lote, "pt-BR", { numeric: true });
      });

      return items;
    },
    enabled: consultar,
  });

  const totalGeral = useMemo(() => {
    if (!resultado) return 0;
    return resultado.reduce((sum, r) => sum + r.saldo, 0);
  }, [resultado]);

  const mesLabel = MESES.find(m => m.value === mes)?.label || mes;

  function exportarPDF() {
    if (!resultado || resultado.length === 0) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const titulo = `Saldo dos Lotes - ${mesLabel}/${ano}`;

    doc.setFontSize(14);
    doc.text(titulo, 14, 18);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [["Quadra", "Lote", "Comprador", "Saldo (R$)"]],
      body: resultado.map(r => [
        r.quadra,
        r.numero_lote,
        r.comprador_nome,
        formatCurrency(r.saldo),
      ]),
      foot: [["", "", "TOTAL GERAL", formatCurrency(totalGeral)]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: {
        3: { halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "foot" && data.column.index === 3) {
          data.cell.styles.halign = "right";
        }
      },
    });

    doc.save(`saldo_lotes_${mes}_${ano}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Saldo dos Lotes</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione o Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Mês</label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Ano</label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setConsultar(true)}>
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
            {resultado && resultado.length > 0 && (
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

      {resultado && resultado.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum lote com venda ativa encontrado.
        </div>
      )}

      {resultado && resultado.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Saldo dos Lotes — {mesLabel}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quadra</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead className="text-right">Saldo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.quadra}</TableCell>
                      <TableCell>{r.numero_lote}</TableCell>
                      <TableCell>{r.comprador_nome}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(r.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-right">TOTAL GERAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalGeral)}</TableCell>
                </TableRow>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
