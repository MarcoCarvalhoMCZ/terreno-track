import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const typesPath = path.join(root, 'src/integrations/supabase/types.ts');
const outputPath = path.join(root, 'database/sqlserver/schema.generated.sql');
const source = fs.readFileSync(typesPath, 'utf8');

const tablesBlock = source.slice(source.indexOf('    Tables: {'), source.indexOf('    Views: {'));
const tableMatches = [...tablesBlock.matchAll(/^      ([A-Za-z_][A-Za-z0-9_]*): \{$/gm)];
const tables = [];

for (let i = 0; i < tableMatches.length; i++) {
  const name = tableMatches[i][1];
  const start = tableMatches[i].index;
  const end = i + 1 < tableMatches.length ? tableMatches[i + 1].index : tablesBlock.length;
  const block = tablesBlock.slice(start, end);
  const rowStart = block.indexOf('        Row: {');
  const insertStart = block.indexOf('        Insert: {');
  if (rowStart < 0 || insertStart < 0) continue;
  const rowBlock = block.slice(rowStart, insertStart);
  const columns = [...rowBlock.matchAll(/^          ([A-Za-z_][A-Za-z0-9_]*): (.+)$/gm)]
    .map((match) => ({ name: match[1], type: match[2].trim() }));
  tables.push({ name, columns });
}

function sqlType(column) {
  const { name, type } = column;
  if (type.includes('boolean')) return 'bit';
  if (type.includes('number')) {
    if (/^(ano|mes|qtd_|numero_|sequencia_|tolerancia_|frequencia_)/.test(name)) return 'int';
    return 'decimal(18, 4)';
  }
  if (name === 'id' || name.endsWith('_id') || type.includes('app_role') || type.includes('tipo_atualizacao')) {
    return type.includes('app_role') || type.includes('tipo_atualizacao') ? 'nvarchar(30)' : 'uniqueidentifier';
  }
  if (name.endsWith('_at') || name.endsWith('_em')) return 'datetime2';
  if (/^(data_|vencimento|competencia)$/.test(name)) return 'date';
  return 'nvarchar(max)';
}

function nullable(type, name) {
  if (name === 'id') return false;
  return type.includes('| null');
}

const lines = [
  '-- Gerado por scripts/generate-sqlserver-schema.mjs',
  '-- Revise funcoes/triggers/views apos executar este DDL; elas precisam ser convertidas de PL/pgSQL para T-SQL.',
  "IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dbo') EXEC('CREATE SCHEMA [dbo]');",
  'GO',
  '',
];

for (const table of tables) {
  lines.push(`IF OBJECT_ID(N'[dbo].[${table.name}]', N'U') IS NULL`);
  lines.push('BEGIN');
  lines.push(`  CREATE TABLE [dbo].[${table.name}] (`);
  const defs = table.columns.map((column) => {
    const pieces = [`    [${column.name}]`, sqlType(column)];
    if (column.name === 'id') pieces.push('NOT NULL DEFAULT NEWID()');
    else pieces.push(nullable(column.type, column.name) ? 'NULL' : 'NOT NULL');
    if (column.name === 'created_at') pieces.push('DEFAULT SYSUTCDATETIME()');
    return pieces.join(' ');
  });
  if (table.columns.some((column) => column.name === 'id')) {
    defs.push(`    CONSTRAINT [PK_${table.name}] PRIMARY KEY ([id])`);
  }
  lines.push(defs.join(',\n'));
  lines.push('  );');
  lines.push('END');
  lines.push('GO');
  lines.push('');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'));
console.log(`Gerado ${outputPath} com ${tables.length} tabelas.`);
