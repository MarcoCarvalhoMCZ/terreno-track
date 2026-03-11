import { useState, useMemo, useEffect, useRef } from "react";
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
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format, subMonths, parse, startOfMonth, addMonths } from "date-fns";
import { regenerarParcelasAbertas } from "@/lib/parcelas-abertas";
import type { Tables } from "@/integrations/supabase/types";

type Lote = Tables<"lotes">;
type Venda = Tables<"vendas">;
type ContaCorrenteLote = Tables<"conta_corrente_lote">;
type IndicadorValor = Tables<"indicadores_atualizacao_valores">;
type TipoFluxo = "PARCELAMENTO" | "REFORCO";

interface LoteCalculo {
  lote_id: string;
  tipo_fluxo: TipoFluxo;
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
  // IDs de lotes selecionados na lista pré-cálculo
  const [lotesSelecionados, setLotesSelecionados] = useState<Set<string>>(new Set());
  // Dialog para duplicidade
  const [duplicidadeDialogOpen, setDuplicidadeDialogOpen] = useState(false);
  const [lotesComDuplicidade, setLotesComDuplicidade] = useState<LoteCalculo[]>([]);
  const [resultadosPendentes, setResultadosPendentes] = useState<LoteCalculo[]>([]);

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

  // Uma venda por lote (evita cálculos em duplicidade para o mesmo lote)
  const vendasPorLote = useMemo(() => {
    if (!vendasAtivas) return [] as (Venda & { lote: Lote })[];

    const mapa = new Map<string, Venda & { lote: Lote }>();
    for (const venda of vendasAtivas) {
      if (!venda.lote) continue;
      if (!mapa.has(venda.lote_id)) {
        mapa.set(venda.lote_id, venda);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      const qa = a.lote?.quadra || "";
      const qb = b.lote?.quadra || "";
      const cmp = qa.localeCompare(qb, "pt-BR", { numeric: true });
      if (cmp !== 0) return cmp;
      return (a.lote?.numero_lote || "").localeCompare(b.lote?.numero_lote || "", "pt-BR", { numeric: true });
    });
  }, [vendasAtivas]);

  // Inicializar seleção quando lotes carregam (apenas na primeira vez)
  const inicializouSelecao = useRef(false);
  useEffect(() => {
    if (vendasPorLote.length > 0 && !inicializouSelecao.current) {
      setLotesSelecionados(new Set(vendasPorLote.map((v) => v.lote_id)));
      inicializouSelecao.current = true;
    }
  }, [vendasPorLote]);

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

