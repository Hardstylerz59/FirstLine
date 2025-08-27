let SIMULATION_ACTIVE = false;
let manageMissionInterval = null;

// État renforts (intégré)
const REINFORCEMENT_STATE = {
  missionId: null,
  staffVirtual: {}, // { [buildingId]: number | {pro,vol} }
  selected: new Set(), // Set<vehicleId>
  takenByVehicle: {}, // { [vehicleId]: { buildingId, pro, vol, staff } } pour restitutions au refresh
};

// Compteurs totaux (persistés via save)
window.CALL_STATS = window.CALL_STATS || {
  total: 0,
  bySource: { "Relais 18/112": 0, "Centre 15": 0, 17: 0 },
};

function incCallStatsFor(mission) {
  window.CALL_STATS.total++;
  const p = getProvenanceLabel(mission);
  if (!(p in window.CALL_STATS.bySource)) window.CALL_STATS.bySource[p] = 0;
  window.CALL_STATS.bySource[p]++;

  // ➕ Mise à jour de l’UI + sauvegarde
  updatePendingBadgeAndHistory?.();
  scheduleAutoSave?.(500);
}

const ADDRESS_INTROS = [
  "Je crois que c'est au niveau de :",
  "Ça se passe à l'adresse suivante :",
  "Il me semble que c’est ici :",
  "L'intervention est demandée à :",
  "Oui, c’est à cette adresse :",
  "Je suis à :",
  "Je vous donne l’adresse :",
  "Ça se situe vers :",
  "Voici l’endroit exact :",
];

const CALL_OPENINGS = [
  "Allô ? Oui bonjour, écoutez-moi bien...",
  "Oh mon dieu, vous devez venir vite !",
  "S'il vous plaît, c'est urgent...",
  "Bonjour, je viens de voir quelque chose d’horrible...",
  "Allô ? Je crois qu’il y a un problème ici...",
  "Euh... je ne sais pas quoi faire... mais il faut de l’aide...",
  "C’est affreux, venez vite !",
];

function openHistory() {
  document.getElementById("history-modal").classList.remove("hidden");
}

function closeHistory() {
  document.getElementById("history-modal").classList.add("hidden");
}

function getXpForNextLevel(level) {
  return Math.floor(100 + 50 * level + 20 * Math.sqrt(level));
}

function formatMoney(n) {
  return Math.round(n).toLocaleString("fr-FR");
}

function updatePlayerInfo() {
  // Palier actuel
  let nextLevelXP = getXpForNextLevel(player.level);

  // Passage de niveaux si on a assez d’XP (conserve le surplus)
  while (player.xp >= nextLevelXP) {
    player.xp -= nextLevelXP;
    player.level++;

    const reward = Math.round(ECONOMY.xpSystem.baseReward * player.level);
    player.money += reward;

    showNotification(
      "level",
      `🎉 Niveau <strong>${player.level}</strong> atteint ! +${formatMoney(
        reward
      )}€`
    );

    nextLevelXP = getXpForNextLevel(player.level);
  }

  // Valeurs pour l'UI
  const earned = Math.max(0, Math.floor(player.xp));
  const next = Math.max(1, Math.floor(nextLevelXP));
  const pct = Math.min(100, Math.round((earned / next) * 100));

  // Helpers DOM
  const $ = (id) => document.getElementById(id);

  // Barre d'XP
  const fill = $("xp-bar-fill");
  if (fill) fill.style.width = `${pct}%`;

  // Libellé au-dessus de la barre: "XP acquis / XP palier"
  const xpEarned = $("xp-earned");
  if (xpEarned) xpEarned.textContent = earned.toLocaleString("fr-FR");

  const xpNext = $("xp-next");
  if (xpNext) xpNext.textContent = next.toLocaleString("fr-FR");

  const bar = $("xp-bar");
  if (bar) {
    bar.title = `${earned.toLocaleString("fr-FR")} / ${next.toLocaleString(
      "fr-FR"
    )}`;
  }

  // Récap dans #player-info (XP acquis / palier, niveau, argent)
  const info = $("player-info");
  if (info) {
    info.textContent = `Niveau: ${player.level} | Argent: ${formatMoney(
      player.money
    )}€`;
  }

  // Sauvegarde
  scheduleAutoSave();
}

function showNotification(type, message, duration = 4000) {
  const notif = document.createElement("div");
  notif.className = `toast-notification toast-${type}`;
  notif.innerHTML = message;
  document.body.appendChild(notif);

  // Force reflow pour transition
  requestAnimationFrame(() => {
    notif.classList.add("visible");
  });

  // Optionnel : confetti si "level"
  if (type === "level") {
    const audio = new Audio("assets/sounds/level.mp3");
    audio.volume = 0.7;
    audio.play();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.2 },
    });
  }

  if (type === "xp") {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.2 },
    });
  }

  setTimeout(() => {
    notif.classList.remove("visible");
    setTimeout(() => notif.remove(), 400);
  }, duration);
}

function resetGame() {
  // Réinitialiser le joueur
  player.xp = 0;
  player.money = 1000000;
  player.level = 1;
  updatePlayerInfo();

  // Réinitialiser les bâtiments
  buildings.forEach((b) => b.marker.remove());
  buildings.length = 0;
  buildingList.innerHTML = "";

  // Réinitialiser les missions
  missions.forEach((m) => m.marker.remove());
  missions.length = 0;
  missionList.innerHTML = "";

  // Réinitialiser l'historique
  document.getElementById("history-list").innerHTML = "";

  // Réinitialiser la carte
  map.setView([50.175, 3.234], 13);

  // 🧹 Nettoyage de la sauvegarde dans IndexedDB
  clearGame()
    .then(() => {
      console.log("IndexedDB vidé");
    })
    .catch((err) => {
      console.warn("Erreur lors de la suppression IndexedDB :", err);
    });

  alert("Jeu réinitialisé !");
}

function openXpModal() {
  const current = player.xp;
  const next = getXpForNextLevel(player.level);
  const progress = Math.min((current / next) * 100, 100).toFixed(1);
  const reward = ECONOMY.xpSystem.baseReward * (player.level + 1);

  document.getElementById(
    "xp-current"
  ).textContent = `XP actuelle : ${current}`;
  document.getElementById("xp-next").textContent = `XP pour niveau ${
    player.level + 1
  } : ${next}`;
  document.getElementById(
    "xp-progress"
  ).textContent = `Progression : ${progress}%`;
  document.getElementById(
    "xp-reward"
  ).textContent = `Prochaine récompense : ${reward}€`;

  document.getElementById("xp-modal").classList.remove("hidden");
}

function closeXpModal() {
  document.getElementById("xp-modal").classList.add("hidden");
}

document
  .getElementById("xp-details-btn")
  .addEventListener("click", openXpModal);

document.getElementById("add-money-btn").addEventListener("click", () => {
  player.money += 1000000;
  updatePlayerInfo();
  scheduleAutoSave();
});

let currentCallMission = null;
let vehicleListInterval = null;

