// === Configuration Supabase ===
const SUPABASE_URL = "https://ehcoxgtepvonkosqxtca.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoY294Z3RlcHZvbmtvc3F4dGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNTUwMzIsImV4cCI6MjA2MjczMTAzMn0.Liz6UAVxyhsTtRyrrpcNCHnkIj6c8l00ZQYCeMDZpYY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const buildingPoisMap = new Map();

function createBuildingFromState(b) {
  const latlng = b.latlng;
  const building = {
    ...b,
    latlng,
    marker: null,
    vehicles: [],
  };

  const safeId = getSafeId(building);
  const labelPrefix =
    b.type === "hopital" ? "CH" : b.type === "police" ? "Commissariat" : "CIS";

  const icon = L.icon({
    iconUrl: getIconForType(b.type),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const li = document.createElement("li");
  li.classList.add("building-block", b.type);
  li.id = `building-block-${safeId}`;
  li.innerHTML = `
    <div class="building-header">
      <div class="building-title">
        <strong>${labelPrefix} ${b.name}</strong>
        <div class="staff-info"></div>
        ${
          b.type === "hopital"
            ? `<p class="patient-info">🛏 Patients : <span id="capacity-${safeId}">0/0</span></p>`
            : ""
        }
        <p class="building-type-label hidden" id="type-${safeId}">Type : ${b.type.toUpperCase()}</p>
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
      <b>${labelPrefix} ${b.name}</b><br>
      <button id="popup-manage-${safeId}" class="popup-manage-btn">Gérer</button>
    `
    )
    .bindTooltip(`${labelPrefix} ${b.name}`, {
      permanent: false,
      direction: "top",
    });

  marker.on("popupopen", function () {
    const btn = document.getElementById(`popup-manage-${safeId}`);
    if (btn) btn.onclick = () => openBuildingModal(safeId);
  });

  building.marker = marker;
  buildings.push(building);
  // Met à jour les infos de personnel après création
  const span = li.querySelector(".staff-info");
  if (
    building.type === "cpi" ||
    building.type === "cs" ||
    building.type === "csp"
  ) {
    span.innerHTML = `
    Pro: <span id="staff-pro-avail-${safeId}">${
      building.personnelAvailablePro ?? 0
    }</span> /
         <span id="staff-pro-${safeId}">${building.personnelPro ?? 0}</span>
    Vol: <span id="staff-vol-avail-${safeId}">${
      building.personnelAvailableVol ?? 0
    }</span> /
         <span id="staff-vol-${safeId}">${building.personnelVol ?? 0}</span>
  `;
  } else {
    span.innerHTML = `(<span id="staff-avail-${safeId}">${
      building.personnelAvailable ?? 0
    }</span> /
                     <span id="staff-${safeId}">${
      building.personnel ?? 0
    }</span>)`;
  }
  return building; // 👈 AJOUT
}

// Lecture BDD + mise en cache local. Pas d'appel Overpass ici.
async function getOrFetchPOIsForBuilding(building) {
  if (buildingPoisMap.has(building.id)) return;

  const { data, error } = await client
    .from("building_pois")
    .select("pois")
    .eq("building_id", building.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[POI] Erreur lecture BDD pour ${building.id}`, error);
    return;
  }

  const existing = data?.pois;
  if (Array.isArray(existing) && existing.length > 0) {
    buildingPoisMap.set(building.id, existing);
    return;
  }

  // rien en BDD : on laisse vide, la phase "re-fill" s'en chargera
  console.warn(`❌ Aucun POI en BDD pour ${building.id}.`);
}

async function fetchPOIsFromOverpass(building) {
  console.trace(`🧭 fetchPOIsFromOverpass déclenché pour ${building.id}`);

  const lat = building.latlng.lat;
  const lng = building.latlng.lng;
  const radius = 5000;
  const tags = [
    "shop",
    "amenity",
    "building",
    "tourism",
    "landuse",
    "natural",
    "highway",
    "leisure",
    "man_made",
    "railway",
    "public_transport",
  ];

  const filters = tags
    .map(
      (tag) => `
      node["${tag}"](around:${radius},${lat},${lng});
      way["${tag}"](around:${radius},${lat},${lng});
      relation["${tag}"](around:${radius},${lat},${lng});
    `
    )
    .join("\n");

  const query = `
    [out:json][timeout:25];
    (
      ${filters}
    );
    out center;
  `;

  const url =
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const res = await fetch(url);
    const json = await res.json();
    const elements = json.elements
      .filter((el) => el.tags)
      .map((el) => ({
        lat: el.lat ?? el.center?.lat,
        lng: el.lon ?? el.center?.lon,
        tags: el.tags,
      }))
      .filter((el) => el.lat && el.lng);

    return elements;
  } catch (e) {
    console.warn("Erreur chargement POIs OSM", e);
    return [];
  }
}

// Re-remplit la BDD + le cache si un bâtiment n'a aucun POI
async function refillPOIsForBuildingIfEmpty(building) {
  // si déjà en cache, inutile
  if (buildingPoisMap.has(building.id)) return;

  // double-check BDD (évite la course si un autre onglet a rempli)
  const { data } = await client
    .from("building_pois")
    .select("pois")
    .eq("building_id", building.id)
    .limit(1)
    .maybeSingle();

  if (Array.isArray(data?.pois) && data.pois.length > 0) {
    buildingPoisMap.set(building.id, data.pois);
    return;
  }

  // Fetch Overpass
  const elements = await fetchPOIsFromOverpass(building);
  if (!elements || elements.length === 0) {
    console.warn(`⚠️ Overpass n'a retourné aucun POI pour ${building.id}.`);
    return;
  }

  // Sauvegarde en BDD (upsert sur building_id)
  const { error: upsertError } = await client
    .from("building_pois")
    .upsert(
      { building_id: building.id, pois: elements },
      { onConflict: "building_id" }
    );

  if (upsertError) {
    console.warn(`[POI] Erreur upsert BDD pour ${building.id}`, upsertError);
    return;
  }

  // Mise en cache locale
  buildingPoisMap.set(building.id, elements);
  console.log(
    `✅ POI rechargés et sauvegardés pour ${building.id} (${elements.length})`
  );
}

// ⚙️ Utilitaires d'authentification utilisateur
async function getCurrentUserId() {
  const { data } = await client.auth.getUser();
  return data?.user?.id ?? null;
}

// Met à jour l'interface selon l'état de connexion
async function updateAuthUI() {
  const { data } = await client.auth.getUser();
  const authBox = document.getElementById("auth-box");
  const userDisplay = document.getElementById("user-email-display");
  const gameUI = document.getElementById("game-ui");
  setTimeout(() => map.invalidateSize(), 300);

  if (data?.user) {
    authBox.style.display = "none";
    gameUI.style.display = "block";
    const pseudo = data.user.user_metadata?.pseudo;
    loadGame(); // Chargement automatique
  } else {
    authBox.style.display = "block";
    gameUI.style.display = "none";
    userDisplay.textContent = "";
  }
}

// 📩 Inscription utilisateur
async function signUp() {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const pseudo = document.getElementById("signup-pseudo").value;

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { pseudo },
    },
  });

  if (error) return alert("Erreur inscription : " + error.message);
  alert("Inscription réussie ! Confirme ton email.");
  await updateAuthUI();
}

