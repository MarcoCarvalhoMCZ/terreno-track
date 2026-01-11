import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileDown, Search, QrCode } from "lucide-react";
import { format, addMonths } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { generatePixPayload, generateTxId, TipoFluxoTxId } from "@/lib/pix";

type TipoConta = "PARCELAMENTO" | "REFORCO";

interface ResumoFluxo {
  totalVenda: number;
  totalAtualizacoes: number;
  totalJurosMora: number;
  totalMultasMora: number;
  totalRecebido: number;
  saldoReceber: number;
}

interface ResumoLote {
  // Valores separados por fluxo
  parcelamento: ResumoFluxo;
  reforco: ResumoFluxo;
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
  const [tipoConta, setTipoConta] = useState<TipoConta>("PARCELAMENTO");

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

  // Fetch últimos 12 movimentos de PARCELAMENTO (mais recentes primeiro)
  const { data: movimentosParcelamento } = useQuery({
    queryKey: ["movimentos-parcelamento-lote", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .eq("tipo_fluxo", "PARCELAMENTO")
        .order("data_mov", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoteId,
  });

  // Fetch últimos 12 movimentos de REFORÇO (mais recentes primeiro)
  const { data: movimentosReforco } = useQuery({
    queryKey: ["movimentos-reforco-lote", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .eq("tipo_fluxo", "REFORCO")
        .order("data_mov", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoteId,
  });

  // Fetch resumo do lote com todas as informações - SEPARADO POR FLUXO
  const { data: resumo } = useQuery({
    queryKey: ["resumo-lote-consulta", selectedLoteId, venda?.id],
    queryFn: async (): Promise<ResumoLote | null> => {
      if (!selectedLoteId) return null;
      
      // Fetch all movements
      const { data: allMovimentos, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      
      // Separar movimentos por tipo de fluxo
      const movParcelamento = allMovimentos.filter(m => m.tipo_fluxo === "PARCELAMENTO");
      const movReforco = allMovimentos.filter(m => m.tipo_fluxo === "REFORCO");

      // Helper to check if referencia contains Arras/Sinal
      const isArrasSinal = (referencia: string | null) => {
        if (!referencia) return false;
        const lower = referencia.toLowerCase();
        return lower.includes("arras") || lower.includes("sinal");
      };

      // Função auxiliar para calcular totais de um fluxo
      const calcularTotaisFluxo = (movimentos: typeof allMovimentos): ResumoFluxo => {
        const totalVenda = movimentos
          .filter(m => ["VENDA", "ENTRADA_PARCELA", "SINAL", "REFORCO", "PARCELA"].includes(m.tipo_mov))
          .reduce((acc, m) => acc + (m.debito || 0), 0);
        
        const totalAtualizacoes = movimentos
          .filter(m => m.tipo_mov === "ATUALIZACAO")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalJurosMora = movimentos
          .filter(m => m.tipo_mov === "JUROS_MORA")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalMultasMora = movimentos
          .filter(m => m.tipo_mov === "MULTA_MORA")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalRecebido = movimentos
          .reduce((acc, m) => acc + (m.credito || 0), 0);

        // Get the latest balance from this flow
        const ultimoMovimento = movimentos.length > 0 ? movimentos[movimentos.length - 1] : null;
        const saldoReceber = ultimoMovimento?.saldo || 0;

        return {
          totalVenda,
          totalAtualizacoes,
          totalJurosMora,
          totalMultasMora,
          totalRecebido,
          saldoReceber
        };
      };

      // Calcular totais separados por fluxo
      const parcelamentoTotais = calcularTotaisFluxo(movParcelamento);
      const reforcoTotais = calcularTotaisFluxo(movReforco);

      // Count PARCELAS paid (excluding Arras/Sinal) - do fluxo PARCELAMENTO
      const parcelasPagas = movParcelamento.filter(m => 
        m.tipo_mov === "PARCELA" && 
        (m.credito || 0) > 0 &&
        !isArrasSinal(m.referencia)
      );
      const qtdParcelasPagas = parcelasPagas.length;

      // Count REFORCOS paid - do fluxo REFORCO
      const reforcosPagos = movReforco.filter(m => 
        m.tipo_mov === "REFORCO" && 
        (m.credito || 0) > 0
      );
      const qtdReforcosPagos = reforcosPagos.length;

      // Contracted from venda
      const qtdParcelasContratadas = venda?.qtd_parcelas || 0;
      const qtdReforcosContratados = venda?.qtd_reforcos || 0;
      
      const qtdParcelasAPagar = Math.max(0, qtdParcelasContratadas - qtdParcelasPagas);
      const qtdReforcosAPagar = Math.max(0, qtdReforcosContratados - qtdReforcosPagos);

      // Calculate next installment value usando o saldo de cada fluxo
      // Parcela: saldo_parcelamento / qtd parcelas restantes
      const valorProximaParcela = qtdParcelasAPagar > 0 
        ? parcelamentoTotais.saldoReceber / qtdParcelasAPagar 
        : 0;
      
      // Reforço: saldo_reforco / qtd reforços restantes
      const valorProximoReforco = qtdReforcosAPagar > 0 
        ? reforcoTotais.saldoReceber / qtdReforcosAPagar
        : 0;

      // Get first due dates from venda (if configured) or from movements
      let primeiroVencimentoParcela: Date | null = null;
      let primeiroVencimentoReforco: Date | null = null;
      
      // Primeiro tenta usar os vencimentos cadastrados na venda
      if ((venda as any)?.primeiro_vencimento_parcela) {
        primeiroVencimentoParcela = new Date((venda as any).primeiro_vencimento_parcela);
      } else {
        // Fallback: busca do primeiro movimento
        const primeiraParcelaVenc = movParcelamento.find(m => 
          m.tipo_mov === "PARCELA" && m.vencimento && !isArrasSinal(m.referencia)
        );
        primeiroVencimentoParcela = primeiraParcelaVenc?.vencimento 
          ? new Date(primeiraParcelaVenc.vencimento) 
          : null;
      }
      
      if ((venda as any)?.primeiro_vencimento_reforco) {
        primeiroVencimentoReforco = new Date((venda as any).primeiro_vencimento_reforco);
      } else {
        // Fallback: busca do primeiro movimento
        const primeiroReforcoVenc = movReforco.find(m => 
          m.tipo_mov === "REFORCO" && m.vencimento
        );
        primeiroVencimentoReforco = primeiroReforcoVenc?.vencimento 
          ? new Date(primeiroReforcoVenc.vencimento) 
          : null;
      }

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
        parcelamento: parcelamentoTotais,
        reforco: reforcoTotais,
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

  // Fetch configurações e dados do vendedor padrão para QR Code PIX
  const { data: pixConfig } = useQuery({
    queryKey: ["configuracoes-pix-vendedor"],
    queryFn: async () => {
      // Buscar configurações
      const { data: config, error: configError } = await supabase
        .from("configuracoes")
        .select("chave_pix, vendedor_pessoa_id")
        .limit(1)
        .maybeSingle();
      if (configError) throw configError;
      if (!config?.vendedor_pessoa_id) return { chave_pix: config?.chave_pix || null, nome_beneficiario: null, cidade_beneficiario: null };

      // Buscar nome do vendedor padrão
      const { data: vendedor, error: vendedorError } = await supabase
        .from("pessoas")
        .select("nome_razao")
        .eq("id", config.vendedor_pessoa_id)
        .single();
      if (vendedorError) throw vendedorError;

      // Buscar cidade do endereço principal do vendedor
      const { data: endereco, error: enderecoError } = await supabase
        .from("enderecos")
        .select("cidade")
        .eq("pessoa_id", config.vendedor_pessoa_id)
        .eq("principal", true)
        .maybeSingle();
      
      // Se não tem endereço principal, buscar qualquer endereço
      let cidade = endereco?.cidade || null;
      if (!cidade && !enderecoError) {
        const { data: qualquerEndereco } = await supabase
          .from("enderecos")
          .select("cidade")
          .eq("pessoa_id", config.vendedor_pessoa_id)
          .limit(1)
          .maybeSingle();
        cidade = qualquerEndereco?.cidade || null;
      }

      return {
        chave_pix: config.chave_pix,
        nome_beneficiario: vendedor?.nome_razao || null,
        cidade_beneficiario: cidade,
      };
    },
  });

  const selectedLote = lotes?.find(l => l.id === selectedLoteId);

  const buildPixPayloadForTipo = (tipo: TipoConta) => {
    if (!pixConfig?.chave_pix || !pixConfig?.nome_beneficiario || !pixConfig?.cidade_beneficiario) {
      return null;
    }
    if (!resumo || !selectedLote) {
      return null;
    }

    const isParcelamento = tipo === "PARCELAMENTO";
    const qtdAPagar = isParcelamento ? resumo.qtdParcelasAPagar : resumo.qtdReforcosAPagar;
    const valor = isParcelamento ? resumo.valorProximaParcela : resumo.valorProximoReforco;
    const vencimento = isParcelamento ? resumo.vencimentoProximaParcela : resumo.vencimentoProximoReforco;
    const qtdPagas = isParcelamento ? resumo.qtdParcelasPagas : resumo.qtdReforcosPagos;

    if (qtdAPagar <= 0 || valor <= 0) {
      return null;
    }

    try {
      const anoCompetencia = vencimento ? new Date(vencimento).getFullYear() : new Date().getFullYear();
      const tipoFluxo: TipoFluxoTxId = isParcelamento ? "PARCELAMENTO" : "REFORCO";

      const txid = generateTxId(
        selectedLote.quadra,
        selectedLote.numero_lote,
        qtdPagas + 1,
        tipoFluxo,
        anoCompetencia
      );

      return generatePixPayload({
        chavePix: pixConfig.chave_pix,
        nomeBeneficiario: pixConfig.nome_beneficiario,
        cidadeBeneficiario: pixConfig.cidade_beneficiario,
        valor,
        txid,
        descricao: `Q${selectedLote.quadra}L${selectedLote.numero_lote}`,
      });
    } catch (error) {
      console.error("Erro ao gerar payload PIX:", error);
      return null;
    }
  };

  // Payloads para PDF (um por fluxo)
  const pixPayloadParcelamento = useMemo(
    () => buildPixPayloadForTipo("PARCELAMENTO"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pixConfig, resumo, selectedLote]
  );

  const pixPayloadReforco = useMemo(
    () => buildPixPayloadForTipo("REFORCO"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pixConfig, resumo, selectedLote]
  );

  // Payload exibido na tela (aba ativa)
  const pixPayload = useMemo(() => buildPixPayloadForTipo(tipoConta), [pixConfig, resumo, selectedLote, tipoConta]);

  const pixDisplayDataParcelamento = useMemo(() => {
    if (!resumo) return null;
    return {
      titulo: "Próxima Parcela",
      valor: resumo.valorProximaParcela,
      vencimento: resumo.vencimentoProximaParcela,
      qtdAPagar: resumo.qtdParcelasAPagar,
    };
  }, [resumo]);

  const pixDisplayDataReforco = useMemo(() => {
    if (!resumo) return null;
    return {
      titulo: "Próximo Reforço",
      valor: resumo.valorProximoReforco,
      vencimento: resumo.vencimentoProximoReforco,
      qtdAPagar: resumo.qtdReforcosAPagar,
    };
  }, [resumo]);

  // Valores dinâmicos para exibição do QR Code baseado na aba ativa
  const pixDisplayData = useMemo(() => {
    if (!resumo) return null;
    return tipoConta === "PARCELAMENTO" ? pixDisplayDataParcelamento : pixDisplayDataReforco;
  }, [resumo, tipoConta, pixDisplayDataParcelamento, pixDisplayDataReforco]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Format number without "R$" prefix for PDF optimization
  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "dd/MM/yyyy");
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "";
    return `${value.toFixed(2)}%`;
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

    const addHeader = (tituloFluxo: string) => {
      let yPos = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Quadra ${selectedLote.quadra} - Lote ${selectedLote.numero_lote}`, 14, yPos);
      yPos += 8;

      doc.setFontSize(12);
      doc.text(tituloFluxo, 14, yPos);
      yPos += 12;

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

      yPos += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, 196, yPos);
      yPos += 10;

      return yPos;
    };

    const addExtratoTable = (yStart: number, titulo: string, movimentos: any[]) => {
      let yPos = yStart;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, 14, yPos);
      yPos += 8;

      const tableData = movimentos?.map((m) => [
        formatDate(m.data_mov),
        formatHistorico(m.descricao, m.referencia),
        formatDate(m.vencimento),
        formatPercent(m.percentual_calculo),
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

    const addResumo = (yStart: number, titulo: string, fluxo: ResumoFluxo, qtdContratadas: number, qtdPagas: number, qtdAPagar: number) => {
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

    const addProximoTitulo = (yStart: number, titulo: string, valor: number, vencimento: Date | null) => {
      let yPos = yStart;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);

      doc.setFillColor(245, 245, 245);
      doc.rect(12, yPos - 4, 184, 16, "F");

      doc.text(`Valor ${titulo}`, 14, yPos);
      doc.text(formatNumber(valor || 0), 110, yPos, { align: "right" });
      doc.text("Vencimento", 14, yPos + 6);
      doc.text(vencimento ? formatDate(vencimento) : "-", 110, yPos + 6, { align: "right" });

      return yPos + 20;
    };

    const addQrSection = (yStart: number, titulo: string, valor: number, vencimento: Date | null, qrCanvasId: string) => {
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
      doc.text(`Vencimento: ${vencimento ? formatDate(vencimento) : "-"}`, infoX, yPos + 18);
      doc.setFontSize(8);
      doc.text(`Escaneie o QR Code acima com o app`, infoX, yPos + 30);
      doc.text(`do seu banco para pagar.`, infoX, yPos + 36);

      return yPos + qrSize + 10;
    };

    const renderFluxoPage = (tipo: TipoConta) => {
      const isParcelamento = tipo === "PARCELAMENTO";

      const tituloFluxo = isParcelamento ? "PARCELAMENTO" : "REFORÇOS";
      const movimentos = isParcelamento ? movimentosParcelamento || [] : movimentosReforco || [];

      const fluxoResumo = isParcelamento ? resumo?.parcelamento : resumo?.reforco;
      const qtdContratadas = isParcelamento ? resumo?.qtdParcelasContratadas : resumo?.qtdReforcosContratados;
      const qtdPagas = isParcelamento ? resumo?.qtdParcelasPagas : resumo?.qtdReforcosPagos;
      const qtdAPagar = isParcelamento ? resumo?.qtdParcelasAPagar : resumo?.qtdReforcosAPagar;

      const proximoValor = isParcelamento ? resumo?.valorProximaParcela : resumo?.valorProximoReforco;
      const proximoVenc = isParcelamento ? resumo?.vencimentoProximaParcela : resumo?.vencimentoProximoReforco;

      let yPos = addHeader(tituloFluxo);
      yPos = addExtratoTable(yPos, `Últimos 12 movimentos (${tituloFluxo}):`, movimentos);

      if (fluxoResumo) {
        yPos = addResumo(yPos, tituloFluxo, fluxoResumo, qtdContratadas || 0, qtdPagas || 0, qtdAPagar || 0);
      }

      if ((qtdAPagar || 0) > 0 && (proximoValor || 0) > 0) {
        const label = isParcelamento ? "da próxima parcela" : "do próximo reforço";
        yPos = addProximoTitulo(yPos, label, proximoValor || 0, proximoVenc || null);

        const payload = isParcelamento ? pixPayloadParcelamento : pixPayloadReforco;
        const canvasId = isParcelamento ? "qr-code-pdf-canvas-parcelamento" : "qr-code-pdf-canvas-reforco";

        if (payload) {
          yPos = addQrSection(yPos, isParcelamento ? "Próxima Parcela" : "Próximo Reforço", proximoValor || 0, proximoVenc || null, canvasId);
        }
      }
    };

    // Página 1: sempre PARCELAMENTO
    renderFluxoPage("PARCELAMENTO");

    // Página 2: REFORÇO (somente se existir)
    const hasReforco = (resumo?.qtdReforcosContratados || 0) > 0 || (movimentosReforco?.length || 0) > 0;
    if (hasReforco) {
      doc.addPage();
      renderFluxoPage("REFORCO");
    }

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

            {/* Tabs para Parcelamento e Reforços */}
            <Tabs value={tipoConta} onValueChange={(v) => setTipoConta(v as TipoConta)} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="PARCELAMENTO">Parcelamento</TabsTrigger>
                <TabsTrigger value="REFORCO">Reforços</TabsTrigger>
              </TabsList>
              
              <TabsContent value="PARCELAMENTO" className="space-y-4 mt-4">
                {/* Tabela de Movimentos - PARCELAMENTO */}
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
                          <TableHead className="text-right">Débitos(R$)</TableHead>
                          <TableHead className="text-right">Créditos(R$)</TableHead>
                          <TableHead className="text-right">Saldo(R$)</TableHead>
                          <TableHead className="text-center">D/C</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentosParcelamento?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Nenhum movimento de parcelamento encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          movimentosParcelamento?.map((mov) => (
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
              </TabsContent>

              <TabsContent value="REFORCO" className="space-y-4 mt-4">
                {/* Tabela de Movimentos - REFORÇOS */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Últimos 12 movimentos (REFORÇOS):</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Cálculo</TableHead>
                          <TableHead className="text-right">Débitos(R$)</TableHead>
                          <TableHead className="text-right">Créditos(R$)</TableHead>
                          <TableHead className="text-right">Saldo(R$)</TableHead>
                          <TableHead className="text-center">D/C</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentosReforco?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Nenhum movimento de reforço encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          movimentosReforco?.map((mov) => (
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
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Resumo - APENAS DO FLUXO ATIVO */}
            <div>
              <h3 className="font-semibold text-lg mb-3">
                Resumo ({tipoConta === "PARCELAMENTO" ? "PARCELAMENTO" : "REFORÇOS"}):
              </h3>

              {tipoConta === "PARCELAMENTO" ? (
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span>Total da Venda</span>
                    <span className="font-medium">{formatCurrency(resumo?.parcelamento.totalVenda || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Atualizações Monetárias</span>
                    <span className="font-medium">{formatCurrency(resumo?.parcelamento.totalAtualizacoes || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Juros de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.parcelamento.totalJurosMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Multas de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.parcelamento.totalMultasMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Recebido</span>
                    <span className="font-medium text-destructive">{formatCurrency(-(resumo?.parcelamento.totalRecebido || 0))}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Saldo a Receber</span>
                    <span className="font-medium text-amber-600">{formatCurrency(resumo?.parcelamento.saldoReceber || 0)}</span>
                  </div>
                  <div className="h-2" />
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
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span>Total da Venda</span>
                    <span className="font-medium">{formatCurrency(resumo?.reforco.totalVenda || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Atualizações Monetárias</span>
                    <span className="font-medium">{formatCurrency(resumo?.reforco.totalAtualizacoes || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Juros de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.reforco.totalJurosMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Multas de Mora</span>
                    <span className="font-medium">{formatCurrency(resumo?.reforco.totalMultasMora || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Total Recebido</span>
                    <span className="font-medium text-destructive">{formatCurrency(-(resumo?.reforco.totalRecebido || 0))}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>Saldo a Receber</span>
                    <span className="font-medium text-amber-600">{formatCurrency(resumo?.reforco.saldoReceber || 0)}</span>
                  </div>
                  <div className="h-2" />
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
              )}
            </div>

            <Separator />

            {/* Próximo título - APENAS DO FLUXO ATIVO */}
            <div className="grid grid-cols-1 gap-4">
              {tipoConta === "PARCELAMENTO" && resumo && resumo.qtdParcelasAPagar > 0 && (
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

              {tipoConta === "REFORCO" && resumo && resumo.qtdReforcosAPagar > 0 && (
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

            {/* QR Code PIX - Dinâmico baseado na aba ativa */}
            {pixDisplayData && pixDisplayData.qtdAPagar > 0 && pixPayload && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <QrCode className="h-5 w-5" />
                    QR Code PIX - {pixDisplayData.titulo}
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <QRCodeSVG value={pixPayload} size={200} level="M" includeMargin={true} />
                  </div>

                  {/* Hidden canvases for PDF export (um por fluxo) */}
                  <div className="hidden">
                    {pixPayloadParcelamento && (
                      <QRCodeCanvas
                        id="qr-code-pdf-canvas-parcelamento"
                        value={pixPayloadParcelamento}
                        size={300}
                        level="M"
                        includeMargin={true}
                      />
                    )}
                    {pixPayloadReforco && (
                      <QRCodeCanvas
                        id="qr-code-pdf-canvas-reforco"
                        value={pixPayloadReforco}
                        size={300}
                        level="M"
                        includeMargin={true}
                      />
                    )}
                  </div>

                  <div className="text-center text-sm text-muted-foreground max-w-md">
                    <p>Escaneie o QR Code acima com o app do seu banco para pagar.</p>
                    <p className="mt-1 font-medium">Valor: {formatCurrency(pixDisplayData.valor)}</p>
                    {pixDisplayData.vencimento && <p className="text-xs">Vencimento: {formatDate(pixDisplayData.vencimento)}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(pixPayload);
                      import("sonner").then(({ toast }) => {
                        toast.success("Código PIX copiado!");
                      });
                    }}
                  >
                    Copiar código PIX
                  </Button>
                </div>
              </>
            )}

            {pixDisplayData && pixDisplayData.qtdAPagar > 0 && !pixPayload && pixConfig && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-2 p-6 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <QrCode className="h-8 w-8 text-amber-600" />
                  <p className="text-amber-800 dark:text-amber-200 text-center">
                    Para gerar o QR Code PIX, configure a <strong>Chave PIX</strong> em Configurações, e cadastre um <strong>endereço com cidade</strong> para o Vendedor Padrão.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
