import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function Dashboard() {
  const { data: lotesStats } = useQuery({
    queryKey: ["lotes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("status");
      if (error) throw error;
      
      const disponivel = data.filter(l => l.status === "DISPONIVEL").length;
      const vendido = data.filter(l => l.status === "VENDIDO").length;
      const reservado = data.filter(l => l.status === "RESERVADO").length;
      const cancelado = data.filter(l => l.status === "CANCELADO").length;
      
      return { total: data.length, disponivel, vendido, reservado, cancelado };
    },
  });

  const { data: vendasStats } = useQuery({
    queryKey: ["vendas-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_venda, status");
      if (error) throw error;
      
      const ativas = data.filter(v => v.status === "ATIVA");
      const totalVendido = ativas.reduce((sum, v) => sum + Number(v.valor_venda || 0), 0);
      
      return { 
        quantidade: data.length, 
        ativas: ativas.length,
        totalVendido 
      };
    },
  });

  const { data: recebidoStats } = useQuery({
    queryKey: ["recebido-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("credito");
      if (error) throw error;
      
      const total = data.reduce((sum, c) => sum + Number(c.credito || 0), 0);
      return { total };
    },
  });

  const chartData = [
    { name: "Disponível", value: lotesStats?.disponivel || 0, color: "hsl(142, 70%, 45%)" },
    { name: "Vendido", value: lotesStats?.vendido || 0, color: "hsl(200, 80%, 50%)" },
    { name: "Reservado", value: lotesStats?.reservado || 0, color: "hsl(45, 90%, 50%)" },
    { name: "Cancelado", value: lotesStats?.cancelado || 0, color: "hsl(0, 70%, 50%)" },
  ].filter(d => d.value > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do loteamento</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-foreground/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Lotes</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotesStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {lotesStats?.disponivel || 0} disponíveis
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lotes Vendidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotesStats?.vendido || 0}</div>
            <p className="text-xs text-muted-foreground">
              {vendasStats?.ativas || 0} vendas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(vendasStats?.totalVendido || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total das vendas
            </p>
          </CardContent>
        </Card>

        <Card className="border-foreground/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(recebidoStats?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valores recebidos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle>Distribuição de Lotes</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum lote cadastrado
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle>Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-secondary rounded-md">
              <span className="text-sm font-medium">Total a Receber</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency((vendasStats?.totalVendido || 0) - (recebidoStats?.total || 0))}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-secondary rounded-md">
              <span className="text-sm font-medium">% Recebido</span>
              <span className="text-lg font-bold text-primary">
                {vendasStats?.totalVendido 
                  ? ((recebidoStats?.total || 0) / vendasStats.totalVendido * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-secondary rounded-md">
              <span className="text-sm font-medium">Lotes Disponíveis</span>
              <span className="text-lg font-bold text-primary">
                {lotesStats?.disponivel || 0} / {lotesStats?.total || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
