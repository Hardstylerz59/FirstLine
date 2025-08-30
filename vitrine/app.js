// =========================
// Helpers UI
// =========================
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (el, txt) => {
  if (el) el.textContent = txt ?? "";
};
const show = (el) => el?.classList.remove("hidden");
const hide = (el) => el?.classList.add("hidden");

// Ouvre immédiatement le jeu (évite les popups bloqués)
function openGameImmediate() {
  const href = window.GAME_RELATIVE_URL || "../game/index.html";
  const win = window.open(href, "_blank", "noopener");
  if (!win) {
    // Fallback si le navigateur bloque quand même
    window.location.href = href;
  }
}

// =========================
/* Supabase (même projet que le jeu)
   Nécessite vitrine/authConfig.js avec:
   window.SUPABASE_URL = "https://xxx.supabase.co";
   window.SUPABASE_KEY = "ANON_KEY"; */
// =========================
if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
  console.error(
    "⚠️ Configure SUPABASE_URL / SUPABASE_KEY dans vitrine/authConfig.js"
  );
}
const sb = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_KEY,
  {
    auth: { persistSession: true, autoRefreshToken: true },
  }
);

// =========================
// DOM
// =========================
const yearEl = $("#year");
const sectionStats = $("#stats");

const statKm = $("#statKm");
const statInterventions = $("#statInterventions");
const statVehicles = $("#statVehicles");
const statHours = $("#statHours");
const savesList = $("#savesList");

const loginForm = $("#loginForm");
const authMsg = $("#authMsg");
const pseudoInput = $("#pseudo");
const emailInput = $("#email");
const passInput = $("#password");

const userBox = $("#userBox");
const userName = $("#userName");
const userEmail = $("#userEmail");
const logoutBtn = $("#logout");
const playNowBtn = $("#playNow");

const launchTop = $("#launchTop");
const launchHero = $("#launchHero");
const launchBottom = $("#launchBottom");
const playNowTop = $("#playNowTop");

// =========================
// UI state
// =========================
function displayUser(user) {
  if (!user) {
    hide(sectionStats);
    hide(userBox);
    show(loginForm);
    return;
  }
  const pseudo =
    user.user_metadata?.pseudo ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Joueur";
  setText(userName, pseudo);
  setText(userEmail, user.email || "");
  hide(loginForm);
  show(userBox);
  show(sectionStats);
}

async function currentUser() {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user || null;
}

// =========================
// Stats loading helpers
// =========================
function clearSkeleton() {
  [statKm, statInterventions, statVehicles, statHours].forEach((el) =>
    el?.classList.remove("skeleton")
  );
}
function setSkeleton() {
  [statKm, statInterventions, statVehicles, statHours].forEach((el) =>
    el?.classList.add("skeleton")
  );
}
function readNested(obj, paths, fallback = null) {
  for (const p of paths) {
    const val = p
      .split(".")
      .reduce(
        (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
        obj
      );
    if (val !== undefined && val !== null) return val;
  }
  return fallback;
}

// 1) Vue recommandée: player_stats (user_id, total_km, interventions_count, vehicles_count, hours_played)
async function fetchStatsFromView(userId) {
  const { data, error } = await sb
    .from("player_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    km: data.total_km ?? data.kilometers ?? 0,
    interventions: data.interventions_count ?? data.missions_count ?? 0,
    vehicles: data.vehicles_count ?? data.fleet_count ?? 0,
    hours:
      data.hours_played ??
      (data.play_time_minutes ? data.play_time_minutes / 60 : 0),
  };
}

// 2) Reconstruit via tables probables (vehicles / interventions / profiles)
async function fetchStatsFromTables(userId) {
  const tryCount = async (table, field = "user_id") => {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(field, userId);
    if (error) return null;
    return count ?? null;
  };

  const vehCount =
    (await tryCount("vehicles")) ??
    (await tryCount("player_vehicles")) ??
    (await tryCount("fleet")) ??
    0;

  const intCount =
    (await tryCount("interventions")) ?? (await tryCount("missions")) ?? 0;

  let hours = 0,
    km = 0;
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("hours_played, total_km")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      hours = profile.hours_played ?? hours;
      km = profile.total_km ?? km;
    }
  } catch {}

  return { km, interventions: intCount, vehicles: vehCount, hours };
}

