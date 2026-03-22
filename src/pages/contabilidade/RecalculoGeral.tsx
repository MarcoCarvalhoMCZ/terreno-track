import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Calculator, CheckCircle2, AlertTriangle, ListChecks, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { regenerarTodasParcelasAbertas } from "@/lib/parcelas-abertas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ResultadoRecalculo {
  totalRegistros: number;
  periodoInicio: string;
  periodoFim: string;
  mesesProcessados: number;
}

export default function RecalculoGeral() {
  const { canEdit } = useAuth();
  const [resultado, setResultado] = useState<ResultadoRecalculo | null>(null);
  const [qtdParcelasGeradas, setQtdParcelasGeradas] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressValue, setProgressValue] = useState(0);

  const popularParcelasMutation = useMutation({
    mutationFn: () => {
      setProgressLabel("Regenerando parcelas abertas...");
      setProgressValue(50);
      return regenerarTodasParcelasAbertas();
    },
    onSuccess: (count) => {
      setQtdParcelasGeradas(count);
      setProgressLabel("");
      setProgressValue(0);
      toast.success(`${count} parcela(s) aberta(s) gerada(s) com sucesso!`);
    },
    onError: (error) => {
      setProgressLabel("");
      setProgressValue(0);
      toast.error("Erro: " + error.message);
    },
  });

  const { data: mapa } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const recalcularMutation = useMutation({
    mutationFn: async (): Promise<ResultadoRecalculo> => {
      if (!mapa?.length) throw new Error("Configure o Mapa de Movimentos antes de recalcular.");

      setProgressLabel("Lendo movimentos da Conta Corrente...");
      setProgressValue(10);
      const pageSize = 1000;
      let allMovimentos: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("conta_corrente_lote")
          .select("data_mov, tipo_mov, debito, credito")
          .order("data_mov")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allMovimentos = allMovimentos.concat(data || []);
        hasMore = data != null && data.length === pageSize;
        from += pageSize;
      }

      if (allMovimentos.length === 0) throw new Error("Nenhum movimento encontrado na Conta Corrente.");

      setProgressLabel(`Processando ${allMovimentos.length} movimentos...`);
      setProgressValue(30);

      // Build consolidation map using conta_debito_id / conta_credito_id
      const consolidationMap = new Map<string, { ano: number; mes: number; conta_contabil_id: string; valor_debito: number; valor_credito: number }>();

      for (const mov of allMovimentos) {
        const dt = new Date(mov.data_mov + "T00:00:00");
        const ano = dt.getFullYear();
        const mes = dt.getMonth() + 1;
        const mappings = mapa.filter((m) => m.tipo_movimento === mov.tipo_mov);
        const valor = Number(mov.debito || 0) + Number(mov.credito || 0);

        for (const mapping of mappings) {
          // Lançamento a débito
          if (mapping.conta_debito_id) {
            const keyD = `${ano}-${mes}-${mapping.conta_debito_id}`;
            if (!consolidationMap.has(keyD)) {
              consolidationMap.set(keyD, { ano, mes, conta_contabil_id: mapping.conta_debito_id, valor_debito: 0, valor_credito: 0 });
            }
            consolidationMap.get(keyD)!.valor_debito += valor;
          }

          // Lançamento a crédito
          if (mapping.conta_credito_id) {
            const keyC = `${ano}-${mes}-${mapping.conta_credito_id}`;
            if (!consolidationMap.has(keyC)) {
              consolidationMap.set(keyC, { ano, mes, conta_contabil_id: mapping.conta_credito_id, valor_debito: 0, valor_credito: 0 });
            }
            consolidationMap.get(keyC)!.valor_credito += valor;
          }
        }
      }

      setProgressLabel("Apagando consolidação anterior...");
      setProgressValue(50);

      // Delete ALL existing consolidation
      const anos = new Set(Array.from(consolidationMap.values()).map(r => r.ano));
      const { data: existingYears } = await supabase
        .from("consolidacao_contabil" as any)
        .select("ano");
      if (existingYears) {
        for (const row of existingYears) {
          anos.add((row as any).ano);
        }
      }
      for (const a of anos) {
        await supabase.from("consolidacao_contabil" as any).delete().eq("ano", a);
      }

      setProgressLabel("Inserindo novos registros...");
      setProgressValue(70);

      // Insert new consolidation in batches (skip entries without conta_contabil_id)
      const rows = Array.from(consolidationMap.values()).filter(r => r.conta_contabil_id);
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from("consolidacao_contabil" as any).insert(batch as any);
        if (insertError) throw insertError;
        setProgressValue(70 + Math.round((i / rows.length) * 25));
      }

      setProgressLabel("Finalizando...");
      setProgressValue(95);

      const dates = allMovimentos.map(m => m.data_mov).sort();
      const mesesSet = new Set(rows.map(r => `${r.ano}-${r.mes}`));

      return {
        totalRegistros: rows.length,
        periodoInicio: dates[0],
        periodoFim: dates[dates.length - 1],
        mesesProcessados: mesesSet.size,
      };
    },
    onSuccess: (res) => {
      setResultado(res);
      setProgressLabel("");
      setProgressValue(0);
      toast.success(`Recálculo concluído: ${res.totalRegistros} registros gerados para ${res.mesesProcessados} meses.`);
    },
    onError: (error) => {
      setProgressLabel("");
      setProgressValue(0);
      toast.error("Erro: " + error.message);
    },
  });

  const formatDate = (d: string) => {
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  const isRunning = recalcularMutation.isPending || popularParcelasMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recálculo Geral</h1>
          <p className="text-muted-foreground">
            Reconstrói toda a consolidação contábil a partir dos movimentos da Conta Corrente
          </p>
        </div>
      </div>

      {/* Progress indicator */}
      {isRunning && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{progressLabel || "Processando..."}</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Recálculo Completo do Balancete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Este processo irá:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Ler <strong>todos</strong> os movimentos da Conta Corrente do Lote (do primeiro ao último)</li>
            <li>Apagar toda a consolidação contábil existente</li>
            <li>Recalcular e gerar o balancete mês a mês, para todos os anos</li>
            <li>Classificar os movimentos conforme o Mapa Movimento × Conta</li>
          </ul>

          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isRunning || !mapa?.length}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${recalcularMutation.isPending ? "animate-spin" : ""}`} />
                  {recalcularMutation.isPending ? "Recalculando..." : "Executar Recálculo Geral"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Recálculo Geral</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toda a consolidação contábil existente será apagada e reconstruída a partir dos movimentos da Conta Corrente. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => recalcularMutation.mutate()}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {!mapa?.length && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Configure o Mapa Movimento × Conta antes de executar o recálculo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Parcelas Abertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Regenerar Parcelas Abertas (Contas a Receber)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Recalcula e popula a tabela de Parcelas Abertas para todos os lotes com vendas ativas,
            usando o mesmo motor financeiro da Consulta de Lote.
          </p>
          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isRunning}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${popularParcelasMutation.isPending ? "animate-spin" : ""}`} />
                  {popularParcelasMutation.isPending ? "Populando..." : "Popular Parcelas Abertas"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Populamento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as parcelas abertas existentes serão recalculadas a partir dos movimentos da Conta Corrente. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => popularParcelasMutation.mutate()}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {qtdParcelasGeradas !== null && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {qtdParcelasGeradas} parcela(s) aberta(s) gerada(s) com sucesso.
            </p>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Resultado do Recálculo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="font-medium">{formatDate(resultado.periodoInicio)} a {formatDate(resultado.periodoFim)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meses Processados</p>
                <p className="font-medium">{resultado.mesesProcessados}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registros Gerados</p>
                <p className="font-medium">{resultado.totalRegistros}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
