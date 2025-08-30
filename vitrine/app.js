// =========================
// Helpers UI
// =========================
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (el, txt) => {
  if (el) el.textContent = txt ?? "";
};
const show = (el) => el?.classList.remove("hidden");
const hide = (el) => el?.classList.add("hidden");

// Ouvre le jeu dans un nouvel onglet (sans remplacer la vitrine)
function openGameNewTab() {
  const href = window.GAME_RELATIVE_URL || "../game/index.html";
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
[
  "#launchTop",
  "#launchHero",
  "#launchBottom",
  "#playNow",
  "#playNowTop",
].forEach((sel) =>
  document.querySelector(sel)?.addEventListener("click", (e) => {
    e.preventDefault();
    openGameNewTab();
  })
);

// =========================
// Supabase (même projet que le jeu)
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
// CONFIG SOURCE STATS (adapter si besoin)
// Vue recommandée: player_stats(user_id, total_km, interventions_count, vehicles_count, hours_played)
// =========================
const STATS_SOURCE = {
  table: "player_stats",
  userId: "user_id",
  km: "total_km",
  interventions: "interventions_count",
  vehicles: "vehicles_count",
  hours: "hours_played",
};

// =========================
// DOM
// =========================
const yearEl = $("#year");
const sectionStats = $("#stats");

const statKm = $("#statKm");
const statInterventions = $("#statInterventions");
const statVehicles = $("#statVehicles");
const statHours = $("#statHours");

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

// =========================
// Auth helpers
// =========================
async function currentUser() {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user || null;
}

// =========================
// Stats (Supabase uniquement)
// =========================
function setSkeleton(on) {
  [statKm, statInterventions, statVehicles, statHours].forEach((el) => {
    if (!el) return;
    el.classList.toggle("skeleton", !!on);
    if (on) el.textContent = "—";
  });
}

async function fetchStatsFromConfiguredSource(userId) {
  const s = STATS_SOURCE;
  const columns = [s.userId, s.km, s.interventions, s.vehicles, s.hours].join(
    ", "
  );
  const { data, error } = await sb
    .from(s.table)
    .select(columns)
    .eq(s.userId, userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    km: Number(data[s.km] ?? 0),
    interventions: Number(data[s.interventions] ?? 0),
    vehicles: Number(data[s.vehicles] ?? 0),
    hours: Number(data[s.hours] ?? 0),
  };
}

async function fetchStatsFallbackProfiles(userId) {
  // Fallback si vous stockez dans profiles(id, total_km, interventions, vehicles, hours_played)
  const { data, error } = await sb
    .from("profiles")
    .select("total_km, interventions, vehicles, hours_played")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return {
    km: Number(data.total_km ?? 0),
    interventions: Number(data.interventions ?? 0),
    vehicles: Number(data.vehicles ?? 0),
    hours: Number(data.hours_played ?? 0),
  };
}

async function loadPlayerStats(user) {
  if (!user) return;
  setSkeleton(true);

  // Timeout de sécurité pour ne jamais rester en "chargement" > 6s
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve("TIMEOUT"), 6000)
  );
  const job = (async () => {
    let stats = await fetchStatsFromConfiguredSource(user.id);
    if (!stats) stats = await fetchStatsFallbackProfiles(user.id);
    if (!stats) stats = { km: 0, interventions: 0, vehicles: 0, hours: 0 };
    return stats;
  })();

  const result = await Promise.race([job, timeout]);

  if (result === "TIMEOUT") {
    // Affiche des tirets clairs plutôt que 0
    setText(statKm, "—");
    setText(statInterventions, "—");
    setText(statVehicles, "—");
    setText(statHours, "—");
    setSkeleton(false);
    return;
  }

  const stats = result;
  setText(statKm, new Intl.NumberFormat("fr-FR").format(Math.round(stats.km)));
  setText(
    statInterventions,
    new Intl.NumberFormat("fr-FR").format(stats.interventions)
  );
  setText(statVehicles, new Intl.NumberFormat("fr-FR").format(stats.vehicles));
  setText(
    statHours,
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      stats.hours
    )
  );
  setSkeleton(false);
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

// Déconnexion — on recharge la page pour repartir d'un état propre
logoutBtn?.addEventListener("click", async () => {
  try {
    await sb.auth.signOut();
  } catch {}
  location.reload();
});

// =========================
// Lancement du jeu — NOUVEL ONGLET garanti
// =========================
[launchTop, launchHero, launchBottom, playNowBtn, playNowTop].forEach((btn) => {
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    openGameNewTab();
  });
});

// =========================
// Init
// =========================
yearEl && (yearEl.textContent = new Date().getFullYear());

// Met à jour l'UI + charge stats à chaque changement de session
sb.auth.onAuthStateChange(async (_e, session) => {
  const user = session?.user || null;
  displayUser(user);
  if (user) await loadPlayerStats(user);
});

// Premier rendu
(async () => {
  const user = await currentUser();
  displayUser(user);
  if (user) await loadPlayerStats(user);
})();
