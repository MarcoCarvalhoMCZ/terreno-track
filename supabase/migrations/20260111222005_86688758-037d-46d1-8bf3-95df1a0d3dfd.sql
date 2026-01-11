-- Criar tabela de permissões de menu por usuário
CREATE TABLE public.user_menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    UNIQUE (user_id, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: apenas ADMIN pode gerenciar, usuários podem ver suas próprias permissões
CREATE POLICY "Admins can manage all permissions"
ON public.user_menu_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users can view own permissions"
ON public.user_menu_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Atualizar a tabela profiles para ter is_approved (apenas ADMIN cria usuários)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Comentário na coluna
COMMENT ON COLUMN public.profiles.is_approved IS 'Se o usuário foi aprovado pelo ADMIN para usar o sistema';