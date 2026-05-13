import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function Administrador() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Administrador</h1>
          <p className="text-sm text-muted-foreground">
            Configurações de uso exclusivo do administrador.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Página em preparação</CardTitle>
          <CardDescription>
            Esta página está pronta para receber os campos administrativos. Marque na conversa
            quais campos da tela "Configuração" devem migrar para cá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Após sua escolha, os campos marcados serão movidos para esta página e protegidos no
            banco de dados para edição exclusiva por administradores.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
