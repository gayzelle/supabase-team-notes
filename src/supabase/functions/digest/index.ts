import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
const supabase = createClient(
Deno.env.get("SUPABASE_URL")!,
Deno.env.get("SUPABASE_ANON_KEY")!,
{ global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
);

const { data: { user } } = await supabase.auth.getUser();
if (!user) return new Response("Unauthorized", { status: 401 });

const { count, error } = await supabase
.from("memberships")
.select("org_id", { count: "exact", head: true });

if (error) return new Response(error.message, { status: 500 });

return new Response(JSON.stringify({ user_id: user.id, orgs_count: count }), {
headers: { "content-type": "application/json" },
});
});
