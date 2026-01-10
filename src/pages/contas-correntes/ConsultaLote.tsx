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
import { format, addMonths } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ResumoLote {
  totalVenda: number;
  totalAtualizacoes: number;
  totalJurosMora: number;
  totalMultasMora: number;
  totalRecebido: number;
  saldoReceber: number;
  // Parcelas
  qtdParcelasContratadas: number;
  qtdParcelasPagas: number;
  qtdParcelasAPagar: number;
  // Reforços
  qtdReforcosContratados: number;
  qtdReforcosPagos: number;
  qtdReforcosAPagar: number;
  // Próxima parcela/reforço
  valorProximaParcela: number;
  vencimentoProximaParcela: Date | null;
  valorProximoReforco: number;
  vencimentoProximoReforco: Date | null;
  primeiroVencimentoParcela: Date | null;
  primeiroVencimentoReforco: Date | null;
}

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

  // Fetch resumo do lote com todas as informações
  const { data: resumo } = useQuery({
    queryKey: ["resumo-lote-consulta", selectedLoteId, venda?.id],
    queryFn: async (): Promise<ResumoLote | null> => {
      if (!selectedLoteId) return null;
      
      // Fetch all movements
      const { data: allMovimentos, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .order("data_mov", { ascending: true });
      if (error) throw error;
      
      // Calculate totals
      const totalVenda = allMovimentos
        .filter(m => ["VENDA", "ENTRADA_PARCELA", "SINAL", "REFORCO", "PARCELA"].includes(m.tipo_mov))
        .reduce((acc, m) => acc + (m.debito || 0), 0);
      
      const totalAtualizacoes = allMovimentos
        .filter(m => m.tipo_mov === "ATUALIZACAO")
        .reduce((acc, m) => acc + (m.debito || 0), 0);

      const totalJurosMora = allMovimentos
        .filter(m => m.tipo_mov === "JUROS_MORA")
        .reduce((acc, m) => acc + (m.debito || 0), 0);

      const totalMultasMora = allMovimentos
        .filter(m => m.tipo_mov === "MULTA_MORA")
        .reduce((acc, m) => acc + (m.debito || 0), 0);

      const totalRecebido = allMovimentos
        .reduce((acc, m) => acc + (m.credito || 0), 0);

      // Get the latest balance
      const ultimoMovimento = allMovimentos.length > 0 ? allMovimentos[allMovimentos.length - 1] : null;
      const saldoReceber = ultimoMovimento?.saldo || 0;

      // Helper to check if referencia contains Arras/Sinal
      const isArrasSinal = (referencia: string | null) => {
        if (!referencia) return false;
        const lower = referencia.toLowerCase();
        return lower.includes("arras") || lower.includes("sinal");
      };

      // Count PARCELAS paid (excluding Arras/Sinal)
      const parcelasPagas = allMovimentos.filter(m => 
        m.tipo_mov === "PARCELA" && 
        (m.credito || 0) > 0 &&
        !isArrasSinal(m.referencia)
      );
      const qtdParcelasPagas = parcelasPagas.length;

      // Count REFORCOS paid
      const reforcosPagos = allMovimentos.filter(m => 
        m.tipo_mov === "REFORCO" && 
        (m.credito || 0) > 0
      );
      const qtdReforcosPagos = reforcosPagos.length;

      // Contracted from venda
      const qtdParcelasContratadas = venda?.qtd_parcelas || 0;
      const qtdReforcosContratados = venda?.qtd_reforcos || 0;
      
      const qtdParcelasAPagar = Math.max(0, qtdParcelasContratadas - qtdParcelasPagas);
      const qtdReforcosAPagar = Math.max(0, qtdReforcosContratados - qtdReforcosPagos);

      // Calculate next installment value
      const totalAPagar = qtdParcelasAPagar + qtdReforcosAPagar;
      const valorProximaParcela = qtdParcelasAPagar > 0 ? saldoReceber / totalAPagar : 0;
      const valorProximoReforco = qtdReforcosAPagar > 0 ? saldoReceber / totalAPagar : 0;

      // Find first PARCELA due date
      const primeiraParcelaVenc = allMovimentos.find(m => 
        m.tipo_mov === "PARCELA" && m.vencimento && !isArrasSinal(m.referencia)
      );
      const primeiroVencimentoParcela = primeiraParcelaVenc?.vencimento 
        ? new Date(primeiraParcelaVenc.vencimento) 
        : null;

      // Find first REFORCO due date
      const primeiroReforcoVenc = allMovimentos.find(m => 
        m.tipo_mov === "REFORCO" && m.vencimento
      );
      const primeiroVencimentoReforco = primeiroReforcoVenc?.vencimento 
        ? new Date(primeiroReforcoVenc.vencimento) 
        : null;

      // Calculate next due dates
      let vencimentoProximaParcela: Date | null = null;
      if (primeiroVencimentoParcela && qtdParcelasAPagar > 0) {
        const freqParcelas = venda?.frequencia_parcelas_meses || 1;
        vencimentoProximaParcela = addMonths(primeiroVencimentoParcela, qtdParcelasPagas * freqParcelas);
      }

      let vencimentoProximoReforco: Date | null = null;
      if (primeiroVencimentoReforco && qtdReforcosAPagar > 0) {
        const freqReforcos = venda?.frequencia_reforcos_meses || 12;
        vencimentoProximoReforco = addMonths(primeiroVencimentoReforco, qtdReforcosPagos * freqReforcos);
      }

      return { 
        totalVenda, 
        totalAtualizacoes,
        totalJurosMora,
        totalMultasMora,
        totalRecebido,
        saldoReceber,
        qtdParcelasContratadas,
        qtdParcelasPagas,
        qtdParcelasAPagar,
        qtdReforcosContratados,
        qtdReforcosPagos,
        qtdReforcosAPagar,
        valorProximaParcela,
        vencimentoProximaParcela,
        valorProximoReforco,
        vencimentoProximoReforco,
        primeiroVencimentoParcela,
        primeiroVencimentoReforco
      };
    },
    enabled: !!selectedLoteId && venda !== undefined,
  });

  const selectedLote = lotes?.find(l => l.id === selectedLoteId);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "dd/MM/yyyy");
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "";
    return `${(value * 100).toFixed(2)}%`;
  };

  // Format Histórico: Descrição + (Referência)
  const formatHistorico = (descricao: string | null, referencia: string | null) => {
    if (!descricao && !referencia) return "-";
    if (!referencia) return descricao || "-";
    if (!descricao) return `(${referencia})`;
    return `${descricao} (${referencia})`;
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
    
    const comprador1 = venda?.comprador_nome_1 || venda?.comprador?.nome_razao || "Não informado";
    const cpf1 = venda?.comprador_cpf_1 || venda?.comprador?.cpf_cnpj || "";
    doc.text(`Comprador: ${comprador1}${cpf1 ? ` (CPF ${cpf1})` : ""}`, 14, yPos);
    yPos += 7;
    
    if (venda?.comprador_nome_2) {
      const cpf2 = venda.comprador_cpf_2 || "";
      doc.text(`          ${venda.comprador_nome_2}${cpf2 ? ` (CPF ${cpf2})` : ""}`, 14, yPos);
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
    doc.text("Últimos 12 movimentos (PARCELAMENTO):", 14, yPos);
    yPos += 8;

    const tableData = movimentos?.map(m => [
      formatDate(m.data_mov),
      formatHistorico(m.descricao, m.referencia),
      formatDate(m.vencimento),
      formatPercent(m.percentual_calculo),
      m.debito && m.debito > 0 ? formatCurrency(m.debito) : "",
      m.credito && m.credito > 0 ? formatCurrency(m.credito) : "",
      formatCurrency(m.saldo),
      (m.saldo || 0) >= 0 ? "D" : "C",
    ]) || [];

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Histórico", "Vencimento", "Cálculo", "Débitos", "Créditos", "Saldo", "D/C"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 55 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 10, halign: 'center' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Separator
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    // Summary - Two columns layout
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo:", 14, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const leftCol = 14;
    const rightCol = 110;
    const colWidth = 90;
    
    // Left column - Financial
    doc.text(`Total da Venda`, leftCol, yPos);
    doc.text(formatCurrency(resumo?.totalVenda || 0), leftCol + 55, yPos);
    // Right column - Parcelas
    doc.text(`Qtde de parcelas contratadas`, rightCol, yPos);
    doc.text(`${resumo?.qtdParcelasContratadas || 0}`, rightCol + 65, yPos);
    yPos += 6;

    doc.text(`Total Atualizações Monetárias`, leftCol, yPos);
    doc.text(formatCurrency(resumo?.totalAtualizacoes || 0), leftCol + 55, yPos);
    doc.text(`Qtde de parcelas já pagas`, rightCol, yPos);
    doc.text(`${resumo?.qtdParcelasPagas || 0}`, rightCol + 65, yPos);
    yPos += 6;

    doc.text(`Total Juros de Mora`, leftCol, yPos);
    doc.text(formatCurrency(resumo?.totalJurosMora || 0), leftCol + 55, yPos);
    doc.text(`Qtde de parcelas a pagar`, rightCol, yPos);
    doc.text(`${resumo?.qtdParcelasAPagar || 0}`, rightCol + 65, yPos);
    yPos += 6;

    doc.text(`Total Multas de Mora`, leftCol, yPos);
    doc.text(formatCurrency(resumo?.totalMultasMora || 0), leftCol + 55, yPos);
    yPos += 6;

    doc.text(`Total Recebido`, leftCol, yPos);
    doc.text(formatCurrency(-(resumo?.totalRecebido || 0)), leftCol + 55, yPos);
    // Right column - Reforços
    doc.text(`Qtde de reforços contratados`, rightCol, yPos);
    doc.text(`${resumo?.qtdReforcosContratados || 0}`, rightCol + 65, yPos);
    yPos += 6;

    doc.text(`Saldo a Receber`, leftCol, yPos);
    doc.text(formatCurrency(resumo?.saldoReceber || 0), leftCol + 55, yPos);
    doc.text(`Qtde de reforços já pagos`, rightCol, yPos);
    doc.text(`${resumo?.qtdReforcosPagos || 0}`, rightCol + 65, yPos);
    yPos += 6;

    doc.text(``, leftCol, yPos);
    doc.text(`Qtde de reforços a pagar`, rightCol, yPos);
    doc.text(`${resumo?.qtdReforcosAPagar || 0}`, rightCol + 65, yPos);
    yPos += 10;

    // Next installment (bold) - highlighted box
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(rightCol - 2, yPos - 4, 90, 16, 'F');
    
    doc.text(`Valor da próxima parcela`, rightCol, yPos);
    doc.text(formatCurrency(resumo?.valorProximaParcela || 0), rightCol + 65, yPos);
    yPos += 6;
    doc.text(`Vencimento da próxima parcela`, rightCol, yPos);
    doc.text(resumo?.vencimentoProximaParcela ? formatDate(resumo.vencimentoProximaParcela) : "-", rightCol + 65, yPos);

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

            {/* Compradores */}
            <div>
              <span className="font-semibold">Compradores:</span>{" "}
              <span>
                {venda?.comprador_nome_1 || venda?.comprador?.nome_razao || "Não informado"}
                {(venda?.comprador_cpf_1 || venda?.comprador?.cpf_cnpj) && 
                  ` (CPF ${venda?.comprador_cpf_1 || venda?.comprador?.cpf_cnpj})`}
              </span>
              {venda?.comprador_nome_2 && (
                <>
                  <br />
                  <span className="ml-24">
                    {venda.comprador_nome_2}
                    {venda.comprador_cpf_2 && ` (CPF ${venda.comprador_cpf_2})`}
                  </span>
                </>
              )}
            </div>

            <Separator />

            {/* Tabela de Movimentos */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Últimos 12 movimentos (PARCELAMENTO):</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Cálculo</TableHead>
                      <TableHead className="text-right">Débitos</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-center">D/C</TableHead>
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
                          <TableCell>{formatHistorico(mov.descricao, mov.referencia)}</TableCell>
                          <TableCell>{formatDate(mov.vencimento)}</TableCell>
                          <TableCell className="text-right">{formatPercent(mov.percentual_calculo)}</TableCell>
                          <TableCell className="text-right">{mov.debito && mov.debito > 0 ? formatCurrency(mov.debito) : ""}</TableCell>
                          <TableCell className="text-right">{mov.credito && mov.credito > 0 ? formatCurrency(mov.credito) : ""}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mov.saldo)}</TableCell>
                          <TableCell className="text-center">{(mov.saldo || 0) >= 0 ? "D" : "C"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Resumo - Two column layout */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Resumo:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left column - Financial */}
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span>Total da Venda</span>
                    <span className="font-medium">{formatCurrency(resumo?.totalVenda || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Atualizações Monetárias</span>
                    <span className="font-medium">{formatCurrency(resumo?.totalAtualizacoes || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Juros de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.totalJurosMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Multas de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.totalMultasMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Recebido</span>
                    <span className="font-medium text-destructive">{formatCurrency(-(resumo?.totalRecebido || 0))}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Saldo a Receber</span>
                    <span className="font-medium text-amber-600">{formatCurrency(resumo?.saldoReceber || 0)}</span>
                  </div>
                </div>

                {/* Right column - Quantities */}
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de parcelas contratadas</span>
                    <span className="font-medium">{resumo?.qtdParcelasContratadas || 0}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de parcelas já pagas</span>
                    <span className="font-medium text-destructive">{resumo?.qtdParcelasPagas || 0}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de parcelas a pagar</span>
                    <span className="font-medium">{resumo?.qtdParcelasAPagar || 0}</span>
                  </div>
                  <div className="h-4" />
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de reforços contratados</span>
                    <span className="font-medium">{resumo?.qtdReforcosContratados || 0}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de reforços já pagos</span>
                    <span className="font-medium text-destructive">{resumo?.qtdReforcosPagos || 0}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Qtde de reforços a pagar</span>
                    <span className="font-medium">{resumo?.qtdReforcosAPagar || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Próxima Parcela/Reforço - Destaque */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resumo && resumo.qtdParcelasAPagar > 0 && (
                <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold">Valor da próxima parcela</span>
                    <span className="font-bold">{formatCurrency(resumo.valorProximaParcela)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Vencimento da próxima parcela</span>
                    <span className="font-bold">{resumo.vencimentoProximaParcela ? formatDate(resumo.vencimentoProximaParcela) : "-"}</span>
                  </div>
                </div>
              )}
              {resumo && resumo.qtdReforcosAPagar > 0 && (
                <div className="p-4 rounded-lg bg-secondary/30 border-2 border-secondary">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold">Valor do próximo reforço</span>
                    <span className="font-bold">{formatCurrency(resumo.valorProximoReforco)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Vencimento do próximo reforço</span>
                    <span className="font-bold">{resumo.vencimentoProximoReforco ? formatDate(resumo.vencimentoProximoReforco) : "-"}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
