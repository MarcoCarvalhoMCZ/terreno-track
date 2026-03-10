import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";
import { tiposMovimentoTodos } from "@/constants/movimento";

interface MapaItem {
  id: string;
  tipo_movimento: string;
  conta_contabil_id: string;
  natureza_lancamento: string;
  conta_contabil?: { id: string; codigo: string; descricao: string };
}

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
}

interface MapaForm {
  tipo_movimento: string;
  conta_contabil_id: string;
  natureza_lancamento: string;
}

const initialForm: MapaForm = {
  tipo_movimento: "",
  conta_contabil_id: "",
  natureza_lancamento: "D",
};

export default function MapaMovimentoConta() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<MapaItem | null>(null);
  const [form, setForm] = useState<MapaForm>(initialForm);

  const { data: mapa, isLoading } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*, conta_contabil:contas_contabeis(id, codigo, descricao)")
        .order("tipo_movimento");
      if (error) throw error;
      return data as unknown as MapaItem[];
    },
  });

  const { data: contas } = useQuery({
    queryKey: ["contas-contabeis-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as ContaContabil[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MapaForm) => {
      const { error } = await supabase.from("mapa_movimento_conta" as any).insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapa-movimento-conta"] });
      toast.success("Mapeamento criado!");
      handleClose();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MapaForm }) => {
      const { error } = await supabase
        .from("mapa_movimento_conta" as any)
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapa-movimento-conta"] });
      toast.success("Mapeamento atualizado!");
      handleClose();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mapa_movimento_conta" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapa-movimento-conta"] });
      toast.success("Mapeamento excluído!");
      setDeleteDialogOpen(false);
      setSelected(null);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const handleClose = () => { setDialogOpen(false); setSelected(null); setForm(initialForm); };

  const handleOpenEdit = (item: MapaItem) => {
    setSelected(item);
    setForm({
      tipo_movimento: item.tipo_movimento,
      conta_contabil_id: item.conta_contabil_id,
      natureza_lancamento: item.natureza_lancamento,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo_movimento || !form.conta_contabil_id) {
      toast.error("Tipo de movimento e conta contábil são obrigatórios");
      return;
    }
    if (selected) {
      updateMutation.mutate({ id: selected.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const getTipoLabel = (value: string) => {
    return tiposMovimentoTodos.find((t) => t.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mapa Movimento × Conta Contábil</h1>
          <p className="text-muted-foreground">Vinculação dos tipos de movimento às contas contábeis</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setSelected(null); setForm(initialForm); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Mapeamento
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapeamentos Configurados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><span className="text-muted-foreground">Carregando...</span></div>
          ) : !mapa?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum mapeamento configurado</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Movimento</TableHead>
                    <TableHead>Conta Contábil</TableHead>
                    <TableHead>Natureza</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapa.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{getTipoLabel(item.tipo_movimento)}</TableCell>
                      <TableCell>
                        {item.conta_contabil
                          ? `${item.conta_contabil.codigo} – ${item.conta_contabil.descricao}`
                          : item.conta_contabil_id}
                      </TableCell>
                      <TableCell>{item.natureza_lancamento === "D" ? "Débito" : "Crédito"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelected(item); setDeleteDialogOpen(true); }}>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar Mapeamento" : "Novo Mapeamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Movimento *</Label>
              <Select value={form.tipo_movimento} onValueChange={(v) => setForm({ ...form, tipo_movimento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {tiposMovimentoTodos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Contábil *</Label>
              <Select value={form.conta_contabil_id} onValueChange={(v) => setForm({ ...form, conta_contabil_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} – {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Natureza do Lançamento</Label>
              <Select value={form.natureza_lancamento} onValueChange={(v) => setForm({ ...form, natureza_lancamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Débito</SelectItem>
                  <SelectItem value="C">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="submit">{selected ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Deseja excluir este mapeamento?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selected && deleteMutation.mutate(selected.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
