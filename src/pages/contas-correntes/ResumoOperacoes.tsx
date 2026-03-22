import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BarChart3, Wallet } from "lucide-react";
import { formatCurrency, formatCompetencia } from "@/lib/formatters";
import type { Lote } from "@/types";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { LoteSearchSelect } from "@/components/LoteSearchSelect";

/**
 * Movement type columns in the same order as Balancete
 */
const MOV_COLUMNS = [
  { key: "VENDA", label: "Vendas", short: "Venda", nature: "D" },
  { key: "ATUALIZACAO", label: "Atualiz.", short: "Atual.", nature: "D" },
  { key: "JUROS", label: "Juros", short: "Juros", nature: "D" },
  { key: "MULTA", label: "Multa", short: "Multa", nature: "D" },
  { key: "ARRAS", label: "Arras", short: "Arras", nature: "C" },
  { key: "PARCELA", label: "Parcelas", short: "Parc.", nature: "C" },
  { key: "REFORCO", label: "Reforços", short: "Ref.", nature: "C" },
  { key: "AMORTIZACAO_ESPECIAL", label: "Amort.Esp.", short: "Amort.", nature: "C" },
  { key: "OUTROS", label: "Outros", short: "Outros", nature: "X" },
] as const;

const KNOWN_KEYS = new Set<string>(MOV_COLUMNS.filter(c => c.key !== "OUTROS").map(c => c.key));

interface MovRow {
  data_mov: string;
  tipo_mov: string;
  debito: number | null;
  credito: number | null;
  lote_id: string;
}

interface CompetenciaRow {
  competencia: string;
  values: Record<string, number>;
  totalDebitos: number;
  totalCreditos: number;
  saldo: number;
}

interface CompetenciaLoteRow extends CompetenciaRow {
  lote_id: string;
  quadra: string;
  numero_lote: string;
}

