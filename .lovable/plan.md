

## Plano: Expandir placeholders do histórico do Slip Contábil

### Situação atual

O `resolveHistorico` suporta 7 variáveis: `{comprador}`, `{quadra}`, `{lote}`, `{data_venda}`, `{valor_venda}`, `{valor}`, `{parcela}`.

A query de movimentos busca apenas: `valor_venda`, `comprador_nome_1`, `data_venda` da tabela `vendas`, e `quadra`, `numero_lote`, `custo_contabil` da tabela `lotes`.

### O que precisa mudar

**1. Expandir a query de movimentos** no `SlipContabil.tsx` para buscar dados adicionais:
- De `vendas`: `comprador_cpf_1`, `comprador_nome_2`, `comprador_cpf_2`, `valor_arras`, `valor_reforco`, `qtd_reforcos`, `valor_parcelamento`, `qtd_parcelas`
- De `lotes`: `area_m2`, `matricula_ri`

**2. Adicionar novas variáveis ao `resolveHistorico`**:

| Placeholder | Descrição | Fonte |
|---|---|---|
| `{cpf_comprador}` | CPF do comprador principal (formatado) | `vendas.comprador_cpf_1` |
| `{comprador_2}` | Nome do comprador solidário | `vendas.comprador_nome_2` |
| `{cpf_comprador_2}` | CPF do comprador solidário (formatado) | `vendas.comprador_cpf_2` |
| `{area}` | Área do lote em m² | `lotes.area_m2` |
| `{matricula}` | Matrícula do RI | `lotes.matricula_ri` |
| `{valor_arras}` | Valor das arras/sinal | `vendas.valor_arras` |
| `{valor_reforco}` | Valor total de reforços | `vendas.valor_reforco` |
| `{qtd_reforcos}` | Quantidade de reforços | `vendas.qtd_reforcos` |
| `{valor_parcelamento}` | Valor do parcelamento | `vendas.valor_parcelamento` |
| `{qtd_parcelas}` | Quantidade de parcelas | `vendas.qtd_parcelas` |
| `{ql}` | Quadra-Lote formatado (ex: A-03) | Derivado de quadra + lote |

**3. Tratar comprador solidário condicionalmente**: quando `{comprador_2}` e `{cpf_comprador_2}` não existirem na venda, substituir por string vazia para evitar "—" no meio do texto. O template do usuário ficaria algo como:

```
VENDA DO LOTE {ql} PARA {comprador} (CPF {cpf_comprador}) {bloco_solidario}COM ÁREA DE {area}M2 E MATRÍCULA Nº {matricula} DO REGISTRO DE IMÓVEIS DA COMARCA DE FORQUILHINHA/SC (Valor Total {valor_venda} - Arras de {valor_arras} - Reforços {valor_reforco} - Parcelamento de {valor_parcelamento} em {qtd_parcelas} prestações mensais, atualizáveis)
```

Porém, o bloco do solidário é condicional. Para resolver isso sem complicar demais, adicionarei um placeholder especial `{solidario}` que é substituído por `E NOME (CPF xxx)` quando houver comprador solidário, ou por string vazia quando não houver.

**4. Atualizar `PLACEHOLDERS_HELP`** no `MapaMovimentoConta.tsx` para listar todas as novas variáveis disponíveis.

### Arquivos a editar
- `src/pages/contabilidade/SlipContabil.tsx` — query expandida + `resolveHistorico` com novas variáveis
- `src/pages/contabilidade/MapaMovimentoConta.tsx` — `PLACEHOLDERS_HELP` atualizado

### Exemplo de resultado com o template cadastrado

O usuário cadastraria no histórico do mapa:
```
VENDA DO LOTE {ql} PARA {comprador} (CPF {cpf_comprador}) {solidario}COM ÁREA DE {area}M2 E MATRÍCULA Nº {matricula} DO REGISTRO DE IMÓVEIS DA COMARCA DE FORQUILHINHA/SC (Valor Total {valor_venda} - Arras de {valor_arras} - Reforços {valor_reforco} - Parcelamento de {valor_parcelamento} em {qtd_parcelas} prestações mensais, atualizáveis)
```

E o resultado gerado seria:
```
VENDA DO LOTE A-03 PARA JUCELIA DOS SANTOS MARTINHO (CPF 046.419.749-00) COM ÁREA DE 405M2 E MATRÍCULA Nº 11061 DO REGISTRO DE IMÓVEIS DA COMARCA DE FORQUILHINHA/SC (Valor Total R$ 253.000,00 - Arras de R$ 25.000,00 - Reforços R$ 59.280,00 - Parcelamento de R$ 168.720,00 em 96 prestações mensais, atualizáveis)
```

