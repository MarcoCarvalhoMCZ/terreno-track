

## Diagnóstico

O problema está na comparação de datas para incidência de juros. Quando o critério é `MES_SUBSEQUENTE`, a data de início de juros para uma parcela com vencimento em 09/02/2026 é `01/03/2026` (primeiro dia do mês seguinte). Se a última atualização monetária também é `01/03/2026`, a comparação `isAfter(01/03, 01/03)` retorna `false` — porque `isAfter` é estritamente "maior que", não "maior ou igual".

Resultado: a parcela é marcada como vencida, mas com 0 meses de atraso → sem juros, sem multa.

**A correção**: trocar `isAfter(dataAtual, dataInicioJuros)` por `!isBefore(dataAtual, dataInicioJuros)` (equivale a `>=`), em **três** locais que replicam essa lógica.

Além disso, a página "Recebimento de Parcela" tem lógica de cálculo duplicada e independente. O ideal é fazê-la reutilizar o hook `useParcelasEmAtraso` para garantir consistência permanente com a "Consulta do Lote".

## Plano de Implementação

### 1. Corrigir `useParcelasEmAtraso.ts` (linha 127)
- Trocar `if (!isAfter(dataAtual, dataInicioJuros))` por `if (isBefore(dataAtual, dataInicioJuros))` na função `calcularMesesAtraso`.
- Isso faz com que, quando `dataAtual === dataInicioJuros`, o sistema conte 1 mês de atraso (juros + multa).
- Importar `isBefore` de `date-fns` (já está importado).

### 2. Corrigir `useRelatorioInadimplencia.ts`
- Mesma correção na função `calcularMesesAtraso` local (que é uma cópia da lógica).

### 3. Refatorar `RecebimentoParcela.tsx`
- **Eliminar** a lógica de cálculo de parcelas duplicada (linhas 96-188).
- **Reutilizar** o hook `useParcelasEmAtraso` para PARCELAMENTO e REFORÇO, da mesma forma que `ConsultaLote` faz.
- Converter o resultado de `ParcelaEmAtraso[]` para `ParcelaCalculada[]` adicionando o campo `tipoFluxo`.
- Isso garante que "Recebimento de Parcela" mostre **exatamente** os mesmos valores que "Consulta do Lote", eliminando discrepâncias futuras.

### Detalhes Técnicos

```text
Antes (bug):
  isAfter(01/03/2026, 01/03/2026) → false → 0 meses → sem juros/multa

Depois (corrigido):
  !isBefore(01/03/2026, 01/03/2026) → true → 1 mês → 1% juros + 2% multa
```

Arquivos alterados:
- `src/hooks/useParcelasEmAtraso.ts`
- `src/hooks/useRelatorioInadimplencia.ts`
- `src/pages/RecebimentoParcela.tsx`

