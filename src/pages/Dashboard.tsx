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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      const cancelado = data.filter((l) => l.status === "CANCELADO").length;

      return {
        total,
        disponivel,
        vendido,
        reservado,
        cancelado,
        percentVendido: total > 0 ? ((vendido / total) * 100).toFixed(0) : 0,
        percentDisponivel: total > 0 ? ((disponivel / total) * 100).toFixed(0) : 0,
      };
    },
  });

  // Stats de vendas
  const { data: vendasStats } = useQuery({
    queryKey: ["vendas-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_venda, status");
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

  // Total recebido
  const { data: recebidoStats } = useQuery({
    queryKey: ["recebido-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("credito, data_mov");
      if (error) throw error;

      const total = data.reduce((sum, c) => sum + Number(c.credito || 0), 0);

      // Recebido no mês atual
      const now = new Date();
      const mesAtual = data.filter((c) => {
        const dataMov = new Date(c.data_mov);
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

  // Inadimplência - parcelas vencidas e não pagas
  const { data: inadimplencia } = useQuery({
    queryKey: ["inadimplencia-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: vencidas, error } = await supabase
        .from("parcelas")
        .select("*, plano:planos_pagamento(venda_id)")
        .eq("status", "ABERTA")
        .lt("vencimento", today);
      if (error) throw error;

      const { data: totalParcelas } = await supabase
        .from("parcelas")
        .select("id");

      const percentual =
        totalParcelas && totalParcelas.length > 0
          ? ((vencidas.length / totalParcelas.length) * 100).toFixed(1)
          : 0;

      // Contar contratos únicos com inadimplência
      const contratosUnicos = new Set(
        vencidas.map((v) => v.plano?.venda_id).filter(Boolean)
      );

      return {
        quantidade: vencidas.length,
        percentual,
        contratos: contratosUnicos.size,
      };
    },
  });

  // Recebimentos mensais (últimos 6 meses)
  const { data: recebimentosMensais } = useQuery({
    queryKey: ["recebimentos-mensais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_totalizacao_mensal_consolidada")
        .select("*")
        .order("competencia", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
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

  const chartData = [
    {
      name: "Vendidos",
      value: lotesStats?.vendido || 0,
      color: "hsl(142, 70%, 45%)",
    },
    {
      name: "Disponíveis",
      value: lotesStats?.disponivel || 0,
      color: "hsl(200, 80%, 50%)",
    },
    {
      name: "Reservados",
      value: lotesStats?.reservado || 0,
      color: "hsl(45, 90%, 50%)",
    },
    {
      name: "Cancelados",
      value: lotesStats?.cancelado || 0,
      color: "hsl(0, 70%, 50%)",
    },
  ].filter((d) => d.value > 0);

  const barChartData = (recebimentosMensais || []).map((item) => ({
    mes: item.competencia
      ? format(new Date(item.competencia + "T00:00:00"), "MMM", { locale: ptBR })
      : "",
    previsto: Number(item.total_debitos || 0),
    recebido: Number(item.total_creditos || 0),
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(0)} mi`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)} mil`;
    }
    return formatCurrency(value);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "ATIVA":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            Ativo
          </Badge>
        );
      case "QUITADA":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Quitada
          </Badge>
        );
      case "CANCELADA":
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
            Cancelada
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            {status || "N/A"}
          </Badge>
        );
    }
  };

  const competenciaAtual = format(new Date(), "MMMM 'de' yyyy", {
    locale: ptBR,
  });

  const saldoAReceber =
    (vendasStats?.totalVendido || 0) - (recebidoStats?.total || 0);

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

        {/* Recebido no Mês */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recebido (Mês)</p>
                <p className="text-2xl font-bold">
                  {formatCompactCurrency(recebidoStats?.totalMes || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {formatCompactCurrency(recebidoStats?.total || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência */}
        <Card className="border-t-4 border-t-yellow-500 bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inadimplência</p>
                <p className="text-3xl font-bold">
                  {inadimplencia?.percentual || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {inadimplencia?.contratos || 0} contratos
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo a Receber */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo a Receber</p>
                <p className="text-2xl font-bold">
                  {formatCompactCurrency(saldoAReceber)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos os contratos
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Situação dos Lotes - Donut */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Situação dos Lotes</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ value }) => value}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />
                  {/* Centro com total */}
                  <text
                    x="50%"
                    y="45%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-2xl font-bold"
                    fill="currentColor"
                  >
                    {lotesStats?.total || 0}
                  </text>
                  <text
                    x="50%"
                    y="52%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs"
                    fill="gray"
                  >
                    Total
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum lote cadastrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recebimentos Mensais - Barras */}
        <Card className="border-t-4 border-t-primary bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recebimentos Mensais</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCompactCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar
                    dataKey="previsto"
                    name="Previsto"
                    fill="hsl(0, 0%, 20%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="recebido"
                    name="Recebido"
                    fill="hsl(142, 70%, 45%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum dado disponível
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
                      CT-{new Date(contrato.data_venda).getFullYear()}-
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
                    <TableCell>{getStatusBadge(contrato.status)}</TableCell>
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
