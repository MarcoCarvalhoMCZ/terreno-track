

## Plan: Create `parcelas_abertas` Table (Accounts Receivable)

### Summary

Create a persistent "Parcelas Abertas" table that acts as an Accounts Receivable ledger. It will be populated during monetary updates, updated on payment receipt, and serve as the data source for delinquency reports.

### 1. Database Migration

Create the table `parcelas_abertas`:

```sql
CREATE TABLE public.parcelas_abertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id),
  venda_id UUID REFERENCES vendas(id),
  quadra TEXT NOT NULL,
  numero_lote TEXT NOT NULL,
  tipo_fluxo TEXT NOT NULL DEFAULT 'PARCELAMENTO', -- PARCELAMENTO | REFORCO
  numero_parcela INTEGER NOT NULL,
  total_parcelas INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor_parcela NUMERIC NOT NULL DEFAULT 0,
  juros_percentual NUMERIC DEFAULT 0,
  valor_juros NUMERIC DEFAULT 0,
  valor_multa NUMERIC DEFAULT 0,
  total_devido NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ABERTO', -- ABERTO | PAGO
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  UNIQUE(lote_id, tipo_fluxo, numero_parcela)
);

ALTER TABLE public.parcelas_abertas ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as conta_corrente_lote)
CREATE POLICY "Admins and operators can manage parcelas_abertas"
  ON public.parcelas_abertas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') OR has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view parcelas_abertas"
  ON public.parcelas_abertas FOR SELECT TO authenticated
  USING (true);
```

### 2. Population Logic (Edge Function or DB Function)

Create a database function `popular_parcelas_abertas(p_lote_id UUID)` that:
- Fetches the active sale for the lot
- Gets movements and parcelas_controle
- Runs the same algorithm as `useParcelasEmAtraso` (calculate resumo via saldo/parcelas, generate due dates, compute encargos)
- Upserts into `parcelas_abertas` (DELETE + INSERT for the lot)

Also create `popular_todas_parcelas_abertas()` for bulk initial population.

### 3. Integration Points

**a) Atualização Monetária** — After inserting ATUALIZACAO movements (both batch and auto), call repopulation for affected lots. Modify:
- `src/pages/contas-correntes/AtualizacaoMonetaria.tsx` (batch mutation `onSuccess`)
- `src/hooks/useConsultaLote.ts` (`useAtualizacaoMonetariaAutomatica` mutation `onSuccess`)

**b) Recebimento de Parcela** — After payment, mark matching row as `PAGO` or delete it. Modify:
- `src/pages/RecebimentoParcela.tsx` (mutation `onSuccess` — update `parcelas_abertas` status)

**c) Delinquency Reports** — Refactor to read from `parcelas_abertas` instead of computing in-memory:
- `src/hooks/useRelatorioInadimplencia.ts` — query `parcelas_abertas` WHERE status = 'ABERTO'
- `src/pages/contas-correntes/RelGerencialInadimplencia.tsx` — same

**d) Initial Population** — Run `popular_todas_parcelas_abertas()` via migration or one-time call to seed existing data.

### 4. Implementation Approach

Given the complexity of the financial engine (mora config, parcelas_controle baselines, saldo-based installment values), the population will be done **client-side** via a new utility function that reuses the existing `calcularResumoLote` + `calcularEncargosParcela` engines, then upserts to the table. This ensures 100% consistency with the existing Consulta de Lote calculations without duplicating the logic in SQL.

A new shared function `regenerarParcelasAbertas(loteId)` will:
1. Fetch venda, movimentos, parcelas_controle, mora config
2. Call `calcularResumoLote()` + loop generating parcelas with `calcularEncargosParcela()`
3. Delete existing `parcelas_abertas` for the lot
4. Insert new rows

### 5. Files to Create/Modify

- **New**: Database migration for `parcelas_abertas` table
- **New**: `src/lib/parcelas-abertas.ts` — shared `regenerarParcelasAbertas()` function
- **Modify**: `src/pages/contas-correntes/AtualizacaoMonetaria.tsx` — call regeneration after batch update
- **Modify**: `src/hooks/useConsultaLote.ts` — call regeneration after auto monetary update
- **Modify**: `src/pages/RecebimentoParcela.tsx` — mark as PAGO + regenerate after receipt
- **Modify**: `src/hooks/useRelatorioInadimplencia.ts` — read from `parcelas_abertas` table
- **Modify**: `src/pages/contas-correntes/RelGerencialInadimplencia.tsx` — read from `parcelas_abertas` table

### Technical Notes

- The UNIQUE constraint `(lote_id, tipo_fluxo, numero_parcela)` ensures no duplicate installment per lot/flow.
- Mora values (juros/multa) are recalculated on each monetary update since they depend on the reference date.
- The `status` field enables quick filtering for open vs. paid installments.
- Reports become simple SELECT queries instead of heavy in-memory computations.

