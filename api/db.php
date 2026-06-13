<?php

function app_config(): array
{
    $local = __DIR__ . '/config.local.php';
    $sample = __DIR__ . '/config.sample.php';
    return file_exists($local) ? require $local : require $sample;
}

function db_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = app_config()['sqlsrv'];
    if (!in_array('sqlsrv', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('A extensao pdo_sqlsrv nao esta instalada no PHP.');
    }

    $server = $cfg['host'] . ',' . $cfg['port'];
    $encrypt = $cfg['encrypt'] ? 'yes' : 'no';
    $trust = $cfg['trust_server_certificate'] ? 'yes' : 'no';
    $dsn = "sqlsrv:Server={$server};Database={$cfg['database']};Encrypt={$encrypt};TrustServerCertificate={$trust}";

    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function db_schema(): string
{
    $schema = app_config()['sqlsrv']['schema'] ?? 'dbo';
    return preg_replace('/[^A-Za-z0-9_]/', '', $schema) ?: 'dbo';
}

function table_name(string $table): string
{
    $safe = preg_replace('/[^A-Za-z0-9_]/', '', $table);
    return '[' . db_schema() . '].[' . $safe . ']';
}

function json_response($payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(['error' => ['message' => 'JSON invalido.']], 400);
    }
    return $data;
}
