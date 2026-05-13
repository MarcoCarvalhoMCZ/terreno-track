CREATE OR REPLACE FUNCTION public.tg_configuracoes_protect_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.razao_social_proprietaria       IS DISTINCT FROM OLD.razao_social_proprietaria
  OR NEW.cnpj_proprietaria               IS DISTINCT FROM OLD.cnpj_proprietaria
  OR NEW.crc_rs_proprietaria             IS DISTINCT FROM OLD.crc_rs_proprietaria
  OR NEW.cidade_uf_proprietaria          IS DISTINCT FROM OLD.cidade_uf_proprietaria
  OR NEW.telefone_proprietaria           IS DISTINCT FROM OLD.telefone_proprietaria
  OR NEW.email_proprietaria              IS DISTINCT FROM OLD.email_proprietaria
  OR NEW.logotipo_url                    IS DISTINCT FROM OLD.logotipo_url
  OR NEW.data_criacao_app                IS DISTINCT FROM OLD.data_criacao_app
  OR NEW.desenvolvedor_analista          IS DISTINCT FROM OLD.desenvolvedor_analista
  OR NEW.vendedor_pessoa_id              IS DISTINCT FROM OLD.vendedor_pessoa_id
  OR NEW.representante_legal_pessoa_id   IS DISTINCT FROM OLD.representante_legal_pessoa_id
  OR NEW.representante_legal_2_pessoa_id IS DISTINCT FROM OLD.representante_legal_2_pessoa_id
  OR NEW.padrao_corretor_pessoa_id       IS DISTINCT FROM OLD.padrao_corretor_pessoa_id
  OR NEW.padrao_percentual_corretagem    IS DISTINCT FROM OLD.padrao_percentual_corretagem
  OR NEW.observacoes                     IS DISTINCT FROM OLD.observacoes
  THEN
    RAISE EXCEPTION 'Acesso negado: estes campos são exclusivos do Administrador.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_admin_fields_configuracoes ON public.configuracoes;
CREATE TRIGGER protect_admin_fields_configuracoes
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.tg_configuracoes_protect_admin_fields();

ALTER POLICY "Admins can manage configuracoes" ON public.configuracoes
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'OPERADOR'::app_role));