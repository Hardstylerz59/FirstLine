// === utils.js ===
const SAVE_VERSION = 1; // Incrémente à chaque version incompatible

const PATIENT_STAY_DURATION = {
  light: 240000,
  moderate: 480000,
  critical: 960000,
};

const WEATHER_TYPES = ["soleil", "nuageux", "pluie", "orageux", "neige"];
const DAY_CYCLES = ["jour", "nuit"];

function getClientCycleByLocalTime() {
  const h = new Date().getHours();
  return h >= 22 || h < 6 ? "nuit" : "jour";
}

// utils.js ou constants.js
const WEATHER_CYCLE_DURATION_MINUTES = 0.2; // Météo toutes les 4 minutes
const DAY_NIGHT_CYCLE_DURATION_MINUTES = 0.2; // Cycle jour/nuit toutes les 6 minutes

// --- Cache météo par "tuiles" de 0.25° pour éviter de trop requêter ---
const WEATHER_TILE_SIZE_DEG = 0.25;
const weatherCache = new Map();

function getWeatherTileKey(lat, lon) {
  const round = (v) =>
    Math.round(v / WEATHER_TILE_SIZE_DEG) * WEATHER_TILE_SIZE_DEG;
  return `${round(lat).toFixed(2)},${round(lon).toFixed(2)}`;
}

function _tileKey(lat, lon) {
  const r = (v) =>
    Math.round(v / WEATHER_TILE_SIZE_DEG) * WEATHER_TILE_SIZE_DEG;
  return `${r(lat).toFixed(2)},${r(lon).toFixed(2)}`;
}

async function getCityName(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RescueGame/1.0" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (
      json.address?.city ||
      json.address?.town ||
      json.address?.village ||
      json.address?.municipality ||
      json.address?.county ||
      null
    );
  } catch (_) {
    return null;
  }
}

async function getWeatherAt(lat, lon) {
  const key = _tileKey(lat, lon);
  const now = Date.now();
  const cached = weatherCache.get(key);
  if (cached && now - cached.t < 8 * 60 * 1000) return cached.data;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const cw = json?.current_weather;
      if (cw) {
        const data = {
          weather: _mapOpenMeteoCode(cw.weathercode),
          // ⚠️ cycle forcé par l'heure locale du joueur
          cycle: getClientCycleByLocalTime(),
        };
        weatherCache.set(key, { t: now, data });
        return data;
      }
    }
  } catch (_) {}
  // fallback: état global courant + cycle client
  return {
    weather: typeof currentWeather !== "undefined" ? currentWeather : "nuageux",
    cycle: getClientCycleByLocalTime(),
  };
}

const VEHICLE_SPEED_BY_TYPE = {
  /**VSAV: 20,
  FPT: 23,
  VSR: 22,
  EPA: 23,
  CDG: 18,
  PATROUILLE: 18,
  SMUR: 18,**/
  VSAV: 1,
  FPT: 1,
  VSR: 1,
  EPA: 1,
  CDG: 1,
  PATROUILLE: 1,
  SMUR: 1,
};

// Facteur météo -> plus grand = plus lent (ms/m)
window.WEATHER_SPEED_MULTIPLIER = {
  soleil: 1.0,
  nuageux: 1.0,
  pluie: 1.5,
  orageux: 1.5,
  neige: 2.0,
  brouillard: 1.5, // au cas où tu l’utilises
};

// ms/m effectif = base (par type) × facteur météo

window.GameUtils = {
  EARLY_RESPONSE_WINDOW_MS: 30000, // 30sec
  EARLY_RESPONSE_XP_BONUS: 10,
  EARLY_RESPONSE_MONEY_BONUS: 500,

  applyEarlyResponseBonus: function (mission) {
    if (mission.firstDispatchedAt) return false;

    const now = Date.now();
    const delay = now - mission.startTime;
    mission.firstDispatchedAt = now;

    if (delay <= this.EARLY_RESPONSE_WINDOW_MS) {
      mission.reward += this.EARLY_RESPONSE_MONEY_BONUS;
      mission.xp += this.EARLY_RESPONSE_XP_BONUS;

      const bonusMsg = `🚨 Réaction rapide : +${this.EARLY_RESPONSE_XP_BONUS} XP, +${this.EARLY_RESPONSE_MONEY_BONUS} €`;
      mission.bonusMessage = bonusMsg;
      console.log("🚨 Bonus de réaction rapide accordé !");

      if (typeof showNotification === "function") {
        showNotification("xp", bonusMsg); // ← On passe bien la chaîne directement ici
      }

      return true;
    }

    return false;
  },
};

const PATIENT_STATUS_FR = {
  light: "Etat Léger",
  moderate: "Etat Grave",
  critical: "Pronostic Vital",
};
// usage : PATIENT_STATUS_FR[patient.severity]

// Nombre maximum de personnel par caserne (modifiable)
const MAX_PERSONNEL_BY_BUILDING = {
  cpi: 10,
  cs: 30,
  csp: 60,
};

// Délais de départ selon type d'équipage
const PERSONNEL_DISPATCH_DELAY = {
  pro: 1000,
  vol: 2000,
};

const delayProSec = Math.round(PERSONNEL_DISPATCH_DELAY.pro / 1000);
const delayVolSec = Math.round(PERSONNEL_DISPATCH_DELAY.vol / 1000);

const descPro = `Professionnel se trouvant déjà à la caserne, peut partir quasiment sans délai (${delayProSec} s après l'appel).`;
const descVol = `Volontaire prévenu par bip, doit rejoindre la caserne avant de prendre le départ (${delayVolSec} s après l'appel).`;

const USURE_PER_MISSION = 0.5; // % d'usure par mission

function applyVehicleWear(vehicle, building) {
  vehicle.usure = Math.min(100, (vehicle.usure || 0) + USURE_PER_MISSION);
  if (vehicle.usure >= 100) {
    vehicle.usure = 100;
    vehicle.status = "hs";
    vehicle.maintenance = false; // Pour être sûr, on force le statut HS hors maintenance
    logVehicleRadio(vehicle, "hs");
    updateVehicleStatus(vehicle, "hs");
    if (building) {
      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));
    }
    // Si le tableau de bord est ouvert, MAJ du bouton et usure
    if (document.getElementById("veh-wear")) {
      document.getElementById(
        "veh-wear"
      ).textContent = `Usure : ${vehicle.usure}%`;
    }
    if (document.getElementById("veh-maintenance-btn")) {
      document.getElementById("veh-maintenance-btn").textContent =
        vehicle.maintenance || vehicle.status === "hs"
          ? `Envoyer en maintenance (${ECONOMY.maintenanceCost} €)`
          : `Envoyer en maintenance (${ECONOMY.maintenanceCost} €)`;

      document.getElementById("veh-maintenance-btn").disabled = false; // Ou true, selon si on peut lancer la réparation ici
      document.getElementById("veh-maintenance-btn").style.display = "";
    }
  }
}

const REPAIR_TIME = 10000; // 2 minutes en ms

