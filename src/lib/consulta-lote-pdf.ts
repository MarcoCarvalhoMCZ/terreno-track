import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatDateBR } from "@/lib/date";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import type { ResumoFluxo, ResumoLote, TipoConta } from "@/types/conta-corrente.types";
import type { ParcelaEmAtraso, ResumoParcelasEmAtraso } from "@/hooks/useParcelasEmAtraso";

interface LoteInfo {
  quadra: string;
  numero_lote: string;
}

interface VendedorConfigInfo {
  nome_razao: string | null;
  cpf_cnpj: string | null;
}

interface VendaInfo {
  vendedor?: { nome_razao: string | null } | null;
  comprador?: { nome_razao: string | null; cpf_cnpj: string | null } | null;
  comprador_nome_1?: string | null;
  comprador_cpf_1?: string | null;
  comprador_nome_2?: string | null;
  comprador_cpf_2?: string | null;
}

interface MovimentoRow {
  id: string;
  data_mov: string | null;
  descricao: string | null;
  referencia: string | null;
  vencimento: string | null;
  percentual_calculo: number | null;
  debito: number | null;
  credito: number | null;
  saldo: number | null;
}

interface PDFExportParams {
  lote: LoteInfo;
  venda: VendaInfo | null;
  vendedorConfig: VendedorConfigInfo | null;
  resumo: ResumoLote | null;
  movimentosParcelamento: MovimentoRow[];
  movimentosReforco: MovimentoRow[];
  pixPayloadParcelamento: string | null;
  pixPayloadReforco: string | null;
  resumoAtrasoParcelamento: ResumoParcelasEmAtraso;
  resumoAtrasoReforco: ResumoParcelasEmAtraso;
}

// Format date for PDF
const formatDatePDF = (date: string | Date | null): string => {
  if (!date) return "-";
  if (typeof date === 'string') {
    return formatDateBR(date);
  }
  return format(date, "dd/MM/yyyy");
};

// Format percentage for PDF
const formatPercentPDF = (value: number | null): string => {
  if (value === null || value === undefined) return "";
  return `${value.toFixed(2)}%`;
};

// Format Histórico: Descrição + (Referência)
const formatHistorico = (descricao: string | null, referencia: string | null): string => {
  if (!descricao && !referencia) return "-";
  if (!referencia) return descricao || "-";
  if (!descricao) return `(${referencia})`;
  return `${descricao} (${referencia})`;
};

// Add header to PDF page
const addHeader = (
  doc: jsPDF, 
  lote: LoteInfo, 
  venda: VendaInfo | null, 
  vendedorConfig: VendedorConfigInfo | null,
  tituloFluxo: string,
  isInadimplente: boolean
): number => {
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Badge INADIMPLENTE no canto superior direito
  if (isInadimplente) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(220, 53, 69);
    doc.setTextColor(255, 255, 255);
    const badgeText = "☒ INADIMPLENTE";
    const textWidth = doc.getTextWidth(badgeText);
    const badgeX = pageWidth - textWidth - 18;
    doc.rect(badgeX - 4, yPos - 6, textWidth + 8, 10, "F");
    doc.text(badgeText, badgeX, yPos);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Quadra ${lote.quadra} - Lote ${lote.numero_lote}`, 14, yPos);
  yPos += 8;

  doc.setFontSize(12);
  doc.text(tituloFluxo, 14, yPos);
  yPos += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Vendedor da configuração
  const vendedorNome = vendedorConfig?.nome_razao || "Não informado";
  const vendedorCnpj = vendedorConfig?.cpf_cnpj ? ` (CNPJ ${vendedorConfig.cpf_cnpj})` : "";
  doc.text(`Vendedor: ${vendedorNome}${vendedorCnpj}`, 14, yPos);
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

  yPos += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, 196, yPos);
  yPos += 10;

  return yPos;
};

// Add extrato table to PDF
const addExtratoTable = (
  doc: jsPDF, 
  yStart: number, 
  titulo: string, 
  movimentos: MovimentoRow[]
): number => {
  let yPos = yStart;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, yPos);
  yPos += 8;

  const tableData = movimentos?.map((m) => [
    formatDatePDF(m.data_mov),
    formatHistorico(m.descricao, m.referencia),
    formatDatePDF(m.vencimento),
    formatPercentPDF(m.percentual_calculo),
    m.debito && m.debito > 0 ? formatNumber(m.debito) : "",
    m.credito && m.credito > 0 ? formatNumber(m.credito) : "",
    formatNumber(m.saldo),
    (m.saldo || 0) >= 0 ? "D" : "C",
  ]) || [];

  autoTable(doc, {
    startY: yPos,
    head: [["Data", "Histórico", "Vencimento", "Cálculo", "Débitos(R$)", "Créditos(R$)", "Saldo(R$)", "D/C"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 55 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 10, halign: "center" },
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
};

// Add resumo section to PDF
const addResumo = (
  doc: jsPDF,
  yStart: number, 
  titulo: string, 
  fluxo: ResumoFluxo, 
  qtdContratadas: number, 
  qtdPagas: number, 
  qtdAPagar: number
): number => {
  let yPos = yStart;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, 196, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Resumo (${titulo}):`, 14, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const left = 14;
  const valueX = 110;

  const row = (label: string, value: string) => {
    doc.text(label, left, yPos);
    doc.text(value, valueX, yPos, { align: "right" });
    yPos += 6;
  };

  row("Total da Venda", formatNumber(fluxo.totalVenda || 0));
  row("Total Atualizações Monetárias", formatNumber(fluxo.totalAtualizacoes || 0));
  row("Total Juros de Mora", formatNumber(fluxo.totalJurosMora || 0));
  row("Total Multas de Mora", formatNumber(fluxo.totalMultasMora || 0));
  row("Total Recebido", formatNumber(-(fluxo.totalRecebido || 0)));
  row("Saldo a Receber", formatNumber(fluxo.saldoReceber || 0));

  yPos += 4;
  row("Qtde contratadas", `${qtdContratadas || 0}`);
  row("Qtde já pagas", `${qtdPagas || 0}`);
  row("Qtde a pagar", `${qtdAPagar || 0}`);

  return yPos + 4;
};

