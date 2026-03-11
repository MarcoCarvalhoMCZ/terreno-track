import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Search, Users } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useRelatorioInadimplencia, type CompradorInadimplente, type LoteInadimplente } from "@/hooks/useRelatorioInadimplencia";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function LoteCard({ lote }: { lote: LoteInadimplente }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 bg-muted/30">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-1 -m-1">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <span className="font-medium">
                  Quadra {lote.quadra} - Lote {lote.numeroLote}
                </span>
                <span className="text-muted-foreground text-sm ml-2">
                  ({lote.parcelasAtraso.length} parcela{lote.parcelasAtraso.length > 1 ? "s" : ""} em atraso)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-destructive">
                {formatCurrency(lote.totalDevido)}
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Juros%</TableHead>
                <TableHead className="text-right">Juros R$</TableHead>
                <TableHead className="text-right">Multa R$</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lote.parcelasAtraso.map((parcela, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant={parcela.tipoFluxo === "PARCELAMENTO" ? "default" : "secondary"}>
                      {parcela.tipoFluxo === "PARCELAMENTO" ? "Parcela" : "Reforço"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {parcela.numero} de {parcela.totalParcelas}
                  </TableCell>
                  <TableCell>
                    {format(parcela.vencimento, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(parcela.valorParcela)}
                  </TableCell>
                  <TableCell className="text-right">
                    {parcela.jurosPercentual.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {formatCurrency(parcela.valorJuros)}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {formatCurrency(parcela.valorMulta)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(parcela.totalParcela)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CompradorCard({ comprador }: { comprador: CompradorInadimplente }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border-destructive/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    {comprador.nome}
                    {comprador.cpf && (
                      <span className="text-muted-foreground font-normal text-sm">
                        ({comprador.cpf})
                      </span>
                    )}
                  </CardTitle>
                  {comprador.nome2 && (
                    <CardDescription className="mt-1">
                      Comprador solidário: {comprador.nome2}
                      {comprador.cpf2 && ` (${comprador.cpf2})`}
                    </CardDescription>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(comprador.totalGeral)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {comprador.lotes.length} lote{comprador.lotes.length > 1 ? "s" : ""} • {comprador.qtdParcelasAtraso} parcela{comprador.qtdParcelasAtraso > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {comprador.lotes.map((lote) => (
              <LoteCard key={lote.loteId} lote={lote} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function RelatorioInadimplencia() {
  const [searchTerm, setSearchTerm] = useState("");
  const { relatorio, isLoading } = useRelatorioInadimplencia();

  // Filtrar compradores pelo termo de busca
  const compradoresFiltrados = relatorio.compradores.filter((comprador) => {
    const termo = searchTerm.toLowerCase();
    const matchNome = comprador.nome.toLowerCase().includes(termo);
    const matchCpf = comprador.cpf?.toLowerCase().includes(termo);
    const matchNome2 = comprador.nome2?.toLowerCase().includes(termo);
    const matchLote = comprador.lotes.some(
      (lote) =>
        lote.quadra.toLowerCase().includes(termo) ||
        lote.numeroLote.toLowerCase().includes(termo)
    );
    return matchNome || matchCpf || matchNome2 || matchLote;
  });

  // Recalcular totais filtrados
  const totalFiltrado = compradoresFiltrados.reduce((sum, c) => sum + c.totalGeral, 0);
  const qtdParcelasFiltrado = compradoresFiltrados.reduce((sum, c) => sum + c.qtdParcelasAtraso, 0);
  const qtdLotesFiltrado = compradoresFiltrados.reduce((sum, c) => sum + c.lotes.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório de Inadimplência</h1>
          <p className="text-muted-foreground">
            Visão consolidada de todos os lotes com parcelas em atraso, agrupados por comprador
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Compradores Inadimplentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchTerm ? compradoresFiltrados.length : relatorio.compradores.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Lotes com Atraso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchTerm ? qtdLotesFiltrado : relatorio.qtdLotesInadimplentes}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Parcelas em Atraso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchTerm ? qtdParcelasFiltrado : relatorio.qtdTotalParcelasAtraso}
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Total Devido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {formatCurrency(searchTerm ? totalFiltrado : relatorio.totalGeralDevido)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info do relatório */}
          <Card className="bg-muted/30">
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  Dados obtidos da tabela de parcelas abertas (Contas a Receber).
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Busca */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button variant="ghost" onClick={() => setSearchTerm("")}>
                Limpar filtro
              </Button>
            )}
          </div>

          {/* Lista de compradores */}
          {compradoresFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {searchTerm ? (
                  <>
                    <h3 className="text-lg font-medium">Nenhum resultado encontrado</h3>
                    <p className="text-muted-foreground">
                      Nenhum comprador ou lote corresponde ao termo "{searchTerm}"
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-green-600">Parabéns!</h3>
                    <p className="text-muted-foreground">
                      Não há parcelas em atraso no momento.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {compradoresFiltrados.map((comprador) => (
                <CompradorCard key={comprador.compradorId} comprador={comprador} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
