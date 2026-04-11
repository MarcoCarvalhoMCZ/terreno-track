import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Settings,
  Users,
  MapPin,
  TrendingUp,
  ShoppingCart,
  Wallet,
  FileSpreadsheet,
  Calculator,
  FileUp,
  Info,
  ChevronDown,
  LogOut,
  FileDown,
  FileSearch,
  RefreshCw,
  Shield,
  AlertTriangle,
  Receipt,
  BarChart3,
  FolderOpen,
  Briefcase,
  DollarSign,
  BookOpen,
  Wrench,
  MonitorCog,
  Calendar,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, MenuKey } from "@/hooks/usePermissions";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  menuKey: MenuKey;
  children?: MenuItem[];
}

// ═══ 1. INÍCIO ═══
const inicioItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, menuKey: "dashboard" },
  { title: "Mapa do Loteamento", url: "/mapa-loteamento", icon: MapPin, menuKey: "mapaLoteamento" },
];

// ═══ 2. CADASTROS ═══
const cadastroItems: MenuItem[] = [
  { title: "Lotes (Estoque)", url: "/cadastro/lotes", icon: MapPin, menuKey: "lotes" },
  { title: "Pessoas", url: "/cadastro/pessoas", icon: Users, menuKey: "pessoas" },
  {
    title: "Indicadores de Atualização",
    url: "/cadastro/indicadores",
    icon: TrendingUp,
    menuKey: "indicadores",
    children: [
      { title: "Cadastro de Indicadores", url: "/cadastro/indicadores?tab=indicadores", icon: TrendingUp, menuKey: "indicadores" },
      { title: "Cadastro de Cotações", url: "/cadastro/indicadores?tab=valores", icon: Calendar, menuKey: "indicadores" },
    ],
  },
];

// ═══ 3. OPERAÇÕES ═══
const operacoesItems: MenuItem[] = [
  { title: "Vendas", url: "/vendas", icon: ShoppingCart, menuKey: "vendas" },
  { title: "Recebimento de Parcela", url: "/recebimento-parcela", icon: Receipt, menuKey: "recebimentoParcela" },
];

// ═══ 4. LOTES E CONTRATOS ═══
const lotesContratosItems: MenuItem[] = [
  { title: "Situação do Lote", url: "/contas-correntes/consulta", icon: FileSearch, menuKey: "consultaLote" },
  { title: "Conta Corrente do Lote", url: "/contas-correntes/lote", icon: Wallet, menuKey: "contaCorrenteLote" },
];

// ═══ 5. CONTROLE FINANCEIRO ═══
const controleFinanceiroItems: MenuItem[] = [
  { title: "Inadimplência", url: "/contas-correntes/inadimplencia", icon: AlertTriangle, menuKey: "relatorioInadimplencia" },
  { title: "Contas a Receber", url: "/contas-correntes/inadimplencia-gerencial", icon: FileSpreadsheet, menuKey: "relGerencialInadimplencia" },
  { title: "Atualização Monetária", url: "/contas-correntes/atualizacao", icon: TrendingUp, menuKey: "atualizacaoMonetaria" },
  { title: "Fluxo Financeiro", url: "/contas-correntes/resumo", icon: BarChart3, menuKey: "resumoOperacoes" },
];

// ═══ 6. RELATÓRIOS ═══
const relatoriosItems: MenuItem[] = [
  { title: "Saldo dos Lotes", url: "/contabilidade/saldo-lotes", icon: FileSpreadsheet, menuKey: "saldoLotes" },
  { title: "Fluxo Cobranças", url: "/relatorios/fluxo-cobrancas", icon: Receipt, menuKey: "fluxoCobrancas" },
  { title: "Exportação de Extratos", url: "/relatorios/exportacao-extratos", icon: FileDown, menuKey: "exportacaoExtratos" },
];

// ═══ 7. CONTABILIDADE ═══
const contabilidadeItems: MenuItem[] = [
  { title: "Balancete do Loteamento", url: "/contabilidade/balancete", icon: Calculator, menuKey: "balancete" },
  { title: "Slip Contábil", url: "/contabilidade/slip", icon: FileSpreadsheet, menuKey: "slipContabil" },
  { title: "Plano de Contas", url: "/contabilidade/contas", icon: BookOpen, menuKey: "contasContabeis" },
  { title: "Integração Contábil", url: "/contabilidade/mapa", icon: FileSpreadsheet, menuKey: "mapaMovimentoConta" },
  { title: "Recálculo Contábil", url: "/contabilidade/recalculo", icon: RefreshCw, menuKey: "recalculoGeral" },
];

