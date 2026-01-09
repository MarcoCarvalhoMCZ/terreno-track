import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, TrendingUp } from "lucide-react";

interface Indicador {
  id: string;
  nome: string;
  descricao: string | null;
  regra: string | null;
  periodicidade: string | null;
  ativo: boolean | null;
  created_at: string | null;
}

interface IndicadorForm {
  nome: string;
  descricao: string;
  regra: string;
  periodicidade: string;
  ativo: boolean;
}

const initialForm: IndicadorForm = {
  nome: "",
  descricao: "",
  regra: "",
  periodicidade: "mensal",
  ativo: true,
};

const periodicidadeOptions = [
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
  { value: "diario", label: "Diário" },
  { value: "outro", label: "Outro" },
];

export default function Indicadores() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndicador, setSelectedIndicador] = useState<Indicador | null>(null);
  const [form, setForm] = useState<IndicadorForm>(initialForm);

  // Fetch indicadores
  const { data: indicadores, isLoading } = useQuery({
    queryKey: ["indicadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Indicador[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: IndicadorForm) => {
      const { error } = await supabase.from("indicadores_atualizacao").insert({
        nome: data.nome,
        descricao: data.descricao || null,
        regra: data.regra || null,
        periodicidade: data.periodicidade || null,
        ativo: data.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicadores"] });
      toast.success("Indicador criado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao criar indicador: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: IndicadorForm }) => {
      const { error } = await supabase
        .from("indicadores_atualizacao")
        .update({
          nome: data.nome,
          descricao: data.descricao || null,
          regra: data.regra || null,
          periodicidade: data.periodicidade || null,
          ativo: data.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicadores"] });
      toast.success("Indicador atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar indicador: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("indicadores_atualizacao")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicadores"] });
      toast.success("Indicador excluído com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedIndicador(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir indicador: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedIndicador(null);
    setForm(initialForm);
  };

  const handleOpenCreate = () => {
    setSelectedIndicador(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (indicador: Indicador) => {
    setSelectedIndicador(indicador);
    setForm({
      nome: indicador.nome,
      descricao: indicador.descricao || "",
      regra: indicador.regra || "",
      periodicidade: indicador.periodicidade || "mensal",
      ativo: indicador.ativo ?? true,
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (indicador: Indicador) => {
    setSelectedIndicador(indicador);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (selectedIndicador) {
      updateMutation.mutate({ id: selectedIndicador.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = () => {
    if (selectedIndicador) {
      deleteMutation.mutate(selectedIndicador.id);
    }
  };

  // Filter indicadores
  const filteredIndicadores = indicadores?.filter((indicador) => {
    const searchLower = search.toLowerCase();
    return (
      indicador.nome.toLowerCase().includes(searchLower) ||
      indicador.descricao?.toLowerCase().includes(searchLower) ||
      indicador.periodicidade?.toLowerCase().includes(searchLower)
    );
  });

  const getPeriodicidadeLabel = (value: string | null) => {
    return periodicidadeOptions.find((p) => p.value === value)?.label || value || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Indicadores de Atualização</h1>
          <p className="text-muted-foreground">
            Índices de correção monetária para atualização de valores
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Indicador
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lista de Indicadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="text-muted-foreground">Carregando...</span>
            </div>
          ) : filteredIndicadores?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum indicador encontrado</p>
              {canEdit && (
                <Button variant="link" onClick={handleOpenCreate}>
                  Criar primeiro indicador
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndicadores?.map((indicador) => (
                    <TableRow key={indicador.id}>
                      <TableCell className="font-medium">{indicador.nome}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {indicador.descricao || "-"}
                      </TableCell>
                      <TableCell>{getPeriodicidadeLabel(indicador.periodicidade)}</TableCell>
                      <TableCell>
                        <Badge variant={indicador.ativo ? "default" : "secondary"}>
                          {indicador.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(indicador)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDelete(indicador)}
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
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedIndicador ? "Editar Indicador" : "Novo Indicador"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: INCC, IPCA, Sem atualização..."
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                placeholder="Descrição do indicador"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodicidade">Periodicidade</Label>
              <Select
                value={form.periodicidade}
                onValueChange={(value) => setForm({ ...form, periodicidade: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a periodicidade" />
                </SelectTrigger>
                <SelectContent>
                  {periodicidadeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="regra">Regra de Aplicação</Label>
              <Textarea
                id="regra"
                placeholder="Descreva como o índice é aplicado..."
                value={form.regra}
                onChange={(e) => setForm({ ...form, regra: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
              />
              <Label htmlFor="ativo">Indicador ativo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o indicador "{selectedIndicador?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
