

## Adicionar placeholder `[mes_ano]` ao histórico do Slip Contábil

### O que será feito

Adicionar uma nova variável `[mes_ano]` (ou `{mes_ano}`) disponível nos templates de histórico, que resolve para o mês/ano da data do movimento no formato "MARÇO/2025" (mês por extenso em português, maiúsculo).

### Implementação

**Arquivo:** `src/pages/contabilidade/SlipContabil.tsx`

1. **Adicionar `data_mov` à interface `HistoricoCtx`** (linha ~97):
   ```typescript
   data_mov: string | null;
   ```

2. **Adicionar resolução do placeholder na função `resolveHistorico`** (após linha 130):
   ```typescript
   result = r(result, "mes_ano", ctx.data_mov 
     ? format(new Date(ctx.data_mov + "T00:00:00"), "MMMM/yyyy", { locale: ptBR }).toUpperCase() 
     : "—");
   ```

3. **Passar `data_mov` ao construir o contexto** onde `resolveHistorico` é chamado — incluir `data_mov: mov.data_mov` no objeto `HistoricoCtx`.

4. **Importar `ptBR`** do `date-fns/locale` se ainda não importado.

### Escopo
- 1 arquivo modificado
- Sem alteração de backend
- Novo placeholder disponível imediatamente em qualquer template de histórico

