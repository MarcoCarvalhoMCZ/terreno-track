import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParcelaControle {
  id: string;
  lote_id: string;
  tipo_fluxo: string;
  data_base: string;
  qtd_pagas_base: number;
  observacoes: string | null;
}

export function useParcelasControle(loteId: string) {
  return useQuery({
    queryKey: ["parcelas-controle", loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("parcelas_controle")
        .select("*")
        .eq("lote_id", loteId);
      if (error) throw error;
      return (data || []) as ParcelaControle[];
    },
    enabled: !!loteId,
  });
}

export function useSalvarParcelaControle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      lote_id: string;
      tipo_fluxo: string;
      data_base: string;
      qtd_pagas_base: number;
      observacoes?: string;
    }) => {
      // Upsert based on unique(lote_id, tipo_fluxo)
      const { data, error } = await supabase
        .from("parcelas_controle")
        .upsert(
          {
            lote_id: params.lote_id,
            tipo_fluxo: params.tipo_fluxo,
            data_base: params.data_base,
            qtd_pagas_base: params.qtd_pagas_base,
            observacoes: params.observacoes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lote_id,tipo_fluxo" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["parcelas-controle", variables.lote_id] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote-consulta", variables.lote_id] });
      toast.success("Controle de parcelas salvo com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar controle: " + error.message);
    },
  });
}