async function fetchAllMovimentos(): Promise<MovRow[]> {
  const PAGE = 1000;
  let all: MovRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("conta_corrente_lote")
      .select("data_mov, tipo_mov, debito, credito, lote_id")
      .order("data_mov", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as MovRow[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function buildConsolidado(movs: MovRow[], filterAno: string): CompetenciaRow[] {
  const map = new Map<string, Record<string, number>>();

  for (const m of movs) {
    const comp = m.data_mov.substring(0, 7); // YYYY-MM
    if (filterAno !== "TODOS" && !comp.startsWith(filterAno)) continue;

    if (!map.has(comp)) map.set(comp, {});
    const rec = map.get(comp)!;

    let key = m.tipo_mov;
    if (!KNOWN_KEYS.has(key)) key = "OUTROS";

    const val = (m.debito || 0) + (m.credito || 0);
    rec[key] = (rec[key] || 0) + val;
  }

  const rows: CompetenciaRow[] = [];
  for (const [comp, values] of map) {
    let totalDebitos = 0;
    let totalCreditos = 0;
    for (const col of MOV_COLUMNS) {
      const v = values[col.key] || 0;
      if (col.nature === "D") totalDebitos += v;
      else if (col.nature === "C") totalCreditos += v;
      else {
        // OUTROS: check sign — debito values are positive debits
        totalDebitos += v; // net amount
      }
    }
    rows.push({
      competencia: comp,
      values,
      totalDebitos,
      totalCreditos,
      saldo: totalDebitos - totalCreditos,
    });
  }

  rows.sort((a, b) => b.competencia.localeCompare(a.competencia));
  return rows;
}

function buildPorLote(
  movs: MovRow[],
  loteMap: Map<string, { quadra: string; numero_lote: string }>,
  filterAno: string,
  filterLote: string,
  searchTerm: string,
): CompetenciaLoteRow[] {
  const map = new Map<string, { values: Record<string, number>; lote_id: string }>();

  for (const m of movs) {
    const comp = m.data_mov.substring(0, 7);
    if (filterAno !== "TODOS" && !comp.startsWith(filterAno)) continue;
    if (filterLote !== "TODOS" && m.lote_id !== filterLote) continue;

    const lote = loteMap.get(m.lote_id);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !(lote?.quadra?.toLowerCase().includes(q) ||
          lote?.numero_lote?.toLowerCase().includes(q))
      ) continue;
    }

    const mapKey = `${comp}|${m.lote_id}`;
    if (!map.has(mapKey)) map.set(mapKey, { values: {}, lote_id: m.lote_id });
    const rec = map.get(mapKey)!;

    let key = m.tipo_mov;
    if (!KNOWN_KEYS.has(key)) key = "OUTROS";
    const val = (m.debito || 0) + (m.credito || 0);
    rec.values[key] = (rec.values[key] || 0) + val;
  }

  const rows: CompetenciaLoteRow[] = [];
  for (const [mapKey, { values, lote_id }] of map) {
    const comp = mapKey.split("|")[0];
    const lote = loteMap.get(lote_id);
    let totalDebitos = 0;
    let totalCreditos = 0;
    for (const col of MOV_COLUMNS) {
      const v = values[col.key] || 0;
      if (col.nature === "D") totalDebitos += v;
      else if (col.nature === "C") totalCreditos += v;
      else totalDebitos += v;
    }
    rows.push({
      competencia: comp,
      lote_id,
      quadra: lote?.quadra || "",
      numero_lote: lote?.numero_lote || "",
      values,
      totalDebitos,
      totalCreditos,
      saldo: totalDebitos - totalCreditos,
    });
  }

  rows.sort((a, b) => {
    const c = b.competencia.localeCompare(a.competencia);
    if (c !== 0) return c;
    const qa = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
    if (qa !== 0) return qa;
    return a.numero_lote.localeCompare(b.numero_lote, "pt-BR", { numeric: true });
  });

  return rows;
}

function fmtCompact(value: number): string {
  if (value === 0) return "-";
  // Format without cents for compactness
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function ResumoOperacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLote, setFilterLote] = useState<string>("TODOS");
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());

  const { data: allMovimentos, isLoading } = useQuery({
    queryKey: ["resumo-operacoes-movimentos"],
    queryFn: fetchAllMovimentos,
  });

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

  const loteMap = useMemo(() => {
    const m = new Map<string, { quadra: string; numero_lote: string }>();
    lotes?.forEach((l) => m.set(l.id, { quadra: l.quadra, numero_lote: l.numero_lote }));
    return m;
  }, [lotes]);

  const anos = useMemo(() => {
    if (!allMovimentos) return [];
    const set = new Set(allMovimentos.map((m) => m.data_mov.substring(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allMovimentos]);

  const consolidado = useMemo(
    () => (allMovimentos ? buildConsolidado(allMovimentos, filterAno) : []),
    [allMovimentos, filterAno]
  );

  const porLote = useMemo(
    () =>
      allMovimentos
        ? buildPorLote(allMovimentos, loteMap, filterAno, filterLote, searchTerm)
        : [],
    [allMovimentos, loteMap, filterAno, filterLote, searchTerm]
  );

  const totaisConsolidado = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of consolidado) {
      for (const col of MOV_COLUMNS) {
        t[col.key] = (t[col.key] || 0) + (row.values[col.key] || 0);
      }
    }
    return t;
  }, [consolidado]);

  const totaisPorLote = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of porLote) {
      for (const col of MOV_COLUMNS) {
        t[col.key] = (t[col.key] || 0) + (row.values[col.key] || 0);
      }
    }
    return t;
  }, [porLote]);

  const totalSaldoConsolidado = consolidado.reduce((s, r) => s + r.saldo, 0);
  const totalSaldoPorLote = porLote.reduce((s, r) => s + r.saldo, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Resumo das Operações</h1>
        <p className="text-muted-foreground">
          Totalizações mensais por tipo de movimento
        </p>
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
                  <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="consolidado" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado Mensal</TabsTrigger>
          <TabsTrigger value="por-lote">Por Lote</TabsTrigger>
        </TabsList>

        {/* Consolidado */}
        <TabsContent value="consolidado">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Totalização Mensal Consolidada ({consolidado.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : consolidado.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">COMPETÊNCIA</TableHead>
                      {MOV_COLUMNS.map((col) => (
                        <TableHead key={col.key} className="text-right whitespace-nowrap text-xs">
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right whitespace-nowrap font-bold text-xs">SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consolidado.map((row) => (
                      <TableRow key={row.competencia}>
                        <TableCell className="font-medium capitalize whitespace-nowrap">
                          {formatCompetencia(row.competencia + "-01")}
                        </TableCell>
                        {MOV_COLUMNS.map((col) => {
                          const v = row.values[col.key] || 0;
                          return (
                            <TableCell
                              key={col.key}
                              className={`text-right text-xs tabular-nums ${
                                v === 0
                                  ? "text-muted-foreground"
                                  : col.nature === "D"
                                  ? "text-destructive"
                                  : col.nature === "C"
                                  ? "text-success"
                                  : ""
                              }`}
                            >
                              {v === 0 ? "-" : fmtCompact(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={`text-right font-semibold text-xs tabular-nums ${
                            row.saldo > 0 ? "text-destructive" : "text-success"
                          }`}
                        >
                          {fmtCompact(row.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      {MOV_COLUMNS.map((col) => {
                        const v = totaisConsolidado[col.key] || 0;
                        return (
                          <TableCell
                            key={col.key}
                            className={`text-right text-xs tabular-nums ${
                              v === 0
                                ? ""
                                : col.nature === "D"
                                ? "text-destructive"
                                : col.nature === "C"
                                ? "text-success"
                                : ""
                            }`}
                          >
                            {v === 0 ? "-" : fmtCompact(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={`text-right text-xs tabular-nums ${
                          totalSaldoConsolidado > 0 ? "text-destructive" : "text-success"
                        }`}
                      >
                        {fmtCompact(totalSaldoConsolidado)}
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

        {/* Por Lote */}
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
                <LoteSearchSelect
                  lotes={lotes}
                  value={filterLote}
                  onValueChange={setFilterLote}
                  placeholder="Filtrar por lote"
                  allOptionValue="TODOS"
                  allOptionLabel="Todos os lotes"
                  className="w-64"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Resumo por Lote ({porLote.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : porLote.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">COMPETÊNCIA</TableHead>
                      <TableHead className="whitespace-nowrap">QD</TableHead>
                      <TableHead className="whitespace-nowrap">LT</TableHead>
                      {MOV_COLUMNS.map((col) => (
                        <TableHead key={col.key} className="text-right whitespace-nowrap text-xs">
                          {col.short}
                        </TableHead>
                      ))}
                      <TableHead className="text-right whitespace-nowrap font-bold text-xs">SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porLote.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="capitalize whitespace-nowrap text-xs">
                          {formatCompetencia(row.competencia + "-01")}
                        </TableCell>
                        <TableCell className="font-medium text-xs">{row.quadra}</TableCell>
                        <TableCell className="text-xs">{row.numero_lote}</TableCell>
                        {MOV_COLUMNS.map((col) => {
                          const v = row.values[col.key] || 0;
                          return (
                            <TableCell
                              key={col.key}
                              className={`text-right text-xs tabular-nums ${
                                v === 0
                                  ? "text-muted-foreground"
                                  : col.nature === "D"
                                  ? "text-destructive"
                                  : col.nature === "C"
                                  ? "text-success"
                                  : ""
                              }`}
                            >
                              {v === 0 ? "-" : fmtCompact(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={`text-right font-semibold text-xs tabular-nums ${
                            row.saldo > 0 ? "text-destructive" : "text-success"
                          }`}
                        >
                          {fmtCompact(row.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      {MOV_COLUMNS.map((col) => {
                        const v = totaisPorLote[col.key] || 0;
                        return (
                          <TableCell
                            key={col.key}
                            className={`text-right text-xs tabular-nums ${
                              v === 0
                                ? ""
                                : col.nature === "D"
                                ? "text-destructive"
                                : col.nature === "C"
                                ? "text-success"
                                : ""
                            }`}
                          >
                            {v === 0 ? "-" : fmtCompact(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={`text-right text-xs tabular-nums ${
                          totalSaldoPorLote > 0 ? "text-destructive" : "text-success"
                        }`}
                      >
                        {fmtCompact(totalSaldoPorLote)}
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
