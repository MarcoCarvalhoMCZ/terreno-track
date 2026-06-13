import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/index.php';

const legacySupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

type Filter = {
  column: string;
  operator: string;
  value: unknown;
};

type Order = {
  column: string;
  ascending: boolean;
};

type QueryPayload = {
  action: 'query';
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  values?: unknown;
  filters: Filter[];
  orders: Order[];
  limit?: number;
  range?: { from: number; to: number };
  onConflict?: string[];
};

async function apiFetch(payload: unknown) {
  const { data: { session } } = await legacySupabase.auth.getSession();
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

class SqlServerQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private operation: QueryPayload['operation'] = 'select';
  private selectColumns = '*';
  private values: unknown;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit?: number;
  private rowRange?: { from: number; to: number };
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private onConflict: string[] = [];

  constructor(private table: string) {}

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  insert(values: unknown) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.values = values;
    this.onConflict = options?.onConflict?.split(',').map((item) => item.trim()).filter(Boolean) || [];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, operator: 'in', value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: 'is', value });
    return this;
  }

  like(column: string, value: string) {
    this.filters.push({ column, operator: 'like', value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ column, operator: 'ilike', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  range(from: number, to: number) {
    this.rowRange = { from, to };
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  or() {
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ column, operator: operator === 'is' ? 'isNot' : `not.${operator}`, value });
    return this;
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const payload: QueryPayload = {
      action: 'query',
      table: this.table,
      operation: this.operation,
      select: this.selectColumns,
      values: this.values,
      filters: this.filters,
      orders: this.orders,
      limit: this.rowLimit,
      range: this.rowRange,
      onConflict: this.onConflict,
    };

    const response = await apiFetch(payload);
    const json = await response.json();
    if (!response.ok || json.error) {
      return { data: null, error: json.error || new Error('Erro na API SQL Server') };
    }

    let data = json.data;
    if (this.singleMode !== 'none') {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        return this.singleMode === 'single'
          ? { data: null, error: { message: 'Nenhum registro encontrado.' } }
          : { data: null, error: null };
      }
      data = rows[0];
    }

    return { data, error: null };
  }
}

export const supabase = {
  auth: legacySupabase.auth,
  storage: legacySupabase.storage,
  functions: legacySupabase.functions,
  from(table: string) {
    return new SqlServerQueryBuilder(table) as any;
  },
  rpc(name: string, params?: Record<string, unknown>) {
    return apiFetch({ action: 'rpc', name, params: params || {} })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => ({
        data: response.ok && !json.error ? json.data : null,
        error: response.ok ? json.error : json.error || { message: 'Erro na RPC SQL Server' },
      }));
  },
};
