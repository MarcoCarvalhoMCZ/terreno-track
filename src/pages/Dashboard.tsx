import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle, Building, DollarSign, AlertTriangle, TrendingUp, Calendar, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/date";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";
import { vendaStatusColors, vendaStatusLabels } from "@/constants/status";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: config } = useQuery({
    queryKey: ["configuracoes-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select(`*, vendedor:pessoas!vendedor_pessoa_id(nome_razao, cpf_cnpj)`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const PIE_COLORS: Record<string, string> = {
    VENDIDO: "#ef4444",
    QUITADO: "#000000",
    CANCELADO: "#9ca3af",
    DISPONIVEL: "#22c55e",
  };

  const { data: lotesStats } = useQuery({
    queryKey: ["lotes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lotes").select("status");
      if (error) throw error;
      const total = data.length;
      const disponivel = data.filter((l) => l.status === "DISPONIVEL").length;
      const vendido = data.filter((l) => l.status === "VENDIDO").length;
      const quitado = data.filter((l) => l.status === "QUITADO").length;
      const cancelado = data.filter((l) => l.status === "CANCELADO").length;
      const totalVendidos = vendido + quitado + cancelado;
      const reservado = data.filter((l) => l.status === "RESERVADO").length;
      return {
        total, disponivel, vendido, quitado, cancelado, reservado,
        totalVendidos,
        percentVendido: total > 0 ? ((totalVendidos / total) * 100).toFixed(0) : 0,
        percentDisponivel: total > 0 ? ((disponivel / total) * 100).toFixed(0) : 0,
      };
    },
  });

  const pieData = useMemo(() => {
    if (!lotesStats) return [];
    return [
      { name: "Vendidos", value: lotesStats.vendido, color: PIE_COLORS.VENDIDO },
      { name: "Quitados", value: lotesStats.quitado, color: PIE_COLORS.QUITADO },
      { name: "Cancelados", value: lotesStats.cancelado, color: PIE_COLORS.CANCELADO },
      { name: "Disponíveis", value: lotesStats.disponivel, color: PIE_COLORS.DISPONIVEL },
    ].filter(d => d.value > 0);
  }, [lotesStats]);

  const dataInicio12Meses = format(subMonths(new Date(), 12), "yyyy-MM-dd");

  const { data: vendasStats } = useQuery({
    queryKey: ["vendas-stats-12m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_venda, status, data_venda")
        .gte("data_venda", dataInicio12Meses);
      if (error) throw error;
      const ativas = data.filter((v) => v.status === "ATIVA");
      return {
        quantidade: data.length,
        ativas: ativas.length,
        totalVendido: ativas.reduce((sum, v) => sum + Number(v.valor_venda || 0), 0),
      };
    },
  });

  const { data: recebidoStats } = useQuery({
    queryKey: ["recebido-stats-12m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("credito, data_mov")
        .gte("data_mov", dataInicio12Meses);
      if (error) throw error;
      const total = data.reduce((sum, c) => sum + Number(c.credito || 0), 0);
      const now = new Date();
      const mesAtual = data.filter((c) => {
        const dataMov = parseDateOnly(c.data_mov);
        if (!dataMov) return false;
        return dataMov.getMonth() === now.getMonth() && dataMov.getFullYear() === now.getFullYear();
      });
      const totalMes = mesAtual.reduce((sum, c) => sum + Number(c.credito || 0), 0);
      return { total, totalMes };
    },
  });

  const { data: inadimplencia } = useQuery({
    queryKey: ["inadimplencia-stats"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data: vencidas, error } = await supabase
        .from("parcelas_abertas")
        .select("total_devido, vencimento, lote_id")
        .eq("status", "ABERTO")
        .lt("vencimento", hoje);
      if (error) throw error;
      const qtdVencidas = vencidas?.length || 0;
      const valorTotalAtraso = (vencidas || []).reduce((s, p) => s + (p.total_devido || 0), 0);
      const competenciasSet = new Set<string>();
      for (const p of (vencidas || [])) {
        if (p.vencimento) competenciasSet.add(p.vencimento.substring(0, 7));
      }
      let totalFaturado = 0;
      if (competenciasSet.size > 0) {
        const pageSize = 1000;
        let allDebitos: { debito: number | null; data_mov: string }[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: page, error: errD } = await supabase
            .from("conta_corrente_lote")
            .select("debito, data_mov")
            .gt("debito", 0)
            .range(from, from + pageSize - 1);
          if (errD) throw errD;
          allDebitos = allDebitos.concat(page || []);
          hasMore = (page?.length || 0) === pageSize;
          from += pageSize;
        }
        for (const d of allDebitos) {
          const comp = d.data_mov?.substring(0, 7);
          if (comp && competenciasSet.has(comp)) totalFaturado += d.debito || 0;
        }
      }
      const percentual = totalFaturado > 0 ? ((valorTotalAtraso / totalFaturado) * 100).toFixed(1) : "0";
      return { qtdVencidas, valorTotal: valorTotalAtraso, percentual };
    },
  });

  const { data: todasVendas } = useQuery({
    queryKey: ["vendas-por-ano"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendas").select("valor_venda, data_venda, lote_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: todosRecebimentos } = useQuery({
    queryKey: ["recebimentos-por-ano"],
    queryFn: async () => {
      const pageSize = 1000;
      let allData: { credito: number | null; data_mov: string; lote_id: string }[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("conta_corrente_lote")
          .select("credito, data_mov, lote_id")
          .gt("credito", 0)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < pageSize) hasMore = false;
        else from += pageSize;
      }
      return allData;
    },
  });

  const { data: contratosRecentes } = useQuery({
    queryKey: ["contratos-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(`*, comprador:pessoas!comprador_pessoa_id(nome_razao), lote:lotes(quadra, numero_lote)`)
        .order("data_venda", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: saldoLotes } = useQuery({
    queryKey: ["dashboard-saldo-lotes"],
    queryFn: async () => {
      const { data: vendas, error: vErr } = await supabase
        .from("vendas").select("lote_id").in("status", ["ATIVA", "QUITADA"]);
      if (vErr) throw vErr;
      const loteIds = Array.from(new Set((vendas || []).map(v => v.lote_id)));
      if (loteIds.length === 0) return { parcelamento: 0, reforco: 0, total: 0 };
      const pageSize = 1000;
      let all: { lote_id: string; debito: number | null; credito: number | null; tipo_fluxo: string | null }[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page, error } = await supabase
          .from("conta_corrente_lote")
          .select("lote_id, debito, credito, tipo_fluxo")
          .in("lote_id", loteIds)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all = all.concat(page || []);
        hasMore = (page?.length || 0) === pageSize;
        from += pageSize;
      }
      let parcelamento = 0;
      let reforco = 0;
      for (const m of all) {
        const v = (m.debito || 0) - (m.credito || 0);
        if (m.tipo_fluxo === "REFORCO") reforco += v;
        else parcelamento += v;
      }
      return { parcelamento, reforco, total: parcelamento + reforco };
    },
  });

  // Total recebido geral (all time) para gráfico de evolução
  const recebidoTotalGeral = useMemo(() => {
    return (todosRecebimentos || []).reduce((s, r) => s + Number(r.credito || 0), 0);
  }, [todosRecebimentos]);

  const vendasPorAno = useMemo(() => {
    const anos: Record<string, { valor: number; lotes: Set<string> }> = {};
    (todasVendas || []).forEach((v) => {
      if (v.data_venda) {
        const ano = v.data_venda.substring(0, 4);
        if (!anos[ano]) anos[ano] = { valor: 0, lotes: new Set() };
        anos[ano].valor += Number(v.valor_venda || 0);
        if (v.lote_id) anos[ano].lotes.add(v.lote_id);
      }
    });
    return Object.entries(anos)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, d]) => ({ ano, valor: d.valor, lotes: d.lotes.size }));
  }, [todasVendas]);

  const recebimentosPorAno = useMemo(() => {
    const anos: Record<string, { valor: number; lotes: Set<string> }> = {};
    (todosRecebimentos || []).forEach((r) => {
      if (r.data_mov) {
        const ano = r.data_mov.substring(0, 4);
        if (!anos[ano]) anos[ano] = { valor: 0, lotes: new Set() };
        anos[ano].valor += Number(r.credito || 0);
        if (r.lote_id) anos[ano].lotes.add(r.lote_id);
      }
    });
    return Object.entries(anos)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, d]) => ({ ano, valor: d.valor, lotes: d.lotes.size }));
  }, [todosRecebimentos]);

  const competenciaAtual = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {config?.vendedor?.nome_razao || "Loteamento"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {config?.vendedor?.cpf_cnpj || "CNPJ não cadastrado"}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">{competenciaAtual}</span>
        </div>
      </div>

      {/* KPI Cards - compact */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Lotes Vendidos</p>
                <p className="text-2xl font-bold">{lotesStats?.totalVendidos || 0}</p>
                <p className="text-xs text-muted-foreground">{lotesStats?.percentVendido}% do total</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Lotes Disponíveis</p>
                <p className="text-2xl font-bold">{lotesStats?.disponivel || 0}</p>
                <p className="text-xs text-muted-foreground">{lotesStats?.percentDisponivel}% do total</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Building className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recebido (12m)</p>
                <p className="text-xl font-bold">{formatCompactCurrency(recebidoStats?.total || 0)}</p>
                <p className="text-xs text-muted-foreground">Mês: {formatCompactCurrency(recebidoStats?.totalMes || 0)}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-warning bg-white shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inadimplência</p>
                <p className="text-2xl font-bold">{inadimplencia?.percentual || 0}%</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{formatCurrency(inadimplencia?.valorTotal || 0)}</p>
                  <p>{inadimplencia?.qtdVencidas || 0} parcelas em atraso</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo dos Lotes</p>
                <p className="text-xl font-bold">{formatCompactCurrency(saldoLotes?.total || 0)}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Parc: {formatCurrency(saldoLotes?.parcelamento || 0)}</p>
                  <p>Ref: {formatCurrency(saldoLotes?.reforco || 0)}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Vendas por Ano */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Vendas por Ano</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] px-4 pb-3">
            {vendasPorAno.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasPorAno}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ano" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                        <p className="font-medium">{d.ano}</p>
                        <p>{formatCurrency(d.valor)}</p>
                        <p className="text-muted-foreground">{d.lotes} lotes</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Nenhuma venda</div>
            )}
          </CardContent>
        </Card>

        {/* Recebimentos por Ano */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Recebimentos por Ano</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] px-4 pb-3">
            {recebimentosPorAno.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recebimentosPorAno}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ano" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                        <p className="font-medium">{d.ano}</p>
                        <p>{formatCurrency(d.valor)}</p>
                        <p className="text-muted-foreground">{d.lotes} lotes</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="valor" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Nenhum recebimento</div>
            )}
          </CardContent>
        </Card>

        {/* Evolução do Loteamento - Total Vendido vs Saldo a Receber */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Evolução do Loteamento</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {(() => {
              const totalVendido = saldoLotes?.total
                ? (saldoLotes.total + (recebidoTotalGeral || 0))
                : 0;
              const totalRecebido = recebidoTotalGeral || 0;
              const saldoDevedor = saldoLotes?.total || 0;
              const pctRecebido = totalVendido > 0 ? (totalRecebido / totalVendido) * 100 : 0;

              return (
                <div className="flex flex-col items-center">
                  <div className="h-[150px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Recebido", value: totalRecebido, fill: "hsl(142, 70%, 45%)" },
                            { name: "A Receber", value: saldoDevedor, fill: "#ef4444" },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="hsl(142, 70%, 45%)" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                                <p className="font-medium">{d.name}</p>
                                <p>{formatCurrency(d.value)}</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142, 70%, 45%)" }} />
                        <span>Recebido</span>
                      </div>
                      <span className="font-bold text-success">{formatCompactCurrency(totalRecebido)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-destructive" />
                        <span>A Receber</span>
                      </div>
                      <span className="font-bold text-destructive">{formatCompactCurrency(saldoDevedor)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Progresso</span>
                      <span>{pctRecebido.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Contratos Recentes + Distribuição dos Lotes */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Contratos Recentes */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm lg:col-span-2">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Contratos Recentes</CardTitle>
            <button onClick={() => navigate("/vendas")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-1">DATA</TableHead>
                  <TableHead className="text-xs py-1">LOTE</TableHead>
                  <TableHead className="text-xs py-1">COMPRADOR</TableHead>
                  <TableHead className="text-xs py-1">VALOR</TableHead>
                  <TableHead className="text-xs py-1">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratosRecentes && contratosRecentes.length > 0 ? (
                  contratosRecentes.map((contrato) => (
                    <TableRow key={contrato.id}>
                      <TableCell className="text-xs py-1.5">
                        {contrato.data_venda ? new Date(contrato.data_venda + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 font-medium">
                        {contrato.lote ? `Q${contrato.lote.quadra}-L${contrato.lote.numero_lote}` : "N/A"}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 truncate max-w-[180px]">
                        {contrato.comprador?.nome_razao || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs py-1.5">
                        {formatCurrency(Number(contrato.valor_venda))}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge className={`text-[10px] px-1.5 py-0 ${vendaStatusColors[contrato.status || "ATIVA"]}`}>
                          {vendaStatusLabels[contrato.status || "ATIVA"]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-xs">
                      Nenhum contrato
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Distribuição dos Lotes - Pie Chart */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Distribuição dos Lotes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-col items-center">
              <div className="h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                            <p className="font-medium">{d.name}: {d.value}</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1 text-xs">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