function openCallModal(missionId) {
  currentCallMission = missions.find((m) => m.id === missionId);
  // Vider les observations si on ouvre une mission différente
  if (window._lastCallModalMissionId !== missionId) {
    const obs = document.getElementById("call-observations");
    if (obs) obs.value = "";
    if (currentCallMission) currentCallMission.observations = "";
    window._lastCallModalMissionId = missionId;
  }

  if (!currentCallMission.createdAt) {
    currentCallMission.createdAt = Date.now();
  }
  document.getElementById("depart-type-section").classList.add("hidden");
  if (!currentCallMission) return;

  const addrP = document.getElementById("call-address"); // ancien <p> (caché)
  const addrBox = document.getElementById("call-confirmed-address"); // nouveau encadré
  const revealBtn = document.getElementById("reveal-address-btn");

  // ---- Adresse déjà connue ?
  if (currentCallMission.address) {
    if (addrP) {
      addrP.textContent = currentCallMission.address;
      addrP.classList.remove("hidden");
    }
    if (addrBox) addrBox.textContent = currentCallMission.address;
    revealBtn.classList.add("hidden");

    // afficher les sélecteurs
    document.getElementById("depart-type-section").classList.remove("hidden");
    buildDepartTreeUI();

    // Observations (liaison)
    const obsEl = document.getElementById("call-observations");
    if (obsEl) {
      obsEl.value = currentCallMission.observations || "";
      obsEl.oninput = (e) => {
        currentCallMission.observations = e.target.value;
        refreshRecap();
        if (typeof scheduleAutoSave === "function") scheduleAutoSave();
      };
    }
  } else {
    if (addrP) {
      addrP.textContent = "";
      addrP.classList.add("hidden");
    }
    if (addrBox) addrBox.textContent = "—";
    revealBtn.classList.remove("hidden");
    document.getElementById("depart-type-section").classList.add("hidden");
  }

  // ---- Dialogue d'ouverture
  const dialogueEl = document.getElementById("call-dialogue");
  if (currentCallMission.callDisplayed) {
    dialogueEl.textContent = currentCallMission.dialogue;
  } else {
    const callIntro =
      CALL_OPENINGS[Math.floor(Math.random() * CALL_OPENINGS.length)];
    const dialogueText = `${callIntro}\n${
      currentCallMission.dialogue || "Appel en cours..."
    }`;
    typewriterEffect(dialogueEl, dialogueText, 35);
    currentCallMission.callDisplayed = true;
  }

  // Menus (au cas où)
  buildDepartTreeUI();

  // Section véhicules
  document.getElementById("vehicle-list").innerHTML = "";
  document.getElementById("launch-mission-btn").classList.add("hidden");

  // Ouvrir la modale
  document.getElementById("call-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");

  // Si le texte d'adresse est rempli après coup (typewriter / BAN / etc.),
  // on le capte automatiquement et on MAJ le récap.
  const addrNode = document.getElementById("call-address");
  if (addrNode && !addrNode._addrObserver) {
    const mo = new MutationObserver(() => updateAddressFromUI());
    mo.observe(addrNode, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    addrNode._addrObserver = mo;
  }

  // Mini-carte
  createCallMiniMap();
  syncCallMiniMap();

  // Premier build + autosélection
  buildVehicleListForCall(true);

  // Récap initial
  refreshRecap();

  // Refresh live des distances/états
  clearInterval(vehicleListInterval);
  vehicleListInterval = setInterval(() => {
    if (!document.getElementById("call-modal")?.classList.contains("hidden")) {
      refreshVehicleStatusAndDistance(false);
      syncCallMiniMap();
    } else {
      clearInterval(vehicleListInterval);
    }
  }, 1000);
}

function buildVehicleListForCall(
  autoSelect = true,
  containerId = "vehicle-list",
  mission = null
) {
  let personnelVirtuel = {};
  const activeFilter =
    document.querySelector(".filter-btn.active")?.dataset.filter || "ALL";

  const typeMap = {
    FIRE: ["cpi", "cs", "csp"],
    HOSPITAL: ["hopital"],
    POLICE: ["police"],
  };
  // Détermination de la mission
  let missionContext = mission;
  if (!missionContext) {
    missionContext =
      containerId === "vehicle-list"
        ? currentCallMission
        : missions.find((m) => m.id === REINFORCEMENT_STATE.missionId);
  }

  const position = missionContext?.position;
  if (!position) return;

  const container = document.getElementById(containerId);
  if (!container) return;

  const selectedIds = new Set(
    Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map(
      (cb) => cb.dataset.vehicleId
    )
  );

  // Init recherche
  if (!document.getElementById("vehicle-search-container")) {
    const searchDiv = document.createElement("div");
    searchDiv.id = "vehicle-search-container";
    searchDiv.style.marginBottom = "8px";
    searchDiv.innerHTML = `
      <input type="text" id="vehicle-search-input" placeholder="Recherche véhicule..." style="margin-right:10px;width:120px;">
      <select id="vehicle-type-select" style="margin-right:10px;">
        <option value="TOUS">TOUS</option>
        ${getAllVehicleTypes()
          .map((type) => `<option value="${type}">${type}</option>`)
          .join("")}
      </select>
    `;
    container.parentNode.insertBefore(searchDiv, container);
  }

  container.classList.add("vehicle-list-scroll");
  while (container.firstChild) container.removeChild(container.firstChild);

  const departType = currentCallMission?.departSelected || [];
  const autoSelectMap = {};
  departType.forEach((req) => {
    const required = requiredPersonnel?.[req.type] || 1;
    autoSelectMap[req.type] = req.nombre * required;
  });

  const searchValue =
    document.getElementById("vehicle-search-input")?.value.toLowerCase() || "";
  const typeSelected =
    document.getElementById("vehicle-type-select")?.value || "TOUS";

  const byBuilding = {};
  const allVehicles = [];

  buildings.forEach((b) => {
    if (activeFilter !== "ALL" && !typeMap[activeFilter]?.includes(b.type)) {
      return;
    }

    b.vehicles.forEach((v) => {
      if ((v.ready && v.status === "dc") || v.status === "ot") {
        const dist = map.distance(position, v.marker?.getLatLng() || b.latlng);
        const matchesSearch =
          searchValue === "" ||
          v.label.toLowerCase().includes(searchValue) ||
          v.type.toLowerCase().includes(searchValue);
        const matchesType = typeSelected === "TOUS" || v.type === typeSelected;
        if (matchesSearch && matchesType) {
          allVehicles.push({ vehicle: v, distance: dist, building: b });
        }
      }
    });
  });

  allVehicles.sort((a, b) => a.distance - b.distance);

  allVehicles.forEach(({ vehicle, distance, building }) => {
    if (!byBuilding[building.id]) {
      byBuilding[building.id] = { building, vehicles: [] };
    }
    byBuilding[building.id].vehicles.push({ vehicle, distance });
  });

  Object.values(byBuilding).forEach(({ building, vehicles }) => {
    const section = document.createElement("div");
    section.className = "building-group";

    const shortType = ["cpi", "cs", "csp"].includes(building.type)
      ? "CIS"
      : (building.type?.fr || building.type || "").toUpperCase();

    let personnelTotal = 0;
    let personnelDispo = 0;

    // Init stock virtuel
    if (["cpi", "cs", "csp"].includes(building.type)) {
      const proTotal = parseInt(building.personnelPro || 0, 10);
      const volTotal = parseInt(building.personnelVol || 0, 10);

      // Dispo de départ = total - somme(personnel requis des véhicules EN INTERVENTION)
      const engagedStatuses = new Set(["er", "al", "at", "tr", "ch", "ot"]);
      let proUsed = 0;
      let volUsed = 0;

      building.vehicles.forEach((v) => {
        if (!v) return;
        if (!engagedStatuses.has(v.status)) return;
        const req = parseInt(v.required || v.personnel || 1, 10);
        const proThis = Math.min(Math.max(proTotal - proUsed, 0), req);
        const volThis = Math.max(0, req - proThis);
        proUsed += proThis;
        volUsed += volThis;
      });

      personnelVirtuel[building.id] = {
        pro: Math.max(0, proTotal - proUsed),
        vol: Math.max(0, volTotal - volUsed),
      };

      personnelTotal = proTotal + volTotal;
      personnelDispo =
        personnelVirtuel[building.id].pro + personnelVirtuel[building.id].vol;
    } else {
      const total = parseInt(building.personnel || 0, 10);
      const engaged = building.vehicles
        .filter(
          (v) => v && ["er", "al", "at", "tr", "ch", "ot"].includes(v.status)
        )
        .reduce(
          (sum, v) => sum + parseInt(v.required || v.personnel || 1, 10),
          0
        );

      personnelVirtuel[building.id] = Math.max(0, total - engaged);

      personnelTotal = total;
      personnelDispo = personnelVirtuel[building.id];
    }

    const header = document.createElement("div");
    header.className = "building-header";
    header.innerHTML = `
      <span class="bh-left"><strong>${shortType} ${building.name}</strong></span>
      <span class="bh-right"><span class="grp-label">Dispo&nbsp;:</span><span class="grp-count"><span class="perso-left" data-building-id="${building.id}" data-total="${personnelTotal}">${personnelDispo}</span>/<span>${personnelTotal}</span></span></span>
    `;

    if (personnelDispo === 0) header.classList.add("no-staff");
    section.appendChild(header);

    vehicles.sort((a, b) => {
      const typeA = a.vehicle.type.toUpperCase();
      const typeB = b.vehicle.type.toUpperCase();
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      const labelA = a.vehicle.label.toUpperCase();
      const labelB = b.vehicle.label.toUpperCase();
      return labelA.localeCompare(labelB);
    });

    vehicles.forEach(({ vehicle: v, distance }) => {
      const typeKey = v.type.toUpperCase();
      const staffRequired = requiredPersonnel?.[typeKey] || v.personnel || 1;
      let isChecked = false;

      if (autoSelect) {
        const available =
          ["cpi", "cs", "csp"].includes(building.type) &&
          personnelVirtuel[building.id]
            ? personnelVirtuel[building.id].pro +
              personnelVirtuel[building.id].vol
            : personnelVirtuel[building.id];

        if (
          (autoSelectMap[typeKey] || 0) >= staffRequired &&
          available >= staffRequired
        ) {
          isChecked = true;
          autoSelectMap[typeKey] -= staffRequired;

          if (["cpi", "cs", "csp"].includes(building.type)) {
            const virt = personnelVirtuel[building.id];
            const takePro = Math.min(virt.pro, staffRequired);
            const takeVol = staffRequired - takePro;
            virt.pro -= takePro;
            virt.vol -= takeVol;
          } else {
            personnelVirtuel[building.id] -= staffRequired;
          }
        }
      } else {
        isChecked = selectedIds.has(v.id);
      }

      const cleanLabel = v.label.split("—")[0].trim();
      const row = document.createElement("label");
      row.className = "vehicle-select-row";
      row.dataset.vehicleId = v.id;
      row.dataset.buildingId = building.id;

      // ▼▼▼ MODIF: ajout data-veh-type et data-veh-label pour le récap ▼▼▼
      row.innerHTML = `
        <input type="checkbox"
          data-building-id="${building.id}"
          data-vehicle-id="${v.id}"
          data-veh-type="${typeKey}"
          data-veh-label="${cleanLabel}"
          data-staff="${staffRequired}"
          ${isChecked ? "checked" : ""}>
        <span class="vehicle-label">${cleanLabel}</span>
        <span class="vehicle-distance">${Math.round(distance)} m</span>
        <span class="status ${v.status}">${v.status.toUpperCase()}</span>
      `;
      // ▲▲▲ FIN MODIF ▲▲▲

      section.appendChild(row);

      const cb = row.querySelector("input[type=checkbox]");
      cb.addEventListener("change", () => {
        if (typeof refreshRecap === "function") refreshRecap();
        if (typeof scheduleAutoSave === "function") scheduleAutoSave();
      });

      const statusSpan = row.querySelector(".status");
      if (isChecked) {
        statusSpan.classList.add("selected-synced");
      } else {
        statusSpan.classList.remove("selected-synced", "on", "off");
      }

      if (isChecked) {
        setTimeout(() => {
          cb?.dispatchEvent(new Event("change"));
        }, 0);
      }
    });

    container.appendChild(section);
    if (["cpi", "cs", "csp"].includes(building.type)) {
      section.classList.add("fire");
    } else if (building.type === "hopital") {
      section.classList.add("hospital");
    } else if (building.type === "police") {
      section.classList.add("police");
    }
  });

  setupPersonnelCountListeners();

  document
    .querySelectorAll("#call-filter-buttons .filter-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#call-filter-buttons .filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        buildVehicleListForCall(false);
      });
    });

  const debouncedRebuild = debounce(() => buildVehicleListForCall(false), 120);
  document
    .getElementById("vehicle-search-input")
    ?.addEventListener("input", debouncedRebuild);
  document
    .getElementById("vehicle-type-select")
    ?.addEventListener("change", debouncedRebuild);

  // ▼▼▼ MAJ récap après (re)build complet ▼▼▼
  if (typeof refreshRecap === "function") refreshRecap();
}

function setupPersonnelCountListeners() {
  document
    .querySelectorAll(
      "#vehicle-list input[type=checkbox], #reinforcement-list input[type=checkbox]"
    )
    .forEach((cb) => {
      cb.addEventListener("change", () => {
        const bid = cb.dataset.buildingId;
        const staff = parseInt(cb.dataset.staff || "1", 10);
        const span = document.querySelector(
          `.perso-left[data-building-id="${bid}"]`
        );
        if (!span) return;

        const base = parseInt(span.dataset.total || "0", 10);
        const inputs = document.querySelectorAll(
          `input[data-building-id="${bid}"]`
        );
        let used = 0;

        inputs.forEach((i) => {
          if (i.checked && i !== cb) {
            used += parseInt(i.dataset.staff || "1", 10);
          }
        });

        const row = cb.closest(".vehicle-select-row");
        const status = row?.querySelector(".status");

        // Synchronisation avec la sidebar
        const sidebarStatus = document.querySelector(
          `.status[data-vehicle-id="${cb.dataset.vehicleId}"]`
        );

        if (cb.checked) {
          if (used + staff > base) {
            cb.checked = false;
            cb.title = "Pas assez de personnel disponible pour ce véhicule.";
            return;
          }

          cb.removeAttribute("title");
          used += staff;

          if (status) status.classList.add("selected-synced");
          if (sidebarStatus) sidebarStatus.classList.add("selected-synced");
        } else {
          if (status) {
            status.classList.remove("selected-synced");
            status.style.backgroundColor = "";
            status.style.color = "";
          }
          if (sidebarStatus) {
            sidebarStatus.classList.remove("selected-synced");
            sidebarStatus.style.backgroundColor = "";
            sidebarStatus.style.color = "";
          }
        }

        const dispo = base - used;
        span.textContent = dispo;

        const header = span.closest(".building-header");
        if (header) {
          header.classList.toggle("no-staff", dispo <= 0);
        }
      });
    });
}

function refreshVehicleStatusAndDistance() {
  const activeFilter =
    document.querySelector(".filter-btn.active")?.dataset.filter || "ALL";

  const typeMap = {
    FIRE: ["cpi", "cs", "csp"],
    HOSPITAL: ["hopital"],
    POLICE: ["police"],
  };

  const position = currentCallMission?.position;
  if (!position) return;

  document.querySelectorAll(".vehicle-select-row").forEach((row) => {
    const buildingId = row.dataset.buildingId;
    const building = buildings.find((b) => b.id === buildingId);
    if (
      activeFilter !== "ALL" &&
      building &&
      !typeMap[activeFilter]?.includes(building.type)
    ) {
      row.remove(); // On masque les lignes hors filtre
      return;
    }

    const vehicleId = row.dataset.vehicleId;
    const vehicle = buildings
      .flatMap((b) => b.vehicles)
      .find((v) => v.id === vehicleId);
    if (!vehicle) return;

    // Distance
    const vehiclePos = getVehicleLatLng(vehicle, building);
    const distance = Math.round(map.distance(position, vehiclePos));

    const distanceSpan = row.querySelector(".vehicle-distance");
    if (distanceSpan) distanceSpan.textContent = `${distance} m`;

    // Status
    const statusSpan = row.querySelector(".status");
    if (statusSpan) {
      const cb = row.querySelector("input[type=checkbox]");
      const isSelected = cb?.checked;

      statusSpan.classList.remove("on", "off", "selected-synced");

      if (isSelected) {
        statusSpan.classList.add("selected-synced");
      }

      const statusClass = `status ${vehicle.status}`;
      if (!statusSpan.classList.contains(vehicle.status)) {
        statusSpan.className =
          statusClass + (isSelected ? " selected-synced" : "");
      }

      statusSpan.textContent = vehicle.status.toUpperCase();
    }
  });
}

function getVehicleLatLng(vehicle, building) {
  return (
    vehicle.marker?.getLatLng() ||
    vehicle.latlng ||
    building.latlng || { lat: 0, lng: 0 }
  );
}

