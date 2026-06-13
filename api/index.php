<?php

require __DIR__ . '/db.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $body = read_json_body();
    $action = $body['action'] ?? ($_GET['action'] ?? 'query');

    if ($action === 'query') {
        handle_query($body);
    }
    if ($action === 'rpc') {
        handle_rpc($body);
    }

    json_response(['error' => ['message' => "Acao desconhecida: {$action}"]], 400);
} catch (Throwable $e) {
    json_response(['error' => ['message' => $e->getMessage()]], 500);
}

function handle_query(array $body): void
{
    $table = (string) ($body['table'] ?? '');
    $operation = (string) ($body['operation'] ?? 'select');
    assert_allowed_table($table);
    authorize_table_operation(db_pdo(), $table, $operation, $body['filters'] ?? []);

    if ($operation === 'select') {
        json_response(['data' => select_rows($table, $body), 'error' => null]);
    }
    if ($operation === 'insert') {
        json_response(['data' => insert_rows($table, $body['values'] ?? []), 'error' => null]);
    }
    if ($operation === 'update') {
        json_response(['data' => update_rows($table, $body['values'] ?? [], $body['filters'] ?? []), 'error' => null]);
    }
    if ($operation === 'delete') {
        delete_rows($table, $body['filters'] ?? []);
        json_response(['data' => null, 'error' => null]);
    }
    if ($operation === 'upsert') {
        json_response(['data' => upsert_rows($table, $body['values'] ?? [], $body['onConflict'] ?? []), 'error' => null]);
    }

    json_response(['error' => ['message' => "Operacao desconhecida: {$operation}"]], 400);
}

function handle_rpc(array $body): void
{
    $name = preg_replace('/[^A-Za-z0-9_]/', '', (string) ($body['name'] ?? ''));
    $params = $body['params'] ?? [];
    $allowed = [
        'aplicar_atualizacao_fluxo',
        'calcular_atualizacao_monetaria_lote',
        'calcular_proximo_titulo_fluxo',
        'executar_atualizacao_monetaria',
        'gerar_proximo_titulo_fluxo',
        'get_qtd_restante_fluxo',
        'get_saldo_atualizado_fluxo',
        'has_role',
        'recalcular_saldo_lote',
        'reorganizar_conta_corrente_fluxo',
        'reorganizar_lote_completo',
        'reorganizar_todos_lotes',
    ];
    if (!in_array($name, $allowed, true)) {
        json_response(['error' => ['message' => "RPC nao permitida: {$name}"]], 400);
    }

    $pdo = db_pdo();
    authorize_rpc($pdo, $name);
    $placeholders = [];
    $values = [];
    foreach ($params as $key => $value) {
        $placeholders[] = '@' . preg_replace('/[^A-Za-z0-9_]/', '', (string) $key) . ' = ?';
        $values[] = $value;
    }

    $sql = 'EXEC ' . table_name($name) . (count($placeholders) ? ' ' . implode(', ', $placeholders) : '');
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);
    $rows = $stmt->fetchAll();
    json_response(['data' => count($rows) === 1 && count($rows[0]) === 1 ? array_values($rows[0])[0] : $rows, 'error' => null]);
}