// Add próximo título section
const addProximoTitulo = (
  doc: jsPDF,
  yStart: number, 
  titulo: string, 
  valor: number, 
  vencimento: Date | null
): number => {
  let yPos = yStart;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  doc.setFillColor(245, 245, 245);
  doc.rect(12, yPos - 4, 184, 16, "F");

  doc.text(`Valor ${titulo}`, 14, yPos);
  doc.text(formatNumber(valor || 0), 110, yPos, { align: "right" });
  doc.text("Vencimento", 14, yPos + 6);
  doc.text(vencimento ? formatDatePDF(vencimento) : "-", 110, yPos + 6, { align: "right" });

  return yPos + 20;
};

// Add QR Code section
const addQrSection = (
  doc: jsPDF,
  yStart: number, 
  titulo: string, 
  valor: number, 
  vencimento: Date | null, 
  qrCanvasId: string
): number => {
  let yPos = yStart;
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos - 5, 196, yPos - 5);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`QR Code PIX - ${titulo}`, 14, yPos);
  yPos += 10;

  const qrCanvas = document.getElementById(qrCanvasId) as HTMLCanvasElement;
  if (!qrCanvas) return yPos;

  const qrDataUrl = qrCanvas.toDataURL("image/png");
  const qrSize = 50;
  doc.addImage(qrDataUrl, "PNG", 14, yPos, qrSize, qrSize);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoX = 14 + qrSize + 10;
  doc.text(`Valor: ${formatCurrency(valor)}`, infoX, yPos + 10);
  doc.text(`Vencimento: ${vencimento ? formatDatePDF(vencimento) : "-"}`, infoX, yPos + 18);
  doc.setFontSize(8);
  doc.text(`Escaneie o QR Code acima com o app`, infoX, yPos + 30);
  doc.text(`do seu banco para pagar.`, infoX, yPos + 36);

  return yPos + qrSize + 10;
};

