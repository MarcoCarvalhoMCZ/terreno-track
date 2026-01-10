-- Add missing columns to configuracoes table
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS representante_legal_2_pessoa_id uuid REFERENCES pessoas(id),
ADD COLUMN IF NOT EXISTS banco text,
ADD COLUMN IF NOT EXISTS agencia text,
ADD COLUMN IF NOT EXISTS conta_corrente text,
ADD COLUMN IF NOT EXISTS chave_pix text;