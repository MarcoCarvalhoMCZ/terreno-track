import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, parseValorBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  allowNull?: boolean;
}

/**
 * Monetary input in Brazilian format (1.234,56).
 * - Displays formatted value when blurred.
 * - Accepts free typing (with comma or dot) when focused.
 * - Always emits parsed number (or null) to the parent.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, allowNull = false, className, onFocus, onBlur, placeholder, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>("");

    const displayValue = focused
      ? draft
      : value === null || value === undefined || value === 0
        ? ""
        : formatNumber(value, 2);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        placeholder={placeholder ?? "0,00"}
        value={displayValue}
        onFocus={(e) => {
          setFocused(true);
          setDraft(value === null || value === undefined || value === 0 ? "" : formatNumber(value, 2));
          onFocus?.(e);
        }}
        onChange={(e) => {
          const v = e.target.value;
          // Allow digits, comma, dot, minus
          if (!/^[-]?[\d.,]*$/.test(v)) return;
          setDraft(v);
          const parsed = v === "" ? null : parseValorBR(v);
          if (parsed === null) onValueChange(allowNull ? null : 0);
          else onValueChange(parsed);
        }}
        onBlur={(e) => {
          setFocused(false);
          const parsed = draft === "" ? null : parseValorBR(draft);
          onValueChange(parsed === null ? (allowNull ? null : 0) : parsed);
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
