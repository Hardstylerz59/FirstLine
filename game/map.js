// === DONNÉES JOUEUR (base) ===
const player = {
  xp: 0,
  money: 10000,
  level: 1,
};

// === INITIALISATION DE LA CARTE ===

const map = L.map("map").setView([50.175, 3.234], 13); // Vue par défaut : Cambrai
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let _weatherMoveTimer = null;
let _cityReqId = 0;

// Mémo du dernier point qui a servi à MAJ la météo/ville
let _lastWeatherQuery = {
  lat: null,
  lng: null,
  city: null,
  zoom: null,
};

// distance Haversine (m)
function _distMeters(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat1 = toRad(a.lat);
  const sLat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

map.on("moveend", () => {
  if (_weatherMoveTimer) clearTimeout(_weatherMoveTimer);

  _weatherMoveTimer = setTimeout(async () => {
    const c = map.getCenter();
    const zoom = map.getZoom();

    // 1) Si c'est juste un zoom (centre quasi identique), on ne fait rien
    if (_lastWeatherQuery.lat != null) {
      const d = _distMeters(
        { lat: _lastWeatherQuery.lat, lng: _lastWeatherQuery.lng },
        { lat: c.lat, lng: c.lng }
      );
      if (d < 100) {
        // seuil 100 m : ajuste 50–200 m si besoin
        return;
      }
    }

    // 2) Vérifier si on reste dans la même ville → dans ce cas on ne met rien à jour
    const myId = ++_cityReqId; // anti-race
    let city = null;
    try {
      city = await getCityName(c.lat, c.lng);
    } catch (_) {
      // si échec, on tombera sur la règle distance uniquement
    }
    if (myId !== _cityReqId) return; // réponse obsolète

    // Même ville qu'affichée précédemment ? Alors on ne fait rien.
    if (city && _lastWeatherQuery.city && city === _lastWeatherQuery.city) {
      // Met quand même à jour la mémoire du centre (au cas où)
      _lastWeatherQuery = { lat: c.lat, lng: c.lng, city, zoom };
      return;
    }

    // 3) Nouvelle ville (ou première fois) → on met à jour météo + UI
    if (typeof fetchAndApplyWeather === "function") {
      await fetchAndApplyWeather(c.lat, c.lng);
    }
    // On passe la ville déjà résolue pour éviter un second géocodage
    updateWeatherUI(city);

    _lastWeatherQuery = { lat: c.lat, lng: c.lng, city: city || null, zoom };
  }, 600); // debounce
});

updateCycleUI(); // au chargement

// === ÉTATS INTERNES DE L’INTERFACE CARTE ===
let addMode = false; // Mode ajout activé ?
let currentBuilding = null; // Bâtiment en cours de création

// === COLLECTIONS PRINCIPALES ===
const buildings = []; // Bâtiments posés
const missions = []; // Missions en cours

// === RÉFÉRENCES DOM UTILES ===
const buildingList = document.getElementById("building-list");
const missionList = document.getElementById("mission-list");

// === MODALE AJOUT BÂTIMENT ===
const addBtn = document.getElementById("add-building-fab");
const addModal = document.getElementById("modal");
const confirmBtn = document.getElementById("confirm-add-building");
const cancelBtn = document.getElementById("cancel-add-building");
const typeInput = document.getElementById("building-type");
const nameInput = document.getElementById("building-name");

// === Affichage du coût en fonction du type sélectionné ===
typeInput.onchange = () => {
  const type = typeInput.value;
  const cost = ECONOMY.buildingCost[type] || 0;
  const costDisplay = document.getElementById("building-cost-display");
  if (costDisplay) costDisplay.textContent = `Coût : ${cost}€`;
};
typeInput.onchange(); // Affiche dès l'ouverture

// === OUVERTURE de la modale ajout bâtiment ===
addBtn.onclick = () => {
  closeBuildingModal(); // Évite les conflits visuels
  addMode = false;
  currentBuilding = null;
  nameInput.value = "";
  typeInput.selectedIndex = 0;
  setTimeout(() => typeInput.onchange(), 0); // met à jour le coût
  confirmBtn.disabled = false;
  addModal.classList.remove("hidden");
};

// === ANNULATION de la création d’un bâtiment ===
cancelBtn.onclick = () => {
  confirmBtn.disabled = false;
  nameInput.value = "";
  addModal.classList.add("hidden");
};

// === VALIDATION d’un bâtiment ===
confirmBtn.onclick = () => {
  if (addMode) return; // sécurité double-clic
  confirmBtn.disabled = true;

  const name = nameInput.value.trim();
  const type = typeInput.value;
  if (!name) return alert("Nom requis");

  // === Vérifie doublons ===
  const isFireStation = (t) => ["cpi", "cs", "csp"].includes(t);

  const alreadyExists = buildings.some((b) => {
    if (isFireStation(b.type) && isFireStation(type)) {
      return b.name.toLowerCase() === name.toLowerCase();
    }
    return b.name.toLowerCase() === name.toLowerCase() && b.type === type;
  });

  if (alreadyExists) {
    return alert(`Un bâtiment avec ce nom est déjà présent pour ce type.`);
  }

  // === Vérifie le coût ===
  const cost = ECONOMY.buildingCost[type] || 0;
  if (player.money < cost) {
    return alert(`Pas assez d'argent (${cost}€ requis)`);
  }

  // === Préparation du placement sur la carte ===
  currentBuilding = { name, type };
  addMode = true;
  document.getElementById("map").classList.add("add-cursor");

  const labelByType = {
    caserne: "CIS",
    hopital: "CH",
    police: "CIAT",
  };
  const label = labelByType[type] || "le bâtiment";
  const mapNotice = document.getElementById("map-notice-text");
  mapNotice.textContent = `🧱 Cliquez sur la carte pour placer ${label} ${name}`;
  document.getElementById("map-notice").classList.remove("hidden");

  // Ferme la modale
  addModal.classList.add("hidden");
  nameInput.value = "";
};

// === ANNULATION du mode placement sur la carte ===
document
  .getElementById("cancel-placement-btn")
  .addEventListener("click", () => {
    document.getElementById("map").classList.remove("add-cursor");
    confirmBtn.disabled = false;
    addMode = false;
    currentBuilding = null;
    document.getElementById("map-notice").classList.add("hidden");
  });

startEnvironmentCycle();
updateWeatherUI();
updateCycleUI();
preloadAllPOIs();

// === SAUVEGARDE AUTOMATIQUE toutes les 30 secondes ===
setInterval(() => {
  scheduleAutoSave(0); // 0 = immédiat
}, 30000);
