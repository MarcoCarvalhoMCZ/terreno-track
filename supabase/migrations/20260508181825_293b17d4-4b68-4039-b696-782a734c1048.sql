-- Tighten logotipos: drop broad public select policies and recreate for authenticated only
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual LIKE '%logotipos%' OR policyname ILIKE '%logo%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can view logotipos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'logotipos');

CREATE POLICY "Admins can manage logotipos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'logotipos' AND has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (bucket_id = 'logotipos' AND has_role(auth.uid(), 'ADMIN'::app_role));

-- Replace venda-documentos policies with role-scoped ones
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND qual LIKE '%venda-documentos%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authorized roles can view venda-documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'venda-documentos'
       AND (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)));

CREATE POLICY "Authorized roles can manage venda-documentos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'venda-documentos'
       AND (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)))
WITH CHECK (bucket_id = 'venda-documentos'
       AND (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role)));

-- Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

-- Trigger functions don't need direct invocation
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_venda_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lote_on_venda() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.uppercase_nome_razao() FROM authenticated;