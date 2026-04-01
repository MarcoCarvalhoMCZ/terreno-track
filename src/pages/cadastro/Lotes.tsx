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
import { Plus, Pencil, Trash2, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatArea } from "@/lib/formatters";
import { loteStatusColors, loteStatusLabels } from "@/constants/status";
import type { Lote, LoteInsert, LoteUpdate } from "@/types/lote.types";
import { emptyLote } from "@/types/lote.types";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { AuditFooter } from "@/components/AuditFooter";

export default function Lotes() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loteToDelete, setLoteToDelete] = useState<Lote | null>(null);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [formData, setFormData] = useState<Partial<LoteInsert>>(emptyLote);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");

  const { data: lotes, isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (lote: LoteInsert) => {
      const { data, error } = await supabase
        .from("lotes")
        .insert(lote)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote cadastrado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar lote: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: LoteUpdate }) => {
      const { data, error } = await supabase
        .from("lotes")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lote: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote excluído com sucesso!");
      setDeleteDialogOpen(false);
      setLoteToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir lote: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLote(null);
    setFormData(emptyLote);
  };

  const handleEdit = (lote: Lote) => {
    setEditingLote(lote);
    setFormData({
      quadra: lote.quadra,
      numero_lote: lote.numero_lote,
      matricula_ri: lote.matricula_ri || "",
      area_m2: lote.area_m2,
      custo_contabil: lote.custo_contabil,
      etiqueta_patrimonial: lote.etiqueta_patrimonial || "",
      status: lote.status || "DISPONIVEL",
      observacoes: lote.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (lote: Lote) => {
    setLoteToDelete(lote);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (loteToDelete) {
      deleteMutation.mutate(loteToDelete.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.quadra || !formData.numero_lote) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const dataToSave = {
      ...formData,
      area_m2: formData.area_m2 ? Number(formData.area_m2) : null,
      custo_contabil: formData.custo_contabil ? Number(formData.custo_contabil) : null,
    };

    if (editingLote) {
      updateMutation.mutate({
        id: editingLote.id,
        updates: dataToSave as LoteUpdate,
      });
    } else {
      createMutation.mutate(dataToSave as LoteInsert);
    }
  };

  const filteredLotes = lotes?.filter((lote) => {
    const matchesSearch =
      lote.quadra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lote.numero_lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lote.matricula_ri?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lote.etiqueta_patrimonial?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "TODOS" || lote.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const { sortConfig: loteSortConfig, handleSort: handleLoteSort, sortData: sortLoteData } = useTableSort<Lote>();

  const sortedLotes = useMemo(() => {
    if (!filteredLotes) return [];
    return sortLoteData(filteredLotes, (item, key) => {
      switch (key) {
        case "quadra": return item.quadra;
        case "numero_lote": return item.numero_lote;
        case "matricula_ri": return item.matricula_ri;
        case "area_m2": return item.area_m2;
        case "custo_contabil": return item.custo_contabil;
        case "etiqueta_patrimonial": return item.etiqueta_patrimonial;
        case "status": return item.status;
        default: return null;
      }
    });
  }, [filteredLotes, loteSortConfig]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Lotes (Estoque)</h1>
          <p className="text-muted-foreground">
            Gerencie os lotes do loteamento
          </p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(emptyLote)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                <DialogTitle>
                  {editingLote ? "Editar Lote" : "Novo Lote"}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCloseDialog}>Cancelar</Button>
                  <Button type="submit" form="lote-form" size="sm" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingLote ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </DialogHeader>
              <form id="lote-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quadra">Quadra *</Label>
                    <Input
                      id="quadra"
                      value={formData.quadra || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, quadra: e.target.value })
                      }
                      placeholder="Ex: A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_lote">Nº Lote *</Label>
                    <Input
                      id="numero_lote"
                      value={formData.numero_lote || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, numero_lote: e.target.value })
                      }
                      placeholder="Ex: 01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="matricula_ri">Matrícula RI</Label>
                    <Input
                      id="matricula_ri"
                      value={formData.matricula_ri || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, matricula_ri: e.target.value })
                      }
                      placeholder="Nº da matrícula"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status || "DISPONIVEL"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                        <SelectItem value="RESERVADO">Reservado</SelectItem>
                        <SelectItem value="VENDIDO">Vendido</SelectItem>
                        <SelectItem value="CANCELADO">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area_m2">Área (m²)</Label>
                    <Input
                      id="area_m2"
                      type="number"
                      step="0.01"
                      value={formData.area_m2 || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, area_m2: e.target.value ? Number(e.target.value) : null })
                      }
                      placeholder="Ex: 300.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custo_contabil">Custo Contábil</Label>
                    <Input
                      id="custo_contabil"
                      type="number"
                      step="0.01"
                      value={formData.custo_contabil || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, custo_contabil: e.target.value ? Number(e.target.value) : null })
                      }
                      placeholder="Ex: 50000.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="etiqueta_patrimonial">Etiqueta Patrimonial</Label>
                  <Input
                    id="etiqueta_patrimonial"
                    value={formData.etiqueta_patrimonial || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, etiqueta_patrimonial: e.target.value })
                    }
                    placeholder="Código da etiqueta"
                  />
                </div>

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

                {editingLote && (
                  <AuditFooter
                    created_by={editingLote.created_by}
                    created_at={editingLote.created_at}
                    updated_by={editingLote.updated_by}
                    updated_at={editingLote.updated_at}
                  />
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
                    {editingLote ? "Salvar" : "Cadastrar"}
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
                placeholder="Buscar por quadra, lote, matrícula ou etiqueta..."
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
                <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                <SelectItem value="RESERVADO">Reservado</SelectItem>
                <SelectItem value="VENDIDO">Vendido</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Lotes Cadastrados ({filteredLotes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredLotes && filteredLotes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="quadra" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>QUADRA</SortableTableHead>
                  <SortableTableHead sortKey="numero_lote" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>LOTE</SortableTableHead>
                  <SortableTableHead sortKey="matricula_ri" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>MATRÍCULA RI</SortableTableHead>
                  <SortableTableHead sortKey="area_m2" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>ÁREA</SortableTableHead>
                  <SortableTableHead sortKey="custo_contabil" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>CUSTO CONTÁBIL</SortableTableHead>
                  <SortableTableHead sortKey="etiqueta_patrimonial" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>ETIQUETA</SortableTableHead>
                  <SortableTableHead sortKey="status" currentKey={loteSortConfig.key} direction={loteSortConfig.direction} onSort={handleLoteSort}>STATUS</SortableTableHead>
                  {canEdit && <TableHead className="text-right">AÇÕES</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell className="font-medium">{lote.quadra}</TableCell>
                    <TableCell>{lote.numero_lote}</TableCell>
                    <TableCell>{lote.matricula_ri || "-"}</TableCell>
                    <TableCell>{formatArea(lote.area_m2)}</TableCell>
                    <TableCell>{formatCurrency(lote.custo_contabil)}</TableCell>
                    <TableCell>{lote.etiqueta_patrimonial || "-"}</TableCell>
                    <TableCell>
                      <Badge className={loteStatusColors[lote.status || "DISPONIVEL"]}>
                        {loteStatusLabels[lote.status || "DISPONIVEL"]}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lote)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(lote)}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lote cadastrado
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
              Tem certeza que deseja excluir o lote "Quadra {loteToDelete?.quadra} - Lote {loteToDelete?.numero_lote}"? Esta
              ação não pode ser desfeita.
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
