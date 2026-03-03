import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Lote type from database
 */
export type Lote = Tables<"lotes">;
export type LoteInsert = TablesInsert<"lotes">;
export type LoteUpdate = TablesUpdate<"lotes">;

/**
 * Empty lote for form initialization
 */
export const emptyLote: Partial<LoteInsert> = {
  quadra: "",
  numero_lote: "",
  matricula_ri: "",
  area_m2: null,
  custo_contabil: null,
  etiqueta_patrimonial: "",
  status: "DISPONIVEL",
  observacoes: "",
};

/**
 * Lote with minimal fields for maps/lists
 */
export interface LoteMinimal {
  id: string;
  quadra: string;
  numero_lote: string;
  status: string | null;
  comprador_nome?: string | null;
}
