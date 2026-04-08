
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS email_remetente_nome text,
  ADD COLUMN IF NOT EXISTS email_reply_to text,
  ADD COLUMN IF NOT EXISTS email_assunto_padrao text DEFAULT 'Extrato de Conta Corrente do Lote',
  ADD COLUMN IF NOT EXISTS email_rodape text;
