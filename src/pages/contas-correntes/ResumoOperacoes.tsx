import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Wallet, BarChart3 } from "lucide-react";
import { formatCurrency, formatCompetencia } from "@/lib/formatters";
import type { Lote } from "@/types";

interface ResumoConsolidadoLocal {
  competencia: string;
  total_creditos: number;
  total_debitos: number;
  saldo_final: number;
}

interface ResumoPorLoteLocal {
  competencia: string;
  lote_id: string;
  quadra: string;
  numero_lote: string;
  total_creditos: number;
  total_debitos: number;
  saldo_periodo: number;
}

export default function ResumoOperacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLote, setFilterLote] = useState<string>("TODOS");
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());

  // Fetch consolidado mensal
  const { data: resumoConsolidado, isLoading: loadingConsolidado } = useQuery({
    queryKey: ["resumo-consolidado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_totalizacao_mensal_consolidada")
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data as ResumoConsolidadoLocal[];
    },
  });

  // Fetch resumo por lote
  const { data: resumoPorLote, isLoading: loadingPorLote } = useQuery({
    queryKey: ["resumo-por-lote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_resumo_operacoes_lote")
        .select("*")
        .order("competencia", { ascending: false })
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as ResumoPorLoteLocal[];
    },
  });

  // Fetch lotes para filtro
  const { data: lotes } = useQuery({
    queryKey: ["lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data as Lote[];
    },
  });

  // Get unique years from data
  const anos = Array.from(
    new Set([
      ...(resumoConsolidado?.map((r) => r.competencia?.substring(0, 4)) || []),
      ...(resumoPorLote?.map((r) => r.competencia?.substring(0, 4)) || []),
    ])
  )
    .filter(Boolean)
    .sort((a, b) => b!.localeCompare(a!));

  // Filter consolidado
  const filteredConsolidado = resumoConsolidado?.filter((item) => {
    if (!item.competencia) return false;
    const matchesAno = filterAno === "TODOS" || item.competencia.startsWith(filterAno);
    return matchesAno;
  });

  // Filter por lote
  const filteredPorLote = resumoPorLote?.filter((item) => {
    if (!item.competencia) return false;
    const matchesSearch =
      item.quadra?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.numero_lote?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLote = filterLote === "TODOS" || item.lote_id === filterLote;
    const matchesAno = filterAno === "TODOS" || item.competencia.startsWith(filterAno);
    return matchesSearch && matchesLote && matchesAno;
  });

  // Calculate totals
  const totaisConsolidado = filteredConsolidado?.reduce(
    (acc, item) => ({
      creditos: acc.creditos + (item.total_creditos || 0),
      debitos: acc.debitos + (item.total_debitos || 0),
      saldo: acc.saldo + (item.saldo_final || 0),
    }),
    { creditos: 0, debitos: 0, saldo: 0 }
  );

  const totaisPorLote = filteredPorLote?.reduce(
    (acc, item) => ({
      creditos: acc.creditos + (item.total_creditos || 0),
      debitos: acc.debitos + (item.total_debitos || 0),
      saldo: acc.saldo + (item.saldo_periodo || 0),
    }),
    { creditos: 0, debitos: 0, saldo: 0 }
  );


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Resumo das Operações</h1>
        <p className="text-muted-foreground">
          Totalizações mensais de créditos e débitos
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Faturado (Débitos)</p>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(totaisConsolidado?.debitos || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Recebido (Créditos)</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(totaisConsolidado?.creditos || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                <p className={`text-2xl font-bold ${((totaisConsolidado?.debitos || 0) - (totaisConsolidado?.creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency((totaisConsolidado?.debitos || 0) - (totaisConsolidado?.creditos || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-info/10 rounded-full">
                <BarChart3 className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meses c/ Movim.</p>
                <p className="text-2xl font-bold">
                  {filteredConsolidado?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {anos.map((ano) => (
                  <SelectItem key={ano} value={ano!}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="consolidado" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado Mensal</TabsTrigger>
          <TabsTrigger value="por-lote">Por Lote</TabsTrigger>
        </TabsList>

        {/* Consolidado View */}
        <TabsContent value="consolidado">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Totalização Mensal Consolidada ({filteredConsolidado?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConsolidado ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredConsolidado && filteredConsolidado.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>COMPETÊNCIA</TableHead>
                      <TableHead className="text-right">DÉBITOS</TableHead>
                      <TableHead className="text-right">CRÉDITOS</TableHead>
                      <TableHead className="text-right">SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsolidado.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium capitalize">
                          {formatCompetencia(item.competencia)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(item.total_debitos)}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(item.total_creditos)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${((item.total_debitos || 0) - (item.total_creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                          {formatCurrency((item.total_debitos || 0) - (item.total_creditos || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(totaisConsolidado?.debitos || 0)}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {formatCurrency(totaisConsolidado?.creditos || 0)}
                      </TableCell>
                      <TableCell className={`text-right ${((totaisConsolidado?.debitos || 0) - (totaisConsolidado?.creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency((totaisConsolidado?.debitos || 0) - (totaisConsolidado?.creditos || 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Por Lote View */}
        <TabsContent value="por-lote">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por quadra ou lote..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterLote} onValueChange={setFilterLote}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filtrar por lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os lotes</SelectItem>
                    {lotes?.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        Quadra {lote.quadra} - Lote {lote.numero_lote}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Resumo por Lote ({filteredPorLote?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPorLote ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredPorLote && filteredPorLote.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>COMPETÊNCIA</TableHead>
                      <TableHead>QUADRA</TableHead>
                      <TableHead>LOTE</TableHead>
                      <TableHead className="text-right">DÉBITOS</TableHead>
                      <TableHead className="text-right">CRÉDITOS</TableHead>
                      <TableHead className="text-right">SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPorLote.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="capitalize">
                          {formatCompetencia(item.competencia)}
                        </TableCell>
                        <TableCell className="font-medium">{item.quadra}</TableCell>
                        <TableCell>{item.numero_lote}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(item.total_debitos)}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(item.total_creditos)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${((item.total_debitos || 0) - (item.total_creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                          {formatCurrency((item.total_debitos || 0) - (item.total_creditos || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(totaisPorLote?.debitos || 0)}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {formatCurrency(totaisPorLote?.creditos || 0)}
                      </TableCell>
                      <TableCell className={`text-right ${((totaisPorLote?.debitos || 0) - (totaisPorLote?.creditos || 0)) > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency((totaisPorLote?.debitos || 0) - (totaisPorLote?.creditos || 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
