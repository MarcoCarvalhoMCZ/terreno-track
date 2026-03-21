import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  Building,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/date";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";
import { vendaStatusColors, vendaStatusLabels } from "@/constants/status";
import { LoteamentoMap } from "@/components/LoteamentoMap";

export default function Dashboard() {
  const navigate = useNavigate();

  // Buscar configurações com vendedor
  const { data: config } = useQuery({
    queryKey: ["configuracoes-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select(`
          *,
          vendedor:pessoas!vendedor_pessoa_id(nome_razao, cpf_cnpj)
        `)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar todos os lotes para o mapa (com nome do comprador)
  const { data: lotes } = useQuery({
    queryKey: ["lotes-mapa"],
    queryFn: async () => {
      const { data: lotesData, error } = await supabase
        .from("lotes")
        .select("id, quadra, numero_lote, status")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;

      // Buscar vendas ativas/quitadas com nome do comprador via pessoas
      const { data: vendasData } = await supabase
        .from("vendas")
        .select("lote_id, comprador_pessoa:pessoas!comprador_pessoa_id(nome_razao)")
        .in("status", ["ATIVA", "QUITADA"]);

      const vendaMap = new Map(
        (vendasData || []).map(v => [
          v.lote_id,
          (v.comprador_pessoa as any)?.nome_razao || null,
        ])
      );

      return (lotesData || []).map(l => ({
        ...l,
        comprador_nome: vendaMap.get(l.id) || null,
      }));
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Stats de lotes
  const { data: lotesStats } = useQuery({
    queryKey: ["lotes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lotes").select("status");
      if (error) throw error;

      const total = data.length;
      const disponivel = data.filter((l) => l.status === "DISPONIVEL").length;
      const vendido = data.filter((l) => l.status === "VENDIDO").length;
      const reservado = data.filter((l) => l.status === "RESERVADO").length;
      const quitado = data.filter((l) => l.status === "QUITADO").length;

      return {
        total,
        disponivel,
        vendido,
        reservado,
        quitado,
        percentVendido: total > 0 ? ((vendido / total) * 100).toFixed(0) : 0,
        percentDisponivel: total > 0 ? ((disponivel / total) * 100).toFixed(0) : 0,
      };
    },
  });

  // Calcular data de 12 meses atrás
  const dataInicio12Meses = format(subMonths(new Date(), 12), "yyyy-MM-dd");

  // Stats de vendas (últimos 12 meses)
  const { data: vendasStats } = useQuery({
    queryKey: ["vendas-stats-12m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_venda, status, data_venda")
        .gte("data_venda", dataInicio12Meses);
      if (error) throw error;

      const ativas = data.filter((v) => v.status === "ATIVA");
      const totalVendido = ativas.reduce(
        (sum, v) => sum + Number(v.valor_venda || 0),
        0
      );

      return {
        quantidade: data.length,
        ativas: ativas.length,
        totalVendido,
      };
    },
  });

  // Total recebido (últimos 12 meses)
  const { data: recebidoStats } = useQuery({
    queryKey: ["recebido-stats-12m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("credito, data_mov")
        .gte("data_mov", dataInicio12Meses);
      if (error) throw error;

      const total = data.reduce((sum, c) => sum + Number(c.credito || 0), 0);

      // Recebido no mês atual
      const now = new Date();
      const mesAtual = data.filter((c) => {
        const dataMov = parseDateOnly(c.data_mov);
        if (!dataMov) return false;
        return (
          dataMov.getMonth() === now.getMonth() &&
          dataMov.getFullYear() === now.getFullYear()
        );
      });
      const totalMes = mesAtual.reduce(
        (sum, c) => sum + Number(c.credito || 0),
        0
      );

      return { total, totalMes };
    },
  });

  // Inadimplência - vendas ativas com parcelas vencidas (via conta_corrente_lote)
  const { data: inadimplencia } = useQuery({
    queryKey: ["inadimplencia-stats"],
    queryFn: async () => {
      // Buscar vendas ativas com dados necessários
      const { data: vendasAtivas, error: errVendas } = await supabase
        .from("vendas")
        .select("id, lote_id, qtd_parcelas, qtd_reforcos, primeiro_vencimento_parcela, primeiro_vencimento_reforco, frequencia_parcelas_meses, frequencia_reforcos_meses")
        .eq("status", "ATIVA");
      if (errVendas) throw errVendas;

      // Buscar contagem de pagamentos por lote
      const { data: pagamentos, error: errPag } = await supabase
        .from("conta_corrente_lote")
        .select("lote_id, tipo_fluxo")
        .in("tipo_mov", ["PARCELA", "REFORCO"])
        .gt("credito", 0);
      if (errPag) throw errPag;

      const pagMap: Record<string, { parc: number; ref: number }> = {};
      (pagamentos || []).forEach(p => {
        if (!pagMap[p.lote_id]) pagMap[p.lote_id] = { parc: 0, ref: 0 };
        if (p.tipo_fluxo === "PARCELAMENTO") pagMap[p.lote_id].parc++;
        else if (p.tipo_fluxo === "REFORCO") pagMap[p.lote_id].ref++;
      });

      const hoje = new Date();
      let parcelasVencidas = 0;
      let totalParcelas = 0;
      const contratosInadimplentes = new Set<string>();

      for (const v of (vendasAtivas || [])) {
        // Verificar PARCELAMENTO
        if (v.primeiro_vencimento_parcela && v.qtd_parcelas) {
          const pagas = pagMap[v.lote_id]?.parc || 0;
          const aPagar = Math.max(0, v.qtd_parcelas - pagas);
          totalParcelas += v.qtd_parcelas;
          const freq = v.frequencia_parcelas_meses || 1;
          const pv = new Date(v.primeiro_vencimento_parcela);
          for (let i = 0; i < aPagar; i++) {
            const venc = new Date(pv);
            venc.setMonth(venc.getMonth() + (pagas + i) * freq);
            if (venc < hoje) {
              parcelasVencidas++;
              contratosInadimplentes.add(v.id);
            }
          }
        }
        // Verificar REFORÇO
        if (v.primeiro_vencimento_reforco && v.qtd_reforcos) {
          const pagas = pagMap[v.lote_id]?.ref || 0;
          const aPagar = Math.max(0, v.qtd_reforcos - pagas);
          totalParcelas += v.qtd_reforcos;
          const freq = v.frequencia_reforcos_meses || 12;
          const pv = new Date(v.primeiro_vencimento_reforco);
          for (let i = 0; i < aPagar; i++) {
            const venc = new Date(pv);
            venc.setMonth(venc.getMonth() + (pagas + i) * freq);
            if (venc < hoje) {
              parcelasVencidas++;
              contratosInadimplentes.add(v.id);
            }
          }
        }
      }

      const percentual = totalParcelas > 0
        ? ((parcelasVencidas / totalParcelas) * 100).toFixed(1)
        : 0;

      return {
        quantidade: parcelasVencidas,
        percentual,
        contratos: contratosInadimplentes.size,
      };
    },
  });

  // Vendas totais (todas, para agrupar por ano)
  const { data: todasVendas } = useQuery({
    queryKey: ["vendas-por-ano"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_venda, data_venda, lote_id");
      if (error) throw error;
      return data || [];
    },
  });

  // Recebimentos totais (todos, para agrupar por ano)
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

  // Contratos recentes
  const { data: contratosRecentes } = useQuery({
    queryKey: ["contratos-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          `
          *,
          comprador:pessoas!comprador_pessoa_id(nome_razao),
          lote:lotes(quadra, numero_lote)
        `
        )
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Agrupar vendas por ano
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

  // Agrupar recebimentos por ano
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


  // Saldo dos Lotes (parcelamento + reforço)
  const { data: saldoLotes } = useQuery({
    queryKey: ["dashboard-saldo-lotes"],
    queryFn: async () => {
      // Buscar lotes com vendas ativas/quitadas
      const { data: vendas, error: vErr } = await supabase
        .from("vendas")
        .select("lote_id")
        .in("status", ["ATIVA", "QUITADA"]);
      if (vErr) throw vErr;
      const loteIds = Array.from(new Set((vendas || []).map(v => v.lote_id)));
      if (loteIds.length === 0) return { parcelamento: 0, reforco: 0, total: 0 };

      // Buscar todos os movimentos (paginado)
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

  const competenciaAtual = format(new Date(), "MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <div className="space-y-6">
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
          <span className="text-sm font-medium capitalize">
            {competenciaAtual}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Lotes Vendidos */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lotes Vendidos</p>
                <p className="text-3xl font-bold">{lotesStats?.vendido || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lotesStats?.percentVendido}% do total
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lotes Disponíveis */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Lotes Disponíveis
                </p>
                <p className="text-3xl font-bold">
                  {lotesStats?.disponivel || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lotesStats?.percentDisponivel}% do total
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recebido (12 meses) */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recebido (12m)</p>
                <p className="text-2xl font-bold">
                  {formatCompactCurrency(recebidoStats?.total || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mês: {formatCompactCurrency(recebidoStats?.totalMes || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência */}
        <Card className="border-t-4 border-t-warning bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inadimplência</p>
                <p className="text-3xl font-bold">
                  {inadimplencia?.percentual || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {inadimplencia?.contratos || 0} contratos (12m)
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo dos Lotes */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo dos Lotes</p>
                <p className="text-2xl font-bold">
                  {formatCompactCurrency(saldoLotes?.total || 0)}
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <p>Parc: {formatCompactCurrency(saldoLotes?.parcelamento || 0)}</p>
                  <p>Ref: {formatCompactCurrency(saldoLotes?.reforco || 0)}</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa do Loteamento */}
      <Card className="border-t-4 border-t-primary bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Mapa do Loteamento</CardTitle>
        </CardHeader>
        <CardContent>
          <LoteamentoMap lotes={lotes || []} />
        </CardContent>
      </Card>

      {/* Vendas e Recebimentos por Ano */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vendas por Ano */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Vendas por Ano</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {vendasPorAno.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasPorAno}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ano" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                        <p className="font-medium">{d.ano}</p>
                        <p className="text-foreground">{formatCurrency(d.valor)}</p>
                        <p className="text-muted-foreground">{d.lotes} {d.lotes === 1 ? 'lote' : 'lotes'}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="valor" name="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhuma venda registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recebimentos por Ano */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recebimentos por Ano</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {recebimentosPorAno.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recebimentosPorAno}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ano" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                        <p className="font-medium">{d.ano}</p>
                        <p className="text-foreground">{formatCurrency(d.valor)}</p>
                        <p className="text-muted-foreground">{d.lotes} {d.lotes === 1 ? 'lote' : 'lotes'}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="valor" name="Recebido" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum recebimento registrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contratos Recentes */}
      <Card className="border-t-4 border-t-primary bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contratos Recentes</CardTitle>
          <button
            onClick={() => navigate("/vendas")}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todos <ChevronRight className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CONTRATO</TableHead>
                <TableHead>COMPRADOR</TableHead>
                <TableHead>LOTE</TableHead>
                <TableHead>VALOR</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratosRecentes && contratosRecentes.length > 0 ? (
                contratosRecentes.map((contrato, index) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">
                      CT-{(parseDateOnly(contrato.data_venda)?.getFullYear() ?? new Date(contrato.data_venda).getFullYear())}-
                      {String(index + 1).padStart(3, "0")}
                    </TableCell>
                    <TableCell>
                      {contrato.comprador?.nome_razao || "N/A"}
                    </TableCell>
                    <TableCell>
                      {contrato.lote
                        ? `Q${contrato.lote.quadra}-L${contrato.lote.numero_lote}`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(Number(contrato.valor_venda))}
                    </TableCell>
                    <TableCell>
                      <Badge className={vendaStatusColors[contrato.status || "ATIVA"]}>
                        {vendaStatusLabels[contrato.status || "ATIVA"]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum contrato encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
