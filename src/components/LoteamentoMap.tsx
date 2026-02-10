import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { loteMapColors, loteMapLabels } from "@/constants/status";
import type { LoteMinimal } from "@/types/lote.types";

interface LoteamentoMapProps {
  lotes: LoteMinimal[];
  onLoteClick?: (loteId: string) => void;
}

export function LoteamentoMap({ lotes, onLoteClick }: LoteamentoMapProps) {
  const navigate = useNavigate();

  const handleLoteClick = (lote: LoteMinimal) => {
    if (onLoteClick) {
      onLoteClick(lote.id);
    } else {
      // Navegar para conta corrente do lote com ID do lote
      navigate(`/contas-correntes/lote?loteId=${lote.id}`);
    }
  };
  // Agrupar lotes por quadra
  const lotesPorQuadra = lotes.reduce((acc, lote) => {
    const quadra = lote.quadra;
    if (!acc[quadra]) {
      acc[quadra] = [];
    }
    acc[quadra].push(lote);
    return acc;
  }, {} as Record<string, LoteMinimal[]>);

  // Ordenar quadras
  const quadrasOrdenadas = Object.keys(lotesPorQuadra).sort();

  // Função para determinar a cor de fundo baseada no status
  const getStatusColor = (status: string | null) => {
    return loteMapColors[status || ""] || "bg-gray-200 text-gray-700";
  };

  const getStatusLabel = (status: string | null) => {
    return loteMapLabels[status || ""] || status || "N/A";
  };

  if (lotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        Nenhum lote cadastrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Mapa do Loteamento */}
      <div className="overflow-x-auto">
        <div className="space-y-3 min-w-fit">
          {quadrasOrdenadas.map((quadra) => {
            // Ordenar lotes dentro da quadra por numero_lote
            const lotesQuadra = lotesPorQuadra[quadra].sort((a, b) => {
              const numA = parseInt(a.numero_lote) || 0;
              const numB = parseInt(b.numero_lote) || 0;
              return numA - numB;
            });

            return (
              <div key={quadra} className="flex items-center gap-2">
                {/* Label da Quadra */}
                <div className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground font-bold rounded text-sm shrink-0">
                  {quadra}
                </div>
                
                {/* Lotes da Quadra - 11 por linha */}
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(11, 3.5rem)' }}>
                  {lotesQuadra.map((lote) => (
                    <button
                      key={lote.id}
                      onClick={() => handleLoteClick(lote)}
                      className={cn(
                        "w-14 h-10 flex flex-col items-center justify-center rounded text-xs font-medium transition-all hover:scale-110 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        getStatusColor(lote.status)
                      )}
                      title={`Clique para ver Q${quadra}-L${lote.numero_lote}: ${getStatusLabel(lote.status)}`}
                    >
                      <span className="font-bold">{lote.numero_lote}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
