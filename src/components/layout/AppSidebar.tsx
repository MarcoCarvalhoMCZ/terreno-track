import { useState } from "react";
import { useLocation } from "react-router-dom";
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
  FileSearch,
  RefreshCw,
  Shield,
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
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, MenuKey } from "@/hooks/usePermissions";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  menuKey: MenuKey;
}

const mainItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, menuKey: "dashboard" },
  { title: "Configurações", url: "/configuracoes", icon: Settings, menuKey: "configuracoes" },
];

const cadastroItems: MenuItem[] = [
  { title: "Lotes (Estoque)", url: "/cadastro/lotes", icon: MapPin, menuKey: "lotes" },
  { title: "Indicadores de Atualização", url: "/cadastro/indicadores", icon: TrendingUp, menuKey: "indicadores" },
  { title: "Pessoas (PF/PJ)", url: "/cadastro/pessoas", icon: Users, menuKey: "pessoas" },
];

const contaCorrenteItems: MenuItem[] = [
  { title: "Conta Corrente do Lote", url: "/contas-correntes/lote", icon: Wallet, menuKey: "contaCorrenteLote" },
  { title: "Consulta de Lote", url: "/contas-correntes/consulta", icon: FileSearch, menuKey: "consultaLote" },
  { title: "Atualização Monetária", url: "/contas-correntes/atualizacao", icon: TrendingUp, menuKey: "atualizacaoMonetaria" },
  { title: "Resumo das Operações", url: "/contas-correntes/resumo", icon: FileSpreadsheet, menuKey: "resumoOperacoes" },
  { title: "Reorganização", url: "/contas-correntes/reorganizacao", icon: RefreshCw, menuKey: "reorganizacao" },
];

const contabilidadeItems: MenuItem[] = [
  { title: "Eventos Contábeis", url: "/contabilidade/eventos", icon: Calculator, menuKey: "eventosContabeis" },
  { title: "Contas Contábeis", url: "/contabilidade/contas", icon: FileSpreadsheet, menuKey: "contasContabeis" },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, role, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [cadastroOpen, setCadastroOpen] = useState(true);
  const [contaCorrenteOpen, setContaCorrenteOpen] = useState(true);
  const [contabilidadeOpen, setContabilidadeOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;
  const isInGroup = (items: MenuItem[]) => items.some(item => isActive(item.url));

  // Filtrar itens baseado nas permissões
  const filterItems = (items: MenuItem[]) => items.filter(item => hasPermission(item.menuKey));

  const filteredMainItems = filterItems(mainItems);
  const filteredCadastroItems = filterItems(cadastroItems);
  const filteredContaCorrenteItems = filterItems(contaCorrenteItems);
  const filteredContabilidadeItems = filterItems(contabilidadeItems);

  const hasVendas = hasPermission("vendas");
  const hasImportacao = hasPermission("importacao");
  const hasSobre = hasPermission("sobre");
  const hasUsuarios = hasPermission("usuarios");

  return (
    <Sidebar className="border-r-0">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          🏡 Loteamento
        </h1>
        <p className="text-xs text-sidebar-foreground/70 mt-1">
          Controle de Vendas
        </p>
      </div>

      <SidebarContent className="px-2">
        {/* Main Items */}
        {filteredMainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Cadastro */}
        {filteredCadastroItems.length > 0 && (
          <SidebarGroup>
            <Collapsible open={cadastroOpen || isInGroup(filteredCadastroItems)} onOpenChange={setCadastroOpen}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                  <span>Cadastro</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${cadastroOpen ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenuSub>
                    {filteredCadastroItems.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} size="sm">
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Vendas */}
        {hasVendas && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/vendas")}>
                    <NavLink to="/vendas">
                      <ShoppingCart className="h-4 w-4" />
                      <span>Vendas</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Contas Correntes */}
        {filteredContaCorrenteItems.length > 0 && (
          <SidebarGroup>
            <Collapsible open={contaCorrenteOpen || isInGroup(filteredContaCorrenteItems)} onOpenChange={setContaCorrenteOpen}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                  <span>Contas Correntes</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${contaCorrenteOpen ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenuSub>
                    {filteredContaCorrenteItems.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} size="sm">
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Contabilidade */}
        {filteredContabilidadeItems.length > 0 && (
          <SidebarGroup>
            <Collapsible open={contabilidadeOpen || isInGroup(filteredContabilidadeItems)} onOpenChange={setContabilidadeOpen}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                  <span>Contabilidade</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${contabilidadeOpen ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenuSub>
                    {filteredContabilidadeItems.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} size="sm">
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Import, Sobre & Admin */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasImportacao && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/importacao")}>
                    <NavLink to="/importacao">
                      <FileUp className="h-4 w-4" />
                      <span>Importação (CSV)</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasSobre && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/sobre")}>
                    <NavLink to="/sobre">
                      <Info className="h-4 w-4" />
                      <span>Sobre</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/usuarios")}>
                    <NavLink to="/admin/usuarios">
                      <Shield className="h-4 w-4" />
                      <span>Usuários e Permissões</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
