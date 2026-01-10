-- Adicionar campo cidade nas configurações para QR Code PIX
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS cidade_beneficiario TEXT,
ADD COLUMN IF NOT EXISTS nome_beneficiario TEXT;