function closeCallModal() {
  currentCallMission = null;
  document.getElementById("call-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

document.getElementById("reveal-address-btn").addEventListener("click", () => {
  if (!currentCallMission) return;

  currentCallMission.hasAskedAddress = true;
  currentCallMission.labelUpdated = true;
  notifyMissionsChanged();

  const { lat, lng } = currentCallMission.position;

  // Crée le marker s'il n'existe pas
  if (!currentCallMission.marker) {
    const icon = L.icon({
      iconUrl: "assets/icons/mission.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    const mk = L.marker(currentCallMission.position, { icon })
      .addTo(map)
      .bindPopup(() => {
        // Cloner proprement le DOM déjà mis à jour par updateMissionButton
        return (
          currentCallMission.domElement?.cloneNode(true) ||
          "<em>Chargement…</em>"
        );
      });

    currentCallMission.marker = mk;
    mk.openPopup();
  }

  // Affiche adresse avec Nominatim
  fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
  )
    .then((res) => res.json())
    .then((data) => {
      const addr = data.address;
      const parts = [
        addr.house_number,
        addr.road,
        addr.postcode,
        addr.city || addr.town || addr.village,
      ].filter(Boolean);
      const shortAddress = parts.join(", ");
      const el = document.getElementById("call-address");

      currentCallMission.address = shortAddress || "Adresse non trouvée";
      const intro =
        ADDRESS_INTROS[Math.floor(Math.random() * ADDRESS_INTROS.length)];
      const fullText = `${intro} ${currentCallMission.address}`;

      // Effet de frappe
      typewriterEffect(el, fullText, 40);

      if (currentCallMission.domElement) {
        const p = currentCallMission.domElement.querySelector("p");
        if (p) p.textContent = currentCallMission.address;
      }

      document.getElementById("reveal-address-btn").classList.add("hidden");
      el.classList.remove("hidden");
      document.getElementById("call-address").classList.remove("hidden");

      // Affiche la section "Départ type"
      document.getElementById("depart-type-section").classList.remove("hidden");

      buildDepartTreeUI();
    });

  // Cache les sections non pertinentes au clic
  document.getElementById("vehicle-list").innerHTML = "";
  document.getElementById("launch-mission-btn").classList.add("hidden");
});

function openManageMission(missionId) {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) return;

  const modal = document.getElementById("manage-modal");
  if (!modal) return;
  modal.dataset.missionId = missionId;
  modal.classList.remove("hidden");

  const template = MISSION_TYPES[mission.sourceType]?.find(
    (m) => m.type === mission.realType
  );
  if (!template) return;

  const variant = template.variants?.[0] || template;

  const requiredCounts = {};
  const requiredVehicles = variant.vehicles || [];
  requiredVehicles.forEach((v) => {
    if (!v || !v.type) return;
    requiredCounts[v.type] = (requiredCounts[v.type] || 0) + v.nombre;
  });

  const arrivedCounts = {};
  mission.dispatched.forEach((d) => {
    if (d.vehicle.status === "al") {
      arrivedCounts[d.vehicle.type] = (arrivedCounts[d.vehicle.type] || 0) + 1;
    }
  });

  const atLeastOneArrived = Object.values(arrivedCounts).some((v) => v > 0);

  const missingVehicles = [];
  for (const type in requiredCounts) {
    const required = requiredCounts[type];
    const arrived = arrivedCounts[type] || 0;
    if (arrived < required) {
      missingVehicles.push(`${type} (${required - arrived} manquant)`);
    }
  }

  const div = document.getElementById("manage-content");
  div.innerHTML = `
    <h3>${
      atLeastOneArrived ? mission.realLabel : "❓ En attente de moyens"
    }</h3>
    <p><strong>📍 Adresse :</strong> ${
      mission.address || "Adresse non disponible"
    }</p>
    <br/>
    <p><strong>Appel :</strong> ${mission.dialogue}</p><br/>

    <h4>Véhicules engagés :</h4>
    <ul class="vehicle-list-ui">
      ${mission.dispatched
        .filter((d) => !d.canceled)
        .filter(
          (d) =>
            d.vehicle && !["dc", "tr", "ch", "ot"].includes(d.vehicle.status)
        )
        .map((d) => {
          const v = d.vehicle;
          const statusLabels = {
            er: "ER",
            al: "AL",
            ot: "OT",
            dc: "DC",
            tr: "TR",
            ch: "CH",
          };
          const statusText = statusLabels[v.status] || v.status.toUpperCase();
          const showCancel =
            ["er", "al", "at"].includes(v.status) && !v.retourEnCours;

          let arrivalTimer = "";
          if (v.status === "er" && v.arrivalTime) {
            const secLeft = Math.max(
              0,
              Math.ceil((v.arrivalTime - Date.now()) / 1000)
            );
            arrivalTimer = `<span class="timer-er" style="margin-left:8px;color:#007bff;font-weight:bold;">⏱ ${secLeft}s</span>`;
          }

          return `
              <li class="vehicle-entry">
                <span>${v.label}</span>
                ${arrivalTimer}
                <span class="vehicle-actions">
                  <span class="status ${v.status}" data-vehicle-id="${
            v.id
          }">${statusText}</span>

                  ${
                    showCancel
                      ? `<button class="btn-cancel" onclick="cancelVehicleFromMission('${mission.id}', '${v.id}')">✖</button>`
                      : ""
                  }
                </span>
              </li>
            `;
        })
        .join("")}
      </ul>
     <br/>
    <div id="victims-panel"></div>
     <br/>
  `;

  updateMissionVictimsUI(mission);

  if (atLeastOneArrived) {
    div.innerHTML += `
      <h4>📋 État des moyens nécessaires :</h4>
      <ul class="vehicle-status-ui">
        ${Object.keys(requiredCounts)
          .map((type) => {
            const arrived = arrivedCounts[type] || 0;
            const required = requiredCounts[type];
            const ok = arrived >= required;
            return `<li><span class="${
              ok ? "vehicle-status-ok" : "vehicle-status-missing"
            }">${
              ok ? "✅" : "❌"
            }</span> <strong>${type}</strong> : ${arrived}/${required}</li>`;
          })
          .join("")}
      </ul>
      ${
        missingVehicles.length > 0
          ? `<p class="vehicle-missing-summary">🟠 Véhicules manquants : ${missingVehicles.join(
              ", "
            )}</p>`
          : `<p class="vehicle-status-ok">🟢 Tous les moyens requis sont sur place</p>`
      }
      <br/>
    `;
  }

  // === Init panneau renforts intégré ===
  REINFORCEMENT_STATE.missionId = mission.id;
  REINFORCEMENT_STATE.staffVirtual = {}; // recalculée au 1er rendu
  REINFORCEMENT_STATE.selected.clear();
  REINFORCEMENT_STATE.takenByVehicle = {};

  // 1er rendu
  buildVehicleListForCall(false, "reinforcement-list", mission);

  // Filtres / recherche — on remplace addEventListener par .on... pour éviter les doublons
  const searchEl = document.getElementById("reinforcement-search-input");
  if (searchEl) {
    searchEl.oninput = () =>
      buildVehicleListForCall(false, "reinforcement-list", mission);
  }
  const typeEl = document.getElementById("reinforcement-type-select");
  if (typeEl) {
    typeEl.onchange = () =>
      buildVehicleListForCall(false, "reinforcement-list", mission);
  }

  // Délégation de clic pour les chips (un seul listener, pas de doublon)
  const chipGroup = document.querySelector("#reinforcement-panel .chip-group");
  if (chipGroup) {
    chipGroup.onclick = (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      chipGroup
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      buildVehicleListForCall(false, "reinforcement-list", mission);
    };
  }

  // Bouton unique d’envoi
  const sendBtn = document.getElementById("reinforcement-send-btn");
  if (sendBtn) {
    sendBtn.onclick = () => sendSelectedReinforcementsFromManage();
  }

  // 🔁 Refresh en direct SANS perdre les cases cochées
  // -> on reconstruit la liste en mode 'refresh' pour ne pas réinitialiser le staffVirtuel ni la sélection
  clearInterval(manageMissionInterval);
  manageMissionInterval = setInterval(() => {
    const isOpen = !document
      .getElementById("manage-modal")
      ?.classList.contains("hidden");
    if (!isOpen) {
      clearInterval(manageMissionInterval);
      return;
    }

    // 1) Rafraîchir la liste (mais pas si la souris est sur la liste OU un de ses descendants)
    const listEl = document.getElementById("reinforcement-list");
    if (listEl && !listEl.matches(":hover")) {
      refreshReinforcementStatusAndDistance();
    }

    // 2) Rafraîchir le panneau de gauche (contenu d'intervention)
    const stillExists = missions.some((m) => m.id === missionId);
    if (!stillExists) {
      document.getElementById("manage-modal").classList.add("hidden");
      clearInterval(manageMissionInterval);
      return;
    }
  }, 1000);
  // === Timer ER en direct ===
  clearInterval(window._timerERInterval);
  window._timerERInterval = setInterval(() => {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;

    mission.dispatched.forEach((d) => {
      const v = d.vehicle;
      if (v.status === "er" && v.arrivalTime) {
        const el = document
          .querySelector(
            `#manage-modal .vehicle-entry .status[data-vehicle-id="${v.id}"]`
          )
          ?.parentElement?.querySelector(".timer-er");

        if (el) {
          const secLeft = Math.max(
            0,
            Math.ceil((v.arrivalTime - Date.now()) / 1000)
          );
          el.textContent = `⏱ ${secLeft}s`;
        }
      }
    });
  }, 1000);
}

function refreshReinforcementStatusAndDistance() {
  const mission = missions.find((m) => m.id === REINFORCEMENT_STATE.missionId);
  if (!mission || !mission.position) return;

  const pos = mission.position;

  document
    .querySelectorAll("#manage-modal #reinforcement-list .vehicle-select-row")
    .forEach((row) => {
      const buildingId = row.dataset.buildingId;
      const vehicleId = row.dataset.vehicleId;

      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return;

      const vehicle = (building.vehicles || []).find(
        (v) => String(v.id) === String(vehicleId)
      );
      if (!vehicle) return;

      // Distance
      const origin = vehicle.marker?.getLatLng?.() || building.latlng;
      if (origin) {
        const dist = Math.round(map.distance(pos, origin));
        const dEl = row.querySelector(".vehicle-distance");
        if (dEl) dEl.textContent = `${dist} m`;
      }

      // Statut (sans toucher à la case)
      const sEl = row.querySelector(".status");
      if (sEl) {
        const cb = row.querySelector("input[type=checkbox]");
        const checked = cb?.checked;

        sEl.classList.remove("on", "off", "selected-synced");

        if (checked) {
          sEl.classList.add("selected-synced");
        }

        if (!sEl.classList.contains(vehicle.status)) {
          sEl.className =
            `status ${vehicle.status}` + (checked ? " selected-synced" : "");
        }

        sEl.textContent = (vehicle.status || "").toUpperCase();
      }
    });
}

let currentMissionForReinforcement = null;
let reinforcementInterval = null;

function sendSelectedReinforcementsFromManage() {
  const mission = missions.find((m) => m.id === REINFORCEMENT_STATE.missionId);
  if (!mission) return;

  const selected = Array.from(REINFORCEMENT_STATE.selected)
    .map((vId) => {
      let foundB = null,
        foundV = null;
      buildings.some((b) => {
        const v = b.vehicles.find((x) => x.id === vId);
        if (v) {
          foundB = b;
          foundV = v;
          return true;
        }
        return false;
      });
      return foundV && foundB ? { vehicle: foundV, building: foundB } : null;
    })
    .filter(Boolean);

  if (selected.length === 0) {
    alert("Aucun véhicule sélectionné.");
    return;
  }

  selected.forEach(({ vehicle, building }) => {
    dispatchVehicleToMission(vehicle, mission, building);
  });

  // après envoi : on nettoie sélection + prises (les compteurs réels se mettront à jour ailleurs)
  REINFORCEMENT_STATE.selected.clear();
  REINFORCEMENT_STATE.takenByVehicle = {};

  // refresh manage + liste
  refreshManageModal(mission.id);
  buildVehicleListForCall(false, "reinforcement-list", mission);

  scheduleAutoSave(300);
}

document.getElementById("reinforcement-send-btn").onclick = () => {
  const checkboxes = document.querySelectorAll(
    '#reinforcement-vehicles input[type="checkbox"]:checked'
  );

  if (checkboxes.length === 0) {
    alert("Sélectionnez au moins un véhicule.");
    return;
  }

  if (!currentMissionForReinforcement) {
    console.warn("[RENFORT] Aucune mission en cours !");
    return;
  }

  if (!currentMissionForReinforcement.vehicles) {
    currentMissionForReinforcement.vehicles = [];
  }

  const vehiclesToSend = [];
  const personnelVirtuel = {}; // Simulation pour toutes les casernes

  checkboxes.forEach((cb) => {
    const buildingId = cb.dataset.buildingId;
    const vehicleId = cb.dataset.vehicleId;

    const building = buildings.find((b) => b.id === buildingId);
    if (!building) {
      console.warn(`[RENFORT] Bâtiment introuvable pour ID: ${buildingId}`);
      return;
    }

    const vehicle = building.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || (vehicle.status !== "dc" && vehicle.status !== "ot")) {
      console.warn(
        `[RENFORT] Véhicule invalide : ${vehicle?.label} (${vehicle?.status})`
      );
      return;
    }

    const personnel = requiredPersonnel[vehicle.type] || 2;
    let engagedStaff = { pro: 0, vol: 0 };

    if (["cpi", "cs", "csp"].includes(building.type)) {
      // ---- SPLIT PRO/VOL ----
      if (!personnelVirtuel[buildingId]) {
        personnelVirtuel[buildingId] = {
          pro: building.personnelAvailablePro ?? building.personnelPro,
          vol: building.personnelAvailableVol ?? building.personnelVol,
        };
      }
      let proDispo = personnelVirtuel[buildingId].pro;
      let volDispo = personnelVirtuel[buildingId].vol;
      let takePro = Math.min(proDispo, personnel);
      let takeVol = Math.max(0, personnel - takePro);
      if (takePro + takeVol >= personnel) {
        engagedStaff = { pro: takePro, vol: takeVol };
        personnelVirtuel[buildingId].pro -= takePro;
        personnelVirtuel[buildingId].vol -= takeVol;
      } else {
        // Pas assez de personnel pro/vol
        console.warn(
          `[RENFORT] Pas assez de personnel pro/vol dans ${building.name} pour ${vehicle.label}`
        );
        return;
      }
    } else if ("personnelAvailable" in building) {
      // ---- LOGIQUE CLASSIQUE ----
      if (typeof personnelVirtuel[buildingId] === "undefined") {
        personnelVirtuel[buildingId] = building.personnelAvailable;
      }
      let dispo = personnelVirtuel[buildingId];
      if (dispo >= personnel) {
        personnelVirtuel[buildingId] -= personnel;
      } else {
        console.warn(
          `[RENFORT] Pas assez de personnel dans ${building.name} pour ${vehicle.label} (restant simulé: ${dispo})`
        );
        return;
      }
    }

    // Ajoute dans mission.vehicles si absent
    if (
      !currentMissionForReinforcement.vehicles.some(
        (v) => v.vehicle && v.vehicle.id === vehicle.id
      )
    ) {
      currentMissionForReinforcement.vehicles.push({
        building,
        vehicle,
        personnel,
        engagedStaff, // utile pour les casernes
      });
    }

    // Ajoute dans la liste à renvoyer
    vehiclesToSend.push({
      building,
      vehicle,
      personnel,
      engagedStaff,
    });
  });

  // Fonction spécifique renfort
  dispatchReinforcementsToMission(
    currentMissionForReinforcement,
    vehiclesToSend
  );

  if (typeof scheduleAutoSave === "function") scheduleAutoSave();
};

function clearHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";
  localStorage.setItem("rescueManagerSave", JSON.stringify(getState())); // sauvegarde propre
}

