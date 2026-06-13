<?php

const ALLOWED_TABLES = [
    'auditoria_mora_override',
    'configuracoes',
    'consolidacao_contabil',
    'conta_corrente_lote',
    'contas_contabeis',
    'contas_recebimento_vendedor',
    'enderecos',
    'eventos_contabeis',
    'eventos_contabeis_itens',
    'indicadores_atualizacao',
    'indicadores_atualizacao_valores',
    'lotes',
    'mapa_movimento_conta',
    'mensagem_extrato_historico',
    'modos_pagamento',
    'parcelas',
    'parcelas_abertas',
    'parcelas_controle',
    'pessoas',
    'planos_pagamento',
    'profiles',
    'user_menu_permissions',
    'user_roles',
    'venda_documentos',
    'vendas',
    'vw_resumo_fluxo_lote',
    'vw_resumo_operacoes_lote',
    'vw_totalizacao_mensal_consolidada',
    'vw_totalizacao_mensal_por_lote',
];

const RELATIONS = [
    'configuracoes' => [
        'vendedor' => ['table' => 'pessoas', 'local' => 'vendedor_pessoa_id', 'foreign' => 'id'],
    ],
    'vendas' => [
        'comprador' => ['table' => 'pessoas', 'local' => 'comprador_pessoa_id', 'foreign' => 'id'],
        'vendedor' => ['table' => 'pessoas', 'local' => 'vendedor_pessoa_id', 'foreign' => 'id'],
        'corretor' => ['table' => 'pessoas', 'local' => 'corretor_pessoa_id', 'foreign' => 'id'],
        'lote' => ['table' => 'lotes', 'local' => 'lote_id', 'foreign' => 'id'],
        'pessoas' => ['table' => 'pessoas', 'local' => 'comprador_pessoa_id', 'foreign' => 'id'],
        'lotes' => ['table' => 'lotes', 'local' => 'lote_id', 'foreign' => 'id'],
    ],
    'conta_corrente_lote' => [
        'lote' => ['table' => 'lotes', 'local' => 'lote_id', 'foreign' => 'id'],
        'lotes' => ['table' => 'lotes', 'local' => 'lote_id', 'foreign' => 'id'],
        'venda' => ['table' => 'vendas', 'local' => 'venda_id', 'foreign' => 'id'],
    ],
    'mapa_movimento_conta' => [
        'conta_debito' => ['table' => 'contas_contabeis', 'local' => 'conta_debito_id', 'foreign' => 'id'],
        'conta_credito' => ['table' => 'contas_contabeis', 'local' => 'conta_credito_id', 'foreign' => 'id'],
    ],
    'indicadores_atualizacao_valores' => [
        'indicador' => ['table' => 'indicadores_atualizacao', 'local' => 'indicador_id', 'foreign' => 'id'],
    ],
];

function assert_allowed_table(string $table): void
{
    if (!in_array($table, ALLOWED_TABLES, true)) {
        json_response(['error' => ['message' => "Tabela nao permitida: {$table}"]], 400);
    }
}

function safe_column(string $column): string
{
    $column = trim($column);
    if ($column === '*') {
        return '*';
    }
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $column)) {
        json_response(['error' => ['message' => "Coluna invalida: {$column}"]], 400);
    }
    return '[' . $column . ']';
}
