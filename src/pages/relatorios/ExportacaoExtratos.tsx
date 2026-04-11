import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { FileDown, Loader2, CheckCircle2, XCircle, Download, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateConsultaLotePDFBlob } from "@/lib/consulta-lote-pdf";
import { calcularResumoLote } from "@/lib/calculo-financeiro";
import { generatePixPayload, generateTxId, TipoFluxoTxId } from "@/lib/pix";
import { calcularEncargosParcela } from "@/lib/calculo-mora";
import type { MoraConfig, CriterioJurosMora } from "@/lib/calculo-mora";
import type { TipoConta, ResumoLote } from "@/types/conta-corrente.types";
import type { ParcelaEmAtraso, ResumoParcelasEmAtraso } from "@/hooks/useParcelasEmAtraso";
import { addMonths, isBefore, isSameMonth, parseISO } from "date-fns";

interface LoteComAtualizacao {
  lote_id: string;
  quadra: string;
  numero_lote: string;
  selected: boolean;
}

interface ArquivoGerado {
  loteId: string;
  quadra: string;
  numero_lote: string;
  fileName: string;
  path: string;
  publicUrl: string;
  status: "success" | "error";
  error?: string;
}

function gerarCompetencias(): { label: string; value: string }[] {
  const result = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const data = subMonths(startOfMonth(hoje), i);
    result.push({
      label: format(data, "MMMM yyyy", { locale: ptBR }),
      value: format(data, "yyyy-MM"),
    });
  }
  return result;
}

// Calculate parcelas em atraso for batch processing (mirrors useParcelasEmAtraso logic)
function calcularParcelasEmAtraso(
  tipoFluxo: TipoConta,
  venda: any,
  resumo: ResumoLote | null,
  moraConfig: MoraConfig,
  ultimaAtualizacao: Date | null
): ResumoParcelasEmAtraso {
  const resultado: ResumoParcelasEmAtraso = { parcelas: [], totalDevido: 0, isInadimplente: false };
  if (!venda || !resumo || !moraConfig) return resultado;

  const dataAtual = ultimaAtualizacao || new Date();
  const isParcelamento = tipoFluxo === "PARCELAMENTO";
  const qtdPagas = isParcelamento ? resumo.qtdParcelasPagas : resumo.qtdReforcosPagos;
  const qtdAPagar = isParcelamento ? resumo.qtdParcelasAPagar : resumo.qtdReforcosAPagar;
  const qtdTotal = isParcelamento ? (venda.qtd_parcelas || 0) : (venda.qtd_reforcos || 0);
  const valorParcela = isParcelamento ? resumo.valorProximaParcela : resumo.valorProximoReforco;
  const primeiroVencimento = isParcelamento ? resumo.primeiroVencimentoParcela : resumo.primeiroVencimentoReforco;
  const frequenciaMeses = isParcelamento ? (venda.frequencia_parcelas_meses || 1) : (venda.frequencia_reforcos_meses || 12);

  if (qtdAPagar <= 0 || valorParcela <= 0 || !primeiroVencimento) return resultado;

  const todasParcelas: ParcelaEmAtraso[] = [];
  let primeiraAVencerIdx = -1;

  for (let i = 0; i < qtdAPagar; i++) {
    const numeroParcela = qtdPagas + i + 1;
    const vencimento = addMonths(primeiroVencimento, (qtdPagas + i) * frequenciaMeses);
    const encargos = calcularEncargosParcela(valorParcela, vencimento, dataAtual, moraConfig);

    if (!encargos.isVencida && primeiraAVencerIdx === -1) primeiraAVencerIdx = i;

    todasParcelas.push({
      numero: numeroParcela,
      totalParcelas: qtdTotal,
      vencimento,
      valorParcela,
      mesesAtraso: encargos.mesesAtraso,
      jurosPercentual: encargos.jurosPercentual,
      valorJuros: encargos.valorJuros,
      valorMulta: encargos.valorMulta,
      totalParcela: encargos.totalParcela,
      isVencida: encargos.isVencida,
      isPrimeiraAVencer: false,
      exibirQrCode: false,
    });

    if (encargos.isVencida) resultado.isInadimplente = true;
  }

  if (primeiraAVencerIdx >= 0) todasParcelas[primeiraAVencerIdx].isPrimeiraAVencer = true;

  const limiteAtualiz = ultimaAtualizacao ? startOfMonth(addMonths(ultimaAtualizacao, 1)) : null;

  const parcelasFiltradas = todasParcelas.filter((p) => {
    if (limiteAtualiz && !isBefore(p.vencimento, limiteAtualiz) && !isSameMonth(p.vencimento, ultimaAtualizacao!)) return false;
    return p.isVencida || p.isPrimeiraAVencer;
  });

  resultado.parcelas = parcelasFiltradas.map((p) => ({
    ...p,
    exibirQrCode: isParcelamento
      ? (p.isVencida ? true : (ultimaAtualizacao ? isSameMonth(p.vencimento, ultimaAtualizacao) : true))
      : true,
  }));

  resultado.totalDevido = resultado.parcelas.reduce((acc, p) => acc + p.totalParcela, 0);
  return resultado;
}

