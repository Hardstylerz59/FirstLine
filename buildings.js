// === buildings.js (corrigé pour gestion des noms identiques par type + modal prêat) ===
let currentManagedBuilding = null;

function getSafeId(building) {
  return `${building.type}-${building.name}`.toLowerCase().replace(/\s+/g, "-");
}

map.on("click", (e) => {
  if (!addMode || !currentBuilding) return;

  const cost = ECONOMY.buildingCost[currentBuilding.type] || 0;
  if (!RESTORE_MODE && player.money < cost) {
    alert(`Pas assez d'argent pour placer ce bâtiment (${cost}€ requis)`);
    addMode = false;
    currentBuilding = null;
    document.getElementById("map-notice").classList.add("hidden");
    return;
  }
  if (!RESTORE_MODE) {
    player.money -= cost;
    updatePlayerInfo();
    scheduleAutoSave();
  }

  const { type, name } = currentBuilding;
  const latlng = e.latlng;

  const building = {
    id: `building-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    type,
    latlng,
    marker: null,
    vehicles: [],
    // --- Ici, la ligne à modifier : ---
    personnel:
      type === "cpi" || type === "cs" || type === "csp"
        ? { pro: 0, vol: 0 }
        : 0,
    personnelAvailable: 0,
    personnelPro: 0, // ou la valeur par défaut
    personnelAvailablePro: 0,
    personnelVol: 0,
    personnelAvailableVol: 0,
    capacity: type === "hopital" ? 10 : undefined,
    patients: type === "hopital" ? [] : undefined,
    reservedPatients: type === "hopital" ? [] : undefined,
  };

  const safeId = getSafeId(building);

  const limit = VEHICLE_LIMITS[type] || "–";

  const icon = L.icon({
    iconUrl: getIconForType(type),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const vehicleTypesByBuilding = {
    cpi: ["VSAV", "FPT", "VSR", "EPA", "CDG"],
    cs: ["VSAV", "FPT", "VSR", "EPA", "CDG"],
    csp: ["VSAV", "FPT", "VSR", "EPA", "CDG"],
    police: ["PATROUILLE"],
    hopital: ["SMUR"],
  };
  const allowedVehicles = vehicleTypesByBuilding[type] || [];
  const labelPrefix =
    type === "hopital" ? "CH" : type === "police" ? "Commissariat" : "CIS";

  const li = document.createElement("li");
  li.classList.add("building-block", type);
  li.id = `building-block-${safeId}`;
  li.innerHTML = `
  <div class="building-header">
    <div class="building-title">
      <strong>${labelPrefix} ${name}</strong>
      ${
        type === "cpi" || type === "cs" || type === "csp"
          ? `
          <div class="staff-info">
            Pro: <span id="staff-pro-avail-${safeId}">0</span>/<span id="staff-pro-${safeId}">0</span>
            Vol: <span id="staff-vol-avail-${safeId}">0</span>/<span id="staff-vol-${safeId}">0</span>
          </div>
          `
          : `<div class="staff-info">(<span id="staff-avail-${safeId}">0</span>/<span id="staff-${safeId}">0</span>)</div>`
      }
      ${
        type === "hopital"
          ? `<p class="patient-info">🛏 Patients : <span id="capacity-${safeId}">0/0</span></p>`
          : ""
      }
      <p class="building-type-label hidden" id="type-${safeId}">Type : ${type.toUpperCase()}</p>
    </div>
    <button onclick="openBuildingModal('${safeId}')">Gérer</button>
    <button class="toggle-veh-btn" onclick="toggleVehicleList('${safeId}', this)">▼</button>
  </div>
  <ul id="veh-${safeId}" class="vehicle-list"></ul>
`;

  buildingList.appendChild(li);
  const marker = L.marker(latlng, { icon })
    .addTo(map)
    .bindPopup(
      `
    <b>${labelPrefix} ${name}</b><br>
    <button id="popup-manage-${safeId}" class="popup-manage-btn">Gérer</button>
  `
    )
    .bindTooltip(`${labelPrefix} ${name}`, {
      permanent: false,
      direction: "top",
    });

  marker.on("popupopen", function () {
    const btn = document.getElementById(`popup-manage-${safeId}`);
    if (btn) btn.onclick = () => openBuildingModal(safeId);
  });

  building.marker = marker;
  buildings.push(building);

  getOrFetchPOIsForBuilding(building);

  document.getElementById("map").classList.remove("add-cursor");
  const confirmBtn = document.getElementById("confirm-add-building");
  if (confirmBtn) confirmBtn.disabled = false;
  addMode = false;
  currentBuilding = null;
  document.getElementById("map-notice").classList.add("hidden");
  scheduleAutoSave();
});

function addVehicle(safeId, vehicleType) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  const limit = VEHICLE_LIMITS[building.type] || 10;
  if (building.vehicles.length >= limit) {
    alert(
      `Limite atteinte : ce bâtiment ne peut accueillir que ${limit} véhicules.`
    );
    return;
  }

  const cost = ECONOMY.vehicleCost[vehicleType] || 0;
  if (player.money < cost) {
    alert(`Pas assez d'argent (${cost}€ requis)`);
    return;
  }
  player.money -= cost;
  updatePlayerInfo();

  const count =
    building.vehicles.filter((v) => v.type === vehicleType).length + 1;
  const num = count.toString().padStart(2, "0");
  const label = `${vehicleType} ${num} ${building.name}`;
  const requiredPersonnelForVehicle = requiredPersonnel[vehicleType] || 0;

  const vehicle = {
    id: `${vehicleType}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: vehicleType,
    ready: true,
    label,
    kilometrage: 0, // total en mètres
    usure: 0, // pour plus tard
    missionsCount: 0,
    required: requiredPersonnelForVehicle,
    maintenance: false, // <--- Nouveau flag
    status: "dc",
  };

  building.vehicles.push(vehicle);
  building.vehicles.sort((a, b) => a.label.localeCompare(b.label));

  refreshVehicleStatusForBuilding(building);

  updateVehicleListDisplay(safeId); // ✅ un seul appel ici

  refreshBuildingStatus(building);
  updateSidebarVehicleList(safeId);

  scheduleAutoSave();
}

function openHospitalModal(buildingId) {
  const hospital = buildings.find((b) => b.id === buildingId);
  if (!hospital || hospital.type !== "hopital") return;

  // Compteur avec patients présents + en transport
  const reserved = hospital.reservedPatients
    ? hospital.reservedPatients.length
    : 0;
  const totalPatients = (hospital.patients?.length || 0) + reserved;

  document.getElementById(
    "hospital-name"
  ).textContent = `${hospital.name} (${totalPatients}/${hospital.capacity} patients)`;

  const list = document.getElementById("hospital-patient-list");
  list.innerHTML = "";

  const now = Date.now();

  // Patients déjà arrivés
  hospital.patients.forEach((p) => {
    const timeLeft = Math.max(
      0,
      Math.ceil((p.duration - (now - p.entryTime)) / 1000)
    );
    const li = document.createElement("li");
    const patientName =
      p.name || `Victime (${PATIENT_STATUS_FR[p.severity] || p.severity})`;
    const severityFr = PATIENT_STATUS_FR[p.severity] || p.severity;
    li.className = p.severity;
    li.innerHTML = `
      <span><strong>${patientName}</strong> — ${severityFr}</span>
      <span>⏱ ${timeLeft}s</span>
    `;
    list.appendChild(li);
  });

  // Patients en transport (reserved)
  if (reserved > 0) {
    hospital.reservedPatients.forEach((r) => {
      const reservedName =
        r.name || `Victime (${PATIENT_STATUS_FR[r.severity] || r.severity})`;
      const reservedSeverity = PATIENT_STATUS_FR[r.severity] || r.severity;
      const li = document.createElement("li");
      li.className = r.severity + " in-transport"; // Pour un éventuel style CSS spécifique
      li.innerHTML = `
        <span><strong>${reservedName}</strong> — ${reservedSeverity}</span>
        <span style="color:#1E90FF;">🚑 En cours de transport</span>
      `;
      list.appendChild(li);
    });
  }

  document.getElementById("hospital-modal").classList.remove("hidden");
}

function closeHospitalModal() {
  document.getElementById("hospital-modal").classList.add("hidden");
}

function applyVehicleItemStyle(list) {
  const items = list.querySelectorAll("li");
  items.forEach((item) => {
    item.classList.add("vehicle-item");
  });
}

function recruit(safeId, recruitType = "pro") {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  // Caserne : gestion pro/volontaire
  if (
    building.type === "cpi" ||
    building.type === "cs" ||
    building.type === "csp"
  ) {
    const isCPI = building.type === "cpi";
    const allowedTypes = isCPI ? ["vol"] : ["pro", "vol"];
    if (!allowedTypes.includes(recruitType)) {
      alert("Impossible de recruter ce type de personnel dans cette caserne.");
      return;
    }
    const max = MAX_PERSONNEL_BY_BUILDING[building.type];
    const total = (building.personnelPro || 0) + (building.personnelVol || 0);
    if (total >= max) {
      alert("Effectif maximum atteint !");
      return;
    }

    // 💸 Détermination du coût selon le type de recrutement
    let recruitPrice;
    if (recruitType === "pro") {
      recruitPrice = ECONOMY.recruitCostPro || ECONOMY.recruitCost; // fallback si pas défini
    } else {
      recruitPrice = ECONOMY.recruitCostVol || ECONOMY.recruitCost;
    }
    if (player.money < recruitPrice) {
      alert("Pas assez d'argent pour recruter.");
      return;
    }
    player.money -= recruitPrice;
    updatePlayerInfo();

    // Attribution
    if (recruitType === "pro") {
      building.personnelPro = (building.personnelPro || 0) + 1;
      building.personnelAvailablePro =
        (building.personnelAvailablePro || 0) + 1;
    } else {
      building.personnelVol = (building.personnelVol || 0) + 1;
      building.personnelAvailableVol =
        (building.personnelAvailableVol || 0) + 1;
    }
  } else {
    // Autres bâtiments
    if (player.money < ECONOMY.recruitCost) {
      alert("Pas assez d'argent pour recruter.");
      return;
    }
    player.money -= ECONOMY.recruitCost;
    updatePlayerInfo();
    building.personnel = (building.personnel || 0) + 1;
    building.personnelAvailable = building.personnel;
  }

  refreshBuildingStaffDisplay(building);

  // MAJ UI modal
  const modalStaff = document.getElementById("modal-personnel");
  if (modalStaff) {
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      modalStaff.innerHTML = `<strong>Personnel actuel :</strong>
        Pro ${building.personnelPro || 0} (dispo ${
        building.personnelAvailablePro || 0
      }) /
        Vol ${building.personnelVol || 0} (dispo ${
        building.personnelAvailableVol || 0
      })`;
    } else {
      modalStaff.innerHTML = `<strong>Personnel actuel :</strong> ${
        building.personnelAvailable || 0
      }/${building.personnel || 0}`;
    }
  }

  refreshVehicleStatusForBuilding(building);
  updateVehicleListDisplay(safeId);
  refreshBuildingStatus(building);
  scheduleAutoSave();
}

function refreshBuildingStaffDisplay(building) {
  const safeId = getSafeId(building);
  if (
    building.type === "cpi" ||
    building.type === "cs" ||
    building.type === "csp"
  ) {
    document.getElementById(`staff-pro-${safeId}`).textContent =
      building.personnelPro;
    document.getElementById(`staff-vol-${safeId}`).textContent =
      building.personnelVol;
    document.getElementById(`staff-pro-avail-${safeId}`).textContent =
      building.personnelAvailablePro || 0;
    document.getElementById(`staff-vol-avail-${safeId}`).textContent =
      building.personnelAvailableVol || 0;
  } else {
    document.getElementById(`staff-${safeId}`).textContent = building.personnel;
    document.getElementById(`staff-avail-${safeId}`).textContent =
      building.personnelAvailable || 0;
  }
}

function displayVehicleCategory(safeId, category) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  const container = document.getElementById("vehicle-choice-container");
  container.innerHTML = "";

  const vehicleTypes = VEHICLE_CATEGORIES[category] || [];

  const vehicleList = vehicleTypes
    .map((type) => ({ ...VEHICLE_DESCRIPTIONS[type], type }))
    .filter((v) => v); // garde ceux qui existent

  if (!vehicleList.length) {
    container.innerHTML = `<p style="color:grey;">Aucun véhicule disponible dans cette catégorie.</p>`;
    return;
  }

  container.innerHTML = vehicleList
    .map((v) => {
      const cost = ECONOMY.vehicleCost[v.type];
      return `
      <div style="margin-bottom: 12px;">
        <button onclick="addVehicle('${safeId}', '${v.type}')">+ ${v.label} (${cost}€)</button>
        <p style="font-size: 0.9rem; color: #555;">${v.description}</p>
      </div>
    `;
    })
    .join("");
}

function renderExistingVehicles(building) {
  const safeId = getSafeId(building);

  return `
    <ul id="veh-${safeId}" class="vehicle-list">
      ${building.vehicles
        .map(
          (v) => `
        <li class="vehicle-item">
          <span>${v.label}</span>
          <span class="status ${v.status}">${v.status.toUpperCase()}</span>
        </li>
      `
        )
        .join("")}
    </ul>
  `;
}

function updateVehicleListDisplay(safeId) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  // 1. MODAL (si ouvert)
  const wrapper = document.getElementById("vehicle-list-wrapper");
  if (wrapper) {
    wrapper.innerHTML = renderExistingVehicles(building);
  }

  // 2. SIDEBAR
  const sidebarUl = document.getElementById(`veh-${safeId}`);
  if (sidebarUl) {
    // Efface et reconstruit la liste dans la sidebar
    sidebarUl.innerHTML = "";
    building.vehicles.forEach((vehicle) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${vehicle.label}</span>
        <span class="status ${
          vehicle.status
        }">${vehicle.status.toUpperCase()}</span>
      `;
      sidebarUl.appendChild(li);
    });
  }
}

