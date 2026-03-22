

## Problema Identificado

O Slip Contábil busca movimentos do mês e tenta resolver os placeholders do histórico usando dados da venda vinculada ao movimento (`venda_id`). Porém, muitos movimentos de crédito (pagamentos de REFORCO, PARCELA, etc.) **não possuem `venda_id` preenchido**, e o fallback `vendaPorLote` só funciona se outro movimento do mesmo lote **no mesmo mês** tiver uma venda associada.

Quando nenhuma venda é encontrada, todos os placeholders dependentes da venda (`{comprador}`, `{cpf_comprador}`, `{data_venda}`, `{qtd_reforcos}`, `{solidario}`) resolvem para "—".

## Solução

Carregar separadamente **todas as vendas ativas** e construir um lookup `lote_id -> venda`. Usar esse lookup como fallback definitivo quando o movimento não tiver `venda_id` ou quando o join não retornar dados.

## Plano de Implementação

### Arquivo: `src/pages/contabilidade/SlipContabil.tsx`

1. **Adicionar query de vendas ativas** -- Nova `useQuery` buscando todas as vendas ativas com os campos necessários (comprador, CPF, data_venda, qtd_parcelas, qtd_reforcos, valor_arras, etc.) e join com `pessoas` para nome/CPF do comprador.

2. **Construir lookup `vendaAtivasPorLote`** -- Um `Map<lote_id, venda>` com todas as vendas ativas, independente do mês.

3. **Alterar resolução no `useMemo` de `slipRows`** -- Na linha onde se define `venda` (linha 321), adicionar o fallback:
   ```
   const venda = mov.venda || vendaPorLote.get(mov.lote_id) || vendasAtivasPorLote?.get(mov.lote_id) || null;
   ```

Isso garante que mesmo movimentos sem `venda_id` terão acesso aos dados do comprador, data da venda, quantidades, etc.

### Escopo

- Apenas um arquivo modificado (`SlipContabil.tsx`)
- Sem alteração de backend/banco
- Sem alteração de rotas ou permissões

