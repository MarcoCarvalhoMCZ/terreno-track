import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { AlertTriangle, QrCode } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ParcelaEmAtraso, ResumoParcelasEmAtraso, MoraConfig } from "@/hooks/useParcelasEmAtraso";
import type { TipoConta } from "@/types/conta-corrente.types";

interface PixConfig {
  chave_pix: string | null;
  nome_beneficiario: string | null;
  cidade_beneficiario: string | null;
}

interface LoteData {
  quadra: string;
  numero_lote: string;
}

interface ParcelasEmAtrasoTableProps {
  resumoAtraso: ResumoParcelasEmAtraso;
  tipoFluxo: TipoConta;
  moraConfig: MoraConfig | null | undefined;
  pixConfig: PixConfig | null | undefined;
  lote: LoteData | null | undefined;
  buildPixPayloadForParcela: (parcela: ParcelaEmAtraso) => string | null;
}

export function ParcelasEmAtrasoTable({
  resumoAtraso,
  tipoFluxo,
  moraConfig,
  pixConfig,
  lote,
  buildPixPayloadForParcela,
}: ParcelasEmAtrasoTableProps) {
  const { parcelas, totalDevido, isInadimplente } = resumoAtraso;
  const tipoLabel = tipoFluxo === "PARCELAMENTO" ? "Parcela" : "Reforço";

  if (parcelas.length === 0) {
    return null;
  }

  const hasPixConfig = pixConfig?.chave_pix && pixConfig?.nome_beneficiario && pixConfig?.cidade_beneficiario;
  
  // Filtrar parcelas que devem ter QR Code: vencidas + primeira a vencer E com exibirQrCode = true
  const parcelasComQr = parcelas.filter((p) => (p.isVencida || p.isPrimeiraAVencer) && p.exibirQrCode);

  return (
    <Card className={isInadimplente ? "border-destructive" : ""}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {isInadimplente && <AlertTriangle className="h-5 w-5 text-destructive" />}
          {tipoLabel}s {isInadimplente ? "em Atraso" : "a Vencer"} ({tipoFluxo})
        </CardTitle>
        {isInadimplente && (
          <Badge variant="destructive" className="text-sm px-3 py-1 font-bold">
            INADIMPLENTE
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tabela de parcelas */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tipoLabel}</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Juros%</TableHead>
                <TableHead className="text-right">Valor {tipoLabel}</TableHead>
                <TableHead className="text-right">Valor Juros</TableHead>
                <TableHead className="text-right">
                  Valor Multa ({formatPercent(moraConfig?.multa_mora_percentual || 2)})
                </TableHead>
                <TableHead className="text-right">Total da {tipoLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((parcela, idx) => {
                return (
                  <TableRow key={idx} className={parcela.isVencida ? "bg-destructive/5" : parcela.isPrimeiraAVencer ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">
                      {parcela.numero} de {parcela.totalParcelas}
                      {parcela.isPrimeiraAVencer && !parcela.isVencida && (
                        <span className="ml-2 text-xs text-primary">(A Vencer)</span>
                      )}
                    </TableCell>
                    <TableCell className={parcela.isVencida ? "text-destructive font-medium" : ""}>
                      {format(parcela.vencimento, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {parcela.isVencida ? `${parcela.jurosPercentual.toFixed(0)}%` : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(parcela.valorParcela)}</TableCell>
                    <TableCell className="text-right">
                      {parcela.isVencida ? formatCurrency(parcela.valorJuros) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {parcela.isVencida ? formatCurrency(parcela.valorMulta) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(parcela.totalParcela)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-bold">
                  TOTAL DEVIDO
                </TableCell>
                <TableCell className="text-right font-bold text-lg">{formatCurrency(totalDevido)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* QR Codes para parcelas vencidas + primeira a vencer */}
        {hasPixConfig && parcelasComQr.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Codes PIX por {tipoLabel}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parcelasComQr.map((parcela, idx) => {
                const pixPayload = buildPixPayloadForParcela(parcela);
                if (!pixPayload) return null;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      parcela.isVencida ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"
                    }`}
                  >
                    <div className="text-center mb-3">
                      <div className="font-semibold">
                        {tipoLabel} {parcela.numero} de {parcela.totalParcelas}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Vencimento: {format(parcela.vencimento, "dd/MM/yyyy")}
                      </div>
                      <div className="font-bold text-lg mt-1">{formatCurrency(parcela.totalParcela)}</div>
                    </div>
                    <div className="flex justify-center bg-white p-2 rounded-lg">
                      <QRCodeSVG value={pixPayload} size={120} level="M" includeMargin={true} />
                    </div>
                    {/* Hidden canvas for PDF */}
                    <div className="hidden">
                      <QRCodeCanvas
                        id={`qr-code-parcela-${tipoFluxo}-${parcela.numero}`}
                        value={pixPayload}
                        size={200}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