function select_rows(string $table, array $body): array
{
    $pdo = db_pdo();
    set_sqlserver_security_context($pdo);
    [$columns, $relations] = parse_select((string) ($body['select'] ?? '*'));
    if ($columns !== ['*'] && $relations) {
        foreach ($relations as $rel) {
            $meta = RELATIONS[$table][$rel['alias']] ?? RELATIONS[$table][$rel['name']] ?? null;
            if ($meta && !in_array($meta['local'], $columns, true)) {
                $columns[] = $meta['local'];
            }
        }
    }
    $params = [];
    $where = build_where($body['filters'] ?? [], $params);
    $order = build_order($body['orders'] ?? []);
    $range = $body['range'] ?? null;
    $limit = isset($body['limit']) ? (int) $body['limit'] : null;

    $select = $columns === ['*'] ? '*' : implode(', ', array_map('safe_column', $columns));
    $sql = 'SELECT ' . $select . ' FROM ' . table_name($table) . $where . $order;

    if (is_array($range)) {
        if ($order === '') {
            $sql .= ' ORDER BY (SELECT NULL)';
        }
        $offset = max(0, (int) $range['from']);
        $count = max(1, (int) $range['to'] - $offset + 1);
        $sql .= " OFFSET {$offset} ROWS FETCH NEXT {$count} ROWS ONLY";
    } elseif ($limit !== null) {
        $sql = preg_replace('/^SELECT /', 'SELECT TOP ' . max(1, $limit) . ' ', $sql, 1);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    if ($relations) {
        attach_relations($table, $rows, $relations);
    }
    return $rows;
}

function insert_rows(string $table, $values): array
{
    $rows = normalize_rows($values);
    if (!$rows) {
        return [];
    }

    $pdo = db_pdo();
    set_sqlserver_security_context($pdo);
    $inserted = [];
    foreach ($rows as $row) {
        if (!isset($row['id'])) {
            $row['id'] = guid();
        }
        $cols = array_keys($row);
        $params = array_values($row);
        $sql = 'INSERT INTO ' . table_name($table)
            . ' (' . implode(', ', array_map('safe_column', $cols)) . ')'
            . ' OUTPUT inserted.* VALUES ('
            . implode(', ', array_fill(0, count($cols), '?')) . ')';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $inserted[] = $stmt->fetch();
    }
    return $inserted;
}

function update_rows(string $table, array $values, array $filters): array
{
    if (!$values) {
        return [];
    }
    $params = [];
    $sets = [];
    foreach ($values as $key => $value) {
        $sets[] = safe_column($key) . ' = ?';
        $params[] = $value;
    }
    $where = build_where($filters, $params);
    $sql = 'UPDATE ' . table_name($table) . ' SET ' . implode(', ', $sets) . ' OUTPUT inserted.*' . $where;
    $pdo = db_pdo();
    set_sqlserver_security_context($pdo);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function delete_rows(string $table, array $filters): void
{
    $params = [];
    $where = build_where($filters, $params);
    if ($where === '') {
        json_response(['error' => ['message' => 'Delete sem filtro bloqueado.']], 400);
    }
    $pdo = db_pdo();
    set_sqlserver_security_context($pdo);
    $stmt = $pdo->prepare('DELETE FROM ' . table_name($table) . $where);
    $stmt->execute($params);
}

function upsert_rows(string $table, $values, array $onConflict): array
{
    $rows = normalize_rows($values);
    $result = [];
    foreach ($rows as $row) {
        $conflict = $onConflict ?: (isset($row['id']) ? ['id'] : []);
        if (!$conflict) {
            $result = array_merge($result, insert_rows($table, $row));
            continue;
        }
        $filters = [];
        foreach ($conflict as $column) {
            $filters[] = ['column' => $column, 'operator' => 'eq', 'value' => $row[$column] ?? null];
        }
        $existing = select_rows($table, ['select' => 'id', 'filters' => $filters, 'limit' => 1]);
        if ($existing) {
            $result = array_merge($result, update_rows($table, $row, $filters));
        } else {
            $result = array_merge($result, insert_rows($table, $row));
        }
    }
    return $result;
}

function normalize_rows($values): array
{
    if (!is_array($values)) {
        return [];
    }
    if ($values === [] || array_is_list($values)) {
        return $values;
    }
    return [$values];
}

function build_where(array $filters, array &$params): string
{
    if (!$filters) {
        return '';
    }
    $parts = [];
    foreach ($filters as $filter) {
        $column = safe_column((string) $filter['column']);
        $op = (string) $filter['operator'];
        $value = $filter['value'] ?? null;
        if ($op === 'eq') {
            $parts[] = "{$column} = ?";
            $params[] = $value;
        } elseif ($op === 'neq') {
            $parts[] = "{$column} <> ?";
            $params[] = $value;
        } elseif (in_array($op, ['gt', 'gte', 'lt', 'lte'], true)) {
            $map = ['gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='];
            $parts[] = "{$column} {$map[$op]} ?";
            $params[] = $value;
        } elseif ($op === 'in') {
            $vals = is_array($value) ? $value : [];
            if (!$vals) {
                $parts[] = '1 = 0';
            } else {
                $parts[] = "{$column} IN (" . implode(', ', array_fill(0, count($vals), '?')) . ')';
                array_push($params, ...$vals);
            }
        } elseif ($op === 'is') {
            $parts[] = $value === null ? "{$column} IS NULL" : "{$column} IS NOT NULL";
        } elseif ($op === 'isNot') {
            $parts[] = $value === null ? "{$column} IS NOT NULL" : "{$column} IS NULL";
        } elseif ($op === 'like' || $op === 'ilike') {
            $parts[] = "{$column} LIKE ?";
            $params[] = $value;
        } elseif ($op === 'not.eq') {
            $parts[] = "{$column} <> ?";
            $params[] = $value;
        } elseif ($op === 'not.in') {
            $vals = is_array($value) ? $value : [];
            if ($vals) {
                $parts[] = "{$column} NOT IN (" . implode(', ', array_fill(0, count($vals), '?')) . ')';
                array_push($params, ...$vals);
            }
        }
    }
    return $parts ? ' WHERE ' . implode(' AND ', $parts) : '';
}

function build_order(array $orders): string
{
    if (!$orders) {
        return '';
    }
    $parts = [];
    foreach ($orders as $order) {
        $column = safe_column((string) $order['column']);
        $direction = !empty($order['ascending']) ? 'ASC' : 'DESC';
        $parts[] = "{$column} {$direction}";
    }
    return $parts ? ' ORDER BY ' . implode(', ', $parts) : '';
}

function parse_select(string $select): array
{
    $select = trim($select) ?: '*';
    if ($select === '*') {
        return [['*'], []];
    }

    $tokens = split_top_level($select);
    $columns = [];
    $relations = [];
    foreach ($tokens as $token) {
        $token = trim($token);
        if ($token === '*') {
            $columns = ['*'];
            continue;
        }
        if (preg_match('/^(.+)\((.*)\)$/s', $token, $m)) {
            $head = trim($m[1]);
            $alias = null;
            $name = $head;
            if (str_contains($head, ':')) {
                [$alias, $name] = array_map('trim', explode(':', $head, 2));
            }
            if (str_contains($name, '!')) {
                [$name] = explode('!', $name, 2);
            }
            $alias = $alias ?: $name;
            if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $alias) && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
                $relations[] = ['alias' => $alias, 'name' => $name, 'columns' => array_map('trim', split_top_level($m[2]))];
            }
            continue;
        }
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $token)) {
            $columns[] = $token;
        }
    }
    return [$columns ?: ['*'], $relations];
}

