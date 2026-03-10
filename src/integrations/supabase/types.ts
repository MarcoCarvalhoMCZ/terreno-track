export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      configuracoes: {
        Row: {
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          cidade_beneficiario: string | null
          cidade_uf_proprietaria: string | null
          cnpj_proprietaria: string | null
          conta_corrente: string | null
          crc_rs_proprietaria: string | null
          created_at: string | null
          created_by: string | null
          criterio_juros_mora: string | null
          data_criacao_app: string | null
          desenvolvedor_analista: string | null
          email_proprietaria: string | null
          id: string
          juros_mora_percentual: number | null
          logotipo_url: string | null
          multa_mora_percentual: number | null
          nome_beneficiario: string | null
          observacoes: string | null
          padrao_corretor_pessoa_id: string | null
          padrao_percentual_corretagem: number | null
          razao_social_proprietaria: string | null
          representante_legal_2_pessoa_id: string | null
          representante_legal_pessoa_id: string | null
          telefone_proprietaria: string | null
          tolerancia_dias_juros: number | null
          updated_at: string | null
          updated_by: string | null
          vendedor_pessoa_id: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cidade_beneficiario?: string | null
          cidade_uf_proprietaria?: string | null
          cnpj_proprietaria?: string | null
          conta_corrente?: string | null
          crc_rs_proprietaria?: string | null
          created_at?: string | null
          created_by?: string | null
          criterio_juros_mora?: string | null
          data_criacao_app?: string | null
          desenvolvedor_analista?: string | null
          email_proprietaria?: string | null
          id?: string
          juros_mora_percentual?: number | null
          logotipo_url?: string | null
          multa_mora_percentual?: number | null
          nome_beneficiario?: string | null
          observacoes?: string | null
          padrao_corretor_pessoa_id?: string | null
          padrao_percentual_corretagem?: number | null
          razao_social_proprietaria?: string | null
          representante_legal_2_pessoa_id?: string | null
          representante_legal_pessoa_id?: string | null
          telefone_proprietaria?: string | null
          tolerancia_dias_juros?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendedor_pessoa_id?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cidade_beneficiario?: string | null
          cidade_uf_proprietaria?: string | null
          cnpj_proprietaria?: string | null
          conta_corrente?: string | null
          crc_rs_proprietaria?: string | null
          created_at?: string | null
          created_by?: string | null
          criterio_juros_mora?: string | null
          data_criacao_app?: string | null
          desenvolvedor_analista?: string | null
          email_proprietaria?: string | null
          id?: string
          juros_mora_percentual?: number | null
          logotipo_url?: string | null
          multa_mora_percentual?: number | null
          nome_beneficiario?: string | null
          observacoes?: string | null
          padrao_corretor_pessoa_id?: string | null
          padrao_percentual_corretagem?: number | null
          razao_social_proprietaria?: string | null
          representante_legal_2_pessoa_id?: string | null
          representante_legal_pessoa_id?: string | null
          telefone_proprietaria?: string | null
          tolerancia_dias_juros?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vendedor_pessoa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_padrao_corretor_pessoa_id_fkey"
            columns: ["padrao_corretor_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_representante_legal_2_pessoa_id_fkey"
            columns: ["representante_legal_2_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_representante_legal_pessoa_id_fkey"
            columns: ["representante_legal_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_vendedor_pessoa_id_fkey"
            columns: ["vendedor_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidacao_contabil: {
        Row: {
          ano: number
          conta_contabil_id: string
          created_at: string | null
          created_by: string | null
          id: string
          mes: number
          updated_at: string | null
          updated_by: string | null
          valor_credito: number | null
          valor_debito: number | null
        }
        Insert: {
          ano: number
          conta_contabil_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes: number
          updated_at?: string | null
          updated_by?: string | null
          valor_credito?: number | null
          valor_debito?: number | null
        }
        Update: {
          ano?: number
          conta_contabil_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes?: number
          updated_at?: string | null
          updated_by?: string | null
          valor_credito?: number | null
          valor_debito?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consolidacao_contabil_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_corrente_lote: {
        Row: {
          banco_origem: string | null
          cpf_cnpj_pagador: string | null
          created_at: string | null
          created_by: string | null
          credito: number | null
          data_mov: string
          debito: number | null
          descricao: string | null
          id: string
          lote_id: string
          modo_pagamento: string | null
          percentual_calculo: number | null
          referencia: string | null
          saldo: number | null
          tipo_fluxo: string | null
          tipo_mov: string
          updated_at: string | null
          updated_by: string | null
          vencimento: string | null
          venda_id: string | null
        }
        Insert: {
          banco_origem?: string | null
          cpf_cnpj_pagador?: string | null
          created_at?: string | null
          created_by?: string | null
          credito?: number | null
          data_mov: string
          debito?: number | null
          descricao?: string | null
          id?: string
          lote_id: string
          modo_pagamento?: string | null
          percentual_calculo?: number | null
          referencia?: string | null
          saldo?: number | null
          tipo_fluxo?: string | null
          tipo_mov: string
          updated_at?: string | null
          updated_by?: string | null
          vencimento?: string | null
          venda_id?: string | null
        }
        Update: {
          banco_origem?: string | null
          cpf_cnpj_pagador?: string | null
          created_at?: string | null
          created_by?: string | null
          credito?: number | null
          data_mov?: string
          debito?: number | null
          descricao?: string | null
          id?: string
          lote_id?: string
          modo_pagamento?: string | null
          percentual_calculo?: number | null
          referencia?: string | null
          saldo?: number | null
          tipo_fluxo?: string | null
          tipo_mov?: string
          updated_at?: string | null
          updated_by?: string | null
          vencimento?: string | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conta_corrente_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_corrente_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_operacoes_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "conta_corrente_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_totalizacao_mensal_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "conta_corrente_lote_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_contabeis: {
        Row: {
          ativo: boolean | null
          codigo: string
          codigo_estruturado: string | null
          created_at: string | null
          created_by: string | null
          descricao: string
          id: string
          natureza_saldo: string | null
          tipo_conta: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          codigo_estruturado?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao: string
          id?: string
          natureza_saldo?: string | null
          tipo_conta?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          codigo_estruturado?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          id?: string
          natureza_saldo?: string | null
          tipo_conta?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      contas_recebimento_vendedor: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string
          detalhes: string | null
          id: string
          modo_pagamento_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao: string
          detalhes?: string | null
          id?: string
          modo_pagamento_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          detalhes?: string | null
          id?: string
          modo_pagamento_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_recebimento_vendedor_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modos_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      enderecos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string | null
          created_by: string | null
          id: string
          logradouro: string | null
          numero: string | null
          pessoa_id: string | null
          principal: boolean | null
          tipo: string | null
          uf: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          pessoa_id?: string | null
          principal?: boolean | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          pessoa_id?: string | null
          principal?: boolean | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_contabeis: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          created_by: string | null
          descricao: string
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          descricao: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      eventos_contabeis_itens: {
        Row: {
          conta_contabil_id: string | null
          created_at: string | null
          created_by: string | null
          dc: string
          evento_id: string | null
          historico_padrao: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          conta_contabil_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dc: string
          evento_id?: string | null
          historico_padrao?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          conta_contabil_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dc?: string
          evento_id?: string | null
          historico_padrao?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_contabeis_itens_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_contabeis_itens_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_atualizacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          periodicidade: string | null
          regra: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          periodicidade?: string | null
          regra?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          periodicidade?: string | null
          regra?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      indicadores_atualizacao_valores: {
        Row: {
          competencia: string
          created_at: string | null
          created_by: string | null
          fator: number
          id: string
          indicador_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          competencia: string
          created_at?: string | null
          created_by?: string | null
          fator: number
          id?: string
          indicador_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          competencia?: string
          created_at?: string | null
          created_by?: string | null
          fator?: number
          id?: string
          indicador_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_atualizacao_valores_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_atualizacao"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          area_m2: number | null
          created_at: string | null
          created_by: string | null
          custo_contabil: number | null
          etiqueta_patrimonial: string | null
          id: string
          matricula_ri: string | null
          numero_lote: string
          observacoes: string | null
          quadra: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          area_m2?: number | null
          created_at?: string | null
          created_by?: string | null
          custo_contabil?: number | null
          etiqueta_patrimonial?: string | null
          id?: string
          matricula_ri?: string | null
          numero_lote: string
          observacoes?: string | null
          quadra: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          area_m2?: number | null
          created_at?: string | null
          created_by?: string | null
          custo_contabil?: number | null
          etiqueta_patrimonial?: string | null
          id?: string
          matricula_ri?: string | null
          numero_lote?: string
          observacoes?: string | null
          quadra?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      mapa_movimento_conta: {
        Row: {
          conta_contabil_id: string
          created_at: string | null
          created_by: string | null
          id: string
          natureza_lancamento: string
          tipo_movimento: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          conta_contabil_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          natureza_lancamento: string
          tipo_movimento: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          conta_contabil_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          natureza_lancamento?: string
          tipo_movimento?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapa_movimento_conta_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "contas_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      modos_pagamento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_pagamento: string | null
          id: string
          numero: number
          plano_id: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          valor_atualizado: number | null
          valor_pago: number | null
          valor_principal: number
          vencimento: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          numero: number
          plano_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_atualizado?: number | null
          valor_pago?: number | null
          valor_principal: number
          vencimento: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          numero?: number
          plano_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_atualizado?: number | null
          valor_pago?: number | null
          valor_principal?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_controle: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_base: string
          id: string
          lote_id: string
          observacoes: string | null
          qtd_pagas_base: number
          tipo_fluxo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_base: string
          id?: string
          lote_id: string
          observacoes?: string | null
          qtd_pagas_base?: number
          tipo_fluxo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_base?: string
          id?: string
          lote_id?: string
          observacoes?: string | null
          qtd_pagas_base?: number
          tipo_fluxo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_controle_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_controle_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_operacoes_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "parcelas_controle_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_totalizacao_mensal_por_lote"
            referencedColumns: ["lote_id"]
          },
        ]
      }
      pessoas: {
        Row: {
          cpf_cnpj: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          nome_razao: string
          observacoes: string | null
          rg_ie: string | null
          telefone: string | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome_razao: string
          observacoes?: string | null
          rg_ie?: string | null
          telefone?: string | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          nome_razao?: string
          observacoes?: string | null
          rg_ie?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      planos_pagamento: {
        Row: {
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
          venda_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          venda_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_pagamento_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          nome: string
          pergunta_seguranca: string | null
          resposta_seguranca: string | null
          updated_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id: string
          is_active?: boolean | null
          is_approved?: boolean | null
          nome: string
          pergunta_seguranca?: string | null
          resposta_seguranca?: string | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          nome?: string
          pergunta_seguranca?: string | null
          resposta_seguranca?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_menu_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          menu_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          menu_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          menu_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_documentos: {
        Row: {
          arquivo_path: string
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          nome: string
          updated_at: string | null
          updated_by: string | null
          venda_id: string
        }
        Insert: {
          arquivo_path: string
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string | null
          updated_by?: string | null
          venda_id: string
        }
        Update: {
          arquivo_path?: string
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
          updated_by?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_documentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          comprador_cpf_1: string | null
          comprador_cpf_2: string | null
          comprador_nome_1: string | null
          comprador_nome_2: string | null
          comprador_pessoa_id: string
          conta_recebimento_vendedor_id: string | null
          corretor_pessoa_id: string | null
          created_at: string | null
          created_by: string | null
          data_venda: string
          defasagem_indice: number | null
          frequencia_parcelas_meses: number | null
          frequencia_reforcos_meses: number | null
          id: string
          indicador_atualizacao_id: string | null
          lote_id: string
          observacoes: string | null
          percentual_corretagem: number | null
          primeiro_vencimento_parcela: string | null
          primeiro_vencimento_reforco: string | null
          qtd_parcelas: number | null
          qtd_reforcos: number | null
          status: string | null
          tipo_atualizacao:
            | Database["public"]["Enums"]["tipo_atualizacao_monetaria"]
            | null
          updated_at: string | null
          updated_by: string | null
          valor_arras: number | null
          valor_parcelamento: number | null
          valor_reforco: number | null
          valor_venda: number
          vendedor_pessoa_id: string | null
        }
        Insert: {
          comprador_cpf_1?: string | null
          comprador_cpf_2?: string | null
          comprador_nome_1?: string | null
          comprador_nome_2?: string | null
          comprador_pessoa_id: string
          conta_recebimento_vendedor_id?: string | null
          corretor_pessoa_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_venda: string
          defasagem_indice?: number | null
          frequencia_parcelas_meses?: number | null
          frequencia_reforcos_meses?: number | null
          id?: string
          indicador_atualizacao_id?: string | null
          lote_id: string
          observacoes?: string | null
          percentual_corretagem?: number | null
          primeiro_vencimento_parcela?: string | null
          primeiro_vencimento_reforco?: string | null
          qtd_parcelas?: number | null
          qtd_reforcos?: number | null
          status?: string | null
          tipo_atualizacao?:
            | Database["public"]["Enums"]["tipo_atualizacao_monetaria"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          valor_arras?: number | null
          valor_parcelamento?: number | null
          valor_reforco?: number | null
          valor_venda: number
          vendedor_pessoa_id?: string | null
        }
        Update: {
          comprador_cpf_1?: string | null
          comprador_cpf_2?: string | null
          comprador_nome_1?: string | null
          comprador_nome_2?: string | null
          comprador_pessoa_id?: string
          conta_recebimento_vendedor_id?: string | null
          corretor_pessoa_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_venda?: string
          defasagem_indice?: number | null
          frequencia_parcelas_meses?: number | null
          frequencia_reforcos_meses?: number | null
          id?: string
          indicador_atualizacao_id?: string | null
          lote_id?: string
          observacoes?: string | null
          percentual_corretagem?: number | null
          primeiro_vencimento_parcela?: string | null
          primeiro_vencimento_reforco?: string | null
          qtd_parcelas?: number | null
          qtd_reforcos?: number | null
          status?: string | null
          tipo_atualizacao?:
            | Database["public"]["Enums"]["tipo_atualizacao_monetaria"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          valor_arras?: number | null
          valor_parcelamento?: number | null
          valor_reforco?: number | null
          valor_venda?: number
          vendedor_pessoa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_comprador_pessoa_id_fkey"
            columns: ["comprador_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_conta_recebimento_vendedor_id_fkey"
            columns: ["conta_recebimento_vendedor_id"]
            isOneToOne: false
            referencedRelation: "contas_recebimento_vendedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_corretor_pessoa_id_fkey"
            columns: ["corretor_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_indicador_atualizacao_id_fkey"
            columns: ["indicador_atualizacao_id"]
            isOneToOne: false
            referencedRelation: "indicadores_atualizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_operacoes_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vendas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vw_totalizacao_mensal_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vendas_vendedor_pessoa_id_fkey"
            columns: ["vendedor_pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_resumo_fluxo_lote: {
        Row: {
          lote_id: string | null
          numero_lote: string | null
          qtd_restante: number | null
          quadra: string | null
          saldo_atualizado: number | null
          tipo_fluxo: string | null
          valor_proximo_titulo: number | null
        }
        Relationships: []
      }
      vw_resumo_operacoes_lote: {
        Row: {
          competencia: string | null
          lote_id: string | null
          numero_lote: string | null
          quadra: string | null
          saldo_periodo: number | null
          total_creditos: number | null
          total_debitos: number | null
        }
        Relationships: []
      }
      vw_totalizacao_mensal_consolidada: {
        Row: {
          competencia: string | null
          saldo_final: number | null
          total_creditos: number | null
          total_debitos: number | null
        }
        Relationships: []
      }
      vw_totalizacao_mensal_por_lote: {
        Row: {
          competencia: string | null
          lote_id: string | null
          numero_lote: string | null
          quadra: string | null
          saldo_final: number | null
          total_creditos: number | null
          total_debitos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      aplicar_atualizacao_fluxo: {
        Args: {
          p_competencia: string
          p_descricao?: string
          p_fator: number
          p_lote_id: string
          p_tipo_fluxo: string
        }
        Returns: string
      }
      calcular_atualizacao_monetaria_lote: {
        Args: { p_competencia: string; p_lote_id?: string }
        Returns: {
          lote_id: string
          novo_saldo: number
          percentual_aplicado: number
          saldo_anterior: number
          valor_atualizacao: number
          venda_id: string
        }[]
      }
      calcular_proximo_titulo_fluxo: {
        Args: { p_lote_id: string; p_tipo_fluxo: string }
        Returns: number
      }
      executar_atualizacao_monetaria: {
        Args: { p_competencia: string; p_lote_id?: string }
        Returns: number
      }
      gerar_proximo_titulo_fluxo: {
        Args: { p_lote_id: string; p_tipo_fluxo: string; p_vencimento?: string }
        Returns: string
      }
      get_qtd_restante_fluxo: {
        Args: { p_lote_id: string; p_tipo_fluxo: string }
        Returns: number
      }
      get_saldo_atualizado_fluxo: {
        Args: { p_lote_id: string; p_tipo_fluxo: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalcular_saldo_lote: { Args: { p_lote_id: string }; Returns: number }
      reorganizar_conta_corrente_fluxo: {
        Args: { p_lote_id: string; p_tipo_fluxo: string }
        Returns: number
      }
      reorganizar_lote_completo: {
        Args: { p_lote_id: string }
        Returns: {
          registros_processados: number
          tipo_fluxo: string
        }[]
      }
      reorganizar_todos_lotes: {
        Args: never
        Returns: {
          lote_id: string
          registros_processados: number
          tipo_fluxo: string
        }[]
      }
    }
    Enums: {
      app_role: "ADMIN" | "OPERADOR" | "CONSULTA"
      tipo_atualizacao_monetaria: "IGPM" | "MEDIA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "OPERADOR", "CONSULTA"],
      tipo_atualizacao_monetaria: ["IGPM", "MEDIA"],
    },
  },
} as const
