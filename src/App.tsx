import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Lotes from "./pages/cadastro/Lotes";
import Pessoas from "./pages/cadastro/Pessoas";
import Indicadores from "./pages/cadastro/Indicadores";
import Vendas from "./pages/Vendas";
import ContaCorrenteLote from "./pages/contas-correntes/ContaCorrenteLote";
import ResumoOperacoes from "./pages/contas-correntes/ResumoOperacoes";
import AtualizacaoMonetaria from "./pages/contas-correntes/AtualizacaoMonetaria";
import EventosContabeis from "./pages/contabilidade/EventosContabeis";
import ContasContabeis from "./pages/contabilidade/ContasContabeis";
import Configuracoes from "./pages/Configuracoes";
import Importacao from "./pages/Importacao";
import Sobre from "./pages/Sobre";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Carregando...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
      <Route path="/cadastro/lotes" element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
      <Route path="/cadastro/pessoas" element={<ProtectedRoute><Pessoas /></ProtectedRoute>} />
      <Route path="/cadastro/indicadores" element={<ProtectedRoute><Indicadores /></ProtectedRoute>} />
      <Route path="/vendas" element={<ProtectedRoute><Vendas /></ProtectedRoute>} />
      <Route path="/contas-correntes/lote" element={<ProtectedRoute><ContaCorrenteLote /></ProtectedRoute>} />
      <Route path="/contas-correntes/resumo" element={<ProtectedRoute><ResumoOperacoes /></ProtectedRoute>} />
      <Route path="/contas-correntes/atualizacao" element={<ProtectedRoute><AtualizacaoMonetaria /></ProtectedRoute>} />
      <Route path="/contabilidade/eventos" element={<ProtectedRoute><EventosContabeis /></ProtectedRoute>} />
      <Route path="/contabilidade/contas" element={<ProtectedRoute><ContasContabeis /></ProtectedRoute>} />
      <Route path="/importacao" element={<ProtectedRoute><Importacao /></ProtectedRoute>} />
      <Route path="/sobre" element={<ProtectedRoute><Sobre /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
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
);

export default App;
