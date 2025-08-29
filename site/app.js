// Site vitrine logic
// Utilise la même session Supabase que le jeu (même domaine => même localStorage).

const sb = () => {
  if (
    !window.SUPABASE_CLIENT &&
    window.supabase &&
    window.SUPABASE_URL &&
    window.SUPABASE_KEY
  ) {
    window.SUPABASE_CLIENT = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_KEY
    );
  }
  return window.SUPABASE_CLIENT;
};

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

function setLoggedUI(email) {
  const logged = !!email;
  el("btn-login").classList.toggle("hidden", logged);
  el("btn-signup").classList.toggle("hidden", logged);
  el("btn-logout").classList.toggle("hidden", !logged);
  el("logged-as").classList.toggle("hidden", !logged);
  if (email) {
    el("logged-as").textContent = `Connecté : ${email}`;
  } else {
    el("logged-as").textContent = "";
  }
}

async function refreshAuth() {
  try {
    const { data } = await sb().auth.getUser();
    setLoggedUI(data?.user?.email || "");
  } catch (e) {
    console.error("Auth state error", e);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Date footer
  document.getElementById("y").textContent = new Date().getFullYear();

  // Show/hide auth section
  el("btn-login").addEventListener("click", () => show("auth"));
  el("btn-signup").addEventListener("click", () => show("auth"));
  el("btn-hero-play").addEventListener("click", () => show("auth"));

  // Login form
  el("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = el("login-email").value.trim();
      const password = el("login-password").value;
      const { error } = await sb().auth.signInWithPassword({ email, password });
      if (error) return alert("Erreur de connexion : " + error.message);
      await refreshAuth();
      alert("Connexion réussie ✅");
      hide("auth");
    } catch (err) {
      alert("Erreur inattendue.");
      console.error(err);
    }
  });

  // Signup form
  el("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = el("signup-email").value.trim();
      const password = el("signup-password").value;
      const pseudo = el("signup-pseudo").value.trim();
      const { error } = await sb().auth.signUp({
        email,
        password,
        options: { data: { pseudo } },
      });
      if (error) return alert("Erreur inscription : " + error.message);
      alert("Inscription envoyée. Vérifiez votre email.");
      await refreshAuth();
      hide("auth");
    } catch (err) {
      alert("Erreur inattendue.");
      console.error(err);
    }
  });

  // Logout
  el("btn-logout").addEventListener("click", async () => {
    await sb().auth.signOut();
    await refreshAuth();
    alert("Déconnecté.");
  });

  // Play
  function launch() {
    const iframe = document.getElementById("game-frame");
    iframe.src = "/index.html?embed=1";
    document.getElementById("embed-wrapper").classList.remove("hidden");
    iframe.focus();
  }

  el("btn-play").addEventListener("click", launch);
  el("launch-btn").addEventListener("click", launch);
  el("btn-hero-play").addEventListener("click", () => {
    sb()
      .auth.getUser()
      .then(({ data }) => {
        if (data?.user) {
          launch();
        } else {
          show("auth");
        }
      });
  });

  refreshAuth();
});
