import { format } from "date-fns";

/**
 * Converte uma string ISO de data (YYYY-MM-DD) em Date *local* (sem shift de timezone).
 *
 * OBS: Para colunas do tipo DATE vindas do backend, evitar `new Date('YYYY-MM-DD')`
 * pois o JS interpreta como UTC e pode “voltar 1 dia” dependendo do fuso.
 */
export function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Se vier com horário (timestamp), deixa o JS lidar.
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Esperado: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;

  const local = new Date(y, m - 1, d);
  return isNaN(local.getTime()) ? null : local;
}

export function formatDateBR(dateStr: string | null | undefined): string {
  const d = parseDateOnly(dateStr);
  if (!d) return "-";
  return format(d, "dd/MM/yyyy");
}
