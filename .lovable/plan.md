## Plano: Correção da Exportação de Extratos em Lote

### Causa do erro atual
O Supabase Storage rejeita chaves contendo `C:\`, `\` ou `:`. O campo "pasta padrão" estava sendo concatenado como caminho de gravação em nuvem, gerando `Invalid key`. O sistema é web e **não tem acesso ao disco local do usuário** — gravação direta em `C:\...` é impossível por segurança do navegador.

### Solução escolhida
Substituir a gravação no bucket de nuvem por **download direto no navegador**, oferecendo dois botões na tela de Exportação:

1. **Baixar ZIP** — gera todos os PDFs selecionados, empacota em um único `.zip` (ex.: `Extratos_2026-05.zip`) e baixa para a pasta Downloads. Funciona em qualquer navegador.
2. **Salvar em pasta…** — abre o diálogo nativo do Windows para escolher a pasta destino (ex.: `C:\LoteamentoSagradaFamilia\`) e grava cada PDF diretamente lá com o nome `Quadra_XX_Lote_YY.pdf`. Disponível apenas em Chrome, Edge e Opera (botão fica desabilitado com tooltip explicativo em outros navegadores).

### Mudanças

#### 1. Página `src/pages/relatorios/ExportacaoExtratos.tsx`
- Substituir o botão único "Gerar Extratos" pelos dois botões acima.
- **Baixar ZIP**: usar `jszip` para empacotar os blobs gerados; baixar via link temporário.
- **Salvar em pasta…**: usar `window.showDirectoryPicker()` (File System Access API); para cada PDF, criar `FileSystemFileHandle` e gravar o blob.
- Detectar suporte: `'showDirectoryPicker' in window` controla o `disabled` do botão "Salvar em pasta…".
- Manter a tabela "Extratos Gerados" com status (sucesso/erro) por lote, mas sem mais a coluna "Arquivo" com link de Storage — substituir por nome do arquivo gerado.
- Remover toda a lógica de upload para `supabase.storage.from('extratos-lote')`.

#### 2. Página `src/pages/Configuracoes.tsx`
- Remover o card/campo "Pasta padrão de extratos".

#### 3. Banco de dados
- Migração para remover a coluna `pasta_extratos_padrao` da tabela `configuracoes`.
- Remover o bucket `extratos-lote` (não é mais necessário) — opcional; pode ser mantido vazio sem custo. Vou **manter o bucket** por enquanto, apenas parar de usá-lo, evitando perda caso já existam arquivos.

#### 4. Dependência
- Adicionar `jszip` ao projeto (`bun add jszip`).

### Detalhes técnicos
- A função `generateConsultaLotePDFBlob` em `src/lib/consulta-lote-pdf.ts` já retorna o blob — será reutilizada sem alteração.
- O loop de geração continua client-side com barra de progresso. Diferença: no fim do loop, em vez de fazer upload, ou empacota em ZIP, ou escreve cada blob no `FileSystemDirectoryHandle` selecionado.
- Nome dos arquivos permanece `Quadra_XX_Lote_YY.pdf`.
- A escolha da pasta acontece **antes** do início do processamento (um único clique de autorização do navegador para todos os arquivos).

### Arquivos editados/criados
- `src/pages/relatorios/ExportacaoExtratos.tsx` (refatoração)
- `src/pages/Configuracoes.tsx` (remover campo)
- Nova migração SQL (drop da coluna)
- `package.json` (adiciona `jszip`)
