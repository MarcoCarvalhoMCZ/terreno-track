import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { ContaCorrenteComRelacionamentos, ResumoFluxo } from "@/types/conta-corrente.types";

type ContaCorrenteInsert = TablesInsert<"conta_corrente_lote">;
type ContaCorrenteUpdate = TablesUpdate<"conta_corrente_lote">;

/**
 * Hook for fetching conta corrente movimentações with relationships
 */
export function useContaCorrenteMovimentacoes() {
  return useQuery({
    queryKey: ["conta-corrente-lote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select(`
          *,
          lote:lotes(id, quadra, numero_lote),
          venda:vendas(id, data_venda)
        `)
        .order("data_mov", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContaCorrenteComRelacionamentos[];
    },
  });
}

/**
 * Hook for fetching lotes
 */
export function useLotes() {
  return useQuery({
    queryKey: ["lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as Tables<"lotes">[];
    },
  });
}

/**
 * Hook for fetching vendas with lote info
 */
export function useVendasComLote() {
  return useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, lote:lotes(quadra, numero_lote)")
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook for fetching resumo de fluxo por lote
 */
export function useResumoFluxoLote() {
  return useQuery({
    queryKey: ["resumo-fluxo-lote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_resumo_fluxo_lote")
        .select("*");
      if (error) throw error;
      return data as ResumoFluxo[];
    },
  });
}

/**
 * Hook for fetching indicadores de atualização
 */
export function useIndicadoresAtualizacao() {
  return useQuery({
    queryKey: ["indicadores-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao")
        .select("id, nome")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook for fetching valores dos indicadores
 */
export function useIndicadoresValores() {
  return useQuery({
    queryKey: ["indicadores-atualizacao-valores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao_valores")
        .select("*, indicador:indicadores_atualizacao(id, nome)")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook for conta corrente mutations (create, update, delete)
 */
export function useContaCorrenteMutations(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["conta-corrente-lote"] });
    queryClient.invalidateQueries({ queryKey: ["resumo-consolidado"] });
    queryClient.invalidateQueries({ queryKey: ["resumo-por-lote"] });
    queryClient.invalidateQueries({ queryKey: ["resumo-fluxo-lote"] });
  };

  const createMutation = useMutation({
    mutationFn: async (mov: ContaCorrenteInsert) => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .insert(mov)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Movimentação cadastrada com sucesso!");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar movimentação: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ContaCorrenteUpdate }) => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Movimentação atualizada com sucesso!");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar movimentação: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conta_corrente_lote").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Movimentação excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir movimentação: " + error.message);
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
