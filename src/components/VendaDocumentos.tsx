import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, FileText, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VendaDocumentosProps {
  vendaId: string;
  canEdit: boolean;
}

interface VendaDocumento {
  id: string;
  venda_id: string;
  nome: string;
  arquivo_path: string;
  arquivo_url: string | null;
  created_at: string | null;
}

const MAX_DOCUMENTS = 5;

export function VendaDocumentos({ vendaId, canEdit }: VendaDocumentosProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nomeDocumento, setNomeDocumento] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["venda-documentos", vendaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_documentos")
        .select("*")
        .eq("venda_id", vendaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as VendaDocumento[];
    },
    enabled: !!vendaId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: VendaDocumento) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("venda-documentos")
        .remove([doc.arquivo_path]);
      if (storageError) console.warn("Storage delete error:", storageError);

      // Delete from table
      const { error } = await supabase
        .from("venda_documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venda-documentos", vendaId] });
      toast.success("Documento excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir documento: " + error.message);
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!nomeDocumento.trim()) {
      toast.error("Informe o nome do documento antes de fazer upload.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if ((documentos?.length || 0) >= MAX_DOCUMENTS) {
      toast.error(`Máximo de ${MAX_DOCUMENTS} documentos por venda.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${vendaId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("venda-documentos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("venda-documentos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("venda_documentos")
        .insert({
          venda_id: vendaId,
          nome: nomeDocumento.trim(),
          arquivo_path: filePath,
          arquivo_url: urlData.publicUrl,
        });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["venda-documentos", vendaId] });
      setNomeDocumento("");
      toast.success("Documento enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar documento: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleView = (doc: VendaDocumento) => {
    if (doc.arquivo_url) {
      window.open(doc.arquivo_url, "_blank");
    }
  };

  const remaining = MAX_DOCUMENTS - (documentos?.length || 0);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <Label className="text-base font-semibold">
        Documentos ({documentos?.length || 0}/{MAX_DOCUMENTS})
      </Label>

      {/* Existing documents */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando documentos...</div>
      ) : documentos && documentos.length > 0 ? (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{doc.nome}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleView(doc)}
                title="Visualizar"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(doc)}
                  disabled={deleteMutation.isPending}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Nenhum documento anexado.</div>
      )}

      {/* Upload section */}
      {canEdit && remaining > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="nome_documento" className="text-xs">
              Nome do documento
            </Label>
            <Input
              id="nome_documento"
              value={nomeDocumento}
              onChange={(e) => setNomeDocumento(e.target.value)}
              placeholder="Ex: Contrato Original, Aditivo 1..."
              className="h-9 text-sm"
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!nomeDocumento.trim()) {
                  toast.error("Informe o nome do documento antes de fazer upload.");
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="h-9"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {remaining > 0 && remaining < MAX_DOCUMENTS && (
        <p className="text-xs text-muted-foreground">
          Ainda é possível anexar {remaining} documento{remaining > 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}
