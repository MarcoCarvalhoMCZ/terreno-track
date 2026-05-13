import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CriterioJurosMora } from "@/lib/calculo-mora";

interface AtrasoBannerProps {
  diasAtraso: number;
  mesesAtraso: number;
  criterio: CriterioJurosMora;
  jurosPercentual: number;
  multaPercentual: number;
  valorOriginal: number;
  valorJuros: number;
  valorMulta: number;
  valorAtualizado: number;
  toleranciaAplicada?: boolean;
}

const CRITERIO_LABEL: Record<CriterioJurosMora, string> = {
  MES_SUBSEQUENTE: "Mês subsequente ao vencimento",
  TOLERANCIA: "Tolerância de dias",
  PRO_RATA_DIA: "Pró-rata dia",
  FIXO_MENSAL: "Juros fixos mensais",
};

export function AtrasoBanner({
  diasAtraso,
  mesesAtraso,
  criterio,
  jurosPercentual,
  multaPercentual,
  valorOriginal,
  valorJuros,
  valorMulta,
  valorAtualizado,
  toleranciaAplicada,
}: AtrasoBannerProps) {
  if (toleranciaAplicada) {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-success mt-0.5" />
          <div>
            <strong>Dentro da tolerância.</strong> {diasAtraso} dia(s) de atraso, mas a configuração
            permite até a tolerância sem encargos. Não serão gerados Juros nem Multa.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
        <div>
          <strong>Parcela em atraso detectada.</strong>{" "}
          Juros e multa calculados conforme Configurações de Mora.
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div><span className="text-muted-foreground">Dias atraso:</span> <strong>{diasAtraso}</strong></div>
        <div><span className="text-muted-foreground">Meses atraso:</span> <strong>{mesesAtraso}</strong></div>
        <div className="col-span-2"><span className="text-muted-foreground">Critério:</span> <strong>{CRITERIO_LABEL[criterio]}</strong></div>
        <div><span className="text-muted-foreground">% Juros:</span> <strong>{jurosPercentual.toFixed(2)}%</strong></div>
        <div><span className="text-muted-foreground">% Multa:</span> <strong>{multaPercentual.toFixed(2)}%</strong></div>
        <div><span className="text-muted-foreground">Valor original:</span> <strong>{formatCurrency(valorOriginal)}</strong></div>
        <div><span className="text-muted-foreground">Atualizado:</span> <strong>{formatCurrency(valorAtualizado)}</strong></div>
        <div><span className="text-muted-foreground">Juros:</span> <strong className="text-destructive">{formatCurrency(valorJuros)}</strong></div>
        <div><span className="text-muted-foreground">Multa:</span> <strong className="text-destructive">{formatCurrency(valorMulta)}</strong></div>
      </div>
      <p className="text-xs text-muted-foreground">
        Ao salvar, o sistema gerará automaticamente os movimentos vinculados de Juros e Multa.
      </p>
    </div>
  );
}
