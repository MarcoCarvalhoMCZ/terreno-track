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

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const cadastroItems = [
  { title: "Lotes (Estoque)", url: "/cadastro/lotes", icon: MapPin },
  { title: "Indicadores de Atualização", url: "/cadastro/indicadores", icon: TrendingUp },
  { title: "Pessoas (PF/PJ)", url: "/cadastro/pessoas", icon: Users },
];

const contaCorrenteItems = [
  { title: "Conta Corrente do Lote", url: "/contas-correntes/lote", icon: Wallet },
  { title: "Atualização Monetária", url: "/contas-correntes/atualizacao", icon: TrendingUp },
  { title: "Resumo das Operações", url: "/contas-correntes/resumo", icon: FileSpreadsheet },
];

const contabilidadeItems = [
  { title: "Eventos Contábeis", url: "/contabilidade/eventos", icon: Calculator },
  { title: "Contas Contábeis", url: "/contabilidade/contas", icon: FileSpreadsheet },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, role } = useAuth();
  const [cadastroOpen, setCadastroOpen] = useState(true);
  const [contaCorrenteOpen, setContaCorrenteOpen] = useState(true);
  const [contabilidadeOpen, setContabilidadeOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;
  const isInGroup = (items: { url: string }[]) => items.some(item => isActive(item.url));

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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

        {/* Cadastro */}
        <SidebarGroup>
          <Collapsible open={cadastroOpen || isInGroup(cadastroItems)} onOpenChange={setCadastroOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                <span>Cadastro</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${cadastroOpen ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {cadastroItems.map((item) => (
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

        {/* Vendas */}
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

        {/* Contas Correntes */}
        <SidebarGroup>
          <Collapsible open={contaCorrenteOpen || isInGroup(contaCorrenteItems)} onOpenChange={setContaCorrenteOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                <span>Contas Correntes</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${contaCorrenteOpen ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {contaCorrenteItems.map((item) => (
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

        {/* Contabilidade */}
        <SidebarGroup>
          <Collapsible open={contabilidadeOpen || isInGroup(contabilidadeItems)} onOpenChange={setContabilidadeOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex justify-between items-center">
                <span>Contabilidade</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${contabilidadeOpen ? 'rotate-180' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {contabilidadeItems.map((item) => (
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

        {/* Import & Sobre */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/importacao")}>
                  <NavLink to="/importacao">
                    <FileUp className="h-4 w-4" />
                    <span>Importação (CSV)</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/sobre")}>
                  <NavLink to="/sobre">
                    <Info className="h-4 w-4" />
                    <span>Sobre</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
