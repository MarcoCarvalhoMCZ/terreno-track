import { useState, useEffect } from "react";
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

interface UserSecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  initialData: {
    cpf: string;
    data_nascimento: string;
    pergunta_seguranca: string;
    resposta_seguranca: string;
  };
  onSaved: () => void;
}

export function UserSecurityDialog({
  open,
  onOpenChange,
  userId,
  userName,
  initialData,
  onSaved,
}: UserSecurityDialogProps) {
  const [cpf, setCpf] = useState(initialData.cpf);
  const [dataNascimento, setDataNascimento] = useState(initialData.data_nascimento);
  const [pergunta, setPergunta] = useState(initialData.pergunta_seguranca);
  const [resposta, setResposta] = useState(initialData.resposta_seguranca);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        cpf: cpf || null,
        data_nascimento: dataNascimento || null,
        pergunta_seguranca: pergunta || null,
        resposta_seguranca: resposta || null,
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Dados de segurança atualizados!");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dados de Recuperação - {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sec-cpf">CPF</Label>
            <Input
              id="sec-cpf"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-nascimento">Data de Nascimento</Label>
            <Input
              id="sec-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-pergunta">Pergunta de Segurança</Label>
            <Input
              id="sec-pergunta"
              placeholder="Ex: Nome do seu primeiro pet?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-resposta">Resposta de Segurança</Label>
            <Input
              id="sec-resposta"
              placeholder="Resposta secreta"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Estes dados serão usados pelo usuário para recuperar sua própria senha, sem necessidade de intervenção do administrador.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
