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
import { Settings, Save, RefreshCw, Mail, Info, History } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { AuditFooter } from "@/components/AuditFooter";
import { MensagemExtratoHistoricoDialog } from "@/components/MensagemExtratoHistoricoDialog";

type Configuracao = Tables<"configuracoes">;
type ConfiguracaoUpdate = TablesUpdate<"configuracoes">;

type FormData = Partial<ConfiguracaoUpdate>;

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const { data: configuracao, isLoading } = useQuery({
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

  const populateForm = (c: Configuracao): FormData => ({
    banco: (c as any).banco || "",
    agencia: (c as any).agencia || "",
    conta_corrente: (c as any).conta_corrente || "",
    chave_pix: (c as any).chave_pix || "",
    nome_beneficiario: (c as any).nome_beneficiario || "",
    cidade_beneficiario: (c as any).cidade_beneficiario || "",
    juros_mora_percentual: (c as any).juros_mora_percentual ?? 1.0,
    multa_mora_percentual: (c as any).multa_mora_percentual ?? 2.0,
    criterio_juros_mora: (c as any).criterio_juros_mora || "MES_SUBSEQUENTE",
    tolerancia_dias_juros: (c as any).tolerancia_dias_juros ?? 0,
    email_remetente_nome: (c as any).email_remetente_nome || "",
    email_reply_to: (c as any).email_reply_to || "",
    email_assunto_padrao: (c as any).email_assunto_padrao || "Extrato de Conta Corrente do Lote",
    email_rodape: (c as any).email_rodape || "",
    mensagem_extrato: (c as any).mensagem_extrato || "",
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
      toast.success("Configurações atualizadas com sucesso!");
      setHasChanges(false);
    },
    onError: (error) => toast.error("Erro ao atualizar configurações: " + error.message),
  });

  const createMutation = useMutation({
    mutationFn: async (config: FormData) => {
      const { data, error } = await supabase.from("configuracoes").insert(config).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Configurações salvas com sucesso!");
      setHasChanges(false);
    },
    onError: (error) => toast.error("Erro ao salvar configurações: " + error.message),
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-7 w-7" />
            Configuração
          </h1>
          <p className="text-muted-foreground">
            Configurações operacionais (PIX, mora e e-mail). Campos restritos ficam em "Administrador".
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

          {/* Configuração de E-mail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Configuração de E-mail
              </CardTitle>
              <CardDescription>Configurações do remetente para envio de extratos por e-mail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Para que o envio de e-mails funcione, é necessário configurar um domínio de e-mail verificado.
                  O e-mail do remetente (campo "De") será composto pelo nome e endereço configurados abaixo,
                  vinculados ao domínio verificado do sistema.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Remetente</Label>
                  <Input
                    value={(formData as any).email_remetente_nome || ""}
                    onChange={(e) => handleChange("email_remetente_nome", e.target.value)}
                    placeholder="Ex: Loteamento Vila Nova"
                  />
                  <p className="text-xs text-muted-foreground">Nome que aparecerá como remetente do e-mail</p>
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Resposta (Reply-To)</Label>
                  <Input
                    type="email"
                    value={(formData as any).email_reply_to || ""}
                    onChange={(e) => handleChange("email_reply_to", e.target.value)}
                    placeholder="Ex: contato@empresa.com"
                  />
                  <p className="text-xs text-muted-foreground">E-mail para onde as respostas serão direcionadas</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Assunto Padrão do E-mail</Label>
                  <Input
                    value={(formData as any).email_assunto_padrao || ""}
                    onChange={(e) => handleChange("email_assunto_padrao", e.target.value)}
                    placeholder="Ex: Extrato de Conta Corrente do Lote"
                  />
                  <p className="text-xs text-muted-foreground">Assunto utilizado ao enviar extratos. O sistema adicionará automaticamente a identificação do lote.</p>
                </div>
                <div className="space-y-2">
                  <Label>Texto de Rodapé do E-mail</Label>
                  <Textarea
                    value={(formData as any).email_rodape || ""}
                    onChange={(e) => handleChange("email_rodape", e.target.value)}
                    placeholder="Ex: Este é um e-mail automático. Em caso de dúvidas, entre em contato conosco."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">Texto que aparecerá no rodapé de todos os e-mails enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mensagem do Extrato */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Mensagem do Extrato</CardTitle>
                  <CardDescription>
                    Quando preenchida, esta mensagem será impressa em destaque (fundo verde claro) em cada extrato exportado em PDF.
                    Deixe em branco para não exibir nenhum aviso.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoricoOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={(formData as any).mensagem_extrato || ""}
                  onChange={(e) => handleChange("mensagem_extrato", e.target.value)}
                  placeholder="Ex: Prezado cliente, lembre-se de manter seus pagamentos em dia para evitar acréscimos por atraso."
                  rows={5}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  Texto livre, até 1000 caracteres. Quebras de linha são preservadas. Sem formatação rica (negrito, itálico, links).
                  Cada alteração salva é registrada automaticamente no histórico.
                </p>
              </div>
            </CardContent>
          </Card>

          <MensagemExtratoHistoricoDialog open={historicoOpen} onOpenChange={setHistoricoOpen} />

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
