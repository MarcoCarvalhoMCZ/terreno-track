## Refatoração Arquitetural - EBL-Loteamentos

### Concluído

#### 1. Motor Financeiro Central (`src/lib/calculo-financeiro.ts`)
- **Single Source of Truth** para cálculos de saldo, parcelas e reforços
- Funções exportadas: `calcularResumoLote`, `calcularTotaisFluxo`, `contarPagamentos`, `calcularValorProximo`
- Eliminou ~150 linhas duplicadas de `useConsultaLote.ts`
- Regra de Bases Correntes: `saldo ÷ parcelas restantes`

#### 2. Lógica de Mora Centralizada (`src/lib/calculo-mora.ts`)
- Funções: `calcularEncargosParcela`, `calcularMesesAtraso`, `isParcelaVencida`, `calcularDataInicioJuros`
- Eliminou triplicação entre `useParcelasEmAtraso` e `useRelatorioInadimplencia`
- Re-exports em `useParcelasEmAtraso` para retrocompatibilidade

#### 3. Dashboard - Correção de Fonte de Dados
- **Antes**: Inadimplência consultava tabela legada `parcelas` (dados desatualizados)
- **Depois**: Calcula dinamicamente a partir de `vendas` + `conta_corrente_lote`
- Agora consistente com o restante do sistema

#### 4. Vendas.tsx - Remoção de Tipos Redundantes
- Removido `VendaExtended` (duplicava campos já na tabela)
- Removido `tiposAtualizacao` local (agora importa de `@/constants/movimento`)
- Removido `TipoAtualizacao` local

#### 5. useConsultaLote - Simplificação
- `useResumoLoteConsulta` agora delega 100% ao motor central
- Query otimizada: seleciona apenas colunas necessárias em vez de `*`
- Removida importação de `addMonths` (movida ao motor)

### Arquitetura Resultante

```
src/
├── lib/
│   ├── calculo-financeiro.ts   ← Motor financeiro central (Bases Correntes)
│   ├── calculo-mora.ts         ← Cálculos de juros e multa centralizados
│   ├── formatters.ts           ← Formatação de dados
│   ├── pix.ts                  ← Geração de payloads PIX
│   └── consulta-lote-pdf.ts    ← Exportação PDF
├── hooks/
│   ├── useConsultaLote.ts      ← Consulta + PIX + atualização auto (usa motor central)
│   ├── useParcelasEmAtraso.ts  ← Parcelas em atraso (usa calculo-mora)
│   ├── useRelatorioInadimplencia.ts  ← Relatório (usa calculo-mora)
│   └── useContaCorrente.ts     ← CRUD conta corrente
├── constants/
│   ├── movimento.ts            ← Tipos de movimento, atualização, fluxos
│   └── status.ts               ← Status de lotes e vendas
└── types/
    ├── conta-corrente.types.ts ← Tipos financeiros
    ├── venda.types.ts          ← Tipos de venda
    └── lote.types.ts           ← Tipos de lote
```

### Pontos para Revisão Futura
- `Vendas.tsx` (974 linhas) ainda é um "God Component" - separar query hooks
- `ContaCorrenteLote.tsx` pode extrair lógica de sugestões para hook dedicado
- Tabela `parcelas` + `planos_pagamento` parecem legadas e podem ser descontinuadas
