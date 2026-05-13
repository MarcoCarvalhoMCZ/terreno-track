import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoricoRow {
  id: string;
  mensagem: string | null;
  alterado_em: string;
  alterado_por: string | null;
}

export function MensagemExtratoHistoricoDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["mensagem-extrato-historico"],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("mensagem_extrato_historico" as any)
        .select("id, mensagem, alterado_em, alterado_por")
        .order("alterado_em", { ascending: false })
        .limit(200);
      if (error) throw error;

      const list = (rows || []) as unknown as HistoricoRow[];
      const userIds = Array.from(
        new Set(list.map((r) => r.alterado_por).filter((v): v is string => !!v))
      );

      let nomePorId = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        nomePorId = new Map((profs || []).map((p) => [p.id, p.nome || ""]));
      }

      return list.map((r) => ({
        ...r,
        alterado_por_nome: r.alterado_por ? nomePorId.get(r.alterado_por) || "—" : "—",
      }));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico da Mensagem do Extrato
          </DialogTitle>
          <DialogDescription>
            Cada vez que a mensagem é alterada, a versão anterior é registrada aqui automaticamente.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : !data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma alteração registrada ainda.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.map((r) => (
                <li key={r.id} className="border rounded-md p-3 bg-muted/30">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground mb-2">
                    <span>
                      Alterado por <strong className="text-foreground">{r.alterado_por_nome}</strong>
                    </span>
                    <span>
                      {format(new Date(r.alterado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {r.mensagem?.trim() ? r.mensagem : <em className="text-muted-foreground">(mensagem vazia)</em>}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
