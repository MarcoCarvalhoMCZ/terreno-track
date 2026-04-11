import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapaLoteamento = lazy(() => import("./pages/MapaLoteamento"));
const Lotes = lazy(() => import("./pages/cadastro/Lotes"));
const Pessoas = lazy(() => import("./pages/cadastro/Pessoas"));
const Indicadores = lazy(() => import("./pages/cadastro/Indicadores"));
const Vendas = lazy(() => import("./pages/Vendas"));
const RecebimentoParcela = lazy(() => import("./pages/RecebimentoParcela"));
const ContaCorrenteLote = lazy(() => import("./pages/contas-correntes/ContaCorrenteLote"));
const ConsultaLote = lazy(() => import("./pages/contas-correntes/ConsultaLote"));
const RelatorioInadimplencia = lazy(() => import("./pages/contas-correntes/RelatorioInadimplencia"));
const RelGerencialInadimplencia = lazy(() => import("./pages/contas-correntes/RelGerencialInadimplencia"));
const ResumoOperacoes = lazy(() => import("./pages/contas-correntes/ResumoOperacoes"));
const AtualizacaoMonetaria = lazy(() => import("./pages/contas-correntes/AtualizacaoMonetaria"));
const Reorganizacao = lazy(() => import("./pages/contas-correntes/Reorganizacao"));
const RecalculoGeral = lazy(() => import("./pages/contabilidade/RecalculoGeral"));
const ContasContabeis = lazy(() => import("./pages/contabilidade/ContasContabeis"));
const MapaMovimentoConta = lazy(() => import("./pages/contabilidade/MapaMovimentoConta"));
const Balancete = lazy(() => import("./pages/contabilidade/Balancete"));
const SlipContabil = lazy(() => import("./pages/contabilidade/SlipContabil"));
const SaldoLotes = lazy(() => import("./pages/contabilidade/SaldoLotes"));
const FluxoCobrancas = lazy(() => import("./pages/relatorios/FluxoCobrancas"));
const ExportacaoExtratos = lazy(() => import("./pages/relatorios/ExportacaoExtratos"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Importacao = lazy(() => import("./pages/Importacao"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Usuarios = lazy(() => import("./pages/admin/Usuarios"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/mapa-loteamento" element={<ProtectedRoute><MapaLoteamento /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
        <Route path="/cadastro/lotes" element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
        <Route path="/cadastro/pessoas" element={<ProtectedRoute><Pessoas /></ProtectedRoute>} />
        <Route path="/cadastro/indicadores" element={<ProtectedRoute><Indicadores /></ProtectedRoute>} />
        <Route path="/vendas" element={<ProtectedRoute><Vendas /></ProtectedRoute>} />
        <Route path="/recebimento-parcela" element={<ProtectedRoute><RecebimentoParcela /></ProtectedRoute>} />
        <Route path="/contas-correntes/lote" element={<ProtectedRoute><ContaCorrenteLote /></ProtectedRoute>} />
        <Route path="/contas-correntes/consulta" element={<ProtectedRoute><ConsultaLote /></ProtectedRoute>} />
        <Route path="/contas-correntes/inadimplencia" element={<ProtectedRoute><RelatorioInadimplencia /></ProtectedRoute>} />
        <Route path="/contas-correntes/inadimplencia-gerencial" element={<ProtectedRoute><RelGerencialInadimplencia /></ProtectedRoute>} />
        <Route path="/contas-correntes/resumo" element={<ProtectedRoute><ResumoOperacoes /></ProtectedRoute>} />
        <Route path="/contas-correntes/atualizacao" element={<ProtectedRoute><AtualizacaoMonetaria /></ProtectedRoute>} />
        <Route path="/contas-correntes/reorganizacao" element={<ProtectedRoute><Reorganizacao /></ProtectedRoute>} />
        <Route path="/contabilidade/recalculo" element={<ProtectedRoute><RecalculoGeral /></ProtectedRoute>} />
        <Route path="/contabilidade/contas" element={<ProtectedRoute><ContasContabeis /></ProtectedRoute>} />
        <Route path="/contabilidade/mapa" element={<ProtectedRoute><MapaMovimentoConta /></ProtectedRoute>} />
        <Route path="/contabilidade/balancete" element={<ProtectedRoute><Balancete /></ProtectedRoute>} />
        <Route path="/contabilidade/slip" element={<ProtectedRoute><SlipContabil /></ProtectedRoute>} />
        <Route path="/contabilidade/saldo-lotes" element={<ProtectedRoute><SaldoLotes /></ProtectedRoute>} />
        <Route path="/relatorios/fluxo-cobrancas" element={<ProtectedRoute><FluxoCobrancas /></ProtectedRoute>} />
        <Route path="/relatorios/exportacao-extratos" element={<ProtectedRoute><ExportacaoExtratos /></ProtectedRoute>} />
        <Route path="/importacao" element={<ProtectedRoute><Importacao /></ProtectedRoute>} />
        <Route path="/sobre" element={<ProtectedRoute><Sobre /></ProtectedRoute>} />
        <Route path="/admin/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
