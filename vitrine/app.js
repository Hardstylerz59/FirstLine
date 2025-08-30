// Helpers
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (el, txt) => {
  if (el) el.textContent = txt ?? "";
};
const show = (el) => el?.classList.remove("hidden");
const hide = (el) => el?.classList.add("hidden");

// 👉 Ouvre juste /game/index.html (pas de ?player=…)
const openGame = () => {
  const href = window.GAME_RELATIVE_URL || "../game/index.html";
  window.open(href, "_blank", "noopener");
};

// Supabase client (même projet que le jeu)
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

// DOM
const yearEl = $("#year");
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

function displayUser(user) {
  if (!user) {
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
}

async function currentUser() {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user || null;
}

// Sign-in
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
    displayUser(data.user);
  } catch (err) {
    setText(authMsg, err?.message || "Erreur de connexion");
    authMsg.style.color = "#b91c1c";
  }
});

// Sign-up
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
    if (!data.user) setText(authMsg, "Compte créé. Vérifiez votre email.");
    else {
      setText(authMsg, "Compte créé et connecté !");
      displayUser(data.user);
    }
  } catch (err) {
    setText(authMsg, err?.message || "Erreur à l'inscription");
    authMsg.style.color = "#b91c1c";
  }
});

// Magic link
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

// Déconnexion vitrine
logoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();
  displayUser(null);
});

// Lancer le jeu (⚠️ sans pseudo)
[launchTop, launchHero, launchBottom, playNowBtn].forEach((btn) => {
  btn?.addEventListener("click", async () => {
    const user = await currentUser();
    if (!user) {
      setText(authMsg, "Connectez-vous d'abord.");
      authMsg.style.color = "#b91c1c";
      return;
    }
    openGame(); // ← pas de paramètre
  });
});

// État initial
yearEl && (yearEl.textContent = new Date().getFullYear());
sb.auth.onAuthStateChange((_e, session) => displayUser(session?.user || null));
(async () => {
  displayUser(await currentUser());
})();