function startVehicleRepair(vehicleId) {
  let vehicle, building;
  for (const b of buildings) {
    vehicle = b.vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      building = b;
      break;
    }
  }
  if (!vehicle || !building) {
    alert("Impossible de trouver le véhicule ou le bâtiment correspondant.");
    return;
  }

  // Empêche de relancer une maintenance déjà en cours
  if (vehicle.maintenance) return;

  // Coût de la maintenance (ex: 5000€)
  if (
    typeof ECONOMY !== "undefined" &&
    player.money < ECONOMY.maintenanceCost
  ) {
    alert("Pas assez d'argent pour la maintenance !");
    return;
  }
  if (typeof ECONOMY !== "undefined") {
    player.money -= ECONOMY.maintenanceCost;
    updatePlayerInfo && updatePlayerInfo();
  }

  // Flag de maintenance
  vehicle.maintenance = true;
  vehicle.status = "hs"; // Le véhicule est indispo durant la réparation
  updateVehicleStatus(vehicle, "hs");
  refreshVehicleStatusForBuilding(building);
  updateVehicleListDisplay(getSafeId(building));

  const btn = document.getElementById("veh-maintenance-btn");
  if (btn) {
    btn.disabled = true;
    let remaining = REPAIR_TIME / 1000;
    btn.textContent = `En réparation... (${remaining}s)`;
    let timer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        btn.textContent = `En réparation... (${remaining}s)`;
      } else {
        clearInterval(timer);
        vehicle.usure = 0;
        vehicle.maintenance = false;
        vehicle.status = "dc"; // Le véhicule redevient dispo
        updateVehicleStatus(vehicle, "dc");
        refreshVehicleStatusForBuilding(building);
        updateVehicleListDisplay(getSafeId(building));
        logVehicleRadio(vehicle, "dc", { targetBuilding: building });
        btn.textContent = "Maintenance";
        btn.disabled = vehicle.usure < 80; // (Ou toute autre logique)
        // Mets à jour l'affichage de l'usure si tu as une fonction spécifique
        if (document.getElementById("veh-wear")) {
          document.getElementById(
            "veh-wear"
          ).textContent = `Usure : ${vehicle.usure}%`;
        }
        scheduleAutoSave && scheduleAutoSave();
      }
    }, 1000);
  }
  scheduleAutoSave && scheduleAutoSave();
}

// Centralisation des mises à jour des statuts
function setVehicleStatus(
  vehicle,
  status,
  { mission = null, building = null } = {}
) {
  vehicle.status = status; // Affectation directe (cohérence immédiate)
  updateVehicleStatus(vehicle, status); // Mise à jour visuelle véhicule

  if (mission) {
    logVehicleRadio(vehicle, status, { mission });
  } else if (building) {
    logVehicleRadio(vehicle, status, { targetBuilding: building });
  } else {
    logVehicleRadio(vehicle, status);
  }

  if (building) {
    refreshVehicleStatusForBuilding(building);
    updateVehicleListDisplay(getSafeId(building));
    refreshBuildingStatus(building);
  } else if (vehicle.building) {
    // Fallback utile au cas où
    refreshVehicleStatusForBuilding(vehicle.building);
    updateVehicleListDisplay(getSafeId(vehicle.building));
    refreshBuildingStatus(vehicle.building);
  }
}

function getAvailableHospital() {
  const hosp = buildings.filter(
    (b) => b.type === "hopital" && b.patients.length < b.capacity
  );
  if (hosp.length === 0) return null;
  return hosp.reduce((a, b) => (a.patients.length < b.patients.length ? a : b));
}

function getStayDuration(severity) {
  return PATIENT_STAY_DURATION[severity] || 90000;
}

function admitPatient(hospital, patient) {
  if (!hospital || hospital.type !== "hopital") return false;
  if (hospital.patients.length >= hospital.capacity) {
    console.warn("❌ Hôpital saturé :", hospital.name);
    return false;
  }

  hospital.patients.push({
    id: `patient-${Date.now()}`,
    name: patient.name,
    missionId: patient.missionId,
    severity: patient.severity,
    entryTime: Date.now(),
    duration: getStayDuration(patient.severity),
  });

  refreshBuildingStatus(hospital);
  return true;
}

function dischargePatients() {
  const now = Date.now();
  buildings.forEach((b) => {
    if (b.type !== "hopital") return;

    // Patients à sortir
    const patientsToDischarge = b.patients.filter(
      (p) => now - p.entryTime >= p.duration
    );

    if (patientsToDischarge.length > 0) {
      patientsToDischarge.forEach((patient) => {
        // Montant à donner
        let hospitalReward = 150;
        if (patient.severity === "critical") hospitalReward = 500;
        else if (patient.severity === "moderate") hospitalReward = 250;
        else if (patient.severity === "light") hospitalReward = 150;

        player.money += hospitalReward;
        if (typeof updatePlayerInfo === "function") updatePlayerInfo();

        // Historique
        const historyList = document.getElementById("history-list");
        if (historyList) {
          const li = document.createElement("li");
          li.classList.add("history-entry"); // <- Ajoute la classe commune pour le style
          const severityFr =
            PATIENT_STATUS_FR[patient.severity] || patient.severity;
          li.innerHTML = `
            <span class="history-entry-label">
              ${patient.name} sorti de l'hôpital (${severityFr})
            </span>
            <span class="history-entry-reward">+${hospitalReward}€</span>
          `;
          historyList.insertBefore(li, historyList.firstChild); // Ajoute EN HAUT

          // Limite à 10 entrées seulement
          while (historyList.children.length > 10) {
            historyList.removeChild(historyList.lastChild);
          }
        }
      });
    }

    // Mets à jour la liste des patients restants
    const before = b.patients.length;
    b.patients = b.patients.filter((p) => now - p.entryTime < p.duration);
    if (b.patients.length !== before) {
      refreshBuildingStatus(b);
    }
  });
}

setInterval(dischargePatients, 5000); // toutes les 5 secondes