// 3) Sinon, lit la dernière sauvegarde pour en déduire des stats
async function fetchStatsFromLatestSave(userId) {
  const { data, error } = await sb
    .from("saves")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data || !data[0]) return null;

  const save = data[0];
  const km = readNested(
    save,
    ["stats.total_km", "stats.km", "totals.km", "telemetry.km"],
    0
  );
  const interventions = readNested(
    save,
    ["stats.interventions", "totals.interventions", "missions.completed"],
    0
  );
  const vehicles = readNested(
    save,
    ["stats.vehicles", "fleet.count", "vehicles.length"],
    0
  );
  const hours = readNested(
    save,
    ["stats.hours", "play_time_hours", "play_time_minutes"],
    0
  );

  return {
    km: km || 0,
    interventions: interventions || 0,
    vehicles: vehicles || 0,
    hours: typeof hours === "number" ? (hours > 300 ? hours / 60 : hours) : 0, // minutes -> heures si besoin
  };
}

async function loadPlayerStats(user) {
  if (!user) return;
  setSkeleton();

  let stats = null;
  try {
    stats = await fetchStatsFromView(user.id);
  } catch {}
  if (!stats) {
    try {
      stats = await fetchStatsFromTables(user.id);
    } catch {}
  }
  if (!stats) {
    try {
      stats = await fetchStatsFromLatestSave(user.id);
    } catch {}
  }
  if (!stats) stats = { km: 0, interventions: 0, vehicles: 0, hours: 0 };

  setText(statKm, new Intl.NumberFormat("fr-FR").format(Math.round(stats.km)));
  setText(
    statInterventions,
    new Intl.NumberFormat("fr-FR").format(stats.interventions)
  );
  setText(statVehicles, new Intl.NumberFormat("fr-FR").format(stats.vehicles));
  setText(
    statHours,
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      stats.hours || 0
    )
  );

  clearSkeleton();
}

async function loadRecentSaves(user) {
  if (!user || !savesList) return;
  savesList.innerHTML = "";
  try {
    let { data, error } = await sb
      .from("saves")
      .select("id, name, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(3);
    if (error) throw error;
    if (!data || data.length === 0) {
      const alt = await sb
        .from("saves")
        .select("id, name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      data = alt.data || [];
    }
    if (data.length === 0) {
      savesList.innerHTML = `<li><span class="meta">Aucune sauvegarde pour le moment.</span></li>`;
      return;
    }
    const fmt = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "—");
    data.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="meta"><strong>${s.name || "Sauvegarde"}</strong></div>
        <div class="date">${fmt(s.updated_at || s.created_at)}</div>
      `;
      savesList.appendChild(li);
    });
  } catch {
    savesList.innerHTML = `<li><span class="meta">Impossible de charger les sauvegardes.</span></li>`;
  }
}

// =========================
// Auth events
// =========================
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText(authMsg, "Connexion…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setText(authMsg, "Connecté !");
    const user = data.user;
    displayUser(user);
    await loadPlayerStats(user);
    await loadRecentSaves(user);
  } catch (err) {
    setText(authMsg, err?.message || "Erreur de connexion");
    authMsg.style.color = "#b91c1c";
  }
});

$("#btnSignUp")?.addEventListener("click", async () => {
  setText(authMsg, "Création du compte…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const pseudo = pseudoInput.value.trim();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { pseudo }, emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    if (!data.user) {
      setText(authMsg, "Compte créé. Vérifiez votre email pour valider.");
    } else {
      setText(authMsg, "Compte créé et connecté !");
      displayUser(data.user);
      await loadPlayerStats(data.user);
      await loadRecentSaves(data.user);
    }
  } catch (err) {
    setText(authMsg, err?.message || "Erreur à l'inscription");
    authMsg.style.color = "#b91c1c";
  }
});

$("#btnMagic")?.addEventListener("click", async () => {
  setText(authMsg, "Envoi du lien magique…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    setText(authMsg, "Lien envoyé. Vérifiez votre boîte mail.");
  } catch (err) {
    setText(authMsg, err?.message || "Erreur lors de l’envoi");
    authMsg.style.color = "#b91c1c";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();
  displayUser(null);
});

// =========================
// Lancement du jeu — OUVERTURE IMMÉDIATE
// =========================
[launchTop, launchHero, launchBottom, playNowBtn, playNowTop].forEach((btn) => {
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    openGameImmediate(); // pas d'await → pas de popup bloqué
  });
});

// =========================
// Init
// =========================
yearEl && (yearEl.textContent = new Date().getFullYear());

// Met à jour l'UI et charge les stats à chaque changement de session
sb.auth.onAuthStateChange(async (_e, session) => {
  const user = session?.user || null;
  displayUser(user);
  if (user) {
    await loadPlayerStats(user);
    await loadRecentSaves(user);
  }
});

// Premier rendu
(async () => {
  const user = await currentUser();
  displayUser(user);
  if (user) {
    await loadPlayerStats(user);
    await loadRecentSaves(user);
  }
})();
