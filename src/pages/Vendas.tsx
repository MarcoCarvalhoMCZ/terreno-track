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
import { Plus, Pencil, Trash2, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Venda = Tables<"vendas">;
type VendaInsert = TablesInsert<"vendas">;
type VendaUpdate = TablesUpdate<"vendas">;
type Lote = Tables<"lotes">;
type Pessoa = Tables<"pessoas">;
type Indicador = Tables<"indicadores_atualizacao">;
type ContaRecebimento = Tables<"contas_recebimento_vendedor">;

interface VendaComRelacionamentos extends Venda {
  lote?: Lote;
  comprador?: Pessoa;
  vendedor?: Pessoa;
  corretor?: Pessoa;
  indicador?: Indicador;
  conta_recebimento?: ContaRecebimento;
}

const statusColors: Record<string, string> = {
  ATIVA: "bg-success text-success-foreground",
  QUITADA: "bg-info text-info-foreground",
  INADIMPLENTE: "bg-warning text-warning-foreground",
  CANCELADA: "bg-destructive text-destructive-foreground",
};

const statusLabels: Record<string, string> = {
  ATIVA: "Ativa",
  QUITADA: "Quitada",
  INADIMPLENTE: "Inadimplente",
  CANCELADA: "Cancelada",
};

const emptyVenda: Partial<VendaInsert> = {
  lote_id: "",
  data_venda: new Date().toISOString().split("T")[0],
  comprador_pessoa_id: "",
  vendedor_pessoa_id: "",
  corretor_pessoa_id: "",
  percentual_corretagem: null,
  valor_venda: 0,
  valor_arras: null,
  indicador_atualizacao_id: "",
  conta_recebimento_vendedor_id: "",
  status: "ATIVA",
  observacoes: "",
};

export default function Vendas() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendaToDelete, setVendaToDelete] = useState<VendaComRelacionamentos | null>(null);
  const [editingVenda, setEditingVenda] = useState<VendaComRelacionamentos | null>(null);
  const [formData, setFormData] = useState<Partial<VendaInsert>>(emptyVenda);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");

  // Fetch vendas with relationships
  const { data: vendas, isLoading } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(`
          *,
          lote:lotes(id, quadra, numero_lote),
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(id, nome_razao),
          vendedor:pessoas!vendas_vendedor_pessoa_id_fkey(id, nome_razao),
          corretor:pessoas!vendas_corretor_pessoa_id_fkey(id, nome_razao),
          indicador:indicadores_atualizacao(id, nome),
          conta_recebimento:contas_recebimento_vendedor(id, descricao)
        `)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data as VendaComRelacionamentos[];
    },
  });

  // Fetch lotes disponíveis
  const { data: lotes } = useQuery({
    queryKey: ["lotes-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .in("status", ["DISPONIVEL", "RESERVADO"])
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as Lote[];
    },
  });

  // Fetch all lotes for editing
  const { data: todosLotes } = useQuery({
    queryKey: ["lotes-todos"],
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

  // Fetch pessoas
  const { data: pessoas } = useQuery({
    queryKey: ["pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("*")
        .order("nome_razao");
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  // Fetch indicadores
  const { data: indicadores } = useQuery({
    queryKey: ["indicadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Indicador[];
    },
  });

  // Fetch contas recebimento
  const { data: contasRecebimento } = useQuery({
    queryKey: ["contas-recebimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_recebimento_vendedor")
        .select("*")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return data as ContaRecebimento[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (venda: VendaInsert) => {
      // Create the venda
      const { data, error } = await supabase
        .from("vendas")
        .insert(venda)
        .select()
        .single();
      if (error) throw error;

      // Update lote status to VENDIDO
      const { error: loteError } = await supabase
        .from("lotes")
        .update({ status: "VENDIDO", updated_at: new Date().toISOString() })
        .eq("id", venda.lote_id);
      if (loteError) throw loteError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-todos"] });
      toast.success("Venda cadastrada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar venda: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates, oldLoteId }: { id: string; updates: VendaUpdate; oldLoteId?: string }) => {
      const { data, error } = await supabase
        .from("vendas")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // If lote changed, update old lote to DISPONIVEL and new to VENDIDO
      if (oldLoteId && updates.lote_id && oldLoteId !== updates.lote_id) {
        await supabase
          .from("lotes")
          .update({ status: "DISPONIVEL", updated_at: new Date().toISOString() })
          .eq("id", oldLoteId);
        
        await supabase
          .from("lotes")
          .update({ status: "VENDIDO", updated_at: new Date().toISOString() })
          .eq("id", updates.lote_id);
      }

      // If status changed to CANCELADA, update lote to DISPONIVEL
      if (updates.status === "CANCELADA") {
        await supabase
          .from("lotes")
          .update({ status: "DISPONIVEL", updated_at: new Date().toISOString() })
          .eq("id", updates.lote_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-todos"] });
      toast.success("Venda atualizada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar venda: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (venda: VendaComRelacionamentos) => {
      const { error } = await supabase.from("vendas").delete().eq("id", venda.id);
      if (error) throw error;

      // Update lote status back to DISPONIVEL
      await supabase
        .from("lotes")
        .update({ status: "DISPONIVEL", updated_at: new Date().toISOString() })
        .eq("id", venda.lote_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-todos"] });
      toast.success("Venda excluída com sucesso!");
      setDeleteDialogOpen(false);
      setVendaToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir venda: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVenda(null);
    setFormData(emptyVenda);
  };

  const handleEdit = (venda: VendaComRelacionamentos) => {
    setEditingVenda(venda);
    setFormData({
      lote_id: venda.lote_id,
      data_venda: venda.data_venda,
      comprador_pessoa_id: venda.comprador_pessoa_id,
      vendedor_pessoa_id: venda.vendedor_pessoa_id || "",
      corretor_pessoa_id: venda.corretor_pessoa_id || "",
      percentual_corretagem: venda.percentual_corretagem,
      valor_venda: venda.valor_venda,
      valor_arras: venda.valor_arras,
      indicador_atualizacao_id: venda.indicador_atualizacao_id || "",
      conta_recebimento_vendedor_id: venda.conta_recebimento_vendedor_id || "",
      status: venda.status || "ATIVA",
      observacoes: venda.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (venda: VendaComRelacionamentos) => {
    setVendaToDelete(venda);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (vendaToDelete) {
      deleteMutation.mutate(vendaToDelete);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lote_id || !formData.comprador_pessoa_id || !formData.data_venda || !formData.valor_venda) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const dataToSave = {
      ...formData,
      valor_venda: Number(formData.valor_venda),
      valor_arras: formData.valor_arras ? Number(formData.valor_arras) : null,
      percentual_corretagem: formData.percentual_corretagem ? Number(formData.percentual_corretagem) : null,
      vendedor_pessoa_id: formData.vendedor_pessoa_id || null,
      corretor_pessoa_id: formData.corretor_pessoa_id || null,
      indicador_atualizacao_id: formData.indicador_atualizacao_id || null,
      conta_recebimento_vendedor_id: formData.conta_recebimento_vendedor_id || null,
    };

    if (editingVenda) {
      updateMutation.mutate({
        id: editingVenda.id,
        updates: dataToSave as VendaUpdate,
        oldLoteId: editingVenda.lote_id,
      });
    } else {
      createMutation.mutate(dataToSave as VendaInsert);
    }
  };

  const filteredVendas = vendas?.filter((venda) => {
    const loteInfo = `${venda.lote?.quadra || ""} ${venda.lote?.numero_lote || ""}`.toLowerCase();
    const compradorNome = venda.comprador?.nome_razao?.toLowerCase() || "";
    const matchesSearch =
      loteInfo.includes(searchTerm.toLowerCase()) ||
      compradorNome.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "TODOS" || venda.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy");
  };

  const formatPercent = (value: number | null) => {
    if (!value) return "-";
    return `${value}%`;
  };

  // Get available lotes for selection (include current lote when editing)
  const availableLotes = editingVenda
    ? [...(lotes || []), ...(todosLotes?.filter(l => l.id === editingVenda.lote_id) || [])]
    : lotes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Gestão de vendas de lotes</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(emptyVenda)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVenda ? "Editar Venda" : "Nova Venda"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Lote e Data */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote_id">Lote *</Label>
                    <Select
                      value={formData.lote_id || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, lote_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLotes?.map((lote) => (
                          <SelectItem key={lote.id} value={lote.id}>
                            Quadra {lote.quadra} - Lote {lote.numero_lote}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_venda">Data da Venda *</Label>
                    <Input
                      id="data_venda"
                      type="date"
                      value={formData.data_venda || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, data_venda: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Comprador e Vendedor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comprador_pessoa_id">Comprador *</Label>
                    <Select
                      value={formData.comprador_pessoa_id || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, comprador_pessoa_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o comprador" />
                      </SelectTrigger>
                      <SelectContent>
                        {pessoas?.map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_razao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendedor_pessoa_id">Vendedor</Label>
                    <Select
                      value={formData.vendedor_pessoa_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, vendedor_pessoa_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {pessoas?.map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_razao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Corretor e Percentual */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="corretor_pessoa_id">Corretor</Label>
                    <Select
                      value={formData.corretor_pessoa_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, corretor_pessoa_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o corretor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {pessoas?.map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_razao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentual_corretagem">% Corretagem</Label>
                    <Input
                      id="percentual_corretagem"
                      type="number"
                      step="0.01"
                      value={formData.percentual_corretagem || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          percentual_corretagem: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Ex: 5.00"
                    />
                  </div>
                </div>

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valor_venda">Valor da Venda *</Label>
                    <Input
                      id="valor_venda"
                      type="number"
                      step="0.01"
                      value={formData.valor_venda || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valor_venda: e.target.value ? Number(e.target.value) : 0,
                        })
                      }
                      placeholder="Ex: 100000.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_arras">Valor das Arras (Sinal)</Label>
                    <Input
                      id="valor_arras"
                      type="number"
                      step="0.01"
                      value={formData.valor_arras || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valor_arras: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Ex: 10000.00"
                    />
                  </div>
                </div>

                {/* Indicador e Conta Recebimento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="indicador_atualizacao_id">Índice de Atualização</Label>
                    <Select
                      value={formData.indicador_atualizacao_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, indicador_atualizacao_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o indicador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {indicadores?.map((indicador) => (
                          <SelectItem key={indicador.id} value={indicador.id}>
                            {indicador.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta_recebimento_vendedor_id">Conta de Recebimento</Label>
                    <Select
                      value={formData.conta_recebimento_vendedor_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, conta_recebimento_vendedor_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {contasRecebimento?.map((conta) => (
                          <SelectItem key={conta.id} value={conta.id}>
                            {conta.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || "ATIVA"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVA">Ativa</SelectItem>
                      <SelectItem value="QUITADA">Quitada</SelectItem>
                      <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                      <SelectItem value="CANCELADA">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, observacoes: e.target.value })
                    }
                    rows={3}
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
                    {editingVenda ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por lote ou comprador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="ATIVA">Ativa</SelectItem>
                <SelectItem value="QUITADA">Quitada</SelectItem>
                <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Vendas Registradas ({filteredVendas?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredVendas && filteredVendas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DATA</TableHead>
                    <TableHead>LOTE</TableHead>
                    <TableHead>COMPRADOR</TableHead>
                    <TableHead>VALOR VENDA</TableHead>
                    <TableHead>ARRAS</TableHead>
                    <TableHead>CORRETAGEM</TableHead>
                    <TableHead>STATUS</TableHead>
                    {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendas.map((venda) => (
                    <TableRow key={venda.id}>
                      <TableCell>{formatDate(venda.data_venda)}</TableCell>
                      <TableCell className="font-medium">
                        {venda.lote ? `Q${venda.lote.quadra} L${venda.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>{venda.comprador?.nome_razao || "-"}</TableCell>
                      <TableCell>{formatCurrency(venda.valor_venda)}</TableCell>
                      <TableCell>{formatCurrency(venda.valor_arras)}</TableCell>
                      <TableCell>{formatPercent(venda.percentual_corretagem)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[venda.status || "ATIVA"]}>
                          {statusLabels[venda.status || "ATIVA"]}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(venda)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(venda)}
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
              Nenhuma venda registrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta venda do lote{" "}
              {vendaToDelete?.lote ? `Q${vendaToDelete.lote.quadra} L${vendaToDelete.lote.numero_lote}` : ""}?
              O lote voltará ao status "Disponível". Esta ação não pode ser desfeita.
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