function fetchRouteCoords(start, end) {
  // Normalise les points (L.LatLng possède .lat/.lng aussi)
  const sLat = start.lat,
    sLng = start.lng;
  const eLat = end.lat,
    eLng = end.lng;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`;

  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const coords = data?.routes?.[0]?.geometry?.coordinates || [];
      return coords.map(([lng, lat]) => L.latLng(lat, lng));
    });
}

const ALLOWED_VEHICLES_BY_BUILDING = {
  cpi: ["INC", "SAP", "DIV"],
  cs: ["INC", "SAP", "DIV"],
  csp: ["INC", "SAP", "DIV"],
  hopital: ["SMUR"],
  police: ["POLICE"],
};

const VEHICLE_CATEGORIES = {
  SAP: ["VSAV"],
  INC: ["FPT", "VSR", "EPA"],
  DIV: ["CDG"],
  SMUR: ["SMUR"],
  POLICE: ["PATROUILLE"],
};

function getAllVehicleTypes() {
  // Depuis toutes les catégories, sans doublon
  const types = Object.values(VEHICLE_CATEGORIES).flat();
  return Array.from(new Set(types)).sort();
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const VEHICLE_DESCRIPTIONS = {
  VSAV: {
    label: "VSAV",
    type: "SAP",
    description:
      "Véhicule de Secours et d’Assistance aux Victimes. Il intervient pour les détresses vitales, malaises, chutes, accidents domestiques, etc.",
  },
  FPT: {
    label: "FPT",
    type: "INC",
    description:
      "Fourgon Pompe-Tonne. Véhicule incendie polyvalent pour feux urbains, feux de véhicules ou petits feux industriels.",
  },
  VSR: {
    label: "VSR",
    type: "DIV",
    description:
      "Véhicule de Secours Routier. Utilisé pour la désincarcération, interventions techniques et sauvetage routier.",
  },
  EPA: {
    label: "EPA",
    type: "INC",
    description:
      "Échelle Pivotante Automatique. Sert aux sauvetages en hauteur et à la ventilation ou attaque de feux par les étages.",
  },
  CDG: {
    label: "CDG",
    type: "INC",
    description:
      "Chef de Groupe. Véhicule de commandement, réservé aux officiers encadrant une opération.",
  },
  PATROUILLE: {
    label: "PATROUILLE",
    type: "DIV",
    description:
      "Véhicule de patrouille police. Pour surveillance, tapages, interventions simples de sécurité publique.",
  },
  SMUR: {
    label: "SMUR",
    type: "SMUR",
    description:
      "Véhicule médical de secours d'urgence. Utilisé pour le transport rapide de personnel médical et la prise en charge avancée des victimes sur le terrain.",
  },
};

const DEPART_TREE = {
  pompiers: {
    label: "🚒 Pompiers",
    categories: {
      SAP: {
        label: "🚑 Secours à personne",
        missions: {
          "Détresse vitale": {
            "Arrêt cardiaque": [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            Pendaison: [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            Défenestration: [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            "Electrocution ou foudroiement": [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            Blessé: [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            Malaise: [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            "Intoxication grave": [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
            Accouchement: [
              { type: "VSAV", nombre: 1 },
              { type: "SMUR", nombre: 1 },
            ],
          },
          "Pas de détresse vitale": {
            Malaise: [{ type: "VSAV", nombre: 1 }],
            "Chute / Relevage": [{ type: "VSAV", nombre: 1 }],
            Blessé: [{ type: "VSAV", nombre: 1 }],
            "Intoxication légère": [{ type: "VSAV", nombre: 1 }],
            "Déclenchement de téléassistance": [{ type: "VSAV", nombre: 1 }],
            PNRPAA: [{ type: "VSAV", nombre: 1 }],
          },
          "Cas particuliers": {
            "Carence ambulance privée": [{ type: "VSAV", nombre: 1 }],
          },
        },
      },

      INC: {
        label: "🔥 Incendie",
        missions: {
          "Feu de bâtiment": {
            Maison: [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
            ],
            Appartement: [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
              { type: "VSAV", nombre: 1 },
            ],
            "Atelier ou local artisanal": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
            ],
            "Entrepôt ou industrie": [
              { type: "FPT", nombre: 3 },
              { type: "CDG", nombre: 2 },
              { type: "EPA", nombre: 1 },
            ],
            "Exploitation agricole": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
            ],
            "Origine électrique": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
            ],
            Cheminée: [{ type: "FPT", nombre: 1 }],
            Communs: [{ type: "FPT", nombre: 1 }],
            "Lieu de culte": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
            ],
            "Local commercial": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
            ],
            "Parking en sous-sol": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
            ],
            "ERP avec locaux à sommeil": [
              { type: "FPT", nombre: 3 },
              { type: "CDG", nombre: 2 },
              { type: "EPA", nombre: 1 },
              { type: "VSAV", nombre: 1 },
            ],
            "ERP sans locaux à sommeil": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
              { type: "EPA", nombre: 1 },
            ],
            "Exploitation agricole": [
              { type: "FPT", nombre: 2 },
              { type: "CDG", nombre: 1 },
            ],
          },
          "Feu de véhicule": {
            "VL ou 2 roues": [{ type: "FPT", nombre: 1 }],
            "Camion / Bus": [
              { type: "FPT", nombre: 1 },
              { type: "CDG", nombre: 1 },
            ],
            "Engin agricole": [{ type: "FPT", nombre: 1 }],
          },
          "Feu Végétation": {
            Champ: [{ type: "FPT", nombre: 1 }],
          },
          "Feu divers": {
            Poubelle: [{ type: "FPT", nombre: 1 }],
          },
        },
      },

      AVP: {
        label: "🚗 Accident de circulation",
        missions: {
          "Accident VL seul": [{ type: "VSAV", nombre: 1 }],
          "Accident VL/PL": [
            { type: "VSAV", nombre: 1 },
            { type: "VSR", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          "Accident avec désincarcération": [
            { type: "VSAV", nombre: 1 },
            { type: "VSR", nombre: 1 },
          ],
          "Accident VL/Piéton": [{ type: "VSAV", nombre: 1 }],
          "Accident VL/Moto": [{ type: "VSAV", nombre: 1 }],
          "Accident avion de ligne": [
            { type: "VSAV", nombre: 4 },
            { type: "VSR", nombre: 2 },
            { type: "CDG", nombre: 2 },
            { type: "FPT", nombre: 2 },
          ],
          "Accident train": [
            { type: "VSAV", nombre: 4 },
            { type: "VSR", nombre: 2 },
            { type: "CDG", nombre: 2 },
            { type: "FPT", nombre: 2 },
          ],
          "Accident avion de tourisme / hélicoptère / ULM": [
            { type: "VSAV", nombre: 2 },
            { type: "VSR", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          "Accident ferroviaire": [
            { type: "VSAV", nombre: 4 },
            { type: "VSR", nombre: 2 },
            { type: "CDG", nombre: 2 },
            { type: "FPT", nombre: 2 },
          ],
        },
      },
      GAZ: {
        label: "💨 Risques technologiques",
        missions: {
          PGC: [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          PGR: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
          ],
          "Fuite de produit chimique": [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
            { type: "VSR", nombre: 1 },
          ],
          Pollution: [{ type: "FPT", nombre: 1 }],
          "Pollution aquatique": [
            { type: "FPT", nombre: 1 },
            { type: "VSR", nombre: 1 },
          ],
        },
      },
      SPE: {
        label: "💨 Intervention Spécifique",
        missions: {
          "Alerte à la bombe ou colis suspect": [
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 2 },
            { type: "FPT", nombre: 1 },
          ],
          Attentat: [
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 2 },
            { type: "FPT", nombre: 1 },
          ],
          "Effondrement bâtiment": [
            { type: "VSR", nombre: 1 },
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 1 },
            { type: "FPT", nombre: 1 },
          ],
          "Personne tombée à l'eau ou noyade": [
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 2 },
            { type: "FPT", nombre: 1 },
          ],
          "Secours nautique": [
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 2 },
            { type: "FPT", nombre: 1 },
          ],
          "Voie d'eau dans bateau": [
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 2 },
            { type: "FPT", nombre: 1 },
          ],
        },
      },

      SECDIV: {
        label: "🔧 Secours divers",
        missions: {
          Explosion: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
            { type: "VSAV", nombre: 1 },
          ],
          "Intoxication CO": [
            { type: "FPT", nombre: 1 },
            { type: "VSAV", nombre: 1 },
          ],
          "Intoxication CO nombreuses victimes": [
            { type: "FPT", nombre: 2 },
            { type: "VSAV", nombre: 2 },
            { type: "CDG", nombre: 1 },
          ],
          "Menace de se jeter à l'eau": [{ type: "VSAV", nombre: 1 }],
          "Menace de se jeter d'une hauteur": [
            { type: "VSAV", nombre: 1 },
            { type: "FPT", nombre: 1 },
          ],
          "Personne bloquée dans un ascenseur": [{ type: "FPT", nombre: 1 }],
          "Secours en milieu périlleux": [
            { type: "FPT", nombre: 1 },
            { type: "VSAV", nombre: 1 },
          ],
        },
      },

      DIV: {
        label: "🔧 Interventions diverses",
        missions: {
          "Assistance à personne": [{ type: "VSAV", nombre: 1 }],
          "Assistance aux animaux": [{ type: "FPT", nombre: 1 }],
          "Assistance et prévention": [{ type: "FPT", nombre: 1 }],
          Bâchage: [{ type: "FPT", nombre: 1 }],
          "Chute de ligne électrique": [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          "Dégagement VP": [{ type: "FPT", nombre: 1 }],
          "Épuisement de locaux": [{ type: "FPT", nombre: 1 }],
          "Fermeture robinet vanne": [{ type: "FPT", nombre: 1 }],
          "Glissement de terrain": [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          "Matériaux menaçant ruine": [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
          "Ouverture de porte": [{ type: "FPT", nombre: 1 }],
          "Sauvetage animalier": [{ type: "FPT", nombre: 1 }],
          "Ascenseur bloqué": [{ type: "FPT", nombre: 1 }],
          "Appel injustifié": [{ type: "VSAV", nombre: 1 }],
        },
      },
    },
  },
  police: {
    label: "👮 Police",
    categories: {
      URGENCES: {
        label: "🚨 Urgences",
        missions: {
          "Cambriolage en cours": [{ type: "PATROUILLE", nombre: 2 }],
          Agression: [{ type: "PATROUILLE", nombre: 1 }],
          "Violences conjugales": [{ type: "PATROUILLE", nombre: 1 }],
        },
      },
      ROUTIER: {
        label: "🚘 Police route",
        missions: {
          "Contrôle routier": [{ type: "PATROUILLE", nombre: 1 }],
          "Accident matériel": [{ type: "PATROUILLE", nombre: 1 }],
          "Fuite de conducteur": [{ type: "PATROUILLE", nombre: 1 }],
        },
      },
      SECURITE: {
        label: "🔒 Sécurité publique",
        missions: {
          "Tapage nocturne": [{ type: "PATROUILLE", nombre: 1 }],
          "Rassemblement perturbateur": [{ type: "PATROUILLE", nombre: 1 }],
          "Vol dans magasin": [{ type: "PATROUILLE", nombre: 1 }],
        },
      },
    },
  },
};

const requiredPersonnel = {
  VSAV: 3,
  VSR: 3,
  FPT: 6,
  EPA: 2,
  CDG: 1,
  PATROUILLE: 3,
  SMUR: 3,
};

const VEHICLE_LIMITS = {
  cpi: 5,
  cs: 10,
  csp: 20,
  hopital: 8,
  police: 6,
};

const ECONOMY = {
  buildingCost: {
    cpi: 120000,
    cs: 280000,
    csp: 500000,
    hopital: 500000,
    police: 250000,
  },
  vehicleCost: {
    VSAV: 25000,
    FPT: 60000,
    VSR: 40000,
    EPA: 120000,
    CDG: 10000,
    PATROUILLE: 20000,
    SMUR: 80000,
  },
  recruitCost: 5000,
  recruitCostPro: 10000, // <-- Ajoute ça
  recruitCostVol: 2500, // <-- Et ça
  xpSystem: {
    baseXP: 100,
    factor: 1.5,
    baseReward: 1000,
  },
  maintenanceCost: 2500,
};

function logVehicleRadio(vehicle, status, options = {}) {
  // Mapping des codes status
  const statusLabels = {
    dc: "DC",
    er: "ER",
    tr: "TR",
    ch: "CH",
    ot: "OT",
    nd: "ND",
    at: "AT",
    hs: "HS",
  };

  // Libellé véhicule (label custom sinon type)
  let vehicleLabel = vehicle.label || vehicle.type || "VHL";
  let context = "";

  // Statut "engagé"
  if (status === "er" && options.mission) {
    context = "sur mission";
  } else if (status === "al") {
    context = `sur place`;
  } else if (status === "hs") {
    context = ``;
  } else if (status === "at") {
    context = `prend le départ`;
  }
  // Statut "transport"
  else if (status === "tr" && options.targetBuilding) {
    if (options.targetBuilding.type === "hopital") {
      context = `transporte sur le CH ${options.targetBuilding.name}`;
    } else {
      context = `en transport vers ${options.targetBuilding.name}`;
    }
  } else if (status === "ch" && options.targetBuilding) {
    if (options.targetBuilding.type === "hopital") {
      context = `arrivé sur le CH ${options.targetBuilding.name}`;
    } else {
      context = `arrivé sur ${options.targetBuilding.name}`;
    }
  }
  // Statut "retour"
  else if (status === "ot" && options.targetBuilding) {
    let dest = "";
    // Type du bâtiment détecté automatiquement
    if (options.targetBuilding.type === "hopital") {
      dest = `CH ${options.targetBuilding.name}`;
    } else if (options.targetBuilding.type === "police") {
      dest = `Commissariat ${options.targetBuilding.name}`;
    } else if (
      options.targetBuilding.type === "cs" ||
      options.targetBuilding.type === "csp" ||
      options.targetBuilding.type === "cpi"
    ) {
      dest = `CIS ${options.targetBuilding.name}`;
    } else {
      dest = options.targetBuilding.name;
    }
    context = `rentre vers ${dest}`;
  }
  // Statut "dispo caserne"
  else if (status === "dc" && options.targetBuilding) {
    context = `disponible à ${options.targetBuilding.name}`;
  }

  addRadioLogLine(vehicleLabel, status, context);
}

function addRadioLogLine(vehicleLabel, status, context = "") {
  const statusLabels = {
    dc: "DC",
    er: "ER",
    tr: "TR",
    ch: "CH",
    ot: "OT",
    nd: "ND",
    at: "AT",
    hs: "HS",
  };
  const statusTxt = statusLabels[status] || status.toUpperCase();

  const logList = document.getElementById("radio-log-list");
  if (!logList) return;

  const li = document.createElement("li");
  li.className = "radio-log-line";

  li.innerHTML = `
    <span class="radio-log-left">
      <strong>${vehicleLabel}</strong> ${context}
    </span>
    <span class="status ${status}">${statusTxt}</span>
  `;

  logList.insertBefore(li, logList.firstChild);

  while (logList.children.length > 10) {
    logList.removeChild(logList.lastChild);
  }

  logList.scrollTop = logList.scrollHeight;
}

function getUnloadingDelay() {
  // Simule congestion CH, échange entre pompiers/infirmiers, brancard, etc.
  return 10000 + Math.random() * 15000; // entre 10 et 25 secondes
}

function estimateTravelDuration(from, to, vehicleType) {
  const speed = VEHICLE_SPEED_BY_TYPE[vehicleType] || 20;
  const dist = map.distance(from, to);
  const durationMs = dist * speed;
  return Math.round(durationMs / 1000);
}

function resetAllVehiclesToCaserne() {
  buildings.forEach((building) => {
    building.vehicles.forEach((vehicle) => {
      if (
        vehicle.status === "al" ||
        vehicle.status === "ot" ||
        vehicle.status === "er" ||
        vehicle.status === "at" ||
        vehicle.status === "tr" ||
        vehicle.status === "nd"
      ) {
        if (vehicle.returnInterval) clearInterval(vehicle.returnInterval);
        if (vehicle.returnAnimation)
          cancelAnimationFrame(vehicle.returnAnimation);
        if (vehicle.marker) map.removeLayer(vehicle.marker);

        vehicle.retourEnCours = false;
        vehicle.ready = true;
        vehicle.status = "dc";
        vehicle.marker = null;
        vehicle.lastKnownPosition = building.latlng;
        updateVehicleStatus(vehicle, "dc");
      }
    });
    refreshBuildingStatus(building);
  });
  scheduleAutoSave();
}

function clearAllVehicleMarkers() {
  let removedCount = 0;

  buildings.forEach((building) => {
    building.vehicles.forEach((vehicle) => {
      if (vehicle.marker && map.hasLayer(vehicle.marker)) {
        try {
          map.removeLayer(vehicle.marker);
          removedCount++;
        } catch (e) {
          console.warn(`Échec suppression marker pour ${vehicle.label}`, e);
        }
        vehicle.marker = null;
      }
    });
  });

  alert(`🚗 ${removedCount} marqueur(s) de véhicule supprimé(s).`);
}

let typewriterInterval = null;
let typewriterFullText = "";
let typewriterTarget = null;

function typewriterEffect(element, text, delay = 20) {
  if (typewriterInterval) clearInterval(typewriterInterval);

  typewriterFullText = text;
  typewriterTarget = element;

  element.textContent = "";
  let i = 0;

  typewriterInterval = setInterval(() => {
    element.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
      typewriterTarget = null;
    }
  }, delay);
}

function revealFullTypewriterText() {
  if (typewriterInterval && typewriterTarget) {
    clearInterval(typewriterInterval);
    typewriterTarget.textContent = typewriterFullText;
    typewriterInterval = null;
    typewriterTarget = null;
  }
}

function handleRevealAddress() {
  revealFullTypewriterText();
  const addrP = document.getElementById("call-address");
  if (addrP) addrP.classList.remove("hidden");

  // Met à jour mission.address à partir du texte UI tout de suite
  updateAddressFromUI();

  // Centre cartes si coords
  const lat = currentCallMission?.position?.lat;
  const lng = currentCallMission?.position?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    centerMainMapTo(lat, lng);
    syncCallMiniMap(lat, lng);
  }

  // Afficher menus
  document.getElementById("depart-type-section")?.classList.remove("hidden");
  buildDepartTreeUI();

  document.getElementById("reveal-address-btn")?.classList.add("hidden");
}

function normalizeId(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

function getSafeId(building) {
  return `${normalizeId(building.type)}-${normalizeId(building.name)}`;
}

function getIconForType(type) {
  const icons = {
    caserne: "assets/icons/caserne.png",
    hopital: "assets/icons/hopital.png",
    police: "assets/icons/commissariat.png",
  };
  return icons[type] || icons.caserne;
}

function updateVehicleStatus(vehicle, status) {
  vehicle.status = status;
  if (vehicle.statusElement) {
    vehicle.statusElement.className = "status " + status;
    const labels = {
      dc: "DC",
      nd: "ND",
      er: "ER",
      al: "AL",
      ot: "OT",
      at: "AT",
      tr: "TR", // Transport CH
      ch: "CH", // Arrivé CH
    };
    vehicle.statusElement.textContent = labels[status] || status.toUpperCase();
    const descriptions = {
      dc: "Disponible Caserne",
      nd: "Non Disponible (pas assez de personnel)",
      er: "En Route",
      al: "Sur Les Lieux",
      ot: "En Retour Disponible",
      tr: "Transport Hôpital",
      ch: "Arrivé à l’Hôpital",
      at: "Attente de Départ",
    };
    vehicle.statusElement.title = descriptions[status] || "";
  }
  if (vehicle.marker) {
    if (["dc", "al"].includes(status)) {
      map.removeLayer(vehicle.marker);
    } else if (!map.hasLayer(vehicle.marker)) {
      vehicle.marker.addTo(map);
    }
  }
}

function refreshBuildingStatus(building) {
  if (window.RESTORE_MODE) {
    return;
  }

  if (typeof SIMULATION_ACTIVE !== "undefined" && SIMULATION_ACTIVE) return;

  const safeId = getSafeId(building);

  if (building.type === "hopital") {
    const reserved = building.reservedPatients
      ? building.reservedPatients.length
      : 0;
    const patientCount = (building.patients?.length || 0) + reserved;
    const capText = `${patientCount}/${building.capacity}`;
    const capEl = document.getElementById(`capacity-${safeId}`);
    if (capEl) capEl.textContent = capText;

    // 🔥 AJOUTE CECI pour rafraîchir personnel (comme pour les autres bâtiments) :
    if (typeof building.personnel === "number") {
      const total = building.personnel;
      const available = building.personnelAvailable ?? total;
      const staffTotalEl = document.getElementById(`staff-${safeId}`);
      const staffAvailEl = document.getElementById(`staff-avail-${safeId}`);
      if (staffTotalEl) staffTotalEl.textContent = total;
      if (staffAvailEl) staffAvailEl.textContent = available;
    }
    return;
  }

  if (
    building.type === "cpi" ||
    building.type === "cs" ||
    building.type === "csp"
  ) {
    const proTotal = building.personnelPro;
    const volTotal = building.personnelVol;
    let proEngaged = 0,
      volEngaged = 0;
    building.vehicles.forEach((v) => {
      const engaged = v._engagedStaff || { pro: 0, vol: 0 }; // À remplir à l'affectation réelle
      proEngaged += engaged.pro || 0;
      volEngaged += engaged.vol || 0;
    });
    building.personnelAvailablePro = proTotal - proEngaged;
    building.personnelAvailableVol = volTotal - volEngaged;
    document.getElementById(`staff-pro-${safeId}`).textContent = proTotal;
    document.getElementById(`staff-vol-${safeId}`).textContent = volTotal;
    document.getElementById(`staff-pro-avail-${safeId}`).textContent =
      building.personnelAvailablePro;
    document.getElementById(`staff-vol-avail-${safeId}`).textContent =
      building.personnelAvailableVol;
  } else {
    const total = building.personnel;
    let engagedPersonnel = 0;
    building.vehicles.forEach((v) => {
      const isTemp = v._tempEngaged === true;
      const isActive =
        ["er", "al", "at"].includes(v.status) ||
        (v.status === "ot" && !v.ready);
      if (isTemp || isActive) engagedPersonnel += v.required || 0;
    });

    const available = total - engagedPersonnel;
    building.personnelAvailable = available;
    document.getElementById(`staff-${safeId}`).textContent = total;
    document.getElementById(`staff-avail-${safeId}`).textContent = available;

    building.vehicles.forEach((v) => {
      if (v.status === "ot" && v.retourEnCours) return;
      const isEngaged = ["er", "al", "at"].includes(v.status);
      if (v.ready && !isEngaged && !v.retourEnCours) {
        const enough = available >= (v.required || 0);
        updateVehicleStatus(v, enough ? "dc" : "nd");
      }
    });
  }
}

function simulatePersonnelUI(building, tempVehicles) {
  const safeId = getSafeId(building);
  if (
    building.type === "cpi" ||
    building.type === "cs" ||
    building.type === "csp"
  ) {
    let proUsed = 0,
      volUsed = 0;
    tempVehicles
      .filter((v) => v.building === building)
      .forEach((v) => {
        // Simulation : on utilise toujours les pros en priorité
        const req = v.personnel;
        const proDispo = building.personnelPro - proUsed;
        const proThis = Math.min(proDispo, req);
        const volThis = Math.max(0, req - proThis);
        proUsed += proThis;
        volUsed += volThis;
      });
    const proDispo = building.personnelPro - proUsed;
    const volDispo = building.personnelVol - volUsed;
    document.getElementById(`staff-pro-${safeId}`).textContent =
      building.personnelPro;
    document.getElementById(`staff-vol-${safeId}`).textContent =
      building.personnelVol;
    document.getElementById(`staff-pro-avail-${safeId}`).textContent = proDispo;
    document.getElementById(`staff-vol-avail-${safeId}`).textContent = volDispo;
  } else {
    const engaged = tempVehicles
      .filter((v) => v.building === building)
      .reduce((sum, v) => sum + v.personnel, 0);
    const total = building.personnel;
    const dispo = total - engaged;
    const safeId = getSafeId(building);
    const elTotal = document.getElementById(`staff-${safeId}`);
    const elDispo = document.getElementById(`staff-avail-${safeId}`);
    if (elTotal) elTotal.textContent = total;
    if (elDispo) elDispo.textContent = dispo;
  }
}

function generateVehicleCheckboxList(departType, disponibles, targetListEl) {
  const autoSelect = {};
  departType.forEach((req) => (autoSelect[req.type] = req.nombre));
  targetListEl.innerHTML = "";
  disponibles.forEach((entry) => {
    const v = entry.vehicle;
    const autoCheck = (autoSelect[v.type] || 0) > 0;
    if (autoCheck) autoSelect[v.type]--;
    const wrapper = document.createElement("div");
    wrapper.className = "vehicle-entry";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = autoCheck;
    checkbox.dataset.vehicleId = v.id;
    if (!entry.building.id) {
      entry.building.id = `building-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;
    }
    checkbox.dataset.buildingId = entry.building.id;
    const labelEl = document.createElement("label");
    labelEl.innerHTML = `${v.label} – ${v.type} – ${Math.round(
      entry.distance
    )} m <span class="status ${
      v.status
    }" style="margin-left: 8px;">${v.status.toUpperCase()}</span>`;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(labelEl);
    targetListEl.appendChild(wrapper);
  });
}

