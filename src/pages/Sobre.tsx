import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Sobre() {
  const { data: config } = useQuery({
    queryKey: ["configuracoes-sobre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select(`
          *,
          vendedor:pessoas!vendedor_pessoa_id(nome_razao, cpf_cnpj)
        `)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const logoUrl = (config as any)?.logotipo_url;

  return (
    <div className="flex flex-col items-center space-y-6 py-8">
      <h1 className="text-3xl font-bold">Sobre</h1>

      <Card className="border-foreground/20 w-full max-w-lg text-center">
        <CardHeader className="flex flex-col items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
          ) : (
            <span className="text-5xl">🏡</span>
          )}
          <CardTitle className="text-2xl">EBL-Loteamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Sistema completo para gestão de vendas de terrenos, controle financeiro e contabilidade.
          </p>

          {/* Dados da Proprietária */}
          <div className="pt-4 border-t space-y-2">
            {(config as any)?.razao_social_proprietaria && (
              <p className="text-lg font-semibold text-foreground">
                {(config as any).razao_social_proprietaria}
              </p>
            )}
            {(config as any)?.cnpj_proprietaria && (
              <p className="text-sm text-muted-foreground">
                CNPJ: {(config as any).cnpj_proprietaria}
              </p>
            )}
            {(config as any)?.crc_rs_proprietaria && (
              <p className="text-sm text-muted-foreground">
                CRC-RS: {(config as any).crc_rs_proprietaria}
              </p>
            )}
            {(config as any)?.cidade_uf_proprietaria && (
              <p className="text-sm text-muted-foreground">
                {(config as any).cidade_uf_proprietaria}
              </p>
            )}
            {(config as any)?.telefone_proprietaria && (
              <p className="text-sm text-muted-foreground">
                Tel: {(config as any).telefone_proprietaria}
              </p>
            )}
            {(config as any)?.email_proprietaria && (
              <p className="text-sm text-muted-foreground">
                {(config as any).email_proprietaria}
              </p>
            )}
          </div>

          {/* Desenvolvedor */}
          <div className="pt-4 border-t">
            {(config as any)?.desenvolvedor_analista && (
              <p className="text-sm text-muted-foreground">
                Desenvolvedor/Analista: {(config as any).desenvolvedor_analista}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Data de criação: Janeiro 2025
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
