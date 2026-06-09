# Corrigir registro de Recebimento de Parcela com Juros/Multa

## Problema

Existe um trigger no banco (`trg_validar_vinculo_juros_multa`) que exige que todo movimento `JUROS` ou `MULTA` tenha `parcela_origem_id` preenchido, apontando para o registro da parcela (`PARCELA`/`REFORCO`) que originou aquele encargo.

Hoje, em `src/pages/RecebimentoParcela.tsx` (função `executarRecebimento`), os três registros (PARCELA + JUROS + MULTA) são inseridos em um único `insert([...])` e nenhum deles preenche `parcela_origem_id` — daí o erro:

> Movimentos JUROS e MULTA devem estar vinculados a uma parcela recebida (parcela_origem_id obrigatório).

## Correção

Em `src/pages/RecebimentoParcela.tsx`, dentro de `executarRecebimento`:

1. Inserir primeiro **apenas** o registro da parcela (`PARCELA` ou `REFORCO`) usando `.insert(...).select('id').single()` para obter o `id` gerado.
2. Se `valorJuros > 0`, montar o registro de `JUROS` com `parcela_origem_id = <id da parcela inserida>` e inserir.
3. Se `valorMulta > 0`, idem para `MULTA` com o mesmo `parcela_origem_id`.
4. Em caso de erro na inserção de juros/multa, fazer rollback manual deletando o registro de parcela recém-criado (para não deixar a parcela órfã sem os encargos esperados) e propagar o erro.

Comportamento visível ao usuário permanece igual: um único clique em "Registrar" gera os 3 lançamentos vinculados, exatamente como descrito (Registro1 = parcela, Registro2 = juros vinculado, Registro3 = multa vinculada).

## Escopo

- Arquivo único alterado: `src/pages/RecebimentoParcela.tsx`
- Sem mudanças de schema, sem mudanças de UI, sem mudanças em outros fluxos (Conta Corrente do Lote já trata isso corretamente).