function updateMissionButton(mission) {
  const btn = mission.domElement?.querySelector("button");
  if (!btn) return;

  const hasEngagedVehicles = mission.dispatched?.some(
    (d) =>
      !d.canceled && (d.vehicle.status === "er" || d.vehicle.status === "al")
  );

  const allOnSite =
    mission.dispatched?.length > 0 &&
    mission.dispatched.every((d) =>
      ["al", "tr", "ch"].includes(d.vehicle.status)
    );

  const shouldManage =
    mission.progressStarted ||
    mission.active ||
    hasEngagedVehicles ||
    allOnSite ||
    mission.awaitingProgress;

  if (shouldManage) {
    btn.textContent = "Gérer";
    btn.onclick = () => openManageMission(mission.id);
  } else {
    btn.textContent = "Traiter";
    btn.onclick = () => openCallModal(mission.id);
  }

  if (mission.marker && mission.marker.getPopup()) {
    mission.marker.setPopupContent(() => generateMissionPopupContent(mission));

    // Et on force la réouverture pour l’effet direct
    if (mission.marker.isPopupOpen()) {
      mission.marker.closePopup();
      mission.marker.openPopup();
    }
  }
}

function generateMissionPopupContent(mission) {
  const wrapper = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent = mission.label || mission.name;
  wrapper.appendChild(title);

  const status = document.createElement("p");
  status.innerHTML = mission.domElement.querySelector("p")?.innerHTML || "";
  wrapper.appendChild(status);

  const btn = document.createElement("button");

  const shouldManage =
    mission.progressStarted ||
    mission.active ||
    mission.awaitingProgress ||
    mission.dispatched?.some(
      (d) => !d.canceled && ["er", "al", "tr", "ch"].includes(d.vehicle.status)
    );

  if (shouldManage) {
    btn.textContent = "Gérer";
    btn.onclick = () => openManageMission(mission.id);
  } else {
    btn.textContent = "Traiter";
    btn.onclick = () => openCallModal(mission.id);
  }

  wrapper.appendChild(btn);
  return wrapper;
}