function updateSidebarVehicleList(safeId) {
  const building = buildings.find((b) => getSafeId(b) === safeId);
  if (!building) return;

  const list = document.getElementById(`veh-${safeId}`);
  if (!list) {
    console.warn(`🚫 Impossible de trouver #veh-${safeId} dans la sidebar`);
    return;
  }

  list.innerHTML = "";

  if (building.vehicles.length === 0) {
    list.innerHTML = '<li style="color: grey;">Aucun véhicule</li>';
    return;
  }

  building.vehicles.forEach((v) => {
    const li = document.createElement("li");
    li.className = "vehicle-item";
    li.innerHTML = `
      <span>${v.label}</span>
      <span class="status ${
        v.status
      }" title="${v.status.toUpperCase()}">${v.status.toUpperCase()}</span>
    `;
    list.appendChild(li);
    v.statusElement = li.querySelector(".status");
  });
}

function refreshVehicleStatusForBuilding(building) {
  // Chaque véhicule DC si le personnel total est suffisant individuellement
  building.vehicles.forEach((vehicle) => {
    if (["er", "al", "tr", "ch", "ot", "at", "hs"].includes(vehicle.status))
      return;
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // Calcul de la dispo pro/vol (on ne touche pas à la logique ND/DC)
      const proDispo = building.personnelAvailablePro || 0;
      const volDispo = building.personnelAvailableVol || 0;
      const required = vehicle.required || 0;
      const enough = proDispo + volDispo >= required;
      vehicle.status = enough ? "dc" : "nd";
    } else {
      if ((vehicle.required || 0) <= (building.personnelAvailable || 0)) {
        vehicle.status = "dc";
      } else {
        vehicle.status = "nd";
      }
    }
  });
}

let currentFilter = "all";

function filterBuildings(filterType) {
  currentFilter = filterType;
  applyFilters();
}

function applyFilters() {
  const query = document.getElementById("building-search").value.toLowerCase();
  const blocks = document.querySelectorAll(".building-block");

  blocks.forEach((block) => {
    const safeId = block.id.replace("building-block-", "");
    const building = buildings.find((b) => getSafeId(b) === safeId);
    if (!building) return;

    const isCaserne = ["cpi", "cs", "csp"].includes(building.type);
    const matchFilter =
      currentFilter === "all" ||
      (currentFilter === "caserne" && isCaserne) ||
      currentFilter === building.type;

    const matchSearch = building.name.toLowerCase().includes(query);

    block.style.display = matchFilter && matchSearch ? "" : "none";
  });
}

// Écoute la recherche en live
document
  .getElementById("building-search")
  .addEventListener("input", applyFilters);

function toggleVehicleList(safeId, btn) {
  const list = document.getElementById(`veh-${safeId}`);
  if (!list) return;
  list.classList.toggle("hidden");
  btn.textContent = list.classList.contains("hidden") ? "▲" : "▼";
}
