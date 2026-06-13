# API PHP

Esta pasta contem a camada que substitui o acesso direto do frontend ao Supabase para dados.

Requisitos no servidor:

- PHP 8.1 ou superior.
- Extensao `pdo_sqlsrv` habilitada.
- Acesso de rede ao SQL Server `eblsig.app.br:1433`.

Arquivos principais:

- `config.local.php`: credenciais reais do SQL Server e chave Supabase usada somente na migracao.
- `index.php`: endpoint usado pelo React em `VITE_API_BASE_URL`.
- `migrate_supabase_to_sqlserver.php`: copia os dados das tabelas Supabase para o SQL Server.

O frontend ainda delega `auth`, `storage` e `functions` ao Supabase legado. A migracao de usuarios/senhas e arquivos deve ser feita em uma etapa separada, porque o Supabase nao expoe senhas existentes para exportacao.