// --- utils.js ---

// ⚠️ On garde la mécanique setInterval mais on synchronise d'abord la classe
// "selected-synced" et le type (dc/ot) entre le modal et la sidebar pour un
// même véhicule, en se basant sur un attribut d'identité (data-vehicle-id / data-id / data-veh-id).

let isBlinkOn = false;

/* Helpers pour relier modal <-> sidebar par ID véhicule */
function _getVehIdFromStatusEl(el) {
  // essaie d'abord sur l'élément lui-même
  const selfId =
    el.getAttribute("data-vehicle-id") ||
    el.getAttribute("data-id") ||
    el.getAttribute("data-veh-id");
  if (selfId) return selfId;

  // puis remonte à un parent porteur d'ID
  const host = el.closest("[data-vehicle-id], [data-id], [data-veh-id]");
  if (!host) return null;
  return (
    host.getAttribute("data-vehicle-id") ||
    host.getAttribute("data-id") ||
    host.getAttribute("data-veh-id")
  );
}

function _cssEsc(v) {
  return String(v).replace(/["\\]/g, "\\$&");
}

function _getAllStatusPeers(vehId) {
  const id = _cssEsc(vehId);
  // On couvre plusieurs variantes possibles du DOM (ID sur le .status ou sur un parent)
  return Array.from(
    document.querySelectorAll(
      `.status[data-vehicle-id="${id}"], [data-vehicle-id="${id}"] .status,
       .status[data-id="${id}"],         [data-id="${id}"] .status,
       .status[data-veh-id="${id}"],     [data-veh-id="${id}"] .status`
    )
  );
}

/* Synchronise la classe selected-synced et le type dc/ot entre vues */
function _syncSelectedAcrossViews() {
  const selected = document.querySelectorAll(".status.selected-synced");
  selected.forEach((el) => {
    const vehId = _getVehIdFromStatusEl(el);
    if (!vehId) return;

    const isDC = el.classList.contains("dc");
    const isOT = el.classList.contains("ot");

    _getAllStatusPeers(vehId).forEach((peer) => {
      // Nettoie les vieux styles inline (ancienne implémentation)
      if (peer.style && (peer.style.backgroundColor || peer.style.color)) {
        peer.style.backgroundColor = "";
        peer.style.color = "";
      }

      // Assure la propagation de l'état "sélectionné"
      if (!peer.classList.contains("selected-synced")) {
        peer.classList.add("selected-synced");
      }

      // Harmonise le type (dc/ot) sur tous les peers
      if (isDC) {
        peer.classList.add("dc");
        peer.classList.remove("ot");
      } else if (isOT) {
        peer.classList.add("ot");
        peer.classList.remove("dc");
      }
    });
  });
}

/* Boucle de clignotement conservée (couleurs identiques à ton code) */
setInterval(() => {
  // 🔑 Nouveau : avant de clignoter, on synchronise modal <-> sidebar
  _syncSelectedAcrossViews();

  isBlinkOn = !isBlinkOn;

  document.querySelectorAll(".status.selected-synced").forEach((el) => {
    if (el.classList.contains("dc")) {
      // Clignotement pour DC : vert ↔ blanc
      if (isBlinkOn) {
        el.style.backgroundColor = "green";
        el.style.color = "white";
      } else {
        el.style.backgroundColor = "white";
        el.style.color = "green";
      }
    } else if (el.classList.contains("ot")) {
      // Clignotement pour OT : bleu ↔ blanc
      if (isBlinkOn) {
        el.style.backgroundColor = "blue";
        el.style.color = "white";
      } else {
        el.style.backgroundColor = "white";
        el.style.color = "blue";
      }
    }
  });
}, 700);

// utils.js (ou où est ta fonction)
function clearSelectedSyncedStatus(scopeSelector = null) {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document;
  if (!root) return;

  root
    .querySelectorAll(".status.selected-synced, .status.is-blinking")
    .forEach((el) => {
      el.classList.remove("selected-synced", "is-blinking");
      el.style.backgroundColor = "";
      el.style.color = "";
    });
}

setInterval(() => {
  const now = Date.now();
  missions.forEach((m) => {
    if (!m.active && m.startTime && m.timerElement) {
      const diff = Math.floor((now - m.startTime) / 1000);
      const h = Math.floor(diff / 3600)
        .toString()
        .padStart(2, "0");
      const mns = Math.floor((diff % 3600) / 60)
        .toString()
        .padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      m.timerElement.textContent = `Depuis ${h}:${mns}:${s}`;
    }
  });
}, 1000);

// === utils.js :: BEGIN INSERT — Route math & animator (centralisation animation) ===

/**
 * Retourne la distance (en mètres) entre deux L.LatLng.
 * Utilise map.distance si dispo, sinon un Haversine simple.
 */
function __distanceMeters(a, b) {
  try {
    if (window.map && typeof window.map.distance === "function") {
      return window.map.distance(a, b);
    }
  } catch (_) {}
  // Fallback Haversine
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat),
    la2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Prépare le profil de route : distances par segments, cumul, total.
 * @param {L.LatLng[]} coords
 * @returns {{coords:L.LatLng[], segmentDistances:number[], cumulativeDistances:number[], totalRouteDistance:number}}
 */
function computeRouteProfile(coords) {
  const segmentDistances = [];
  let totalRouteDistance = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const d = __distanceMeters(coords[i], coords[i + 1]);
    segmentDistances.push(d);
    totalRouteDistance += d;
  }

  const cumulativeDistances = [0];
  for (let i = 0; i < segmentDistances.length; i++) {
    cumulativeDistances.push(cumulativeDistances[i] + segmentDistances[i]);
  }

  return {
    coords,
    segmentDistances,
    cumulativeDistances,
    totalRouteDistance,
  };
}

/**
 * Calcule la position (L.LatLng) à une distance "covered" sur le profil.
 * @param {{coords:L.LatLng[], segmentDistances:number[], cumulativeDistances:number[], totalRouteDistance:number}} profile
 * @param {number} covered - distance parcourue en mètres
 * @returns {L.LatLng}
 */
function positionAtDistance(profile, covered) {
  const { coords, segmentDistances, cumulativeDistances } = profile;

  // Cas bordures
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1 || covered <= 0) return coords[0];
  if (covered >= cumulativeDistances[cumulativeDistances.length - 1]) {
    return coords[coords.length - 1];
  }

  let segmentIndex = 0;
  while (
    segmentIndex < cumulativeDistances.length - 1 &&
    cumulativeDistances[segmentIndex + 1] < covered
  ) {
    segmentIndex++;
  }

  const a = coords[segmentIndex];
  const b = coords[segmentIndex + 1];
  const segDist = segmentDistances[segmentIndex] || 0;
  const intoSegment = covered - cumulativeDistances[segmentIndex];
  const ratio = segDist === 0 ? 0 : intoSegment / segDist;

  const lat = a.lat + (b.lat - a.lat) * ratio;
  const lng = a.lng + (b.lng - a.lng) * ratio;
  return L.latLng(lat, lng);
}

