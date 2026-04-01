import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, TrendingUp, Calendar, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parse, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { AuditFooter } from "@/components/AuditFooter";

interface Indicador {
  id: string;
  nome: string;
  descricao: string | null;
  regra: string | null;
  periodicidade: string | null;
  ativo: boolean | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface IndicadorValor {
  id: string;
  indicador_id: string | null;
  competencia: string;
  fator: number;
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

// Nomes dos indicadores principais que terão valores mensais
const INDICADORES_NOMES = ["IGPM", "INCC", "INPC", "IPCA"];

export default function Indicadores() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "indicadores";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndicador, setSelectedIndicador] = useState<Indicador | null>(null);
  const [form, setForm] = useState<IndicadorForm>(initialForm);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = useState<{ indicadorId: string; competencia: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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

  // Fetch valores for current year
  const { data: valores, isLoading: isLoadingValores } = useQuery({
    queryKey: ["indicadores-valores", currentYear],
    queryFn: async () => {
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      const { data, error } = await supabase
        .from("indicadores_atualizacao_valores")
        .select("*")
        .gte("competencia", startDate)
        .lte("competencia", endDate)
        .order("competencia");
      if (error) throw error;
      return data as IndicadorValor[];
    },
  });

  // Get indicadores principais (IGPM, INCC, INPC, IPCA)
  const indicadoresPrincipais = indicadores?.filter(ind => 
    INDICADORES_NOMES.includes(ind.nome.toUpperCase())
  ) || [];

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

  // Upsert valor mutation
  const upsertValorMutation = useMutation({
    mutationFn: async ({ indicadorId, competencia, fator }: { indicadorId: string; competencia: string; fator: number }) => {
      // Check if exists
      const existing = valores?.find(v => v.indicador_id === indicadorId && v.competencia === competencia);
      
      if (existing) {
        const { error } = await supabase
          .from("indicadores_atualizacao_valores")
          .update({ fator, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("indicadores_atualizacao_valores")
          .insert({ indicador_id: indicadorId, competencia, fator });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicadores-valores"] });
      toast.success("Valor salvo com sucesso!");
      setEditingCell(null);
      setEditValue("");
    },
    onError: (error) => {
      toast.error("Erro ao salvar valor: " + error.message);
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

  const { sortConfig: indSortConfig, handleSort: handleIndSort, sortData: sortIndData } = useTableSort<Indicador>();
  const sortedIndicadores = useMemo(() => {
    if (!filteredIndicadores) return [];
    return sortIndData(filteredIndicadores, (item, key) => {
      switch (key) {
        case "nome": return item.nome;
        case "descricao": return item.descricao;
        case "periodicidade": return item.periodicidade;
        case "status": return item.ativo ? "Ativo" : "Inativo";
        default: return null;
      }
    });
  }, [filteredIndicadores, indSortConfig]);

  const getPeriodicidadeLabel = (value: string | null) => {
    return periodicidadeOptions.find((p) => p.value === value)?.label || value || "-";
  };

  // Generate months for the current year
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(currentYear, i, 1);
    return {
      value: format(date, "yyyy-MM-dd"),
      label: format(date, "MMM", { locale: ptBR }).toUpperCase(),
      fullLabel: format(date, "MMMM/yyyy", { locale: ptBR }),
    };
  });

  // Get valor for a specific indicador and competencia
  const getValor = (indicadorId: string, competencia: string): number | null => {
    const valor = valores?.find(v => v.indicador_id === indicadorId && v.competencia === competencia);
    return valor?.fator ?? null;
  };

  // Calculate média for a specific competência
  const getMedia = (competencia: string): number | null => {
    const valoresDoMes = indicadoresPrincipais
      .map(ind => getValor(ind.id, competencia))
      .filter((v): v is number => v !== null);
    
    if (valoresDoMes.length === 0) return null;
    return valoresDoMes.reduce((a, b) => a + b, 0) / valoresDoMes.length;
  };

  const handleCellClick = (indicadorId: string, competencia: string) => {
    if (!canEdit) return;
    const currentValue = getValor(indicadorId, competencia);
    setEditingCell({ indicadorId, competencia });
    setEditValue(currentValue !== null ? currentValue.toString() : "");
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const fator = parseFloat(editValue.replace(",", "."));
    if (isNaN(fator)) {
      toast.error("Valor inválido");
      return;
    }
    upsertValorMutation.mutate({
      indicadorId: editingCell.indicadorId,
      competencia: editingCell.competencia,
      fator,
    });
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const formatFator = (fator: number | null): string => {
    if (fator === null) return "-";
    return `${fator.toFixed(2)}%`;
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

      <Tabs defaultValue={tabFromUrl} className="space-y-4">
        <TabsList>
          <TabsTrigger value="indicadores">
            <TrendingUp className="mr-2 h-4 w-4" />
            Indicadores
          </TabsTrigger>
          <TabsTrigger value="valores">
            <Calendar className="mr-2 h-4 w-4" />
            Valores Mensais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores">
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
                        <SortableTableHead sortKey="nome" currentKey={indSortConfig.key} direction={indSortConfig.direction} onSort={handleIndSort}>Nome</SortableTableHead>
                        <SortableTableHead sortKey="descricao" currentKey={indSortConfig.key} direction={indSortConfig.direction} onSort={handleIndSort}>Descrição</SortableTableHead>
                        <SortableTableHead sortKey="periodicidade" currentKey={indSortConfig.key} direction={indSortConfig.direction} onSort={handleIndSort}>Periodicidade</SortableTableHead>
                        <SortableTableHead sortKey="status" currentKey={indSortConfig.key} direction={indSortConfig.direction} onSort={handleIndSort}>Status</SortableTableHead>
                        {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedIndicadores.map((indicador) => (
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
        </TabsContent>

        <TabsContent value="valores">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Valores Mensais - {currentYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentYear(y => y - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-semibold min-w-[60px] text-center">{currentYear}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentYear(y => y + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {indicadoresPrincipais.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Cadastre os indicadores IGPM, INCC, INPC e IPCA para gerenciar os valores mensais
                  </p>
                  {canEdit && (
                    <Button variant="link" onClick={handleOpenCreate}>
                      Criar indicador
                    </Button>
                  )}
                </div>
              ) : isLoadingValores ? (
                <div className="flex justify-center py-8">
                  <span className="text-muted-foreground">Carregando...</span>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">
                          Indicador
                        </TableHead>
                        {months.map((month) => (
                          <TableHead key={month.value} className="text-center min-w-[110px]">
                            {month.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indicadoresPrincipais.map((indicador) => (
                        <TableRow key={indicador.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {indicador.nome}
                          </TableCell>
                          {months.map((month) => {
                            const isEditing = editingCell?.indicadorId === indicador.id && 
                                              editingCell?.competencia === month.value;
                            const valor = getValor(indicador.id, month.value);
                            
                            return (
                              <TableCell 
                                key={month.value} 
                                className={`text-center cursor-pointer hover:bg-muted/50 transition-colors ${
                                  canEdit ? "cursor-pointer" : ""
                                }`}
                                onClick={() => !isEditing && handleCellClick(indicador.id, month.value)}
                              >
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleCellKeyDown}
                                      onBlur={() => {
                                        if (editValue !== "") handleCellSave();
                                        else { setEditingCell(null); setEditValue(""); }
                                      }}
                                      className="h-8 w-24 text-center text-xs"
                                      placeholder="0.00000000"
                                    />
                                  </div>
                                ) : (
                                  <span className={
                                    valor === null 
                                      ? "text-muted-foreground" 
                                      : valor < 0 
                                        ? "text-red-600 font-medium" 
                                        : ""
                                  }>
                                    {formatFator(valor)}
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* Linha da Média */}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell className="sticky left-0 bg-muted/30 z-10">
                          MÉDIA
                        </TableCell>
                        {months.map((month) => {
                          const media = getMedia(month.value);
                          return (
                            <TableCell key={month.value} className="text-center">
                              <span className={media !== null && media < 0 ? "text-red-600 font-medium" : ""}>
                                {formatFator(media)}
                              </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {canEdit && indicadoresPrincipais.length > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  💡 Clique em uma célula para editar o valor. Pressione Enter para salvar ou Esc para cancelar.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle>
              {selectedIndicador ? "Editar Indicador" : "Novo Indicador"}
            </DialogTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseDialog}>Cancelar</Button>
              <Button type="submit" form="indicador-form" size="sm" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogHeader>
          <form id="indicador-form" onSubmit={handleSubmit} className="space-y-4">
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

            {selectedIndicador && (
              <AuditFooter
                created_by={selectedIndicador.created_by}
                created_at={selectedIndicador.created_at}
                updated_by={selectedIndicador.updated_by}
                updated_at={selectedIndicador.updated_at}
              />
            )}

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
