
-- Fix venda_documentos: restrict SELECT to ADMIN/OPERADOR
DROP POLICY IF EXISTS "Authenticated can view venda_documentos" ON public.venda_documentos;
DROP POLICY IF EXISTS "Admins and operators can manage venda_documentos" ON public.venda_documentos;
CREATE POLICY "Authorized roles can view venda_documentos"
ON public.venda_documentos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));
CREATE POLICY "Admins and operators can manage venda_documentos"
ON public.venda_documentos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));

-- Fix profiles: prevent self privilege escalation by blocking updates to is_approved/is_active
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND is_approved IS NOT DISTINCT FROM (SELECT is_approved FROM public.profiles WHERE id = auth.uid())
  AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM public.profiles WHERE id = auth.uid())
);

-- Fix parcelas_controle: restrict to authenticated ADMIN/OPERADOR
DROP POLICY IF EXISTS "Authenticated can view parcelas_controle" ON public.parcelas_controle;
DROP POLICY IF EXISTS "Admins and operators can manage parcelas_controle" ON public.parcelas_controle;
CREATE POLICY "Authorized roles can view parcelas_controle"
ON public.parcelas_controle FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));
CREATE POLICY "Admins and operators can manage parcelas_controle"
ON public.parcelas_controle FOR ALL TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));
