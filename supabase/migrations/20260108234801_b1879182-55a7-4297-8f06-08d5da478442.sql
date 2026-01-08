-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'OPERADOR', 'CONSULTA');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4. Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create pessoas table (unified PF/PJ)
CREATE TABLE public.pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT CHECK (tipo IN ('PF', 'PJ')) NOT NULL,
  nome_razao TEXT NOT NULL,
  cpf_cnpj TEXT UNIQUE,
  rg_ie TEXT,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 6. Create enderecos table
CREATE TABLE public.enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID REFERENCES public.pessoas(id) ON DELETE CASCADE,
  tipo TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  principal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 7. Create modos_pagamento table
CREATE TABLE public.modos_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 8. Create contas_recebimento_vendedor table
CREATE TABLE public.contas_recebimento_vendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  modo_pagamento_id UUID REFERENCES public.modos_pagamento(id),
  detalhes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 9. Create configuracoes table
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_pessoa_id UUID REFERENCES public.pessoas(id),
  representante_legal_pessoa_id UUID REFERENCES public.pessoas(id),
  padrao_corretor_pessoa_id UUID REFERENCES public.pessoas(id),
  padrao_percentual_corretagem NUMERIC(9,4),
  data_criacao_app DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 10. Create indicadores_atualizacao table
CREATE TABLE public.indicadores_atualizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  regra TEXT,
  periodicidade TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 11. Create indicadores_atualizacao_valores table
CREATE TABLE public.indicadores_atualizacao_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id UUID REFERENCES public.indicadores_atualizacao(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  fator NUMERIC(18,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 12. Create lotes table (estoque)
CREATE TABLE public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra TEXT NOT NULL,
  numero_lote TEXT NOT NULL,
  matricula_ri TEXT,
  area_m2 NUMERIC(18,4),
  custo_contabil NUMERIC(18,2),
  etiqueta_patrimonial TEXT,
  status TEXT CHECK (status IN ('DISPONIVEL', 'RESERVADO', 'VENDIDO', 'CANCELADO')) DEFAULT 'DISPONIVEL',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (quadra, numero_lote)
);

-- 13. Create vendas table
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) NOT NULL,
  data_venda DATE NOT NULL,
  vendedor_pessoa_id UUID REFERENCES public.pessoas(id),
  comprador_pessoa_id UUID REFERENCES public.pessoas(id) NOT NULL,
  corretor_pessoa_id UUID REFERENCES public.pessoas(id),
  percentual_corretagem NUMERIC(9,4),
  valor_venda NUMERIC(18,2) NOT NULL,
  valor_arras NUMERIC(18,2),
  indicador_atualizacao_id UUID REFERENCES public.indicadores_atualizacao(id),
  conta_recebimento_vendedor_id UUID REFERENCES public.contas_recebimento_vendedor(id),
  status TEXT CHECK (status IN ('ATIVA', 'QUITADA', 'INADIMPLENTE', 'CANCELADA')) DEFAULT 'ATIVA',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 14. Create planos_pagamento table
CREATE TABLE public.planos_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('PARCELAMENTO', 'REFORCO')) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 15. Create parcelas table
CREATE TABLE public.parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES public.planos_pagamento(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor_principal NUMERIC(18,2) NOT NULL,
  valor_atualizado NUMERIC(18,2),
  status TEXT CHECK (status IN ('ABERTA', 'PAGA', 'CANCELADA')) DEFAULT 'ABERTA',
  data_pagamento DATE,
  valor_pago NUMERIC(18,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 16. Create conta_corrente_lote table
CREATE TABLE public.conta_corrente_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) NOT NULL,
  venda_id UUID REFERENCES public.vendas(id),
  data_mov DATE NOT NULL,
  tipo_mov TEXT CHECK (tipo_mov IN ('VENDA', 'ARRAS', 'PARCELA', 'REFORCO', 'JUROS', 'MULTA', 'ATUALIZACAO', 'DESCONTO', 'ESTORNO', 'OUTROS')) NOT NULL,
  descricao TEXT,
  debito NUMERIC(18,2) DEFAULT 0,
  credito NUMERIC(18,2) DEFAULT 0,
  saldo NUMERIC(18,2),
  referencia TEXT,
  vencimento DATE,
  percentual_calculo NUMERIC(9,6),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 17. Create contas_contabeis table
CREATE TABLE public.contas_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 18. Create eventos_contabeis table
CREATE TABLE public.eventos_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 19. Create eventos_contabeis_itens table
CREATE TABLE public.eventos_contabeis_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID REFERENCES public.eventos_contabeis(id) ON DELETE CASCADE,
  conta_contabil_id UUID REFERENCES public.contas_contabeis(id),
  dc TEXT CHECK (dc IN ('D', 'C')) NOT NULL,
  historico_padrao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id)
);

-- 20. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modos_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_recebimento_vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_atualizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_atualizacao_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_corrente_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_contabeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_contabeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_contabeis_itens ENABLE ROW LEVEL SECURITY;

-- 21. Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

-- 22. Create RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