function deleteVehicle(safeId, vehicleId) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  const index = building.vehicles.findIndex((v) => v.id === vehicleId);
  if (index === -1) return;

  const vehicle = building.vehicles[index];

  // Supprimer le marker de la carte si présent
  if (vehicle.marker && map.hasLayer(vehicle.marker)) {
    map.removeLayer(vehicle.marker);
  }

  building.vehicles.splice(index, 1);

  // ✅ Met à jour la liste dans le modal de gestion
  updateVehicleListDisplay(safeId);
  updateSidebarVehicleList(safeId);

  // ✅ Met à jour la sidebar
  refreshBuildingStatus(building);

  // ✅ Ferme le modal de suppression ou le met à jour
  const deleteModal = document.getElementById("vehicle-delete-modal");
  if (building.vehicles.length === 0) {
    deleteModal.classList.add("hidden");
  } else {
    openVehicleDashboard(safeId); // pour recharger la liste
  }

  scheduleAutoSave();
}

function closeManageModal() {
  document.getElementById("manage-modal").classList.add("hidden");
  clearInterval(window._timerERInterval);
}

document.getElementById("launch-mission-btn").addEventListener("click", () => {
  if (!currentCallMission) return;

  const checkboxes = document.querySelectorAll(
    '#vehicle-list input[type="checkbox"]:checked'
  );
  if (checkboxes.length === 0) {
    alert("Veuillez sélectionner au moins un véhicule.");
    return;
  }

  currentCallMission.vehicles = [];

  currentCallMission.departLabel =
    currentCallMission.departLabel || "Départ personnalisé";

  console.log(
    `[DEBUG] Début du traitement du lancement de mission ${currentCallMission.id}`
  );

  const template = MISSION_TYPES[currentCallMission.sourceType]?.find(
    (m) => m.type === currentCallMission.solutionType
  );
  if (!template) {
    alert("Erreur : modèle de mission introuvable.");
    return;
  }

  const personnelVirtuel = {};

  checkboxes.forEach((box) => {
    const buildingId = box.dataset.buildingId;
    const vehicleId = box.dataset.vehicleId;

    const building = buildings.find((b) => b.id === buildingId);
    if (!building) {
      console.warn(`[DEBUG] Bâtiment introuvable pour ID: ${buildingId}`);
      return;
    }

    const vehicle = building.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || (vehicle.status !== "dc" && vehicle.status !== "ot")) {
      console.warn(
        `[DEBUG] Véhicule invalide : ${vehicle?.label} (${vehicle?.status})`
      );
      return;
    }

    const personnel = requiredPersonnel[vehicle.type] || 2;
    const isAlreadyOccuped = vehicle.status === "ot" && vehicle.retourEnCours;

    if (isAlreadyOccuped) {
      currentCallMission.vehicles.push({
        type: vehicle.type,
        personnel,
        vehicle,
        building,
      });
      console.log(
        `[DEBUG] ${vehicle.label} validé – déjà engagé (OT), pas de check personnel`
      );
    } else if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // ----- SPLIT PRO/VOL -----
      // Init virtuel
      if (!personnelVirtuel[buildingId]) {
        personnelVirtuel[buildingId] = {
          pro: building.personnelAvailablePro ?? building.personnelPro,
          vol: building.personnelAvailableVol ?? building.personnelVol,
        };
      }
      let proDispo = personnelVirtuel[buildingId].pro;
      let volDispo = personnelVirtuel[buildingId].vol;
      let takePro = Math.min(proDispo, personnel);
      let takeVol = Math.max(0, personnel - takePro);
      if (takePro + takeVol >= personnel) {
        currentCallMission.vehicles.push({
          type: vehicle.type,
          personnel,
          vehicle,
          building,
          engagedStaff: { pro: takePro, vol: takeVol }, // Pour suivi plus tard
        });
        personnelVirtuel[buildingId].pro -= takePro;
        personnelVirtuel[buildingId].vol -= takeVol;
        console.log(
          `[DEBUG] ${vehicle.label} validé – ${takePro} pro, ${takeVol} vol (restant pro:${personnelVirtuel[buildingId].pro}, vol:${personnelVirtuel[buildingId].vol})`
        );
      } else {
        console.warn(
          `[DEBUG] Pas assez de personnel pro/vol dans ${building.name} pour ${vehicle.label}`
        );
      }
    } else {
      // ----- LOGIQUE CLASSIQUE -----
      const dispoActuel =
        personnelVirtuel[buildingId] ?? building.personnelAvailable;
      if (dispoActuel >= personnel) {
        currentCallMission.vehicles.push({
          type: vehicle.type,
          personnel,
          vehicle,
          building,
        });
        personnelVirtuel[buildingId] = dispoActuel - personnel;
        console.log(
          `[DEBUG] ${vehicle.label} validé – Perso requis: ${personnel}, reste simulé: ${personnelVirtuel[buildingId]}`
        );
      } else {
        console.warn(
          `[DEBUG] Pas assez de personnel dans ${building.name} pour ${vehicle.label} (restant simulé: ${dispoActuel})`
        );
      }
    }
  });

  if (!currentCallMission.vehicles.length) {
    alert("Aucun véhicule éligible trouvé (disponibilité, personnel).");
    return;
  }

  const impacted = new Set(currentCallMission.vehicles.map((v) => v.building));
  SIMULATION_ACTIVE = true;
  impacted.forEach((building) => {
    simulatePersonnelUI(building, currentCallMission.vehicles); // ✅
  });
  SIMULATION_ACTIVE = false;

  // UI
  document.getElementById("call-modal").classList.add("hidden");
  if (currentCallMission.domElement) {
    const p = currentCallMission.domElement.querySelector("p");
    if (p) p.textContent = currentCallMission.address || "En attente";
  }
  currentCallMission.domElement.querySelector("button").textContent = "Gérer";
  currentCallMission.domElement.querySelector("button").onclick = () =>
    openManageMission(currentCallMission.id);

  const matchingTemplate = MISSION_TYPES.caserne.find(
    (m) => m.label === currentCallMission.label
  );
  if (matchingTemplate) {
    currentCallMission.solutionType = matchingTemplate.type;
  }

  if (!currentCallMission.active) {
    dispatchMission(currentCallMission.id);
  }
});

// Fonction de gestion de l'ouverture et la fermeture de l'interface de gestion des bâtiments
function toggleManagement(safeId) {
  const div = document.getElementById(`manage-${safeId}`);
  const vehList = document.getElementById(`veh-${safeId}`);
  const deleteBtn = document.getElementById(`delete-${safeId}`);
  const typeLabel = document.getElementById(`type-${safeId}`);

  const isOpen = div && !div.classList.contains("hidden");

  if (div) div.classList.toggle("hidden");
  if (vehList) {
    vehList.classList.toggle("vehicle-list-hidden");
    if (!vehList.classList.contains("vehicle-list-hidden")) {
      setTimeout(() => applyVehicleItemStyle(vehList), 100);
    }
  }
  if (deleteBtn) deleteBtn.classList.toggle("hidden");
  if (typeLabel) typeLabel.classList.toggle("hidden");
}

document.getElementById("clear-missions-btn").addEventListener("click", () => {
  missions.forEach((m) => {
    m.marker?.remove();
    m.domElement?.remove();
  });
  missions.length = 0;
  document.getElementById("mission-list").innerHTML = "";
});

function openBuildingModal(safeId) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;
  currentManagedBuilding = building;

  const allowedVehicles = ALLOWED_VEHICLES_BY_BUILDING[building.type] || [];

  const modal = document.getElementById("building-modal");
  const content = modal.querySelector(".modal-content");

  // 🆕 Génération dynamique des boutons de catégorie
  let vehicleButtonsHTML = "";
  for (const category of allowedVehicles) {
    const label =
      {
        SAP: "🚑 SAP",
        INC: "🔥 INC",
        DIV: "🛠 DIV",
        SMUR: "🏥 SMUR",
        POLICE: "🚓 POLICE",
      }[category] || category;

    vehicleButtonsHTML += `<button onclick="displayVehicleCategory('${safeId}', '${category}')">${label}</button>`;
  }

  // 🧱 Contenu du modal
  content.innerHTML = `
      <h3 style="margin-bottom: 8px;">🚧 Gérer ${building.name}</h3>

      <div class="modal-section">
        <p class="building-type-label" id="type-${safeId}">
          Type : ${building.type.toUpperCase()}${
    MAX_PERSONNEL_BY_BUILDING[building.type]
      ? ` – Personnel Max : ${MAX_PERSONNEL_BY_BUILDING[building.type]}`
      : ""
  }
        </p>
        <p id="modal-personnel">
          <strong>Personnel actuel :</strong>
          ${
            building.type === "cpi" ||
            building.type === "cs" ||
            building.type === "csp"
              ? `Pro <span id="modal-pro-avail">${
                  building.personnelAvailablePro || 0
                }</span>/<span id="modal-pro">${building.personnelPro}</span>
                &nbsp;|&nbsp; Vol <span id="modal-vol-avail">${
                  building.personnelAvailableVol || 0
                }</span>/<span id="modal-vol">${building.personnelVol}</span>`
              : `${building.personnelAvailable}/${building.personnel}`
          }
        </p>
        <!-- 💡 Boutons de recrutement ici -->
        <div class="button-row recruit-row" style="margin-bottom:8px;">
          ${
            building.type === "cpi"
              ? `
                <div class="recruit-block-vertical">
                  <button class="btn-recruit" onclick="recruit('${safeId}', 'vol')">
                    👷 Recruter volontaire (${ECONOMY.recruitCostVol}€)
                  </button>
                  <div class="desc-recruit">${descVol}</div>
                </div>
                `
              : building.type === "cs" || building.type === "csp"
              ? `
                  <div class="recruit-row">
                    <div class="recruit-block-vertical">
                      <button class="btn-recruit" onclick="recruit('${safeId}', 'pro')">
                        👷 Recruter professionnel (${ECONOMY.recruitCostPro}€)
                      </button>
                      <div class="desc-recruit">${descPro}</div>
                    </div>
                    <div class="recruit-block-vertical">
                      <button class="btn-recruit" onclick="recruit('${safeId}', 'vol')">
                        👷 Recruter volontaire (${ECONOMY.recruitCostVol}€)
                      </button>
                      <div class="desc-recruit">${descVol}</div>
                    </div>
                  </div>
                  `
              : `
                  <button class="btn-recruit" onclick="recruit('${safeId}')">
                    👷 Recruter (${ECONOMY.recruitCost}€)
                  </button>
                `
          }

        </div>
      </div>

      ${
        allowedVehicles.length > 0
          ? `
      <div class="modal-section">
        <h4>➕ Ajouter un véhicule</h4>
        <div class="button-row">
          ${vehicleButtonsHTML}
        </div>
        <div id="vehicle-choice-container"></div>
      </div>`
          : ""
      }

      <div class="modal-section">
        <h4>🚗 Véhicules en service</h4>
        <div id="vehicle-list-wrapper">${renderExistingVehicles(building)}</div>
      </div>

      <div class="modal-section button-row">
        ${
          building.type === "hopital"
            ? `
        <button onclick="openHospitalModal('${building.id}')">🩺 Gérer les patients</button>
      `
            : ""
        }
        <button onclick="openVehicleBoardModal('${safeId}')">🚗 Tableau de bord véhicules</button>
        <button id="delete-building-btn" style="background:#e74c3c; color:white;">Supprimer bâtiment</button>   
        <button onclick="closeBuildingModal()">❌ Fermer</button>
      </div>
    `;

  document.getElementById("delete-building-btn").onclick = function () {
    if (confirm("Supprimer définitivement ce bâtiment et tout son contenu ?")) {
      deleteBuilding(safeId); // safeId utilisé dans ce modal
    }
  };

  modal.classList.remove("hidden");

  // Par défaut : première catégorie affichée si dispo
  if (allowedVehicles.length > 0) {
    displayVehicleCategory(safeId, allowedVehicles[0]);
  }
}

function deleteBuilding(safeId) {
  const idx = buildings.findIndex((b) => getSafeId(b) === safeId);
  if (idx === -1) return;

  const building = buildings[idx];
  // Retirer tous les marqueurs de véhicules
  building.vehicles?.forEach((v) => {
    if (v.marker && map.hasLayer(v.marker)) {
      map.removeLayer(v.marker);
    }
  });
  // Retirer le marqueur du bâtiment
  if (building.marker && map.hasLayer(building.marker)) {
    map.removeLayer(building.marker);
  }
  // Retirer du tableau global
  buildings.splice(idx, 1);
  // Retirer du DOM (sidebar)
  const block =
    document.querySelector(`[id^="building-block-"][id$="${safeId}"]`) ||
    document.getElementById(`building-block-${safeId}`);
  if (block) block.remove();
  closeBuildingModal && closeBuildingModal();
  buildingList.innerHTML = "";

  // 🔁 Régénère chaque bloc dans la sidebar
  buildings.forEach((b) => {
    const { type, name, latlng } = b;
    const safeId = getSafeId(b);
    const labelPrefix =
      type === "hopital" ? "CH" : type === "police" ? "Commissariat" : "CIS";

    const li = document.createElement("li");
    li.classList.add("building-block");
    li.id = `building-block-${safeId}`;
    li.innerHTML = `
      <div class="building-header">
        <div class="building-title">
          <strong>
            ${labelPrefix} ${name}
            (<span id="staff-avail-${safeId}">${
      b.personnelAvailable
    }</span>/<span id="staff-${safeId}">${b.personnel}</span>)
            ${
              type === "hopital"
                ? `<p>🛏 Patients : <span id="capacity-${safeId}">${
                    b.patients?.length || 0
                  }/${b.capacity}</span></p>`
                : ""
            }
          </strong>
          <p class="building-type-label hidden" id="type-${safeId}">Type : ${type.toUpperCase()}</p>
        </div>
        <button id="delete-${safeId}" class="hidden" onclick="deleteBuilding('${safeId}')">🗑 Supprimer</button>
        <button class="toggle-veh-btn" onclick="toggleVehicleList('${safeId}', this)">▼</button>
        <button onclick="openBuildingModal('${safeId}')">Gérer</button>
      </div>
      <ul id="veh-${safeId}" class="vehicle-list"></ul>
    `;
    buildingList.appendChild(li);

    updateSidebarVehicleList(safeId); // pour afficher les véhicules
  });
  scheduleAutoSave();
}

