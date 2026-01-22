import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Format a number as Brazilian Real currency
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { 
    style: "currency", 
    currency: "BRL" 
  }).format(value);
};

/**
 * Format a number as compact Brazilian Real currency (e.g., R$ 1,5 mi)
 */
export const formatCompactCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)} mi`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)} mil`;
  }
  return formatCurrency(value);
};

/**
 * Format a date string to Brazilian format (dd/MM/yyyy)
 */
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd/MM/yyyy");
  } catch {
    return "-";
  }
};

/**
 * Format a date string to Brazilian format with month name (MMMM/yyyy)
 */
export const formatCompetencia = (competencia: string | null | undefined): string => {
  if (!competencia) return "-";
  try {
    const date = parseISO(competencia);
    return format(date, "MMMM/yyyy", { locale: ptBR });
  } catch {
    return competencia || "-";
  }
};

/**
 * Format a date string to short month format (MMM/yy)
 */
export const formatShortMonth = (date: string | null | undefined): string => {
  if (!date) return "-";
  try {
    return format(new Date(date + "T00:00:00"), "MMM/yy", { locale: ptBR });
  } catch {
    return "-";
  }
};

/**
 * Format a number as percentage
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
};

/**
 * Format a number as area in square meters
 */
export const formatArea = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return `${value} m²`;
};

/**
 * Format CPF/CNPJ document
 */
export const formatDocument = (doc: string | null | undefined): string => {
  if (!doc) return "-";
  const cleaned = doc.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
};

/**
 * Parse Brazilian number format (1.234,56) to float
 */
export const parseValorBR = (value: string | null | undefined): number => {
  if (!value) return 0;
  // Remove thousand separators and replace comma with dot
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
};

/**
 * Format a number with Brazilian locale
 */
export const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};
