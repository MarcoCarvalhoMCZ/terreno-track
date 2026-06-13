-- Gerado por scripts/generate-sqlserver-schema.mjs
-- Revise funcoes/triggers/views apos executar este DDL; elas precisam ser convertidas de PL/pgSQL para T-SQL.
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dbo') EXEC('CREATE SCHEMA [dbo]');
GO

IF OBJECT_ID(N'[dbo].[auditoria_mora_override]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[auditoria_mora_override] (
    [campo] nvarchar(max) NOT NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [motivo] nvarchar(max) NULL,
    [movimento_id] uniqueidentifier NOT NULL,
    [user_id] uniqueidentifier NULL,
    [valor_novo] decimal(18, 4) NULL,
    [valor_original] decimal(18, 4) NULL,
    CONSTRAINT [PK_auditoria_mora_override] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[configuracoes]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[configuracoes] (
    [agencia] nvarchar(max) NULL,
    [banco] nvarchar(max) NULL,
    [chave_pix] nvarchar(max) NULL,
    [cidade_beneficiario] nvarchar(max) NULL,
    [cidade_uf_proprietaria] nvarchar(max) NULL,
    [cnpj_proprietaria] nvarchar(max) NULL,
    [conta_corrente] nvarchar(max) NULL,
    [crc_rs_proprietaria] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [criterio_juros_mora] nvarchar(max) NULL,
    [data_criacao_app] nvarchar(max) NULL,
    [desenvolvedor_analista] nvarchar(max) NULL,
    [email_assunto_padrao] nvarchar(max) NULL,
    [email_proprietaria] nvarchar(max) NULL,
    [email_remetente_nome] nvarchar(max) NULL,
    [email_reply_to] nvarchar(max) NULL,
    [email_rodape] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [juros_mora_percentual] decimal(18, 4) NULL,
    [logotipo_url] nvarchar(max) NULL,
    [mensagem_extrato] nvarchar(max) NULL,
    [multa_mora_percentual] decimal(18, 4) NULL,
    [nome_beneficiario] nvarchar(max) NULL,
    [observacoes] nvarchar(max) NULL,
    [padrao_corretor_pessoa_id] uniqueidentifier NULL,
    [padrao_percentual_corretagem] decimal(18, 4) NULL,
    [razao_social_proprietaria] nvarchar(max) NULL,
    [representante_legal_2_pessoa_id] uniqueidentifier NULL,
    [representante_legal_pessoa_id] uniqueidentifier NULL,
    [telefone_proprietaria] nvarchar(max) NULL,
    [tolerancia_dias_juros] int NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [vendedor_pessoa_id] uniqueidentifier NULL,
    CONSTRAINT [PK_configuracoes] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[consolidacao_contabil]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[consolidacao_contabil] (
    [ano] int NOT NULL,
    [conta_contabil_id] uniqueidentifier NOT NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [mes] int NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [valor_credito] decimal(18, 4) NULL,
    [valor_debito] decimal(18, 4) NULL,
    CONSTRAINT [PK_consolidacao_contabil] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[conta_corrente_lote]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[conta_corrente_lote] (
    [banco_origem] nvarchar(max) NULL,
    [cpf_cnpj_pagador] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [credito] decimal(18, 4) NULL,
    [data_mov] nvarchar(max) NOT NULL,
    [debito] decimal(18, 4) NULL,
    [descricao] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [lote_id] uniqueidentifier NOT NULL,
    [modo_pagamento] nvarchar(max) NULL,
    [numero_parcela] int NULL,
    [parcela_origem_id] uniqueidentifier NULL,
    [percentual_calculo] decimal(18, 4) NULL,
    [referencia] nvarchar(max) NULL,
    [saldo] decimal(18, 4) NULL,
    [sequencia_parcela] int NULL,
    [tipo_fluxo] nvarchar(max) NULL,
    [tipo_mov] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [vencimento] date NULL,
    [venda_id] uniqueidentifier NULL,
    CONSTRAINT [PK_conta_corrente_lote] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[contas_contabeis]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contas_contabeis] (
    [ativo] bit NULL,
    [codigo] nvarchar(max) NOT NULL,
    [codigo_estruturado] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NOT NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [natureza_saldo] nvarchar(max) NULL,
    [tipo_conta] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_contas_contabeis] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[contas_recebimento_vendedor]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contas_recebimento_vendedor] (
    [ativo] bit NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NOT NULL,
    [detalhes] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [modo_pagamento_id] uniqueidentifier NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_contas_recebimento_vendedor] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[enderecos]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[enderecos] (
    [bairro] nvarchar(max) NULL,
    [cep] nvarchar(max) NULL,
    [cidade] nvarchar(max) NULL,
    [complemento] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [logradouro] nvarchar(max) NULL,
    [numero] nvarchar(max) NULL,
    [pessoa_id] uniqueidentifier NULL,
    [principal] bit NULL,
    [tipo] nvarchar(max) NULL,
    [uf] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_enderecos] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[eventos_contabeis]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[eventos_contabeis] (
    [ativo] bit NULL,
    [codigo] nvarchar(max) NOT NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NOT NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_eventos_contabeis] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[eventos_contabeis_itens]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[eventos_contabeis_itens] (
    [conta_contabil_id] uniqueidentifier NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [dc] nvarchar(max) NOT NULL,
    [evento_id] uniqueidentifier NULL,
    [historico_padrao] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_eventos_contabeis_itens] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[indicadores_atualizacao]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[indicadores_atualizacao] (
    [ativo] bit NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [nome] nvarchar(max) NOT NULL,
    [periodicidade] nvarchar(max) NULL,
    [regra] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_indicadores_atualizacao] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[indicadores_atualizacao_valores]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[indicadores_atualizacao_valores] (
    [competencia] date NOT NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [fator] decimal(18, 4) NOT NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [indicador_id] uniqueidentifier NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_indicadores_atualizacao_valores] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[lotes]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[lotes] (
    [area_m2] decimal(18, 4) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [custo_contabil] decimal(18, 4) NULL,
    [etiqueta_patrimonial] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [matricula_ri] nvarchar(max) NULL,
    [numero_lote] nvarchar(max) NOT NULL,
    [observacoes] nvarchar(max) NULL,
    [quadra] nvarchar(max) NOT NULL,
    [status] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_lotes] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[mapa_movimento_conta]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[mapa_movimento_conta] (
    [conta_credito_id] uniqueidentifier NULL,
    [conta_debito_id] uniqueidentifier NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [dia_lancamento] nvarchar(max) NOT NULL,
    [expressao_valor] nvarchar(max) NULL,
    [historico_padrao] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [lancamento_pai_id] uniqueidentifier NULL,
    [partida_mensal] bit NOT NULL,
    [tipo_movimento] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_mapa_movimento_conta] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[mensagem_extrato_historico]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[mensagem_extrato_historico] (
    [alterado_em] datetime2 NOT NULL,
    [alterado_por] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [mensagem] nvarchar(max) NULL,
    CONSTRAINT [PK_mensagem_extrato_historico] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[modos_pagamento]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[modos_pagamento] (
    [ativo] bit NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NOT NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_modos_pagamento] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[parcelas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[parcelas] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [data_pagamento] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [numero] decimal(18, 4) NOT NULL,
    [plano_id] uniqueidentifier NULL,
    [status] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [valor_atualizado] decimal(18, 4) NULL,
    [valor_pago] decimal(18, 4) NULL,
    [valor_principal] decimal(18, 4) NOT NULL,
    [vencimento] date NOT NULL,
    CONSTRAINT [PK_parcelas] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[parcelas_abertas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[parcelas_abertas] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [data_pagamento] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [juros_percentual] decimal(18, 4) NULL,
    [lote_id] uniqueidentifier NOT NULL,
    [numero_lote] nvarchar(max) NOT NULL,
    [numero_parcela] int NOT NULL,
    [quadra] nvarchar(max) NOT NULL,
    [status] nvarchar(max) NOT NULL,
    [tipo_fluxo] nvarchar(max) NOT NULL,
    [total_devido] decimal(18, 4) NOT NULL,
    [total_parcelas] decimal(18, 4) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [valor_juros] decimal(18, 4) NULL,
    [valor_multa] decimal(18, 4) NULL,
    [valor_parcela] decimal(18, 4) NOT NULL,
    [vencimento] date NOT NULL,
    [venda_id] uniqueidentifier NULL,
    CONSTRAINT [PK_parcelas_abertas] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[parcelas_controle]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[parcelas_controle] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [data_base] nvarchar(max) NOT NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [lote_id] uniqueidentifier NOT NULL,
    [observacoes] nvarchar(max) NULL,
    [qtd_pagas_base] int NOT NULL,
    [tipo_fluxo] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_parcelas_controle] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[pessoas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[pessoas] (
    [cpf_cnpj] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [email] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [nome_razao] nvarchar(max) NOT NULL,
    [observacoes] nvarchar(max) NULL,
    [rg_ie] nvarchar(max) NULL,
    [telefone] nvarchar(max) NULL,
    [tipo] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    CONSTRAINT [PK_pessoas] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[planos_pagamento]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[planos_pagamento] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [descricao] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [tipo] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [venda_id] uniqueidentifier NULL,
    CONSTRAINT [PK_planos_pagamento] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[profiles]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[profiles] (
    [cpf] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [data_nascimento] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [is_active] bit NULL,
    [is_approved] bit NULL,
    [nome] nvarchar(max) NOT NULL,
    [pergunta_seguranca] nvarchar(max) NULL,
    [resposta_seguranca] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_profiles] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[user_menu_permissions]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[user_menu_permissions] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [menu_key] nvarchar(max) NOT NULL,
    [user_id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_user_menu_permissions] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[user_roles]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[user_roles] (
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [role] nvarchar(30) NOT NULL,
    [user_id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_user_roles] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[venda_documentos]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[venda_documentos] (
    [arquivo_path] nvarchar(max) NOT NULL,
    [arquivo_url] nvarchar(max) NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [nome] nvarchar(max) NOT NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [venda_id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_venda_documentos] PRIMARY KEY ([id])
  );
END
GO

IF OBJECT_ID(N'[dbo].[vendas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[vendas] (
    [comprador_cpf_1] nvarchar(max) NULL,
    [comprador_cpf_2] nvarchar(max) NULL,
    [comprador_nome_1] nvarchar(max) NULL,
    [comprador_nome_2] nvarchar(max) NULL,
    [comprador_pessoa_id] uniqueidentifier NOT NULL,
    [conta_recebimento_vendedor_id] uniqueidentifier NULL,
    [corretor_pessoa_id] uniqueidentifier NULL,
    [created_at] datetime2 NULL DEFAULT SYSUTCDATETIME(),
    [created_by] nvarchar(max) NULL,
    [data_venda] nvarchar(max) NOT NULL,
    [defasagem_indice] decimal(18, 4) NULL,
    [frequencia_parcelas_meses] int NULL,
    [frequencia_reforcos_meses] int NULL,
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [indicador_atualizacao_id] uniqueidentifier NULL,
    [lote_id] uniqueidentifier NOT NULL,
    [observacoes] nvarchar(max) NULL,
    [percentual_corretagem] decimal(18, 4) NULL,
    [primeiro_vencimento_parcela] nvarchar(max) NULL,
    [primeiro_vencimento_reforco] nvarchar(max) NULL,
    [qtd_parcelas] int NULL,
    [qtd_reforcos] int NULL,
    [status] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    [updated_by] nvarchar(max) NULL,
    [valor_arras] decimal(18, 4) NULL,
    [valor_parcelamento] decimal(18, 4) NULL,
    [valor_reforco] decimal(18, 4) NULL,
    [valor_venda] decimal(18, 4) NOT NULL,
    [vendedor_pessoa_id] uniqueidentifier NULL,
    CONSTRAINT [PK_vendas] PRIMARY KEY ([id])
  );
END
GO
