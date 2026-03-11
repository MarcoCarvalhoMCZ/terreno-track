import { useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, parseISO } from "date-fns";
import { toast } from "sonner";
import { generatePixPayload, generateTxId, TipoFluxoTxId } from "@/lib/pix";
import { calcularResumoLote } from "@/lib/calculo-financeiro";
import { regenerarParcelasAbertas } from "@/lib/parcelas-abertas";
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

// Fetch resumo for the selected lote (delegates to central financial engine)
export function useResumoLoteConsulta(loteId: string, venda: any) {
  return useQuery({
    queryKey: ["resumo-lote-consulta", loteId, venda?.id],
    queryFn: async (): Promise<ResumoLote | null> => {
      if (!loteId) return null;
      
      const [movResult, controleResult] = await Promise.all([
        supabase
          .from("conta_corrente_lote")
          .select("tipo_mov, tipo_fluxo, debito, credito, data_mov, vencimento, referencia, numero_parcela, sequencia_parcela")
          .eq("lote_id", loteId)
          .order("data_mov", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("parcelas_controle")
          .select("tipo_fluxo, data_base, qtd_pagas_base")
          .eq("lote_id", loteId),
      ]);
      if (movResult.error) throw movResult.error;

      return calcularResumoLote(
        movResult.data || [],
        controleResult.data || [],
        {
          qtd_parcelas: venda?.qtd_parcelas ?? null,
          qtd_reforcos: venda?.qtd_reforcos ?? null,
          frequencia_parcelas_meses: venda?.frequencia_parcelas_meses ?? null,
          frequencia_reforcos_meses: venda?.frequencia_reforcos_meses ?? null,
          primeiro_vencimento_parcela: venda?.primeiro_vencimento_parcela ?? null,
          primeiro_vencimento_reforco: venda?.primeiro_vencimento_reforco ?? null,
          valor_parcelamento: venda?.valor_parcelamento ?? null,
          valor_reforco: venda?.valor_reforco ?? null,
        },
      );
    },
    enabled: !!loteId && venda !== undefined,
  });
}

// Fetch vendedor from configuracoes (for header display)
export function useVendedorConfig() {
  return useQuery({
    queryKey: ["configuracoes-vendedor"],
    queryFn: async () => {
      const { data: config, error: configError } = await supabase
        .from("configuracoes")
        .select("vendedor_pessoa_id")
        .limit(1)
        .maybeSingle();
      if (configError) throw configError;
      if (!config?.vendedor_pessoa_id) return null;

      const { data: vendedor, error: vendedorError } = await supabase
        .from("pessoas")
        .select("nome_razao, cpf_cnpj")
        .eq("id", config.vendedor_pessoa_id)
        .single();
      if (vendedorError) throw vendedorError;

      return vendedor;
    },
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
      tipoFluxo
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

// ============================
// Hook para atualização monetária automática
// ============================

interface AtualizacaoAutomaticaResult {
  isChecking: boolean;
  isUpdating: boolean;
  jaAtualizado: boolean;
  mesReferencia: string;
}

/**
 * Hook para verificar e executar atualização monetária automaticamente
 * quando o usuário acessa a Consulta de Lote e ela ainda não foi feita no mês.
 */
export function useAtualizacaoMonetariaAutomatica(
  loteId: string | null,
  vendaData: any | null | undefined
): AtualizacaoAutomaticaResult {
  const queryClient = useQueryClient();
  const executadoRef = useRef<Set<string>>(new Set());
  
  // Data de movimento padrão: primeiro dia do mês atual
  const dataMovimento = useMemo(() => {
    const now = new Date();
    return format(startOfMonth(now), "yyyy-MM-dd");
  }, []);
  
  const referenciaMes = dataMovimento.substring(0, 7);

  // Verificar se já existe atualização no mês
  const { data: jaAtualizado, isLoading: isChecking } = useQuery({
    queryKey: ["verificar-atualizacao-mes", loteId, referenciaMes],
    queryFn: async (): Promise<boolean> => {
      if (!loteId) return false;
      
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("id")
        .eq("lote_id", loteId)
        .eq("tipo_mov", "ATUALIZACAO")
        .eq("referencia", referenciaMes)
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!loteId,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Buscar indicadores e seus valores
  const { data: indicadores } = useQuery({
    queryKey: ["indicadores-atualizacao-auto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_atualizacao")
        .select(`
          *,
          valores:indicadores_atualizacao_valores(*)
        `)
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
    enabled: !!loteId && !jaAtualizado && jaAtualizado !== undefined,
  });

  // Buscar movimentações para calcular saldo
  const { data: movimentacoes } = useQuery({
    queryKey: ["movimentacoes-atualizacao-auto", loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("conta_corrente_lote")
        .select("*")
        .eq("lote_id", loteId)
        .order("data_mov", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!loteId && !jaAtualizado && jaAtualizado !== undefined,
  });

  // Mutation para executar a atualização
  const executarMutation = useMutation({
    mutationFn: async () => {
      if (!loteId || !vendaData || !indicadores || !movimentacoes) {
        throw new Error("Dados insuficientes para atualização");
      }

      const dataMov = parseISO(dataMovimento);
      const tiposFluxo: ("PARCELAMENTO" | "REFORCO")[] = ["PARCELAMENTO", "REFORCO"];
      const lancamentos: any[] = [];

      // Buscar índice para um indicador e competência
      const buscarIndice = (tipoAtualizacao: string, competenciaIndice: string): number | null => {
        const indicador = indicadores.find(
          (ind: any) => ind.nome.toUpperCase() === tipoAtualizacao.toUpperCase()
        );
        
        if (!indicador || !indicador.valores) return null;
        
        const valor = indicador.valores.find(
          (v: any) => v.competencia.substring(0, 7) === competenciaIndice
        );
        
        return valor ? Number(valor.fator) : null;
      };

      // Calcular saldo anterior por tipo_fluxo
      const calcularSaldoAnterior = (tipoFluxo: string): number => {
        const movsFluxo = movimentacoes.filter(
          (m: any) => m.tipo_fluxo === tipoFluxo && m.data_mov < dataMovimento
        );
        
        return movsFluxo.reduce((acc: number, mov: any) => {
          return acc + (mov.debito || 0) - (mov.credito || 0);
        }, 0);
      };

      for (const tipoFluxo of tiposFluxo) {
        // Verificar se tem saldo no fluxo
        const saldoAnterior = calcularSaldoAnterior(tipoFluxo);
        if (saldoAnterior <= 0) continue;

        // Verificar se já existe atualização para este fluxo
        const jaExiste = movimentacoes.some(
          (m: any) => 
            m.tipo_fluxo === tipoFluxo && 
            m.tipo_mov === "ATUALIZACAO" &&
            m.referencia === referenciaMes
        );
        if (jaExiste) continue;

        // Calcular competência do índice (data_mov - defasagem meses)
        const defasagem = vendaData.defasagem_indice || 1;
        const competenciaDate = subMonths(dataMov, defasagem);
        const competenciaIndice = format(competenciaDate, "yyyy-MM");
        
        // Buscar índice
        const tipoAtualizacao = vendaData.tipo_atualizacao || "IGPM";
        const indice = buscarIndice(tipoAtualizacao, competenciaIndice);
        
        if (indice === null) continue;

        // Calcular valor da atualização
        const valorCalculado = Math.round(saldoAnterior * (indice / 100) * 100) / 100;
        if (valorCalculado === 0) continue;

        // Determinar natureza (débito ou crédito)
        const isNegativo = indice < 0;
        const valorAbs = Math.abs(valorCalculado);
        const novoSaldo = saldoAnterior + valorCalculado;

        // Buscar dados do lote
        const { data: loteData } = await supabase
          .from("lotes")
          .select("quadra, numero_lote")
          .eq("id", loteId)
          .single();

        lancamentos.push({
          lote_id: loteId,
          venda_id: vendaData.id,
          tipo_fluxo: tipoFluxo,
          tipo_mov: "ATUALIZACAO",
          data_mov: dataMovimento,
          descricao: `Atualização Monetária Q${loteData?.quadra}Lt${loteData?.numero_lote}`,
          percentual_calculo: indice,
          debito: isNegativo ? 0 : valorAbs,
          credito: isNegativo ? valorAbs : 0,
          saldo: novoSaldo,
          referencia: referenciaMes,
        });
      }

      if (lancamentos.length === 0) {
        return 0;
      }

      const { error } = await supabase.from("conta_corrente_lote").insert(lancamentos);
      if (error) throw error;

      return lancamentos.length;
    },
    onSuccess: async (count) => {
      if (count > 0) {
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ["verificar-atualizacao-mes", loteId] });
        queryClient.invalidateQueries({ queryKey: ["todos-movimentos-parcelamento-lote", loteId] });
        queryClient.invalidateQueries({ queryKey: ["todos-movimentos-reforco-lote", loteId] });
        queryClient.invalidateQueries({ queryKey: ["resumo-lote-consulta", loteId] });
        queryClient.invalidateQueries({ queryKey: ["ultima-atualizacao-lote", loteId] });
        queryClient.invalidateQueries({ queryKey: ["movimentacoes-atualizacao-auto", loteId] });
        
        // Regenerar parcelas_abertas para este lote
        if (loteId) {
          try { await regenerarParcelasAbertas(loteId); } catch (e) { console.error("Erro ao regenerar parcelas_abertas:", e); }
          queryClient.invalidateQueries({ queryKey: ["parcelas-abertas"] });
        }
        
        toast.success(`Atualização monetária automática aplicada! (${count} lançamento(s))`);
      }
    },
    onError: (error: any) => {
      console.error("Erro na atualização monetária automática:", error);
      // Não exibe toast de erro para não incomodar o usuário
    },
  });

  // Executar automaticamente quando os dados estiverem disponíveis
  useEffect(() => {
    const chaveExecucao = `${loteId}-${referenciaMes}`;
    
    if (
      loteId &&
      vendaData &&
      jaAtualizado === false &&
      indicadores &&
      movimentacoes &&
      !executarMutation.isPending &&
      !executadoRef.current.has(chaveExecucao)
    ) {
      executadoRef.current.add(chaveExecucao);
      executarMutation.mutate();
    }
  }, [loteId, vendaData, jaAtualizado, indicadores, movimentacoes, executarMutation.isPending, referenciaMes]);

  return {
    isChecking,
    isUpdating: executarMutation.isPending,
    jaAtualizado: jaAtualizado || false,
    mesReferencia: referenciaMes,
  };
}
