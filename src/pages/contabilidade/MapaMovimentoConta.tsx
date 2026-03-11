import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Link2, PlusCircle, Info } from "lucide-react";
import { tiposMovimentoTodos } from "@/constants/movimento";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface MapaItem {
  id: string;
  tipo_movimento: string;
  conta_debito_id: string | null;
  conta_credito_id: string | null;
  historico_padrao: string | null;
  lancamento_pai_id: string | null;
  conta_debito?: { id: string; codigo: string; descricao: string } | null;
  conta_credito?: { id: string; codigo: string; descricao: string } | null;
}

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
}

interface MapaForm {
  tipo_movimento: string;
  conta_debito_id: string;
  conta_credito_id: string;
  historico_padrao: string;
}

const NONE = "__NONE__";

const initialForm: MapaForm = {
  tipo_movimento: "",
  conta_debito_id: NONE,
  conta_credito_id: NONE,
  historico_padrao: "",
};

const PLACEHOLDERS_HELP = [
  { placeholder: "{comprador}", desc: "Nome do comprador" },
  { placeholder: "{quadra}", desc: "Quadra do lote" },
  { placeholder: "{lote}", desc: "Número do lote" },
  { placeholder: "{data_venda}", desc: "Data da venda" },
  { placeholder: "{valor_venda}", desc: "Valor da venda" },
  { placeholder: "{valor}", desc: "Valor do lançamento" },
  { placeholder: "{parcela}", desc: "Nº da parcela" },
];

export default function MapaMovimentoConta() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<MapaItem | null>(null);
  const [form, setForm] = useState<MapaForm>(initialForm);
  const [isSecondEntry, setIsSecondEntry] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);

  const { data: mapa, isLoading } = useQuery({
    queryKey: ["mapa-movimento-conta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_movimento_conta" as any)
        .select("*, conta_debito:contas_contabeis!mapa_movimento_conta_conta_debito_id_fkey(id, codigo, descricao), conta_credito:contas_contabeis!mapa_movimento_conta_conta_credito_id_fkey(id, codigo, descricao)")
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
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("mapa_movimento_conta" as any).insert(data);
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
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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

  const handleClose = () => {
    setDialogOpen(false);
    setSelected(null);
    setForm(initialForm);
    setIsSecondEntry(false);
    setParentId(null);
  };

  const handleOpenCreate = () => {
    setSelected(null);
    setForm(initialForm);
    setIsSecondEntry(false);
    setParentId(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: MapaItem) => {
    setSelected(item);
    setForm({
      tipo_movimento: item.tipo_movimento,
      conta_debito_id: item.conta_debito_id || NONE,
      conta_credito_id: item.conta_credito_id || NONE,
      historico_padrao: item.historico_padrao || "",
    });
    setIsSecondEntry(!!item.lancamento_pai_id);
    setParentId(item.lancamento_pai_id);
    setDialogOpen(true);
  };

  const handleOpenSecondEntry = (parent: MapaItem) => {
    setSelected(null);
    setForm({
      tipo_movimento: parent.tipo_movimento,
      conta_debito_id: NONE,
      conta_credito_id: NONE,
      historico_padrao: "",
    });
    setIsSecondEntry(true);
    setParentId(parent.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const debitoId = form.conta_debito_id === NONE ? null : form.conta_debito_id;
    const creditoId = form.conta_credito_id === NONE ? null : form.conta_credito_id;

    if (!form.tipo_movimento || (!debitoId && !creditoId)) {
      toast.error("Tipo de movimento e pelo menos uma conta são obrigatórios");
      return;
    }

    const payload: any = {
      tipo_movimento: form.tipo_movimento,
      conta_debito_id: debitoId,
      conta_credito_id: creditoId,
      historico_padrao: form.historico_padrao || null,
      lancamento_pai_id: isSecondEntry ? parentId : null,
    };

    if (selected) {
      updateMutation.mutate({ id: selected.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getTipoLabel = (value: string) => {
    return tiposMovimentoTodos.find((t) => t.value === value)?.label || value;
  };

  const getContaLabel = (conta: { codigo: string; descricao: string } | null | undefined) => {
    if (!conta) return "—";
    return `${conta.codigo} – ${conta.descricao}`;
  };

  // Organize: parent entries first, then children beneath
  const parentEntries = mapa?.filter((m) => !m.lancamento_pai_id) || [];
  const childEntries = mapa?.filter((m) => !!m.lancamento_pai_id) || [];

  const getChildOf = (parentId: string) =>
    childEntries.find((c) => c.lancamento_pai_id === parentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mapa Movimento × Conta Contábil</h1>
          <p className="text-muted-foreground">Partidas Dobradas — Vinculação dos tipos de movimento às contas contábeis</p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenCreate}>
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
          ) : !parentEntries.length ? (
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
                    <TableHead>Conta Débito</TableHead>
                    <TableHead>Conta Crédito</TableHead>
                    <TableHead>Histórico</TableHead>
                    {canEdit && <TableHead className="w-[140px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parentEntries.map((item) => {
                    const child = getChildOf(item.id);
                    return (
                      <>
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {getTipoLabel(item.tipo_movimento)}
                            {child && <span className="text-xs text-muted-foreground ml-1">(1º)</span>}
                          </TableCell>
                          <TableCell>{getContaLabel(item.conta_debito)}</TableCell>
                          <TableCell>{getContaLabel(item.conta_credito)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {item.historico_padrao || "—"}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {!child && (
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenSecondEntry(item)} title="Adicionar 2º lançamento">
                                    <PlusCircle className="h-4 w-4 text-primary" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => { setSelected(item); setDeleteDialogOpen(true); }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        {child && (
                          <TableRow key={child.id} className="bg-muted/30">
                            <TableCell className="pl-8 font-medium text-muted-foreground">
                              ↳ {getTipoLabel(child.tipo_movimento)} <span className="text-xs">(2º lanç.)</span>
                            </TableCell>
                            <TableCell>{getContaLabel(child.conta_debito)}</TableCell>
                            <TableCell>{getContaLabel(child.conta_credito)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {child.historico_padrao || "—"}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(child)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setSelected(child); setDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )}
                      </>
                    );
                  })}
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
            <DialogTitle>
              {selected ? "Editar Mapeamento" : isSecondEntry ? "2º Lançamento" : "Novo Mapeamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Movimento *</Label>
              <Select
                value={form.tipo_movimento}
                onValueChange={(v) => setForm({ ...form, tipo_movimento: v })}
                disabled={isSecondEntry}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {tiposMovimentoTodos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Débito</Label>
              <Select value={form.conta_debito_id} onValueChange={(v) => setForm({ ...form, conta_debito_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {contas?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} – {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Crédito</Label>
              <Select value={form.conta_credito_id} onValueChange={(v) => setForm({ ...form, conta_credito_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {contas?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} – {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Histórico Padrão</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-semibold mb-1">Variáveis disponíveis:</p>
                      {PLACEHOLDERS_HELP.map((p) => (
                        <p key={p.placeholder} className="text-xs">
                          <code className="font-mono">{p.placeholder}</code> → {p.desc}
                        </p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                value={form.historico_padrao}
                onChange={(e) => setForm({ ...form, historico_padrao: e.target.value })}
                placeholder="Ex: Venda do lote {quadra}-{lote} para {comprador}"
                rows={3}
              />
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
