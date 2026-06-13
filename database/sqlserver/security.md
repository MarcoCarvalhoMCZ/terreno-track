# Seguranca e RLS

O servidor informado respondeu como **Microsoft SQL Server 2012 Express**.

SQL Server 2012 nao possui Row-Level Security nativo. O recurso `CREATE SECURITY POLICY` so existe a partir do SQL Server 2016.

Por isso, as regras equivalentes ao RLS do Supabase foram refeitas na API PHP:

- toda chamada de dados exige usuario autenticado;
- `ADMIN` pode gerenciar usuarios, permissoes e configuracoes;
- `ADMIN` e `OPERADOR` podem gravar dados operacionais;
- `CONSULTA` fica restrito a leitura autorizada;
- `profiles`, `user_roles` e `user_menu_permissions` exigem usuario proprio, exceto para `ADMIN`.

Quando o servidor for atualizado para SQL Server 2016 ou superior, estas regras podem ser movidas para RLS nativo no banco usando `SESSION_CONTEXT` ou mecanismo equivalente.
