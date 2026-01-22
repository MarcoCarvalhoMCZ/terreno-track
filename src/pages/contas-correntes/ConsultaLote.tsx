import { useState, useMemo, useCallback } from "react";
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
import { FileDown, Search, QrCode, CalendarIcon, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import type { TipoConta } from "@/types/conta-corrente.types";

// Hooks
import {
  useLotesConsulta,
  useVendaLote,
  useMovimentosFluxo,
  useMovimentosComSaldo,
  useMovimentosFiltrados,
  useResumoLoteConsulta,
  usePixConfig,
  useVendedorConfig,
  useReorganizarLote,
  buildPixPayload,
  getPixDisplayData,
} from "@/hooks/useConsultaLote";
import { useMoraConfig, useParcelasEmAtraso, useUltimaAtualizacaoLote, type ParcelaEmAtraso } from "@/hooks/useParcelasEmAtraso";

// Components
import { ParcelasEmAtrasoTable } from "@/components/ParcelasEmAtrasoTable";

// PDF export
import { exportConsultaLoteToPDF } from "@/lib/consulta-lote-pdf";
import { generatePixPayload, generateTxId, TipoFluxoTxId } from "@/lib/pix";

// Format date for display
const formatDateDisplay = (date: string | Date | null): string => {
  if (!date) return "-";
  if (typeof date === 'string') {
    return formatDateBR(date);
  }
  return format(date, "dd/MM/yyyy");
};

// Format Histórico: Descrição + (Referência)
const formatHistorico = (descricao: string | null, referencia: string | null): string => {
  if (!descricao && !referencia) return "-";
  if (!referencia) return descricao || "-";
  if (!descricao) return `(${referencia})`;
  return `${descricao} (${referencia})`;
};

export default function ConsultaLote() {
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [tipoConta, setTipoConta] = useState<TipoConta>("PARCELAMENTO");
  const [dataInicial, setDataInicial] = useState<Date | undefined>(undefined);
  const [dataFinal, setDataFinal] = useState<Date | undefined>(undefined);
  const [filtroAtivo, setFiltroAtivo] = useState(false);

  // Data fetching hooks
  const { data: lotes } = useLotesConsulta();
  const { data: venda } = useVendaLote(selectedLoteId);
  const { data: todosMovimentosParcelamento } = useMovimentosFluxo(selectedLoteId, "PARCELAMENTO");
  const { data: todosMovimentosReforco } = useMovimentosFluxo(selectedLoteId, "REFORCO");
  const { data: resumo } = useResumoLoteConsulta(selectedLoteId, venda);
  const { data: pixConfig } = usePixConfig();
  const { data: vendedorConfig } = useVendedorConfig();
  const { data: moraConfig } = useMoraConfig();
  const { data: ultimaAtualizacao } = useUltimaAtualizacaoLote(selectedLoteId);
  const reorganizarMutation = useReorganizarLote(selectedLoteId);

  // Calcular parcelas em atraso para cada fluxo (com filtro de mês de atualização)
  const resumoAtrasoParcelamento = useParcelasEmAtraso("PARCELAMENTO", venda, resumo, moraConfig, ultimaAtualizacao);
  const resumoAtrasoReforco = useParcelasEmAtraso("REFORCO", venda, resumo, moraConfig, ultimaAtualizacao);

  // Converter datas para formato ISO para query
  const dataInicialISO = dataInicial ? format(dataInicial, "yyyy-MM-dd") : null;
  const dataFinalISO = dataFinal ? format(dataFinal, "yyyy-MM-dd") : null;

  // Calcular saldo acumulado
  const movimentosParcelamentoComSaldo = useMovimentosComSaldo(todosMovimentosParcelamento);
  const movimentosReforcoComSaldo = useMovimentosComSaldo(todosMovimentosReforco);

  // Filtrar/limitar movimentos para exibição
  const movimentosParcelamento = useMovimentosFiltrados(
    movimentosParcelamentoComSaldo,
    filtroAtivo,
    dataInicialISO,
    dataFinalISO
  );
  const movimentosReforco = useMovimentosFiltrados(
    movimentosReforcoComSaldo,
    filtroAtivo,
    dataInicialISO,
    dataFinalISO
  );

  const selectedLote = lotes?.find(l => l.id === selectedLoteId);

  // PIX payloads
  const pixPayloadParcelamento = useMemo(
    () => buildPixPayload("PARCELAMENTO", pixConfig, resumo, selectedLote),
    [pixConfig, resumo, selectedLote]
  );

  const pixPayloadReforco = useMemo(
    () => buildPixPayload("REFORCO", pixConfig, resumo, selectedLote),
    [pixConfig, resumo, selectedLote]
  );

  const pixPayload = useMemo(
    () => buildPixPayload(tipoConta, pixConfig, resumo, selectedLote),
    [tipoConta, pixConfig, resumo, selectedLote]
  );

  const pixDisplayData = useMemo(
    () => getPixDisplayData(resumo, tipoConta),
    [resumo, tipoConta]
  );

  // Builder de PIX payload por parcela individual (para QR codes no relatório de atraso)
  const buildPixPayloadForParcela = useCallback(
    (parcela: ParcelaEmAtraso): string | null => {
      if (!pixConfig?.chave_pix || !pixConfig?.nome_beneficiario || !pixConfig?.cidade_beneficiario) {
        return null;
      }
      if (!selectedLote) return null;

      try {
        const tipoFluxo: TipoFluxoTxId = tipoConta === "PARCELAMENTO" ? "PARCELAMENTO" : "REFORCO";
        const anoCompetencia = parcela.vencimento.getFullYear();
        
        const txid = generateTxId(
          selectedLote.quadra,
          selectedLote.numero_lote,
          parcela.numero,
          tipoFluxo,
          anoCompetencia
        );

        return generatePixPayload({
          chavePix: pixConfig.chave_pix,
          nomeBeneficiario: pixConfig.nome_beneficiario,
          cidadeBeneficiario: pixConfig.cidade_beneficiario,
          valor: parcela.totalParcela,
          txid,
          descricao: `Q${selectedLote.quadra}L${selectedLote.numero_lote}`,
        });
      } catch (error) {
        console.error("Erro ao gerar payload PIX para parcela:", error);
        return null;
      }
    },
    [pixConfig, selectedLote, tipoConta]
  );

  // PDF export handler
  const handleExportPDF = () => {
    if (!selectedLote) return;
    
    exportConsultaLoteToPDF({
      lote: selectedLote,
      venda: venda || null,
      vendedorConfig: vendedorConfig || null,
      resumo: resumo || null,
      movimentosParcelamento: movimentosParcelamento || [],
      movimentosReforco: movimentosReforco || [],
      pixPayloadParcelamento,
      pixPayloadReforco,
      resumoAtrasoParcelamento,
      resumoAtrasoReforco,
    });
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
              <Button onClick={handleExportPDF} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>

          {/* Filtro por período */}
          {selectedLoteId && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          !dataInicial && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicial ? format(dataInicial, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicial}
                        onSelect={setDataInicial}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          !dataFinal && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFinal ? format(dataFinal, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFinal}
                        onSelect={setDataFinal}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button
                  onClick={() => {
                    setFiltroAtivo(true);
                  }}
                  disabled={!dataInicial && !dataFinal}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Filtrar
                </Button>

                {filtroAtivo && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDataInicial(undefined);
                      setDataFinal(undefined);
                      setFiltroAtivo(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtro
                  </Button>
                )}
              </div>

              {filtroAtivo && (
                <p className="text-sm text-muted-foreground mt-2">
                  Exibindo movimentos {dataInicial ? `a partir de ${format(dataInicial, "dd/MM/yyyy")}` : ""}{" "}
                  {dataInicial && dataFinal ? "até" : ""}{" "}
                  {dataFinal ? format(dataFinal, "dd/MM/yyyy") : ""}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do Lote */}
      {selectedLote && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Quadra {selectedLote.quadra} - Lote {selectedLote.numero_lote}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reorganizarMutation.mutate(selectedLoteId)}
              disabled={reorganizarMutation.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", reorganizarMutation.isPending && "animate-spin")} />
              {reorganizarMutation.isPending ? "Reorganizando..." : "Reorganizar Saldos"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendedor - da configuração */}
            <div>
              <span className="font-semibold">Vendedor:</span>{" "}
              <span>
                {vendedorConfig?.nome_razao || "Não informado"}
                {vendedorConfig?.cpf_cnpj && ` (CNPJ ${vendedorConfig.cpf_cnpj})`}
              </span>
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
                  <h3 className="font-semibold text-lg mb-3">
                    {filtroAtivo 
                      ? `Movimentos do período (PARCELAMENTO) - ${movimentosParcelamento?.length || 0} registro(s)`
                      : "Últimos 12 movimentos (PARCELAMENTO):"}
                  </h3>
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
                              <TableCell>{formatDateDisplay(mov.data_mov)}</TableCell>
                              <TableCell>{formatHistorico(mov.descricao, mov.referencia)}</TableCell>
                              <TableCell>{formatDateDisplay(mov.vencimento)}</TableCell>
                              <TableCell className="text-right">{formatPercent(mov.percentual_calculo)}</TableCell>
                              <TableCell className="text-right">{mov.debito && mov.debito > 0 ? formatCurrency(mov.debito) : ""}</TableCell>
                              <TableCell className="text-right">{mov.credito && mov.credito > 0 ? formatCurrency(mov.credito) : ""}</TableCell>
                              <TableCell className="text-right">{formatCurrency(mov.saldo_calculado)}</TableCell>
                              <TableCell className="text-center">{(mov.saldo_calculado || 0) >= 0 ? "D" : "C"}</TableCell>
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
                  <h3 className="font-semibold text-lg mb-3">
                    {filtroAtivo 
                      ? `Movimentos do período (REFORÇOS) - ${movimentosReforco?.length || 0} registro(s)`
                      : "Últimos 12 movimentos (REFORÇOS):"}
                  </h3>
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
                              <TableCell>{formatDateDisplay(mov.data_mov)}</TableCell>
                              <TableCell>{formatHistorico(mov.descricao, mov.referencia)}</TableCell>
                              <TableCell>{formatDateDisplay(mov.vencimento)}</TableCell>
                              <TableCell className="text-right">{formatPercent(mov.percentual_calculo)}</TableCell>
                              <TableCell className="text-right">{mov.debito && mov.debito > 0 ? formatCurrency(mov.debito) : ""}</TableCell>
                              <TableCell className="text-right">{mov.credito && mov.credito > 0 ? formatCurrency(mov.credito) : ""}</TableCell>
                              <TableCell className="text-right">{formatCurrency(mov.saldo_calculado)}</TableCell>
                              <TableCell className="text-center">{(mov.saldo_calculado || 0) >= 0 ? "D" : "C"}</TableCell>
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
                    <span className="font-bold">{resumo.vencimentoProximaParcela ? formatDateDisplay(resumo.vencimentoProximaParcela) : "-"}</span>
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
                    <span className="font-bold">{resumo.vencimentoProximoReforco ? formatDateDisplay(resumo.vencimentoProximoReforco) : "-"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quadro de Parcelas em Atraso - com cálculo de juros e multa */}
            {tipoConta === "PARCELAMENTO" && resumoAtrasoParcelamento.parcelas.length > 0 && (
              <>
                <Separator />
                <ParcelasEmAtrasoTable
                  resumoAtraso={resumoAtrasoParcelamento}
                  tipoFluxo="PARCELAMENTO"
                  moraConfig={moraConfig}
                  pixConfig={pixConfig}
                  lote={selectedLote}
                  buildPixPayloadForParcela={buildPixPayloadForParcela}
                />
              </>
            )}

            {tipoConta === "REFORCO" && resumoAtrasoReforco.parcelas.length > 0 && (
              <>
                <Separator />
                <ParcelasEmAtrasoTable
                  resumoAtraso={resumoAtrasoReforco}
                  tipoFluxo="REFORCO"
                  moraConfig={moraConfig}
                  pixConfig={pixConfig}
                  lote={selectedLote}
                  buildPixPayloadForParcela={buildPixPayloadForParcela}
                />
              </>
            )}
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
                    <p className="mt-1">Vencimento: {pixDisplayData.vencimento ? formatDateDisplay(pixDisplayData.vencimento) : "-"}</p>
                  </div>
                </div>
              </>
            )}

            {/* Mensagem se PIX não configurado */}
            {(!pixConfig?.chave_pix || !pixConfig?.nome_beneficiario || !pixConfig?.cidade_beneficiario) && (
              <>
                <Separator />
                <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                  <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>QR Code PIX não disponível.</p>
                  <p className="mt-1">Configure a chave PIX e os dados do vendedor nas Configurações.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