/**
 * Anime un marqueur le long d’un itinéraire, à une vitesse donnée (m/s).
 * - coords: tableau de L.LatLng (au moins 2)
 * - speedMps: vitesse en m/s (déjà factorisée météo/nuit si tu veux)
 * - marker: (optionnel) un L.Marker existant à mettre à jour
 * - onProgress({pos, covered, total}): rappel à chaque frame
 * - onDone(): rappel à l’arrivée
 * Retourne un handle { cancel() } pour stopper l’animation si besoin.
 */
function animateAlongRoute({
  coords,
  speedMps,
  marker = null,
  onProgress,
  onDone,
}) {
  if (
    !Array.isArray(coords) ||
    coords.length < 2 ||
    !isFinite(speedMps) ||
    speedMps <= 0
  ) {
    // Rien à animer
    if (marker && coords[0]) {
      try {
        marker.setLatLng(coords[coords.length - 1] || coords[0]);
      } catch (_) {}
    }
    onDone?.();
    return { cancel() {} };
  }

  const profile = computeRouteProfile(coords);
  const total = profile.totalRouteDistance;
  const startTime = Date.now();

  let raf = null;
  function step() {
    const elapsed = Date.now() - startTime; // ms
    const covered = Math.min((speedMps * elapsed) / 1000, total);
    const pos = positionAtDistance(profile, covered);

    if (pos && marker && marker.setLatLng) {
      try {
        marker.setLatLng(pos);
      } catch (_) {}
    }

    onProgress?.({ pos, covered, total });

    if (covered < total) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  }

  raf = requestAnimationFrame(step);

  return {
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    stop() {
      this.cancel();
    }, // alias pour stopActiveRoute()
  };
}