// 🔐 Connexion utilisateur
async function signIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return alert("Erreur connexion : " + error.message);
  alert("Connexion réussie !");
  await updateAuthUI();
}

// 🚪 Déconnexion utilisateur
async function signOut() {
  await client.auth.signOut();
  alert("Déconnecté.");
  location.reload();
}

// 🔁 Affichage conditionnel formulaire
function showSignUp() {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("signup-form").classList.remove("hidden");
}
function showSignIn() {
  document.getElementById("signup-form").classList.add("hidden");
  document.getElementById("login-form").classList.remove("hidden");
}

// 🔄 Alias pour rendre plus lisible
function saveGame() {
  return saveState();
}
function loadGame() {
  return loadState();
}

let autoSaveTimeout = null;
function scheduleAutoSave(delay = 0) {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

  autoSaveTimeout = setTimeout(async () => {
    if (window.__HAS_RUNTIME_ERROR) {
      console.log(
        "[⚠️ AutoSave] Ignorée car une erreur d'exécution est survenue."
      );
      return;
    }
    try {
      await saveGame();
      console.log("[✅ AutoSave] OK");
    } catch (e) {
      console.warn("[❌ AutoSave] Échec :", e);
      // Optionnel: bloquer les autosaves futures si saveGame crash
      // window.__HAS_RUNTIME_ERROR = true;
    }
  }, delay);
}

