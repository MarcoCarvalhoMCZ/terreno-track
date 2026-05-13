/**
 * Matriz declarativa de habilitação de campos por Tipo de Movimento.
 *
 * Para cada tipo, define quais campos do diálogo de Movimentação ficam habilitados.
 * Campos NÃO listados ficam disabled, cinza, sem TAB e não são persistidos.
 *
 * Obrigatoriedade: TODOS os campos habilitados são obrigatórios,
 * EXCETO os listados em CAMPOS_NUNCA_OBRIGATORIOS.
 */

export type CampoMovimento =
  | "tipo_fluxo_form"
  | "lote_id"
  | "data_mov"
  | "tipo_mov"
  | "valor"
  | "natureza_outros"
  | "referencia"
  | "vencimento"
  | "numero_parcela"
  | "sequencia_parcela"
  | "percentual_calculo"
  | "modo_pagamento"
  | "banco_origem"
  | "cpf_cnpj_pagador"
  | "descricao";

/** Campos habilitados nunca são obrigatórios */
export const CAMPOS_NUNCA_OBRIGATORIOS: CampoMovimento[] = [
  "modo_pagamento",
  "banco_origem",
  "cpf_cnpj_pagador",
  "descricao",
  "referencia",
];

/**
 * Matriz: tipo_mov -> campos habilitados.
 * Tipos JUROS/MULTA NÃO aparecem aqui — são gerados automaticamente pelo
 * lançamento de PARCELA/REFORCO em atraso e não podem ser criados manualmente.
 */
export const MOVIMENTO_CAMPOS_HABILITADOS: Record<string, CampoMovimento[]> = {
  PARCELA: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "vencimento", "numero_parcela", "sequencia_parcela",
    "modo_pagamento", "banco_origem", "cpf_cnpj_pagador", "descricao",
  ],
  REFORCO: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "vencimento", "numero_parcela", "sequencia_parcela",
    "modo_pagamento", "banco_origem", "cpf_cnpj_pagador", "descricao",
  ],
  ARRAS: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "referencia", "descricao",
  ],
  ATUALIZACAO: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "percentual_calculo", "referencia", "descricao",
  ],
  DESCONTO: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "referencia", "descricao",
  ],
  AMORTIZACAO_ESPECIAL: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "referencia", "descricao",
  ],
  ESTORNO: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "natureza_outros", "referencia", "descricao",
  ],
  OUTROS: [
    "tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov",
    "valor", "natureza_outros", "referencia", "descricao",
  ],
};

/** Determina se um campo está habilitado para o tipo de movimento atual */
export function isCampoHabilitado(tipoMov: string | null | undefined, campo: CampoMovimento): boolean {
  if (!tipoMov) {
    // Antes de selecionar tipo, habilitar apenas os essenciais
    return ["tipo_fluxo_form", "lote_id", "data_mov", "tipo_mov"].includes(campo);
  }
  const habilitados = MOVIMENTO_CAMPOS_HABILITADOS[tipoMov];
  if (!habilitados) return false;
  return habilitados.includes(campo);
}

/** Determina se um campo é obrigatório (habilitado e não na lista de não-obrigatórios) */
export function isCampoObrigatorio(tipoMov: string | null | undefined, campo: CampoMovimento): boolean {
  if (!isCampoHabilitado(tipoMov, campo)) return false;
  return !CAMPOS_NUNCA_OBRIGATORIOS.includes(campo);
}
