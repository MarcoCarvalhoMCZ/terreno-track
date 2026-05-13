## O que será criado

**1. Nova entrada no menu lateral** (grupo Administração), logo abaixo de "Configuração":

```text
Administração
├── Reorganização
├── Importação CSV
├── Usuários e Permissões
├── Configuração              ← passará a ser acessível por ADMIN + OPERADOR
└── Administrador             ← NOVO — exclusivo ADMIN
```

**2. Nova rota** `/administrador` → `src/pages/Administrador.tsx` (página vazia, pronta para receber os campos que você marcar).

**3. Nova `MenuKey`** `administrador` em `usePermissions.tsx`, tratada como `configuracoes` (somente Admin, mesmo que esteja na lista de permissões).

**4. Permissão da página "Configuração"** será afrouxada: deixa de ser exclusiva do Admin e passa a aceitar Operador também (caso contrário, mover campos não faz sentido).

**5. Proteção no banco**: trigger `BEFORE UPDATE` em `configuracoes` que rejeita alteração das colunas marcadas como "Administrador" quando o usuário não for ADMIN. Assim a separação fica garantida mesmo via API.

> Nesta etapa **não migro nenhum campo** — só crio a estrutura. Após sua aprovação e marcação dos campos abaixo, faço a migração na próxima rodada.

---

## Lista de campos para você marcar

Marque com ✅ os que devem ir para **Administrador** (os não marcados ficam em **Configuração**, acessível ao Operador).

### Bloco — Empresa Proprietária
- [ ] `razao_social_proprietaria`
- [ ] `cnpj_proprietaria`
- [ ] `crc_rs_proprietaria`
- [ ] `cidade_uf_proprietaria`
- [ ] `telefone_proprietaria`
- [ ] `email_proprietaria`
- [ ] `logotipo_url`
- [ ] `data_criacao_app`
- [ ] `desenvolvedor_analista`

### Bloco — Pessoas padrão
- [ ] `vendedor_pessoa_id` (Vendedor padrão)
- [ ] `representante_legal_pessoa_id`
- [ ] `representante_legal_2_pessoa_id`
- [ ] `padrao_corretor_pessoa_id`
- [ ] `padrao_percentual_corretagem`

### Bloco — Dados bancários / PIX
- [ ] `banco`
- [ ] `agencia`
- [ ] `conta_corrente`
- [ ] `chave_pix`
- [ ] `nome_beneficiario`
- [ ] `cidade_beneficiario`

### Bloco — Mora / Atraso
- [ ] `juros_mora_percentual`
- [ ] `multa_mora_percentual`
- [ ] `criterio_juros_mora`
- [ ] `tolerancia_dias_juros`

### Bloco — E-mail
- [ ] `email_remetente_nome`
- [ ] `email_reply_to`
- [ ] `email_assunto_padrao`
- [ ] `email_rodape`

### Bloco — Outros
- [ ] `observacoes`

---

## Próximo passo

1. Aprove este plano para eu criar a página vazia + entrada no menu.
2. Em seguida, me responda no chat com a lista marcada (pode colar a lista acima com ✅ nos itens escolhidos).
3. Eu então migro os campos marcados para a nova página e ativo a proteção no banco.
