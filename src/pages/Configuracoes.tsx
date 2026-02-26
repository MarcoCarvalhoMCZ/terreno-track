import { useState, useEffect, useRef } from "react";
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
import { Settings, Save, RefreshCw, Upload, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Configuracao = Tables<"configuracoes">;
type ConfiguracaoUpdate = TablesUpdate<"configuracoes">;
type Pessoa = Tables<"pessoas">;

interface ConfiguracaoFormData extends Partial<ConfiguracaoUpdate> {
  juros_mora_percentual?: number | null;
  multa_mora_percentual?: number | null;
  criterio_juros_mora?: string | null;
  tolerancia_dias_juros?: number | null;
  desenvolvedor_analista?: string | null;
  razao_social_proprietaria?: string | null;
  cnpj_proprietaria?: string | null;
  crc_rs_proprietaria?: string | null;
  cidade_uf_proprietaria?: string | null;
  telefone_proprietaria?: string | null;
  email_proprietaria?: string | null;
  logotipo_url?: string | null;
}

const OWNER_EMAIL = "bruno@leonhardt.com.br";

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState<ConfiguracaoFormData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditProprietaria = user?.email === OWNER_EMAIL;

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

  const populateForm = (config: Configuracao) => ({
    data_criacao_app: config.data_criacao_app || "",
    representante_legal_pessoa_id: config.representante_legal_pessoa_id || null,
    representante_legal_2_pessoa_id: (config as any).representante_legal_2_pessoa_id || null,
    padrao_corretor_pessoa_id: config.padrao_corretor_pessoa_id || null,
    padrao_percentual_corretagem: config.padrao_percentual_corretagem || null,
    vendedor_pessoa_id: config.vendedor_pessoa_id || null,
    banco: (config as any).banco || "",
    agencia: (config as any).agencia || "",
    conta_corrente: (config as any).conta_corrente || "",
    chave_pix: (config as any).chave_pix || "",
    nome_beneficiario: (config as any).nome_beneficiario || "",
    cidade_beneficiario: (config as any).cidade_beneficiario || "",
    observacoes: config.observacoes || "",
    juros_mora_percentual: (config as any).juros_mora_percentual ?? 1.0,
    multa_mora_percentual: (config as any).multa_mora_percentual ?? 2.0,
    criterio_juros_mora: (config as any).criterio_juros_mora || "MES_SUBSEQUENTE",
    tolerancia_dias_juros: (config as any).tolerancia_dias_juros ?? 0,
    desenvolvedor_analista: (config as any).desenvolvedor_analista || "",
    razao_social_proprietaria: (config as any).razao_social_proprietaria || "",
    cnpj_proprietaria: (config as any).cnpj_proprietaria || "",
    crc_rs_proprietaria: (config as any).crc_rs_proprietaria || "",
    cidade_uf_proprietaria: (config as any).cidade_uf_proprietaria || "",
    telefone_proprietaria: (config as any).telefone_proprietaria || "",
    email_proprietaria: (config as any).email_proprietaria || "",
    logotipo_url: (config as any).logotipo_url || "",
  });

  useEffect(() => {
    if (configuracao) {
      setFormData(populateForm(configuracao));
      setHasChanges(false);
    }
  }, [configuracao]);

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

  const handleChange = (field: keyof ConfiguracaoUpdate | string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (configuracao) {
      updateMutation.mutate({ id: configuracao.id, updates: formData as ConfiguracaoUpdate });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleReset = () => {
    if (configuracao) {
      setFormData(populateForm(configuracao));
      setHasChanges(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo deve ser uma imagem");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logotipo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logotipos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logotipos")
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl + "?t=" + Date.now();
      handleChange("logotipo_url", logoUrl);
      toast.success("Logotipo enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar logotipo: " + error.message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    handleChange("logotipo_url", null);
  };

  const isLoading = loadingConfig || loadingPessoas;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Configurações gerais do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados da Proprietária */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Proprietária
              </CardTitle>
              <CardDescription>
                Informações da empresa proprietária do sistema
                {!canEditProprietaria && (
                  <span className="ml-2 text-destructive font-medium">
                    (somente editável pelo administrador principal)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label>Logotipo</Label>
                <div className="flex items-center gap-4">
                  {(formData as any).logotipo_url ? (
                    <div className="relative">
                      <img
                        src={(formData as any).logotipo_url}
                        alt="Logotipo"
                        className="h-16 w-16 object-contain rounded border border-border"
                      />
                      {canEditProprietaria && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  {canEditProprietaria && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo ? "Enviando..." : "Enviar Logotipo"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Máx 2MB.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input
                    value={(formData as any).razao_social_proprietaria || ""}
                    onChange={(e) => handleChange("razao_social_proprietaria", e.target.value)}
                    placeholder="Razão Social da empresa"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={(formData as any).cnpj_proprietaria || ""}
                    onChange={(e) => handleChange("cnpj_proprietaria", e.target.value)}
                    placeholder="00.000.000/0000-00"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CRC-RS</Label>
                  <Input
                    value={(formData as any).crc_rs_proprietaria || ""}
                    onChange={(e) => handleChange("crc_rs_proprietaria", e.target.value)}
                    placeholder="CRC-RS da empresa"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade/UF</Label>
                  <Input
                    value={(formData as any).cidade_uf_proprietaria || ""}
                    onChange={(e) => handleChange("cidade_uf_proprietaria", e.target.value)}
                    placeholder="Ex: Porto Alegre/RS"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={(formData as any).telefone_proprietaria || ""}
                    onChange={(e) => handleChange("telefone_proprietaria", e.target.value)}
                    placeholder="(00) 00000-0000"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={(formData as any).email_proprietaria || ""}
                    onChange={(e) => handleChange("email_proprietaria", e.target.value)}
                    placeholder="email@empresa.com"
                    disabled={!canEditProprietaria}
                  />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label>Desenvolvedor / Analista</Label>
                  <Input
                    value={(formData as any).desenvolvedor_analista || ""}
                    onChange={(e) => handleChange("desenvolvedor_analista", e.target.value)}
                    placeholder="Nome do desenvolvedor ou analista responsável"
                    disabled={!canEditProprietaria}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>Configurações básicas do sistema de loteamento</CardDescription>
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
                  <Label htmlFor="padrao_percentual_corretagem">Percentual Padrão de Corretagem (%)</Label>
                  <Input
                    id="padrao_percentual_corretagem"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.padrao_percentual_corretagem ?? ""}
                    onChange={(e) =>
                      handleChange("padrao_percentual_corretagem", e.target.value ? parseFloat(e.target.value) : null)
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
              <CardDescription>Defina as pessoas padrão para uso em vendas e contratos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vendedor Padrão</Label>
                  <Select
                    value={formData.vendedor_pessoa_id || "none"}
                    onValueChange={(value) => handleChange("vendedor_pessoa_id", value === "none" ? null : value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um vendedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {pessoas?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_razao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Corretor Padrão</Label>
                  <Select
                    value={formData.padrao_corretor_pessoa_id || "none"}
                    onValueChange={(value) => handleChange("padrao_corretor_pessoa_id", value === "none" ? null : value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um corretor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {pessoas?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_razao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Representante Legal 1</Label>
                  <Select
                    value={formData.representante_legal_pessoa_id || "none"}
                    onValueChange={(value) => handleChange("representante_legal_pessoa_id", value === "none" ? null : value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um representante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {pessoas?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_razao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Representante Legal 2</Label>
                  <Select
                    value={(formData as any).representante_legal_2_pessoa_id || "none"}
                    onValueChange={(value) => handleChange("representante_legal_2_pessoa_id", value === "none" ? null : value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um representante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {pessoas?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_razao}</SelectItem>)}
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
              <CardDescription>Informações bancárias e PIX para recebimento de valores e geração de QR Code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input value={(formData as any).banco || ""} onChange={(e) => handleChange("banco", e.target.value)} placeholder="Ex: Banco do Brasil" />
                </div>
                <div className="space-y-2">
                  <Label>Código da Agência</Label>
                  <Input value={(formData as any).agencia || ""} onChange={(e) => handleChange("agencia", e.target.value)} placeholder="Ex: 1234-5" />
                </div>
                <div className="space-y-2">
                  <Label>Número da C/C</Label>
                  <Input value={(formData as any).conta_corrente || ""} onChange={(e) => handleChange("conta_corrente", e.target.value)} placeholder="Ex: 12345-6" />
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input value={(formData as any).chave_pix || ""} onChange={(e) => handleChange("chave_pix", e.target.value)} placeholder="CPF, CNPJ, Email ou Telefone" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Nome do Beneficiário (PIX)</Label>
                  <Input value={(formData as any).nome_beneficiario || ""} onChange={(e) => handleChange("nome_beneficiario", e.target.value)} placeholder="Nome que aparecerá no QR Code" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade do Beneficiário (PIX)</Label>
                  <Input value={(formData as any).cidade_beneficiario || ""} onChange={(e) => handleChange("cidade_beneficiario", e.target.value)} placeholder="Ex: São Paulo" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Mora */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Mora (Atraso)</CardTitle>
              <CardDescription>Defina os parâmetros para cálculo de juros e multa por atraso de pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Juros de Mora (% ao mês)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={(formData as any).juros_mora_percentual ?? ""}
                    onChange={(e) => handleChange("juros_mora_percentual", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ex: 1.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Multa por Atraso (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={(formData as any).multa_mora_percentual ?? ""}
                    onChange={(e) => handleChange("multa_mora_percentual", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ex: 2.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critério de Cálculo de Juros</Label>
                  <Select
                    value={(formData as any).criterio_juros_mora || "MES_SUBSEQUENTE"}
                    onValueChange={(value) => handleChange("criterio_juros_mora", value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o critério" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MES_SUBSEQUENTE">Após mês subsequente ao vencimento</SelectItem>
                      <SelectItem value="TOLERANCIA">Tolerância em dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Tolerância (dias)
                    {(formData as any).criterio_juros_mora !== "TOLERANCIA" && (
                      <span className="text-muted-foreground text-xs ml-1">(desabilitado)</span>
                    )}
                  </Label>
                  <Input
                    type="number" step="1" min="0" max="365"
                    disabled={(formData as any).criterio_juros_mora !== "TOLERANCIA"}
                    value={(formData as any).tolerancia_dias_juros ?? ""}
                    onChange={(e) => handleChange("tolerancia_dias_juros", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Ex: 5"
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <strong>Nota:</strong>{" "}
                {(formData as any).criterio_juros_mora === "TOLERANCIA"
                  ? <>Os juros serão calculados após {(formData as any).tolerancia_dias_juros || 0} dia(s) do vencimento.</>
                  : <>Os juros serão calculados a partir do primeiro dia do mês subsequente ao vencimento.</>}
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
              <CardDescription>Notas e observações gerais sobre o sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
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
                    {configuracao.created_at ? new Date(configuracao.created_at).toLocaleString("pt-BR") : "-"}
                  </div>
                  <div>
                    <span className="font-medium">Última atualização:</span>{" "}
                    {configuracao.updated_at ? new Date(configuracao.updated_at).toLocaleString("pt-BR") : "-"}
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
