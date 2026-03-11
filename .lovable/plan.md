

## Diagnóstico

O **Rel. Gerencial de Inadimplência** conta parcelas pagas de forma simplista (contando créditos em `conta_corrente_lote` com `tipo_mov` IN `PARCELA/REFORCO`), ignorando completamente a tabela `parcelas_controle` (baseline). A **Consulta de Lote** usa `calcularResumoLote` do motor financeiro central (`calculo-financeiro.ts`), que considera o baseline. Resultado: o relatório gerencial mostra dezenas de parcelas "em atraso" para lotes que estão em dia.

Além disso, o relatório usa `new Date()` como data de referência ao invés da data da última atualização monetária, e calcula o valor da parcela dividindo o saldo pela quantidade a pagar sem usar o motor central.

### Sobre a coluna numérica `parcela`

O usuário sugere adicionar uma coluna numérica `numero_parcela` à tabela `conta_corrente_lote` para evitar o parsing de "xx de yy" no campo `referencia`. Isso simplificaria a contagem de pagamentos e eliminaria ambiguidades.

## Plano de Implementação

### 1. Migração de banco: adicionar coluna `numero_parcela`

Adicionar coluna `numero_parcela` (integer, nullable) à tabela `conta_corrente_lote`. Isso permite identificar diretamente qual parcela foi paga sem depender de regex no campo `referencia`.

```sql
ALTER TABLE public.conta_corrente_lote
  ADD COLUMN numero_parcela integer DEFAULT NULL;
```

### 2. Reescrever `RelGerencialInadimplencia.tsx` para usar o motor financeiro central

Em vez de reimplementar a lógica de contagem de pagamentos, o relatório deve:

- Para cada venda ativa, buscar **movimentos completos** e **parcelas_controle** (como faz `useResumoLoteConsulta`)
- Chamar `calcularResumoLote()` para obter `qtdParcelasPagas`, `qtdParcelasAPagar`, `valorProximaParcela`, etc.
- Buscar a data da última atualização monetária de cada lote e usá-la como data de referência (último dia do mês)
- Projetar parcelas vencidas usando o primeiro vencimento + frequência + parcelas pagas (do motor central)
- O valor por parcela vem do motor (`valorProximaParcela` / `valorProximoReforco`), garantindo consistência com a Consulta de Lote

### 3. Fluxo de dados revisado

```text
vendas (ATIVA)
  ├── Para cada venda:
  │   ├── Buscar movimentos do lote (conta_corrente_lote)
  │   ├── Buscar parcelas_controle do lote
  │   ├── calcularResumoLote() → qtdPagas, qtdAPagar, valorParcela, primeiroVenc
  │   ├── Buscar última ATUALIZACAO → dataRef = último dia do mês
  │   └── Projetar vencimentos: parcela (qtdPagas+1) até dataRef
  │       └── Se vencimento <= dataRef → parcela em atraso (valor bruto)
  └── Montar pivot table com competências
```

### 4. Paginação

As buscas de movimentos por lote individual (dentro do loop) geralmente não excedem 1000 registros. Porém, a busca inicial de todas as vendas e o loop podem ser otimizados fazendo uma única busca paginada de todos os movimentos e agrupando por `lote_id` em memória.

### 5. Arquivos afetados

- **Migração SQL**: nova coluna `numero_parcela` em `conta_corrente_lote`
- **`src/pages/contas-correntes/RelGerencialInadimplencia.tsx`**: reescrita completa da query para usar `calcularResumoLote` e data da última atualização monetária como referência