// Expose utilitaires globalement pour usage depuis missions.js / ui.js
window.RouteMath = { computeRouteProfile, positionAtDistance };
window.RouteAnimator = { animateAlongRoute };

// === utils.js :: END INSERT — Route math & animator ===
// === STOP helper pour animations de trajets (RAF historique ou RouteAnimator) ===
function stopActiveRoute(vehicle) {
  if (!vehicle) return;
  const ra = vehicle.returnAnimation;
  // Cas historique: id numérique de requestAnimationFrame
  if (typeof ra === "number") {
    cancelAnimationFrame(ra);
  }
  // Cas RouteAnimator: handler/objet avec stop()
  else if (
    ra &&
    (typeof ra.stop === "function" || typeof ra.cancel === "function")
  ) {
    try {
      (ra.stop || ra.cancel).call(ra);
    } catch (_) {}
  }
  vehicle.returnAnimation = null;
  vehicle.retourEnCours = false;
}

// ==== BEGIN refactor helpers (added) ====

// === Shared speed/duration helpers (idempotent) ===
if (typeof window.getMsPerMeter !== "function") {
  window.getMsPerMeter = function getMsPerMeter(vehicle) {
    try {
      return (
        (window.VEHICLE_SPEED_BY_TYPE && VEHICLE_SPEED_BY_TYPE[vehicle.type]) ||
        20
      );
    } catch (_) {
      return 20;
    }
  };
}
if (typeof window.computeTravelDurationMs !== "function") {
  window.computeTravelDurationMs = function computeTravelDurationMs(
    distanceMeters,
    msPerMeter
  ) {
    const f = typeof msPerMeter === "number" ? msPerMeter : 20;
    return Math.max(0, Math.round((distanceMeters || 0) * f));
  };
}
if (typeof window.setVehicleArrivalFromDistance !== "function") {
  window.setVehicleArrivalFromDistance = function setVehicleArrivalFromDistance(
    vehicle,
    distanceMeters
  ) {
    const msPerMeter = window.getMsPerMeter
      ? window.getMsPerMeter(vehicle)
      : 20;
    const duration = window.computeTravelDurationMs
      ? window.computeTravelDurationMs(distanceMeters, msPerMeter)
      : Math.max(0, Math.round((distanceMeters || 0) * msPerMeter));
    vehicle.arrivalTime = Date.now() + duration;
    return { duration, msPerMeter };
  };
}

