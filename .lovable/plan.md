## Migração de campos para a página Administrador

Com base na sua marcação (✅), os campos serão divididos assim:

### Vão para Administrador (exclusivo Admin)
**Empresa Proprietária** (9 campos)
- `razao_social_proprietaria`, `cnpj_proprietaria`, `crc_rs_proprietaria`, `cidade_uf_proprietaria`, `telefone_proprietaria`, `email_proprietaria`, `logotipo_url`, `data_criacao_app`, `desenvolvedor_analista`

**Pessoas padrão** (5 campos)
- `vendedor_pessoa_id`, `representante_legal_pessoa_id`, `representante_legal_2_pessoa_id`, `padrao_corretor_pessoa_id`, `padrao_percentual_corretagem`

**Outros**
- `observacoes`

### Permanecem em Configuração (Admin + Operador)
- **Dados bancários / PIX**: `banco`, `agencia`, `conta_corrente`, `chave_pix`, `nome_beneficiario`, `cidade_beneficiario`
- **Mora / Atraso**: `juros_mora_percentual`, `multa_mora_percentual`, `criterio_juros_mora`, `tolerancia_dias_juros`
- **E-mail**: `email_remetente_nome`, `email_reply_to`, `email_assunto_padrao`, `email_rodape`

---

## O que será feito

**1. Página `Administrador.tsx`** — receberá três blocos editáveis (Empresa Proprietária, Pessoas padrão, Observações), reaproveitando os mesmos componentes de formulário hoje em `Configuracoes.tsx` (inputs, upload de logotipo, selects de pessoa via `LoteSearchSelect`/equivalente). Botões "Salvar/Cancelar" no `DialogHeader` à direita, conforme padrão do projeto. Inclui `AuditFooter`.

**2. Página `Configuracoes.tsx`** — removidos os blocos migrados; permanecem apenas Dados bancários/PIX, Mora/Atraso e E-mail. Mantém o mesmo layout/estilo.

**3. Proteção no banco** — trigger `BEFORE UPDATE` em `public.configuracoes` que rejeita alteração das colunas administrativas quando o usuário não for ADMIN (usa `has_role(auth.uid(),'admin')`). Lista de colunas protegidas: as 15 marcadas acima. SELECT continua livre (Operador precisa ler para exibir, ex.: vendedor padrão em telas de venda).

**4. Quadro de Avisos** (mensagem institucional para extratos) — fica para uma próxima rodada, conforme combinado; não entra agora.

---

## Detalhes técnicos

- Não altero `src/integrations/supabase/types.ts` (auto-gerado).
- Migration única: `CREATE OR REPLACE FUNCTION public.tg_configuracoes_protect_admin_fields()` + `CREATE TRIGGER` em `BEFORE UPDATE`. A função compara `OLD.<col>` vs `NEW.<col>` para cada coluna protegida; se diferente e `NOT has_role(auth.uid(),'admin')` → `RAISE EXCEPTION`.
- O hook de carregamento das configurações (`useConfiguracoes` ou query equivalente) é reutilizado nas duas páginas — apenas os campos exibidos/editáveis mudam.
- Os campos `vendedor_pessoa_id`, `representante_legal_*`, `padrao_corretor_pessoa_id` continuam sendo lidos normalmente pelo Operador em outras telas (Vendas, etc.) — só a edição passa a ser exclusiva do Admin.

---

## Próximo passo

Aprove o plano para eu (a) aplicar a migration de proteção e (b) reorganizar as duas páginas.
