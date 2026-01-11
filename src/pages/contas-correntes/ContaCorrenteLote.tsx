import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type ContaCorrente = Tables<"conta_corrente_lote">;
type ContaCorrenteInsert = TablesInsert<"conta_corrente_lote">;
type ContaCorrenteUpdate = TablesUpdate<"conta_corrente_lote">;
type Lote = Tables<"lotes">;
type Venda = Tables<"vendas">;

interface ContaCorrenteComRelacionamentos extends ContaCorrente {
  lote?: Lote;
  venda?: Venda;
}

// Tipos de movimento conforme constraint do banco: VENDA, ARRAS, PARCELA, REFORCO, JUROS, MULTA, ATUALIZACAO, DESCONTO, ESTORNO, OUTROS
// Convenção: débito = valores faturados, crédito = valores recebidos
const tiposMovimento = [
  { value: "VENDA", label: "Venda do Lote", natureza: "debito" as const },
  { value: "PARCELA", label: "Parcela Recebida", natureza: "credito" as const },
  { value: "ARRAS", label: "Sinal / Arras", natureza: "credito" as const },
  { value: "REFORCO", label: "Reforço", natureza: "credito" as const },
  { value: "ATUALIZACAO", label: "Atualização Monetária", natureza: "debito" as const },
  { value: "JUROS", label: "Juros", natureza: "debito" as const },
  { value: "MULTA", label: "Multa", natureza: "debito" as const },
  { value: "DESCONTO", label: "Desconto", natureza: "credito" as const },
  { value: "ESTORNO", label: "Estorno", natureza: "pergunta" as const },
  { value: "OUTROS", label: "Outros", natureza: "pergunta" as const },
];

type NaturezaMovimento = "debito" | "credito" | "pergunta";

const getNaturezaMovimento = (tipoMov: string): NaturezaMovimento => {
  const tipo = tiposMovimento.find(t => t.value === tipoMov);
  return tipo?.natureza || "pergunta";
};

const emptyMovimento: Partial<ContaCorrenteInsert> & { natureza_outros?: "debito" | "credito" } = {
  lote_id: "",
  data_mov: new Date().toISOString().split("T")[0],
  tipo_mov: "PARCELA",
  descricao: "",
  credito: null,
  debito: null,
  referencia: "",
  vencimento: null,
  percentual_calculo: null,
  venda_id: null,
  natureza_outros: undefined,
};

// Tipos que se aplicam a cada conta
const tiposParcelamento = ["VENDA", "PARCELA", "ARRAS", "ATUALIZACAO", "JUROS", "MULTA", "DESCONTO", "ESTORNO", "OUTROS"];
const tiposReforco = ["REFORCO", "ATUALIZACAO", "JUROS", "MULTA", "DESCONTO", "ESTORNO", "OUTROS"];

type TipoConta = "PARCELAMENTO" | "REFORCO";

