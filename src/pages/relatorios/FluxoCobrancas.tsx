import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lastDayOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileDown, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TipoDataRef = "ultima_atualizacao" | "hoje";

interface ParcelaAbertaRow {
  id: string;
  lote_id: string;
  quadra: string;
  numero_lote: string;
  tipo_fluxo: string;
  numero_parcela: number;
  total_parcelas: number;
  vencimento: string;
  valor_parcela: number;
  valor_juros: number | null;
  valor_multa: number | null;
  total_devido: number;
  status: string;
  venda_id: string | null;
}

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = String(dateStr).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function FluxoCobrancas() {
  const [tipoDataRef, setTipoDataRef] = useState<TipoDataRef>("ultima_atualizacao");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: resultado, isLoading, refetch } = useQuery({
    queryKey: ["fluxo-cobrancas", tipoDataRef],
    queryFn: async () => {
      let dataRef: Date;

      if (tipoDataRef === "hoje") {
        const now = new Date();
        dataRef = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
      } else {
        const { data: lastUpdate } = await supabase
          .from("conta_corrente_lote")
          .select("data_mov")
          .eq("tipo_mov", "ATUALIZACAO")
          .order("data_mov", { ascending: false })
          .limit(1)
          .single();

        const lastDate = lastUpdate?.data_mov
          ? parseDateOnly(lastUpdate.data_mov)
          : new Date();
        dataRef = lastDayOfMonth(lastDate);
      }

      const dataRefStr = formatDateOnly(dataRef);

      const { data: parcelas, error } = await supabase
        .from("parcelas_abertas")
        .select("*")
        .eq("status", "ABERTO")
        .order("vencimento", { ascending: true });

      if (error) throw error;
      if (!parcelas || parcelas.length === 0) return { parcelas: [] as ParcelaAbertaRow[], dataRef: dataRefStr };

      // Filter: only items with vencimento <= dataRef (or < for "hoje")
      const filtered = parcelas.filter((p) => {
        const venc = String(p.vencimento).slice(0, 10);
        return tipoDataRef === "hoje" ? venc < dataRefStr : venc <= dataRefStr;
      });

      return { parcelas: filtered as ParcelaAbertaRow[], dataRef: dataRefStr };
    },
    enabled: false,
  });

  const parcelasFiltradas = useMemo(() => {
    if (!resultado?.parcelas) return [];
    if (!searchTerm) return resultado.parcelas;
    const term = searchTerm.toLowerCase();
    return resultado.parcelas.filter((p) =>
      p.quadra.toLowerCase().includes(term) ||
      p.numero_lote.toLowerCase().includes(term) ||
      `${p.quadra}-${p.numero_lote}`.toLowerCase().includes(term)
    );
  }, [resultado, searchTerm]);

  const totais = useMemo(() => {
    const list = parcelasFiltradas;
    return {
      count: list.length,
      valorParcela: list.reduce((s, p) => s + (p.valor_parcela || 0), 0),
      juros: list.reduce((s, p) => s + (p.valor_juros || 0), 0),
      multa: list.reduce((s, p) => s + (p.valor_multa || 0), 0),
      totalDevido: list.reduce((s, p) => s + (p.total_devido || 0), 0),
    };
  }, [parcelasFiltradas]);

  const dataRefFormatted = resultado?.dataRef
    ? parseDateOnly(resultado.dataRef).toLocaleDateString("pt-BR")
    : "";

  function exportarPDF() {
    if (!parcelasFiltradas.length) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Fluxo de Cobranças", 14, 15);
    doc.setFontSize(8);
    doc.text(`Data ref.: ${dataRefFormatted}  |  Total: ${formatCurrency(totais.totalDevido)}  |  ${parcelasFiltradas.length} itens  |  Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);

    const head = ["Lote", "Tipo", "Parcela", "Vencimento", "Valor", "Juros", "Multa", "Total Devido"];

    const body = parcelasFiltradas.map((p) => [
      `${p.quadra}-${p.numero_lote}`,
      p.tipo_fluxo === "PARCELAMENTO" ? "Parcela" : "Reforço",
      `${p.numero_parcela}/${p.total_parcelas}`,
      parseDateOnly(p.vencimento).toLocaleDateString("pt-BR"),
      formatCurrency(p.valor_parcela),
      formatCurrency(p.valor_juros || 0),
      formatCurrency(p.valor_multa || 0),
      formatCurrency(p.total_devido),
    ]);

    const foot = [
      "TOTAIS", "", `${parcelasFiltradas.length} itens`, "",
      formatCurrency(totais.valorParcela),
      formatCurrency(totais.juros),
      formatCurrency(totais.multa),
      formatCurrency(totais.totalDevido),
    ];

    autoTable(doc, {
      startY: 25,
      head: [head],
      body,
      foot: [foot],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    doc.save("fluxo_cobrancas.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fluxo de Cobranças</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Data de referência</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={tipoDataRef}
                onChange={(e) => setTipoDataRef(e.target.value as TipoDataRef)}
              >
                <option value="ultima_atualizacao">Última atualização monetária</option>
                <option value="hoje">Data de hoje</option>
              </select>
            </div>
            <Button onClick={() => void refetch()}>
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
            {resultado && resultado.parcelas.length > 0 && (
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

      {resultado && resultado.parcelas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma cobrança pendente encontrada.
        </div>
      )}

      {resultado && resultado.parcelas.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Itens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totais.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Principal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totais.valorParcela)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Encargos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{formatCurrency(totais.juros + totais.multa)}</div>
              </CardContent>
            </Card>
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Total Devido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(totais.totalDevido)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por quadra ou lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button variant="ghost" onClick={() => setSearchTerm("")}>
                Limpar
              </Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Juros</TableHead>
                      <TableHead className="text-right">Multa</TableHead>
                      <TableHead className="text-right">Total Devido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasFiltradas.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {p.quadra}-{p.numero_lote}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.tipo_fluxo === "PARCELAMENTO" ? "default" : "secondary"}>
                            {p.tipo_fluxo === "PARCELAMENTO" ? "Parcela" : "Reforço"}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.numero_parcela}/{p.total_parcelas}</TableCell>
                        <TableCell>{parseDateOnly(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(p.valor_parcela)}</TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          {(p.valor_juros || 0) > 0 ? formatCurrency(p.valor_juros!) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          {(p.valor_multa || 0) > 0 ? formatCurrency(p.valor_multa!) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(p.total_devido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="border-t-2 bg-muted/50 font-bold">
                      <TableCell colSpan={4}>TOTAIS ({totais.count} itens)</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totais.valorParcela)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{formatCurrency(totais.juros)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{formatCurrency(totais.multa)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totais.totalDevido)}</TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
