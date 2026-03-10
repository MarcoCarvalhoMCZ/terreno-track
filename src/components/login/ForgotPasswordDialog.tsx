import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [resposta, setResposta] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"verify" | "success">("verify");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não conferem");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("reset-password-by-security", {
      body: {
        email,
        cpf,
        data_nascimento: dataNascimento,
        resposta_seguranca: resposta,
        nova_senha: novaSenha,
      },
    });

    setLoading(false);

    if (error || (data && data.error)) {
      toast.error(data?.error || error?.message || "Erro ao recuperar senha");
    } else {
      setStep("success");
      toast.success("Senha alterada com sucesso!");
    }
  };

  const handleClose = () => {
    setStep("verify");
    setEmail("");
    setCpf("");
    setDataNascimento("");
    setResposta("");
    setNovaSenha("");
    setConfirmarSenha("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recuperar Senha</DialogTitle>
        </DialogHeader>

        {step === "success" ? (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">✅</div>
            <p className="text-foreground font-medium">Senha alterada com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              Agora você pode fazer login com sua nova senha.
            </p>
            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preencha seus dados de verificação conforme cadastrados pelo administrador.
            </p>

            <div className="space-y-2">
              <Label htmlFor="rec-email">E-mail</Label>
              <Input
                id="rec-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-cpf">CPF</Label>
              <Input
                id="rec-cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="border-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-nascimento">Data de Nascimento</Label>
              <Input
                id="rec-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="border-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-resposta">Resposta de Segurança</Label>
              <Input
                id="rec-resposta"
                placeholder="Sua resposta"
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                className="border-foreground/30"
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="rec-nova-senha">Nova Senha</Label>
              <Input
                id="rec-nova-senha"
                type="password"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
                className="border-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-confirmar">Confirmar Nova Senha</Label>
              <Input
                id="rec-confirmar"
                type="password"
                placeholder="••••••••"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
                className="border-foreground/30"
              />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Redefinir Senha"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleClose}>
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
