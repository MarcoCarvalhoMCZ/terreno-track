import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Generic hook for sorting table data.
 * Provide a getValue function to extract comparable values from items.
 */
export function useTableSort<T>(
  defaultSort?: SortConfig
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultSort || { key: "", direction: null }
  );

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: "", direction: null };
    });
  };

  const sortData = (
    items: T[],
    getValue: (item: T, key: string) => string | number | null | undefined
  ): T[] => {
    if (!sortConfig.key || !sortConfig.direction) return items;

    return [...items].sort((a, b) => {
      const aVal = getValue(a, sortConfig.key);
      const bVal = getValue(b, sortConfig.key);

      // Nulls last
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortConfig.direction === "desc" ? -cmp : cmp;
    });
  };

  return { sortConfig, handleSort, sortData };
}
