
-- Add new columns for proprietária/developer info
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS desenvolvedor_analista text,
  ADD COLUMN IF NOT EXISTS razao_social_proprietaria text,
  ADD COLUMN IF NOT EXISTS cnpj_proprietaria text,
  ADD COLUMN IF NOT EXISTS crc_rs_proprietaria text,
  ADD COLUMN IF NOT EXISTS cidade_uf_proprietaria text,
  ADD COLUMN IF NOT EXISTS telefone_proprietaria text,
  ADD COLUMN IF NOT EXISTS email_proprietaria text,
  ADD COLUMN IF NOT EXISTS logotipo_url text;
