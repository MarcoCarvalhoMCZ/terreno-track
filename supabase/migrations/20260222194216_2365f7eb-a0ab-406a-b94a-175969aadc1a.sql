
-- Add payment detail columns to conta_corrente_lote
ALTER TABLE public.conta_corrente_lote 
ADD COLUMN IF NOT EXISTS modo_pagamento text,
ADD COLUMN IF NOT EXISTS banco_origem text,
ADD COLUMN IF NOT EXISTS cpf_cnpj_pagador text;

-- Add "recebimentoParcela" to menu permissions registry
-- (no schema change needed, just a conceptual addition to the MENU_ITEMS in code)