// 🟡 Initialisation interface
window.addEventListener("DOMContentLoaded", updateAuthUI);
document.getElementById("save-btn").addEventListener("click", async () => {
  try {
    await saveGame();
  } catch (e) {
    console.error("Erreur lors de la sauvegarde :", e);
    alert("❌ Échec de la sauvegarde !");
  }
});

// 🧠 Variable globale permettant de désactiver certaines animations au chargement
window.RESTORE_MODE = false;

// === Sauvegarde de l'état du jeu ===
async function saveState() {
  const USER_ID = await getCurrentUserId();
  if (!USER_ID) return alert("Non connecté.");

  // Récupère les 10 dernières lignes de l’historique HTML
  const historyItems = Array.from(
    document.getElementById("history-list")?.children || []
  );
  const history = historyItems.map((li) => li.outerHTML).slice(-10);

  // Prépare les dispatch "AL" en patchant les missions avant export
  const vehicleById = {};
  buildings.forEach((b) =>
    b.vehicles.forEach((v) => {
      vehicleById[v.id] = v;
    })
  );

  missions.forEach((mission) => {
    if (!Array.isArray(mission.dispatched)) mission.dispatched = [];
  });

  buildings.forEach((building) => {
    building.vehicles.forEach((vehicle) => {
      if (vehicle.status === "al") {
        let closestMission = null;
        let closestDist = Infinity;
        missions.forEach((mission) => {
          if (!mission.position) return;
          const vPos =
            vehicle.lastKnownPosition || vehicle.marker?.getLatLng?.() || null;
          if (!vPos) return;

          let dist = 0;
          if (typeof map !== "undefined" && map.distance) {
            dist = map.distance(vPos, mission.position);
          } else {
            const dx = vPos.lat - mission.position.lat;
            const dy = vPos.lng - mission.position.lng;
            dist = Math.sqrt(dx * dx + dy * dy);
          }

          if (dist < closestDist) {
            closestDist = dist;
            closestMission = mission;
          }
        });

        if (
          closestMission &&
          !closestMission.dispatched.some(
            (d) => d.vehicle?.id === vehicle.id || d.vehicleId === vehicle.id
          )
        ) {
          closestMission.dispatched.push({
            vehicle,
            building,
            canceled: false,
          });
        }
      }
    });
  });

  // Prépare l'objet de sauvegarde
  const state = {
    version: SAVE_VERSION,
    player,
    history,
    callStats: window.CALL_STATS || {
      total: 0,
      bySource: { "Relais 18/112": 0, "Centre 15": 0, 17: 0 },
    },
    nextCallId:
      typeof window.NEXT_CALL_ID === "number" ? window.NEXT_CALL_ID : 0,
    soundEnabled, // 👈 ici
    currentWeather, // 👈 ajout
    currentCycle, // 👈 ajout
    buildings: buildings.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      latlng: b.latlng,
      ...(b.type === "cpi" || b.type === "cs" || b.type === "csp"
        ? {
            personnelPro: b.personnelPro,
            personnelVol: b.personnelVol,
            personnelAvailablePro: b.personnelAvailablePro,
            personnelAvailableVol: b.personnelAvailableVol,
          }
        : {
            personnel: b.personnel,
            personnelAvailable: b.personnelAvailable,
          }),
      capacity: b.capacity,
      reservedPatients:
        b.type === "hopital"
          ? b.reservedPatients?.map((r) => ({
              id: r.id,
              name: r.name,
              missionId: r.missionId,
              severity: r.severity,
            }))
          : undefined,
      patients:
        b.patients?.map((p) => ({
          id: p.id,
          name: p.name,
          missionId: p.missionId,
          severity: p.severity,
          entryTime: p.entryTime,
          duration: p.duration,
        })) || [],
      vehicles: b.vehicles.map((v) => ({
        id: v.id,
        type: v.type,
        label: v.label,
        personnel: v.required,
        status: v.status,
        ready: v.ready,
        kilometrage: v.kilometrage || 0,
        usure: typeof v.usure === "number" ? v.usure : 0,
        missionsCount: v.missionsCount || 0,
        position: v.marker?.getLatLng?.() || null,
        retourEnCours: "retourEnCours" in v ? v.retourEnCours : false,
        hospitalTargetId: v.hospitalTarget?.id || null,
        capacityEau: v.capacityEau ?? null,
      })),
    })),
    buildingOrder: Array.from(
      document.getElementById("building-list")?.children || []
    )
      .map((el) => (el.id || "").replace("building-block-", ""))
      .filter(Boolean),

    missions: missions.map((m) => ({
      hasAskedAddress: !!m.hasAskedAddress,
      id: m.id,
      type: m.type,
      realLabel: m.realLabel,
      realType: m.realType,
      label: m.label,
      address: m.address || "",
      position: m.position,
      xp: m.xp,
      reward: m.reward,
      active: m.active || false,
      progressStarted: m.progressStarted || false,
      startTime: m.startTime || null,
      durationMs: m.durationMs || null,
      labelUpdated: m.labelUpdated || false,
      dialogue: m.dialogue,
      observations: m.observations || "",
      createdAt: m.createdAt || Date.now(),

      solutionType: m.solutionType,
      sourceType: m.sourceType,
      vehicles: m.vehicles.map((v) => ({
        type: v.type,
        personnel: v.personnel,
      })),
      dispatched:
        m.dispatched?.map((d) => ({
          vehicleId: d.vehicle?.id,
          buildingId: getSafeId(d.building),
          canceled: d.canceled || false,
        })) || [],
      victims:
        m.victims?.map((v) => ({
          id: v.id,
          name: v.name,
          severity: v.severity,
          treated: v.treated || false,
          transported: v.transported || false,
          inTransport: v.inTransport || false,
          beingTreated: v.beingTreated || false,
          waitingForSMUR: v.waitingForSMUR || false,
          leaveOnSite: v.leaveOnSite || false,
          progress: v.progress || 0,
          missionId: v.missionId || m.id,
        })) || [],
    })),
  };

  // Envoie vers Supabase
  const { error } = await client.from("saves").upsert(
    [
      {
        user_id: USER_ID,
        data: state,
        updated_at: new Date().toISOString(),
      },
    ],
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    console.error("[❌ Supabase] Échec de la sauvegarde :", error);
  } else {
    //console.log('[☁️ Supabase] Sauvegarde réussie.');
  }
}

