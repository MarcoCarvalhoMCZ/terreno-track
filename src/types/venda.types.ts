import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { TipoAtualizacao } from "@/constants/movimento";

/**
 * Venda type from database
 */
export type Venda = Tables<"vendas">;
export type VendaInsert = TablesInsert<"vendas">;
export type VendaUpdate = TablesUpdate<"vendas">;

/**
 * Pessoa type from database
 */
export type Pessoa = Tables<"pessoas">;

/**
 * Indicador type from database
 */
export type Indicador = Tables<"indicadores_atualizacao">;

/**
 * Extended Venda type - alias for Venda since all fields are now in the base type
 */
export type VendaExtended = Venda;

/**
 * Venda with relationships for display
 */
export interface VendaComRelacionamentos {
  id: string;
  lote_id: string;
  data_venda: string;
  comprador_pessoa_id: string;
  vendedor_pessoa_id?: string | null;
  valor_venda: number;
  valor_arras?: number | null;
  indicador_atualizacao_id?: string | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  lote?: { id: string; quadra: string; numero_lote: string };
  comprador?: { id: string; nome_razao: string };
  vendedor?: { id: string; nome_razao: string };
  indicador?: { id: string; nome: string };
  tipo_atualizacao?: string | null;
  defasagem_indice?: number | null;
  comprador_nome_1?: string | null;
  comprador_cpf_1?: string | null;
  comprador_nome_2?: string | null;
  comprador_cpf_2?: string | null;
  valor_parcelamento?: number | null;
  qtd_parcelas?: number | null;
  frequencia_parcelas_meses?: number | null;
  valor_reforco?: number | null;
  qtd_reforcos?: number | null;
  frequencia_reforcos_meses?: number | null;
}

/**
 * Venda form data for create/edit
 */
export interface VendaFormData extends Partial<VendaInsert> {
  tipo_atualizacao?: TipoAtualizacao;
  defasagem_indice?: number;
  comprador_solidario_2_id?: string;
  valor_parcelamento?: number;
  qtd_parcelas?: number;
  frequencia_parcelas_meses?: number;
  primeiro_vencimento_parcela?: string;
  valor_reforco?: number;
  qtd_reforcos?: number;
  frequencia_reforcos_meses?: number;
  primeiro_vencimento_reforco?: string;
}

/**
 * Empty venda for form initialization
 */
export const emptyVenda: VendaFormData = {
  lote_id: "",
  data_venda: new Date().toISOString().split("T")[0],
  comprador_pessoa_id: "",
  valor_venda: 0,
  valor_arras: null,
  indicador_atualizacao_id: "",
  status: "ATIVA",
  observacoes: "",
  tipo_atualizacao: "IGPM",
  defasagem_indice: 1,
  comprador_solidario_2_id: "",
  valor_parcelamento: undefined,
  qtd_parcelas: 1,
  frequencia_parcelas_meses: 1,
  primeiro_vencimento_parcela: "",
  valor_reforco: undefined,
  qtd_reforcos: undefined,
  frequencia_reforcos_meses: undefined,
  primeiro_vencimento_reforco: "",
};
