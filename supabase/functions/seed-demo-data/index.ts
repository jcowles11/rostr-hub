import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRST_NAMES = ["James","John","Robert","Michael","David","William","Chris","Daniel","Matt","Andrew","Tyler","Ryan","Josh","Nathan","Brandon","Kyle","Austin","Cody","Dylan","Jake","Caleb","Ethan","Hunter","Logan","Mason","Noah","Owen","Liam","Jack","Cole","Carter","Luke","Bryce","Tanner","Colton","Gavin","Nolan","Wyatt","Chase","Blake","Derek","Marcus","Jayden","Jordan","Cameron","Trevor","Brayden","Grant","Brady","Reid","Zach","Dustin","Brody","Landon","Tucker","Spencer","Dalton","Preston","Jared","Alex","Trey","Cade","Jaxon","Kaden","Hayden","Parker"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","White","Harris","Clark","Lewis","Robinson","Walker","Young","King","Wright","Scott","Torres","Hill","Green","Adams","Baker","Nelson","Carter","Mitchell","Perez","Roberts","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart","Reed","Morris","Morgan","Cooper","Peterson","Bailey","Rivera","Cox","Howard","Ward","Diaz","Murphy"];
const POSITIONS = ["P","C","1B","2B","3B","SS","LF","CF","RF","DH","UTIL"];
const STATES = ["CA","TX","FL","GA","NC","AZ","OH","IL","PA","NY","TN","AL","SC","LA","VA","MO","OK","AR","MS","KS","IN","MI","WI","MN","IA","NE","CO","WA","OR"];
const CITIES = ["Austin","Dallas","Houston","Atlanta","Charlotte","Phoenix","Orlando","Tampa","Nashville","Birmingham","Columbia","Baton Rouge","Richmond","Kansas City","Oklahoma City","Little Rock","Jackson","Indianapolis","Detroit","Milwaukee","Minneapolis","Des Moines","Omaha","Denver","Seattle","Portland","San Diego","Sacramento","Raleigh","Memphis"];
const SCHOOLS = ["Central High","Westfield Academy","Lincoln Prep","Eastside High","Heritage Academy","Summit High","Riverside High","Valley View","Oakwood Academy","Crestwood High","Northpoint","Southlake Academy","Lakewood High","Mountain View","Parkside High"];
const ORGS = ["Thunder Baseball","Elite Prospects Academy","Diamond Club","Premier Baseball","Blue Chip Athletics","National Select"];
const PROGRAM_NAMES = ["Varsity Program","Travel Select","Elite Showcase","Academy Training","Competition Squad","All-Star Circuit"];
const COMMITTED_SCHOOLS = ["University of Texas","LSU","Florida State","Vanderbilt","UCLA","Stanford","Arizona State","TCU","Virginia","Ole Miss","Georgia Tech","NC State","Clemson","Oklahoma State","Oregon State","Cal State Fullerton","Miami","Arkansas","Mississippi State","South Carolina"];
const EVALUATOR_NAMES = ["Mark Stevens","Tom Bradley","Rick Gonzalez"];
const EVALUATOR_ORGS = ["Perfect Game","Prep Baseball Report","PBR Georgia"];
const SCOUT_NAMES = ["Sarah Mitchell","Dave Thompson","Jim Rodriguez","Karen Liu","Pat O'Brien","Laura Sanchez"];
const SCOUT_ORGS = ["University of Texas","LSU","Florida State","Vanderbilt","UCLA","Stanford"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDec(min: number, max: number, decimals = 2) { return +(Math.random() * (max - min) + min).toFixed(decimals); }

const POST_TYPES = ["highlight", "workout", "commitment", "update"];
const CAPTIONS_BY_TYPE: Record<string, string[]> = {
  highlight: [
    "💪 Check out this at-bat from last weekend's showcase!",
    "🔥 Nasty slider in the dirt. K #3 on the day.",
    "Line drive gap shot — 2 RBI double 🙌",
    "Ripped one to left-center. Best swing of the fall.",
    "Walk-off single to win the championship! 🏆",
    "Bullpen session looking filthy today 🔥",
  ],
  workout: [
    "60-yard time dropping! New PR today 💨",
    "Velo is up 3 mph from last month 📈",
    "Exit velo off the tee: 94 mph. Grind don't stop.",
    "Heavy legs day + sprint work. Building for spring.",
    "Morning lift + cage work. Consistency > everything.",
    "New squat PR — 315 lbs at 175 BW 💪",
  ],
  commitment: [
    "Blessed to announce my commitment to play baseball at {school}! 🎓⚾️",
    "Dream come true — officially committed to {school}! Let's go! 🔵🟡",
    "After a lot of prayer and hard work, I'm proud to commit to {school} ⚾️",
  ],
  update: [
    "Getting ready for fall ball season 🍂⚾️",
    "Great team practice today. Energy was unreal.",
    "Thankful for another day on the diamond.",
    "Showcase season is here. Time to compete.",
    "Off-season grind is paying off. Can't wait for spring.",
    "Grateful for the coaching staff pushing me every day 🙏",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check if already seeded
    const { count } = await admin.from("players").select("id", { count: "exact", head: true });
    if ((count || 0) > 100) {
      return new Response(JSON.stringify({ message: "Already seeded — found " + count + " players" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create demo organization
    const demoUserId = (await admin.auth.getUser((req.headers.get("Authorization") || "").replace("Bearer ", ""))).data.user?.id;
    if (!demoUserId) throw new Error("Must be authenticated");

    const { data: org } = await admin.from("organizations").insert({
      name: "Rostr Demo Org",
      created_by: demoUserId,
    }).select().single();

    // 2) Create 6 programs
    const programInserts = PROGRAM_NAMES.map((name, i) => ({
      name,
      school_name: SCHOOLS[i],
      organization_id: org!.id,
      created_by: demoUserId,
      sport: "baseball",
    }));
    const { data: programs } = await admin.from("programs").insert(programInserts).select();

    // 3) Create coach records for current user on first program + 9 more fake coaches
    const coachInserts: any[] = [{
      user_id: demoUserId,
      program_id: programs![0].id,
      full_name: "Demo Coach",
      email: "demo@rostr.app",
      role: "head_coach",
    }];
    // Add org member for demo user
    await admin.from("organization_members").insert({
      user_id: demoUserId,
      organization_id: org!.id,
      program_id: programs![0].id,
      role: "admin",
      full_name: "Demo Coach",
      email: "demo@rostr.app",
    });

    // Create fake coach auth users for other programs
    for (let i = 1; i < 6; i++) {
      const email = `coach${i}@demo.rostr.app`;
      const { data: authUser } = await admin.auth.admin.createUser({
        email,
        password: "demo1234",
        email_confirm: true,
        user_metadata: { account_type: "coach" },
      });
      if (authUser?.user) {
        coachInserts.push({
          user_id: authUser.user.id,
          program_id: programs![i].id,
          full_name: `Coach ${FIRST_NAMES[i + 10]} ${LAST_NAMES[i + 10]}`,
          email,
          role: "head_coach",
        });
        await admin.from("organization_members").insert({
          user_id: authUser.user.id,
          organization_id: org!.id,
          program_id: programs![i].id,
          role: "admin",
          full_name: `Coach ${FIRST_NAMES[i + 10]} ${LAST_NAMES[i + 10]}`,
          email,
        });
      }
    }
    const { data: coaches } = await admin.from("coaches").insert(coachInserts).select();

    // 4) Create 150 players distributed across programs + 15 independent
    const playerInserts: any[] = [];
    for (let i = 0; i < 165; i++) {
      const isIndependent = i >= 150;
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const suffix = i >= FIRST_NAMES.length ? `${Math.floor(i / FIRST_NAMES.length)}` : "";
      const gradYear = rand(2025, 2029);
      const isCommitted = !isIndependent && i < 25;
      const committedSchool = isCommitted ? pick(COMMITTED_SCHOOLS) : null;

      playerInserts.push({
        first_name: firstName + suffix,
        last_name: lastName,
        program_id: isIndependent ? null : programs![i % 6].id,
        positions: pickN(POSITIONS, rand(1, 3)),
        graduation_year: gradYear,
        grade: Math.max(9, Math.min(12, 12 - (gradYear - 2026))),
        height: `${rand(5, 6)}'${rand(0, 11)}"`,
        weight: rand(140, 220),
        bats: pick(["R", "L", "S"]),
        throws: pick(["R", "L"]),
        gpa: randDec(2.5, 4.0).toString(),
        city: pick(CITIES),
        state: pick(STATES),
        high_school: pick(SCHOOLS),
        profile_public: i < 125 || isIndependent,
        show_contact_info: Math.random() > 0.3,
        highlight_video_url: i < 50 ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
        social_instagram: i < 80 ? `@${firstName.toLowerCase()}${lastName.toLowerCase()}${rand(1, 99)}` : null,
        social_twitter: i < 80 ? `@${firstName.toLowerCase()}_${rand(1, 99)}` : null,
        photo_url: `https://api.dicebear.com/7.x/initials/svg?seed=${firstName}+${lastName}`,
        recruiting_status: isCommitted ? "committed" : "uncommitted",
        committed_school_name: committedSchool,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@demo.rostr.app`,
      });
    }
    const { data: players } = await admin.from("players").insert(playerInserts).select("id, program_id, first_name, last_name, recruiting_status, committed_school_name");

    // 5) Create a player record for demo user (for player role switching)
    const { data: demoPlayer } = await admin.from("players").insert({
      first_name: "Demo",
      last_name: "Player",
      user_id: demoUserId,
      program_id: programs![0].id,
      positions: ["SS", "2B"],
      graduation_year: 2026,
      grade: 11,
      height: "5'11\"",
      weight: 175,
      bats: "R",
      throws: "R",
      gpa: "3.8",
      city: "Austin",
      state: "TX",
      profile_public: true,
      show_contact_info: true,
      photo_url: `https://api.dicebear.com/7.x/initials/svg?seed=Demo+Player`,
      recruiting_status: "uncommitted",
      email: "demo@rostr.app",
    }).select().single();

    // 6) Create scout record for demo user
    await admin.from("scouts").insert({
      user_id: demoUserId,
      full_name: "Demo Scout",
      organization_name: "Demo University",
    });

    // Create 5 more scout accounts
    for (let i = 0; i < 5; i++) {
      const email = `scout${i}@demo.rostr.app`;
      const { data: authUser } = await admin.auth.admin.createUser({
        email,
        password: "demo1234",
        email_confirm: true,
        user_metadata: { account_type: "scout" },
      });
      if (authUser?.user) {
        await admin.from("scouts").insert({
          user_id: authUser.user.id,
          full_name: SCOUT_NAMES[i + 1] || `Scout ${i}`,
          organization_name: SCOUT_ORGS[i + 1] || "University",
        });
      }
    }

    // 7) Create evaluator record for demo user
    await admin.from("evaluators").insert({
      user_id: demoUserId,
      full_name: "Demo Evaluator",
      organization_name: "Perfect Game",
      sport: "baseball",
      verified: true,
    });

    // Create 2 more evaluators
    const evalIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const email = `evaluator${i}@demo.rostr.app`;
      const { data: authUser } = await admin.auth.admin.createUser({
        email,
        password: "demo1234",
        email_confirm: true,
        user_metadata: { account_type: "evaluator" },
      });
      if (authUser?.user) {
        const { data: ev } = await admin.from("evaluators").insert({
          user_id: authUser.user.id,
          full_name: EVALUATOR_NAMES[i + 1] || `Evaluator ${i}`,
          organization_name: EVALUATOR_ORGS[i + 1] || "PBR",
          sport: "baseball",
          verified: i === 0,
        }).select().single();
        if (ev) evalIds.push(ev.id);
      }
    }

    // 8) Create metrics for each program
    const METRIC_DEFS = [
      { name: "60-Yard Dash", unit: "sec", metric_type: "timed", category: "running" },
      { name: "Fastball Velo", unit: "mph", metric_type: "measured", category: "pitching" },
      { name: "Exit Velo", unit: "mph", metric_type: "measured", category: "hitting" },
      { name: "Fielding Rating", unit: "pts", metric_type: "rated", category: "fielding" },
      { name: "Pop Time", unit: "sec", metric_type: "timed", category: "fielding" },
      { name: "Home to 1st", unit: "sec", metric_type: "timed", category: "running" },
    ];

    const allMetrics: any[] = [];
    for (const prog of programs!) {
      const metricInserts = METRIC_DEFS.map((m, idx) => ({
        program_id: prog.id,
        name: m.name,
        unit: m.unit,
        metric_type: m.metric_type,
        category: m.category,
        sort_order: idx,
        max_attempts: 3,
        visible_to_players: true,
      }));
      const { data: metrics } = await admin.from("metrics").insert(metricInserts).select();
      if (metrics) allMetrics.push(...metrics.map(m => ({ ...m, programId: prog.id })));
    }

    // 9) Create tryout sessions + evaluations
    for (const prog of programs!) {
      const { data: session } = await admin.from("tryout_sessions").insert({
        program_id: prog.id,
        name: "Fall Tryout 2025",
        session_date: "2025-10-15",
      }).select().single();

      const progPlayers = players!.filter(p => p.program_id === prog.id);
      const progMetrics = allMetrics.filter(m => m.programId === prog.id);
      const progCoach = coaches!.find(c => c.program_id === prog.id);

      if (progCoach && session) {
        const evalInserts: any[] = [];
        for (const player of progPlayers) {
          for (const metric of progMetrics) {
            const val = metric.metric_type === "timed"
              ? randDec(1.5, 8.0)
              : metric.metric_type === "rated"
                ? rand(40, 95)
                : randDec(55, 98);
            evalInserts.push({
              program_id: prog.id,
              player_id: player.id,
              metric_id: metric.id,
              coach_id: progCoach.id,
              session_id: session.id,
              value: val,
              attempt_number: 1,
            });
          }
        }
        if (evalInserts.length > 0) {
          // Batch in chunks of 500
          for (let i = 0; i < evalInserts.length; i += 500) {
            await admin.from("evaluations").insert(evalInserts.slice(i, i + 500));
          }
        }
      }
    }

    // 10) Evaluator entries for independent players
    const independentPlayers = players!.filter(p => !p.program_id);
    const EVAL_METRICS = [
      { name: "60-Yard Dash", unit: "sec", type: "timed" },
      { name: "Fastball Velo", unit: "mph", type: "measured" },
      { name: "Exit Velo", unit: "mph", type: "measured" },
      { name: "Fielding Rating", unit: "pts", type: "rated" },
      { name: "Pop Time", unit: "sec", type: "timed" },
      { name: "Arm Strength", unit: "mph", type: "measured" },
      { name: "Bat Speed", unit: "mph", type: "measured" },
      { name: "Sprint Speed", unit: "sec", type: "timed" },
    ];

    // Get demo user's evaluator id
    const { data: demoEval } = await admin.from("evaluators").select("id").eq("user_id", demoUserId).single();
    const allEvalIds = demoEval ? [demoEval.id, ...evalIds] : evalIds;

    const evalEntryInserts: any[] = [];
    for (const player of independentPlayers) {
      const evalId = pick(allEvalIds);
      const metricsToUse = pickN(EVAL_METRICS, rand(6, 8));
      for (const m of metricsToUse) {
        evalEntryInserts.push({
          evaluator_id: evalId,
          player_id: player.id,
          metric_name: m.name,
          metric_unit: m.unit,
          metric_type: m.type,
          metric_value: m.type === "timed" ? randDec(1.5, 8.0) : randDec(55, 98),
          event_name: pick(["Fall Showcase 2025", "PG National", "PBR State Games", "Area Code Games"]),
          event_date: "2025-09-15",
        });
      }
    }
    // Also add evaluator entries for some program players
    for (let i = 0; i < 30; i++) {
      const player = players![i];
      const evalId = pick(allEvalIds);
      const metricsToUse = pickN(EVAL_METRICS, rand(3, 5));
      for (const m of metricsToUse) {
        evalEntryInserts.push({
          evaluator_id: evalId,
          player_id: player.id,
          metric_name: m.name,
          metric_unit: m.unit,
          metric_type: m.type,
          metric_value: m.type === "timed" ? randDec(1.5, 8.0) : randDec(55, 98),
          event_name: pick(["Fall Showcase 2025", "PG National"]),
          event_date: "2025-10-01",
        });
      }
    }
    for (let i = 0; i < evalEntryInserts.length; i += 500) {
      await admin.from("evaluator_entries").insert(evalEntryInserts.slice(i, i + 500));
    }

    // 11) Create social posts
    const postInserts: any[] = [];
    for (let i = 0; i < players!.length && i < 125; i++) {
      const player = players![i];
      const numPosts = i < 60 ? rand(5, 8) : rand(2, 3);
      for (let j = 0; j < numPosts; j++) {
        const type = pick(POST_TYPES);
        let caption = pick(CAPTIONS_BY_TYPE[type]);
        if (type === "commitment" && player.committed_school_name) {
          caption = caption.replace("{school}", player.committed_school_name);
        } else if (type === "commitment") {
          caption = pick(CAPTIONS_BY_TYPE["update"]);
        }
        const daysAgo = rand(0, 90);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        postInserts.push({
          author_id: demoUserId, // All posts authored by demo user for RLS simplicity
          player_id: player.id,
          post_type: type === "commitment" && !player.committed_school_name ? "update" : type,
          caption,
          sport: "baseball",
          created_at: date.toISOString(),
        });
      }
    }
    for (let i = 0; i < postInserts.length; i += 500) {
      await admin.from("posts").insert(postInserts.slice(i, i + 500));
    }

    const summary = {
      message: "Demo data seeded successfully!",
      counts: {
        players: players!.length + 1, // +1 for demo player
        programs: programs!.length,
        coaches: coaches!.length,
        posts: postInserts.length,
        evaluator_entries: evalEntryInserts.length,
        scouts: 6,
        evaluators: 3,
      },
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
