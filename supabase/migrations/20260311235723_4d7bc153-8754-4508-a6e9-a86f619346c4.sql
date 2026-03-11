CREATE OR REPLACE FUNCTION public.uppercase_nome_razao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.nome_razao := UPPER(NEW.nome_razao);
  RETURN NEW;
END;
$function$;