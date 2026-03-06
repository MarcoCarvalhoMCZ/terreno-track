import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoteSearchSelect } from "@/components/LoteSearchSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { RefreshCw, Database, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lote = Tables<"lotes">;
type TipoFluxo = "PARCELAMENTO" | "REFORCO";

interface ReorganizacaoResult {
  tipo_fluxo: string;
  registros_processados: number;
}

interface ReorganizacaoTodosResult {
  lote_id: string;
  tipo_fluxo: string;
  registros_processados: number;
}

export default function Reorganizacao() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [tipoFluxo, setTipoFluxo] = useState<TipoFluxo>("PARCELAMENTO");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showConfirmTodosDialog, setShowConfirmTodosDialog] = useState(false);
  const [lastResults, setLastResults] = useState<ReorganizacaoResult[] | null>(null);
  const [lastResultsTodos, setLastResultsTodos] = useState<ReorganizacaoTodosResult[] | null>(null);

  // Fetch lotes vendidos
  const { data: lotes, isLoading: loadingLotes } = useQuery({
    queryKey: ["lotes-reorganizacao"],
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

  // Mutation para reorganizar um lote específico (um fluxo)
  const reorganizarFluxoMutation = useMutation({
    mutationFn: async ({ loteId, tipoFluxo }: { loteId: string; tipoFluxo: string }) => {
      const { data, error } = await supabase.rpc("reorganizar_conta_corrente_fluxo", {
        p_lote_id: loteId,
        p_tipo_fluxo: tipoFluxo,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote"] });
      toast.success(`Reorganização concluída! ${count} registro(s) processado(s).`);
      setLastResults([{ tipo_fluxo: tipoFluxo, registros_processados: count }]);
    },
    onError: (error) => {
      toast.error("Erro ao reorganizar: " + error.message);
    },
  });

  // Mutation para reorganizar um lote completo (ambos fluxos)
  const reorganizarLoteMutation = useMutation({
    mutationFn: async (loteId: string) => {
      const { data, error } = await supabase.rpc("reorganizar_lote_completo", {
        p_lote_id: loteId,
      });
      if (error) throw error;
      return data as ReorganizacaoResult[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote"] });
      const total = data.reduce((acc, item) => acc + item.registros_processados, 0);
      toast.success(`Reorganização concluída! ${total} registro(s) processado(s).`);
      setLastResults(data);
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao reorganizar: " + error.message);
    },
  });

  // Mutation para reorganizar todos os lotes
  const reorganizarTodosMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reorganizar_todos_lotes");
      if (error) throw error;
      return data as ReorganizacaoTodosResult[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote"] });
      const total = data.reduce((acc, item) => acc + item.registros_processados, 0);
      toast.success(`Reorganização em lote concluída! ${total} registro(s) em ${data.length / 2} lote(s).`);
      setLastResultsTodos(data);
      setShowConfirmTodosDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao reorganizar todos: " + error.message);
    },
  });

  const handleReorganizarFluxo = () => {
    if (!selectedLoteId) {
      toast.error("Selecione um lote");
      return;
    }
    reorganizarFluxoMutation.mutate({ loteId: selectedLoteId, tipoFluxo });
  };

  const handleReorganizarLote = () => {
    if (!selectedLoteId) {
      toast.error("Selecione um lote");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleReorganizarTodos = () => {
    setShowConfirmTodosDialog(true);
  };

  const confirmReorganizarLote = () => {
    if (selectedLoteId) {
      reorganizarLoteMutation.mutate(selectedLoteId);
    }
  };

  const confirmReorganizarTodos = () => {
    reorganizarTodosMutation.mutate();
  };

  const selectedLote = lotes?.find((l) => l.id === selectedLoteId);

  const isProcessing =
    reorganizarFluxoMutation.isPending ||
    reorganizarLoteMutation.isPending ||
    reorganizarTodosMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reorganização</h1>
        <p className="text-muted-foreground">
          Recalcular saldos e reconstruir tabelas auxiliares a partir da Conta Corrente do Lote
        </p>
      </div>

      {/* Informativo */}
      <Alert className="border-primary/50 bg-primary/5">
        <Database className="h-4 w-4" />
        <AlertDescription>
          A reorganização recalcula sequencialmente todos os saldos da Conta Corrente do Lote,
          garantindo consistência entre débitos, créditos e saldos acumulados.
          <strong className="block mt-2">
            A Conta Corrente é a fonte da verdade (single source of truth).
          </strong>
        </AlertDescription>
      </Alert>

      {/* Tabs para Parcelamento e Reforços */}
      <Tabs value={tipoFluxo} onValueChange={(v) => setTipoFluxo(v as TipoFluxo)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="PARCELAMENTO">Parcelamento</TabsTrigger>
          <TabsTrigger value="REFORCO">Reforços</TabsTrigger>
        </TabsList>

        <TabsContent value="PARCELAMENTO" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Reorganização Individual - Parcelamento
              </CardTitle>
              <CardDescription>
                Selecione um lote para reorganizar apenas a conta de Parcelamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label htmlFor="lote">Lote</Label>
                  <LoteSearchSelect
                    lotes={lotes}
                    value={selectedLoteId}
                    onValueChange={setSelectedLoteId}
                    placeholder="Selecione um lote"
                  />
                </div>

                {canEdit && (
                  <>
                    <Button
                      onClick={handleReorganizarFluxo}
                      disabled={!selectedLoteId || isProcessing}
                    >
                      {reorganizarFluxoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reorganizar Parcelamento
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleReorganizarLote}
                      disabled={!selectedLoteId || isProcessing}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reorganizar Ambos
                    </Button>
                  </>
                )}
              </div>

              {selectedLote && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Lote selecionado: <strong>Quadra {selectedLote.quadra} - Lote {selectedLote.numero_lote}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="REFORCO" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Reorganização Individual - Reforços
              </CardTitle>
              <CardDescription>
                Selecione um lote para reorganizar apenas a conta de Reforços
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label htmlFor="lote">Lote</Label>
                  <LoteSearchSelect
                    lotes={lotes}
                    value={selectedLoteId}
                    onValueChange={setSelectedLoteId}
                    placeholder="Selecione um lote"
                  />
                </div>

                {canEdit && (
                  <>
                    <Button
                      onClick={handleReorganizarFluxo}
                      disabled={!selectedLoteId || isProcessing}
                    >
                      {reorganizarFluxoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reorganizar Reforços
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleReorganizarLote}
                      disabled={!selectedLoteId || isProcessing}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reorganizar Ambos
                    </Button>
                  </>
                )}
              </div>

              {selectedLote && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Lote selecionado: <strong>Quadra {selectedLote.quadra} - Lote {selectedLote.numero_lote}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resultados da última reorganização individual */}
      {lastResults && lastResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Última Reorganização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TIPO FLUXO</TableHead>
                  <TableHead className="text-right">REGISTROS PROCESSADOS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastResults.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={item.tipo_fluxo === "PARCELAMENTO" ? "default" : "secondary"}>
                        {item.tipo_fluxo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.registros_processados}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reorganização em Lote (Todos) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Reorganização em Lote
          </CardTitle>
          <CardDescription>
            Reorganiza TODOS os lotes vendidos de uma só vez (ambos os fluxos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Esta operação pode demorar dependendo da quantidade de lotes e movimentos.
              Recomendado apenas quando necessário reconstruir toda a base.
            </AlertDescription>
          </Alert>

          {canEdit && (
            <Button
              variant="destructive"
              onClick={handleReorganizarTodos}
              disabled={isProcessing}
            >
              {reorganizarTodosMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reorganizar Todos os Lotes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Resultados da reorganização em lote */}
      {lastResultsTodos && lastResultsTodos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Resultado da Reorganização em Lote
            </CardTitle>
            <CardDescription>
              {lastResultsTodos.length / 2} lote(s) processado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LOTE</TableHead>
                    <TableHead>TIPO FLUXO</TableHead>
                    <TableHead className="text-right">REGISTROS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastResultsTodos.map((item, idx) => {
                    const lote = lotes?.find((l) => l.id === item.lote_id);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {lote ? `Q${lote.quadra} L${lote.numero_lote}` : item.lote_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.tipo_fluxo === "PARCELAMENTO" ? "default" : "secondary"}>
                            {item.tipo_fluxo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.registros_processados}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmação - Lote individual */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reorganização</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reorganizar AMBOS os fluxos (Parcelamento e Reforços) do lote{" "}
              <strong>Q{selectedLote?.quadra} L{selectedLote?.numero_lote}</strong>?
              <br /><br />
              Esta ação irá recalcular todos os saldos sequencialmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReorganizarLote}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação - Todos os lotes */}
      <AlertDialog open={showConfirmTodosDialog} onOpenChange={setShowConfirmTodosDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reorganização em Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reorganizar TODOS os {lotes?.length || 0} lotes vendidos?
              <br /><br />
              Esta operação irá recalcular todos os saldos de Parcelamento e Reforços de cada lote.
              Pode demorar alguns minutos dependendo do volume de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReorganizarTodos} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Reorganização Total
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
