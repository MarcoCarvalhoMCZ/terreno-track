<?php

return [
    'sqlsrv' => [
        'host' => getenv('SQLSERVER_HOST') ?: 'eblsig.app.br',
        'port' => (int) (getenv('SQLSERVER_PORT') ?: 1433),
        'database' => getenv('SQLSERVER_DATABASE') ?: 'bd_ebl_loteamento',
        'username' => getenv('SQLSERVER_USERNAME') ?: 'eblsig_sa_sql',
        'password' => getenv('SQLSERVER_PASSWORD') ?: '',
        'schema' => getenv('SQLSERVER_SCHEMA') ?: 'dbo',
        'encrypt' => filter_var(getenv('SQLSERVER_ENCRYPT') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'trust_server_certificate' => filter_var(getenv('SQLSERVER_TRUST_CERT') ?: 'true', FILTER_VALIDATE_BOOLEAN),
    ],
    'supabase' => [
        'url' => getenv('SUPABASE_URL') ?: '',
        'key' => getenv('SUPABASE_SERVICE_ROLE_KEY') ?: getenv('SUPABASE_ANON_KEY') ?: '',
    ],
];
