import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { AuditFooter } from "@/components/AuditFooter";

interface ContaContabil {
  id: string;
  codigo: string;
  codigo_estruturado: string | null;
  descricao: string;
  tipo_conta: string | null;
  natureza_saldo: string | null;
  ativo: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

interface ContaForm {
  codigo: string;
  codigo_estruturado: string;
  descricao: string;
  tipo_conta: string;
  natureza_saldo: string;
  ativo: boolean;
}

const initialForm: ContaForm = {
  codigo: "",
  codigo_estruturado: "",
  descricao: "",
  tipo_conta: "Ativo",
  natureza_saldo: "Devedor",
  ativo: true,
};

const tipoContaOptions = ["Ativo", "Passivo", "Receita", "Despesa"];
const naturezaSaldoOptions = ["Devedor", "Credor"];

export default function ContasContabeis() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<ContaContabil | null>(null);
  const [form, setForm] = useState<ContaForm>(initialForm);

  const { data: contas, isLoading } = useQuery({
    queryKey: ["contas-contabeis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_contabeis")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data as unknown as ContaContabil[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContaForm) => {
      const { error } = await supabase.from("contas_contabeis").insert({
        codigo: data.codigo,
        codigo_estruturado: data.codigo_estruturado || null,
        descricao: data.descricao,
        tipo_conta: data.tipo_conta,
        natureza_saldo: data.natureza_saldo,
        ativo: data.ativo,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-contabeis"] });
      toast.success("Conta contábil criada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => toast.error("Erro ao criar: " + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContaForm }) => {
      const { error } = await supabase
        .from("contas_contabeis")
        .update({
          codigo: data.codigo,
          codigo_estruturado: data.codigo_estruturado || null,
          descricao: data.descricao,
          tipo_conta: data.tipo_conta,
          natureza_saldo: data.natureza_saldo,
          ativo: data.ativo,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-contabeis"] });
      toast.success("Conta contábil atualizada!");
      handleCloseDialog();
    },
    onError: (error) => toast.error("Erro ao atualizar: " + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_contabeis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-contabeis"] });
      toast.success("Conta contábil excluída!");
      setDeleteDialogOpen(false);
      setSelected(null);
    },
    onError: (error) => toast.error("Erro ao excluir: " + error.message),
  });

  const handleCloseDialog = () => { setDialogOpen(false); setSelected(null); setForm(initialForm); };

  const handleOpenCreate = () => { setSelected(null); setForm(initialForm); setDialogOpen(true); };

  const handleOpenEdit = (conta: ContaContabil) => {
    setSelected(conta);
    setForm({
      codigo: conta.codigo,
      codigo_estruturado: conta.codigo_estruturado || "",
      descricao: conta.descricao,
      tipo_conta: conta.tipo_conta || "Ativo",
      natureza_saldo: conta.natureza_saldo || "Devedor",
      ativo: conta.ativo ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.descricao.trim()) {
      toast.error("Código reduzido e nome da conta são obrigatórios");
      return;
    }
    if (selected) {
      updateMutation.mutate({ id: selected.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filtered = contas?.filter((c) => {
    const s = search.toLowerCase();
    return c.codigo.toLowerCase().includes(s) || c.descricao.toLowerCase().includes(s) ||
      (c.codigo_estruturado || "").toLowerCase().includes(s);
  });

  const { sortConfig, handleSort, sortData } = useTableSort<ContaContabil>();
  const sorted = useMemo(() => {
    if (!filtered) return [];
    return sortData(filtered, (item, key) => {
      switch (key) {
        case "codigo": return item.codigo;
        case "codigo_estruturado": return item.codigo_estruturado;
        case "descricao": return item.descricao;
        case "tipo_conta": return item.tipo_conta;
        case "natureza_saldo": return item.natureza_saldo;
        default: return null;
      }
    });
  }, [filtered, sortConfig]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plano de Contas</h1>
          <p className="text-muted-foreground">Cadastro de contas contábeis do loteamento</p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Contas Contábeis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por código ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><span className="text-muted-foreground">Carregando...</span></div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma conta contábil encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="codigo" currentKey={sortConfig.key} direction={sortConfig.direction} onSort={handleSort}>Cód. Reduzido</SortableTableHead>
                    <SortableTableHead sortKey="codigo_estruturado" currentKey={sortConfig.key} direction={sortConfig.direction} onSort={handleSort}>Cód. Estruturado</SortableTableHead>
                    <SortableTableHead sortKey="descricao" currentKey={sortConfig.key} direction={sortConfig.direction} onSort={handleSort}>Nome da Conta</SortableTableHead>
                    <SortableTableHead sortKey="tipo_conta" currentKey={sortConfig.key} direction={sortConfig.direction} onSort={handleSort}>Tipo</SortableTableHead>
                    <SortableTableHead sortKey="natureza_saldo" currentKey={sortConfig.key} direction={sortConfig.direction} onSort={handleSort}>Natureza</SortableTableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-mono font-medium">{conta.codigo}</TableCell>
                      <TableCell className="font-mono">{conta.codigo_estruturado || "-"}</TableCell>
                      <TableCell>{conta.descricao}</TableCell>
                      <TableCell>{conta.tipo_conta || "-"}</TableCell>
                      <TableCell>{conta.natureza_saldo || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={conta.ativo ? "default" : "secondary"}>
                          {conta.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(conta)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelected(conta); setDeleteDialogOpen(true); }}>
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

      {/* Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar Conta Contábil" : "Nova Conta Contábil"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código Reduzido *</Label>
                <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="101" />
              </div>
              <div className="space-y-2">
                <Label>Código Estruturado</Label>
                <Input value={form.codigo_estruturado} onChange={(e) => setForm({ ...form, codigo_estruturado: e.target.value })} placeholder="1.1.01" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Estoque de Terrenos" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo da Conta</Label>
                <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipoContaOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Natureza do Saldo</Label>
                <Select value={form.natureza_saldo} onValueChange={(v) => setForm({ ...form, natureza_saldo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {naturezaSaldoOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
            {selected && (
              <AuditFooter
                created_by={selected.created_by}
                created_at={selected.created_at}
                updated_by={selected.updated_by}
                updated_at={selected.updated_at}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
              <Button type="submit">{selected ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir a conta "{selected?.descricao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
