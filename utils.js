// === utils.js ===
const SAVE_VERSION = 1; // Incrémente à chaque version incompatible

const PATIENT_STAY_DURATION = {
  light: 240000,
  moderate: 480000,
  critical: 960000,
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

const VEHICLE_MOVE_DELAY = 20;

const VEHICLE_SPEED_BY_TYPE = {
  /*VSAV: 20,
  FPT: 23,
  VSR: 22,
  EPA: 23,
  CDG: 18,
  PATROUILLE: 18,
  SMUR: 18*/
  VSAV: 1,
  FPT: 1,
  VSR: 1,
  EPA: 1,
  CDG: 1,
  PATROUILLE: 1,
  SMUR: 1,
};

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
  revealFullTypewriterText(); // 🔥 force l'affichage du texte complet
  document.getElementById("call-address").classList.remove("hidden");
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