function openVehicleBoardModal(safeId) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;
  const ul = document.getElementById("vehicle-board-list");
  if (!ul) {
    alert("Erreur technique : <ul id='vehicle-board-list'> absent du HTML.");
    return;
  }
  ul.innerHTML = "";
  building.vehicles.forEach((vehicle) => {
    const li = document.createElement("li");
    li.innerHTML = `${vehicle.label} (${vehicle.type}) <button onclick="openVehicleDashboard('${vehicle.id}')">Gérer</button>`;
    ul.appendChild(li);
  });
  document.getElementById("vehicle-board-modal").classList.remove("hidden");
}

function closeVehicleBoardModal() {
  document.getElementById("vehicle-board-modal").classList.add("hidden");
}

function openVehicleDashboard(vehicleId) {
  let vehicle = null,
    building = null;
  buildings.forEach((b) => {
    const found = b.vehicles.find((v) => v.id === vehicleId);
    if (found) {
      vehicle = found;
      building = b;
    }
  });
  if (!vehicle) return;
  // SÉCURITÉ : vérifie l'existence des éléments
  const title = document.getElementById("veh-title");
  const stats = document.getElementById("veh-stats");
  const wear = document.getElementById("veh-wear");
  const delBtn = document.getElementById("veh-delete-btn");
  const maintBtn = document.getElementById("veh-maintenance-btn");
  if (!title || !stats || !wear || !maintBtn || !delBtn) {
    alert("Erreur technique : Un élément du modal véhicule manque.");
    return;
  }

  title.textContent = `${vehicle.label} (${vehicle.type})`;
  stats.textContent = `Kilométrage total : ${(
    vehicle.kilometrage / 1000
  ).toFixed(2)} km`;
  document.getElementById("veh-missions").textContent = `Missions réalisées : ${
    vehicle.missionsCount || 0
  }`;
  wear.textContent = `Usure : ${vehicle.usure}%`;

  // Affichage/masquage du bouton maintenance
  if (vehicle.usure < 80) {
    maintBtn.style.display = "none";
  } else {
    maintBtn.style.display = !vehicle.maintenance ? "" : "none";
    maintBtn.disabled = !!vehicle.maintenance; // Désactivé si déjà en réparation
    maintBtn.textContent =
      vehicle.maintenance || vehicle.status === "hs"
        ? `Envoyer en maintenance (${ECONOMY.maintenanceCost} €)`
        : `Envoyer en maintenance (${ECONOMY.maintenanceCost} €)`;

    maintBtn.onclick = function () {
      startVehicleRepair(vehicleId);
    };
  }

  delBtn.onclick = () => {
    if (confirm("Supprimer ce véhicule ?")) {
      deleteVehicle(getSafeId(building), vehicleId);
      closeVehicleDashboard();
      openVehicleBoardModal(getSafeId(building));
    }
  };
  document.getElementById("vehicle-dashboard-modal").classList.remove("hidden");
}

function closeVehicleDashboard() {
  document.getElementById("vehicle-dashboard-modal").classList.add("hidden");
}

function closeBuildingModal() {
  const modal = document.getElementById("building-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.querySelector(".modal-content").innerHTML = "";
  }
  currentManagedBuilding = null;
}

function refreshManageModal() {
  const modal = document.getElementById("manage-modal");
  if (modal.classList.contains("hidden")) return;

  const missionId = modal.dataset.missionId;
  if (!missionId) return;

  const mission = missions.find((m) => m.id === missionId);
  if (!mission) {
    modal.classList.add("hidden");
    return;
  }

  openManageMission(missionId); // Réutilise ta logique
}

function cancelVehicleFromMission(missionId, vehicleId) {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) return;

  const entry = mission.dispatched.find((d) => d.vehicle.id === vehicleId);
  if (!entry) return;

  const { vehicle, building } = entry;

  entry.canceled = true; // Marque comme annulé

  if (vehicle.returnAnimation) stopActiveRoute(vehicle);
  vehicle.arrivalTime = null;
  vehicle.retourEnCours = true;
  entry.canceled = true;
  setVehicleStatus(vehicle, "ot", { mission, building });

  const startPoint = vehicle.marker?.getLatLng?.() || vehicle.lastKnownPosition;
  const target = building.latlng;

  fetchRouteCoords(startPoint, target).then((coords) => {
    if (coords.length < 2) {
      vehicle.lastKnownPosition = target;
      vehicle.ready = true;
      vehicle.status = "dc";

      // AJOUT ici : restitution personnel pompier ou police
      if (
        building.type === "cpi" ||
        building.type === "cs" ||
        building.type === "csp"
      ) {
        const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Toujours stocké à l'engagement
        building.personnelAvailablePro =
          (building.personnelAvailablePro || 0) + (engaged.pro || 0);
        building.personnelAvailableVol =
          (building.personnelAvailableVol || 0) + (engaged.vol || 0);
        vehicle._engagedStaff = { pro: 0, vol: 0 };
      } else {
        building.personnelAvailable =
          (building.personnelAvailable || 0) + (vehicle.required || 0);
      }
      updateVehicleStatus(vehicle, "dc");
      logVehicleRadio(vehicle, "dc", { targetBuilding: building });
      refreshBuildingStatus(building);
      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));
      applyVehicleWear(vehicle);
      scheduleAutoSave();
      return;
    }

    const segmentDistances = [];
    let totalRouteDistance = 0;
    for (let i = 1; i < coords.length; i++) {
      const d = coords[i - 1].distanceTo(coords[i]);
      segmentDistances.push(d);
      totalRouteDistance += d;
    }

    const cumulativeDistances = [0];
    segmentDistances.forEach((d) =>
      cumulativeDistances.push(
        cumulativeDistances[cumulativeDistances.length - 1] + d
      )
    );

    {
      const speedFactor = getMsPerMeter(vehicle);
      const speedMps = 1000 / speedFactor;
      let prevLatLng = coords[0];

      vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
        coords,
        speedMps,
        marker: vehicle.marker,
        onProgress: ({ pos }) => {
          if (!pos) return;
          const distStep = prevLatLng.distanceTo(pos);
          vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
          prevLatLng = pos;
          vehicle.lastKnownPosition = pos;
        },
        onDone: () => {
          vehicle.retourEnCours = false;
          vehicle.ready = true;
          vehicle.status = "dc";

          // RESTITUTION personnel pompier / police (identique à l’existant)
          if (
            building.type === "cpi" ||
            building.type === "cs" ||
            building.type === "csp"
          ) {
            const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 };
            building.personnelAvailablePro =
              (building.personnelAvailablePro || 0) + (engaged.pro || 0);
            building.personnelAvailableVol =
              (building.personnelAvailableVol || 0) + (engaged.vol || 0);
            vehicle._engagedStaff = { pro: 0, vol: 0 };
          } else {
            building.personnelAvailable =
              (building.personnelAvailable || 0) + (vehicle.required || 0);
          }

          updateVehicleStatus(vehicle, "dc");
          refreshBuildingStatus(building);
          refreshVehicleStatusForBuilding(building);
          updateVehicleListDisplay(getSafeId(building));
          scheduleAutoSave();
        },
      });
    }
  });

  refreshManageModal && refreshManageModal(); // si fonction de refresh dynamique activée
}

setInterval(() => {
  const modal = document.getElementById("hospital-modal");
  if (!modal || modal.classList.contains("hidden")) return;

  const title = document.getElementById("hospital-name")?.textContent;
  if (!title) return;

  const currentHospital = buildings.find(
    (b) => b.type === "hopital" && title.includes(b.name)
  );

  if (currentHospital) {
    openHospitalModal(currentHospital.id); // recharge
  }
}, 1000);

function buildDepartTreeUI() {
  const section = document.getElementById("depart-type-section");
  if (!section) return;

  // Éléments (déclarés dans index.html)
  const btnFire = document.getElementById("btn-service-pompiers");
  const btnPolice = document.getElementById("btn-service-police");
  const selCat = document.getElementById("select-category");
  const selMission = document.getElementById("select-mission");
  const rowSub = document.getElementById("row-submission");
  const selSub = document.getElementById("select-submission");
  const launchBtn = document.getElementById("launch-mission-btn");

  // Service courant par défaut
  if (!currentCallMission._serviceKey) {
    currentCallMission._serviceKey = "pompiers";
  }

  const setServiceActive = (key) => {
    currentCallMission._serviceKey = key;
    btnFire.classList.toggle("active", key === "pompiers");
    btnPolice.classList.toggle("active", key === "police");
    populateCategories();
    selMission.innerHTML = "";
    selSub.innerHTML = "";
    rowSub.classList.add("hidden");
    currentCallMission.departSelected = null;
    currentCallMission.departLabel = null;
    launchBtn.classList.add("hidden");
  };

  const populateCategories = () => {
    const service = DEPART_TREE[currentCallMission._serviceKey];
    selCat.innerHTML =
      '<option value="" disabled selected>Choisir une catégorie…</option>';
    Object.keys(service.categories).forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = service.categories[k].label;
      selCat.appendChild(opt);
    });
  };

  const populateMissions = () => {
    selMission.innerHTML =
      '<option value="" disabled selected>Choisir…</option>';
    selSub.innerHTML = "";
    rowSub.classList.add("hidden");
    const service = DEPART_TREE[currentCallMission._serviceKey];
    const catKey = selCat.value;
    const category = service.categories[catKey];
    if (!category) return;

    for (const mLabel in category.missions) {
      const opt = document.createElement("option");
      opt.value = mLabel;
      opt.textContent = mLabel;
      opt.dataset.hasSub =
        typeof category.missions[mLabel] === "object" &&
        !Array.isArray(category.missions[mLabel])
          ? "1"
          : "0";
      selMission.appendChild(opt);
    }
  };

  const populateSubmissionsIfAny = () => {
    const service = DEPART_TREE[currentCallMission._serviceKey];
    const catKey = selCat.value;
    const category = service.categories[catKey];
    const missionLabel = selMission.value;
    const missionGroup = category?.missions?.[missionLabel];
    if (!missionGroup) return;

    if (typeof missionGroup === "object" && !Array.isArray(missionGroup)) {
      // Un niveau supplémentaire → afficher la liste des précisions
      rowSub.classList.remove("hidden");
      selSub.innerHTML =
        '<option value="" disabled selected>Préciser…</option>';
      for (const subLabel in missionGroup) {
        const opt = document.createElement("option");
        opt.value = subLabel;
        opt.textContent = subLabel;
        selSub.appendChild(opt);
      }
      currentCallMission.departSelected = null;
      currentCallMission.departLabel = null;
      launchBtn.classList.add("hidden");
    } else {
      // Directement une liste d’engins requise
      currentCallMission.departSelected = missionGroup;
      currentCallMission.departLabel = missionLabel;
      document
        .getElementById("vehicle-selection-section")
        .classList.remove("hidden");
      launchBtn.classList.remove("hidden");
      buildVehicleListForCall(true);
      if (typeof refreshRecap === "function") refreshRecap();
      if (typeof scheduleAutoSave === "function") scheduleAutoSave();
    }
  };

  const finalizeWithSub = () => {
    const service = DEPART_TREE[currentCallMission._serviceKey];
    const catKey = selCat.value;
    const category = service.categories[catKey];
    const missionLabel = selMission.value;
    const subLabel = selSub.value;
    if (!category || !missionLabel || !subLabel) return;
    const req = category.missions[missionLabel][subLabel];
    currentCallMission.departSelected = req;
    currentCallMission.departLabel = missionLabel + " - " + subLabel;
    document
      .getElementById("vehicle-selection-section")
      .classList.remove("hidden");
    launchBtn.classList.remove("hidden");
    buildVehicleListForCall(true);

    if (typeof refreshRecap === "function") refreshRecap();
    if (typeof scheduleAutoSave === "function") scheduleAutoSave();
  };

  // Binder une seule fois
  if (!section.dataset.dropdownInit) {
    btnFire.addEventListener("click", () => setServiceActive("pompiers"));
    btnPolice.addEventListener("click", () => setServiceActive("police"));
    selCat.addEventListener("change", () => {
      populateMissions();
      populateSubmissionsIfAny();
    });
    selMission.addEventListener("change", () => populateSubmissionsIfAny());
    selSub.addEventListener("change", finalizeWithSub);
    section.dataset.dropdownInit = "1";
  }

  // Initial
  setServiceActive(currentCallMission._serviceKey);
}

