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
import { Shield, Save, RefreshCw, Upload, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { AuditFooter } from "@/components/AuditFooter";

type Configuracao = Tables<"configuracoes">;
type ConfiguracaoUpdate = TablesUpdate<"configuracoes">;
type Pessoa = Tables<"pessoas">;

type FormData = Partial<ConfiguracaoUpdate>;

const OWNER_EMAIL = "bruno@leonhardt.com.br";

export default function Administrador() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditProprietaria = user?.email === OWNER_EMAIL;

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

  const populateForm = (c: Configuracao): FormData => ({
    razao_social_proprietaria: (c as any).razao_social_proprietaria || "",
    cnpj_proprietaria: (c as any).cnpj_proprietaria || "",
    crc_rs_proprietaria: (c as any).crc_rs_proprietaria || "",
    cidade_uf_proprietaria: (c as any).cidade_uf_proprietaria || "",
    telefone_proprietaria: (c as any).telefone_proprietaria || "",
    email_proprietaria: (c as any).email_proprietaria || "",
    logotipo_url: (c as any).logotipo_url || "",
    data_criacao_app: c.data_criacao_app || "",
    desenvolvedor_analista: (c as any).desenvolvedor_analista || "",
    vendedor_pessoa_id: c.vendedor_pessoa_id || null,
    representante_legal_pessoa_id: c.representante_legal_pessoa_id || null,
    representante_legal_2_pessoa_id: (c as any).representante_legal_2_pessoa_id || null,
    padrao_corretor_pessoa_id: c.padrao_corretor_pessoa_id || null,
    padrao_percentual_corretagem: c.padrao_percentual_corretagem ?? null,
    observacoes: c.observacoes || "",
  });

  useEffect(() => {
    if (configuracao) {
      setFormData(populateForm(configuracao));
      setHasChanges(false);
    }
  }, [configuracao]);

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
      toast.success("Configurações administrativas atualizadas!");
      setHasChanges(false);
    },
    onError: (error) => toast.error("Erro ao atualizar: " + error.message),
  });

  const createMutation = useMutation({
    mutationFn: async (config: FormData) => {
      const { data, error } = await supabase.from("configuracoes").insert(config).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Configurações criadas!");
      setHasChanges(false);
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message),
  });

  const handleChange = (field: string, value: string | number | null) => {
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
    if (!file.type.startsWith("image/")) { toast.error("O arquivo deve ser uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("O arquivo deve ter no máximo 2MB"); return; }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logotipo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logotipos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logotipos").getPublicUrl(fileName);
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

  const handleRemoveLogo = () => handleChange("logotipo_url", null);

  const isLoading = loadingConfig || loadingPessoas;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Administrador
          </h1>
          <p className="text-muted-foreground">
            Configurações de uso exclusivo do administrador.
          </p>
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
          {/* Empresa Proprietária */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Empresa Proprietária
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
                <div className="space-y-2">
                  <Label>Data de Criação do App</Label>
                  <Input
                    type="date"
                    value={formData.data_criacao_app || ""}
                    onChange={(e) => handleChange("data_criacao_app", e.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
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
                  <Label>Percentual Padrão de Corretagem (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={formData.padrao_percentual_corretagem ?? ""}
                    onChange={(e) =>
                      handleChange("padrao_percentual_corretagem", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="Ex: 5.00"
                  />
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

          {configuracao && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <AuditFooter
                  created_by={configuracao.created_by}
                  created_at={configuracao.created_at}
                  updated_by={configuracao.updated_by}
                  updated_at={configuracao.updated_at}
                />
              </CardContent>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
