import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatDateBR } from "@/lib/date";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { generateQrDataUrl } from "@/lib/qr-utils";
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
  buildPixPayloadForParcela: (parcela: ParcelaEmAtraso) => string | null;
  includeQrCodes?: boolean;
  chavePix?: string | null;
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
  return `${value.toFixed(4)}%`;
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

  if (isInadimplente) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(220, 53, 69);
    doc.setTextColor(255, 255, 255);
    const badgeText = "PARCELAS EM ABERTO";
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

// Add resumo section to PDF (with optional QR code to the right)
const addResumo = async (
  doc: jsPDF,
  yStart: number, 
  titulo: string, 
  fluxo: ResumoFluxo, 
  qtdContratadas: number, 
  qtdPagas: number, 
  qtdAPagar: number,
  pixPayload?: string | null,
  proximoValor?: number,
  proximoVenc?: Date | null,
  includeQrCodes: boolean = true,
  chavePix?: string | null
): Promise<number> => {
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

  const resumoStartY = yPos;

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

  // QR code or text-only PIX info to the right of the resumo
  if (pixPayload && includeQrCodes) {
    try {
      const qrDataUrl = await generateQrDataUrl(pixPayload, 300);
      const qrSize = 45;
      const qrX = 145;
      const qrY = resumoStartY - 2;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      
      const labelCenterX = qrX + qrSize / 2;
      let labelY = qrY + qrSize + 5;
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PIX - Próximo Título", labelCenterX, labelY, { align: "center" });
      labelY += 5;
      
      if (proximoValor && proximoValor > 0) {
        doc.setFont("helvetica", "normal");
        doc.text(`Valor: ${formatCurrency(proximoValor)}`, labelCenterX, labelY, { align: "center" });
        labelY += 4;
      }
      if (proximoVenc) {
        doc.setFont("helvetica", "normal");
        doc.text(`Venc: ${formatDatePDF(proximoVenc)}`, labelCenterX, labelY, { align: "center" });
      }
    } catch (err) {
      console.error("Erro ao gerar QR code para resumo:", err);
    }
  } else if (pixPayload && !includeQrCodes && chavePix) {
    // Text-only PIX info
    const pixX = 145;
    let pixY = resumoStartY;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PIX - Próximo Título", pixX, pixY);
    pixY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Faça PIX para ${chavePix}`, pixX, pixY);
    pixY += 5;
    if (proximoValor && proximoValor > 0) {
      doc.text(`Valor: ${formatCurrency(proximoValor)}`, pixX, pixY);
      pixY += 4;
    }
    if (proximoVenc) {
      doc.text(`Venc: ${formatDatePDF(proximoVenc)}`, pixX, pixY);
    }
  }

  return yPos + 4;
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
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
};

// Add QR codes for parcelas em atraso - generated programmatically
const addQrCodesAtraso = async (
  doc: jsPDF,
  yStart: number,
  tipoFluxo: TipoConta,
  resumoAtraso: ResumoParcelasEmAtraso,
  buildPixPayloadForParcela: (parcela: ParcelaEmAtraso) => string | null,
  includeQrCodes: boolean = true,
  chavePix?: string | null
): Promise<number> => {
  const parcelasComQr = resumoAtraso.parcelas.filter(p => (p.isVencida || p.isPrimeiraAVencer) && p.exibirQrCode);
  if (parcelasComQr.length === 0) return yStart;

  let yPos = yStart;
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  if (includeQrCodes) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`QR Codes PIX - ${tipoFluxo === "PARCELAMENTO" ? "Parcelas" : "Reforços"}:`, 14, yPos);
    yPos += 10;

    const qrSize = 40;
    const colWidth = 60;
    let xPos = 14;

    for (const parcela of parcelasComQr) {
      const pixPayload = buildPixPayloadForParcela(parcela);
      if (!pixPayload) continue;

      if (xPos + colWidth > 200) {
        xPos = 14;
        yPos += qrSize + 30;
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
      }

      try {
        const qrDataUrl = await generateQrDataUrl(pixPayload, 300);
        doc.addImage(qrDataUrl, "PNG", xPos, yPos, qrSize, qrSize);
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const label = `${parcela.numero}/${parcela.totalParcelas}${parcela.isPrimeiraAVencer && !parcela.isVencida ? " (A Vencer)" : ""}`;
        doc.text(label, xPos + qrSize / 2, yPos + qrSize + 5, { align: "center" });
        doc.text(formatCurrency(parcela.totalParcela), xPos + qrSize / 2, yPos + qrSize + 10, { align: "center" });

        xPos += colWidth;
      } catch (err) {
        console.error(`Erro ao gerar QR code para parcela ${parcela.numero}:`, err);
      }
    }

    return yPos + qrSize + 20;
  } else if (chavePix) {
    // Text-only PIX info for each overdue parcela
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Faça PIX para ${chavePix}`, 14, yPos);
    yPos += 8;
    return yPos;
  }

  return yPos;
};