// ═══ 8. ADMINISTRAÇÃO ═══
const administracaoItems: MenuItem[] = [
  { title: "Reorganização", url: "/contas-correntes/reorganizacao", icon: RefreshCw, menuKey: "reorganizacao" },
  { title: "Importação CSV", url: "/importacao", icon: FileUp, menuKey: "importacao" },
  { title: "Usuários e Permissões", url: "/admin/usuarios", icon: Shield, menuKey: "usuarios" },
  { title: "Configuração", url: "/configuracoes", icon: Settings, menuKey: "configuracoes" },
];

// ═══ 9. SISTEMA ═══
const sistemaItems: MenuItem[] = [
  { title: "Sobre", url: "/sobre", icon: Info, menuKey: "sobre" },
];

interface MenuGroupConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  collapsible?: boolean;
}

const menuGroups: MenuGroupConfig[] = [
  { label: "Início", icon: LayoutDashboard, items: inicioItems, collapsible: false },
  { label: "Cadastros", icon: FolderOpen, items: cadastroItems, collapsible: true },
  { label: "Operações", icon: Briefcase, items: operacoesItems, collapsible: true },
  { label: "Lotes e Contratos", icon: Wallet, items: lotesContratosItems, collapsible: true },
  { label: "Controle Financeiro", icon: DollarSign, items: controleFinanceiroItems, collapsible: true },
  { label: "Relatórios", icon: BarChart3, items: relatoriosItems, collapsible: true },
  { label: "Contabilidade", icon: Calculator, items: contabilidadeItems, collapsible: true },
  { label: "Administração", icon: Wrench, items: administracaoItems, collapsible: true },
  { label: "Sistema", icon: MonitorCog, items: sistemaItems, collapsible: false },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, role, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();

  // Track open state per group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(g => { initial[g.label] = true; });
    return initial;
  });

  const toggleGroup = (label: string, value: boolean) => {
    setOpenGroups(prev => ({ ...prev, [label]: value }));
  };

  // Fetch logo
  const { data: logoUrl } = useQuery({
    queryKey: ["configuracoes-logo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("logotipo_url")
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data as any)?.logotipo_url || null;
    },
  });

  const isActive = (path: string) => {
    const [basePath] = path.split("?");
    return location.pathname === basePath;
  };

  const isInGroup = (items: MenuItem[]) =>
    items.some(item => isActive(item.url) || item.children?.some(c => isActive(c.url)));

  const filterItems = (items: MenuItem[]): MenuItem[] =>
    items.filter(item => {
      if (item.menuKey === "usuarios") return isAdmin;
      return hasPermission(item.menuKey);
    });

  const renderMenuItems = (items: MenuItem[], isSub = false) =>
    items.map((item) => {
      if (item.children) {
        const filteredChildren = filterItems(item.children);
        if (filteredChildren.length === 0) return null;
        return (
          <SidebarMenuItem key={item.title}>
            <Collapsible defaultOpen={isActive(item.url)}>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={isActive(item.url)} size="sm">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  <ChevronDown className="ml-auto h-3 w-3" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {filteredChildren.map(child => (
                    <SidebarMenuSubItem key={child.title}>
                      <SidebarMenuButton asChild isActive={location.pathname + location.search === child.url} size="sm">
                        <NavLink to={child.url}>
                          <child.icon className="h-3 w-3" />
                          <span>{child.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenuItem>
        );
      }

      const Wrapper = isSub ? SidebarMenuSubItem : SidebarMenuItem;
      return (
        <Wrapper key={item.title}>
          <SidebarMenuButton asChild isActive={isActive(item.url)} size="sm">
            <NavLink to={item.url} end={item.url === "/"}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </Wrapper>
      );
    });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-center">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
        ) : (
          <span className="text-3xl">🏡</span>
        )}
      </div>

      <SidebarContent className="px-2">
        {menuGroups.map((group, idx) => {
          const filtered = filterItems(group.items);
          if (filtered.length === 0) return null;

          const groupOpen = openGroups[group.label] || isInGroup(filtered);

          return (
            <div key={group.label}>
              {idx > 0 && <Separator className="my-1 opacity-30" />}
              <SidebarGroup>
                {group.collapsible ? (
                  <Collapsible open={groupOpen} onOpenChange={(v) => toggleGroup(group.label, v)}>
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center text-xs uppercase tracking-wider">
                        <span>{group.label}</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {renderMenuItems(filtered)}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <>
                    <SidebarGroupLabel className="px-2 py-1.5 text-xs uppercase tracking-wider">
                      {group.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {renderMenuItems(filtered)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </>
                )}
              </SidebarGroup>
            </div>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-sidebar-foreground/70">
            <p className="truncate">{user?.email}</p>
            <p className="font-medium">{role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
