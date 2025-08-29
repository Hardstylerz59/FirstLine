// authConfig.js — partagé entre le site et le jeu
window.SUPABASE_URL = "https://ehcoxgtepvonkosqxtca.supabase.co"; // ← copie l'URL exacte depuis save.js
window.SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoY294Z3RlcHZvbmtvc3F4dGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNTUwMzIsImV4cCI6MjA2MjczMTAzMn0.Liz6UAVxyhsTtRyrrpcNCHnkIj6c8l00ZQYCeMDZpYY"; // ← copie la clé anon exacte depuis save.js

// Crée un client réutilisable (le jeu l'utilisera si disponible)
if (window.supabase) {
  window.SUPABASE_CLIENT = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_KEY
  );
}
