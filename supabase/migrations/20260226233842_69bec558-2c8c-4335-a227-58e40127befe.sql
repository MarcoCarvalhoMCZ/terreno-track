-- Drop the old check constraint that doesn't include QUITADO
ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_status_check;

-- Add updated check constraint including QUITADO
ALTER TABLE public.lotes ADD CONSTRAINT lotes_status_check 
  CHECK (status IN ('DISPONIVEL', 'VENDIDO', 'RESERVADO', 'CANCELADO', 'QUITADO'));

-- Update trigger to also handle QUITADA status
CREATE OR REPLACE FUNCTION public.update_lote_on_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lotes SET status = 'VENDIDO', updated_at = now() WHERE id = NEW.lote_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'CANCELADA' THEN
      UPDATE public.lotes SET status = 'DISPONIVEL', updated_at = now() WHERE id = NEW.lote_id;
    ELSIF NEW.status = 'QUITADA' THEN
      UPDATE public.lotes SET status = 'QUITADO', updated_at = now() WHERE id = NEW.lote_id;
    ELSIF NEW.status = 'ATIVA' AND OLD.status = 'QUITADA' THEN
      UPDATE public.lotes SET status = 'VENDIDO', updated_at = now() WHERE id = NEW.lote_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;