CREATE OR REPLACE FUNCTION public.uppercase_nome_razao()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.nome_razao := UPPER(NEW.nome_razao);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_uppercase_nome_razao
BEFORE INSERT OR UPDATE OF nome_razao ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.uppercase_nome_razao();