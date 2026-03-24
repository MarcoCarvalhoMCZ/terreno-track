import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";

interface AuditFooterProps {
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

/**
 * Resolves user UUIDs to profile names and displays audit info.
 * Shows only when at least one field is present.
 */
export function AuditFooter({ created_by, created_at, updated_by, updated_at }: AuditFooterProps) {
  const userIds = [created_by, updated_by].filter((id): id is string => !!id);
  const uniqueIds = [...new Set(userIds)];

  const { data: profiles } = useQuery({
    queryKey: ["audit-profiles", ...uniqueIds],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", uniqueIds);
      if (error) throw error;
      return data;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  if (!created_at && !updated_at) return null;

  const getName = (userId: string | null | undefined): string => {
    if (!userId) return "—";
    const profile = profiles?.find(p => p.id === userId);
    return profile?.nome || "—";
  };

  const formatDateTime = (dt: string | null | undefined): string => {
    if (!dt) return "—";
    try {
      return format(new Date(dt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  return (
    <>
      <Separator className="my-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {created_at && (
          <div>
            <span className="font-medium">Incluído por:</span>{" "}
            {getName(created_by)} em {formatDateTime(created_at)}
          </div>
        )}
        {updated_at && (
          <div>
            <span className="font-medium">Alterado por:</span>{" "}
            {getName(updated_by)} em {formatDateTime(updated_at)}
          </div>
        )}
      </div>
    </>
  );
}
