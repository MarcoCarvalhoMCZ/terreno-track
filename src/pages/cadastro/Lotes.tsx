import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, MapPin, Eye } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  DISPONIVEL: "bg-success text-success-foreground",
  VENDIDO: "bg-info text-info-foreground",
  RESERVADO: "bg-warning text-warning-foreground",
  CANCELADO: "bg-destructive text-destructive-foreground",
};

export default function Lotes() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLote, setEditingLote] = useState<any>(null);
  const [formData, setFormData] = useState({ quadra: "", numero_lote: "", matricula_ri: "", area_m2: "", custo_contabil: "", etiqueta_patrimonial: "", status: "DISPONIVEL", observacoes: "" });

  const { data: lotes, isLoading } = useQuery({
    queryKey: ["lotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lotes").select("*").order("quadra").order("numero_lote");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingLote) {
        const { error } = await supabase.from("lotes").update({ ...data, area_m2: Number(data.area_m2) || null, custo_contabil: Number(data.custo_contabil) || null, updated_at: new Date().toISOString() }).eq("id", editingLote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lotes").insert([{ ...data, area_m2: Number(data.area_m2) || null, custo_contabil: Number(data.custo_contabil) || null }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success(editingLote ? "Lote atualizado!" : "Lote cadastrado!");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const resetForm = () => {
    setFormData({ quadra: "", numero_lote: "", matricula_ri: "", area_m2: "", custo_contabil: "", etiqueta_patrimonial: "", status: "DISPONIVEL", observacoes: "" });
    setEditingLote(null);
  };

  const openEdit = (lote: any) => {
    setEditingLote(lote);
    setFormData({ quadra: lote.quadra || "", numero_lote: lote.numero_lote || "", matricula_ri: lote.matricula_ri || "", area_m2: lote.area_m2?.toString() || "", custo_contabil: lote.custo_contabil?.toString() || "", etiqueta_patrimonial: lote.etiqueta_patrimonial || "", status: lote.status || "DISPONIVEL", observacoes: lote.observacoes || "" });
    setDialogOpen(true);
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lotes (Estoque)</h1>
          <p className="text-muted-foreground">Gerencie os lotes do loteamento</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Lote</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingLote ? "Editar Lote" : "Novo Lote"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Quadra</Label><Input value={formData.quadra} onChange={(e) => setFormData(f => ({ ...f, quadra: e.target.value }))} required className="border-foreground/30" /></div>
                  <div><Label>Nº Lote</Label><Input value={formData.numero_lote} onChange={(e) => setFormData(f => ({ ...f, numero_lote: e.target.value }))} required className="border-foreground/30" /></div>
                </div>
                <div><Label>Matrícula RI</Label><Input value={formData.matricula_ri} onChange={(e) => setFormData(f => ({ ...f, matricula_ri: e.target.value }))} className="border-foreground/30" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Área (m²)</Label><Input type="number" step="0.01" value={formData.area_m2} onChange={(e) => setFormData(f => ({ ...f, area_m2: e.target.value }))} className="border-foreground/30" /></div>
                  <div><Label>Custo Contábil</Label><Input type="number" step="0.01" value={formData.custo_contabil} onChange={(e) => setFormData(f => ({ ...f, custo_contabil: e.target.value }))} className="border-foreground/30" /></div>
                </div>
                <div><Label>Etiqueta Patrimonial</Label><Input value={formData.etiqueta_patrimonial} onChange={(e) => setFormData(f => ({ ...f, etiqueta_patrimonial: e.target.value }))} className="border-foreground/30" /></div>
                <div><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}><SelectTrigger className="border-foreground/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DISPONIVEL">Disponível</SelectItem><SelectItem value="RESERVADO">Reservado</SelectItem><SelectItem value="VENDIDO">Vendido</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select></div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? <p>Carregando...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lotes?.map((lote) => (
            <Card key={lote.id} className="border-foreground/20 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Quadra {lote.quadra} - Lote {lote.numero_lote}</CardTitle>
                  </div>
                  <Badge className={statusColors[lote.status] || ""}>{lote.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lote.matricula_ri && <p><span className="text-muted-foreground">Matrícula:</span> {lote.matricula_ri}</p>}
                {lote.area_m2 && <p><span className="text-muted-foreground">Área:</span> {lote.area_m2} m²</p>}
                {lote.custo_contabil && <p><span className="text-muted-foreground">Custo:</span> {formatCurrency(lote.custo_contabil)}</p>}
                {lote.etiqueta_patrimonial && <p><span className="text-muted-foreground">Etiqueta:</span> {lote.etiqueta_patrimonial}</p>}
                <div className="flex gap-2 pt-2">
                  {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(lote)}><Edit className="h-4 w-4 mr-1" />Editar</Button>}
                  <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {lotes?.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">Nenhum lote cadastrado</p>}
        </div>
      )}
    </div>
  );
}
