import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface LoteOption {
  id: string;
  quadra: string;
  numero_lote: string;
  status?: string | null;
}

interface LoteSearchSelectProps {
  lotes: LoteOption[] | undefined;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showStatus?: boolean;
  className?: string;
  /** If provided, shows a "Todos" option at the top with this value */
  allOptionValue?: string;
  allOptionLabel?: string;
}

/**
 * Parses a shorthand search like "C02" into { quadra: "C", lote: "02" }.
 * Supports formats: "C02", "C2", "A10", etc.
 * Pattern: first char(s) = quadra letter(s), remaining digits = lote number.
 */
function parseShorthand(input: string): { quadra: string; lote: string } | null {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;
  
  // Match: one or more letters followed by one or more digits
  const match = trimmed.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return { quadra: match[1], lote: match[2] };
  }
  return null;
}

function filterLotes(lotes: LoteOption[], search: string): LoteOption[] {
  if (!search.trim()) return lotes;
  
  const term = search.trim().toLowerCase();
  const shorthand = parseShorthand(search);
  
  return lotes.filter((lote) => {
    // Shorthand match: "C02" → quadra starts with C, lote ends with 02
    if (shorthand) {
      const quadraMatch = lote.quadra.toUpperCase().startsWith(shorthand.quadra);
      // Pad lote number for comparison: "2" matches "02"
      const loteNum = lote.numero_lote.replace(/^0+/, "");
      const searchNum = shorthand.lote.replace(/^0+/, "");
      const loteMatch = loteNum === searchNum || lote.numero_lote.endsWith(shorthand.lote);
      return quadraMatch && loteMatch;
    }
    
    // Regular search: match quadra, numero_lote, or full label
    const label = `quadra ${lote.quadra} lote ${lote.numero_lote} q${lote.quadra} l${lote.numero_lote}`.toLowerCase();
    return label.includes(term);
  });
}

export function LoteSearchSelect({
  lotes,
  value,
  onValueChange,
  placeholder = "Selecione o lote",
  showStatus = false,
  className,
  allOptionValue,
  allOptionLabel = "Todos os lotes",
}: LoteSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLote = useMemo(
    () => lotes?.find((l) => l.id === value),
    [lotes, value]
  );

  const filteredLotes = useMemo(
    () => filterLotes(lotes || [], search),
    [lotes, search]
  );

  const isAllSelected = allOptionValue !== undefined && value === allOptionValue;

  const displayLabel = isAllSelected
    ? allOptionLabel
    : selectedLote
      ? `Quadra ${selectedLote.quadra} - Lote ${selectedLote.numero_lote}${showStatus && selectedLote.status ? ` (${selectedLote.status})` : ""}`
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar lote (ex: C02)..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum lote encontrado.</CommandEmpty>
            <CommandGroup>
              {allOptionValue !== undefined && (
                <CommandItem
                  value={allOptionValue}
                  onSelect={() => {
                    onValueChange(allOptionValue);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isAllSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {allOptionLabel}
                </CommandItem>
              )}
              {filteredLotes.map((lote) => (
                <CommandItem
                  key={lote.id}
                  value={lote.id}
                  onSelect={() => {
                    onValueChange(lote.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === lote.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Quadra {lote.quadra} - Lote {lote.numero_lote}
                  {showStatus && lote.status && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {lote.status}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