// === Chargement de l'état depuis Supabase ===
async function loadState() {
  const USER_ID = await getCurrentUserId();
  if (!USER_ID) return alert("Non connecté.");

  const { data, error } = await client
    .from("saves")
    .select("*")
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (error || !data) {
    console.warn("[☁️ Supabase] Aucune sauvegarde trouvée.");
    return;
  }

  const state = data.data;

  // 1) Contexte + flag
  beginRestore(state);

  // 2) Nettoyage DOM + tableaux
  preClearDomAndArrays(map, buildings, missions);

  // 3) Joueur + historique + ordre
  restorePlayer(state, player, updatePlayerInfo);
  restoreHistory(state);
  restoreBuildingOrder(state);

  // 4) Bâtiments + véhicules
  const { vehicleById, buildingById } = await rebuildBuildingsAndVehicles(
    state,
    buildings,
    L,
    getSafeId,
    map
  );

  // 5) Stats d’appels + NEXT_CALL_ID
  setCallStats(state);
  computeNextCallId(state);

  // 6) Missions + reprise progression
  const missionList = document.getElementById("mission-list");
  restoreMissions(state, missionList, L, map, vehicleById, buildingById);
  updatePendingBadgeAndHistory?.();
  notifyMissionsChanged();

  // 7) Réassocier et relancer les déplacements/retours
  reassociateVehiclesToMissions(
    buildings,
    missions,
    getSafeId,
    returnVehicleToCaserne
  );

  // 8) Finalisation UI + DnD
  finalizeRestore(
    buildings,
    updateSidebarVehicleList,
    bindBuildingDnd,
    getSafeId
  );

  console.log("[☁️ Supabase] Chargement terminé.");
}
