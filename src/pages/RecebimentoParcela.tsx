import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useLotesConsulta, useVendaLote, useResumoLoteConsulta } from "@/hooks/useConsultaLote";
import { useMoraConfig, useUltimaAtualizacaoLote, useParcelasEmAtraso } from "@/hooks/useParcelasEmAtraso";
import type { ParcelaEmAtraso } from "@/hooks/useParcelasEmAtraso";
import { useAuth } from "@/contexts/AuthContext";
import type { ResumoLote } from "@/types/conta-corrente.types";

interface ParcelaCalculada {
  numero: number;
  totalParcelas: number;
  vencimento: Date;
  valorParcela: number;
  mesesAtraso: number;
  jurosPercentual: number;
  valorJuros: number;
  valorMulta: number;
  totalParcela: number;
  isVencida: boolean;
  tipoFluxo: "PARCELAMENTO" | "REFORCO";
}

const MODOS_PAGAMENTO = [
  { value: "PIX", label: "PIX" },
  { value: "TED", label: "TED" },
  { value: "DEPOSITO", label: "Depósito" },
  { value: "OUTRO", label: "Outro" },
];

export default function RecebimentoParcela() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();

  // Seleção de lote
  const [loteId, setLoteId] = useState("");
  const { data: lotes } = useLotesConsulta();
  const { data: venda } = useVendaLote(loteId);
  const { data: resumo } = useResumoLoteConsulta(loteId, venda);
  const { data: moraConfig } = useMoraConfig();
  const { data: ultimaAtualizacao } = useUltimaAtualizacaoLote(loteId || null);

  // Dialog de recebimento
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaCalculada | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [valorRecebido, setValorRecebido] = useState("");
  const [modoPagamento, setModoPagamento] = useState("");
  const [bancoOrigem, setBancoOrigem] = useState("");
  const [cpfCnpjPagador, setCpfCnpjPagador] = useState("");
  const [descricao, setDescricao] = useState("");

  // Lotes vendidos
  const lotesVendidos = useMemo(
    () => lotes?.filter((l) => l.status === "VENDIDO") || [],
    [lotes]
  );

  const loteSelecionado = useMemo(
    () => lotes?.find((l) => l.id === loteId),
    [lotes, loteId]
  );

  // Usar useParcelasEmAtraso para PARCELAMENTO e REFORÇO (mesma lógica da Consulta do Lote)
  const resumoAtrasoParcelamento = useParcelasEmAtraso(
    "PARCELAMENTO",
    venda,
    resumo,
    moraConfig,
    ultimaAtualizacao
  );

  const resumoAtrasoReforco = useParcelasEmAtraso(
    "REFORCO",
    venda,
    resumo,
    moraConfig,
    ultimaAtualizacao
  );

  // Combinar parcelas de ambos os fluxos em ParcelaCalculada[]
  const parcelasPendentes = useMemo(() => {
    const resultado: ParcelaCalculada[] = [];

    for (const p of resumoAtrasoParcelamento.parcelas) {
      resultado.push({ ...p, tipoFluxo: "PARCELAMENTO" });
    }

    for (const p of resumoAtrasoReforco.parcelas) {
      resultado.push({ ...p, tipoFluxo: "REFORCO" });
    }

    return resultado;
  }, [resumoAtrasoParcelamento, resumoAtrasoReforco]);

  // Histórico de recebimentos recentes
  const { data: recebimentos } = useQuery({
    queryKey: ["recebimentos-parcela", loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", loteId)
        .in("tipo_mov", ["PARCELA", "REFORCO"])
        .gt("credito", 0)
        .order("data_mov", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!loteId,
  });

  const abrirDialog = (parcela: ParcelaCalculada) => {
    setParcelaSelecionada(parcela);
    setValorRecebido(parcela.totalParcela.toFixed(2));
    setDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setModoPagamento("");
    setBancoOrigem("");
    setCpfCnpjPagador("");
    setDescricao("");
    setDialogOpen(true);
  };

  // Mutation para registrar recebimento
  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!parcelaSelecionada || !loteId || !venda) throw new Error("Dados inválidos");
      const valor = parseFloat(valorRecebido);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      const tipoLabel = parcelaSelecionada.tipoFluxo === "PARCELAMENTO" ? "Parcela" : "Reforço";
      const referencia = `${tipoLabel} ${parcelaSelecionada.numero} de ${parcelaSelecionada.totalParcelas}`;

      // 1) Insert the main payment (credit)
      const { error: errParcela } = await supabase
        .from("conta_corrente_lote")
        .insert({
          lote_id: loteId,
          venda_id: venda.id,
          data_mov: dataPagamento,
          tipo_mov: parcelaSelecionada.tipoFluxo === "PARCELAMENTO" ? "PARCELA" : "REFORCO",
          tipo_fluxo: parcelaSelecionada.tipoFluxo,
          descricao: descricao || `${tipoLabel} Recebida`,
          credito: parcelaSelecionada.valorParcela,
          debito: 0,
          referencia,
          vencimento: format(parcelaSelecionada.vencimento, "yyyy-MM-dd"),
          modo_pagamento: modoPagamento || null,
          banco_origem: bancoOrigem || null,
          cpf_cnpj_pagador: cpfCnpjPagador || null,
        });
      if (errParcela) throw errParcela;

      // 2) Insert interest if applicable
      if (parcelaSelecionada.valorJuros > 0) {
        const { error: errJuros } = await supabase
          .from("conta_corrente_lote")
          .insert({
            lote_id: loteId,
            venda_id: venda.id,
            data_mov: dataPagamento,
            tipo_mov: "JUROS_MORA",
            tipo_fluxo: parcelaSelecionada.tipoFluxo,
            descricao: `Juros ${parcelaSelecionada.jurosPercentual.toFixed(0)}%`,
            debito: parcelaSelecionada.valorJuros,
            credito: 0,
            referencia,
            percentual_calculo: parcelaSelecionada.jurosPercentual,
          });
        if (errJuros) throw errJuros;
      }

      // 3) Insert penalty if applicable
      if (parcelaSelecionada.valorMulta > 0) {
        const { error: errMulta } = await supabase
          .from("conta_corrente_lote")
          .insert({
            lote_id: loteId,
            venda_id: venda.id,
            data_mov: dataPagamento,
            tipo_mov: "MULTA_MORA",
            tipo_fluxo: parcelaSelecionada.tipoFluxo,
            descricao: `Multa ${moraConfig?.multa_mora_percentual || 2}%`,
            debito: parcelaSelecionada.valorMulta,
            credito: 0,
            referencia,
          });
        if (errMulta) throw errMulta;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos-parcela", loteId] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote-consulta", loteId] });
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["venda-lote", loteId] });
      toast.success("Recebimento registrado com sucesso!");
      setDialogOpen(false);
      setLoteId("");
    },
    onError: (error: any) => {
      toast.error("Erro ao registrar: " + error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recebimento de Parcela</h1>
          <p className="text-sm text-muted-foreground">Registre o recebimento de parcelas e reforços</p>
        </div>
      </div>

      {/* Seleção de Lote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label>Lote *</Label>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o lote" />
              </SelectTrigger>
              <SelectContent>
                {lotesVendidos.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    Quadra {l.quadra} - Lote {l.numero_lote}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loteId && venda && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Comprador:</span>{" "}
                <span className="font-medium">{(venda as any).comprador?.nome_razao || venda.comprador_nome_1}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Venda:</span>{" "}
                <span className="font-medium">{formatCurrency(venda.valor_venda)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Data Venda:</span>{" "}
                <span className="font-medium">{format(new Date(venda.data_venda), "dd/MM/yyyy")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parcelas Pendentes */}
      {loteId && parcelasPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Parcelas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Juros</TableHead>
                    <TableHead className="text-right">Multa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelasPendentes.map((p, idx) => (
                    <TableRow
                      key={idx}
                      className={p.isVencida ? "bg-destructive/5" : "bg-primary/5"}
                    >
                      <TableCell>
                        <Badge variant={p.tipoFluxo === "PARCELAMENTO" ? "default" : "secondary"}>
                          {p.tipoFluxo === "PARCELAMENTO" ? "Parcela" : "Reforço"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.numero} de {p.totalParcelas}
                      </TableCell>
                      <TableCell className={p.isVencida ? "text-destructive font-medium" : ""}>
                        {format(p.vencimento, "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(p.valorParcela)}</TableCell>
                      <TableCell className="text-right">
                        {p.valorJuros > 0 ? formatCurrency(p.valorJuros) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.valorMulta > 0 ? formatCurrency(p.valorMulta) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(p.totalParcela)}
                      </TableCell>
                      <TableCell>
                        {p.isVencida ? (
                          <Badge variant="destructive">Vencida</Badge>
                        ) : (
                          <Badge variant="outline">A Vencer</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button size="sm" onClick={() => abrirDialog(p)}>
                            Receber
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {loteId && parcelasPendentes.length === 0 && resumo && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">Nenhuma parcela pendente</p>
            <p className="text-muted-foreground">Todas as parcelas deste lote estão em dia.</p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Recebimentos */}
      {loteId && recebimentos && recebimentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Recebimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recebimentos.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.data_mov), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{r.referencia}</TableCell>
                      <TableCell>{r.descricao}</TableCell>
                      <TableCell>
                        {r.modo_pagamento && (
                          <Badge variant="outline">{r.modo_pagamento}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.credito || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Recebimento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>
          {parcelaSelecionada && (
            <div className="space-y-4">
              {/* Resumo da parcela */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {parcelaSelecionada.tipoFluxo === "PARCELAMENTO" ? "Parcela" : "Reforço"}{" "}
                    {parcelaSelecionada.numero} de {parcelaSelecionada.totalParcelas}
                  </span>
                  <span>Venc: {format(parcelaSelecionada.vencimento, "dd/MM/yyyy")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Valor da parcela:</span>
                  <span>{formatCurrency(parcelaSelecionada.valorParcela)}</span>
                </div>
                {parcelaSelecionada.valorJuros > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Juros ({parcelaSelecionada.jurosPercentual.toFixed(0)}%):</span>
                    <span>{formatCurrency(parcelaSelecionada.valorJuros)}</span>
                  </div>
                )}
                {parcelaSelecionada.valorMulta > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Multa ({moraConfig?.multa_mora_percentual || 2}%):</span>
                    <span>{formatCurrency(parcelaSelecionada.valorMulta)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(parcelaSelecionada.totalParcela)}</span>
                </div>
              </div>

              {/* Form */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Pagamento *</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Valor Recebido *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Modo de Pagamento</Label>
                  <Select value={modoPagamento} onValueChange={setModoPagamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODOS_PAGAMENTO.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Banco de Origem</Label>
                  <Input
                    value={bancoOrigem}
                    onChange={(e) => setBancoOrigem(e.target.value)}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>
              </div>

              <div>
                <Label>CPF/CNPJ de quem pagou</Label>
                <Input
                  value={cpfCnpjPagador}
                  onChange={(e) => setCpfCnpjPagador(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Observações do recebimento"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => registrarMutation.mutate()}
              disabled={registrarMutation.isPending || registrarMutation.isSuccess}
            >
              {registrarMutation.isPending ? "Registrando..." : registrarMutation.isSuccess ? "Registrado ✓" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
