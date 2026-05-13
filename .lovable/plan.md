# Refatoração: Tela de Movimentos (Conta Corrente do Lote)

## Objetivo
Tornar a tela de Movimentos totalmente parametrizada pelas **Configurações de Mora (Atraso)**, com habilitação dinâmica de campos, cálculo automático de juros/multa e geração vinculada de movimentos.

## Escopo
Tela: `EBL-Loteamentos → Contas Correntes → Movimentos` (`src/pages/contas-correntes/ContaCorrenteLote.tsx` e diálogo de cadastro de movimentação).

---

## 1. Matriz de habilitação por Tipo de Movimento

Criar arquivo `src/constants/movimento-campos.ts` com a matriz declarativa:

```ts
// Para cada tipo_mov: quais campos são habilitados
// Obrigatórios = todos habilitados, EXCETO: modo_pagamento, banco_origem, cpf_cnpj_pagador
export const MOVIMENTO_CAMPOS: Record<TipoMov, CampoConfig> = {
  PARCELA:      { lote, venda, data_mov, vencimento, credito, modo_pagamento, banco_origem, cpf_cnpj_pagador, numero_parcela, tipo_fluxo },
  REFORCO:      { ...idem PARCELA },
  JUROS:        { lote, venda, data_mov, debito, vinculado_parcela_id }, // bloqueado, gerado automaticamente
  MULTA:        { lote, venda, data_mov, debito, vinculado_parcela_id }, // bloqueado, gerado automaticamente
  ATUALIZACAO:  { lote, data_mov, debito, percentual_calculo, referencia },
  VENDA:        { lote, venda, data_mov, debito },
  OUTROS:       { lote, data_mov, descricao, debito|credito },
};
```

Campos NÃO listados ficam: cinza, `disabled`, `tabIndex={-1}`, não persistidos.

## 2. Configurações de Mora (já existentes)

Reutilizar `useMoraConfig()` que já lê:
- `juros_mora_percentual`
- `multa_mora_percentual`
- `criterio_juros_mora` (`MES_SUBSEQUENTE` | `TOLERANCIA` | futuro `PRO_RATA`, `FIXO_MENSAL`)
- `tolerancia_dias_juros`

Adicionar enum estendido em `src/lib/calculo-mora.ts`:
```ts
type CriterioJurosMora = "MES_SUBSEQUENTE" | "TOLERANCIA" | "PRO_RATA_DIA" | "FIXO_MENSAL";
```
Implementar `MES_SUBSEQUENTE` e `TOLERANCIA` (já existem). Deixar `PRO_RATA_DIA` e `FIXO_MENSAL` com stubs preparados.

## 3. Cálculo automático ao lançar Parcela Recebida

No diálogo de movimento, quando `tipo_mov ∈ {PARCELA, REFORCO}` e usuário informar `vencimento` + `data_mov` (data pagamento) + `credito`:

1. `calcularEncargosParcela(valor, vencimento, dataPagamento, moraConfig)`
2. Se `mesesAtraso === 0` ou `dias_atraso <= tolerancia` → sem juros/multa
3. Se houver atraso → exibir banner amarelo:
   ```
   ⚠ Parcela em atraso detectada.
   Dias: X | Critério: Y | Juros: R$ A (Z%) | Multa: R$ B (W%)
   Valor original: R$ V | Atualizado: R$ T
   ```

## 4. Geração automática de movimentos vinculados

Ao salvar a Parcela com encargos > 0:
- Inserir registro PARCELA (crédito = valor parcela)
- Inserir registro JUROS (débito = valorJuros, `referencia` = id da parcela)
- Inserir registro MULTA (débito = valorMulta, `referencia` = id da parcela)

Migration: adicionar coluna `parcela_origem_id uuid` em `conta_corrente_lote` para vincular juros/multa à parcela recebida (FK lógica). Index para consulta. Trigger impedindo:
- INSERT de JUROS/MULTA sem `parcela_origem_id`
- DELETE da PARCELA sem cascatear JUROS/MULTA

## 5. Edição manual controlada

Adicionar permissão `PERMITIR_EDICAO_FINANCEIRA` em `usePermissions`:
- Default: apenas ADMIN
- Sem permissão → campos de juros/multa read-only mesmo após cálculo
- Com permissão → permite override; registra em tabela `auditoria_mora` (user_id, data, valor_original, valor_novo, motivo)

Nova tabela `auditoria_mora_override`:
```sql
- movimento_id, campo, valor_original, valor_novo, motivo, user_id, created_at
```

## 6. Reatividade

`useEffect` no diálogo dispara recálculo quando muda:
- `tipo_mov`, `vencimento`, `data_mov`, `credito`, `moraConfig`, `parcela_origem_id`

## 7. Proibições enforçadas

- UI: tipo `JUROS`/`MULTA` não selecionável manualmente no Select (gerados automaticamente)
- DB: trigger `BEFORE INSERT` em `conta_corrente_lote` rejeita JUROS/MULTA sem `parcela_origem_id`

## Arquivos afetados

**Novos:**
- `src/constants/movimento-campos.ts` — matriz de habilitação
- `src/hooks/useMovimentoCampos.ts` — hook que retorna `{ habilitado, obrigatorio }` por campo
- `src/components/movimento/AtrasoBanner.tsx` — banner ⚠
- Migration: coluna `parcela_origem_id`, tabela `auditoria_mora_override`, trigger de validação

**Editados:**
- `src/pages/contas-correntes/ContaCorrenteLote.tsx` — diálogo: aplicar matriz + banner + auto-geração
- `src/lib/calculo-mora.ts` — adicionar critérios `PRO_RATA_DIA`, `FIXO_MENSAL` (stubs)
- `src/hooks/usePermissions.tsx` — adicionar `PERMITIR_EDICAO_FINANCEIRA`

## Detalhes técnicos

- Sem hardcode de percentuais: tudo via `useMoraConfig`
- Performance: `useMemo` para encargos; query de `configuracoes` cacheada por React Query
- Compatibilidade: registros antigos sem `parcela_origem_id` continuam válidos (constraint só para novos JUROS/MULTA)
- Auditoria: `AuditFooter` no diálogo + nova tabela de override

---

**Confirma este plano?** Após aprovação, começo pela migration (coluna + tabela auditoria + trigger), depois matriz de campos, depois refatoração da UI do diálogo.
