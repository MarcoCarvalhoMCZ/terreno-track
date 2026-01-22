/**
 * Lote status constants
 */
export const LOTE_STATUS = {
  DISPONIVEL: "DISPONIVEL",
  VENDIDO: "VENDIDO",
  RESERVADO: "RESERVADO",
  CANCELADO: "CANCELADO",
  QUITADO: "QUITADO",
} as const;

export type LoteStatus = keyof typeof LOTE_STATUS;

/**
 * Lote status display colors (Tailwind classes)
 */
export const loteStatusColors: Record<string, string> = {
  DISPONIVEL: "bg-success text-success-foreground",
  VENDIDO: "bg-info text-info-foreground",
  RESERVADO: "bg-warning text-warning-foreground",
  CANCELADO: "bg-destructive text-destructive-foreground",
  QUITADO: "bg-primary text-primary-foreground",
};

/**
 * Lote status display labels
 */
export const loteStatusLabels: Record<string, string> = {
  DISPONIVEL: "Disponível",
  VENDIDO: "Vendido",
  RESERVADO: "Reservado",
  CANCELADO: "Cancelado",
  QUITADO: "Quitado",
};

/**
 * Lote status colors for map display (raw Tailwind colors)
 */
export const loteMapColors: Record<string, string> = {
  DISPONIVEL: "bg-green-500 text-white",
  VENDIDO: "bg-red-500 text-white",
  RESERVADO: "bg-yellow-400 text-black",
  CANCELADO: "bg-gray-400 text-white",
  QUITADO: "bg-black text-white",
};

/**
 * Lote status labels for map display
 */
export const loteMapLabels: Record<string, string> = {
  DISPONIVEL: "Disponível",
  VENDIDO: "Vendido",
  RESERVADO: "Em Venda",
  CANCELADO: "Cancelado",
  QUITADO: "Quitado",
};

/**
 * Venda status constants
 */
export const VENDA_STATUS = {
  ATIVA: "ATIVA",
  QUITADA: "QUITADA",
  INADIMPLENTE: "INADIMPLENTE",
  CANCELADA: "CANCELADA",
} as const;

export type VendaStatus = keyof typeof VENDA_STATUS;

/**
 * Venda status display colors (Tailwind classes)
 */
export const vendaStatusColors: Record<string, string> = {
  ATIVA: "bg-success text-success-foreground",
  QUITADA: "bg-info text-info-foreground",
  INADIMPLENTE: "bg-warning text-warning-foreground",
  CANCELADA: "bg-destructive text-destructive-foreground",
};

/**
 * Venda status display labels
 */
export const vendaStatusLabels: Record<string, string> = {
  ATIVA: "Ativa",
  QUITADA: "Quitada",
  INADIMPLENTE: "Inadimplente",
  CANCELADA: "Cancelada",
};

/**
 * All status options for filters
 */
export const loteStatusOptions = [
  { value: "TODOS", label: "Todos" },
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "VENDIDO", label: "Vendido" },
  { value: "RESERVADO", label: "Reservado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "QUITADO", label: "Quitado" },
];

export const vendaStatusOptions = [
  { value: "TODOS", label: "Todos" },
  { value: "ATIVA", label: "Ativa" },
  { value: "QUITADA", label: "Quitada" },
  { value: "INADIMPLENTE", label: "Inadimplente" },
  { value: "CANCELADA", label: "Cancelada" },
];