// Met ça dans ui.js ou buildings.js
let vehiclesAreCollapsed = false;

function toggleAllVehicleLists(forceState = null) {
  const vehicleLists = document.querySelectorAll(".vehicle-list");
  vehiclesAreCollapsed =
    forceState !== null ? forceState : !vehiclesAreCollapsed;

  vehicleLists.forEach((list) => {
    if (vehiclesAreCollapsed) {
      list.classList.add("hidden");
    } else {
      list.classList.remove("hidden");
    }
  });

  // Synchronise les flèches individuelles
  const btns = document.querySelectorAll(".toggle-veh-btn");
  btns.forEach((btn) => (btn.textContent = vehiclesAreCollapsed ? "▲" : "▼"));
}

// Associe le bouton à ta fonction
document.getElementById("toggle-all-vehicles-btn").onclick = () => {
  toggleAllVehicleLists();
};

function updateMissionVictimsUI(mission) {
  const div = document.getElementById("victims-panel");
  if (!div || !mission.victims) return;

  const hasVehicleOnSite =
    mission.dispatched &&
    mission.dispatched.some((d) => d.vehicle && d.vehicle.status === "al");
  if (!hasVehicleOnSite) {
    div.innerHTML = `<h4>Victimes</h4><p>Aucun véhicule sur place. Victimes inconnues.</p>`;
    return;
  }

  const total = mission.victims.length;
  const treated = mission.victims.filter(
    (v) => v.treated || v.transported || v.leaveOnSite
  ).length;

  div.innerHTML = `
    <h4>Victimes (${treated}/${total})</h4>
    <ul class="victims-list">
      ${mission.victims
        .map((v, i) => {
          let status = "";
          if (v.leaveOnSite) status = "Non transportée";
          else if (v.transported) status = "Transportée";
          else if (v.treated && !v.inTransport) {
            status = "Prête à transporter";
            status += ` <button class="btn-transport" onclick="openHospitalChoiceModal('${v.id}', '${mission.id}')">🚑 Transporter</button>`;
          } else if (v.inTransport) {
            status = "En transport vers l'hôpital";
          } else if (v.beingTreated)
            status =
              'Traitement: <progress max="100" value="' +
              v.progress.toFixed(1) +
              '"></progress> ' +
              v.progress.toFixed(0) +
              "%";
          else if (v.waitingForSMUR) status = "En attente SMUR";
          else status = "En attente de VSAV";

          // Nom de la victime
          const name = v.name || `Victime ${i + 1}`;
          // Traduction et emoji
          const severityFr = PATIENT_STATUS_FR[v.severity] || v.severity;
          const emoji =
            v.severity === "critical"
              ? "🟥"
              : v.severity === "moderate"
              ? "🟧"
              : "🟩";

          return `
          <li>
            👤 <strong>${name}</strong> — 
            <span>${emoji} ${severityFr}</span>
            <span> | ${status}</span>
          </li>
        `;
        })
        .join("")}
    </ul>
  `;
}

function openHospitalChoiceModal(victimId, missionId) {
  const mission = missions.find((m) => m.id === missionId);
  const victim = mission.victims.find((v) => v.id === victimId);
  const hospitals = buildings.filter((b) => b.type === "hopital");

  // Distance utilitaire (Haversine)
  function getDistanceBetween(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x = dLon * Math.cos((lat1 + lat2) / 2);
    const y = dLat;
    return R * Math.sqrt(x * x + y * y);
  }

  // Position de référence (mission)
  const pos = mission.position ||
    mission.latlng ||
    mission.location || { lat: mission.lat, lng: mission.lng };

  let html = `<h2>Choisir un hôpital pour ${victim.name || victim.id}</h2><ul>`;

  if (hospitals.length === 0) {
    // Uniquement ambulancier privé si aucun hôpital
    html += `<li>
      <button style="background:#dedede;color:#222;font-weight:bold;"
        onclick="handleNoHospitalTransport('${victimId}', '${missionId}')">
        🚑 Prise en charge par ambulancier privé
      </button>
    </li>`;
  } else {
    hospitals.forEach((h) => {
      h.distance = getDistanceBetween(pos, h.latlng);
    });
    hospitals.sort((a, b) => a.distance - b.distance);

    hospitals.forEach((h) => {
      const reserved = h.reservedPatients ? h.reservedPatients.length : 0;
      const totalPatients = (h.patients?.length || 0) + reserved;
      const isFull = totalPatients >= h.capacity;

      html += `<li>
        <strong>${h.name}</strong> (${totalPatients}/${
        h.capacity
      }) - ${h.distance.toFixed(1)} km
        <button
          onclick="${
            isFull
              ? ""
              : `launchPatientTransport('${victimId}', '${missionId}', '${h.id}')`
          }"
          style="${
            isFull ? "background: #ccc; color: #888; cursor: not-allowed;" : ""
          }"
          ${isFull ? "disabled" : ""}>
          ${isFull ? "Aucun lit dispo" : "Envoyer ici"}
        </button>
      </li>`;
    });

    // Toujours afficher ambulancier privé en dernier
    html += `<li style="margin-top:8px;">
      <button style="background:#dedede;color:#222;font-weight:bold;" 
        onclick="handleNoHospitalTransport('${victimId}', '${missionId}')">
        🚑 Prise en charge par ambulancier privé
      </button>
    </li>`;
  }

  html += '</ul><button onclick="closeCustomModal()">Annuler</button>';

  showCustomModal(html);
}

function handleNoHospitalTransport(victimId, missionId) {
  closeCustomModal();

  const mission = missions.find((m) => m.id === missionId);
  if (!mission) return;

  const dispatched =
    (mission.dispatched || []).find(
      (d) =>
        d.victimId === victimId &&
        d.vehicle &&
        d.vehicle.type === "VSAV" &&
        !d.canceled
    ) ||
    (mission.dispatched || []).find(
      (d) => d.vehicle && d.vehicle.type === "VSAV" && !d.canceled
    );

  if (!dispatched) return;
  const { vehicle, building } = dispatched;

  const victim = mission.victims.find((v) => v.id === victimId);
  if (victim) {
    victim.transported = true;
    verifyMissionVehicles(mission);
  }

  // Passe immédiatement en retour (OT)

  vehicle.assignedVictim = null;
  vehicle.retourEnCours = true;
  updateVehicleStatus(vehicle, "ot", { mission, building }); // Pas de setVehicleStatus ici

  const startPoint = vehicle.marker?.getLatLng?.() || vehicle.lastKnownPosition;
  const target = building.latlng;

  fetchRouteCoords(startPoint, target).then((coords) => {
    if (coords.length < 2) {
      // === RESTITUTION DU PERSONNEL ===
      if (["cpi", "cs", "csp"].includes(building.type)) {
        const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 };
        building.personnelAvailablePro =
          (building.personnelAvailablePro || 0) + (engaged.pro || 0);
        building.personnelAvailableVol =
          (building.personnelAvailableVol || 0) + (engaged.vol || 0);
        vehicle._engagedStaff = { pro: 0, vol: 0 };
      } else {
        building.personnelAvailable =
          (building.personnelAvailable || 0) + (vehicle.required || 0);
      }

      vehicle.lastKnownPosition = target;
      vehicle.ready = true;
      vehicle.status = "dc";
      updateVehicleStatus(vehicle, "dc");
      refreshBuildingStatus(building);
      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));
      applyVehicleWear(vehicle);
      scheduleAutoSave();
      return;
    }

    const segmentDistances = [];
    let totalRouteDistance = 0;
    for (let i = 1; i < coords.length; i++) {
      const d = coords[i - 1].distanceTo(coords[i]);
      segmentDistances.push(d);
      totalRouteDistance += d;
    }

    const cumulativeDistances = [0];
    segmentDistances.forEach((d) =>
      cumulativeDistances.push(
        cumulativeDistances[cumulativeDistances.length - 1] + d
      )
    );

    {
      const speedFactor = getMsPerMeter(vehicle);
      const speedMps = 1000 / speedFactor;
      let prevLatLng = coords[0];

      vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
        coords,
        speedMps,
        marker: vehicle.marker,
        onProgress: ({ pos }) => {
          if (!pos) return;
          const distStep = prevLatLng.distanceTo(pos);
          vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
          prevLatLng = pos;
          vehicle.lastKnownPosition = pos;
        },
        onDone: () => {
          // === RESTITUTION DU PERSONNEL ===
          if (["cpi", "cs", "csp"].includes(building.type)) {
            const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 };
            building.personnelAvailablePro =
              (building.personnelAvailablePro || 0) + (engaged.pro || 0);
            building.personnelAvailableVol =
              (building.personnelAvailableVol || 0) + (engaged.vol || 0);
            vehicle._engagedStaff = { pro: 0, vol: 0 };
          } else {
            building.personnelAvailable =
              (building.personnelAvailable || 0) + (vehicle.required || 0);
          }

          vehicle.retourEnCours = false;
          vehicle.ready = true;
          vehicle.status = "dc";
          updateVehicleStatus(vehicle, "dc");
          refreshBuildingStatus(building);
          refreshVehicleStatusForBuilding(building);
          updateVehicleListDisplay(getSafeId(building));
          applyVehicleWear(vehicle);
          scheduleAutoSave();
        },
      });
    }
  });
}

function launchPatientTransport(victimId, missionId, hospitalId) {
  const mission = missions.find((m) => m.id === missionId);
  const victim = mission.victims.find((v) => v.id === victimId);
  const hospital = buildings.find((b) => b.id === hospitalId);

  const vsav = (mission.dispatched || [])
    .map((d) => d.vehicle)
    .find(
      (v) =>
        v.type === "VSAV" &&
        v.status === "al" &&
        !v.transporting &&
        (!v.assignedVictim || v.assignedVictim.id === victim.id)
    );

  if (!vsav) {
    alert("Aucun VSAV disponible pour le transport !");
    return;
  }

  sendPatientToHospital(vsav, mission, victim, hospital);
  closeCustomModal();
}

// Pour afficher du HTML dans une modale centrale
function showCustomModal(html) {
  let modal = document.getElementById("custom-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "custom-modal";
    modal.style.position = "fixed";
    modal.style.left = 0;
    modal.style.top = 0;
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.background = "rgba(0,0,0,0.45)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = 10000;
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#fff;padding:2em;border-radius:1em;min-width:300px;max-width:90vw;box-shadow:0 4px 32px rgba(0,0,0,0.3);">
      ${html}
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) closeCustomModal();
  };
}

function closeCustomModal() {
  let modal = document.getElementById("custom-modal");
  if (modal) modal.remove();
}

const interventionsContainer = document.getElementById(
  "interventions-container"
);
const buildingsContainer = document.getElementById("buildings-container");

const mapContainer = document.getElementById("map-container");

// Boutons flottants
const reopenInterventionsBtn = document.createElement("button");
reopenInterventionsBtn.innerHTML = "➡️";
reopenInterventionsBtn.classList.add("reopen-btn");
reopenInterventionsBtn.style.left = "0";
mapContainer.appendChild(reopenInterventionsBtn);

const reopenBuildingsBtn = document.createElement("button");
reopenBuildingsBtn.innerHTML = "⬅️";
reopenBuildingsBtn.classList.add("reopen-btn");
reopenBuildingsBtn.style.right = "0";
mapContainer.appendChild(reopenBuildingsBtn);

// Masquer au départ
reopenInterventionsBtn.style.display = "none";
reopenBuildingsBtn.style.display = "none";

// Fermeture totale
document.getElementById("toggle-interventions").onclick = function () {
  interventionsContainer.style.width = "0px";
  interventionsContainer.classList.add("panel-hidden");
  reopenInterventionsBtn.style.display = "block";

  document.getElementById("resize-left").style.display = "none"; // 👈 Masquer la barre
};

document.getElementById("toggle-buildings").onclick = function () {
  buildingsContainer.style.width = "0px";
  buildingsContainer.classList.add("panel-hidden");
  reopenBuildingsBtn.style.display = "block";

  document.getElementById("resize-right").style.display = "none"; // 👈 Masquer la barre
};

reopenInterventionsBtn.onclick = function () {
  interventionsContainer.classList.remove("panel-hidden");
  interventionsContainer.style.width = "300px";
  reopenInterventionsBtn.style.display = "none";

  document.getElementById("resize-left").style.display = "block"; // 👈 Réafficher
};

reopenBuildingsBtn.onclick = function () {
  buildingsContainer.classList.remove("panel-hidden");
  buildingsContainer.style.width = "300px";
  reopenBuildingsBtn.style.display = "none";
  updateFabPosition();

  document.getElementById("resize-right").style.display = "block"; // 👈 Réafficher
};

