
-- Add new columns for double-entry bookkeeping
ALTER TABLE mapa_movimento_conta 
  ADD COLUMN conta_debito_id uuid REFERENCES contas_contabeis(id),
  ADD COLUMN conta_credito_id uuid REFERENCES contas_contabeis(id),
  ADD COLUMN historico_padrao text,
  ADD COLUMN lancamento_pai_id uuid REFERENCES mapa_movimento_conta(id) ON DELETE CASCADE;

-- Migrate existing data: D -> conta_debito_id, C -> conta_credito_id
UPDATE mapa_movimento_conta SET conta_debito_id = conta_contabil_id WHERE natureza_lancamento = 'D';
UPDATE mapa_movimento_conta SET conta_credito_id = conta_contabil_id WHERE natureza_lancamento = 'C';

-- Drop old constraint and columns
ALTER TABLE mapa_movimento_conta 
  DROP CONSTRAINT mapa_movimento_conta_conta_contabil_id_fkey;

ALTER TABLE mapa_movimento_conta 
  DROP COLUMN conta_contabil_id,
  DROP COLUMN natureza_lancamento;
