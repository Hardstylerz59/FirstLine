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

// === SAUVEGARDE AUTOMATIQUE toutes les 30 secondes ===
setInterval(() => {
  scheduleAutoSave(0); // 0 = immédiat
}, 30000);
