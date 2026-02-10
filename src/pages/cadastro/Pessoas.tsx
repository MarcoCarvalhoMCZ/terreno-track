import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { Plus, Pencil, Trash2, Search, Users, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";

type Pessoa = Tables<"pessoas">;
type PessoaInsert = TablesInsert<"pessoas">;
type PessoaUpdate = TablesUpdate<"pessoas">;
type Endereco = Tables<"enderecos">;
type EnderecoInsert = TablesInsert<"enderecos">;

const emptyPessoa: Partial<PessoaInsert> = {
  tipo: "PF",
  nome_razao: "",
  cpf_cnpj: "",
  rg_ie: "",
  email: "",
  telefone: "",
  observacoes: "",
};

const emptyEndereco: Partial<EnderecoInsert> = {
  tipo: "residencial",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  principal: true,
};

export default function Pessoas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pessoaToDelete, setPessoaToDelete] = useState<Pessoa | null>(null);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [formData, setFormData] = useState<Partial<PessoaInsert>>(emptyPessoa);
  const [enderecoData, setEnderecoData] = useState<Partial<EnderecoInsert>>(emptyEndereco);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");

  // Fetch pessoas with their addresses
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

  // Fetch endereco for editing
  const fetchEndereco = async (pessoaId: string) => {
    const { data, error } = await supabase
      .from("enderecos")
      .select("*")
      .eq("pessoa_id", pessoaId)
      .eq("principal", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const createMutation = useMutation({
    mutationFn: async ({ pessoa, endereco }: { pessoa: PessoaInsert; endereco: Partial<EnderecoInsert> }) => {
      // First, create the pessoa
      const { data: pessoaData, error: pessoaError } = await supabase
        .from("pessoas")
        .insert(pessoa)
        .select()
        .single();
      if (pessoaError) throw pessoaError;

      // Then, create the address if any field is filled
      const hasEnderecoData = endereco.logradouro || endereco.cidade || endereco.cep;
      if (hasEnderecoData) {
        const { error: enderecoError } = await supabase
          .from("enderecos")
          .insert({
            ...endereco,
            pessoa_id: pessoaData.id,
            principal: true,
          } as EnderecoInsert);
        if (enderecoError) throw enderecoError;
      }

      return pessoaData;
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
    mutationFn: async ({ 
      id, 
      updates, 
      endereco,
      existingEnderecoId 
    }: { 
      id: string; 
      updates: PessoaUpdate; 
      endereco: Partial<EnderecoInsert>;
      existingEnderecoId?: string;
    }) => {
      // Update pessoa
      const { data, error } = await supabase
        .from("pessoas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Handle endereco update/create
      const hasEnderecoData = endereco.logradouro || endereco.cidade || endereco.cep;
      
      if (hasEnderecoData) {
        if (existingEnderecoId) {
          // Update existing address
          const { error: enderecoError } = await supabase
            .from("enderecos")
            .update({
              tipo: endereco.tipo,
              logradouro: endereco.logradouro,
              numero: endereco.numero,
              complemento: endereco.complemento,
              bairro: endereco.bairro,
              cidade: endereco.cidade,
              uf: endereco.uf,
              cep: endereco.cep,
            })
            .eq("id", existingEnderecoId);
          if (enderecoError) throw enderecoError;
        } else {
          // Create new address
          const { error: enderecoError } = await supabase
            .from("enderecos")
            .insert({
              ...endereco,
              pessoa_id: id,
              principal: true,
            } as EnderecoInsert);
          if (enderecoError) throw enderecoError;
        }
      }

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
      // First delete related addresses
      const { error: enderecoError } = await supabase
        .from("enderecos")
        .delete()
        .eq("pessoa_id", id);
      if (enderecoError) throw enderecoError;

      // Then delete the pessoa
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

  const [existingEnderecoId, setExistingEnderecoId] = useState<string | undefined>();

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPessoa(null);
    setFormData(emptyPessoa);
    setEnderecoData(emptyEndereco);
    setExistingEnderecoId(undefined);
  };

  const handleEdit = async (pessoa: Pessoa) => {
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

    // Fetch existing address
    try {
      const endereco = await fetchEndereco(pessoa.id);
      if (endereco) {
        setExistingEnderecoId(endereco.id);
        setEnderecoData({
          tipo: endereco.tipo || "residencial",
          logradouro: endereco.logradouro || "",
          numero: endereco.numero || "",
          complemento: endereco.complemento || "",
          bairro: endereco.bairro || "",
          cidade: endereco.cidade || "",
          uf: endereco.uf || "",
          cep: endereco.cep || "",
          principal: endereco.principal || true,
        });
      } else {
        setEnderecoData(emptyEndereco);
        setExistingEnderecoId(undefined);
      }
    } catch (error) {
      console.error("Erro ao carregar endereço:", error);
      setEnderecoData(emptyEndereco);
    }

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
        endereco: enderecoData,
        existingEnderecoId,
      });
    } else {
      createMutation.mutate({
        pessoa: formData as PessoaInsert,
        endereco: enderecoData,
      });
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

  const { sortConfig: pessoaSortConfig, handleSort: handlePessoaSort, sortData: sortPessoaData } = useTableSort<Pessoa>();

  const sortedPessoas = useMemo(() => {
    if (!filteredPessoas) return [];
    return sortPessoaData(filteredPessoas, (item, key) => {
      switch (key) {
        case "tipo": return item.tipo;
        case "nome_razao": return item.nome_razao;
        case "cpf_cnpj": return item.cpf_cnpj;
        case "telefone": return item.telefone;
        case "email": return item.email;
        default: return null;
      }
    });
  }, [filteredPessoas, pessoaSortConfig]);

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

  const UF_OPTIONS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

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
            <Button onClick={() => {
              setFormData(emptyPessoa);
              setEnderecoData(emptyEndereco);
              setExistingEnderecoId(undefined);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pessoa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPessoa ? "Editar Pessoa" : "Nova Pessoa"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Dados Pessoais
                </h3>
                
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
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço Principal
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endereco_tipo">Tipo</Label>
                    <Select
                      value={enderecoData.tipo || "residencial"}
                      onValueChange={(value) =>
                        setEnderecoData({ ...enderecoData, tipo: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residencial">Residencial</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="correspondencia">Correspondência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={enderecoData.cep || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, cep: e.target.value })
                      }
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2 col-span-3">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      value={enderecoData.logradouro || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, logradouro: e.target.value })
                      }
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={enderecoData.numero || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, numero: e.target.value })
                      }
                      placeholder="Nº"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={enderecoData.complemento || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, complemento: e.target.value })
                      }
                      placeholder="Apto, Sala, Bloco, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={enderecoData.bairro || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, bairro: e.target.value })
                      }
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={enderecoData.cidade || ""}
                      onChange={(e) =>
                        setEnderecoData({ ...enderecoData, cidade: e.target.value })
                      }
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Select
                      value={enderecoData.uf || ""}
                      onValueChange={(value) =>
                        setEnderecoData({ ...enderecoData, uf: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                  <SortableTableHead sortKey="tipo" currentKey={pessoaSortConfig.key} direction={pessoaSortConfig.direction} onSort={handlePessoaSort}>TIPO</SortableTableHead>
                  <SortableTableHead sortKey="nome_razao" currentKey={pessoaSortConfig.key} direction={pessoaSortConfig.direction} onSort={handlePessoaSort}>NOME / RAZÃO SOCIAL</SortableTableHead>
                  <SortableTableHead sortKey="cpf_cnpj" currentKey={pessoaSortConfig.key} direction={pessoaSortConfig.direction} onSort={handlePessoaSort}>CPF / CNPJ</SortableTableHead>
                  <SortableTableHead sortKey="telefone" currentKey={pessoaSortConfig.key} direction={pessoaSortConfig.direction} onSort={handlePessoaSort}>TELEFONE</SortableTableHead>
                  <SortableTableHead sortKey="email" currentKey={pessoaSortConfig.key} direction={pessoaSortConfig.direction} onSort={handlePessoaSort}>E-MAIL</SortableTableHead>
                  <TableHead className="text-right">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPessoas.map((pessoa) => (
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
