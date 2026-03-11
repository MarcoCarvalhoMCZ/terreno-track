import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { Lote } from "./lote.types";
import type { Venda } from "./venda.types";

// Re-export TipoConta from constants for convenience
export type { TipoConta } from "@/constants/movimento";

/**
 * Conta corrente type from database
 */
export type ContaCorrente = Tables<"conta_corrente_lote">;
export type ContaCorrenteInsert = TablesInsert<"conta_corrente_lote">;
export type ContaCorrenteUpdate = TablesUpdate<"conta_corrente_lote">;

/**
 * Conta corrente with relationships
 */
export interface ContaCorrenteComRelacionamentos extends ContaCorrente {
  lote?: Lote;
  venda?: Venda;
}

/**
 * Form data for conta corrente
 */
export interface ContaCorrenteFormData extends Partial<ContaCorrenteInsert> {
  natureza_outros?: "debito" | "credito";
  tipo_fluxo_form?: "PARCELAMENTO" | "REFORCO";
  modo_pagamento?: string | null;
  banco_origem?: string | null;
  cpf_cnpj_pagador?: string | null;
}

/**
 * Empty movimento for form initialization
 */
export const emptyMovimento: ContaCorrenteFormData = {
  lote_id: "",
  data_mov: new Date().toISOString().split("T")[0],
  tipo_mov: "PARCELA",
  descricao: "",
  credito: null,
  debito: null,
  referencia: "",
  vencimento: null,
  percentual_calculo: null,
  venda_id: null,
  natureza_outros: undefined,
  tipo_fluxo_form: "PARCELAMENTO",
  modo_pagamento: null,
  banco_origem: null,
  cpf_cnpj_pagador: null,
  numero_parcela: null,
  sequencia_parcela: null,
};

/**
 * Resumo de fluxo por lote (from database view)
 */
export interface ResumoFluxoView {
  lote_id: string;
  tipo_fluxo: string;
  saldo_atualizado: number;
  qtd_restante: number;
  valor_proximo_titulo: number;
}

/**
 * Resumo de fluxo para cálculos (ConsultaLote)
 */
export interface ResumoFluxo {
  totalVenda: number;
  totalAtualizacoes: number;
  totalJurosMora: number;
  totalMultasMora: number;
  totalRecebido: number;
  saldoReceber: number;
}

/**
 * Resumo completo do lote (ConsultaLote)
 */
export interface ResumoLote {
  // Valores separados por fluxo
  parcelamento: ResumoFluxo;
  reforco: ResumoFluxo;
  // Parcelas
  qtdParcelasContratadas: number;
  qtdParcelasPagas: number;
  qtdParcelasAPagar: number;
  // Reforços
  qtdReforcosContratados: number;
  qtdReforcosPagos: number;
  qtdReforcosAPagar: number;
  // Próxima parcela/reforço
  valorProximaParcela: number;
  vencimentoProximaParcela: Date | null;
  valorProximoReforco: number;
  vencimentoProximoReforco: Date | null;
  primeiroVencimentoParcela: Date | null;
  primeiroVencimentoReforco: Date | null;
}

/**
 * Resumo consolidado mensal
 */
export interface ResumoConsolidado {
  competencia: string | null;
  total_creditos: number | null;
  total_debitos: number | null;
  saldo_periodo: number | null;
}

/**
 * Resumo por lote
 */
export interface ResumoPorLote {
  lote_id: string | null;
  quadra: string | null;
  numero_lote: string | null;
  ano: number | null;
  total_creditos: number | null;
  total_debitos: number | null;
  saldo_periodo: number | null;
}

/**
 * Conta corrente com saldo acumulado para exibição
 */
export interface ContaCorrenteComSaldo extends ContaCorrente {
  saldo_acumulado: number;
}
