<?php

function current_user_from_bearer(): ?array
{
    static $cached = false;
    static $cachedUser = null;
    if ($cached) {
        return $cachedUser;
    }
    $cached = true;

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return null;
    }

    $token = $m[1];
    $cfg = app_config()['supabase'];
    $url = rtrim($cfg['url'] ?? '', '/');
    $key = $cfg['key'] ?? '';
    if ($url === '' || $key === '') {
        return null;
    }

    $ch = curl_init($url . '/auth/v1/user');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($body === false || $status >= 400) {
        return null;
    }

    $user = json_decode($body, true);
    $cachedUser = is_array($user) && isset($user['id']) ? $user : null;
    return $cachedUser;
}

function current_user_role(PDO $pdo): ?string
{
    $user = current_user_from_bearer();
    if (!$user) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT TOP 1 [role] FROM ' . table_name('user_roles') . ' WHERE [user_id] = ? ORDER BY CASE [role] WHEN N\'ADMIN\' THEN 1 WHEN N\'OPERADOR\' THEN 2 ELSE 3 END');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    return $row['role'] ?? 'CONSULTA';
}

function authorize_table_operation(PDO $pdo, string $table, string $operation, array $filters = []): void
{
    $user = current_user_from_bearer();
    if (!$user) {
        json_response(['error' => ['message' => 'Usuario nao autenticado.']], 401);
    }

    $role = current_user_role($pdo);
    $isAdmin = $role === 'ADMIN';
    $canEdit = $isAdmin || $role === 'OPERADOR';

    if ($table === 'profiles') {
        if ($isAdmin) {
            return;
        }
        if ($operation === 'select' || $operation === 'update') {
            require_own_user_filter($filters, 'id', $user['id']);
            return;
        }
    }

    if ($table === 'user_roles' || $table === 'user_menu_permissions') {
        if ($isAdmin) {
            return;
        }
        if ($operation === 'select') {
            require_own_user_filter($filters, 'user_id', $user['id']);
            return;
        }
        json_response(['error' => ['message' => 'Acesso negado: requer perfil ADMIN.']], 403);
    }

    $adminOnly = ['configuracoes'];
    if (in_array($table, $adminOnly, true) && $operation !== 'select' && !$isAdmin) {
        json_response(['error' => ['message' => 'Acesso negado: requer perfil ADMIN.']], 403);
    }

    $adminOperatorRead = ['vendas', 'conta_corrente_lote', 'venda_documentos', 'parcelas_controle'];
    if (in_array($table, $adminOperatorRead, true) && !$canEdit) {
        json_response(['error' => ['message' => 'Acesso negado: requer perfil ADMIN ou OPERADOR.']], 403);
    }

    if ($operation !== 'select' && !$canEdit) {
        json_response(['error' => ['message' => 'Acesso negado: requer perfil ADMIN ou OPERADOR.']], 403);
    }
}

function authorize_rpc(PDO $pdo, string $name): void
{
    $role = current_user_role($pdo);
    if (!in_array($role, ['ADMIN', 'OPERADOR'], true)) {
        json_response(['error' => ['message' => "Acesso negado para RPC {$name}: requer ADMIN ou OPERADOR."]], 403);
    }
}

function require_own_user_filter(array $filters, string $column, string $userId): void
{
    foreach ($filters as $filter) {
        if (($filter['column'] ?? null) === $column && ($filter['operator'] ?? null) === 'eq' && ($filter['value'] ?? null) === $userId) {
            return;
        }
    }
    json_response(['error' => ['message' => 'Acesso negado: filtro de usuario proprio obrigatorio.']], 403);
}

function set_sqlserver_security_context(PDO $pdo): void
{
    $user = current_user_from_bearer();
    if (!$user) {
        return;
    }

    $ctx = $pdo->prepare('DECLARE @ctx varbinary(128) = CONVERT(binary(16), CONVERT(uniqueidentifier, ?)); SET CONTEXT_INFO @ctx;');
    $ctx->execute([$user['id']]);
}