// Add parcelas em atraso table to PDF
const addParcelasAtrasoTable = (
  doc: jsPDF,
  yStart: number,
  titulo: string,
  resumoAtraso: ResumoParcelasEmAtraso
): number => {
  if (!resumoAtraso.parcelas || resumoAtraso.parcelas.length === 0) {
    return yStart;
  }

  let yPos = yStart;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos - 5, 196, yPos - 5);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${titulo} - Parcelas em Atraso:`, 14, yPos);
  yPos += 8;

  const tableData = resumoAtraso.parcelas.map((p) => [
    `${p.numero} de ${p.totalParcelas}${p.isPrimeiraAVencer && !p.isVencida ? " (A Vencer)" : ""}`,
    formatDatePDF(p.vencimento),
    p.isVencida ? `${p.jurosPercentual.toFixed(0)}%` : "",
    formatNumber(p.valorParcela),
    p.isVencida ? formatNumber(p.valorJuros) : "",
    p.isVencida ? formatNumber(p.valorMulta) : "",
    formatNumber(p.totalParcela),
  ]);

  // Add total row
  tableData.push([
    "", "", "", "", "", "TOTAL DEVIDO",
    formatNumber(resumoAtraso.totalDevido),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Parcela", "Vencimento", "Juros%", "Valor Parcela", "Valor Juros", "Valor Multa", "Total"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [66, 66, 66] },
    bodyStyles: { valign: "middle" },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 25 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      // Make last row bold
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
};

// Add QR codes for parcelas em atraso
const addQrCodesAtraso = (
  doc: jsPDF,
  yStart: number,
  tipoFluxo: TipoConta,
  resumoAtraso: ResumoParcelasEmAtraso
): number => {
  // Apenas parcelas vencidas + primeira a vencer
  const parcelasComQr = resumoAtraso.parcelas.filter(p => p.isVencida || p.isPrimeiraAVencer);
  if (parcelasComQr.length === 0) return yStart;

  let yPos = yStart;
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`QR Codes PIX - ${tipoFluxo === "PARCELAMENTO" ? "Parcelas" : "Reforços"}:`, 14, yPos);
  yPos += 10;

  const qrSize = 40;
  const colWidth = 60;
  let xPos = 14;
  const startY = yPos;

  parcelasComQr.forEach((parcela, idx) => {
    const canvasId = `qr-code-parcela-${tipoFluxo}-${parcela.numero}`;
    const qrCanvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!qrCanvas) return;

    // New row if needed
    if (xPos + colWidth > 200) {
      xPos = 14;
      yPos += qrSize + 30;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    }

    const qrDataUrl = qrCanvas.toDataURL("image/png");
    doc.addImage(qrDataUrl, "PNG", xPos, yPos, qrSize, qrSize);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const label = `${parcela.numero}/${parcela.totalParcelas}${parcela.isPrimeiraAVencer && !parcela.isVencida ? " (A Vencer)" : ""}`;
    doc.text(label, xPos + qrSize / 2, yPos + qrSize + 5, { align: "center" });
    doc.text(formatCurrency(parcela.totalParcela), xPos + qrSize / 2, yPos + qrSize + 10, { align: "center" });

    xPos += colWidth;
  });

  return yPos + qrSize + 20;
};

// Main export function
export function exportConsultaLoteToPDF(params: PDFExportParams): void {
  const { 
    lote, 
    venda, 
    vendedorConfig,
    resumo, 
    movimentosParcelamento, 
    movimentosReforco,
    pixPayloadParcelamento,
    pixPayloadReforco,
    resumoAtrasoParcelamento,
    resumoAtrasoReforco,
  } = params;

  const doc = new jsPDF();

  const renderFluxoPage = (tipo: TipoConta) => {
    const isParcelamento = tipo === "PARCELAMENTO";

    const tituloFluxo = isParcelamento ? "PARCELAMENTO" : "REFORÇOS";
    const movimentos = isParcelamento ? movimentosParcelamento : movimentosReforco;
    const resumoAtraso = isParcelamento ? resumoAtrasoParcelamento : resumoAtrasoReforco;

    const fluxoResumo = isParcelamento ? resumo?.parcelamento : resumo?.reforco;
    const qtdContratadas = isParcelamento ? resumo?.qtdParcelasContratadas : resumo?.qtdReforcosContratados;
    const qtdPagas = isParcelamento ? resumo?.qtdParcelasPagas : resumo?.qtdReforcosPagos;
    const qtdAPagar = isParcelamento ? resumo?.qtdParcelasAPagar : resumo?.qtdReforcosAPagar;

    const proximoValor = isParcelamento ? resumo?.valorProximaParcela : resumo?.valorProximoReforco;
    const proximoVenc = isParcelamento ? resumo?.vencimentoProximaParcela : resumo?.vencimentoProximoReforco;

    let yPos = addHeader(doc, lote, venda, vendedorConfig, tituloFluxo, resumoAtraso.isInadimplente);
    yPos = addExtratoTable(doc, yPos, `Últimos 12 movimentos (${tituloFluxo}):`, movimentos);

    if (fluxoResumo) {
      yPos = addResumo(doc, yPos, tituloFluxo, fluxoResumo, qtdContratadas || 0, qtdPagas || 0, qtdAPagar || 0);
    }

    // Adicionar tabela de parcelas em atraso
    if (resumoAtraso.parcelas.length > 0) {
      yPos = addParcelasAtrasoTable(doc, yPos, tituloFluxo, resumoAtraso);
    }

    // QR codes para parcelas em atraso
    if (resumoAtraso.parcelas.length > 0) {
      yPos = addQrCodesAtraso(doc, yPos, tipo, resumoAtraso);
    }
  };

  // Página 1: sempre PARCELAMENTO
  renderFluxoPage("PARCELAMENTO");

  // Página 2: REFORÇO (somente se existir)
  const hasReforco = (resumo?.qtdReforcosContratados || 0) > 0 || movimentosReforco.length > 0;
  if (hasReforco) {
    doc.addPage();
    renderFluxoPage("REFORCO");
  }

  doc.save(`consulta_lote_${lote.quadra}_${lote.numero_lote}.pdf`);
}