export default function ExportacaoExtratos() {
  const competencias = gerarCompetencias();
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState(competencias[0].value);
  const [lotes, setLotes] = useState<LoteComAtualizacao[]>([]);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [loteAtual, setLoteAtual] = useState("");
  const [arquivosGerados, setArquivosGerados] = useState<ArquivoGerado[]>([]);

  // Fetch config for pasta padrão
  const { data: config } = useQuery({
    queryKey: ["configuracoes-extratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("pasta_extratos_padrao, chave_pix, vendedor_pessoa_id, juros_mora_percentual, multa_mora_percentual, criterio_juros_mora, tolerancia_dias_juros")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch lotes with ATUALIZACAO in selected month
  const { isLoading: loadingLotes, refetch: buscarLotes } = useQuery({
    queryKey: ["lotes-com-atualizacao", competenciaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("lote_id, lotes!conta_corrente_lote_lote_id_fkey(quadra, numero_lote)")
        .eq("tipo_mov", "ATUALIZACAO")
        .eq("referencia", competenciaSelecionada)
        .order("lote_id");
      if (error) throw error;

      // Deduplicate by lote_id
      const uniqueLotes = new Map<string, LoteComAtualizacao>();
      for (const row of data || []) {
        if (!uniqueLotes.has(row.lote_id)) {
          const lote = row.lotes as any;
          uniqueLotes.set(row.lote_id, {
            lote_id: row.lote_id,
            quadra: lote?.quadra || "?",
            numero_lote: lote?.numero_lote || "?",
            selected: true,
          });
        }
      }

      const sorted = Array.from(uniqueLotes.values()).sort((a, b) =>
        a.quadra.localeCompare(b.quadra) || a.numero_lote.localeCompare(b.numero_lote)
      );
      setLotes(sorted);
      setArquivosGerados([]);
      return sorted;
    },
    enabled: !!competenciaSelecionada,
  });

  const toggleLote = (loteId: string) => {
    setLotes((prev) => prev.map((l) => l.lote_id === loteId ? { ...l, selected: !l.selected } : l));
  };

  const toggleAll = (checked: boolean) => {
    setLotes((prev) => prev.map((l) => ({ ...l, selected: checked })));
  };

  const lotesSelecionados = lotes.filter((l) => l.selected);

  const gerarExtratos = useCallback(async () => {
    if (lotesSelecionados.length === 0) {
      toast.warning("Selecione pelo menos um lote.");
      return;
    }

    setProcessando(true);
    setProgresso(0);
    setArquivosGerados([]);

    const pastaBase = (config?.pasta_extratos_padrao || "extratos/{ano}-{mes}/")
      .replace("{ano}", competenciaSelecionada.split("-")[0])
      .replace("{mes}", competenciaSelecionada.split("-")[1]);

    // Load shared configs
    const moraConfig: MoraConfig = {
      juros_mora_percentual: config?.juros_mora_percentual ?? 1.0,
      multa_mora_percentual: config?.multa_mora_percentual ?? 2.0,
      criterio_juros_mora: (config?.criterio_juros_mora as CriterioJurosMora) || "MES_SUBSEQUENTE",
      tolerancia_dias_juros: config?.tolerancia_dias_juros ?? 0,
    };

    // Vendedor config
    let vendedorConfig: { nome_razao: string | null; cpf_cnpj: string | null } | null = null;
    if (config?.vendedor_pessoa_id) {
      const { data: vendedor } = await supabase
        .from("pessoas")
        .select("nome_razao, cpf_cnpj")
        .eq("id", config.vendedor_pessoa_id)
        .single();
      vendedorConfig = vendedor;
    }

    // PIX config
    let pixConfig: { chave_pix: string | null; nome_beneficiario: string | null; cidade_beneficiario: string | null } = {
      chave_pix: config?.chave_pix || null,
      nome_beneficiario: null,
      cidade_beneficiario: null,
    };
    if (config?.vendedor_pessoa_id) {
      const { data: v } = await supabase.from("pessoas").select("nome_razao").eq("id", config.vendedor_pessoa_id).single();
      pixConfig.nome_beneficiario = v?.nome_razao || null;
      const { data: e } = await supabase.from("enderecos").select("cidade").eq("pessoa_id", config.vendedor_pessoa_id).eq("principal", true).maybeSingle();
      pixConfig.cidade_beneficiario = e?.cidade || null;
    }

    const resultados: ArquivoGerado[] = [];

    for (let i = 0; i < lotesSelecionados.length; i++) {
      const lote = lotesSelecionados[i];
      setLoteAtual(`Quadra ${lote.quadra} - Lote ${lote.numero_lote}`);
      setProgresso(Math.round(((i) / lotesSelecionados.length) * 100));

      try {
        // Fetch venda
        const { data: venda } = await supabase
          .from("vendas")
          .select("*, vendedor:pessoas!vendas_vendedor_pessoa_id_fkey(nome_razao), comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)")
          .eq("lote_id", lote.lote_id)
          .eq("status", "ATIVA")
          .order("data_venda", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch all movements
        const { data: movParc } = await supabase
          .from("conta_corrente_lote")
          .select("*")
          .eq("lote_id", lote.lote_id)
          .eq("tipo_fluxo", "PARCELAMENTO")
          .order("data_mov", { ascending: true })
          .order("created_at", { ascending: true });

        const { data: movRef } = await supabase
          .from("conta_corrente_lote")
          .select("*")
          .eq("lote_id", lote.lote_id)
          .eq("tipo_fluxo", "REFORCO")
          .order("data_mov", { ascending: true })
          .order("created_at", { ascending: true });

        // Fetch parcelas_controle
        const { data: controle } = await supabase
          .from("parcelas_controle")
          .select("tipo_fluxo, data_base, qtd_pagas_base")
          .eq("lote_id", lote.lote_id);

        // All movements for resumo calculation
        const { data: allMov } = await supabase
          .from("conta_corrente_lote")
          .select("tipo_mov, tipo_fluxo, debito, credito, data_mov, vencimento, referencia, numero_parcela, sequencia_parcela")
          .eq("lote_id", lote.lote_id)
          .order("data_mov", { ascending: true })
          .order("created_at", { ascending: true });

        const resumo = calcularResumoLote(
          allMov || [],
          controle || [],
          {
            qtd_parcelas: venda?.qtd_parcelas ?? null,
            qtd_reforcos: venda?.qtd_reforcos ?? null,
            frequencia_parcelas_meses: venda?.frequencia_parcelas_meses ?? null,
            frequencia_reforcos_meses: venda?.frequencia_reforcos_meses ?? null,
            primeiro_vencimento_parcela: venda?.primeiro_vencimento_parcela ?? null,
            primeiro_vencimento_reforco: venda?.primeiro_vencimento_reforco ?? null,
            valor_parcelamento: venda?.valor_parcelamento ?? null,
            valor_reforco: venda?.valor_reforco ?? null,
          }
        );

        // Get ultima atualizacao date
        const { data: ultAtualiz } = await supabase
          .from("conta_corrente_lote")
          .select("data_mov")
          .eq("lote_id", lote.lote_id)
          .eq("tipo_mov", "ATUALIZACAO")
          .order("data_mov", { ascending: false })
          .limit(1)
          .maybeSingle();
        const ultimaAtualizacao = ultAtualiz?.data_mov ? parseISO(ultAtualiz.data_mov) : null;

        // Calc parcelas em atraso
        const resumoAtrasoParcelamento = calcularParcelasEmAtraso("PARCELAMENTO", venda, resumo, moraConfig, ultimaAtualizacao);
        const resumoAtrasoReforco = calcularParcelasEmAtraso("REFORCO", venda, resumo, moraConfig, ultimaAtualizacao);

        // Build PIX payloads
        const buildPixPayloadForType = (tipo: TipoConta) => {
          if (!pixConfig.chave_pix || !pixConfig.nome_beneficiario || !pixConfig.cidade_beneficiario || !resumo) return null;
          const isP = tipo === "PARCELAMENTO";
          const qtdAPagar = isP ? resumo.qtdParcelasAPagar : resumo.qtdReforcosAPagar;
          const valor = isP ? resumo.valorProximaParcela : resumo.valorProximoReforco;
          const qtdPagas = isP ? resumo.qtdParcelasPagas : resumo.qtdReforcosPagos;
          if (qtdAPagar <= 0 || valor <= 0) return null;
          try {
            const txid = generateTxId(lote.quadra, lote.numero_lote, qtdPagas + 1, tipo as TipoFluxoTxId);
            return generatePixPayload({ chavePix: pixConfig.chave_pix!, nomeBeneficiario: pixConfig.nome_beneficiario!, cidadeBeneficiario: pixConfig.cidade_beneficiario!, valor, txid, descricao: `Q${lote.quadra}L${lote.numero_lote}` });
          } catch { return null; }
        };

        const buildPixPayloadForParcela = (parcela: ParcelaEmAtraso): string | null => {
          if (!pixConfig.chave_pix || !pixConfig.nome_beneficiario || !pixConfig.cidade_beneficiario) return null;
          try {
            const txid = generateTxId(lote.quadra, lote.numero_lote, parcela.numero, "PARCELAMENTO");
            return generatePixPayload({ chavePix: pixConfig.chave_pix!, nomeBeneficiario: pixConfig.nome_beneficiario!, cidadeBeneficiario: pixConfig.cidade_beneficiario!, valor: parcela.totalParcela, txid, descricao: `Q${lote.quadra}L${lote.numero_lote}` });
          } catch { return null; }
        };

        // Last 12 movements per flow
        const movParc12 = (movParc || []).slice(-12);
        const movRef12 = (movRef || []).slice(-12);

        // Generate PDF blob
        const blob = await generateConsultaLotePDFBlob({
          lote: { quadra: lote.quadra, numero_lote: lote.numero_lote },
          venda,
          vendedorConfig,
          resumo,
          movimentosParcelamento: movParc12,
          movimentosReforco: movRef12,
          pixPayloadParcelamento: buildPixPayloadForType("PARCELAMENTO"),
          pixPayloadReforco: buildPixPayloadForType("REFORCO"),
          resumoAtrasoParcelamento,
          resumoAtrasoReforco,
          buildPixPayloadForParcela,
          includeQrCodes: false,
          chavePix: pixConfig.chave_pix,
        });

        // Upload to storage
        const fileName = `Quadra_${lote.quadra}_Lote_${lote.numero_lote}.pdf`;
        const filePath = `${pastaBase}${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("extratos-lote")
          .upload(filePath, blob, { contentType: "application/pdf", upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("extratos-lote").getPublicUrl(filePath);

        resultados.push({
          loteId: lote.lote_id,
          quadra: lote.quadra,
          numero_lote: lote.numero_lote,
          fileName,
          path: filePath,
          publicUrl: urlData.publicUrl,
          status: "success",
        });
      } catch (err: any) {
        console.error(`Erro ao gerar extrato para Q${lote.quadra} L${lote.numero_lote}:`, err);
        resultados.push({
          loteId: lote.lote_id,
          quadra: lote.quadra,
          numero_lote: lote.numero_lote,
          fileName: "",
          path: "",
          publicUrl: "",
          status: "error",
          error: err.message || "Erro desconhecido",
        });
      }
    }

    setArquivosGerados(resultados);
    setProgresso(100);
    setProcessando(false);
    setLoteAtual("");

    const ok = resultados.filter((r) => r.status === "success").length;
    const erros = resultados.filter((r) => r.status === "error").length;
    if (erros === 0) {
      toast.success(`${ok} extrato(s) gerado(s) com sucesso!`);
    } else {
      toast.warning(`${ok} gerado(s), ${erros} com erro.`);
    }
  }, [lotesSelecionados, config, competenciaSelecionada]);

  const pastaAtual = (config?.pasta_extratos_padrao || "extratos/{ano}-{mes}/")
    .replace("{ano}", competenciaSelecionada.split("-")[0])
    .replace("{mes}", competenciaSelecionada.split("-")[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exportação de Extratos em Lote</h1>
          <p className="text-muted-foreground">
            Gere os extratos PDF de todos os lotes com atualização monetária no mês selecionado
          </p>
        </div>
        {!processando && lotesSelecionados.length > 0 && (
          <Button onClick={gerarExtratos} size="lg">
            <FileDown className="h-4 w-4 mr-2" />
            Gerar {lotesSelecionados.length} Extrato(s)
          </Button>
        )}
      </div>

      {/* Seleção de Competência */}
      <Card>
        <CardHeader>
          <CardTitle>Competência</CardTitle>
          <CardDescription>Selecione o mês de referência da atualização monetária</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="w-64">
            <Select value={competenciaSelecionada} onValueChange={setCompetenciaSelecionada}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {competencias.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>Pasta: <code className="bg-muted px-1 rounded">{pastaAtual}</code></span>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {processando && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Processando: {loteAtual}</span>
            </div>
            <Progress value={progresso} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">{progresso}%</p>
          </CardContent>
        </Card>
      )}

      {/* Lista de lotes */}
      {!processando && lotes.length > 0 && arquivosGerados.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lotes com Atualização Monetária ({lotes.length})</CardTitle>
            <CardDescription>Selecione os lotes para gerar os extratos</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={lotes.every((l) => l.selected)}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>Quadra</TableHead>
                  <TableHead>Lote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((lote) => (
                  <TableRow key={lote.lote_id}>
                    <TableCell>
                      <Checkbox
                        checked={lote.selected}
                        onCheckedChange={() => toggleLote(lote.lote_id)}
                      />
                    </TableCell>
                    <TableCell>{lote.quadra}</TableCell>
                    <TableCell>{lote.numero_lote}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!processando && !loadingLotes && lotes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum lote com atualização monetária encontrado para {competencias.find(c => c.value === competenciaSelecionada)?.label}.
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {arquivosGerados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extratos Gerados</CardTitle>
            <CardDescription>
              {arquivosGerados.filter(a => a.status === "success").length} de {arquivosGerados.length} extrato(s) gerado(s) com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Quadra</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arquivosGerados.map((arq) => (
                  <TableRow key={arq.loteId}>
                    <TableCell>
                      {arq.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>{arq.quadra}</TableCell>
                    <TableCell>{arq.numero_lote}</TableCell>
                    <TableCell>
                      {arq.status === "success" ? (
                        <span className="text-sm">{arq.fileName}</span>
                      ) : (
                        <Badge variant="destructive">{arq.error}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {arq.status === "success" && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={arq.publicUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setArquivosGerados([]);
                  setProgresso(0);
                }}
              >
                Nova Exportação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
