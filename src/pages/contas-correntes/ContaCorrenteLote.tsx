import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Receipt, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDateBR, parseDateOnly } from "@/lib/date";
import { formatCurrency, parseValorBR } from "@/lib/formatters";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import type { ContaCorrenteComRelacionamentos, ContaCorrenteFormData, ResumoFluxoView } from "@/types/conta-corrente.types";
import { emptyMovimento } from "@/types/conta-corrente.types";
import {
  tiposMovimento,
  tiposMovimentoTodos,
  tiposParcelamento,
  tiposReforco,
  getNaturezaMovimento,
  getTipoMovimentoLabel,
  type TipoConta,
  type NaturezaMovimento,
} from "@/constants/movimento";
import {
  useContaCorrenteMovimentacoes,
  useLotes,
  useVendasComLote,
  useResumoFluxoLote,
  useIndicadoresValores,
  useContaCorrenteMutations,
} from "@/hooks/useContaCorrente";

type ContaCorrenteInsert = TablesInsert<"conta_corrente_lote">;
type ContaCorrenteUpdate = TablesUpdate<"conta_corrente_lote">;

export default function ContaCorrenteLote() {
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movToDelete, setMovToDelete] = useState<ContaCorrenteComRelacionamentos | null>(null);
  const [editingMov, setEditingMov] = useState<ContaCorrenteComRelacionamentos | null>(null);
  const [formData, setFormData] = useState<ContaCorrenteFormData>(emptyMovimento);
  const [duplicateAtualizacaoDialogOpen, setDuplicateAtualizacaoDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<{ dataToSave: any; isEdit: boolean; editId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLote, setFilterLote] = useState<string>("TODOS");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [valorMovimento, setValorMovimento] = useState<string>("");
  const [tipoConta, setTipoConta] = useState<TipoConta>("PARCELAMENTO");

  // Use centralized hooks for data fetching
  const { data: movimentacoes, isLoading } = useContaCorrenteMovimentacoes();
  const { data: lotes } = useLotes();
  const { data: vendas } = useVendasComLote();
  const { data: resumoFluxo } = useResumoFluxoLote();
  const { data: indicadoresValores } = useIndicadoresValores();

  // Close dialog handler to pass to mutations
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMov(null);
    setFormData({ ...emptyMovimento, tipo_fluxo_form: tipoConta });
    setValorMovimento("");
    setShouldApplySuggestions(true);
  };

  // Use centralized mutations hook
  const { createMutation, updateMutation, deleteMutation } = useContaCorrenteMutations(handleCloseDialog);

  // Ler loteId da URL query param
  useEffect(() => {
    const loteIdFromUrl = searchParams.get("loteId");
    if (loteIdFromUrl) {
      setFilterLote(loteIdFromUrl);
      // Limpar o parâmetro da URL após aplicar o filtro
      searchParams.delete("loteId");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Indicadores principais para cálculo da média
  const indicadoresPrincipais = ["IGPM", "INCC", "INPC", "IPCA"];

  // Função para obter o fator de um indicador em uma competência específica
  const getIndicadorFator = (indicadorNome: string, competencia: string): number | null => {
    if (!indicadoresValores) return null;
    const valor = indicadoresValores.find(
      (v: any) => v.indicador?.nome?.toUpperCase() === indicadorNome.toUpperCase() && 
           v.competencia?.substring(0, 7) === competencia.substring(0, 7)
    );
    return valor?.fator ?? null;
  };

  // Função para calcular a média dos indicadores principais em uma competência
  const calcularMediaIndicadores = (competencia: string): number | null => {
    const fatores = indicadoresPrincipais
      .map(nome => getIndicadorFator(nome, competencia))
      .filter((f): f is number => f !== null);
    
    if (fatores.length === 0) return null;
    return fatores.reduce((a, b) => a + b, 0) / fatores.length;
  };

  // Obter lote selecionado e sua venda
  const loteSelecionado = useMemo(() => {
    return lotes?.find(l => l.id === formData.lote_id);
  }, [lotes, formData.lote_id]);

  const vendaDoLote = useMemo(() => {
    if (!formData.lote_id || !vendas) return null;
    return vendas.find((v: any) => v.lote_id === formData.lote_id);
  }, [vendas, formData.lote_id]);

  // Obter resumo do fluxo para o lote e tipo selecionado
  const resumoFluxoLote = useMemo(() => {
    if (!resumoFluxo || !formData.lote_id || !formData.tipo_fluxo_form) return null;
    return resumoFluxo.find(
      r => r.lote_id === formData.lote_id && r.tipo_fluxo === formData.tipo_fluxo_form
    );
  }, [resumoFluxo, formData.lote_id, formData.tipo_fluxo_form]);

  // Função para calcular sugestões com base no tipo de movimento
  const calcularSugestoes = useMemo(() => {
    if (!formData.lote_id || !formData.tipo_mov || !loteSelecionado) {
      return { valor: "", referencia: "", vencimento: "", percentual: "", descricao: "" };
    }

    const loteLabel = `Qd${loteSelecionado.quadra} Lt${loteSelecionado.numero_lote}`;
    const tipoFluxo = formData.tipo_fluxo_form || "PARCELAMENTO";

    switch (formData.tipo_mov) {
      case "PARCELA":
      case "REFORCO": {
        // Sugerir próxima parcela/reforço
        const valorProximo = resumoFluxoLote?.valor_proximo_titulo || 0;
        const qtdRestante = resumoFluxoLote?.qtd_restante || 0;
        
        // Calcular número da parcela atual
        let qtdTotal = 0;
        if (vendaDoLote) {
          qtdTotal = tipoFluxo === "PARCELAMENTO" 
            ? (vendaDoLote.qtd_parcelas || 0)
            : (vendaDoLote.qtd_reforcos || 0);
        }
        const parcelaAtual = qtdTotal - qtdRestante + 1;
        
        // Calcular vencimento da próxima parcela
        let vencimentoSugerido = "";
        if (vendaDoLote) {
          const primeiroVenc = tipoFluxo === "PARCELAMENTO"
            ? vendaDoLote.primeiro_vencimento_parcela
            : vendaDoLote.primeiro_vencimento_reforco;
          const frequencia = tipoFluxo === "PARCELAMENTO"
            ? (vendaDoLote.frequencia_parcelas_meses || 1)
            : (vendaDoLote.frequencia_reforcos_meses || 6);
          
          if (primeiroVenc) {
            const dataBase = parseDateOnly(primeiroVenc);
            if (dataBase) {
              dataBase.setMonth(dataBase.getMonth() + (parcelaAtual - 1) * frequencia);
              vencimentoSugerido = format(dataBase, "yyyy-MM-dd");
            }
          }
        }

        const tipoLabel = formData.tipo_mov === "PARCELA" ? "Parcela Recebida" : "Reforço Recebido";
        
        return {
          valor: valorProximo > 0 ? valorProximo.toFixed(2) : "",
          referencia: qtdTotal > 0 ? `${parcelaAtual} de ${qtdTotal}` : "",
          vencimento: vencimentoSugerido,
          percentual: "",
          descricao: `${tipoLabel} ${loteLabel}`,
        };
      }

      case "ARRAS": {
        // Sugerir valor de arras da venda
        const valorArras = vendaDoLote?.valor_arras || 0;
        return {
          valor: valorArras > 0 ? valorArras.toFixed(2) : "",
          referencia: "Arras",
          vencimento: "",
          percentual: "",
          descricao: `Arras Venda Lote ${loteLabel}`,
        };
      }

      case "ATUALIZACAO": {
        // Calcular atualização monetária: Saldo Anterior × Índice
        // Algoritmo:
        // 1. Usar data_mov informada no formulário
        // 2. Calcular saldo acumulado (soma débitos - soma créditos) até data anterior a data_mov
        // 3. Ver em vendas qual tipo de atualização (IGPM ou MEDIA)
        // 4. Ver em vendas a defasagem do índice
        // 5. Calcular competência do índice = data_mov (YYYY-MM) - defasagem
        // 6. Buscar o índice correto para essa competência
        
        // Usar data do movimento (formData.data_mov) ou data atual se não informada
        const dataMovimento = formData.data_mov ? parseDateOnly(formData.data_mov) : new Date();
        
        // Calcular saldo acumulado até a data anterior ao movimento
        // Saldo = Soma(débitos) - Soma(créditos) das movimentações anteriores
        let saldoAnterior = 0;
        if (movimentacoes && formData.lote_id && dataMovimento) {
          // Filtrar movimentações do mesmo lote e tipo_fluxo, anteriores à data do movimento
          const movimentacoesAnteriores = movimentacoes
            .filter(m => 
              m.lote_id === formData.lote_id && 
              (m as any).tipo_fluxo === tipoFluxo &&
              m.data_mov && 
              parseDateOnly(m.data_mov)! < dataMovimento
            );
          
          // Calcular saldo acumulado: soma débitos - soma créditos
          movimentacoesAnteriores.forEach(m => {
            saldoAnterior += (m.debito || 0) - (m.credito || 0);
          });
        }
        
        let fatorPercentual = 0;
        
        if (vendaDoLote && dataMovimento) {
          // Obter tipo de atualização e defasagem da venda
          const tipoAtualizacao = vendaDoLote.tipo_atualizacao || "IGPM";
          const defasagem = vendaDoLote.defasagem_indice || 1;
          
          // Calcular data de referência: mês do data_mov - defasagem
          const dataReferencia = new Date(dataMovimento.getFullYear(), dataMovimento.getMonth() - defasagem, 1);
          const competenciaIndice = format(dataReferencia, "yyyy-MM");
          
          if (tipoAtualizacao === "MEDIA") {
            // Calcular média dos indicadores principais (IGPM, INCC, INPC, IPCA)
            const mediaFator = calcularMediaIndicadores(competenciaIndice);
            fatorPercentual = mediaFator ?? 0;
          } else {
            // Usar o indicador específico (IGPM)
            const fatorIndice = getIndicadorFator(tipoAtualizacao, competenciaIndice);
            fatorPercentual = fatorIndice ?? 0;
          }
        }
        
        const valorAtualizacao = saldoAnterior * (fatorPercentual / 100);
        
        return {
          valor: valorAtualizacao !== 0 ? Math.abs(valorAtualizacao).toFixed(2) : "",
          referencia: "",
          vencimento: "",
          percentual: fatorPercentual.toFixed(2),
          descricao: `Atualização Monetária ${loteLabel}`,
        };
      }

      case "JUROS": {
        // Calcular juros: valor parcela × meses em atraso × taxa (1% a.m. padrão)
        const valorParcela = resumoFluxoLote?.valor_proximo_titulo || 0;
        // Taxa de juros padrão: 1% ao mês
        const taxaJuros = 1;
        
        return {
          valor: "", // Será calculado após informar vencimento
          referencia: "",
          vencimento: "", // Usuário precisa informar para calcular
          percentual: taxaJuros.toString(),
          descricao: `Juros de Mora ${loteLabel}`,
        };
      }

      case "MULTA": {
        // Multa: 2% do valor da parcela
        const valorParcela = resumoFluxoLote?.valor_proximo_titulo || 0;
        const taxaMulta = 2;
        const valorMulta = valorParcela * (taxaMulta / 100);
        
        return {
          valor: valorMulta > 0 ? valorMulta.toFixed(2) : "",
          referencia: "",
          vencimento: "",
          percentual: taxaMulta.toString(),
          descricao: `Multa ${loteLabel}`,
        };
      }

      default:
        return { valor: "", referencia: "", vencimento: "", percentual: "", descricao: "" };
    }
  }, [formData.lote_id, formData.tipo_mov, formData.tipo_fluxo_form, formData.data_mov, loteSelecionado, vendaDoLote, resumoFluxoLote, movimentacoes, indicadoresValores, getIndicadorFator, calcularMediaIndicadores]);

  // Referência para controlar se deve aplicar sugestões automaticamente
  const [shouldApplySuggestions, setShouldApplySuggestions] = useState(true);

  // Using parseValorBR from centralized formatters

  // Efeito para aplicar sugestões quando o tipo de movimento, lote ou data mudar
  useEffect(() => {
    // Não aplicar sugestões se estiver editando
    if (editingMov) return;
    
    // Só aplicar se houver lote e tipo selecionado
    if (!formData.lote_id || !formData.tipo_mov) return;

    // Só aplicar sugestões se a flag estiver ativa
    if (!shouldApplySuggestions) return;

    const sugestoes = calcularSugestoes;
    
    // Aplicar sugestões como valores iniciais (podem ser alterados pelo usuário)
    if (sugestoes.valor) {
      setValorMovimento(sugestoes.valor);
    }
    
    setFormData(prev => ({
      ...prev,
      referencia: sugestoes.referencia || "",
      vencimento: sugestoes.vencimento || null,
      percentual_calculo: sugestoes.percentual ? parseFloat(sugestoes.percentual) : null,
      descricao: sugestoes.descricao || "",
    }));
    
    // Desabilitar sugestões após aplicar uma vez (evita sobrescrever edições do usuário)
    setShouldApplySuggestions(false);
  }, [formData.lote_id, formData.tipo_mov, formData.tipo_fluxo_form, formData.data_mov, editingMov, calcularSugestoes, shouldApplySuggestions]);
  
  // Resetar flag quando muda o tipo de movimento, lote ou tipo de fluxo (nova seleção)
  useEffect(() => {
    setShouldApplySuggestions(true);
  }, [formData.tipo_mov, formData.lote_id, formData.tipo_fluxo_form]);

  // Efeito para calcular juros quando vencimento mudar (para tipo JUROS)
  useEffect(() => {
    if (editingMov || formData.tipo_mov !== "JUROS" || !formData.vencimento || !resumoFluxoLote) return;

    const vencimento = parseDateOnly(formData.vencimento);
    const hoje = new Date();
    
    if (vencimento && vencimento < hoje) {
      const mesesAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const valorParcela = resumoFluxoLote.valor_proximo_titulo || 0;
      const taxaJuros = 1; // 1% ao mês
      const valorJuros = valorParcela * (taxaJuros / 100) * mesesAtraso;
      
      if (valorJuros > 0) {
        setValorMovimento(valorJuros.toFixed(2));
        setFormData(prev => ({
          ...prev,
          percentual_calculo: taxaJuros * mesesAtraso,
        }));
      }
    }
  }, [formData.vencimento, formData.tipo_mov, resumoFluxoLote, editingMov]);

  // handleCloseDialog is defined above with mutations

  const handleEdit = (mov: ContaCorrenteComRelacionamentos) => {
    setEditingMov(mov);
    // Determinar qual valor usar e a natureza
    const valor = mov.debito || mov.credito || 0;
    const natureza = mov.debito ? "debito" : "credito";
    setValorMovimento(valor.toString());
    // Recuperar o tipo_fluxo do movimento
    const movTipoFluxo = (mov as any).tipo_fluxo as TipoConta || tipoConta;
    setFormData({
      lote_id: mov.lote_id,
      data_mov: mov.data_mov,
      tipo_mov: mov.tipo_mov,
      descricao: mov.descricao || "",
      credito: mov.credito,
      debito: mov.debito,
      referencia: mov.referencia || "",
      vencimento: mov.vencimento,
      percentual_calculo: mov.percentual_calculo,
      venda_id: mov.venda_id,
      natureza_outros: getNaturezaMovimento(mov.tipo_mov) === "pergunta" ? natureza : undefined,
      tipo_fluxo_form: movTipoFluxo,
      modo_pagamento: mov.modo_pagamento || null,
      banco_origem: mov.banco_origem || null,
      cpf_cnpj_pagador: mov.cpf_cnpj_pagador || null,
    });
    setDialogOpen(true);
  };

  const handleDelete = (mov: ContaCorrenteComRelacionamentos) => {
    setMovToDelete(mov);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (movToDelete) {
      deleteMutation.mutate(movToDelete.id);
    }
  };

  const existeAtualizacaoNoMes = async (
    loteId: string,
    tipoFluxo: TipoConta,
    dataMov: string
  ): Promise<boolean> => {
    const refMes = dataMov.substring(0, 7);
    const inicioCompetencia = `${refMes}-01`;
    const fimCompetenciaDate = new Date(`${inicioCompetencia}T00:00:00`);
    fimCompetenciaDate.setMonth(fimCompetenciaDate.getMonth() + 1);
    const fimCompetencia = format(fimCompetenciaDate, "yyyy-MM-dd");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação com mensagens específicas
    const camposFaltando: string[] = [];
    if (!formData.lote_id) camposFaltando.push("Lote");
    if (!formData.data_mov) camposFaltando.push("Data Movimento");
    if (!formData.tipo_mov) camposFaltando.push("Tipo Movimento");
    
    const valor = parseValorBR(valorMovimento);
    if (!valor || valor <= 0) camposFaltando.push("Valor");

    if (camposFaltando.length > 0) {
      toast.error(`Campos obrigatórios não preenchidos: ${camposFaltando.join(", ")}`);
      return;
    }

    // Determinar natureza do movimento
    const naturezaDoTipo = getNaturezaMovimento(formData.tipo_mov);
    let naturezaFinal: "debito" | "credito";
    
    if (naturezaDoTipo === "pergunta") {
      if (!formData.natureza_outros) {
        toast.error("Selecione se o movimento é débito ou crédito");
        return;
      }
      naturezaFinal = formData.natureza_outros;
    } else if (naturezaDoTipo === "auto") {
      // Para ATUALIZACAO: índice positivo = débito (aumenta saldo), índice negativo = crédito (reduz saldo)
      // O percentual_calculo armazena o índice, que pode ser negativo
      const percentual = formData.percentual_calculo || 0;
      naturezaFinal = percentual >= 0 ? "debito" : "credito";
    } else {
      naturezaFinal = naturezaDoTipo;
    }

    // Preparar dados - remover campos que não existem no banco
    const { natureza_outros, tipo_fluxo_form, ...formDataSemExtras } = formData;
    
    // Incluir campos de pagamento apenas para tipos PARCELA e REFORCO
    const isPagamento = formData.tipo_mov === "PARCELA" || formData.tipo_mov === "REFORCO";
    
    const dataToSave = {
      ...formDataSemExtras,
      tipo_fluxo: tipo_fluxo_form || tipoConta,
      debito: naturezaFinal === "debito" ? valor : null,
      credito: naturezaFinal === "credito" ? valor : null,
      percentual_calculo: formData.percentual_calculo ? Number(formData.percentual_calculo) : null,
      venda_id: null,
      modo_pagamento: isPagamento ? (formData.modo_pagamento || null) : null,
      banco_origem: isPagamento ? (formData.banco_origem || null) : null,
      cpf_cnpj_pagador: isPagamento ? (formData.cpf_cnpj_pagador || null) : null,
    };

    // Verificar duplicidade para ATUALIZACAO (consulta robusta no banco)
    if (!editingMov && formData.tipo_mov === "ATUALIZACAO" && formData.lote_id && formData.data_mov) {
      const tipoFluxo = tipo_fluxo_form || tipoConta;

      try {
        const jaExiste = await existeAtualizacaoNoMes(formData.lote_id, tipoFluxo, formData.data_mov);
        if (jaExiste) {
          setPendingSubmitData({ dataToSave: dataToSave as ContaCorrenteInsert, isEdit: false });
          setDuplicateAtualizacaoDialogOpen(true);
          return;
        }
      } catch (error: any) {
        toast.error("Erro ao verificar duplicidade: " + (error?.message || "Erro desconhecido"));
        return;
      }
    }

    if (editingMov) {
      updateMutation.mutate({
        id: editingMov.id,
        updates: dataToSave as ContaCorrenteUpdate,
      });
    } else {
      createMutation.mutate(dataToSave as ContaCorrenteInsert);
    }
  };

  const handleDuplicateAtualizacaoConfirm = async (recalcular: boolean) => {
    setDuplicateAtualizacaoDialogOpen(false);
    if (!recalcular || !pendingSubmitData) {
      setPendingSubmitData(null);
      return;
    }
    // Deletar a atualização existente no mesmo mês/competência e inserir a nova
    const refMes = formData.data_mov?.substring(0, 7);
    const tipoFluxo = (formData as any).tipo_fluxo_form || tipoConta;
    if (formData.lote_id && refMes) {
      const inicioCompetencia = `${refMes}-01`;
      const fimCompetenciaDate = new Date(`${inicioCompetencia}T00:00:00`);
      fimCompetenciaDate.setMonth(fimCompetenciaDate.getMonth() + 1);
      const fimCompetencia = format(fimCompetenciaDate, "yyyy-MM-dd");

      await supabase
        .from("conta_corrente_lote")
        .delete()
        .eq("lote_id", formData.lote_id)
        .eq("tipo_fluxo", tipoFluxo)
        .eq("tipo_mov", "ATUALIZACAO")
        .gte("data_mov", inicioCompetencia)
        .lt("data_mov", fimCompetencia);
    }
    createMutation.mutate(pendingSubmitData.dataToSave as ContaCorrenteInsert);
    setPendingSubmitData(null);
  };

  // Filtrar movimentos por tipo de conta (Parcelamento vs Reforço) - usando tipo_fluxo
  const tiposPermitidos = tipoConta === "PARCELAMENTO" ? tiposParcelamento : tiposReforco;
  
  const filteredMovimentacoes = movimentacoes?.filter((mov) => {
    // Filtrar por tipo_fluxo (campo no banco)
    const movTipoFluxo = (mov as any).tipo_fluxo;
    if (movTipoFluxo && movTipoFluxo !== tipoConta) return false;
    
    // Fallback: filtrar por tipo_mov para dados antigos sem tipo_fluxo
    if (!movTipoFluxo) {
      if (tipoConta === "PARCELAMENTO" && mov.tipo_mov === "REFORCO") return false;
      if (tipoConta === "REFORCO" && (mov.tipo_mov === "PARCELA" || mov.tipo_mov === "VENDA" || mov.tipo_mov === "ARRAS")) return false;
    }
    
    const loteInfo = `${mov.lote?.quadra || ""} ${mov.lote?.numero_lote || ""}`.toLowerCase();
    const descricao = mov.descricao?.toLowerCase() || "";
    const matchesSearch =
      loteInfo.includes(searchTerm.toLowerCase()) ||
      descricao.includes(searchTerm.toLowerCase());
    const matchesLote = filterLote === "TODOS" || mov.lote_id === filterLote;
    const matchesTipo = filterTipo === "TODOS" || mov.tipo_mov === filterTipo;
    return matchesSearch && matchesLote && matchesTipo;
  });

  // Calculate totals
  const totais = filteredMovimentacoes?.reduce(
    (acc, mov) => ({
      creditos: acc.creditos + (mov.credito || 0),
      debitos: acc.debitos + (mov.debito || 0),
    }),
    { creditos: 0, debitos: 0 }
  );

  // Calculate running balance (sorted by date ascending for proper calculation)
  const movimentacoesComSaldo = (() => {
    if (!filteredMovimentacoes) return [];
    
    // Sort by date ascending to calculate running balance correctly
    const sorted = [...filteredMovimentacoes].sort((a, b) => {
      const aTime = parseDateOnly(a.data_mov)?.getTime() ?? 0;
      const bTime = parseDateOnly(b.data_mov)?.getTime() ?? 0;
      const dateCompare = aTime - bTime;
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
    
    let saldoAcumulado = 0;
    const withBalance = sorted.map((mov) => {
      saldoAcumulado += (mov.debito || 0) - (mov.credito || 0);
      return { ...mov, saldoAcumulado };
    });
    
    // Reverse to show newest first (maintaining original display order)
    return withBalance.reverse();
  })();

  const { sortConfig: movSortConfig, handleSort: handleMovSort, sortData: sortMovData } = useTableSort<typeof movimentacoesComSaldo[number]>();

  const sortedMovimentacoes = useMemo(() => {
    if (!movimentacoesComSaldo.length) return [];
    if (!movSortConfig.key || !movSortConfig.direction) return movimentacoesComSaldo;
    return sortMovData(movimentacoesComSaldo, (item, key) => {
      switch (key) {
        case "data_mov": return item.data_mov;
        case "lote": return `${item.lote?.quadra || ""} ${item.lote?.numero_lote || ""}`;
        case "tipo_mov": return item.tipo_mov;
        case "descricao": return item.descricao;
        case "referencia": return item.referencia;
        case "debito": return item.debito || 0;
        case "credito": return item.credito || 0;
        default: return null;
      }
    });
  }, [movimentacoesComSaldo, movSortConfig]);

  // Using formatCurrency from centralized formatters
  const formatDate = (date: string | null) => formatDateBR(date);

  // Using getTipoMovimentoLabel from centralized constants

  // Get tipos de movimento baseado no tipo de conta selecionado NO FORMULÁRIO (sem VENDA)
  const tiposMovimentoFiltrados = tiposMovimento.filter(t => 
    formData.tipo_fluxo_form === "PARCELAMENTO" 
      ? tiposParcelamento.includes(t.value)
      : tiposReforco.includes(t.value)
  );

  // Get tipos para filtro (inclui VENDA para visualização)
  const tiposMovimentoFiltro = tiposMovimentoTodos.filter(t => 
    tipoConta === "PARCELAMENTO" 
      ? [...tiposParcelamento, "VENDA"].includes(t.value)
      : tiposReforco.includes(t.value)
  );

  const renderContent = () => (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Faturado (Débitos)</p>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(totais?.debitos || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Recebido (Créditos)</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(totais?.creditos || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                <p className={`text-2xl font-bold ${((totais?.debitos || 0) - (totais?.creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency((totais?.debitos || 0) - (totais?.creditos || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por lote ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterLote} onValueChange={setFilterLote}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar por lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os lotes</SelectItem>
                {lotes?.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    Q{lote.quadra} L{lote.numero_lote}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os tipos</SelectItem>
                {tiposMovimentoFiltro.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Movimentações ({filteredMovimentacoes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredMovimentacoes && filteredMovimentacoes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="data_mov" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort}>DATA</SortableTableHead>
                    <SortableTableHead sortKey="lote" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort}>LOTE</SortableTableHead>
                    <SortableTableHead sortKey="tipo_mov" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort}>TIPO</SortableTableHead>
                    <SortableTableHead sortKey="descricao" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort}>DESCRIÇÃO</SortableTableHead>
                    <SortableTableHead sortKey="referencia" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort}>REFERÊNCIA</SortableTableHead>
                    <SortableTableHead sortKey="debito" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort} className="text-right">DÉBITO</SortableTableHead>
                    <SortableTableHead sortKey="credito" currentKey={movSortConfig.key} direction={movSortConfig.direction} onSort={handleMovSort} className="text-right">CRÉDITO</SortableTableHead>
                    <TableHead className="text-right">SALDO</TableHead>
                    {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMovimentacoes.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>{formatDate(mov.data_mov)}</TableCell>
                      <TableCell className="font-medium">
                        {mov.lote ? `Q${mov.lote.quadra} L${mov.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTipoMovimentoLabel(mov.tipo_mov)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {mov.descricao || "-"}
                      </TableCell>
                      <TableCell>{mov.referencia || "-"}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {mov.debito ? formatCurrency(mov.debito) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {mov.credito ? formatCurrency(mov.credito) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${mov.saldoAcumulado > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency(mov.saldoAcumulado)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(mov)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(mov)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação registrada
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Conta Corrente do Lote</h1>
          <p className="text-muted-foreground">Movimentação financeira por lote</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingMov(null);
                setFormData({ ...emptyMovimento, tipo_fluxo_form: tipoConta });
                setValorMovimento("");
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMov ? "Editar Movimentação" : "Nova Movimentação"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de Conta (Parcelamento/Reforço) */}
                <div className="space-y-2">
                  <Label htmlFor="tipo_fluxo_form">Tipo de Conta <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.tipo_fluxo_form || "PARCELAMENTO"}
                    onValueChange={(value) => {
                      const novoTipoConta = value as TipoConta;
                      const tiposValidos = novoTipoConta === "PARCELAMENTO" ? tiposParcelamento : tiposReforco;
                      const novoTipoMov = tiposValidos.includes(formData.tipo_mov || "") 
                        ? formData.tipo_mov 
                        : (novoTipoConta === "PARCELAMENTO" ? "PARCELA" : "REFORCO");
                      
                      setFormData({ 
                        ...formData, 
                        tipo_fluxo_form: novoTipoConta,
                        tipo_mov: novoTipoMov,
                      });
                      setValorMovimento("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARCELAMENTO">Parcelamento</SelectItem>
                      <SelectItem value="REFORCO">Reforço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Lote e Data */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote_id">Lote <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.lote_id || ""}
                      onValueChange={(value) => {
                        setFormData({ ...formData, lote_id: value });
                        setValorMovimento("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes?.map((lote) => (
                          <SelectItem key={lote.id} value={lote.id}>
                            Quadra {lote.quadra} - Lote {lote.numero_lote}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_mov">Data Movimento <span className="text-destructive">*</span></Label>
                    <Input
                      id="data_mov"
                      type="date"
                      value={formData.data_mov || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, data_mov: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Tipo de Movimento */}
                <div className="space-y-2">
                  <Label htmlFor="tipo_mov">Tipo Movimento <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.tipo_mov || ""}
                    onValueChange={(value) => {
                      setFormData({ ...formData, tipo_mov: value });
                      setValorMovimento("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposMovimentoFiltrados.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor e Natureza (para tipos pergunta) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor <span className="text-destructive">*</span></Label>
                    <Input
                      id="valor"
                      type="text"
                      inputMode="decimal"
                      value={valorMovimento}
                      onChange={(e) => {
                        // Permite apenas números, vírgula e ponto (formato brasileiro)
                        const value = e.target.value.replace(/[^\d.,]/g, '');
                        setValorMovimento(value);
                      }}
                      placeholder="0,00"
                      className="[appearance:textfield]"
                    />
                    <p className="text-xs text-muted-foreground">Sugestão calculada. Pode ser alterado.</p>
                  </div>
                  {getNaturezaMovimento(formData.tipo_mov || "") === "pergunta" && (
                    <div className="space-y-2">
                      <Label>Natureza <span className="text-destructive">*</span></Label>
                      <Select
                        value={formData.natureza_outros || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, natureza_outros: value as "debito" | "credito" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Débito ou Crédito?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debito">Débito (a receber)</SelectItem>
                          <SelectItem value="credito">Crédito (recebido)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Referência e Vencimento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="referencia">Referência</Label>
                    <Input
                      id="referencia"
                      value={formData.referencia || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, referencia: e.target.value })
                      }
                      placeholder="Ex: Parcela 1 de 24"
                    />
                    <p className="text-xs text-muted-foreground">Sugestão. Pode ser alterado.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vencimento">Vencimento</Label>
                    <Input
                      id="vencimento"
                      type="date"
                      value={formData.vencimento || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, vencimento: e.target.value || null })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Sugestão. Pode ser alterado.</p>
                  </div>
                </div>

                {/* Percentual de Cálculo */}
                <div className="space-y-2">
                  <Label htmlFor="percentual_calculo">Percentual de Cálculo (%)</Label>
                  <Input
                    id="percentual_calculo"
                    type="text"
                    inputMode="decimal"
                    value={formData.percentual_calculo ?? ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                        setFormData({ ...formData, percentual_calculo: val === "" ? null : (parseFloat(val) || val) as any });
                      }
                    }}
                    placeholder="Ex: 0.5"
                  />
                </div>

                {/* Campos de pagamento - apenas para Parcela Recebida e Reforço */}
                {(formData.tipo_mov === "PARCELA" || formData.tipo_mov === "REFORCO") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="modo_pagamento">Modo de Pagamento</Label>
                        <Select
                          value={formData.modo_pagamento || ""}
                          onValueChange={(value) =>
                            setFormData({ ...formData, modo_pagamento: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="TED">TED</SelectItem>
                            <SelectItem value="DEPOSITO">Depósito</SelectItem>
                            <SelectItem value="OUTRO">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="banco_origem">Banco de Origem</Label>
                        <Input
                          id="banco_origem"
                          value={formData.banco_origem || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, banco_origem: e.target.value })
                          }
                          placeholder="Ex: Banco do Brasil"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf_cnpj_pagador">CPF/CNPJ do Pagador</Label>
                      <Input
                        id="cpf_cnpj_pagador"
                        value={formData.cpf_cnpj_pagador || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, cpf_cnpj_pagador: e.target.value })
                        }
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      />
                    </div>
                  </>
                )}

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                    placeholder="Descrição do movimento"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingMov ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs para Parcelamento e Reforços */}
      <Tabs value={tipoConta} onValueChange={(v) => setTipoConta(v as TipoConta)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="PARCELAMENTO">Parcelamento</TabsTrigger>
          <TabsTrigger value="REFORCO">Reforços</TabsTrigger>
        </TabsList>
        <TabsContent value="PARCELAMENTO" className="space-y-6 mt-6">
          {renderContent()}
        </TabsContent>
        <TabsContent value="REFORCO" className="space-y-6 mt-6">
          {renderContent()}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate ATUALIZACAO Confirmation */}
      <AlertDialog open={duplicateAtualizacaoDialogOpen} onOpenChange={setDuplicateAtualizacaoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualização já existente</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma atualização monetária para este lote na referência <strong>{formData.data_mov?.substring(0, 7)}</strong>.
              Deseja substituir a atualização existente pela nova?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDuplicateAtualizacaoConfirm(false)}>
              Não, cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDuplicateAtualizacaoConfirm(true)}>
              Sim, recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