// === Unified route animation for vehicles ===
if (typeof window.animateVehicleRoute !== "function") {
  window.animateVehicleRoute = function animateVehicleRoute({
    vehicle,
    coords,
    speedFactorMsPerMeter,
    onProgress,
    onArrival,
  }) {
    if (!vehicle) return null;
    try {
      if (typeof window.stopActiveRoute === "function")
        window.stopActiveRoute(vehicle);
    } catch (_) {}
    if (!coords || coords.length < 2) {
      try {
        const last = coords && coords[coords.length - 1];
        if (last) {
          if (typeof window.progressVehicle === "function")
            window.progressVehicle(vehicle, last);
          if (vehicle.marker && vehicle.marker.setLatLng)
            vehicle.marker.setLatLng(last);
        }
      } catch (_) {}
      if (typeof onArrival === "function") onArrival();
      return null;
    }
    const msPerMeter =
      speedFactorMsPerMeter ||
      (window.getMsPerMeter ? window.getMsPerMeter(vehicle) : 20);
    const speedMps = 1000 / msPerMeter;
    let handler = null;
    try {
      handler =
        window.RouteAnimator && window.RouteAnimator.animateAlongRoute
          ? window.RouteAnimator.animateAlongRoute({
              coords,
              speedMps,
              marker: vehicle.marker,
              onProgress: ({ pos }) => {
                try {
                  if (pos) {
                    if (typeof window.progressVehicle === "function")
                      window.progressVehicle(vehicle, pos);
                    if (typeof onProgress === "function") onProgress(pos);
                  }
                } catch (_) {}
              },
              onDone: () => {
                try {
                  vehicle.returnAnimation = null;
                  vehicle.retourEnCours = false;
                } catch (_) {}
                if (typeof onArrival === "function") onArrival();
              },
            })
          : null;
    } catch (_) {}
    vehicle.returnAnimation = handler;
    vehicle.retourEnCours = true;
    return handler;
  };
}

// === High-level helper: fetch route + animate ===
if (typeof window.goVehicleTo !== "function") {
  window.goVehicleTo = function goVehicleTo({
    vehicle,
    start,
    end,
    onProgress,
    onArrival,
  }) {
    if (!vehicle || !start || !end) {
      if (typeof onArrival === "function") onArrival();
      return;
    }
    try {
      if (!vehicle.marker && window.L && L.marker) {
        vehicle.marker = L.marker(start).addTo(window.map || map);
      }
    } catch (_) {}
    return fetchRouteCoords(start, end).then((coords) => {
      if (!coords || coords.length < 2) {
        try {
          if (vehicle.marker && vehicle.marker.setLatLng)
            vehicle.marker.setLatLng(end);
          if (typeof window.progressVehicle === "function")
            window.progressVehicle(vehicle, end);
        } catch (_) {}
        if (typeof onArrival === "function") onArrival();
        return null;
      }
      const prof =
        window.RouteMath && window.RouteMath.computeRouteProfile
          ? window.RouteMath.computeRouteProfile(coords)
          : { totalRouteDistance: 0 };
      const total = prof.totalRouteDistance || 0;
      const { msPerMeter } = window.setVehicleArrivalFromDistance
        ? window.setVehicleArrivalFromDistance(vehicle, total)
        : {
            msPerMeter: window.getMsPerMeter
              ? window.getMsPerMeter(vehicle)
              : 20,
          };
      try {
        if (typeof window.startVehicleProgress === "function")
          window.startVehicleProgress(vehicle, coords[0]);
      } catch (_) {}
      return window.animateVehicleRoute({
        vehicle,
        coords,
        speedFactorMsPerMeter: msPerMeter,
        onProgress,
        onArrival,
      });
    });
  };
}

// === Staff release & arrival handling on return ===
if (typeof window.releaseEngagedStaffToBuilding !== "function") {
  window.releaseEngagedStaffToBuilding = function releaseEngagedStaffToBuilding(
    vehicle,
    building
  ) {
    if (!vehicle || !building) return;
    try {
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
    } catch (_) {}
  };
}
if (typeof window.onVehicleArrivedAtBuilding !== "function") {
  window.onVehicleArrivedAtBuilding = function onVehicleArrivedAtBuilding(
    vehicle,
    building
  ) {
    if (!vehicle || !building) return;
    try {
      window.releaseEngagedStaffToBuilding &&
        window.releaseEngagedStaffToBuilding(vehicle, building);
      if (typeof window.updateVehicleStatus === "function")
        window.updateVehicleStatus(vehicle, "dc");
      vehicle.status = "dc";
      window.logVehicleRadio &&
        window.logVehicleRadio(vehicle, "dc", { targetBuilding: building });
      window.applyVehicleWear && window.applyVehicleWear(vehicle);
      const safeId = window.getSafeId ? window.getSafeId(building) : null;
      if (typeof window.refreshVehicleStatusForBuilding === "function")
        window.refreshVehicleStatusForBuilding(building);
      if (typeof window.updateVehicleListDisplay === "function" && safeId)
        window.updateVehicleListDisplay(safeId);
      if (typeof window.refreshBuildingStatus === "function")
        window.refreshBuildingStatus(building);
      try {
        const sid = safeId;
        if (sid) {
          const spanTotal = document.getElementById(`staff-${sid}`);
          const spanAvail = document.getElementById(`staff-avail-${sid}`);
          if (spanTotal) spanTotal.textContent = building.personnel || 0;
          if (spanAvail)
            spanAvail.textContent =
              (["cpi", "cs", "csp"].includes(building.type) &&
                (building.personnelAvailablePro || 0) +
                  (building.personnelAvailableVol || 0)) ||
              building.personnelAvailable ||
              0;
        }
      } catch (_) {}
    } catch (_) {}
  };
}
if (typeof window.returnVehicleToBuilding !== "function") {
  window.returnVehicleToBuilding = function returnVehicleToBuilding(
    vehicle,
    building,
    { mission } = {}
  ) {
    if (!vehicle || !building) return Promise.resolve();
    try {
      if (typeof window.setVehicleStatus === "function")
        window.setVehicleStatus(vehicle, "ot", { mission, building });
      vehicle.retourEnCours = true;
    } catch (_) {}
    const startPoint =
      (vehicle.marker &&
        vehicle.marker.getLatLng &&
        vehicle.marker.getLatLng()) ||
      vehicle.lastKnownPosition;
    const target = building.latlng;
    return window.goVehicleTo({
      vehicle,
      start: startPoint,
      end: target,
      onArrival: () => {
        window.onVehicleArrivedAtBuilding &&
          window.onVehicleArrivedAtBuilding(vehicle, building);
      },
    });
  };
}
// ==== END refactor helpers ====
