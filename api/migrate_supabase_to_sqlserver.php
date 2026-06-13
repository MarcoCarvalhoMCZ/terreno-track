<?php

require __DIR__ . '/db.php';
require __DIR__ . '/schema.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Execute este script pela linha de comando.\n";
    exit(1);
}

$config = app_config();
$supabaseUrl = rtrim($config['supabase']['url'] ?? '', '/');
$supabaseKey = $config['supabase']['key'] ?? '';

if ($supabaseUrl === '' || $supabaseKey === '') {
    fwrite(STDERR, "Configure supabase.url e supabase.key em api/config.local.php.\n");
    exit(1);
}

$tables = [
    'profiles',
    'user_roles',
    'user_menu_permissions',
    'pessoas',
    'enderecos',
    'modos_pagamento',
    'contas_contabeis',
    'eventos_contabeis',
    'eventos_contabeis_itens',
    'lotes',
    'indicadores_atualizacao',
    'indicadores_atualizacao_valores',
    'configuracoes',
    'vendas',
    'conta_corrente_lote',
    'parcelas',
    'parcelas_controle',
    'parcelas_abertas',
    'venda_documentos',
    'contas_recebimento_vendedor',
    'planos_pagamento',
    'mapa_movimento_conta',
    'consolidacao_contabil',
    'auditoria_mora_override',
    'mensagem_extrato_historico',
];

$pdo = db_pdo();
$pdo->beginTransaction();
try {
    foreach ($tables as $table) {
        assert_allowed_table($table);
        echo "Migrando {$table}...\n";
        $rows = fetch_supabase_rows($supabaseUrl, $supabaseKey, $table);
        echo "  " . count($rows) . " registros encontrados.\n";
        if (!$rows) {
            continue;
        }
        insert_batch($pdo, $table, $rows);
    }
    $pdo->commit();
    echo "Migracao concluida.\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "Falha na migracao: {$e->getMessage()}\n");
    exit(1);
}

function fetch_supabase_rows(string $baseUrl, string $key, string $table): array
{
    $all = [];
    $from = 0;
    $pageSize = 1000;

    while (true) {
        $to = $from + $pageSize - 1;
        $url = "{$baseUrl}/rest/v1/{$table}?select=*";
        $headers = [
            "apikey: {$key}",
            "Authorization: Bearer {$key}",
            "Range: {$from}-{$to}",
            "Range-Unit: items",
            "Accept: application/json",
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($body === false) {
            throw new RuntimeException(curl_error($ch));
        }
        curl_close($ch);

        if ($status >= 400) {
            throw new RuntimeException("Supabase {$table} retornou HTTP {$status}: {$body}");
        }

        $rows = json_decode($body, true);
        if (!is_array($rows)) {
            throw new RuntimeException("Resposta invalida da tabela {$table}.");
        }
        array_push($all, ...$rows);
        if (count($rows) < $pageSize) {
            break;
        }
        $from += $pageSize;
    }

    return $all;
}

function insert_batch(PDO $pdo, string $table, array $rows): void
{
    foreach ($rows as $row) {
        if (!$row) {
            continue;
        }
        $cols = array_keys($row);
        $sql = 'INSERT INTO ' . table_name($table)
            . ' (' . implode(', ', array_map('safe_column', $cols)) . ') VALUES ('
            . implode(', ', array_fill(0, count($cols), '?')) . ')';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_values($row));
    }
}
