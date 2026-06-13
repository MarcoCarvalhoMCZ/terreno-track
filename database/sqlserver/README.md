# SQL Server

1. Execute `schema.generated.sql` no banco `bd_ebl_loteamento`.
2. Confirme que a extensao PHP `pdo_sqlsrv` esta habilitada no servidor.
3. Ajuste `api/config.local.php` no servidor com host, banco, usuario e senha.
4. Rode a migracao pela linha de comando:

```sh
php api/migrate_supabase_to_sqlserver.php
```

O script copia apenas tabelas de dados do Supabase. `auth.users`, senhas e buckets de arquivos do Supabase Storage nao sao exportados pela chave anonima; a autenticacao e os arquivos continuam delegados ao Supabase ate uma etapa propria de migracao.

## RLS

O servidor atual e SQL Server 2012 Express, que nao suporta RLS nativo. As regras equivalentes ficam na API PHP. Veja `security.md`.
