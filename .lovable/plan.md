

## Plano: Exportação em Lote de Extratos PDF

### Resposta às suas perguntas

**1) Sim, é totalmente viável.** O sistema já possui toda a lógica de geração de PDF individual (função `exportConsultaLoteToPDF`). Podemos criar um processamento em lote que:
- Identifica todos os lotes que tiveram atualização monetária no mês corrente
- Para cada lote, carrega os dados (movimentos, resumo, parcelas em atraso)
- Gera o PDF usando a mesma lógica existente
- Salva o arquivo no armazenamento do sistema (bucket de Storage)

**2) Sim, é possível.** Porém, com uma ressalva importante: como o sistema roda em nuvem, os PDFs serão salvos no **armazenamento cloud do sistema** (não em uma pasta local do computador). O campo de configuração servirá para definir o padrão de organização dos arquivos (ex: `extratos/2026-04/`). Os usuários poderão baixar os PDFs individualmente ou em lote a partir do sistema.

---

### Implementação proposta

#### 1. Novo bucket de Storage
- Criar bucket `extratos-lote` para armazenar os PDFs gerados

#### 2. Campo de configuração
- Adicionar coluna `pasta_extratos_padrao` na tabela `configuracoes` (ex: `extratos/{ano}-{mes}/`)
- Exibir esse campo na página de Configurações, visível a todos os usuários (somente leitura para não-admins)

#### 3. Nova página "Exportação em Lote"
- Menu em **Relatórios > Exportação de Extratos**
- Selecionar mês de referência
- Lista os lotes com atualização monetária naquele mês (com checkboxes para seleção)
- Botão "Gerar Extratos" que processa lote a lote, com barra de progresso
- Cada PDF é gerado client-side (reaproveitando a lógica existente) e enviado ao Storage
- Ao finalizar, exibe lista dos arquivos gerados com links para download individual
- Opção de "Baixar Todos" (zip ou download sequencial)

#### 4. Detalhes técnicos
- Reutiliza `exportConsultaLoteToPDF` adaptada para retornar o blob ao invés de salvar localmente
- Upload via `supabase.storage.from('extratos-lote').upload(path, blob)`
- Nome do arquivo: `Quadra_{XX}_Lote_{YY}.pdf`
- Caminho: `{pasta_configurada}/Quadra_{XX}_Lote_{YY}.pdf`

#### Arquivos a criar/editar
- **Migração**: nova coluna + bucket
- **`src/pages/Configuracoes.tsx`**: campo de pasta padrão
- **`src/pages/relatorios/ExportacaoExtratos.tsx`**: nova página
- **`src/lib/consulta-lote-pdf.ts`**: adaptar para retornar blob
- **`src/components/layout/AppSidebar.tsx`**, **`src/App.tsx`**, **`src/hooks/usePermissions.tsx`**: rota e menu

