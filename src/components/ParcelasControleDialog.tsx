import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings2 } from "lucide-react";
import { useParcelasControle, useSalvarParcelaControle } from "@/hooks/useParcelasControle";
import { formatDateBR } from "@/lib/date";

interface Props {
  loteId: string;
  loteLabel: string;
}

export function ParcelasControleDialog({ loteId, loteLabel }: Props) {
  const { data: controles } = useParcelasControle(loteId);
  const salvarMutation = useSalvarParcelaControle();
  const [open, setOpen] = useState(false);

  // Form state for PARCELAMENTO
  const [dataBaseParc, setDataBaseParc] = useState("");
  const [qtdPagasParc, setQtdPagasParc] = useState(0);
  const [obsParc, setObsParc] = useState("");

  // Form state for REFORCO
  const [dataBaseRef, setDataBaseRef] = useState("");
  const [qtdPagasRef, setQtdPagasRef] = useState(0);
  const [obsRef, setObsRef] = useState("");

  useEffect(() => {
    if (controles) {
      const parc = controles.find(c => c.tipo_fluxo === "PARCELAMENTO");
      if (parc) {
        setDataBaseParc(parc.data_base);
        setQtdPagasParc(parc.qtd_pagas_base);
        setObsParc(parc.observacoes || "");
      }
      const ref = controles.find(c => c.tipo_fluxo === "REFORCO");
      if (ref) {
        setDataBaseRef(ref.data_base);
        setQtdPagasRef(ref.qtd_pagas_base);
        setObsRef(ref.observacoes || "");
      }
    }
  }, [controles]);

  const handleSave = async () => {
    const promises: Promise<any>[] = [];
    if (dataBaseParc) {
      promises.push(
        salvarMutation.mutateAsync({
          lote_id: loteId,
          tipo_fluxo: "PARCELAMENTO",
          data_base: dataBaseParc,
          qtd_pagas_base: qtdPagasParc,
          observacoes: obsParc,
        })
      );
    }
    if (dataBaseRef) {
      promises.push(
        salvarMutation.mutateAsync({
          lote_id: loteId,
          tipo_fluxo: "REFORCO",
          data_base: dataBaseRef,
          qtd_pagas_base: qtdPagasRef,
          observacoes: obsRef,
        })
      );
    }
    await Promise.all(promises);
    setOpen(false);
  };

  const parcControle = controles?.find(c => c.tipo_fluxo === "PARCELAMENTO");
  const refControle = controles?.find(c => c.tipo_fluxo === "REFORCO");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Controle de Parcelas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Controle de Parcelas Pagas - {loteLabel}</DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={salvarMutation.isPending || (!dataBaseParc && !dataBaseRef)}
            >
              {salvarMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Informe a data base e quantas parcelas estavam pagas até aquela data. O sistema contará novas parcelas automaticamente a partir dela.
        </p>

        <div className="space-y-6 mt-4">
          {/* PARCELAMENTO */}
          <div className="space-y-3 p-4 border rounded-lg">
            <h4 className="font-semibold">Parcelamento</h4>
            {parcControle && (
              <p className="text-xs text-muted-foreground">
                Atual: {parcControle.qtd_pagas_base} parcelas pagas até {formatDateBR(parcControle.data_base)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Base</Label>
                <Input
                  type="date"
                  value={dataBaseParc}
                  onChange={e => setDataBaseParc(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Parcelas Pagas até a Data</Label>
                <Input
                  type="number"
                  min={0}
                  value={qtdPagasParc}
                  onChange={e => setQtdPagasParc(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={obsParc}
                onChange={e => setObsParc(e.target.value)}
                placeholder="Ex: Dados importados do sistema anterior"
                rows={2}
              />
            </div>
          </div>

          {/* REFORÇO */}
          <div className="space-y-3 p-4 border rounded-lg">
            <h4 className="font-semibold">Reforços</h4>
            {refControle && (
              <p className="text-xs text-muted-foreground">
                Atual: {refControle.qtd_pagas_base} reforços pagos até {formatDateBR(refControle.data_base)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Base</Label>
                <Input
                  type="date"
                  value={dataBaseRef}
                  onChange={e => setDataBaseRef(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Reforços Pagos até a Data</Label>
                <Input
                  type="number"
                  min={0}
                  value={qtdPagasRef}
                  onChange={e => setQtdPagasRef(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={obsRef}
                onChange={e => setObsRef(e.target.value)}
                placeholder="Ex: Dados importados do sistema anterior"
                rows={2}
              />
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