-- 23. Create RLS policies for data tables (authenticated users can read, ADMIN/OPERADOR can write)
CREATE POLICY "Authenticated can view pessoas" ON public.pessoas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage pessoas" ON public.pessoas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view enderecos" ON public.enderecos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage enderecos" ON public.enderecos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view modos_pagamento" ON public.modos_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage modos_pagamento" ON public.modos_pagamento FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view contas_recebimento_vendedor" ON public.contas_recebimento_vendedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage contas_recebimento_vendedor" ON public.contas_recebimento_vendedor FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage configuracoes" ON public.configuracoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Authenticated can view indicadores_atualizacao" ON public.indicadores_atualizacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage indicadores_atualizacao" ON public.indicadores_atualizacao FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view indicadores_atualizacao_valores" ON public.indicadores_atualizacao_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage indicadores_atualizacao_valores" ON public.indicadores_atualizacao_valores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view lotes" ON public.lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage lotes" ON public.lotes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view vendas" ON public.vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage vendas" ON public.vendas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view planos_pagamento" ON public.planos_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage planos_pagamento" ON public.planos_pagamento FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view parcelas" ON public.parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage parcelas" ON public.parcelas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view conta_corrente_lote" ON public.conta_corrente_lote FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage conta_corrente_lote" ON public.conta_corrente_lote FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view contas_contabeis" ON public.contas_contabeis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage contas_contabeis" ON public.contas_contabeis FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view eventos_contabeis" ON public.eventos_contabeis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage eventos_contabeis" ON public.eventos_contabeis FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

CREATE POLICY "Authenticated can view eventos_contabeis_itens" ON public.eventos_contabeis_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operators can manage eventos_contabeis_itens" ON public.eventos_contabeis_itens FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'OPERADOR'));

-- 24. Create trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  
  -- First user gets ADMIN role, others get CONSULTA
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'ADMIN');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CONSULTA');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 25. Create trigger for updating lote status on venda
CREATE OR REPLACE FUNCTION public.update_lote_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lotes SET status = 'VENDIDO', updated_at = now() WHERE id = NEW.lote_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'CANCELADA' THEN
    UPDATE public.lotes SET status = 'DISPONIVEL', updated_at = now() WHERE id = NEW.lote_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_venda_change
  AFTER INSERT OR UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_lote_on_venda();

-- 26. Create views for totalization
CREATE OR REPLACE VIEW public.vw_resumo_operacoes_lote AS
SELECT 
  l.id as lote_id,
  l.quadra,
  l.numero_lote,
  DATE_TRUNC('month', cc.data_mov)::DATE as competencia,
  COALESCE(SUM(cc.debito), 0) as total_debitos,
  COALESCE(SUM(cc.credito), 0) as total_creditos,
  COALESCE(SUM(cc.credito) - SUM(cc.debito), 0) as saldo_periodo
FROM public.lotes l
LEFT JOIN public.conta_corrente_lote cc ON l.id = cc.lote_id
GROUP BY l.id, l.quadra, l.numero_lote, DATE_TRUNC('month', cc.data_mov);

CREATE OR REPLACE VIEW public.vw_totalizacao_mensal_por_lote AS
SELECT 
  l.id as lote_id,
  l.quadra,
  l.numero_lote,
  DATE_TRUNC('month', cc.data_mov)::DATE as competencia,
  COALESCE(SUM(cc.debito), 0) as total_debitos,
  COALESCE(SUM(cc.credito), 0) as total_creditos,
  COALESCE(SUM(cc.credito) - SUM(cc.debito), 0) as saldo_final
FROM public.lotes l
LEFT JOIN public.conta_corrente_lote cc ON l.id = cc.lote_id
WHERE cc.data_mov IS NOT NULL
GROUP BY l.id, l.quadra, l.numero_lote, DATE_TRUNC('month', cc.data_mov)
ORDER BY competencia DESC, l.quadra, l.numero_lote;

CREATE OR REPLACE VIEW public.vw_totalizacao_mensal_consolidada AS
SELECT 
  DATE_TRUNC('month', data_mov)::DATE as competencia,
  COALESCE(SUM(debito), 0) as total_debitos,
  COALESCE(SUM(credito), 0) as total_creditos,
  COALESCE(SUM(credito) - SUM(debito), 0) as saldo_final
FROM public.conta_corrente_lote
WHERE data_mov IS NOT NULL
GROUP BY DATE_TRUNC('month', data_mov)
ORDER BY competencia DESC;

-- 27. Insert default modos_pagamento
INSERT INTO public.modos_pagamento (descricao) VALUES 
  ('PIX'),
  ('Transferência Bancária'),
  ('Boleto'),
  ('Cheque'),
  ('Dinheiro');

-- 28. Insert default indicador (sem atualização)
INSERT INTO public.indicadores_atualizacao (nome, descricao, regra, periodicidade) VALUES 
  ('Sem Atualização', 'Valores fixos sem correção monetária', 'Não há atualização dos valores', 'N/A'),
  ('INCC', 'Índice Nacional de Custo da Construção', 'Atualização mensal pela variação do INCC', 'Mensal'),
  ('IPCA', 'Índice de Preços ao Consumidor Amplo', 'Atualização mensal pela variação do IPCA', 'Mensal');