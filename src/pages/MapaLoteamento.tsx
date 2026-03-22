import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoteamentoMap } from "@/components/LoteamentoMap";
import { Map } from "lucide-react";

export default function MapaLoteamento() {
  const { data: lotes } = useQuery({
    queryKey: ["lotes-mapa"],
    queryFn: async () => {
      const { data: lotesData, error } = await supabase
        .from("lotes")
        .select("id, quadra, numero_lote, status")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;

      const { data: vendasData } = await supabase
        .from("vendas")
        .select("lote_id, comprador_pessoa:pessoas!comprador_pessoa_id(nome_razao)")
        .in("status", ["ATIVA", "QUITADA"]);

      const vendaLookup = new globalThis.Map(
        (vendasData || []).map(v => [
          v.lote_id,
          (v.comprador_pessoa as any)?.nome_razao || null,
        ])
      );

      return (lotesData || []).map(l => ({
        ...l,
        comprador_nome: vendaMap.get(l.id) || null,
      }));
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mapa do Loteamento</h1>
        <p className="text-muted-foreground">Visualização dos lotes e seus status</p>
      </div>

      <Card className="border-t-4 border-t-primary bg-white shadow-sm">
        <CardContent className="pt-6">
          <LoteamentoMap lotes={lotes || []} />
        </CardContent>
      </Card>
    </div>
  );
}
