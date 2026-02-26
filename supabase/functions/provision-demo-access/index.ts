import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEMO_PROGRAM_ID = "7630ab83-389a-40bc-88aa-3a88bf7f7e69";
const DEMO_ORG_ID = "ce7b6250-598d-4b2e-b1dc-00be9588719d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { role, user_id } = await req.json();

    if (!role || !user_id) {
      return new Response(JSON.stringify({ error: "role and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (role === "coach") {
      // Check if coach record already exists for this user
      const { data: existing } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", user_id)
        .eq("program_id", DEMO_PROGRAM_ID)
        .maybeSingle();

      if (!existing) {
        await supabase.from("coaches").insert({
          user_id,
          program_id: DEMO_PROGRAM_ID,
          full_name: "Demo Coach",
          email: "demo@rostr.app",
          role: "head_coach",
        });
      }

      // Ensure organization_members record exists
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("organization_id", DEMO_ORG_ID)
        .maybeSingle();

      if (!existingMember) {
        await supabase.from("organization_members").insert({
          user_id,
          organization_id: DEMO_ORG_ID,
          program_id: DEMO_PROGRAM_ID,
          full_name: "Demo Coach",
          email: "demo@rostr.app",
          role: "admin",
        });
      }
    } else if (role === "player") {
      // Check if player record exists
      const { data: existing } = await supabase
        .from("players")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("players").insert({
          user_id,
          first_name: "Demo",
          last_name: "Player",
          program_id: DEMO_PROGRAM_ID,
          profile_public: true,
        });
      }
    } else if (role === "scout") {
      const { data: existing } = await supabase
        .from("scouts")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("scouts").insert({
          user_id,
          full_name: "Demo Scout",
          organization_name: "Demo University",
        });
      }
    } else if (role === "evaluator") {
      const { data: existing } = await supabase
        .from("evaluators")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("evaluators").insert({
          user_id,
          full_name: "Demo Evaluator",
          organization_name: "Demo Showcase",
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
