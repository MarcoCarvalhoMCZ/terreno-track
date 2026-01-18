import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format, subMonths, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Lote = Tables<"lotes">;
type Venda = Tables<"vendas">;
type ContaCorrenteLote = Tables<"conta_corrente_lote">;
type IndicadorValor = Tables<"indicadores_atualizacao_valores">;
type TipoFluxo = "PARCELAMENTO" | "REFORCO";

interface LoteCalculo {
  lote_id: string;
  quadra: string;
  numero_lote: string;
  tipo_atualizacao: string;
  defasagem: number;
  competencia_indice: string;
  indice_encontrado: number | null;
  saldo_anterior: number;
  valor_calculado: number;
  ja_atualizado: boolean;
  selecionado: boolean;
}

export default function AtualizacaoMonetaria() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  
  // Data de movimento padrão: primeiro dia do mês atual
  const [dataMovimento, setDataMovimento] = useState(() => {
    const now = new Date();
    return format(startOfMonth(now), "yyyy-MM-dd");
  });
  
  const [tiposFluxoSelecionados, setTiposFluxoSelecionados] = useState<TipoFluxo[]>(["PARCELAMENTO"]);
  const [lotesCalculo, setLotesCalculo] = useState<LoteCalculo[]>([]);
  const [calculoRealizado, setCalculoRealizado] = useState(false);

  // Referência do mês para verificar duplicidade (YYYY-MM)
  const referenciaMes = dataMovimento ? dataMovimento.substring(0, 7) : "";

  // Fetch vendas ativas com lotes
  const { data: vendasAtivas, isLoading: loadingVendas } = useQuery({
    queryKey: ["vendas-ativas-atualizacao"],
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

  // Fetch indicadores e seus valores
  const { data: indicadores } = useQuery({
    queryKey: ["indicadores-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao")
        .select(`
          *,
          valores:indicadores_atualizacao_valores(*)
        `)
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch movimentações de conta corrente
  const { data: movimentacoes } = useQuery({
    queryKey: ["conta-corrente-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ContaCorrenteLote[];
    },
  });

  // Buscar índice para um indicador e competência
  const buscarIndice = (tipoAtualizacao: string, competenciaIndice: string): number | null => {
    if (!indicadores) return null;
    
    const indicador = indicadores.find(
      (ind) => ind.nome.toUpperCase() === tipoAtualizacao.toUpperCase()
    );
    
    if (!indicador || !indicador.valores) return null;
    
    const valor = (indicador.valores as IndicadorValor[]).find(
      (v) => v.competencia.substring(0, 7) === competenciaIndice
    );
    
    return valor ? Number(valor.fator) : null;
  };

  // Calcular saldo anterior por lote e tipo_fluxo
  const calcularSaldoAnterior = (loteId: string, tipoFluxo: TipoFluxo, dataLimite: string): number => {
    if (!movimentacoes) return 0;
    
    const movsLote = movimentacoes.filter(
      (m) => m.lote_id === loteId && m.tipo_fluxo === tipoFluxo && m.data_mov < dataLimite
    );
    
    return movsLote.reduce((acc, mov) => {
      return acc + (mov.debito || 0) - (mov.credito || 0);
    }, 0);
  };

  // Verificar se já existe atualização no mês
  const verificarDuplicidade = (loteId: string, tipoFluxo: TipoFluxo, referencia: string): boolean => {
    if (!movimentacoes) return false;
    
    return movimentacoes.some(
      (m) => 
        m.lote_id === loteId && 
        m.tipo_fluxo === tipoFluxo && 
        m.tipo_mov === "ATUALIZACAO" &&
        m.referencia === referencia
    );
  };

  // Executar cálculo para todos os lotes
  const handleCalcular = () => {
    if (!vendasAtivas || !dataMovimento) {
      toast.error("Selecione uma data de movimento");
      return;
    }

    if (tiposFluxoSelecionados.length === 0) {
      toast.error("Selecione pelo menos um tipo de conta");
      return;
    }

    const dataMov = parse(dataMovimento, "yyyy-MM-dd", new Date());
    const resultados: LoteCalculo[] = [];

    for (const tipoFluxo of tiposFluxoSelecionados) {
      for (const venda of vendasAtivas) {
        if (!venda.lote) continue;
        
        // Calcular competência do índice (data_mov - defasagem meses)
        const defasagem = venda.defasagem_indice || 1;
        const competenciaDate = subMonths(dataMov, defasagem);
        const competenciaIndice = format(competenciaDate, "yyyy-MM");
        
        // Buscar índice
        const tipoAtualizacao = venda.tipo_atualizacao || "IGPM";
        const indice = buscarIndice(tipoAtualizacao, competenciaIndice);
        
        // Calcular saldo anterior
        const saldoAnterior = calcularSaldoAnterior(venda.lote_id, tipoFluxo, dataMovimento);
        
        // Verificar duplicidade
        const jaAtualizado = verificarDuplicidade(venda.lote_id, tipoFluxo, referenciaMes);
        
        // Calcular valor da atualização
        const valorCalculado = indice !== null && saldoAnterior > 0
          ? Math.round(saldoAnterior * (indice / 100) * 100) / 100
          : 0;

        // Só adiciona se houver saldo positivo
        if (saldoAnterior > 0) {
          resultados.push({
            lote_id: venda.lote_id,
            quadra: venda.lote.quadra,
            numero_lote: venda.lote.numero_lote,
            tipo_atualizacao: tipoAtualizacao,
            defasagem,
            competencia_indice: competenciaIndice,
            indice_encontrado: indice,
            saldo_anterior: saldoAnterior,
            valor_calculado: valorCalculado,
            ja_atualizado: jaAtualizado,
            selecionado: !jaAtualizado && valorCalculado !== 0,
          });
        }
      }
    }

    // Ordenar por quadra e lote
    resultados.sort((a, b) => {
      const quadraCompare = a.quadra.localeCompare(b.quadra);
      if (quadraCompare !== 0) return quadraCompare;
      return a.numero_lote.localeCompare(b.numero_lote);
    });

    setLotesCalculo(resultados);
    setCalculoRealizado(true);

    if (resultados.length === 0) {
      toast.info("Nenhum lote com saldo devedor encontrado");
    }
  };

  // Toggle seleção de um lote
  const toggleSelecao = (loteId: string) => {
    setLotesCalculo((prev) =>
      prev.map((lote) =>
        lote.lote_id === loteId && !lote.ja_atualizado
          ? { ...lote, selecionado: !lote.selecionado }
          : lote
      )
    );
  };

  // Selecionar/Desselecionar todos
  const toggleTodos = (selecionar: boolean) => {
    setLotesCalculo((prev) =>
      prev.map((lote) =>
        !lote.ja_atualizado && lote.valor_calculado !== 0
          ? { ...lote, selecionado: selecionar }
          : lote
      )
    );
  };

  // Mutation para executar atualização
  const executarMutation = useMutation({
    mutationFn: async () => {
      const lotesSelecionados = lotesCalculo.filter((l) => l.selecionado && !l.ja_atualizado);
      
      if (lotesSelecionados.length === 0) {
        throw new Error("Nenhum lote selecionado");
      }

      const lancamentos = [];
      
      for (const tipoFluxo of tiposFluxoSelecionados) {
        for (const lote of lotesSelecionados) {
          // Recalcular saldo para ter o valor mais atualizado
          const saldoAnterior = calcularSaldoAnterior(lote.lote_id, tipoFluxo, dataMovimento);
          const valorAtual = lote.indice_encontrado !== null && saldoAnterior > 0
            ? Math.round(saldoAnterior * (lote.indice_encontrado / 100) * 100) / 100
            : 0;
          
          if (valorAtual === 0) continue;

          // Determinar natureza (débito ou crédito)
          const isNegativo = lote.indice_encontrado !== null && lote.indice_encontrado < 0;
          const valorAbs = Math.abs(valorAtual);
          
          // Novo saldo após atualização
          const novoSaldo = saldoAnterior + valorAtual;

          lancamentos.push({
            lote_id: lote.lote_id,
            tipo_fluxo: tipoFluxo,
            tipo_mov: "ATUALIZACAO",
            data_mov: dataMovimento,
            descricao: `Atualização Monetária Q${lote.quadra} Lt${lote.numero_lote}`,
            percentual_calculo: lote.indice_encontrado,
            debito: isNegativo ? 0 : valorAbs,
            credito: isNegativo ? valorAbs : 0,
            saldo: novoSaldo,
            referencia: referenciaMes,
          });
        }
      }

      if (lancamentos.length === 0) {
        throw new Error("Nenhum lançamento a ser gerado");
      }

      const { error } = await supabase.from("conta_corrente_lote").insert(lancamentos);
      if (error) throw error;

      return lancamentos.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-atualizacao"] });
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      toast.success(`${count} lançamento(s) de atualização monetária gerado(s) com sucesso!`);
      
      // Recalcular para atualizar status de duplicidade
      handleCalcular();
    },
    onError: (error) => {
      toast.error("Erro ao executar atualização: " + error.message);
    },
  });

  const handleExecutar = () => {
    const selecionados = lotesCalculo.filter((l) => l.selecionado && !l.ja_atualizado);
    if (selecionados.length === 0) {
      toast.warning("Selecione pelo menos um lote para atualizar");
      return;
    }
    executarMutation.mutate();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(2)}%`;
  };

  const lotesParaAtualizar = lotesCalculo.filter((l) => l.selecionado && !l.ja_atualizado);
  const totalSelecionados = lotesParaAtualizar.length;
  const totalValor = lotesParaAtualizar.reduce((acc, l) => acc + l.valor_calculado, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Atualização Monetária em Lote</h1>
        <p className="text-muted-foreground">
          Calcular e aplicar atualização monetária para todos os lotes com vendas ativas
        </p>
      </div>

      {/* Parâmetros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Parâmetros de Cálculo
          </CardTitle>
          <CardDescription>
            Selecione a data de movimento e os tipos de conta a serem atualizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-2">
              <Label htmlFor="data_mov">Data Movimento</Label>
              <Input
                id="data_mov"
                type="date"
                value={dataMovimento}
                onChange={(e) => {
                  setDataMovimento(e.target.value);
                  setCalculoRealizado(false);
                  setLotesCalculo([]);
                }}
                className="w-48"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tipo de Conta</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="parcelamento"
                    checked={tiposFluxoSelecionados.includes("PARCELAMENTO")}
                    onCheckedChange={(checked) => {
                      setTiposFluxoSelecionados((prev) =>
                        checked
                          ? [...prev, "PARCELAMENTO"]
                          : prev.filter((t) => t !== "PARCELAMENTO")
                      );
                      setCalculoRealizado(false);
                      setLotesCalculo([]);
                    }}
                  />
                  <Label htmlFor="parcelamento" className="font-normal cursor-pointer">
                    Parcelamento
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reforco"
                    checked={tiposFluxoSelecionados.includes("REFORCO")}
                    onCheckedChange={(checked) => {
                      setTiposFluxoSelecionados((prev) =>
                        checked
                          ? [...prev, "REFORCO"]
                          : prev.filter((t) => t !== "REFORCO")
                      );
                      setCalculoRealizado(false);
                      setLotesCalculo([]);
                    }}
                  />
                  <Label htmlFor="reforco" className="font-normal cursor-pointer">
                    Reforço
                  </Label>
                </div>
              </div>
            </div>

            <Button onClick={handleCalcular} disabled={loadingVendas}>
              <Calculator className="h-4 w-4 mr-2" />
              Calcular
            </Button>
          </div>

          {referenciaMes && (
            <Alert>
              <AlertDescription>
                Referência: <strong>{referenciaMes}</strong> — Os lançamentos serão gravados com esta referência para evitar duplicidade.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {calculoRealizado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Lotes para Atualização
                </CardTitle>
                <CardDescription>
                  {lotesCalculo.length} lote(s) com saldo devedor encontrado(s)
                </CardDescription>
              </div>
              {lotesCalculo.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTodos(true)}
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTodos(false)}
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {lotesCalculo.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>LOTE</TableHead>
                        <TableHead>TIPO ATUALIZAÇÃO</TableHead>
                        <TableHead className="text-center">DEFASAGEM</TableHead>
                        <TableHead>ÍNDICE (COMPET.)</TableHead>
                        <TableHead className="text-right">SALDO ANTERIOR</TableHead>
                        <TableHead className="text-right">VALOR CALCULADO</TableHead>
                        <TableHead className="text-center">STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotesCalculo.map((lote) => (
                        <TableRow
                          key={lote.lote_id}
                          className={lote.ja_atualizado ? "opacity-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={lote.selecionado}
                              disabled={lote.ja_atualizado || lote.valor_calculado === 0}
                              onCheckedChange={() => toggleSelecao(lote.lote_id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            Quadra {lote.quadra} - Lote {lote.numero_lote}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lote.tipo_atualizacao}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{lote.defasagem} mês(es)</TableCell>
                          <TableCell>
                            {lote.indice_encontrado !== null ? (
                              <span className={lote.indice_encontrado < 0 ? "text-destructive" : "text-success"}>
                                {formatPercent(lote.indice_encontrado)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Não encontrado</span>
                            )}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({lote.competencia_indice})
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(lote.saldo_anterior)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${lote.valor_calculado < 0 ? "text-destructive" : "text-success"}`}>
                            {formatCurrency(lote.valor_calculado)}
                          </TableCell>
                          <TableCell className="text-center">
                            {lote.ja_atualizado ? (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Já atualizado
                              </Badge>
                            ) : lote.indice_encontrado === null ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Sem índice
                              </Badge>
                            ) : (
                              <Badge variant="default" className="gap-1">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumo e Botão Executar */}
                {totalSelecionados > 0 && canEdit && (
                  <div className="mt-6 flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">
                        {totalSelecionados} lote(s) selecionado(s)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: {formatCurrency(totalValor)}
                      </p>
                    </div>
                    <Button
                      onClick={handleExecutar}
                      disabled={executarMutation.isPending}
                      size="lg"
                    >
                      {executarMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Executar Atualização
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lote com saldo devedor encontrado para os parâmetros selecionados
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info sobre vendas ativas */}
      {!calculoRealizado && (
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
                      <TableHead>TIPO ATUALIZAÇÃO</TableHead>
                      <TableHead className="text-center">DEFASAGEM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasAtivas.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell className="font-medium">
                          {venda.lote
                            ? `Quadra ${venda.lote.quadra} - Lote ${venda.lote.numero_lote}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{venda.tipo_atualizacao || "IGPM"}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {venda.defasagem_indice || 1} mês(es)
                        </TableCell>
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
      )}
    </div>
  );
}
