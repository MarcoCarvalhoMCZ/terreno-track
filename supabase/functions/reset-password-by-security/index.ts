import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, cpf, data_nascimento, resposta_seguranca, nova_senha } = await req.json();

    if (!email || !nova_senha) {
      return new Response(
        JSON.stringify({ error: "E-mail e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const authUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Dados de verificação não conferem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profile with security fields
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("cpf, data_nascimento, pergunta_seguranca, resposta_seguranca")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Dados de verificação não conferem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check that at least one security field is configured
    const hasSecurityData = profile.cpf || profile.data_nascimento || profile.resposta_seguranca;
    if (!hasSecurityData) {
      return new Response(
        JSON.stringify({ error: "Recuperação de senha não configurada para este usuário. Contate o administrador." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all configured fields
    let valid = true;

    if (profile.cpf) {
      const cleanProfileCpf = (profile.cpf || "").replace(/\D/g, "");
      const cleanInputCpf = (cpf || "").replace(/\D/g, "");
      if (cleanProfileCpf !== cleanInputCpf) valid = false;
    }

    if (profile.data_nascimento) {
      if (profile.data_nascimento !== data_nascimento) valid = false;
    }

    if (profile.resposta_seguranca) {
      const normalizedProfile = (profile.resposta_seguranca || "").trim().toLowerCase();
      const normalizedInput = (resposta_seguranca || "").trim().toLowerCase();
      if (normalizedProfile !== normalizedInput) valid = false;
    }

    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Dados de verificação não conferem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: nova_senha }
    );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Senha alterada com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
