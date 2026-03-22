import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { loteMapColors, loteMapLabels } from "@/constants/status";
import type { LoteMinimal } from "@/types/lote.types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface LoteamentoMapProps {
  lotes: LoteMinimal[];
  onLoteClick?: (loteId: string) => void;
}

const PIE_COLORS: Record<string, string> = {
  VENDIDO: "#ef4444",    // red-500
  QUITADO: "#000000",    // black
  CANCELADO: "#9ca3af",  // gray-400
  DISPONIVEL: "#22c55e", // green-500
};

export function LoteamentoMap({ lotes, onLoteClick }: LoteamentoMapProps) {
  const navigate = useNavigate();

  const handleLoteClick = (lote: LoteMinimal) => {
    if (onLoteClick) {
      onLoteClick(lote.id);
    } else {
      navigate(`/contas-correntes/lote?loteId=${lote.id}`);
    }
  };

  // Agrupar lotes por quadra
  const lotesPorQuadra = lotes.reduce((acc, lote) => {
    const quadra = lote.quadra;
    if (!acc[quadra]) acc[quadra] = [];
    acc[quadra].push(lote);
    return acc;
  }, {} as Record<string, LoteMinimal[]>);

  const quadrasOrdenadas = Object.keys(lotesPorQuadra).sort();

  const getStatusColor = (status: string | null) => {
    return loteMapColors[status || ""] || "bg-gray-200 text-gray-700";
  };

  const getStatusLabel = (status: string | null) => {
    return loteMapLabels[status || ""] || status || "N/A";
  };

  // Dados do gráfico de pizza
  const pieData = useMemo(() => {
    const counts: Record<string, number> = { VENDIDO: 0, QUITADO: 0, CANCELADO: 0, DISPONIVEL: 0 };
    lotes.forEach((l) => {
      const s = l.status || "";
      if (s === "VENDIDO") counts.VENDIDO++;
      else if (s === "QUITADO") counts.QUITADO++;
      else if (s === "CANCELADO") counts.CANCELADO++;
      else if (s === "DISPONIVEL" || s === "RESERVADO") counts.DISPONIVEL++;
    });
    return [
      { name: "Vendidos", value: counts.VENDIDO, color: PIE_COLORS.VENDIDO },
      { name: "Quitados", value: counts.QUITADO, color: PIE_COLORS.QUITADO },
      { name: "Cancelados", value: counts.CANCELADO, color: PIE_COLORS.CANCELADO },
      { name: "Disponíveis", value: counts.DISPONIVEL, color: PIE_COLORS.DISPONIVEL },
    ].filter((d) => d.value > 0);
  }, [lotes]);

  if (lotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        Nenhum lote cadastrado
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Mapa */}
      <div className="space-y-4 flex-1 min-w-0">
        {/* Legenda */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-400 rounded" />
            <span>Em Venda</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span>Vendido</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-black rounded" />
            <span>Quitado</span>
          </div>
        </div>

        {/* Grid dos lotes */}
        <div className="overflow-x-auto">
          <div className="space-y-3 min-w-fit">
            {quadrasOrdenadas.map((quadra) => {
              const lotesQuadra = lotesPorQuadra[quadra].sort((a, b) => {
                const numA = parseInt(a.numero_lote) || 0;
                const numB = parseInt(b.numero_lote) || 0;
                return numA - numB;
              });

              return (
                <div key={quadra} className="flex items-center gap-2">
                  <div className="w-12 h-14 flex items-center justify-center bg-primary text-primary-foreground font-bold rounded text-sm shrink-0">
                    {quadra}
                  </div>
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(11, 5rem)' }}>
                    {lotesQuadra.map((lote) => {
                      const primeiroNome = lote.comprador_nome
                        ? lote.comprador_nome.split(" ")[0]
                        : null;
                      return (
                        <button
                          key={lote.id}
                          onClick={() => handleLoteClick(lote)}
                          className={cn(
                            "w-20 h-14 flex flex-col items-center justify-center rounded text-xs font-medium transition-all hover:scale-110 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            getStatusColor(lote.status)
                          )}
                          title={`Clique para ver Q${quadra}-L${lote.numero_lote}: ${getStatusLabel(lote.status)}${lote.comprador_nome ? ` - ${lote.comprador_nome}` : ''}`}
                        >
                          <span className="font-bold leading-tight">{lote.numero_lote}</span>
                          {primeiroNome && (
                            <span className="text-[9px] leading-tight truncate w-full text-center opacity-90">
                              {primeiroNome}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gráfico de Pizza */}
      <div className="w-64 shrink-0 flex flex-col items-center justify-center">
        <p className="text-sm font-semibold text-foreground mb-2">Distribuição dos Lotes</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-foreground">{d.value} lotes</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Legenda do gráfico */}
        <div className="space-y-1.5 mt-2 text-xs w-full">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
              </div>
              <span className="font-semibold text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
