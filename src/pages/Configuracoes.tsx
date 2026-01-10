import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Configuracao = Tables<"configuracoes">;
type ConfiguracaoUpdate = TablesUpdate<"configuracoes">;
type Pessoa = Tables<"pessoas">;

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<ConfiguracaoUpdate>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch configuração
  const { data: configuracao, isLoading: loadingConfig } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Configuracao | null;
    },
  });

  // Fetch pessoas for dropdowns
  const { data: pessoas, isLoading: loadingPessoas } = useQuery({
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

  // Initialize form when configuração is loaded
  useEffect(() => {
    if (configuracao) {
      setFormData({
        data_criacao_app: configuracao.data_criacao_app || "",
        representante_legal_pessoa_id: configuracao.representante_legal_pessoa_id || null,
        representante_legal_2_pessoa_id: (configuracao as any).representante_legal_2_pessoa_id || null,
        padrao_corretor_pessoa_id: configuracao.padrao_corretor_pessoa_id || null,
        padrao_percentual_corretagem: configuracao.padrao_percentual_corretagem || null,
        vendedor_pessoa_id: configuracao.vendedor_pessoa_id || null,
        banco: (configuracao as any).banco || "",
        agencia: (configuracao as any).agencia || "",
        conta_corrente: (configuracao as any).conta_corrente || "",
        chave_pix: (configuracao as any).chave_pix || "",
        nome_beneficiario: (configuracao as any).nome_beneficiario || "",
        cidade_beneficiario: (configuracao as any).cidade_beneficiario || "",
        observacoes: configuracao.observacoes || "",
      });
      setHasChanges(false);
    }
  }, [configuracao]);

  // Create mutation (for first time setup)
  const createMutation = useMutation({
    mutationFn: async (config: Partial<ConfiguracaoUpdate>) => {
      const { data, error } = await supabase
        .from("configuracoes")
        .insert(config)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Configurações salvas com sucesso!");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ConfiguracaoUpdate }) => {
      const { data, error } = await supabase
        .from("configuracoes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Configurações atualizadas com sucesso!");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar configurações: " + error.message);
    },
  });

  const handleChange = (field: keyof ConfiguracaoUpdate, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (configuracao) {
      updateMutation.mutate({
        id: configuracao.id,
        updates: formData as ConfiguracaoUpdate,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleReset = () => {
    if (configuracao) {
      setFormData({
        data_criacao_app: configuracao.data_criacao_app || "",
        representante_legal_pessoa_id: configuracao.representante_legal_pessoa_id || null,
        representante_legal_2_pessoa_id: (configuracao as any).representante_legal_2_pessoa_id || null,
        padrao_corretor_pessoa_id: configuracao.padrao_corretor_pessoa_id || null,
        padrao_percentual_corretagem: configuracao.padrao_percentual_corretagem || null,
        vendedor_pessoa_id: configuracao.vendedor_pessoa_id || null,
        banco: (configuracao as any).banco || "",
        agencia: (configuracao as any).agencia || "",
        conta_corrente: (configuracao as any).conta_corrente || "",
        chave_pix: (configuracao as any).chave_pix || "",
        nome_beneficiario: (configuracao as any).nome_beneficiario || "",
        cidade_beneficiario: (configuracao as any).cidade_beneficiario || "",
        observacoes: configuracao.observacoes || "",
      });
      setHasChanges(false);
    }
  };

  const getPessoaNome = (id: string | null) => {
    if (!id || !pessoas) return null;
    const pessoa = pessoas.find((p) => p.id === id);
    return pessoa?.nome_razao || null;
  };

  const isLoading = loadingConfig || loadingPessoas;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Configurações gerais do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Configurações básicas do sistema de loteamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_criacao_app">Data de Criação do App</Label>
                  <Input
                    id="data_criacao_app"
                    type="date"
                    value={formData.data_criacao_app || ""}
                    onChange={(e) => handleChange("data_criacao_app", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padrao_percentual_corretagem">
                    Percentual Padrão de Corretagem (%)
                  </Label>
                  <Input
                    id="padrao_percentual_corretagem"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.padrao_percentual_corretagem ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "padrao_percentual_corretagem",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="Ex: 5.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pessoas Padrão */}
          <Card>
            <CardHeader>
              <CardTitle>Pessoas Padrão</CardTitle>
              <CardDescription>
                Defina as pessoas padrão para uso em vendas e contratos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendedor_pessoa_id">Vendedor Padrão</Label>
                  <Select
                    value={formData.vendedor_pessoa_id || "none"}
                    onValueChange={(value) =>
                      handleChange("vendedor_pessoa_id", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
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
                  <Label htmlFor="padrao_corretor_pessoa_id">Corretor Padrão</Label>
                  <Select
                    value={formData.padrao_corretor_pessoa_id || "none"}
                    onValueChange={(value) =>
                      handleChange("padrao_corretor_pessoa_id", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um corretor" />
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
                  <Label htmlFor="representante_legal_pessoa_id">
                    Representante Legal 1
                  </Label>
                  <Select
                    value={formData.representante_legal_pessoa_id || "none"}
                    onValueChange={(value) =>
                      handleChange("representante_legal_pessoa_id", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um representante" />
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
                  <Label htmlFor="representante_legal_2_pessoa_id">
                    Representante Legal 2
                  </Label>
                  <Select
                    value={(formData as any).representante_legal_2_pessoa_id || "none"}
                    onValueChange={(value) =>
                      handleChange("representante_legal_2_pessoa_id" as any, value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um representante" />
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
            </CardContent>
          </Card>

          {/* Dados Bancários e PIX */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Bancários e PIX</CardTitle>
              <CardDescription>
                Informações bancárias e PIX para recebimento de valores e geração de QR Code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banco">Banco</Label>
                  <Input
                    id="banco"
                    value={(formData as any).banco || ""}
                    onChange={(e) => handleChange("banco" as any, e.target.value)}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agencia">Código da Agência</Label>
                  <Input
                    id="agencia"
                    value={(formData as any).agencia || ""}
                    onChange={(e) => handleChange("agencia" as any, e.target.value)}
                    placeholder="Ex: 1234-5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conta_corrente">Número da C/C</Label>
                  <Input
                    id="conta_corrente"
                    value={(formData as any).conta_corrente || ""}
                    onChange={(e) => handleChange("conta_corrente" as any, e.target.value)}
                    placeholder="Ex: 12345-6"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chave_pix">Chave PIX</Label>
                  <Input
                    id="chave_pix"
                    value={(formData as any).chave_pix || ""}
                    onChange={(e) => handleChange("chave_pix" as any, e.target.value)}
                    placeholder="CPF, CNPJ, Email ou Telefone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="nome_beneficiario">Nome do Beneficiário (PIX)</Label>
                  <Input
                    id="nome_beneficiario"
                    value={(formData as any).nome_beneficiario || ""}
                    onChange={(e) => handleChange("nome_beneficiario" as any, e.target.value)}
                    placeholder="Nome que aparecerá no QR Code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade_beneficiario">Cidade do Beneficiário (PIX)</Label>
                  <Input
                    id="cidade_beneficiario"
                    value={(formData as any).cidade_beneficiario || ""}
                    onChange={(e) => handleChange("cidade_beneficiario" as any, e.target.value)}
                    placeholder="Ex: São Paulo"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
              <CardDescription>
                Notas e observações gerais sobre o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="observacoes"
                value={formData.observacoes || ""}
                onChange={(e) => handleChange("observacoes", e.target.value)}
                placeholder="Digite observações gerais sobre o sistema..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Info Card */}
          {configuracao && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Criado em:</span>{" "}
                    {configuracao.created_at
                      ? new Date(configuracao.created_at).toLocaleString("pt-BR")
                      : "-"}
                  </div>
                  <div>
                    <span className="font-medium">Última atualização:</span>{" "}
                    {configuracao.updated_at
                      ? new Date(configuracao.updated_at).toLocaleString("pt-BR")
                      : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
