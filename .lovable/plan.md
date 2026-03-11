## Arquitetura Final - EBL-Loteamentos

### Princípios

- **Sistema de Bases Correntes**: `Nova parcela = saldo atualizado ÷ parcelas restantes`
- **Single Source of Truth**: Cada regra de cálculo existe em apenas um módulo
- **DRY**: Tipos, constantes e lógica nunca são duplicados entre telas

### Módulos Centrais

#### 1. Motor Financeiro (`src/lib/calculo-financeiro.ts`)
- **Ponto único** para cálculos de saldo, parcelas e reforços
- Funções: `calcularResumoLote`, `calcularTotaisFluxo`, `contarPagamentos`, `calcularValorProximo`
- Consumido via `useResumoLoteConsulta` em todas as telas

#### 2. Motor de Mora (`src/lib/calculo-mora.ts`)
- **Ponto único** para juros e multa de mora
- Funções: `calcularEncargosParcela`, `calcularMesesAtraso`, `isParcelaVencida`, `calcularDataInicioJuros`
- Consumido por `useParcelasEmAtraso` e `useRelatorioInadimplencia`

#### 3. Constantes (`src/constants/`)
- `movimento.ts`: Tipos de movimento, natureza (débito/crédito), tipos de atualização
- `status.ts`: Status de lotes e vendas com labels e cores (design tokens)

#### 4. Tipos (`src/types/`)
- `lote.types.ts`: Lote, LoteInsert, LoteUpdate, LoteMinimal
- `venda.types.ts`: Venda, VendaComRelacionamentos, VendaFormData, emptyVenda
- `conta-corrente.types.ts`: ContaCorrente, ResumoFluxo, ResumoLote, ContaCorrenteComSaldo

### Hooks de Domínio

| Hook | Responsabilidade |
|------|-----------------|
| `useConsultaLote` | Consulta completa + PIX + atualização auto (usa motor central) |
| `useParcelasEmAtraso` | Parcelas vencidas com encargos (usa calculo-mora) |
| `useRelatorioInadimplencia` | Relatório consolidado por comprador (usa calculo-mora) |
| `useContaCorrente` | CRUD da conta corrente |
| `useParcelasControle` | Baseline de parcelas pagas |
| `usePermissions` | Permissões de menu por usuário |
| `useTableSort` | Ordenação genérica de tabelas |

### Utilitários

| Módulo | Responsabilidade |
|--------|-----------------|
| `lib/formatters.ts` | Formatação de moeda, datas, documentos, parsing BR |
| `lib/pix.ts` | Geração de payloads PIX |
| `lib/date.ts` | Parsing de datas |
| `lib/qr-utils.ts` | Utilitários de QR Code |
| `lib/consulta-lote-pdf.ts` | Exportação PDF da consulta |

### Estrutura do Projeto

```
src/
├── lib/                          ← Regras de negócio (sem dependência de React)
│   ├── calculo-financeiro.ts     ← Motor financeiro (Bases Correntes)
│   ├── calculo-mora.ts           ← Motor de juros/multa
│   ├── formatters.ts             ← Formatação unificada
│   ├── pix.ts                    ← PIX payload
│   ├── date.ts                   ← Parsing de datas
│   ├── qr-utils.ts               ← QR Code
│   └── consulta-lote-pdf.ts      ← PDF export
├── constants/
│   ├── movimento.ts              ← Tipos de movimento e atualização
│   └── status.ts                 ← Status com labels e cores
├── types/
│   ├── lote.types.ts
│   ├── venda.types.ts
│   └── conta-corrente.types.ts
├── hooks/
│   ├── useConsultaLote.ts        ← Consulta + PIX + auto-atualização
│   ├── useParcelasEmAtraso.ts    ← Parcelas em atraso
│   ├── useRelatorioInadimplencia.ts
│   ├── useContaCorrente.ts       ← CRUD conta corrente
│   ├── useParcelasControle.ts    ← Baseline parcelas
│   ├── usePermissions.tsx        ← Menus permitidos
│   └── useTableSort.ts           ← Ordenação genérica
├── pages/
│   ├── Dashboard.tsx             ← KPIs + mapa + gráficos
│   ├── Vendas.tsx                ← CRUD vendas (usa tipos centrais)
│   ├── RecebimentoParcela.tsx    ← Liquidação de títulos
│   ├── Configuracoes.tsx
│   ├── Importacao.tsx
│   ├── Login.tsx
│   ├── cadastro/                 ← Lotes, Pessoas, Indicadores
│   ├── contas-correntes/         ← ContaCorrente, Consulta, Inadimplência, etc.
│   └── contabilidade/            ← Eventos e Contas Contábeis
├── components/
│   ├── layout/                   ← AppLayout, AppSidebar
│   ├── ui/                       ← shadcn components
│   ├── LoteSearchSelect.tsx      ← Seletor de lote reutilizável
│   ├── SortableTableHead.tsx     ← Cabeçalho ordenável
│   └── ParcelasEmAtrasoTable.tsx ← Tabela de parcelas em atraso
└── contexts/
    └── AuthContext.tsx            ← Autenticação + roles
```

### Refatorações Realizadas

| Ação | Resultado |
|------|-----------|
| Criação do motor financeiro central | Eliminou ~150 linhas duplicadas |
| Unificação da lógica de mora | Eliminou triplicação entre hooks |
| Dashboard usando `conta_corrente_lote` | Corrigiu inconsistência com tabela legada `parcelas` |
| Vendas.tsx usando tipos centrais | Eliminou ~75 linhas de tipos/constantes locais |
| Dashboard usando `vendaStatusColors` | Eliminou `getStatusBadge` local duplicado |
| Dashboard usando design tokens | Substituiu cores hardcoded por tokens semânticos |

### Pontos para Revisão Futura

- `Vendas.tsx` (~900 linhas) pode extrair formulário para componente separado
- `AtualizacaoMonetaria.tsx` (~900 linhas) pode extrair lógica de cálculo para hook dedicado
- `ContaCorrenteLote.tsx` pode extrair lógica de sugestões para hook dedicado
- Tabelas `parcelas` + `planos_pagamento` são legadas e podem ser descontinuadas
- `useAtualizacaoMonetariaAutomatica` em `useConsultaLote.ts` poderia ser hook separado
