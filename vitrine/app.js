// ——— Helpers UI ———
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (el, txt) => {
  if (el) el.textContent = txt ?? "";
};
const show = (el) => el?.classList.remove("hidden");
const hide = (el) => el?.classList.add("hidden");
const openGame = (playerName) => {
  const url = new URL(window.GAME_RELATIVE_URL, window.location.href);
  if (playerName) url.searchParams.set("player", playerName);
  window.open(url.toString(), "_blank", "noopener");
};

// ——— Supabase client (réutilise un client global si déjà exposé par le jeu) ———
let supabaseClient = window.supabaseClient || null;
if (!supabaseClient) {
  // si le jeu n'expose pas supabaseClient, on crée le nôtre via le CDN
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error(
      "Supabase non initialisé : ajoute @supabase/supabase-js et configure SUPABASE_URL / SUPABASE_ANON_KEY."
    );
  } else {
    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      {
        auth: { persistSession: true, autoRefreshToken: true },
      }
    );
  }
}
const sb = supabaseClient;

// ——— DOM ———
const yearEl = $("#year");
const loginForm = $("#loginForm");
const authMsg = $("#authMsg");
const pseudoInput = $("#pseudo");
const emailInput = $("#email");
const passInput = $("#password");
const btnSignIn = $("#btnSignIn");
const btnSignUp = $("#btnSignUp");
const btnMagic = $("#btnMagic");

const userBox = $("#userBox");
const userName = $("#userName");
const userEmail = $("#userEmail");
const logoutBtn = $("#logout");
const playNowBtn = $("#playNow");

const launchTop = $("#launchTop");
const launchHero = $("#launchHero");
const launchBottom = $("#launchBottom");

// ——— UI state ———
function displayUser(user) {
  if (!user) {
    hide(userBox);
    show(loginForm);
    return;
  }
  // Pseudo depuis metadata (si défini à l'inscription), sinon début d'email
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

// ——— Auth flows ———
async function getCurrentUser() {
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user || null;
}

async function signInWithPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signUpWithPassword(email, password, pseudo) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { pseudo: pseudo || null },
      emailRedirectTo: window.OAUTH_REDIRECT_URL,
    },
  });
  if (error) throw error;
  return data.user; // peut être null si confirm email requise
}

async function sendMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.OAUTH_REDIRECT_URL },
  });
  if (error) throw error;
}

async function signInWithProvider(provider) {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.OAUTH_REDIRECT_URL },
  });
  if (error) throw error;
  // Redirection gérée par le provider → retour sur cette page ensuite.
}

// ——— Event wiring ———
if (yearEl) yearEl.textContent = new Date().getFullYear();

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText(authMsg, "Connexion…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const user = await signInWithPassword(email, password);
    setText(authMsg, "Connecté !");
    displayUser(user);
  } catch (err) {
    setText(authMsg, err?.message || "Erreur de connexion");
    authMsg.style.color = "#b91c1c";
  }
});

btnSignUp?.addEventListener("click", async () => {
  setText(authMsg, "Création du compte…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const pseudo = pseudoInput.value.trim();
    const user = await signUpWithPassword(email, password, pseudo);
    if (!user) {
      // Confirm email activé : pas de session tant que l’email n’est pas validé
      setText(
        authMsg,
        "Compte créé. Vérifiez votre email pour valider la connexion."
      );
    } else {
      setText(authMsg, "Compte créé et connecté !");
      displayUser(user);
    }
  } catch (err) {
    setText(authMsg, err?.message || "Erreur lors de l'inscription");
    authMsg.style.color = "#b91c1c";
  }
});

btnMagic?.addEventListener("click", async () => {
  setText(authMsg, "Envoi du lien magique…");
  authMsg.style.color = "#334155";
  try {
    const email = emailInput.value.trim();
    await sendMagicLink(email);
    setText(authMsg, "Lien envoyé. Consultez votre boîte mail.");
  } catch (err) {
    setText(authMsg, err?.message || "Erreur lors de l’envoi du lien");
    authMsg.style.color = "#b91c1c";
  }
});

document.querySelectorAll("[data-provider]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await signInWithProvider(btn.getAttribute("data-provider"));
      // après retour, onAuthStateChange sera déclenché
    } catch (err) {
      setText(authMsg, err?.message || "Erreur OAuth");
      authMsg.style.color = "#b91c1c";
    }
  });
});

logoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();
  displayUser(null);
});

[launchTop, launchHero, launchBottom, playNowBtn].forEach((btn) => {
  btn?.addEventListener("click", async () => {
    const user = await getCurrentUser();
    const pseudo =
      user?.user_metadata?.pseudo ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0];
    openGame(pseudo);
  });
});

// Sur changement d’état (retour OAuth, refresh, etc.)
sb?.auth.onAuthStateChange(async (_event, session) => {
  displayUser(session?.user || null);
});

// Init au chargement
(async () => {
  const user = await getCurrentUser();
  displayUser(user);
})();