function setupResize(
  container,
  isLeftSide = true,
  minWidth = 300,
  maxWidth = 450
) {
  const slider = document.createElement("div");
  slider.className = "resize-slider";

  // Positionne dynamiquement
  slider.style.position = "absolute";
  slider.style.top = "50px"; // Ajuste selon ta top bar
  slider.style.bottom = "0";
  slider.style.width = "6px";
  slider.style.cursor = "ew-resize";
  slider.style.zIndex = "1500";
  slider.style.background = "transparent";

  // Ajoute l’ID uniquement si gauche
  if (isLeftSide) {
    slider.id = "resize-left";
  } else {
    slider.id = "resize-right";
  }

  // Ajoute au <body> directement
  document.body.appendChild(slider);

  let isResizing = false;

  // Fonction pour ajuster la position du slider
  function updateSliderPosition() {
    const rect = container.getBoundingClientRect();
    if (isLeftSide) {
      slider.style.left = `${rect.right}px`;
    } else {
      slider.style.left = `${rect.left - slider.offsetWidth}px`;
    }
  }

  slider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    container.classList.add("no-transition");
    document.body.style.cursor = "ew-resize";
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
  });

  function resize(e) {
    if (!isResizing) return;
    const newWidth = isLeftSide ? e.clientX : window.innerWidth - e.clientX;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      container.style.width = `${newWidth}px`;
      updateSliderPosition(); // live follow
    }
  }

  function stopResize() {
    isResizing = false;
    container.classList.remove("no-transition");
    document.body.style.cursor = "default";
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
  }

  // Observer les changements de taille
  new ResizeObserver(updateSliderPosition).observe(container);
  window.addEventListener("resize", updateSliderPosition);
  updateSliderPosition();
}

const minBuildingWidth = 300; // ou la valeur que tu as passée
const minInterventionWidth = 300; // ou la valeur que tu as passée
buildingsContainer.style.width = `${minBuildingWidth}px`;
interventionsContainer.style.width = `${minInterventionWidth}px`;

setupResize(interventionsContainer, true, minInterventionWidth, 450); // à gauche
setupResize(buildingsContainer, false, minBuildingWidth, 450); // à droite

const fab = document.getElementById("add-building-fab");

function updateFabPosition() {
  const fab = document.getElementById("add-building-fab");
  const sidebar = buildingsContainer; // ou document.getElementById("buildings-container")

  const isVisible =
    getComputedStyle(sidebar).display !== "none" &&
    !sidebar.classList.contains("panel-hidden");

  if (isVisible) {
    const rect = sidebar.getBoundingClientRect();
    fab.style.left = `${rect.left - fab.offsetWidth - 10}px`;
    fab.style.right = "auto";
  } else {
    fab.style.left = "auto";
    fab.style.right = "22px";
  }
}

new ResizeObserver(updateFabPosition).observe(buildingsContainer);
window.addEventListener("resize", updateFabPosition);
updateFabPosition();

// JS à intégrer

// Variables de tri globales (mode, colonne, ordre)
let statsSort = { mode: "vehicles", col: null, dir: 1 };

document.getElementById("open‑stats").addEventListener("click", () => {
  document.getElementById("modal‑stats").classList.remove("hidden");
  statsSort = { mode: "vehicles", col: null, dir: 1 };
  renderStats("vehicles");
});

document.getElementById("close‑stats").addEventListener("click", () => {
  document.getElementById("modal‑stats").classList.add("hidden");
});

document.getElementById("tab‑vehicles").addEventListener("click", () => {
  statsSort = { mode: "vehicles", col: null, dir: 1 };
  renderStats("vehicles");
});
document.getElementById("tab‑buildings").addEventListener("click", () => {
  statsSort = { mode: "buildings", col: null, dir: 1 };
  renderStats("buildings");
});

document.getElementById("stats-search").addEventListener("input", () => {
  const mode = document
    .getElementById("tab‑vehicles")
    .classList.contains("active")
    ? "vehicles"
    : "buildings";
  renderStats(mode);
});

function renderStats(mode) {
  statsSort.mode = mode; // Maj le mode pour le tri
  const btnVeh = document.getElementById("tab‑vehicles");
  const btnBld = document.getElementById("tab‑buildings");
  btnVeh.classList.toggle("active", mode === "vehicles");
  btnBld.classList.toggle("active", mode === "buildings");
  const table = document.getElementById("stats-table");
  const search = document.getElementById("stats-search").value.toLowerCase();
  table.innerHTML = "";

  if (mode === "vehicles") {
    const headers = [
      { label: "Bâtiment", sortable: true, col: "batiment" },
      { label: "Véhicule" },
      { label: "Type", sortable: true, col: "type" },
      { label: "Kilométrage", sortable: true, col: "km" },
      { label: "Usure %", sortable: true, col: "usure" },
      { label: "Statut", sortable: true, col: "status" },
      { label: "Gérer" },
    ];
    appendTableHeaderSortable(table, headers, statsSort);

    // Prépare les lignes à trier
    let rows = [];
    buildings.forEach((b) => {
      b.vehicles.forEach((v) => {
        const km = v.kilometrage || 0;
        const usure = v.usure || 0;
        const statut = v.status || "";
        const lib = `${b.name}`.toLowerCase();
        const vlib = v.label.toLowerCase();
        if (search && !(lib.includes(search) || vlib.includes(search))) return;
        rows.push({
          batiment: b.name,
          vehicule: v.label,
          type: v.type.toUpperCase(),
          km: km / 1000, // Pour affichage décimal
          usure: usure,
          status: statut,
          bId: b.id,
          vId: v.id,
        });
      });
    });

    // Tri si demandé
    if (statsSort.col) {
      rows.sort((a, b) => {
        let va = a[statsSort.col],
          vb = b[statsSort.col];
        if (typeof va === "string" && typeof vb === "string") {
          return va.localeCompare(vb) * statsSort.dir;
        } else {
          return (va - vb) * statsSort.dir;
        }
      });
    }

    if (!rows.length) {
      appendNoResultRow(table, headers.length);
    } else {
      rows.forEach((r) => {
        const statutHtml = `<span class="status ${
          r.status
        }">${r.status.toUpperCase()}</span>`;
        const manageBtn = `<button class="manage-btn" data-building-id="${r.bId}" data-vehicle-id="${r.vId}">Gérer</button>`;
        appendTableRowHtml(table, [
          escapeHtml(r.batiment),
          escapeHtml(r.vehicule),
          escapeHtml(r.type),
          r.km.toFixed(2),
          r.usure.toFixed(1),
          statutHtml,
          manageBtn,
        ]);
      });
    }
  } else {
    const headers = [
      { label: "Bâtiment", sortable: true, col: "batiment" },
      { label: "Type", sortable: true, col: "type" },
      { label: "Nb véhicules", sortable: true, col: "nbVeh" },
      { label: "Personnel total", sortable: true, col: "total" },
      { label: "Gérer" },
    ];
    appendTableHeaderSortable(table, headers, statsSort);

    let rows = [];
    buildings.forEach((b) => {
      const nbVeh = b.vehicles.length;
      const personnelTotal = getTotalPersonnel(b);
      const txt = `${b.name}`.toLowerCase();
      if (search && !txt.includes(search)) return;
      rows.push({
        batiment: b.name,
        type: b.type.toUpperCase(),
        nbVeh: nbVeh,
        total: personnelTotal,
        bId: b.id,
      });
    });

    // Tri si demandé
    if (statsSort.col) {
      rows.sort((a, b) => {
        let va = a[statsSort.col],
          vb = b[statsSort.col];
        if (typeof va === "string" && typeof vb === "string") {
          return va.localeCompare(vb) * statsSort.dir;
        } else {
          return (va - vb) * statsSort.dir;
        }
      });
    }

    if (!rows.length) {
      appendNoResultRow(table, headers.length);
    } else {
      rows.forEach((r) => {
        const manageBtn = `<button class="manage-btn" data-building-id="${r.bId}">Gérer</button>`;
        appendTableRowHtml(table, [
          escapeHtml(r.batiment),
          escapeHtml(r.type),
          r.nbVeh,
          r.total,
          manageBtn,
        ]);
      });
    }
  }

  // Ajoute listeners sur boutons "Gérer" (attendre DOM update)
  setTimeout(() => {
    document.querySelectorAll("#stats-table .manage-btn").forEach((btn) => {
      const bId = btn.getAttribute("data-building-id");
      const vId = btn.getAttribute("data-vehicle-id");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (vId) openVehicleDashboard(vId);
        else openBuildingModal(getSafeId(bId));
      });
    });
  }, 10);
}

// Ajoute un header cliquable pour le tri
function appendTableHeaderSortable(table, headers, sort) {
  const row = document.createElement("tr");
  headers.forEach((h, idx) => {
    const th = document.createElement("th");
    th.textContent = h.label;
    if (h.sortable) {
      th.classList.add("sortable");
      th.style.cursor = "pointer";
      if (sort.col === h.col) th.classList.add("sorted");
      // Petit chevron si c'est trié
      if (sort.col === h.col) {
        th.textContent += sort.dir > 0 ? " ▲" : " ▼";
      }
      th.addEventListener("click", () => {
        // Si déjà trié sur cette colonne => inverse l’ordre, sinon tri asc.
        if (sort.col === h.col) {
          sort.dir *= -1;
        } else {
          sort.col = h.col;
          sort.dir = 1;
        }
        renderStats(sort.mode);
      });
    }
    row.appendChild(th);
  });
  table.appendChild(row);
}

// Fonctions utilitaires déjà données plus haut (inchangées)
function getTotalPersonnel(building) {
  if (["cpi", "cs", "csp"].includes(building.type)) {
    return (
      parseInt(building.personnelAvailablePro || 0, 10) +
      parseInt(building.personnelAvailableVol || 0, 10)
    );
  } else {
    return parseInt(building.personnelAvailable || 0, 10);
  }
}
function appendTableRow(table, values) {
  const row = document.createElement("tr");
  values.forEach((val) => {
    const td = document.createElement("td");
    td.textContent = val;
    row.appendChild(td);
  });
  table.appendChild(row);
}
function appendTableRowHtml(table, values) {
  const row = document.createElement("tr");
  values.forEach((val) => {
    const td = document.createElement("td");
    if (
      typeof val === "string" &&
      (val.includes("<button") || val.includes("status"))
    ) {
      td.innerHTML = val;
    } else {
      td.textContent = val;
    }
    row.appendChild(td);
  });
  table.appendChild(row);
}

function appendNoResultRow(table, colspan) {
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colspan;
  td.style.textAlign = "center";
  td.style.color = "#888";
  td.textContent = "Aucun résultat";
  row.appendChild(td);
  table.appendChild(row);
}
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}

function setupReinforcementFilterButtons() {
  document
    .querySelectorAll("#reinforcement-filter-buttons .filter-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#reinforcement-filter-buttons .filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        buildVehicleListForReinforcement(); // relance l'affichage
      });
    });
}

// === Résumé d'un appel ===
function getProvenanceLabel(m) {
  // sourceType est défini à la création (caserne/hopital/police)
  switch (m.sourceType) {
    case "caserne":
      return "Relais 18/112";
    case "hopital":
      return "Centre 15";
    case "police":
      return "17";
    default:
      return m.sourceType || "—";
  }
}

function isCallHandled(m) {
  // "Traité" si progression démarrée, mission active,
  // ou au moins un engin engagé (AT/ER/AL/OT/TR/CH)
  if (m.progressStarted || m.active) return true;
  return (m.dispatched || []).some(
    (d) =>
      !d.canceled &&
      d.vehicle &&
      ["at", "er", "al", "ot", "tr", "ch"].includes(d.vehicle.status)
  );
}

function isCallInProgress(m) {
  // "En cours" si mission active ou si au moins un engin est déjà engagé
  if (m.active) return true;
  return (m.dispatched || []).some(
    (d) =>
      !d.canceled &&
      d.vehicle &&
      ["at", "er", "al", "ot", "tr", "ch"].includes(d.vehicle.status)
  );
}

function formatDurationMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

let callsTicker = null;

function openCallsPanel() {
  const panel = document.getElementById("calls-panel");
  if (!panel) return;
  buildCallsTable();
  panel.classList.remove("hidden");

  clearInterval(callsTicker);
  callsTicker = setInterval(() => {
    const now = Date.now();
    for (const m of missions) {
      const cell = document.querySelector(`td[data-call-time="${m.id}"]`);
      if (!cell) continue;

      // durée
      if (!isCallHandled(m)) {
        const base = m.startTime || now;
        cell.textContent = "Depuis " + formatDurationMs(now - base);
      } else {
        if (cell.textContent !== "—") cell.textContent = "—";
      }

      // état texte
      const tr = cell.closest("tr");
      if (tr) {
        const etatCell = tr.children[4];
        if (etatCell) {
          let etat = "En attente";
          if (hasVehicleOnScene(m) && missingVehicles(m))
            etat = "Renfort demandé";
          else if (isCallInProgress(m)) etat = "En cours";
          else if (isCallHandled(m)) etat = "Traité";
          etatCell.textContent = etat;
        }

        // classes de fond (rouge/jaune/bleu) recalculées à CHAQUE tick
        tr.classList.toggle("waiting", !isCallHandled(m));
        tr.classList.toggle(
          "inprogress",
          isCallHandled(m) && isCallInProgress(m)
        );
        tr.classList.toggle(
          "handled",
          isCallHandled(m) && !isCallInProgress(m)
        );
      }
    }
    updatePendingBadgeAndHistory();
  }, 1000);
}

function closeCallsPanel() {
  document.getElementById("calls-panel")?.classList.add("hidden");
  if (callsTicker) {
    clearInterval(callsTicker);
    callsTicker = null;
  }
}