// Aviso Importante block - institutional payment imputation notice
const AVISO_TITULO = "AVISO IMPORTANTE";
const AVISO_TEXTO =
  "Informamos que, conforme disposições contratuais e comunicações já encaminhadas, " +
  "os pagamentos realizados serão apropriados sempre da parcela ou reforço há mais tempo " +
  "vencido para o mais recente. Assim, existindo parcelas e/ou reforços em atraso, eventual " +
  "pagamento não será necessariamente imputado à obrigação atualmente vincenda, mas sim às " +
  "pendências mais antigas. Eventual diferença não quitada integralmente permanecerá compondo " +
  "o saldo devedor, com reflexo nas parcelas vincendas e demais obrigações remanescentes.";

const addAvisoImportante = (doc: jsPDF, yStart: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const boxWidth = pageWidth - marginLeft - marginRight;
  const padding = 6;
  const textMaxWidth = boxWidth - padding * 2;

  // Pre-calculate text height
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const splitText = doc.splitTextToSize(AVISO_TEXTO, textMaxWidth);
  const lineHeight = 4.5;
  const titleHeight = 7;
  const totalBoxHeight = padding + titleHeight + splitText.length * lineHeight + padding;

  let yPos = yStart;

  // If not enough space, add new page
  if (yPos + totalBoxHeight + 10 > pageHeight - 15) {
    doc.addPage();
    yPos = 20;
  }

  // Draw box with light gray background and subtle border
  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(marginLeft, yPos, boxWidth, totalBoxHeight, 2, 2, "FD");

  // Title
  let textY = yPos + padding + 4;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 40, 40);
  doc.text(AVISO_TITULO, marginLeft + padding, textY);

  // Body
  textY += titleHeight;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  for (const line of splitText) {
    doc.text(line, marginLeft + padding, textY);
    textY += lineHeight;
  }

  // Reset text color
  doc.setTextColor(0, 0, 0);

  return yPos + totalBoxHeight + 8;
};

// Generate PDF and return as Blob (for batch/upload use)
export async function generateConsultaLotePDFBlob(params: PDFExportParams): Promise<Blob> {
  const doc = await buildConsultaLotePDF(params);
  return doc.output("blob");
}

// Main export function - now async for programmatic QR generation
export async function exportConsultaLoteToPDF(params: PDFExportParams): Promise<void> {
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
    buildPixPayloadForParcela,
    includeQrCodes = true,
    chavePix,
  } = params;

  const doc = await buildConsultaLotePDF(params);
  doc.save(`consulta_lote_${lote.quadra}_${lote.numero_lote}.pdf`);
}

// Internal builder that returns the jsPDF doc
async function buildConsultaLotePDF(params: PDFExportParams): Promise<jsPDF> {
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
    buildPixPayloadForParcela,
    includeQrCodes = true,
    chavePix,
  } = params;

  const doc = new jsPDF();

  const renderFluxoPage = async (tipo: TipoConta) => {
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
    const pixPayload = isParcelamento ? pixPayloadParcelamento : pixPayloadReforco;

    let yPos = addHeader(doc, lote, venda, vendedorConfig, tituloFluxo, resumoAtraso.isInadimplente);
    yPos = addExtratoTable(doc, yPos, `Últimos 12 movimentos (${tituloFluxo}):`, movimentos);

    const temParcelasVencidasCheck = resumoAtraso.parcelas.some(p => p.isVencida);
    const parcelasComQrAtraso = temParcelasVencidasCheck 
      ? resumoAtraso.parcelas.filter(p => (p.isVencida || p.isPrimeiraAVencer) && p.exibirQrCode)
      : [];
    const temQrCodesIndividuais = parcelasComQrAtraso.length > 0;

    if (fluxoResumo) {
      const resumoPixPayload = temQrCodesIndividuais ? null : pixPayload;
      yPos = await addResumo(doc, yPos, tituloFluxo, fluxoResumo, qtdContratadas || 0, qtdPagas || 0, qtdAPagar || 0, resumoPixPayload, proximoValor, proximoVenc, includeQrCodes, chavePix);
    }

    const temParcelasVencidas = resumoAtraso.parcelas.some(p => p.isVencida);
    if (temParcelasVencidas && resumoAtraso.parcelas.length > 0) {
      yPos = addParcelasAtrasoTable(doc, yPos, tituloFluxo, resumoAtraso);
      yPos = await addQrCodesAtraso(doc, yPos, tipo, resumoAtraso, buildPixPayloadForParcela, includeQrCodes, chavePix);
    }

    if (temParcelasVencidas) {
      addAvisoImportante(doc, yPos);
    }
  };

  await renderFluxoPage("PARCELAMENTO");

  const hasReforco = (resumo?.qtdReforcosContratados || 0) > 0 || movimentosReforco.length > 0;
  if (hasReforco) {
    doc.addPage();
    await renderFluxoPage("REFORCO");
  }

  return doc;
}