export default function ContaCorrenteLote() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movToDelete, setMovToDelete] = useState<ContaCorrenteComRelacionamentos | null>(null);
  const [editingMov, setEditingMov] = useState<ContaCorrenteComRelacionamentos | null>(null);
  const [formData, setFormData] = useState<Partial<ContaCorrenteInsert> & { natureza_outros?: "debito" | "credito" }>(emptyMovimento);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLote, setFilterLote] = useState<string>("TODOS");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [valorMovimento, setValorMovimento] = useState<string>("");
  const [tipoConta, setTipoConta] = useState<TipoConta>("PARCELAMENTO");

  // Fetch movimentações
  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ["conta-corrente-lote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select(`
          *,
          lote:lotes(id, quadra, numero_lote),
          venda:vendas(id, data_venda)
        `)
        .order("data_mov", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContaCorrenteComRelacionamentos[];
    },
  });

  // Fetch lotes
  const { data: lotes } = useQuery({
    queryKey: ["lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as Lote[];
    },
  });

  // Fetch vendas
  const { data: vendas } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, lote:lotes(quadra, numero_lote)")
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (mov: ContaCorrenteInsert) => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .insert(mov)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-consolidado"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-por-lote"] });
      toast.success("Movimentação cadastrada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar movimentação: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ContaCorrenteUpdate }) => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-consolidado"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-por-lote"] });
      toast.success("Movimentação atualizada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar movimentação: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conta_corrente_lote").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-consolidado"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-por-lote"] });
      toast.success("Movimentação excluída com sucesso!");
      setDeleteDialogOpen(false);
      setMovToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir movimentação: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMov(null);
    setFormData(emptyMovimento);
    setValorMovimento("");
  };

  const handleEdit = (mov: ContaCorrenteComRelacionamentos) => {
    setEditingMov(mov);
    // Determinar qual valor usar e a natureza
    const valor = mov.debito || mov.credito || 0;
    const natureza = mov.debito ? "debito" : "credito";
    setValorMovimento(valor.toString());
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação com mensagens específicas
    const camposFaltando: string[] = [];
    if (!formData.lote_id) camposFaltando.push("Lote");
    if (!formData.data_mov) camposFaltando.push("Data Movimento");
    if (!formData.tipo_mov) camposFaltando.push("Tipo Movimento");
    
    const valor = parseFloat(valorMovimento);
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
    } else {
      naturezaFinal = naturezaDoTipo;
    }

    // Preparar dados - remover natureza_outros que não existe no banco
    const { natureza_outros, ...formDataSemNatureza } = formData;
    
    const dataToSave = {
      ...formDataSemNatureza,
      tipo_fluxo: tipoConta, // Novo campo para separação PARCELAMENTO/REFORCO
      debito: naturezaFinal === "debito" ? valor : null,
      credito: naturezaFinal === "credito" ? valor : null,
      percentual_calculo: formData.percentual_calculo ? Number(formData.percentual_calculo) : null,
      venda_id: formData.venda_id || null,
    };

    if (editingMov) {
      updateMutation.mutate({
        id: editingMov.id,
        updates: dataToSave as ContaCorrenteUpdate,
      });
    } else {
      createMutation.mutate(dataToSave as ContaCorrenteInsert);
    }
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

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null) => {
    return formatDateBR(date);
  };

  const getTipoLabel = (tipo: string) => {
    return tiposMovimento.find((t) => t.value === tipo)?.label || tipo;
  };

  // Get vendas for selected lote
  const vendasDoLote = vendas?.filter((v) => v.lote_id === formData.lote_id);

  // Get tipos de movimento baseado no tipo de conta selecionado
  const tiposMovimentoFiltrados = tiposMovimento.filter(t => 
    tipoConta === "PARCELAMENTO" 
      ? tiposParcelamento.includes(t.value)
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
                {tiposMovimentoFiltrados.map((tipo) => (
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
                    <TableHead>DATA</TableHead>
                    <TableHead>LOTE</TableHead>
                    <TableHead>TIPO</TableHead>
                    <TableHead>DESCRIÇÃO</TableHead>
                    <TableHead>REFERÊNCIA</TableHead>
                    <TableHead className="text-right">DÉBITO</TableHead>
                    <TableHead className="text-right">CRÉDITO</TableHead>
                    <TableHead className="text-right">SALDO</TableHead>
                    {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoesComSaldo.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>{formatDate(mov.data_mov)}</TableCell>
                      <TableCell className="font-medium">
                        {mov.lote ? `Q${mov.lote.quadra} L${mov.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTipoLabel(mov.tipo_mov)}
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
              <Button onClick={() => setFormData(emptyMovimento)}>
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
                {/* Lote e Data */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote_id">Lote <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.lote_id || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, lote_id: value, venda_id: null })
                      }
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

                {/* Tipo e Venda */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_mov">Tipo Movimento <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.tipo_mov || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tipo_mov: value })
                      }
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
                  <div className="space-y-2">
                    <Label htmlFor="venda_id">Venda (opcional)</Label>
                    <Select
                      value={formData.venda_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, venda_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a venda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {vendasDoLote?.map((v: any) => (
                          <SelectItem key={v.id} value={v.id}>
                            {formatDateBR(v.data_venda)} - Q{v.lote?.quadra} L{v.lote?.numero_lote}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Valor e Natureza (para tipos pergunta) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor <span className="text-destructive">*</span></Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorMovimento}
                      onChange={(e) => setValorMovimento(e.target.value)}
                      placeholder="0,00"
                    />
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
                  </div>
                </div>

                {/* Percentual de Cálculo */}
                <div className="space-y-2">
                  <Label htmlFor="percentual_calculo">Percentual de Cálculo (%)</Label>
                  <Input
                    id="percentual_calculo"
                    type="number"
                    step="0.0001"
                    value={formData.percentual_calculo || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, percentual_calculo: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="Ex: 0.5"
                  />
                </div>

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
    </div>
  );
}