function buildCallsTable() {
  const tb = document.getElementById("calls-tbody");
  if (!tb) return;
  tb.innerHTML = "";

  missions
    .slice() // copie
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((m) => {
      const tr = document.createElement("tr");

      const handled = isCallHandled(m);
      const inprogress = isCallInProgress(m);
      tr.classList.toggle("waiting", !handled);
      tr.classList.toggle("inprogress", handled && inprogress);
      tr.classList.toggle("handled", handled && !inprogress);

      const tType = document.createElement("td");
      const canShowType = m.hasAskedAddress || m.labelUpdated; // ← condition d’affichage
      tType.textContent = canShowType ? getMissionTypeLabel(m) : "—";

      const tId = document.createElement("td");
      tId.textContent = m.id;

      const tProv = document.createElement("td");
      tProv.textContent = getProvenanceLabel(m);

      const tTime = document.createElement("td");
      tTime.dataset.callTime = m.id;

      if (!isCallHandled(m)) {
        const base = m.startTime || Date.now();
        tTime.textContent = "Depuis " + formatDurationMs(Date.now() - base);
      } else {
        tTime.textContent = "—"; // rien quand c'est traité
      }

      const tEtat = document.createElement("td");
      let etat = "En attente";
      if (hasVehicleOnScene(m) && missingVehicles(m)) {
        etat = "Renfort demandé";
      } else if (isCallInProgress(m)) {
        etat = "En cours";
      } else if (isCallHandled(m)) {
        etat = "Traité";
      }
      tEtat.textContent = etat;

      const tAction = document.createElement("td");
      const btn = document.createElement("button");
      if (!handled) {
        btn.textContent = "Traiter";
        btn.onclick = () => {
          closeCallsPanel();
          openCallModal(m.id);
        };
      } else {
        btn.textContent = "Gérer";
        btn.onclick = () => {
          closeCallsPanel();
          openManageMission(m.id);
        };
      }
      tAction.appendChild(btn);

      tr.appendChild(tId);
      tr.appendChild(tType);
      tr.appendChild(tProv);
      tr.appendChild(tTime);
      tr.appendChild(tEtat);
      tr.appendChild(tAction);
      tb.appendChild(tr);
    });

  updatePendingBadgeAndHistory();
}

function updatePendingBadgeAndHistory() {
  const total = window.CALL_STATS?.total || missions.length;
  const pending = missions.filter((m) => !isCallHandled(m)).length;

  const badge = document.getElementById("pending-calls-badge");
  if (badge) badge.textContent = pending;

  // Utilise les totaux persistés
  const c18112 = window.CALL_STATS?.bySource?.["Relais 18/112"] || 0;
  const c15 = window.CALL_STATS?.bySource?.["Centre 15"] || 0;
  const c17 = window.CALL_STATS?.bySource?.["17"] || 0;

  const put = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.querySelector("b").textContent = String(val);
  };
  put("hist-18112", c18112);
  put("hist-15", c15);
  put("hist-17", c17);
  put("hist-total", total);
}

// wiring des boutons
document
  .getElementById("open-calls-panel")
  ?.addEventListener("click", openCallsPanel);
document
  .getElementById("close-calls-panel")
  ?.addEventListener("click", closeCallsPanel);

// appelle au chargement et après chaque création/suppression de mission
setInterval(updatePendingBadgeAndHistory, 2000);

// === missiontypes => libellé humain
function getMissionTypeLabel(m) {
  // suivant comment missiontypes est structuré chez toi (objet ou tableau)
  let label = null;
  if (window.missiontypes) {
    if (Array.isArray(window.missiontypes)) {
      const mt = window.missiontypes.find(
        (x) => x.type === m.type || x.id === m.type
      );
      label = mt?.label || mt?.name;
    } else {
      label =
        window.missiontypes[m.type]?.label || window.missiontypes[m.type]?.name;
    }
  }
  // fallback
  return (
    label ||
    m.realLabel ||
    m.label ||
    (m.type || "").replaceAll("_", " ")
  ).toUpperCase();
}

// Véhicule sur place ?
function hasVehicleOnScene(m) {
  return (m.dispatched || []).some(
    (d) => !d.canceled && d.vehicle && d.vehicle.status === "al"
  );
}

// Manque-t-il des véhicules par rapport aux besoins ?
function missingVehicles(m) {
  if (!Array.isArray(m.vehicles) || m.vehicles.length === 0) return false;
  const requiredByType = m.vehicles.reduce(
    (acc, t) => ((acc[t] = (acc[t] || 0) + 1), acc),
    {}
  );
  const sentByType = (m.dispatched || []).reduce((acc, d) => {
    if (d.canceled || !d.vehicle) return acc;
    const t = d.vehicle.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(requiredByType).some(
    (t) => (sentByType[t] || 0) < requiredByType[t]
  );
}

// Bus d'événements "missions"
function notifyMissionsChanged() {
  document.dispatchEvent(new Event("missions:changed"));
}

document.addEventListener("missions:changed", () => {
  const panel = document.getElementById("calls-panel");
  if (panel && !panel.classList.contains("hidden")) {
    buildCallsTable(); // reconstruit proprement la table visible
  }
  updatePendingBadgeAndHistory();
});

function pulseCallsButton() {
  const btn = document.getElementById("open-calls-panel");
  const panelOpen = !document
    .getElementById("calls-panel")
    ?.classList.contains("hidden");
  if (btn && !panelOpen) {
    btn.classList.add("notify");
  }
}

function clearPulseCallsButton() {
  document.getElementById("open-calls-panel")?.classList.remove("notify");
}

// Quand on ouvre le panel on arrête le clignotement
document
  .getElementById("open-calls-panel")
  ?.addEventListener("click", clearPulseCallsButton);

let _callMiniMap, _callMiniMarker;
let _miniVehMarkers = new Map(); // idVeh -> L.marker
let _miniBldMarkers = new Map(); // idBuilding -> L.marker
let _miniMissionMarkers = new Map(); // idMission -> L.marker

function createCallMiniMap() {
  const node = document.getElementById("call-mini-map");
  if (!node) return;
  if (_callMiniMap) return;

  // 1) Crée la carte
  _callMiniMap = L.map(node, { zoomControl: true, attributionControl: false });

  // 2) Tuile identique si possible (si tu as gardé une référence à la couche)
  // Essaie de cloner la première couche "tileLayer" de la map principale :
  let baseLayer;
  try {
    // Cherche une layer type TileLayer sur la carte principale
    map.eachLayer((l) => {
      if (!baseLayer && l instanceof L.TileLayer) baseLayer = l;
    });
  } catch (e) {}
  if (baseLayer) {
    L.tileLayer(baseLayer._url, baseLayer.options).addTo(_callMiniMap);
  } else {
    // fallback OSM
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      _callMiniMap
    );
  }

  // 3) Vue identique à la principale
  try {
    const c = map.getCenter();
    _callMiniMap.setView([c.lat, c.lng], map.getZoom());
  } catch (e) {
    _callMiniMap.setView([48.85837, 2.29448], 13);
  }

  // 4) Ajuste après affichage
  setTimeout(() => _callMiniMap.invalidateSize(), 60);

  // 5) Premier build des overlays
  refreshMiniMapOverlays(true);
}

function syncCallMiniMap(lat, lng, zoom) {
  if (!_callMiniMap) return;

  // Vue
  if (typeof lat === "number" && typeof lng === "number") {
    _callMiniMap.setView(
      [lat, lng],
      zoom || Math.max(14, map?.getZoom?.() || 14)
    );
  } else if (window.map) {
    const c = map.getCenter();
    _callMiniMap.setView([c.lat, c.lng], map.getZoom());
  }

  // MAJ overlays à chaque sync
  refreshMiniMapOverlays(false);
}

// Ajoute / met à jour les marqueurs véhicules & bâtiments
function refreshMiniMapOverlays(initial = false) {
  if (!_callMiniMap) return;

  // --- BÂTIMENTS ---
  const seenBld = new Set();
  if (Array.isArray(buildings)) {
    for (const b of buildings) {
      const id = b.id;
      const latlng = b.marker?.getLatLng?.() || b.latlng;
      if (!latlng) continue;
      seenBld.add(id);

      let mk = _miniBldMarkers.get(id);
      if (!mk) {
        const icon = b.marker?.options?.icon;
        mk = L.marker(latlng, icon ? { icon } : undefined).addTo(_callMiniMap);
        _miniBldMarkers.set(id, mk);
      } else {
        mk.setLatLng(latlng);
      }
    }
  }
  // purge bâtiments disparus
  for (const [id, mk] of _miniBldMarkers) {
    if (!seenBld.has(id)) {
      _callMiniMap.removeLayer(mk);
      _miniBldMarkers.delete(id);
    }
  }

  // --- VÉHICULES ---
  const seenVeh = new Set();
  if (Array.isArray(buildings)) {
    for (const b of buildings) {
      for (const v of b.vehicles || []) {
        if (!v.marker || !v.marker.getLatLng) continue;
        const id = v.id;
        const latlng = v.marker.getLatLng();
        seenVeh.add(id);

        let mk = _miniVehMarkers.get(id);
        if (!mk) {
          const icon = v.marker?.options?.icon;
          mk = L.marker(latlng, icon ? { icon } : undefined).addTo(
            _callMiniMap
          );
          _miniVehMarkers.set(id, mk);
        } else {
          mk.setLatLng(latlng);
        }
      }
    }
  }
  // purge véhicules disparus
  for (const [id, mk] of _miniVehMarkers) {
    if (!seenVeh.has(id)) {
      _callMiniMap.removeLayer(mk);
      _miniVehMarkers.delete(id);
    }
  }

  // --- MISSIONS (NOUVEAU) ---
  const seenMis = new Set();
  if (Array.isArray(missions)) {
    for (const m of missions) {
      const id = m.id ?? m.identifier ?? m.uid;
      if (id == null) continue;

      // récupère la position (marker de la carte principale prioritaire)
      let latlng = m.marker?.getLatLng?.();
      if (!latlng && m.position) {
        const { lat, lng } = m.position;
        if (typeof lat === "number" && typeof lng === "number") {
          latlng = L.latLng(lat, lng);
        }
      }
      if (!latlng) continue;

      seenMis.add(id);

      let mk = _miniMissionMarkers.get(id);
      if (!mk) {
        // réutilise l'icône du marker principal si dispo (feu, SAP, etc.)
        const icon = m.marker?.options?.icon;
        mk = L.marker(
          latlng,
          icon ? { icon, zIndexOffset: 500 } : { zIndexOffset: 500 }
        ).addTo(_callMiniMap);
        _miniMissionMarkers.set(id, mk);
      } else {
        mk.setLatLng(latlng);
      }
    }
  }
  // purge missions disparues
  for (const [id, mk] of _miniMissionMarkers) {
    if (!seenMis.has(id)) {
      _callMiniMap.removeLayer(mk);
      _miniMissionMarkers.delete(id);
    }
  }
}

function centerMainMapTo(lat, lng) {
  if (window.map && typeof map.setView === "function") {
    map.setView([lat, lng], Math.max(15, map.getZoom() || 15));
  }
}

function refreshRecap() {
  // Identifiant
  const rId = document.getElementById("recap-id");
  if (rId) rId.textContent = currentCallMission?.id ?? "—";

  // Date/heure de génération
  const rTs = document.getElementById("recap-ts");
  if (rTs) {
    const ts = currentCallMission?.createdAt;
    rTs.textContent = ts
      ? new Date(ts).toLocaleString("fr-FR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";
  }

  // Adresse : mission → location → texte UI → —
  const addr =
    currentCallMission?.address ||
    currentCallMission?.location?.address ||
    document.getElementById("call-address")?.textContent?.trim() ||
    "—";
  const rAddr = document.getElementById("recap-address");
  if (rAddr) rAddr.textContent = addr || "—";

  // Typologie
  const rType = document.getElementById("recap-type");
  if (rType) rType.textContent = currentCallMission?.departLabel || "—";

  // Véhicules (2 × FPT, 1 × VSAV, …)
  const rVeh = document.getElementById("recap-vehicles");
  if (rVeh) {
    const counts = countSelectedByType();
    const keys = Object.keys(counts);
    rVeh.textContent = keys.length
      ? keys.map((k) => `${counts[k]} × ${k}`).join(", ")
      : "—";
  }

  // Observations
  const rObs = document.getElementById("recap-observations");
  if (rObs) {
    const t = (currentCallMission?.observations || "").trim();
    rObs.textContent = t || "—";
  }
}

function countSelectedByType() {
  const boxes = Array.from(
    document.querySelectorAll(
      '#vehicle-selection-section input[type="checkbox"][data-vehicle-id]'
    )
  );
  const counts = {};
  for (const b of boxes) {
    if (b.checked) {
      const t = (b.dataset.vehType || b.dataset.vehLabel || "").toUpperCase();
      if (!t) continue;
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return counts;
}

// Récupère l'adresse affichée dans #call-address, la nettoie et la stocke sur la mission,
// puis rafraîchit le récap.
function updateAddressFromUI() {
  const p = document.getElementById("call-address");
  if (!p) return;
  let txt = (p.textContent || "").trim();

  // Nettoyage des formules "Il me semble que c’est ici :", "Je vous donne l’adresse :", etc.
  // → on prend ce qu'il y a après le premier ':' s'il existe.
  const i = txt.indexOf(":");
  if (i !== -1 && i < txt.length - 1) txt = txt.slice(i + 1).trim();

  if (txt) {
    currentCallMission.address = txt;
    currentCallMission.location = {
      ...(currentCallMission.location || {}),
      address: txt,
    };
  }
  if (typeof refreshRecap === "function") refreshRecap();
  if (typeof scheduleAutoSave === "function") scheduleAutoSave();
}
