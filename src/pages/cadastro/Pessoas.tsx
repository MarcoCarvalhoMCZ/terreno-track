import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Pessoa = Tables<"pessoas">;
type PessoaInsert = TablesInsert<"pessoas">;
type PessoaUpdate = TablesUpdate<"pessoas">;

const emptyPessoa: Partial<PessoaInsert> = {
  tipo: "PF",
  nome_razao: "",
  cpf_cnpj: "",
  rg_ie: "",
  email: "",
  telefone: "",
  observacoes: "",
};

export default function Pessoas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pessoaToDelete, setPessoaToDelete] = useState<Pessoa | null>(null);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [formData, setFormData] = useState<Partial<PessoaInsert>>(emptyPessoa);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");

  const { data: pessoas, isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (pessoa: PessoaInsert) => {
      const { data, error } = await supabase
        .from("pessoas")
        .insert(pessoa)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa cadastrada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar pessoa: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PessoaUpdate }) => {
      const { data, error } = await supabase
        .from("pessoas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa atualizada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar pessoa: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pessoas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa excluída com sucesso!");
      setDeleteDialogOpen(false);
      setPessoaToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir pessoa: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPessoa(null);
    setFormData(emptyPessoa);
  };

  const handleEdit = (pessoa: Pessoa) => {
    setEditingPessoa(pessoa);
    setFormData({
      tipo: pessoa.tipo,
      nome_razao: pessoa.nome_razao,
      cpf_cnpj: pessoa.cpf_cnpj || "",
      rg_ie: pessoa.rg_ie || "",
      email: pessoa.email || "",
      telefone: pessoa.telefone || "",
      observacoes: pessoa.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (pessoa: Pessoa) => {
    setPessoaToDelete(pessoa);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (pessoaToDelete) {
      deleteMutation.mutate(pessoaToDelete.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_razao || !formData.tipo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (editingPessoa) {
      updateMutation.mutate({
        id: editingPessoa.id,
        updates: formData as PessoaUpdate,
      });
    } else {
      createMutation.mutate(formData as PessoaInsert);
    }
  };

  const filteredPessoas = pessoas?.filter((pessoa) => {
    const matchesSearch =
      pessoa.nome_razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.cpf_cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = filterTipo === "TODOS" || pessoa.tipo === filterTipo;
    return matchesSearch && matchesTipo;
  });

  const formatDocument = (tipo: string, doc: string | null) => {
    if (!doc) return "-";
    if (tipo === "PF" && doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (tipo === "PJ" && doc.length === 14) {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pessoas (PF/PJ)</h1>
          <p className="text-muted-foreground">
            Cadastro de pessoas físicas e jurídicas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(emptyPessoa)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pessoa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPessoa ? "Editar Pessoa" : "Nova Pessoa"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipo: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PF">Pessoa Física</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj">
                    {formData.tipo === "PJ" ? "CNPJ" : "CPF"}
                  </Label>
                  <Input
                    id="cpf_cnpj"
                    value={formData.cpf_cnpj || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, cpf_cnpj: e.target.value })
                    }
                    placeholder={formData.tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_razao">
                  {formData.tipo === "PJ" ? "Razão Social *" : "Nome Completo *"}
                </Label>
                <Input
                  id="nome_razao"
                  value={formData.nome_razao || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome_razao: e.target.value })
                  }
                  placeholder={formData.tipo === "PJ" ? "Razão Social da Empresa" : "Nome Completo"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rg_ie">
                    {formData.tipo === "PJ" ? "Inscrição Estadual" : "RG"}
                  </Label>
                  <Input
                    id="rg_ie"
                    value={formData.rg_ie || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, rg_ie: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
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
                  {editingPessoa ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pessoas Cadastradas ({filteredPessoas?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredPessoas && filteredPessoas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TIPO</TableHead>
                  <TableHead>NOME / RAZÃO SOCIAL</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>TELEFONE</TableHead>
                  <TableHead>E-MAIL</TableHead>
                  <TableHead className="text-right">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPessoas.map((pessoa) => (
                  <TableRow key={pessoa.id}>
                    <TableCell>
                      <Badge
                        variant={pessoa.tipo === "PJ" ? "secondary" : "default"}
                        className={
                          pessoa.tipo === "PJ"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }
                      >
                        {pessoa.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {pessoa.nome_razao}
                    </TableCell>
                    <TableCell>
                      {formatDocument(pessoa.tipo, pessoa.cpf_cnpj)}
                    </TableCell>
                    <TableCell>{pessoa.telefone || "-"}</TableCell>
                    <TableCell>{pessoa.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(pessoa)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(pessoa)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma pessoa cadastrada
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
              Tem certeza que deseja excluir "{pessoaToDelete?.nome_razao}"? Esta
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
