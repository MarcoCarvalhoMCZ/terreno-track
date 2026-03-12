import { useState, useMemo } from "react";
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
import { VendaDocumentos } from "@/components/VendaDocumentos";
import { toast } from "sonner";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { vendaStatusColors, vendaStatusLabels } from "@/constants/status";
import { tiposAtualizacao, type TipoAtualizacao } from "@/constants/movimento";
import type { VendaComRelacionamentos, VendaFormData, Pessoa, Indicador } from "@/types/venda.types";
import type { Lote } from "@/types/lote.types";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { LoteSearchSelect } from "@/components/LoteSearchSelect";

type VendaInsert = TablesInsert<"vendas">;
type VendaUpdate = TablesUpdate<"vendas">;

import { emptyVenda } from "@/types/venda.types";

export default function Vendas() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendaToDelete, setVendaToDelete] = useState<VendaComRelacionamentos | null>(null);
  const [editingVenda, setEditingVenda] = useState<VendaComRelacionamentos | null>(null);
  const [formData, setFormData] = useState<VendaFormData>(emptyVenda);
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
          indicador:indicadores_atualizacao(id, nome)
        `)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data as unknown as VendaComRelacionamentos[];
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

  // Helper to build lote observacoes text from venda data
  const buildLoteObservacoes = (dataVenda: string, compradorPessoaId: string, compradorNome2?: string | null): string => {
    const comprador = pessoas?.find(p => p.id === compradorPessoaId);
    const [y, m, d] = dataVenda.split("-");
    const dataFormatada = `${d}/${m}/${y}`;
    let obs = `Lote vendido em ${dataFormatada} para ${comprador?.nome_razao || "comprador"}`;
    if (compradorNome2) {
      obs += ` e ${compradorNome2}`;
    }
    return obs;
  };

  const createMutation = useMutation({
    mutationFn: async (venda: VendaInsert) => {
      // Create the venda
      const { data, error } = await supabase
        .from("vendas")
        .insert(venda)
        .select()
        .single();
      if (error) throw error;

      // Update lote status to VENDIDO and set observacoes
      const loteObs = buildLoteObservacoes(venda.data_venda, venda.comprador_pessoa_id, venda.comprador_nome_2);
      const { error: loteError } = await supabase
        .from("lotes")
        .update({ status: "VENDIDO", observacoes: loteObs, updated_at: new Date().toISOString() })
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

      // Build lote observacoes
      const loteObs = buildLoteObservacoes(
        updates.data_venda || "",
        updates.comprador_pessoa_id || "",
        updates.comprador_nome_2
      );

      // If lote changed, update old lote to DISPONIVEL and new to VENDIDO
      if (oldLoteId && updates.lote_id && oldLoteId !== updates.lote_id) {
        await supabase
          .from("lotes")
          .update({ status: "DISPONIVEL", observacoes: "", updated_at: new Date().toISOString() })
          .eq("id", oldLoteId);
        
        await supabase
          .from("lotes")
          .update({ status: "VENDIDO", observacoes: loteObs, updated_at: new Date().toISOString() })
          .eq("id", updates.lote_id);
      } else if (updates.status !== "CANCELADA") {
        // Update observacoes on current lote
        await supabase
          .from("lotes")
          .update({ observacoes: loteObs, updated_at: new Date().toISOString() })
          .eq("id", updates.lote_id || oldLoteId);
      }

      // If status changed to CANCELADA, update lote to DISPONIVEL
      if (updates.status === "CANCELADA") {
        await supabase
          .from("lotes")
          .update({ status: "DISPONIVEL", observacoes: "", updated_at: new Date().toISOString() })
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
    
    // Find pessoa ID from name if it exists (comprador solidário)
    const comprador2 = pessoas?.find(p => p.nome_razao.toUpperCase() === (venda.comprador_nome_2 || "").toUpperCase());
    
    setFormData({
      lote_id: venda.lote_id,
      data_venda: venda.data_venda,
      comprador_pessoa_id: venda.comprador_pessoa_id,
      valor_venda: venda.valor_venda,
      valor_arras: venda.valor_arras,
      indicador_atualizacao_id: venda.indicador_atualizacao_id || "",
      status: venda.status || "ATIVA",
      observacoes: venda.observacoes || "",
      tipo_atualizacao: (venda.tipo_atualizacao as TipoAtualizacao) || "IGPM",
      defasagem_indice: venda.defasagem_indice || 1,
      comprador_solidario_2_id: comprador2?.id || "",
      valor_parcelamento: venda.valor_parcelamento || undefined,
      qtd_parcelas: venda.qtd_parcelas || 1,
      frequencia_parcelas_meses: venda.frequencia_parcelas_meses || 1,
      primeiro_vencimento_parcela: (venda as any).primeiro_vencimento_parcela || "",
      valor_reforco: venda.valor_reforco || undefined,
      qtd_reforcos: venda.qtd_reforcos || undefined,
      frequencia_reforcos_meses: venda.frequencia_reforcos_meses || undefined,
      primeiro_vencimento_reforco: (venda as any).primeiro_vencimento_reforco || "",
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

    // Get name from selected pessoa for comprador solidário
    const comprador2 = pessoas?.find(p => p.id === formData.comprador_solidario_2_id);

    const dataToSave: any = {
      lote_id: formData.lote_id,
      data_venda: formData.data_venda,
      comprador_pessoa_id: formData.comprador_pessoa_id,
      valor_venda: Number(formData.valor_venda),
      valor_arras: formData.valor_arras ? Number(formData.valor_arras) : null,
      vendedor_pessoa_id: null, // Vendedor vem das configurações
      indicador_atualizacao_id: formData.indicador_atualizacao_id || null,
      status: formData.status,
      observacoes: formData.observacoes || null,
      tipo_atualizacao: formData.tipo_atualizacao || "IGPM",
      defasagem_indice: formData.defasagem_indice || 1,
      comprador_nome_1: null, // Removido - era redundante
      comprador_cpf_1: null,
      comprador_nome_2: comprador2?.nome_razao || null,
      comprador_cpf_2: comprador2?.cpf_cnpj || null,
      valor_parcelamento: formData.valor_parcelamento ? Number(formData.valor_parcelamento) : null,
      qtd_parcelas: formData.qtd_parcelas ? Number(formData.qtd_parcelas) : 1,
      frequencia_parcelas_meses: formData.frequencia_parcelas_meses ? Number(formData.frequencia_parcelas_meses) : 1,
      primeiro_vencimento_parcela: formData.primeiro_vencimento_parcela || null,
      valor_reforco: formData.valor_reforco ? Number(formData.valor_reforco) : null,
      qtd_reforcos: formData.qtd_reforcos ? Number(formData.qtd_reforcos) : null,
      frequencia_reforcos_meses: formData.frequencia_reforcos_meses ? Number(formData.frequencia_reforcos_meses) : null,
      primeiro_vencimento_reforco: formData.primeiro_vencimento_reforco || null,
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

  const { sortConfig: vendaSortConfig, handleSort: handleVendaSort, sortData: sortVendaData } = useTableSort<VendaComRelacionamentos>();

  const sortedVendas = useMemo(() => {
    if (!filteredVendas) return [];
    return sortVendaData(filteredVendas, (item, key) => {
      switch (key) {
        case "data_venda": return item.data_venda;
        case "lote": return `${item.lote?.quadra || ""} ${item.lote?.numero_lote || ""}`;
        case "comprador": return item.comprador?.nome_razao || "";
        case "valor_venda": return item.valor_venda;
        case "valor_arras": return item.valor_arras || 0;
        case "qtd_parcelas": return item.qtd_parcelas || 0;
        case "status": return item.status || "";
        default: return null;
      }
    });
  }, [filteredVendas, vendaSortConfig]);

  // Using centralized formatters from @/lib/formatters

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
                    <LoteSearchSelect
                      lotes={availableLotes}
                      value={formData.lote_id || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, lote_id: value })
                      }
                      placeholder="Selecione o lote"
                    />
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

                {/* Comprador e Comprador Solidário */}
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
                    <Label htmlFor="comprador_solidario_2_id">Comprador Solidário (opcional)</Label>
                    <Select
                      value={formData.comprador_solidario_2_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, comprador_solidario_2_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {pessoas?.map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_razao} {pessoa.cpf_cnpj ? `(${pessoa.cpf_cnpj})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                {/* Parcelamento */}
                <div className="border rounded-lg p-4 space-y-4">
                  <Label className="text-base font-semibold">Parcelamento</Label>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor_parcelamento">Valor Parcela</Label>
                      <Input
                        id="valor_parcelamento"
                        type="number"
                        step="0.01"
                        value={formData.valor_parcelamento || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valor_parcelamento: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="Ex: 5000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qtd_parcelas">Qtd. Parcelas</Label>
                      <Input
                        id="qtd_parcelas"
                        type="number"
                        min="1"
                        value={formData.qtd_parcelas || 1}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            qtd_parcelas: e.target.value ? Number(e.target.value) : 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequencia_parcelas_meses">Frequência (meses)</Label>
                      <Input
                        id="frequencia_parcelas_meses"
                        type="number"
                        min="1"
                        value={formData.frequencia_parcelas_meses || 1}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequencia_parcelas_meses: e.target.value ? Number(e.target.value) : 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primeiro_vencimento_parcela">1º Vencimento</Label>
                      <Input
                        id="primeiro_vencimento_parcela"
                        type="date"
                        value={formData.primeiro_vencimento_parcela || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            primeiro_vencimento_parcela: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Reforços */}
                <div className="border rounded-lg p-4 space-y-4">
                  <Label className="text-base font-semibold">Reforços (opcional)</Label>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor_reforco">Valor Reforço</Label>
                      <Input
                        id="valor_reforco"
                        type="number"
                        step="0.01"
                        value={formData.valor_reforco || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valor_reforco: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="Ex: 10000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qtd_reforcos">Qtd. Reforços</Label>
                      <Input
                        id="qtd_reforcos"
                        type="number"
                        min="0"
                        value={formData.qtd_reforcos || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            qtd_reforcos: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequencia_reforcos_meses">Frequência (meses)</Label>
                      <Input
                        id="frequencia_reforcos_meses"
                        type="number"
                        min="1"
                        value={formData.frequencia_reforcos_meses || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequencia_reforcos_meses: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primeiro_vencimento_reforco">1º Vencimento</Label>
                      <Input
                        id="primeiro_vencimento_reforco"
                        type="date"
                        value={formData.primeiro_vencimento_reforco || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            primeiro_vencimento_reforco: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>


                {/* Tipo de Atualização e Defasagem */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_atualizacao">Tipo de Atualização Monetária</Label>
                    <Select
                      value={formData.tipo_atualizacao || "IGPM"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tipo_atualizacao: value as TipoAtualizacao })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposAtualizacao.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defasagem_indice">Defasagem do Índice (meses)</Label>
                    <Input
                      id="defasagem_indice"
                      type="number"
                      min="1"
                      value={formData.defasagem_indice || 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defasagem_indice: e.target.value ? Number(e.target.value) : 1,
                        })
                      }
                    />
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

                {/* Documentos - só aparece ao editar */}
                {editingVenda && (
                  <VendaDocumentos vendaId={editingVenda.id} canEdit={canEdit} />
                )}

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
                    <SortableTableHead sortKey="data_venda" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>DATA</SortableTableHead>
                    <SortableTableHead sortKey="lote" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>LOTE</SortableTableHead>
                    <SortableTableHead sortKey="comprador" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>COMPRADOR</SortableTableHead>
                    <SortableTableHead sortKey="valor_venda" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>VALOR VENDA</SortableTableHead>
                    <SortableTableHead sortKey="valor_arras" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>ARRAS</SortableTableHead>
                    <SortableTableHead sortKey="qtd_parcelas" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>PARCELAS</SortableTableHead>
                    <SortableTableHead sortKey="status" currentKey={vendaSortConfig.key} direction={vendaSortConfig.direction} onSort={handleVendaSort}>STATUS</SortableTableHead>
                    {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVendas.map((venda) => (
                    <TableRow key={venda.id}>
                      <TableCell>{formatDate(venda.data_venda)}</TableCell>
                      <TableCell className="font-medium">
                        {venda.lote ? `Q${venda.lote.quadra} L${venda.lote.numero_lote}` : "-"}
                      </TableCell>
                      <TableCell>{venda.comprador?.nome_razao || "-"}</TableCell>
                      <TableCell>{formatCurrency(venda.valor_venda)}</TableCell>
                      <TableCell>{formatCurrency(venda.valor_arras)}</TableCell>
                      <TableCell>
                        {venda.qtd_parcelas ? `${venda.qtd_parcelas}x` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={vendaStatusColors[venda.status || "ATIVA"]}>
                          {vendaStatusLabels[venda.status || "ATIVA"]}
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
