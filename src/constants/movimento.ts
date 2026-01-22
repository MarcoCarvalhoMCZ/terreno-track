/**
 * Tipo de conta/fluxo
 */
export const TIPO_CONTA = {
  PARCELAMENTO: "PARCELAMENTO",
  REFORCO: "REFORCO",
} as const;

export type TipoConta = keyof typeof TIPO_CONTA;

/**
 * Natureza do movimento
 */
export type NaturezaMovimento = "debito" | "credito" | "pergunta" | "auto";

/**
 * Interface para tipo de movimento
 */
export interface TipoMovimento {
  value: string;
  label: string;
  natureza: NaturezaMovimento;
}

/**
 * Tipos de movimento disponíveis para criação (sem VENDA - tratado automaticamente)
 */
export const tiposMovimento: TipoMovimento[] = [
  { value: "PARCELA", label: "Parcela Recebida", natureza: "credito" },
  { value: "ARRAS", label: "Sinal / Arras", natureza: "credito" },
  { value: "REFORCO", label: "Reforço", natureza: "credito" },
  { value: "ATUALIZACAO", label: "Atualização Monetária", natureza: "auto" },
  { value: "JUROS", label: "Juros", natureza: "debito" },
  { value: "MULTA", label: "Multa", natureza: "debito" },
  { value: "DESCONTO", label: "Desconto", natureza: "credito" },
  { value: "ESTORNO", label: "Estorno", natureza: "pergunta" },
  { value: "OUTROS", label: "Outros", natureza: "pergunta" },
];

/**
 * Todos os tipos de movimento (incluindo VENDA para exibição)
 */
export const tiposMovimentoTodos: TipoMovimento[] = [
  { value: "VENDA", label: "Venda do Lote", natureza: "debito" },
  ...tiposMovimento,
];

/**
 * Tipos que se aplicam a parcelamento
 */
export const tiposParcelamento = [
  "PARCELA",
  "ARRAS",
  "ATUALIZACAO",
  "JUROS",
  "MULTA",
  "DESCONTO",
  "ESTORNO",
  "OUTROS",
];

/**
 * Tipos que se aplicam a reforço
 */
export const tiposReforco = [
  "REFORCO",
  "ATUALIZACAO",
  "JUROS",
  "MULTA",
  "DESCONTO",
  "ESTORNO",
  "OUTROS",
];

/**
 * Obtém a natureza de um tipo de movimento
 */
export const getNaturezaMovimento = (tipoMov: string): NaturezaMovimento => {
  const tipo = tiposMovimentoTodos.find((t) => t.value === tipoMov);
  return tipo?.natureza || "pergunta";
};

/**
 * Obtém o label de um tipo de movimento
 */
export const getTipoMovimentoLabel = (tipoMov: string): string => {
  const tipo = tiposMovimentoTodos.find((t) => t.value === tipoMov);
  return tipo?.label || tipoMov;
};

/**
 * Filtra tipos de movimento por tipo de conta
 */
export const getTiposMovimentoPorConta = (
  tipoConta: TipoConta,
  incluirVenda = false
): TipoMovimento[] => {
  const tiposPermitidos =
    tipoConta === "PARCELAMENTO" ? tiposParcelamento : tiposReforco;

  const tipos = tiposMovimento.filter((t) => tiposPermitidos.includes(t.value));

  if (incluirVenda && tipoConta === "PARCELAMENTO") {
    return [
      { value: "VENDA", label: "Venda do Lote", natureza: "debito" },
      ...tipos,
    ];
  }

  return tipos;
};

/**
 * Tipos de atualização monetária
 */
export const tiposAtualizacao = [
  { value: "IGPM", label: "IGP-M" },
  { value: "MEDIA", label: "Média" },
] as const;

export type TipoAtualizacao = (typeof tiposAtualizacao)[number]["value"];
