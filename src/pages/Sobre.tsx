import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Sobre() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sobre</h1>
      <Card className="border-foreground/20 max-w-md">
        <CardHeader><CardTitle>EBL-Loteamentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Sistema completo para gestão de vendas de terrenos, controle financeiro e contabilidade.</p>
          <div className="pt-4 border-t"><p className="text-lg font-semibold text-primary">Powered by EBL</p><p className="text-sm text-muted-foreground">Data de criação: Janeiro 2025</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
