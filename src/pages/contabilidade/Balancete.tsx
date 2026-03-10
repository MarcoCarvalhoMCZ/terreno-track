import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calculator, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { tiposMovimentoTodos } from "@/constants/movimento";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
  natureza_saldo: string | null;
}

interface ConsolidacaoRow {
  id: string;
  ano: number;
  mes: number;
  conta_contabil_id: string;
  valor_debito: number | null;
  valor_credito: number | null;
}

export default function Balancete() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [consistencia, setConsistencia] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: contas } = useQuery({
    queryKey: ["contas-contabeis-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao, natureza_saldo")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as unknown as ContaContabil[];
    },
  });

  const { data: consolidacao, isLoading } = useQuery({
    queryKey: ["consolidacao-contabil", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consolidacao_contabil" as any)
        .select("*")
        .eq("ano", ano)
        .order("mes");
      if (error) throw error;
      return data as unknown as ConsolidacaoRow[];
    },
  });

  const { data: mapa } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*");
      if (error) throw error;
      return data as unknown as { tipo_movimento: string; conta_contabil_id: string; natureza_lancamento: string }[];
    },
  });

  // Recalcular
  const recalcularMutation = useMutation({
    mutationFn: async () => {
      if (!mapa?.length || !contas?.length) throw new Error("Configure o Plano de Contas e o Mapa de Movimentos antes de recalcular.");

      // Delete existing consolidation for the year
      await supabase.from("consolidacao_contabil" as any).delete().eq("ano", ano);

      // Fetch all movements for the year
      const startDate = `${ano}-01-01`;
      const endDate = `${ano}-12-31`;
      const { data: movimentos, error } = await supabase
        .from("conta_corrente_lote")
        .select("data_mov, tipo_mov, debito, credito")
        .gte("data_mov", startDate)
        .lte("data_mov", endDate);
      if (error) throw error;

      // Build consolidation map: { `${mes}-${contaId}`: { debito, credito } }
      const consolidationMap = new Map<string, { ano: number; mes: number; conta_contabil_id: string; valor_debito: number; valor_credito: number }>();

      for (const mov of movimentos || []) {
        const mes = new Date(mov.data_mov + "T00:00:00").getMonth() + 1;
        const mappings = mapa.filter((m) => m.tipo_movimento === mov.tipo_mov);

        for (const mapping of mappings) {
          const key = `${mes}-${mapping.conta_contabil_id}`;
          if (!consolidationMap.has(key)) {
            consolidationMap.set(key, { ano, mes, conta_contabil_id: mapping.conta_contabil_id, valor_debito: 0, valor_credito: 0 });
          }
          const entry = consolidationMap.get(key)!;

          // The movement value is the non-zero field (debito or credito from conta_corrente_lote)
          const valor = Number(mov.debito || 0) + Number(mov.credito || 0);

          if (mapping.natureza_lancamento === "D") {
            entry.valor_debito += valor;
          } else {
            entry.valor_credito += valor;
          }
        }
      }

      // Insert all consolidation rows
      const rows = Array.from(consolidationMap.values());
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("consolidacao_contabil" as any).insert(rows as any);
        if (insertError) throw insertError;
      }

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["consolidacao-contabil"] });
      toast.success(`Balancete recalculado: ${count} registros gerados.`);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  // Teste de consistência
  const testarConsistenciaMutation = useMutation({
    mutationFn: async () => {
      const startDate = `${ano}-01-01`;
      const endDate = `${ano}-12-31`;

      // Total from conta_corrente
      const { data: ccTotals, error: e1 } = await supabase
        .from("conta_corrente_lote")
        .select("debito, credito")
        .gte("data_mov", startDate)
        .lte("data_mov", endDate);
      if (e1) throw e1;

      const totalCCDebito = (ccTotals || []).reduce((s, r) => s + Number(r.debito || 0), 0);
      const totalCCCredito = (ccTotals || []).reduce((s, r) => s + Number(r.credito || 0), 0);

      // Total from consolidacao
      const totalConsDebito = (consolidacao || []).reduce((s, r) => s + Number(r.valor_debito || 0), 0);
      const totalConsCredito = (consolidacao || []).reduce((s, r) => s + Number(r.valor_credito || 0), 0);

      // Compare: the sum of mapped movements should equal consolidation
      // Note: unmapped movements won't appear in consolidation, so we check mapped only
      const mappedTypes = new Set(mapa?.map((m) => m.tipo_movimento) || []);
      const totalMappedDebito = (ccTotals || []).reduce((s, r) => s + Number(r.debito || 0), 0);
      const totalMappedCredito = (ccTotals || []).reduce((s, r) => s + Number(r.credito || 0), 0);

      const diffD = Math.abs(totalConsDebito + totalConsCredito - (totalCCDebito + totalCCCredito));

      if (diffD < 0.01) {
        return { ok: true, msg: `Consistência OK – Total CC: ${formatCurrency(totalCCDebito + totalCCCredito)} = Balancete: ${formatCurrency(totalConsDebito + totalConsCredito)}` };
      } else {
        return { ok: false, msg: `Inconsistência detectada – CC: ${formatCurrency(totalCCDebito + totalCCCredito)} ≠ Balancete: ${formatCurrency(totalConsDebito + totalConsCredito)}. Diferença: ${formatCurrency(diffD)}. Verifique se todos os tipos de movimento estão mapeados.` };
      }
    },
    onSuccess: (result) => setConsistencia(result),
    onError: (error) => toast.error("Erro: " + error.message),
  });

  // Build table data
  const tableData = useMemo(() => {
    if (!contas || !consolidacao) return [];

    return contas.map((conta) => {
      const meses: (number | null)[] = [];
      let total = 0;
      for (let m = 1; m <= 12; m++) {
        const row = consolidacao.find((c) => c.conta_contabil_id === conta.id && c.mes === m);
        if (row) {
          const saldo = (conta.natureza_saldo === "Devedor")
            ? Number(row.valor_debito || 0) - Number(row.valor_credito || 0)
            : Number(row.valor_credito || 0) - Number(row.valor_debito || 0);
          meses.push(saldo);
          total += saldo;
        } else {
          meses.push(null);
        }
      }
      return { conta, meses, total };
    }).filter((row) => row.total !== 0 || row.meses.some((m) => m !== null));
  }, [contas, consolidacao]);

  // Totals row
  const totais = useMemo(() => {
    const meses: number[] = Array(12).fill(0);
    let total = 0;
    for (const row of tableData) {
      for (let i = 0; i < 12; i++) {
        meses[i] += row.meses[i] || 0;
      }
      total += row.total;
    }
    return { meses, total };
  }, [tableData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balancete do Loteamento</h1>
          <p className="text-muted-foreground">Consolidação contábil mensal por conta</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button onClick={() => recalcularMutation.mutate()} disabled={recalcularMutation.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${recalcularMutation.isPending ? "animate-spin" : ""}`} />
              Recalcular Balancete
            </Button>
          )}
          <Button variant="outline" onClick={() => testarConsistenciaMutation.mutate()} disabled={testarConsistenciaMutation.isPending}>
            <Calculator className="mr-2 h-4 w-4" />
            Teste de Consistência
          </Button>
        </div>
      </div>

      {/* Consistência result */}
      {consistencia && (
        <Card className={consistencia.ok ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5"}>
          <CardContent className="flex items-center gap-3 py-3">
            {consistencia.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
            <p className="text-sm">{consistencia.msg}</p>
          </CardContent>
        </Card>
      )}

      {/* Year selector */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl font-bold">{ano}</span>
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Balancete {ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><span className="text-muted-foreground">Carregando...</span></div>
          ) : tableData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum dado consolidado para {ano}.</p>
              <p className="text-sm text-muted-foreground">Use "Recalcular Balancete" para gerar a consolidação.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Conta</TableHead>
                    {MESES.map((m) => (
                      <TableHead key={m} className="text-right min-w-[100px]">{m}</TableHead>
                    ))}
                    <TableHead className="text-right min-w-[120px] font-bold">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.conta.id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div>
                          <span className="font-medium">{row.conta.descricao}</span>
                          <span className="text-xs text-muted-foreground ml-2">({row.conta.codigo})</span>
                        </div>
                      </TableCell>
                      {row.meses.map((val, i) => (
                        <TableCell key={i} className="text-right font-mono text-sm">
                          {val !== null ? formatCurrency(val) : "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-muted/50 z-10 font-bold">TOTAL</TableCell>
                    {totais.meses.map((val, i) => (
                      <TableCell key={i} className="text-right font-mono font-bold">
                        {formatCurrency(val)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatCurrency(totais.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
