import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, TrendingUp, AlertTriangle, CalendarCheck, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Lote = Tables<"lotes">;
type Venda = Tables<"vendas">;

interface SimulacaoResult {
  lote_id: string;
  venda_id: string;
  saldo_anterior: number;
  percentual_aplicado: number;
  valor_atualizacao: number;
  novo_saldo: number;
  lote?: Lote;
}

export default function AtualizacaoMonetaria() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loteIdRecalculo, setLoteIdRecalculo] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRecalculoDialog, setShowRecalculoDialog] = useState(false);
  const [simulacaoResults, setSimulacaoResults] = useState<SimulacaoResult[]>([]);

  // Fetch vendas ativas com lotes
  const { data: vendasAtivas, isLoading: loadingVendas } = useQuery({
    queryKey: ["vendas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(`
          *,
          lote:lotes(id, quadra, numero_lote, status)
        `)
        .eq("status", "ATIVA")
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data as (Venda & { lote: Lote })[];
    },
  });

  // Fetch lotes com vendas ativas
  const { data: lotes } = useQuery({
    queryKey: ["lotes-vendidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .eq("status", "VENDIDO")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as Lote[];
    },
  });

  // Fetch atualizações já realizadas no mês
  const { data: atualizacoesExistentes, isLoading: loadingAtualizacoes } = useQuery({
    queryKey: ["atualizacoes-mes", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select(`
          *,
          lote:lotes(id, quadra, numero_lote)
        `)
        .eq("tipo_mov", "ATUALIZACAO")
        .eq("referencia", competencia)
        .order("data_mov", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutation para simular atualização
  const simulacaoMutation = useMutation({
    mutationFn: async () => {
      const competenciaDate = `${competencia}-01`;
      const { data, error } = await supabase
        .rpc("calcular_atualizacao_monetaria_lote", {
          p_competencia: competenciaDate,
          p_lote_id: null
        });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Enriquecer com dados do lote
      const enrichedData: SimulacaoResult[] = [];
      for (const item of data || []) {
        const lote = lotes?.find(l => l.id === item.lote_id);
        enrichedData.push({
          ...item,
          lote,
        });
      }
      setSimulacaoResults(enrichedData);
      if (enrichedData.length === 0) {
        toast.info("Nenhum lote elegível para atualização nesta competência");
      }
    },
    onError: (error) => {
      toast.error("Erro ao simular atualização: " + error.message);
    },
  });

  // Mutation para executar atualização em lote
  const executarMutation = useMutation({
    mutationFn: async () => {
      const competenciaDate = `${competencia}-01`;
      const { data, error } = await supabase
        .rpc("executar_atualizacao_monetaria", {
          p_competencia: competenciaDate,
          p_lote_id: null
        });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["atualizacoes-mes"] });
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      setSimulacaoResults([]);
      setShowConfirmDialog(false);
      toast.success(`Atualização monetária executada para ${count} lote(s)!`);
    },
    onError: (error) => {
      toast.error("Erro ao executar atualização: " + error.message);
    },
  });

  // Mutation para recalcular individualmente
  const recalcularMutation = useMutation({
    mutationFn: async (loteId: string) => {
      const competenciaDate = `${competencia}-01`;
      const { data, error } = await supabase
        .rpc("executar_atualizacao_monetaria", {
          p_competencia: competenciaDate,
          p_lote_id: loteId
        });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atualizacoes-mes"] });
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      setShowRecalculoDialog(false);
      setLoteIdRecalculo("");
      toast.success("Recálculo executado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao recalcular: " + error.message);
    },
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(4)}%`;
  };

  const formatCompetencia = (comp: string | null | undefined) => {
    if (!comp || !comp.includes("-")) return "-";
    const [year, month] = comp.split("-");
    if (!year || !month || isNaN(Number(year)) || isNaN(Number(month))) return "-";
    const date = new Date(Number(year), Number(month) - 1, 1);
    return format(date, "MMMM/yyyy", { locale: ptBR });
  };

  // Calcula a data de registro (primeiro dia do mês seguinte à competência)
  const getDataRegistro = () => {
    if (!competencia || !competencia.includes("-")) return null;
    const [year, month] = competencia.split("-").map(Number);
    if (isNaN(year) || isNaN(month)) return null;
    // Primeiro dia do mês seguinte
    const dataRegistro = new Date(year, month, 1); // month já é 0-indexed, então month = próximo mês
    return dataRegistro;
  };

  const dataRegistro = getDataRegistro();
  const dataRegistroFormatada = dataRegistro 
    ? format(dataRegistro, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const handleSimular = () => {
    simulacaoMutation.mutate();
  };

  const handleExecutar = () => {
    if (simulacaoResults.length > 0) {
      setShowConfirmDialog(true);
    } else {
      toast.warning("Execute a simulação primeiro para ver os lotes elegíveis");
    }
  };

  const handleRecalculo = (loteId: string) => {
    setLoteIdRecalculo(loteId);
    setShowRecalculoDialog(true);
  };

  const confirmRecalculo = () => {
    if (loteIdRecalculo) {
      recalcularMutation.mutate(loteIdRecalculo);
    }
  };

  const loteParaRecalculo = lotes?.find(l => l.id === loteIdRecalculo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Atualização Monetária</h1>
        <p className="text-muted-foreground">Cálculo e aplicação de atualização monetária sobre saldos devedores</p>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Parâmetros de Cálculo
          </CardTitle>
          <CardDescription>
            Selecione a competência e execute a simulação antes de confirmar a atualização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="competencia">Competência</Label>
              <Input
                id="competencia"
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="w-48"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSimular}
              disabled={simulacaoMutation.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Simular
            </Button>
            {canEdit && simulacaoResults.length > 0 && (
              <Button
                onClick={handleExecutar}
                disabled={executarMutation.isPending}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Executar Atualização
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultados da Simulação */}
      {simulacaoResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Simulação - {formatCompetencia(competencia)}
            </CardTitle>
            <CardDescription>
              {simulacaoResults.length} lote(s) elegível(is) para atualização
            </CardDescription>
            {dataRegistroFormatada && (
              <Alert className="mt-4 border-primary/50 bg-primary/5">
                <CalendarCheck className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <strong>Data de registro:</strong> Os lançamentos serão registrados em{" "}
                  <span className="font-semibold text-primary">{dataRegistroFormatada}</span>{" "}
                  (primeiro dia do mês seguinte à competência).
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LOTE</TableHead>
                    <TableHead className="text-right">SALDO ANTERIOR</TableHead>
                    <TableHead className="text-right">% APLICADO</TableHead>
                    <TableHead className="text-right">VALOR ATUALIZAÇÃO</TableHead>
                    <TableHead className="text-right">NOVO SALDO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulacaoResults.map((item) => (
                    <TableRow key={item.lote_id}>
                      <TableCell className="font-medium">
                        {item.lote ? `Q${item.lote.quadra} L${item.lote.numero_lote}` : item.lote_id}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.saldo_anterior)}</TableCell>
                      <TableCell className="text-right">{formatPercent(item.percentual_aplicado)}</TableCell>
                      <TableCell className="text-right text-success font-medium">
                        {formatCurrency(item.valor_atualizacao)}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(item.novo_saldo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atualizações já realizadas no mês */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Atualizações Realizadas - {formatCompetencia(competencia)}
          </CardTitle>
          <CardDescription>
            Atualizações monetárias já gravadas para esta competência
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAtualizacoes ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : atualizacoesExistentes && atualizacoesExistentes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LOTE</TableHead>
                    <TableHead>DATA</TableHead>
                    <TableHead className="text-right">% APLICADO</TableHead>
                    <TableHead className="text-right">VALOR</TableHead>
                    <TableHead className="text-right">SALDO</TableHead>
                    {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atualizacoesExistentes.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.lote ? `Q${item.lote.quadra} L${item.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>{format(new Date(item.data_mov), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right">{formatPercent(item.percentual_calculo)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.debito)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(item.saldo)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRecalculo(item.lote_id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Recalcular
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma atualização realizada para esta competência
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo de Vendas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas Ativas ({vendasAtivas?.length || 0})</CardTitle>
          <CardDescription>
            Lotes com vendas ativas que podem receber atualização monetária
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingVendas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : vendasAtivas && vendasAtivas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LOTE</TableHead>
                    <TableHead>DATA VENDA</TableHead>
                    <TableHead>TIPO ATUALIZAÇÃO</TableHead>
                    <TableHead>DEFASAGEM</TableHead>
                    <TableHead className="text-right">VALOR VENDA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasAtivas.map((venda: any) => (
                    <TableRow key={venda.id}>
                      <TableCell className="font-medium">
                        {venda.lote ? `Q${venda.lote.quadra} L${venda.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>{format(new Date(venda.data_venda), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {venda.tipo_atualizacao || "IGPM"}
                        </Badge>
                      </TableCell>
                      <TableCell>{venda.defasagem_indice || 1} mês(es)</TableCell>
                      <TableCell className="text-right">{formatCurrency(venda.valor_venda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda ativa encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para executar em lote */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Atualização Monetária
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a executar a atualização monetária para{" "}
                  <strong>{simulacaoResults.length} lote(s)</strong> na competência de{" "}
                  <strong>{formatCompetencia(competencia)}</strong>.
                </p>
                {dataRegistroFormatada && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
                    <Info className="h-4 w-4 mt-0.5 text-primary" />
                    <p className="text-sm">
                      <strong>Data de registro:</strong> {dataRegistroFormatada}
                    </p>
                  </div>
                )}
                <p>
                  Esta ação irá gerar lançamentos na conta corrente de cada lote.
                  Deseja continuar?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executarMutation.mutate()}
              disabled={executarMutation.isPending}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para recálculo individual */}
      <AlertDialog open={showRecalculoDialog} onOpenChange={setShowRecalculoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Confirmar Recálculo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a recalcular a atualização monetária do lote{" "}
              <strong>
                {loteParaRecalculo ? `Q${loteParaRecalculo.quadra} L${loteParaRecalculo.numero_lote}` : ""}
              </strong>{" "}
              para a competência de <strong>{formatCompetencia(competencia)}</strong>.
              <br /><br />
              O registro atual será excluído e um novo cálculo será realizado com base no saldo atualizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRecalculo}
              disabled={recalcularMutation.isPending}
            >
              Recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
