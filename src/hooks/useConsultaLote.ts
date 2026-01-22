import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { toast } from "sonner";
import { generatePixPayload, generateTxId, TipoFluxoTxId } from "@/lib/pix";
import type { ResumoFluxo, ResumoLote, TipoConta } from "@/types/conta-corrente.types";

// Fetch lotes for selection
export function useLotesConsulta() {
  return useQuery({
    queryKey: ["lotes-consulta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("id, quadra, numero_lote, status")
        .order("quadra")
        .order("numero_lote");
      if (error) throw error;
      return data;
    },
  });
}

// Fetch venda for selected lote
export function useVendaLote(loteId: string) {
  return useQuery({
    queryKey: ["venda-lote", loteId],
    queryFn: async () => {
      if (!loteId) return null;
      const { data, error } = await supabase
        .from("vendas")
        .select(`
          *,
          vendedor:pessoas!vendas_vendedor_pessoa_id_fkey(nome_razao),
          comprador:pessoas!vendas_comprador_pessoa_id_fkey(nome_razao, cpf_cnpj)
        `)
        .eq("lote_id", loteId)
        .order("data_venda", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loteId,
  });
}

// Fetch all movements for a specific flow type
export function useMovimentosFluxo(loteId: string, tipoFluxo: TipoConta) {
  return useQuery({
    queryKey: [`todos-movimentos-${tipoFluxo.toLowerCase()}-lote`, loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", loteId)
        .eq("tipo_fluxo", tipoFluxo)
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!loteId,
  });
}

// Hook to calculate accumulated balance for movements
export function useMovimentosComSaldo(movimentos: any[] | undefined) {
  return useMemo(() => {
    if (!movimentos) return [];
    let saldoAcumulado = 0;
    return movimentos.map((mov) => {
      saldoAcumulado += (mov.debito || 0) - (mov.credito || 0);
      return { ...mov, saldo_calculado: saldoAcumulado };
    });
  }, [movimentos]);
}

// Hook to filter/limit movements for display
export function useMovimentosFiltrados(
  movimentosComSaldo: any[],
  filtroAtivo: boolean,
  dataInicialISO: string | null,
  dataFinalISO: string | null
) {
  return useMemo(() => {
    if (!movimentosComSaldo.length) return [];
    
    let filtered = movimentosComSaldo;
    
    if (filtroAtivo) {
      if (dataInicialISO) {
        filtered = filtered.filter(m => m.data_mov >= dataInicialISO);
      }
      if (dataFinalISO) {
        filtered = filtered.filter(m => m.data_mov <= dataFinalISO);
      }
      return filtered;
    }
    
    return filtered.slice(-12);
  }, [movimentosComSaldo, filtroAtivo, dataInicialISO, dataFinalISO]);
}

// Fetch resumo for the selected lote
export function useResumoLoteConsulta(loteId: string, venda: any) {
  return useQuery({
    queryKey: ["resumo-lote-consulta", loteId, venda?.id],
    queryFn: async (): Promise<ResumoLote | null> => {
      if (!loteId) return null;
      
      const { data: allMovimentos, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", loteId)
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      
      const movParcelamento = allMovimentos.filter(m => m.tipo_fluxo === "PARCELAMENTO");
      const movReforco = allMovimentos.filter(m => m.tipo_fluxo === "REFORCO");

      const isArrasSinal = (referencia: string | null) => {
        if (!referencia) return false;
        const lower = referencia.toLowerCase();
        return lower.includes("arras") || lower.includes("sinal");
      };

      const calcularTotaisFluxo = (movimentos: typeof allMovimentos): ResumoFluxo => {
        const totalVenda = movimentos
          .filter(m => ["VENDA", "ENTRADA_PARCELA", "SINAL", "REFORCO", "PARCELA"].includes(m.tipo_mov))
          .reduce((acc, m) => acc + (m.debito || 0), 0);
        
        const totalAtualizacoes = movimentos
          .filter(m => m.tipo_mov === "ATUALIZACAO")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalJurosMora = movimentos
          .filter(m => m.tipo_mov === "JUROS_MORA")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalMultasMora = movimentos
          .filter(m => m.tipo_mov === "MULTA_MORA")
          .reduce((acc, m) => acc + (m.debito || 0), 0);

        const totalRecebido = movimentos.reduce((acc, m) => acc + (m.credito || 0), 0);

        const ultimoMovimento = movimentos.length > 0 ? movimentos[movimentos.length - 1] : null;
        const saldoReceber = ultimoMovimento?.saldo || 0;

        return {
          totalVenda,
          totalAtualizacoes,
          totalJurosMora,
          totalMultasMora,
          totalRecebido,
          saldoReceber
        };
      };

      const parcelamentoTotais = calcularTotaisFluxo(movParcelamento);
      const reforcoTotais = calcularTotaisFluxo(movReforco);

      const parcelasPagas = movParcelamento.filter(m => 
        m.tipo_mov === "PARCELA" && 
        (m.credito || 0) > 0 &&
        !isArrasSinal(m.referencia)
      );
      const qtdParcelasPagas = parcelasPagas.length;

      const reforcosPagos = movReforco.filter(m => 
        m.tipo_mov === "REFORCO" && 
        (m.credito || 0) > 0
      );
      const qtdReforcosPagos = reforcosPagos.length;

      const qtdParcelasContratadas = venda?.qtd_parcelas || 0;
      const qtdReforcosContratados = venda?.qtd_reforcos || 0;
      
      const qtdParcelasAPagar = Math.max(0, qtdParcelasContratadas - qtdParcelasPagas);
      const qtdReforcosAPagar = Math.max(0, qtdReforcosContratados - qtdReforcosPagos);

      const valorProximaParcela = qtdParcelasAPagar > 0 
        ? parcelamentoTotais.saldoReceber / qtdParcelasAPagar 
        : 0;
      
      const valorProximoReforco = qtdReforcosAPagar > 0 
        ? reforcoTotais.saldoReceber / qtdReforcosAPagar
        : 0;

      let primeiroVencimentoParcela: Date | null = null;
      let primeiroVencimentoReforco: Date | null = null;
      
      if ((venda as any)?.primeiro_vencimento_parcela) {
        primeiroVencimentoParcela = new Date((venda as any).primeiro_vencimento_parcela);
      } else {
        const primeiraParcelaVenc = movParcelamento.find(m => 
          m.tipo_mov === "PARCELA" && m.vencimento && !isArrasSinal(m.referencia)
        );
        primeiroVencimentoParcela = primeiraParcelaVenc?.vencimento 
          ? new Date(primeiraParcelaVenc.vencimento) 
          : null;
      }
      
      if ((venda as any)?.primeiro_vencimento_reforco) {
        primeiroVencimentoReforco = new Date((venda as any).primeiro_vencimento_reforco);
      } else {
        const primeiroReforcoVenc = movReforco.find(m => 
          m.tipo_mov === "REFORCO" && m.vencimento
        );
        primeiroVencimentoReforco = primeiroReforcoVenc?.vencimento 
          ? new Date(primeiroReforcoVenc.vencimento) 
          : null;
      }

      let vencimentoProximaParcela: Date | null = null;
      if (primeiroVencimentoParcela && qtdParcelasAPagar > 0) {
        const freqParcelas = venda?.frequencia_parcelas_meses || 1;
        vencimentoProximaParcela = addMonths(primeiroVencimentoParcela, qtdParcelasPagas * freqParcelas);
      }

      let vencimentoProximoReforco: Date | null = null;
      if (primeiroVencimentoReforco && qtdReforcosAPagar > 0) {
        const freqReforcos = venda?.frequencia_reforcos_meses || 12;
        vencimentoProximoReforco = addMonths(primeiroVencimentoReforco, qtdReforcosPagos * freqReforcos);
      }

      return { 
        parcelamento: parcelamentoTotais,
        reforco: reforcoTotais,
        qtdParcelasContratadas,
        qtdParcelasPagas,
        qtdParcelasAPagar,
        qtdReforcosContratados,
        qtdReforcosPagos,
        qtdReforcosAPagar,
        valorProximaParcela,
        vencimentoProximaParcela,
        valorProximoReforco,
        vencimentoProximoReforco,
        primeiroVencimentoParcela,
        primeiroVencimentoReforco
      };
    },
    enabled: !!loteId && venda !== undefined,
  });
}

// Fetch PIX configuration
export function usePixConfig() {
  return useQuery({
    queryKey: ["configuracoes-pix-vendedor"],
    queryFn: async () => {
      const { data: config, error: configError } = await supabase
        .from("configuracoes")
        .select("chave_pix, vendedor_pessoa_id")
        .limit(1)
        .maybeSingle();
      if (configError) throw configError;
      if (!config?.vendedor_pessoa_id) return { chave_pix: config?.chave_pix || null, nome_beneficiario: null, cidade_beneficiario: null };

      const { data: vendedor, error: vendedorError } = await supabase
        .from("pessoas")
        .select("nome_razao")
        .eq("id", config.vendedor_pessoa_id)
        .single();
      if (vendedorError) throw vendedorError;

      const { data: endereco, error: enderecoError } = await supabase
        .from("enderecos")
        .select("cidade")
        .eq("pessoa_id", config.vendedor_pessoa_id)
        .eq("principal", true)
        .maybeSingle();
      
      let cidade = endereco?.cidade || null;
      if (!cidade && !enderecoError) {
        const { data: qualquerEndereco } = await supabase
          .from("enderecos")
          .select("cidade")
          .eq("pessoa_id", config.vendedor_pessoa_id)
          .limit(1)
          .maybeSingle();
        cidade = qualquerEndereco?.cidade || null;
      }

      return {
        chave_pix: config.chave_pix,
        nome_beneficiario: vendedor?.nome_razao || null,
        cidade_beneficiario: cidade,
      };
    },
  });
}

// Mutation for reorganizing lot balances
export function useReorganizarLote(loteId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (loteIdParam: string) => {
      const { data, error } = await supabase.rpc("reorganizar_lote_completo", {
        p_lote_id: loteIdParam,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["todos-movimentos-parcelamento-lote", loteId] });
      queryClient.invalidateQueries({ queryKey: ["todos-movimentos-reforco-lote", loteId] });
      queryClient.invalidateQueries({ queryKey: ["resumo-lote-consulta", loteId] });
      
      const totalProcessados = data?.reduce((acc: number, item: any) => acc + (item.registros_processados || 0), 0) || 0;
      toast.success(`Saldos reorganizados com sucesso! ${totalProcessados} registro(s) processado(s).`);
    },
    onError: (error: any) => {
      console.error("Erro ao reorganizar saldos:", error);
      toast.error("Erro ao reorganizar saldos: " + error.message);
    },
  });
}

// PIX payload builder
interface PixConfigData {
  chave_pix: string | null;
  nome_beneficiario: string | null;
  cidade_beneficiario: string | null;
}

interface LoteData {
  quadra: string;
  numero_lote: string;
}

export function buildPixPayload(
  tipo: TipoConta,
  pixConfig: PixConfigData | null | undefined,
  resumo: ResumoLote | null | undefined,
  lote: LoteData | null | undefined
): string | null {
  if (!pixConfig?.chave_pix || !pixConfig?.nome_beneficiario || !pixConfig?.cidade_beneficiario) {
    return null;
  }
  if (!resumo || !lote) {
    return null;
  }

  const isParcelamento = tipo === "PARCELAMENTO";
  const qtdAPagar = isParcelamento ? resumo.qtdParcelasAPagar : resumo.qtdReforcosAPagar;
  const valor = isParcelamento ? resumo.valorProximaParcela : resumo.valorProximoReforco;
  const vencimento = isParcelamento ? resumo.vencimentoProximaParcela : resumo.vencimentoProximoReforco;
  const qtdPagas = isParcelamento ? resumo.qtdParcelasPagas : resumo.qtdReforcosPagos;

  if (qtdAPagar <= 0 || valor <= 0) {
    return null;
  }

  try {
    const anoCompetencia = vencimento ? new Date(vencimento).getFullYear() : new Date().getFullYear();
    const tipoFluxo: TipoFluxoTxId = isParcelamento ? "PARCELAMENTO" : "REFORCO";
    
    const txid = generateTxId(
      lote.quadra,
      lote.numero_lote,
      qtdPagas + 1,
      tipoFluxo,
      anoCompetencia
    );

    return generatePixPayload({
      chavePix: pixConfig.chave_pix,
      nomeBeneficiario: pixConfig.nome_beneficiario,
      cidadeBeneficiario: pixConfig.cidade_beneficiario,
      valor,
      txid,
      descricao: `Q${lote.quadra}L${lote.numero_lote}`,
    });
  } catch (error) {
    console.error("Erro ao gerar payload PIX:", error);
    return null;
  }
}

// PIX display data helper
export function getPixDisplayData(resumo: ResumoLote | null, tipo: TipoConta) {
  if (!resumo) return null;
  
  if (tipo === "PARCELAMENTO") {
    return {
      titulo: "Próxima Parcela",
      valor: resumo.valorProximaParcela,
      vencimento: resumo.vencimentoProximaParcela,
      qtdAPagar: resumo.qtdParcelasAPagar,
    };
  }
  
  return {
    titulo: "Próximo Reforço",
    valor: resumo.valorProximoReforco,
    vencimento: resumo.vencimentoProximoReforco,
    qtdAPagar: resumo.qtdReforcosAPagar,
  };
}