function split_top_level(string $value): array
{
    $parts = [];
    $buf = '';
    $depth = 0;
    for ($i = 0, $len = strlen($value); $i < $len; $i++) {
        $ch = $value[$i];
        if ($ch === '(') {
            $depth++;
        } elseif ($ch === ')') {
            $depth--;
        } elseif ($ch === ',' && $depth === 0) {
            $parts[] = $buf;
            $buf = '';
            continue;
        }
        $buf .= $ch;
    }
    if (trim($buf) !== '') {
        $parts[] = $buf;
    }
    return $parts;
}

function attach_relations(string $table, array &$rows, array $relations): void
{
    foreach ($relations as $rel) {
        $meta = RELATIONS[$table][$rel['alias']] ?? RELATIONS[$table][$rel['name']] ?? null;
        if (!$meta) {
            foreach ($rows as &$row) {
                $row[$rel['alias']] = null;
            }
            continue;
        }
        $ids = array_values(array_unique(array_filter(array_column($rows, $meta['local']))));
        if (!$ids) {
            continue;
        }
        if (!in_array($meta['foreign'], $rel['columns'], true)) {
            $rel['columns'][] = $meta['foreign'];
        }
        $relatedRows = select_rows($meta['table'], [
            'select' => implode(',', $rel['columns']),
            'filters' => [['column' => $meta['foreign'], 'operator' => 'in', 'value' => $ids]],
        ]);
        $byId = [];
        foreach ($relatedRows as $related) {
            $byId[$related[$meta['foreign']]] = $related;
        }
        foreach ($rows as &$row) {
            $row[$rel['alias']] = $byId[$row[$meta['local']] ?? ''] ?? null;
        }
    }
}

function guid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
