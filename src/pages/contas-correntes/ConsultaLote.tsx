import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileDown, Search } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ConsultaLote() {
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");

  // Fetch lotes
  const { data: lotes } = useQuery({
    queryKey: ["lotes-consulta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("id, quadra, numero_lote, status")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data;
    },
  });

  // Fetch venda do lote selecionado
  const { data: venda } = useQuery({
    queryKey: ["venda-lote", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return null;
      const { data, error } = await supabase
        .from("vendas")
        .select(`
          *,
          vendedor:pessoas!vendas_vendedor_pessoa_id_fkey(nome_razao),
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)
        `)
        .eq("lote_id", selectedLoteId)
        .order("data_venda", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoteId,
  });

  // Fetch últimos 12 movimentos
  const { data: movimentos } = useQuery({
    queryKey: ["movimentos-lote", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoteId,
  });

  // Fetch resumo do lote
  const { data: resumo } = useQuery({
    queryKey: ["resumo-lote-consulta", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return null;
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("tipo_mov, debito, credito")
        .eq("lote_id", selectedLoteId);
      if (error) throw error;
      
      // Calculate totals
      const totalVenda = data
        .filter(m => ["VENDA", "ENTRADA_PARCELA", "PAGAMENTO_PARCELA", "SINAL", "REFORCO", "PARCELA"].includes(m.tipo_mov))
        .reduce((acc, m) => acc + (m.debito || 0), 0);
      
      const totalAtualizacoes = data
        .filter(m => m.tipo_mov === "ATUALIZACAO")
        .reduce((acc, m) => acc + (m.debito || 0), 0);
      
      return { totalVenda, totalAtualizacoes };
    },
    enabled: !!selectedLoteId,
  });

  const selectedLote = lotes?.find(l => l.id === selectedLoteId);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy");
  };

  const exportToPDF = () => {
    if (!selectedLote) return;

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Quadra ${selectedLote.quadra} - Lote ${selectedLote.numero_lote}`, 14, yPos);
    yPos += 15;

    // Seller and Buyer info
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Vendedor: ${venda?.vendedor?.nome_razao || "Não informado"}`, 14, yPos);
    yPos += 7;
    
    doc.text(`Comprador 1: ${venda?.comprador_nome_1 || venda?.comprador?.nome_razao || "Não informado"}`, 14, yPos);
    yPos += 6;
    doc.text(`CPF: ${venda?.comprador_cpf_1 || venda?.comprador?.cpf_cnpj || "Não informado"}`, 14, yPos);
    yPos += 7;
    
    if (venda?.comprador_nome_2) {
      doc.text(`Comprador 2: ${venda.comprador_nome_2}`, 14, yPos);
      yPos += 6;
      doc.text(`CPF: ${venda.comprador_cpf_2 || "Não informado"}`, 14, yPos);
      yPos += 7;
    }

    // Separator
    yPos += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    // Transactions table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Últimos 12 Movimentos", 14, yPos);
    yPos += 8;

    const tableData = movimentos?.map(m => [
      formatDate(m.data_mov),
      m.tipo_mov,
      m.descricao || "-",
      m.referencia || "-",
      formatDate(m.vencimento),
      formatCurrency(m.debito),
      formatCurrency(m.credito),
      formatCurrency(m.saldo),
    ]) || [];

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Tipo", "Descrição", "Referência", "Vencimento", "Débito", "Crédito", "Saldo"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Separator
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo das Operações do Lote", 14, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total da Venda (parcelamento/reforço): ${formatCurrency(resumo?.totalVenda || 0)}`, 14, yPos);
    yPos += 7;
    doc.text(`Total Atualizações Monetárias: ${formatCurrency(resumo?.totalAtualizacoes || 0)}`, 14, yPos);

    // Save
    doc.save(`consulta_lote_${selectedLote.quadra}_${selectedLote.numero_lote}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Consulta de Lote</h1>
          <p className="text-muted-foreground">Visualize informações consolidadas do lote</p>
        </div>
      </div>

      {/* Seletor de Lote */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Selecionar Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-md space-y-2">
              <Label>Lote</Label>
              <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes?.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      Quadra {lote.quadra} - Lote {lote.numero_lote} ({lote.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLoteId && (
              <Button onClick={exportToPDF} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informações do Lote */}
      {selectedLote && (
        <Card>
          <CardHeader>
            <CardTitle>Quadra {selectedLote.quadra} - Lote {selectedLote.numero_lote}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendedor */}
            <div>
              <span className="font-semibold">Vendedor:</span>{" "}
              <span>{venda?.vendedor?.nome_razao || "Não informado"}</span>
            </div>

            {/* Comprador 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold">Comprador 1:</span>{" "}
                <span>{venda?.comprador_nome_1 || venda?.comprador?.nome_razao || "Não informado"}</span>
              </div>
              <div>
                <span className="font-semibold">CPF:</span>{" "}
                <span>{venda?.comprador_cpf_1 || venda?.comprador?.cpf_cnpj || "Não informado"}</span>
              </div>
            </div>

            {/* Comprador 2 */}
            {venda?.comprador_nome_2 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">Comprador 2:</span>{" "}
                  <span>{venda.comprador_nome_2}</span>
                </div>
                <div>
                  <span className="font-semibold">CPF:</span>{" "}
                  <span>{venda.comprador_cpf_2 || "Não informado"}</span>
                </div>
              </div>
            )}

            <Separator />

            {/* Tabela de Movimentos */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Últimos 12 Movimentos</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentos?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum movimento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      movimentos?.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell>{formatDate(mov.data_mov)}</TableCell>
                          <TableCell>{mov.tipo_mov}</TableCell>
                          <TableCell>{mov.descricao || "-"}</TableCell>
                          <TableCell>{mov.referencia || "-"}</TableCell>
                          <TableCell>{formatDate(mov.vencimento)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mov.debito)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mov.credito)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mov.saldo)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Resumo */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Resumo das Operações do Lote</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Total da Venda (parcelamento/reforço)</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo?.totalVenda || 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Total Atualizações Monetárias</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo?.totalAtualizacoes || 0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