  // Fetch movimentações de conta corrente (com paginação para evitar limite de 1000 linhas)
  const { data: movimentacoes } = useQuery({
    queryKey: ["conta-corrente-atualizacao"],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      let allData: ContaCorrenteLote[] = [];

      while (hasMore) {
        const { data, error } = await supabase
          .from("conta_corrente_lote")
          .select("*")
          .order("data_mov", { ascending: true })
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data || []) as ContaCorrenteLote[];
        allData = allData.concat(page);

        if (page.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      }

      return allData;
    },
  });

  // Indicadores principais para cálculo da média
  const indicadoresPrincipais = ["IGPM", "INCC", "INPC", "IPCA"];

  // Buscar fator de um indicador específico para uma competência
  const buscarFatorIndicador = (nomeIndicador: string, competenciaIndice: string): number | null => {
    if (!indicadores) return null;
    
    const indicador = indicadores.find(
      (ind) => ind.nome.toUpperCase() === nomeIndicador.toUpperCase()
    );
    
    if (!indicador || !indicador.valores) return null;
    
    const valor = (indicador.valores as IndicadorValor[]).find(
      (v) => v.competencia.substring(0, 7) === competenciaIndice
    );
    
    return valor ? Number(valor.fator) : null;
  };

  // Buscar índice para um tipo de atualização e competência (trata MEDIA)
  const buscarIndice = (tipoAtualizacao: string, competenciaIndice: string): number | null => {
    if (!indicadores) return null;
    
    if (tipoAtualizacao.toUpperCase() === "MEDIA") {
      // Calcular média dos indicadores principais (IGPM, INCC, INPC, IPCA)
      const fatores = indicadoresPrincipais
        .map(nome => buscarFatorIndicador(nome, competenciaIndice))
        .filter((f): f is number => f !== null);
      
      if (fatores.length === 0) return null;
      return fatores.reduce((a, b) => a + b, 0) / fatores.length;
    }
    
    return buscarFatorIndicador(tipoAtualizacao, competenciaIndice);
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

  // Verificar se já existe atualização na mesma competência (cache local)
  const verificarDuplicidade = (loteId: string, tipoFluxo: TipoFluxo, referencia: string): boolean => {
    if (!movimentacoes) return false;

    const referenciaBR = `${referencia.substring(5, 7)}/${referencia.substring(0, 4)}`;

    return movimentacoes.some((m) => {
      if (m.lote_id !== loteId || m.tipo_fluxo !== tipoFluxo || m.tipo_mov !== "ATUALIZACAO") return false;

      const refMov = m.referencia || "";
      if (refMov === referencia || refMov === referenciaBR) return true;

      return m.data_mov?.substring(0, 7) === referencia;
    });
  };

  // Verificação robusta de duplicidade diretamente no banco
  const verificarDuplicidadeNoBanco = async (
    loteId: string,
    tipoFluxo: TipoFluxo,
    referencia: string
  ): Promise<boolean> => {
    const inicioCompetencia = `${referencia}-01`;
    const fimCompetencia = format(
      addMonths(parse(inicioCompetencia, "yyyy-MM-dd", new Date()), 1),
      "yyyy-MM-dd"
    );

    const { data, error } = await supabase
      .from("conta_corrente_lote")
      .select("id")
      .eq("lote_id", loteId)
      .eq("tipo_fluxo", tipoFluxo)
      .eq("tipo_mov", "ATUALIZACAO")
      .gte("data_mov", inicioCompetencia)
      .lt("data_mov", fimCompetencia)
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  };

  // Executar cálculo para lotes selecionados
  const executarCalculo = (incluirDuplicados: boolean) => {
    if (!vendasPorLote.length || !dataMovimento) {
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
      for (const venda of vendasPorLote) {
        if (!venda.lote) continue;
        // Filtrar apenas lotes selecionados
        if (!lotesSelecionados.has(venda.lote_id)) continue;

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
        const valorCalculado =
          indice !== null && saldoAnterior > 0
            ? Math.round(saldoAnterior * (indice / 100) * 100) / 100
            : 0;

        // Só adiciona se houver saldo positivo
        if (saldoAnterior > 0) {
          // Se já atualizado e não incluir duplicados, pular
          if (jaAtualizado && !incluirDuplicados) continue;

          resultados.push({
            lote_id: venda.lote_id,
            tipo_fluxo: tipoFluxo,
            quadra: venda.lote.quadra,
            numero_lote: venda.lote.numero_lote,
            tipo_atualizacao: tipoAtualizacao,
            defasagem,
            competencia_indice: competenciaIndice,
            indice_encontrado: indice,
            saldo_anterior: saldoAnterior,
            valor_calculado: valorCalculado,
            ja_atualizado: jaAtualizado,
            selecionado: valorCalculado !== 0,
          });
        }
      }
    }

    // Ordenar por quadra e lote
    resultados.sort((a, b) => {
      const quadraCompare = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
      if (quadraCompare !== 0) return quadraCompare;
      return a.numero_lote.localeCompare(b.numero_lote, "pt-BR", { numeric: true });
    });

    setLotesCalculo(resultados);
    setCalculoRealizado(true);

    if (resultados.length === 0) {
      toast.info("Nenhum lote com saldo devedor encontrado");
    }
  };

  const handleCalcular = async () => {
    if (!vendasPorLote.length || !dataMovimento) {
      toast.error("Selecione uma data de movimento");
      return;
    }

    if (tiposFluxoSelecionados.length === 0) {
      toast.error("Selecione pelo menos um tipo de conta");
      return;
    }

    if (lotesSelecionados.size === 0) {
      toast.error("Selecione pelo menos um lote");
      return;
    }

    try {
      // Verificar duplicidades diretamente no banco antes de calcular
      const checks = await Promise.all(
        tiposFluxoSelecionados.flatMap((tipoFluxo) =>
          vendasPorLote
            .filter((venda) => venda.lote && lotesSelecionados.has(venda.lote_id))
            .map(async (venda) => ({
              tipoFluxo,
              quadra: venda.lote!.quadra,
              numero_lote: venda.lote!.numero_lote,
              jaExiste: await verificarDuplicidadeNoBanco(venda.lote_id, tipoFluxo, referenciaMes),
            }))
        )
      );

      const duplicados = checks
        .filter((c) => c.jaExiste)
        .map((c) => ({ quadra: c.quadra, numero_lote: c.numero_lote }));

      if (duplicados.length > 0) {
        const uniqueDups = duplicados.filter(
          (d, i, arr) => arr.findIndex((x) => x.quadra === d.quadra && x.numero_lote === d.numero_lote) === i
        );
        setLotesComDuplicidade(uniqueDups as any);
        setDuplicidadeDialogOpen(true);
        return;
      }

      executarCalculo(false);
    } catch (error: any) {
      toast.error("Erro ao verificar duplicidade: " + (error?.message || "Erro desconhecido"));
    }
  };

  const handleDuplicidadeConfirm = (recalcular: boolean) => {
    setDuplicidadeDialogOpen(false);
    if (recalcular) {
      executarCalculo(true);
    } else {
      // Calcular sem os duplicados
      executarCalculo(false);
    }
  };

  // Toggle seleção de um lote (pré-cálculo)
  const toggleLoteSelecionado = (loteId: string) => {
    setLotesSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(loteId)) next.delete(loteId);
      else next.add(loteId);
      return next;
    });
    setCalculoRealizado(false);
    setLotesCalculo([]);
  };

  const toggleTodosLotes = (selecionar: boolean) => {
    if (selecionar) {
      setLotesSelecionados(new Set(vendasPorLote.map((v) => v.lote_id)));
    } else {
      setLotesSelecionados(new Set());
    }
    setCalculoRealizado(false);
    setLotesCalculo([]);
  };

  // Toggle seleção de um lote (pós-cálculo)
  const toggleSelecao = (loteId: string, tipoFluxo: TipoFluxo) => {
    setLotesCalculo((prev) =>
      prev.map((lote) =>
        lote.lote_id === loteId && lote.tipo_fluxo === tipoFluxo
          ? { ...lote, selecionado: !lote.selecionado }
          : lote
      )
    );
  };

  // Selecionar/Desselecionar todos (pós-cálculo)
  const toggleTodos = (selecionar: boolean) => {
    setLotesCalculo((prev) =>
      prev.map((lote) =>
        lote.valor_calculado !== 0
          ? { ...lote, selecionado: selecionar }
          : lote
      )
    );
  };

  // Mutation para executar atualização
  const executarMutation = useMutation({
    mutationFn: async () => {
      const lotesSelecionadosExecucao = lotesCalculo.filter((l) => l.selecionado);

      if (lotesSelecionadosExecucao.length === 0) {
        throw new Error("Nenhum lote selecionado");
      }

      // Deletar atualização existente somente dos lotes/fluxos selecionados e já atualizados
      const inicioCompetencia = `${referenciaMes}-01`;
      const fimCompetencia = format(addMonths(parse(inicioCompetencia, "yyyy-MM-dd", new Date()), 1), "yyyy-MM-dd");

      const lotesParaRecalcular = lotesSelecionadosExecucao.filter((l) => l.ja_atualizado);
      for (const lote of lotesParaRecalcular) {
        const { error: deleteError } = await supabase
          .from("conta_corrente_lote")
          .delete()
          .eq("lote_id", lote.lote_id)
          .eq("tipo_fluxo", lote.tipo_fluxo)
          .eq("tipo_mov", "ATUALIZACAO")
          .gte("data_mov", inicioCompetencia)
          .lt("data_mov", fimCompetencia);

        if (deleteError) throw deleteError;
      }

      const lancamentos = [];

      for (const lote of lotesSelecionadosExecucao) {
        // Recalcular saldo para ter o valor mais atualizado
        const saldoAnterior = calcularSaldoAnterior(lote.lote_id, lote.tipo_fluxo, dataMovimento);
        const valorAtual =
          lote.indice_encontrado !== null && saldoAnterior > 0
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
          tipo_fluxo: lote.tipo_fluxo,
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
      
      // Recalcular para atualizar status
      setTimeout(() => executarCalculo(false), 500);
    },
    onError: (error) => {
      toast.error("Erro ao executar atualização: " + error.message);
    },
  });

  const handleExecutar = () => {
    const selecionados = lotesCalculo.filter((l) => l.selecionado);
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

  const lotesParaAtualizar = lotesCalculo.filter((l) => l.selecionado);
  const totalSelecionados = lotesParaAtualizar.length;
  const totalValor = lotesParaAtualizar.reduce((acc, l) => acc + l.valor_calculado, 0);

  const todasSelecionadas = vendasPorLote.length > 0 && lotesSelecionados.size === vendasPorLote.length;

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
                      {lotesCalculo.map((lote, idx) => (
                        <TableRow
                          key={`${lote.lote_id}-${lote.tipo_fluxo}-${idx}`}
                          className={lote.ja_atualizado && !lote.selecionado ? "opacity-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={lote.selecionado}
                              disabled={lote.valor_calculado === 0}
                              onCheckedChange={() => toggleSelecao(lote.lote_id, lote.tipo_fluxo)}
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

      {/* Info sobre vendas ativas - com checkboxes e ordenação */}
      {!calculoRealizado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendas Ativas ({vendasPorLote.length})</CardTitle>
                <CardDescription>
                  Selecione os lotes que deseja incluir no cálculo de atualização monetária
                </CardDescription>
              </div>
              {vendasPorLote.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTodosLotes(!todasSelecionadas)}
                  >
                    {todasSelecionadas ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingVendas ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : vendasPorLote.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>LOTE</TableHead>
                      <TableHead>TIPO ATUALIZAÇÃO</TableHead>
                      <TableHead className="text-center">DEFASAGEM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasPorLote.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell>
                          <Checkbox
                            checked={lotesSelecionados.has(venda.lote_id)}
                            onCheckedChange={() => toggleLoteSelecionado(venda.lote_id)}
                          />
                        </TableCell>
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

      {/* Dialog de duplicidade */}
      <AlertDialog open={duplicidadeDialogOpen} onOpenChange={setDuplicidadeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Atualização já calculada
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Alguns lotes selecionados já possuem atualização monetária calculada para a referência <strong>{referenciaMes}</strong>.
              </p>
              <p>Deseja recalcular esses lotes (substituindo os valores anteriores)?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDuplicidadeConfirm(false)}>
              Não, ignorar duplicados
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDuplicidadeConfirm(true)}>
              Sim, recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
