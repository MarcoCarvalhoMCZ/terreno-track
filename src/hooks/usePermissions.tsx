import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Definição de todas as opções de menu disponíveis
export const MENU_ITEMS = {
  dashboard: { label: "Dashboard", path: "/" },
  configuracoes: { label: "Configurações", path: "/configuracoes" },
  lotes: { label: "Lotes (Estoque)", path: "/cadastro/lotes" },
  indicadores: { label: "Indicadores de Atualização", path: "/cadastro/indicadores" },
  pessoas: { label: "Pessoas (PF/PJ)", path: "/cadastro/pessoas" },
  vendas: { label: "Vendas", path: "/vendas" },
  recebimentoParcela: { label: "Recebimento de Parcela", path: "/recebimento-parcela" },
  contaCorrenteLote: { label: "Conta Corrente do Lote", path: "/contas-correntes/lote" },
  consultaLote: { label: "Consulta de Lote", path: "/contas-correntes/consulta" },
  relatorioInadimplencia: { label: "Relatório de Inadimplência", path: "/contas-correntes/inadimplencia" },
  atualizacaoMonetaria: { label: "Atualização Monetária", path: "/contas-correntes/atualizacao" },
  resumoOperacoes: { label: "Resumo das Operações", path: "/contas-correntes/resumo" },
  reorganizacao: { label: "Reorganização", path: "/contas-correntes/reorganizacao" },
  recalculoGeral: { label: "Recálculo Geral", path: "/contabilidade/recalculo" },
  contasContabeis: { label: "Plano de Contas", path: "/contabilidade/contas" },
  mapaMovimentoConta: { label: "Mapa Movimento × Conta", path: "/contabilidade/mapa" },
  balancete: { label: "Balancete do Loteamento", path: "/contabilidade/balancete" },
  slipContabil: { label: "Slip Contábil", path: "/contabilidade/slip" },
  importacao: { label: "Importação (CSV)", path: "/importacao" },
  sobre: { label: "Sobre", path: "/sobre" },
  usuarios: { label: "Usuários e Permissões", path: "/admin/usuarios" },
} as const;

export type MenuKey = keyof typeof MENU_ITEMS;

export function usePermissions() {
  const { user, isAdmin } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_menu_permissions")
        .select("menu_key")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data.map(p => p.menu_key);
    },
    enabled: !!user && !isAdmin,
  });

  // Admin tem acesso a tudo; "configuracoes" é exclusivo de Admin
  const hasPermission = (menuKey: MenuKey): boolean => {
    if (menuKey === "configuracoes") return isAdmin;
    if (isAdmin) return true;
    if (!permissions) return false;
    return permissions.includes(menuKey);
  };

  // Retorna lista de menu keys permitidos
  const allowedMenus = (): MenuKey[] => {
    if (isAdmin) return Object.keys(MENU_ITEMS) as MenuKey[];
    return (permissions || []) as MenuKey[];
  };

  return {
    hasPermission,
    allowedMenus,
    isLoading,
    permissions,
  };
}
