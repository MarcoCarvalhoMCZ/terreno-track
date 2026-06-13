import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/login/ForgotPasswordDialog";

const REMEMBER_LOGIN_KEY = "ebl_loteamentos_remember_login";

type RememberedLogin = {
  email: string;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRegister, setShowPasswordRegister] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_LOGIN_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as RememberedLogin;
      setEmail(parsed.email || "");
      setRememberLogin(Boolean(parsed.email));
    } catch {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    
    if (error) {
      toast.error("Erro ao entrar: " + error.message);
    } else {
      if (rememberLogin) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ email }));
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY);
      }
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password, nome);
    setLoading(false);
    
    if (error) {
      toast.error("Erro ao criar conta: " + error.message);
    } else {
      toast.success("Conta criada com sucesso! Você já pode fazer login.");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-foreground/20">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏡</div>
          <CardTitle className="text-2xl">EBL-Loteamentos</CardTitle>
          <CardDescription>Sistema de vendas e gestão de terrenos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-foreground/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-foreground/30 pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-login"
                    checked={rememberLogin}
                    onCheckedChange={(checked) => setRememberLogin(checked === true)}
                  />
                  <Label htmlFor="remember-login" className="cursor-pointer text-sm font-normal">
                    Lembrar e-mail neste dispositivo
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline w-full text-center mt-2"
                  onClick={() => setForgotOpen(true)}
                >
                  Esqueci minha senha
                </button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  EBL - 01/2026
                </p>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="border-foreground/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-register">E-mail</Label>
                  <Input
                    id="email-register"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-foreground/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-register">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password-register"
                      type={showPasswordRegister ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="border-foreground/30 pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswordRegister((v) => !v)}
                    >
                      {showPasswordRegister ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O primeiro usuário cadastrado será Administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}
