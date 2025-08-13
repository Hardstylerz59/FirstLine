let isLoadingPOIs = false;

let currentWeather = "soleil";
let currentCycle = "jour";

let lastTemperatureC = null;
// Compteur global des identifiants d'appels (persisté via save.js)
window.NEXT_CALL_ID = window.NEXT_CALL_ID ?? 0;

function startEnvironmentCycle() {
  // 1) Premier fetch au centre de la carte
  const c = map.getCenter();
  fetchAndApplyWeather(c.lat, c.lng, { force: true });

  // 2) Rafraîchit toutes les 10 min au centre de la carte
  setInterval(() => {
    const center = map.getCenter();
    fetchAndApplyWeather(center.lat, center.lng);
    scheduleAutoSave();
  }, 10 * 60 * 1000);
}

async function fetchAndApplyWeather(lat, lon, { force = false } = {}) {
  const key =
    typeof getWeatherTileKey === "function"
      ? getWeatherTileKey(lat, lon)
      : `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached =
    weatherCache && weatherCache.get ? weatherCache.get(key) : null;
  const now = Date.now();

  // Cache 8 minutes
  if (!force && cached && now - cached.t < 8 * 60 * 1000) {
    applyWeatherData(cached.data);
    return;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return;

  const json = await res.json().catch(() => null);
  if (!json || !json.current_weather) return;

  const cw = json.current_weather; // { temperature, windspeed, winddirection, weathercode, is_day, time }
  const data = {
    temp: cw.temperature,
    code: cw.weathercode,
    isDay: cw.is_day === 1,
  };

  if (weatherCache && weatherCache.set) weatherCache.set(key, { t: now, data });
  applyWeatherData(data);
}

function mapOpenMeteoCode(code) {
  if (code === 0) return "soleil"; // ciel clair
  if ([1, 2, 3].includes(code)) return "nuageux"; // peu à couvert
  if ([45, 48].includes(code)) return "brouillard";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "pluie";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "neige";
  if ([95, 96, 99].includes(code)) return "orageux";
  return "nuageux";
}

function applyWeatherData(d) {
  currentWeather = mapOpenMeteoCode(d.code);
  currentCycle = d.isDay ? "jour" : "nuit";
  lastTemperatureC = Math.round(d.temp);
  updateWeatherUI();
  updateCycleUI();
}

async function updateWeatherUI(cityOverride = null) {
  const iconMap = {
    soleil: "sun.png",
    pluie: "rain.png",
    orageux: "storm.png",
    neige: "snow.png",
    brouillard: "fog.png",
    nuageux: "cloud.png",
  };

  // Texte météo (sans température)
  const base = currentWeather
    ? currentWeather[0].toUpperCase() + currentWeather.slice(1)
    : "—";

  // Ville selon centre de la carte
  let cityStr = "";
  try {
    const c = map.getCenter();
    const city = cityOverride ?? (await getCityName(c.lat, c.lng));
    if (city) cityStr = ` · ${city}`;
    // Optionnel : mémoriser la dernière ville affichée si tu en tiens une globale ailleurs
    // _lastWeatherQuery.city = city; // si map.js est importé et variable visible
  } catch (_) {}

  const labelEl = document.getElementById("weather-label");
  if (labelEl) labelEl.textContent = base + cityStr;

  const iconEl = document.getElementById("weather-icon");
  if (iconEl)
    iconEl.src = `assets/weather/${iconMap[currentWeather] || "sun.png"}`;
}

// Cycle jour/nuit selon l’heure locale (ignorer les API)
function updateCycleUI() {
  const cycle = getClientCycleByLocalTime();
  currentCycle = cycle; // garder cohérent avec le reste du jeu

  const label = document.getElementById("cycle-label");
  if (label) label.textContent = cycle === "nuit" ? "Nuit" : "Jour";

  const icon = document.getElementById("cycle-icon");
  if (icon)
    icon.src = `assets/weather/${cycle === "nuit" ? "night.png" : "day.png"}`;
}

// Rafraîchir automatiquement le cycle toutes les minutes
setInterval(updateCycleUI, 60 * 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function preloadAllPOIs() {
  console.log("📍 Préchargement des POIs...");

  // 1) Premier passage : on remplit au max depuis la BDD (pas d'Overpass)
  const allPreloaded = buildings.every((b) => buildingPoisMap.has(b.id));
  if (!allPreloaded) {
    isLoadingPOIs = true;
    const loader = document.getElementById("loader-pois");
    loader?.classList.remove("hidden");

    for (const building of buildings) {
      await getOrFetchPOIsForBuilding(building);
      await sleep(120); // doux pour la BDD/UI
    }

    loader?.classList.add("hidden");
    isLoadingPOIs = false;
  }

  // 2) Si la BDD est vide (ou partiellement vide), on "répare" en rechargeant via Overpass
  const missing = buildings.filter((b) => !buildingPoisMap.has(b.id));
  if (missing.length > 0) {
    console.log(
      `🧭 Réparation POI: ${missing.length} bâtiment(s) sans POI -> Overpass + upsert`
    );

    isLoadingPOIs = true;
    const loader = document.getElementById("loader-pois");
    loader?.classList.remove("hidden");

    // Throttle Overpass pour rester gentil (5s radius large => 250–500ms mini)
    for (const building of missing) {
      await refillPOIsForBuildingIfEmpty(building);
      await sleep(400); // ajuste si besoin
    }

    loader?.classList.add("hidden");
    isLoadingPOIs = false;
  }

  // 3) Log final
  const totalCached = buildings.filter((b) => buildingPoisMap.has(b.id)).length;
  console.log(
    `✅ Préchargement terminé. POI en cache: ${totalCached}/${buildings.length}`
  );
}

// === Helpers progress kilométrage/position (globaux pour UI aussi) ===
if (typeof window.startVehicleProgress !== "function") {
  window.startVehicleProgress = function startVehicleProgress(
    vehicle,
    startPos
  ) {
    vehicle._kmPrev = startPos || vehicle.lastKnownPosition || null;
  };
}
if (typeof window.progressVehicle !== "function") {
  window.progressVehicle = function progressVehicle(vehicle, pos) {
    if (!vehicle || !pos) return;
    try {
      const prev = vehicle._kmPrev || pos;
      const distStep =
        typeof prev.distanceTo === "function"
          ? prev.distanceTo(pos)
          : window.map && typeof map.distance === "function"
          ? map.distance(prev, pos)
          : 0;
      vehicle.kilometrage = (vehicle.kilometrage || 0) + (distStep || 0);
      vehicle._kmPrev = pos;
      vehicle.lastKnownPosition = pos;
    } catch (_) {
      vehicle._kmPrev = pos;
      vehicle.lastKnownPosition = pos;
    }
  };
}

function getMsPerMeter(vehicle) {
  const base =
    (typeof VEHICLE_SPEED_BY_TYPE !== "undefined" &&
      VEHICLE_SPEED_BY_TYPE[vehicle?.type]) ||
    20; // ms par mètre de base
  const w =
    (typeof currentWeather !== "undefined" && currentWeather) || "soleil";
  const mult =
    (window.WEATHER_SPEED_MULTIPLIER && window.WEATHER_SPEED_MULTIPLIER[w]) ||
    1.0;
  return base * mult; // applique le ralentissement selon la météo
}

function computeTravelDurationMs(distanceMeters, msPerMeter) {
  return distanceMeters * msPerMeter;
}

function setVehicleArrivalFromDistance(vehicle, distanceMeters) {
  const msPerMeter = getMsPerMeter(vehicle);
  const duration = computeTravelDurationMs(distanceMeters, msPerMeter);
  vehicle.arrivalTime = Date.now() + duration;
  return { duration, msPerMeter };
}

if (typeof window.stopActiveRoute !== "function") {
  window.stopActiveRoute = function stopActiveRoute(vehicle) {
    if (!vehicle) return;
    const ra = vehicle.returnAnimation;
    if (typeof ra === "number") {
      cancelAnimationFrame(ra);
    } else if (ra && typeof ra.stop === "function") {
      try {
        ra.stop();
      } catch (_) {}
    }
    vehicle.returnAnimation = null;
    vehicle.retourEnCours = false;
  };
}

// Remplace ENTIEREMENT ta fonction par ceci
async function createMission() {
  if (missions.length >= buildings.length + 1 || buildings.length === 0) return;

  const origin = buildings[Math.floor(Math.random() * buildings.length)];
  const realType = ["cpi", "cs", "csp"].includes(origin.type)
    ? "caserne"
    : origin.type;

  const list = MISSION_TYPES[realType] || [];
  if (list.length === 0) return;

  const missionsEnriched = list.map((m) => enrichMissionBase(m, realType));
  const missionsEligible = missionsEnriched.filter(
    (m) => player.level >= m.minLevel
  );
  if (missionsEligible.length === 0) return;

  // Mission de base tirée au sort parmi les éligibles
  let selected =
    missionsEligible[Math.floor(Math.random() * missionsEligible.length)];

  // ---------- POI + MÉTÉO + VARIANTE ----------
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Variantes (sinon on traite la mission "base" comme une variante)
  const variantsPool =
    Array.isArray(selected.variants) && selected.variants.length
      ? [...selected.variants]
      : [
          {
            dialogue: selected.dialogue,
            label: selected.label,
            poiTags: selected.poiTags || [],
            victimCount: selected.victimCount || { min: 0, max: 0 },
            cycle: Array.isArray(selected.cycle)
              ? selected.cycle
              : selected.cycle
              ? [selected.cycle]
              : [],
            meteo: Array.isArray(selected.meteo)
              ? selected.meteo
              : selected.meteo
              ? [selected.meteo]
              : [],
            vehicles: selected.vehicles || [],
            _source: "base",
          },
        ];
  shuffle(variantsPool);

  // POI autour du bâtiment d’origine
  const poisAtOrigin = buildingPoisMap.get(origin.id) || [];

  // Recherche d'une combinaison Variante x POI qui matche météo/cycle au point exact
  let variant = null;
  let latlng = null;
  let localWeather = null;

  for (const v of variantsPool) {
    // Tags requis : priorité à la variante, sinon ceux de la mission
    const tags =
      Array.isArray(v.poiTags) && v.poiTags.length
        ? v.poiTags
        : selected.poiTags || [];

    let candidatePositions = [];
    if (tags.length) {
      const matchingPois = poisAtOrigin.filter((poi) =>
        tags.some((t) => poi.tags?.[t])
      );
      if (!matchingPois.length) {
        // Aucun POI compatible → on essaie la variante suivante
        continue;
      }
      shuffle(matchingPois);
      candidatePositions = matchingPois.map((p) => L.latLng(p.lat, p.lng));
    } else {
      // Pas de contrainte POI → autorise placement libre près de l’origine
      const lat = origin.latlng.lat + (Math.random() - 0.5) * 0.05;
      const lng = origin.latlng.lng + (Math.random() - 0.5) * 0.05;
      candidatePositions = [L.latLng(lat, lng)];
    }

    for (const pos of candidatePositions) {
      let lw = {
        weather: currentWeather,
        cycle: getClientCycleByLocalTime(),
      };
      try {
        lw = await getWeatherAt(pos.lat, pos.lng);
      } catch (err) {
        console.warn("⚠️ Erreur getWeatherAt:", err);
      }

      const meteoOk = !v.meteo?.length || v.meteo.includes(lw.weather);
      const cycleOk = !v.cycle?.length || v.cycle.includes(lw.cycle);

      if (meteoOk && cycleOk) {
        variant = v;
        latlng = pos;
        localWeather = lw;
        break;
      }
    }
    if (variant) break;
  }

  // Rien de compatible → on ne crée pas de mission « au milieu de nulle part »
  if (!variant || !latlng) {
    console.warn(
      "[Mission] Aucune variante/POI compatible avec la météo/cycle."
    );
    return;
  }

  // Logs debug (identiques à tes habitudes)
  console.log("%c[Mission] Spawn", "color:#0ff;font-weight:bold", {
    lat: latlng.lat,
    lng: latlng.lng,
  });
  console.log("%c[Mission] Météo utilisée", "color:#8f8;font-weight:bold", {
    weather: localWeather.weather,
    cycle: localWeather.cycle,
  });
  console.log(
    "%c[Mission] Variante retenue",
    "color:#6cf;font-weight:bold",
    variant
  );

  // Appliquer la variante SANS écraser par undefined
  selected = {
    ...selected,
    dialogue: variant.dialogue ?? selected.dialogue,
    label: variant.label ?? selected.label,
    poiTags: Array.isArray(variant.poiTags)
      ? variant.poiTags
      : selected.poiTags || [],
    victimCount: variant.victimCount ||
      selected.victimCount || { min: 0, max: 0 },
    vehicles:
      Array.isArray(variant.vehicles) && variant.vehicles.length
        ? variant.vehicles
        : selected.vehicles || [],
  };
  // ---------- FIN POI + MÉTÉO + VARIANTE ----------

  // Ré-enrichissement après affectation des véhicules corrects
  const enriched = enrichMissionBase(selected, realType);

  // Création de l’objet mission (inchangé)
  const mission = {
    id: String(window.NEXT_CALL_ID++),
    type: enriched.type,
    realLabel: enriched.label,
    realType: enriched.type,
    label: "📞 Appel en cours...",
    xp: enriched.xp,
    reward: enriched.reward,
    minLevel: enriched.minLevel,
    duration: enriched.duration,
    durationMs: enriched.durationMs,
    vehicles: enriched.vehicles || [],
    hasAskedAddress: false, // ← NEW
    labelUpdated: false, // si déjà présent, on le garde
    position: latlng,
    marker: null,
    active: false,
    dialogue: Array.isArray(enriched.dialogue)
      ? enriched.dialogue[Math.floor(Math.random() * enriched.dialogue.length)]
      : enriched.dialogue,
    solutionType: enriched.type,
    sourceType: realType,
    victims: generateVictims(enriched),
    startTime: Date.now(),
    variantUsed: variant,
    weatherAtSpawn: localWeather,
  };

  const li = document.createElement("li");
  li.classList.add("non-lancee");
  li.innerHTML = `
    <h3>${mission.label}</h3>
    <p>
      <span class="mission-status">Appel non traité</span>
      <span class="mission-timer">Depuis 00:00:00</span>
    </p>
    <button onclick="openCallModal('${mission.id}')">Traiter</button>
  `;
  mission.timerElement = li.querySelector(".mission-timer");
  mission.domElement = li;

  //missionList.appendChild(li);
  missions.push(mission);
  incCallStatsFor(mission);

  // MAJ UI live (panneau ouvert) + badge + clignotement du bouton
  notifyMissionsChanged();
  pulseCallsButton();
  updatePendingBadgeAndHistory?.();

  const icon = L.icon({
    iconUrl: "assets/icons/mission.png",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
  const marker = L.marker(latlng, { icon })
    .addTo(map)
    .bindPopup(
      () => mission.domElement?.cloneNode(true) || "<em>Pas d’info mission</em>"
    );
  mission.marker = marker;

  if (soundEnabled) {
    const sound = document.getElementById("mission-sound");
    if (sound) sound.play().catch(() => {});
  }
}

function finishMission(mission) {
  mission.marker?.remove();
  mission.domElement.remove();
  missions.splice(missions.indexOf(mission), 1);

  player.xp += mission.xp;
  player.money += mission.reward;
  updatePlayerInfo();

  const historyList = document.getElementById("history-list");
  const historyItem = document.createElement("li");
  historyItem.classList.add("history-entry"); // Pour style uniforme
  const bonusBadge = mission.firstDispatchedAt
    ? `<span class="bonus-chip">+ bonus</span>`
    : "";

  historyItem.innerHTML = `
  <span class="history-entry-label">${mission.label} réussie ${bonusBadge}</span>
  <span class="history-entry-reward">+${mission.xp} XP, +${mission.reward}€</span>
`;
  historyList.insertBefore(historyItem, historyList.firstChild); // Ajoute EN HAUT

  // Limite à 10 entrées
  while (historyList.children.length > 10) {
    historyList.removeChild(historyList.lastChild);
  }

  mission.dispatched.forEach((d) => {
    const vehicle = d.vehicle;
    const building = d.building;

    if (
      vehicle.type === "VSAV" &&
      (vehicle.status === "tr" || vehicle.status === "ch")
    ) {
      // On ne fait rien, ils termineront leur trajet normalement
      return;
    }

    setVehicleStatus(vehicle, "ot", { mission, building });
    vehicle.retourEnCours = true;

    const target = building.latlng;
    const currentPos = vehicle.marker?.getLatLng?.();
    const start =
      currentPos && !currentPos.equals(target)
        ? currentPos
        : vehicle.lastKnownPosition;

    function refreshAllRefs(originBuilding) {
      const mainBuilding = buildings.find((b) => b.id === originBuilding.id);
      if (mainBuilding) {
        mainBuilding.personnelAvailable = originBuilding.personnelAvailable;

        if (
          building.type === "cpi" ||
          building.type === "cs" ||
          building.type === "csp"
        ) {
          // Caserne à gestion pro/vol
          const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 };
          building.personnelAvailablePro =
            (building.personnelAvailablePro || 0) + (engaged.pro || 0);
          building.personnelAvailableVol =
            (building.personnelAvailableVol || 0) + (engaged.vol || 0);
          vehicle._engagedStaff = { pro: 0, vol: 0 };
        } else {
          // Autres bâtiments, système classique
          building.personnelAvailable =
            (building.personnelAvailable || 0) + (vehicle.required || 0);
        }

        updateVehicleStatus(vehicle, "dc");
        vehicle.status = "dc";
        logVehicleRadio(vehicle, "dc", { targetBuilding: building });
        applyVehicleWear(vehicle);
        refreshVehicleStatusForBuilding(mainBuilding);
        updateVehicleListDisplay(getSafeId(mainBuilding));
        refreshBuildingStatus(mainBuilding);

        // 🔁 [AJOUT] Mise à jour manuelle du DOM de la sidebar (cas SMUR / Police / autres)
        const safeId = getSafeId(mainBuilding);
        const spanTotal = document.getElementById(`staff-${safeId}`);
        const spanAvail = document.getElementById(`staff-avail-${safeId}`);
        if (spanTotal) spanTotal.textContent = mainBuilding.personnel || 0;
        if (spanAvail)
          spanAvail.textContent = mainBuilding.personnelAvailable || 0;

        if (
          document.getElementById("hospital-modal") &&
          !document
            .getElementById("hospital-modal")
            .classList.contains("hidden")
        ) {
          openHospitalModal(mainBuilding.id);
        }
      }
    }

    if (!start || start.equals(target)) {
      vehicle.retourEnCours = false;
      vehicle.lastKnownPosition = target;
      vehicle.ready = true;

      if (vehicle.type === "SMUR") {
        const originBuilding = vehicle.building || building;
        if (
          originBuilding &&
          typeof originBuilding.personnelAvailable === "number"
        ) {
          originBuilding.personnelAvailable += vehicle.required || 1;
          refreshAllRefs(originBuilding);
        }
      } else {
        if (
          building.type === "cpi" ||
          building.type === "cs" ||
          building.type === "csp"
        ) {
          // Caserne à gestion pro/vol
          const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
          building.personnelAvailablePro =
            (building.personnelAvailablePro || 0) + (engaged.pro || 0);
          building.personnelAvailableVol =
            (building.personnelAvailableVol || 0) + (engaged.vol || 0);
          vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
        } else {
          // Autres bâtiments, système classique
          building.personnelAvailable =
            (building.personnelAvailable || 0) + (vehicle.required || 0);
        }
        updateVehicleStatus(vehicle, "dc");
        logVehicleRadio(vehicle, "dc", { targetBuilding: building });
        applyVehicleWear(vehicle);
        refreshBuildingStatus(building);
        if (building) {
          refreshVehicleStatusForBuilding(building);
          updateVehicleListDisplay(getSafeId(building));
          refreshBuildingStatus(building);
        }
      }
      return;
    }

    fetchRouteCoords(start, target).then((coords) => {
      if (coords.length < 2) {
        vehicle.marker.setLatLng(target);
        vehicle.lastKnownPosition = target;
        vehicle.ready = true;

        if (vehicle.type === "SMUR") {
          const originBuilding = vehicle.building || building;
          if (
            originBuilding &&
            typeof originBuilding.personnelAvailable === "number"
          ) {
            originBuilding.personnelAvailable += vehicle.required || 1;
            refreshAllRefs(originBuilding);
          }
        } else {
          updateVehicleStatus(vehicle, "dc");
          logVehicleRadio(vehicle, "dc", { targetBuilding: building });
          applyVehicleWear(vehicle);
          refreshBuildingStatus(building);
          if (building) {
            refreshVehicleStatusForBuilding(building);
            updateVehicleListDisplay(getSafeId(building));
            refreshBuildingStatus(building);
          }
          if (
            building.type === "cpi" ||
            building.type === "cs" ||
            building.type === "csp"
          ) {
            // Caserne à gestion pro/vol
            const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
            building.personnelAvailablePro =
              (building.personnelAvailablePro || 0) + (engaged.pro || 0);
            building.personnelAvailableVol =
              (building.personnelAvailableVol || 0) + (engaged.vol || 0);
            vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
          } else {
            // Autres bâtiments, système classique
            building.personnelAvailable =
              (building.personnelAvailable || 0) + (vehicle.required || 0);
          }
        }
        return;
      }

      const speedFactor = getMsPerMeter(vehicle);

      startVehicleProgress(vehicle, coords[0]);

      {
        const speedMps = 1000 / speedFactor;

        vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
          coords,
          speedMps,
          marker: vehicle.marker,
          onProgress: ({ pos }) => {
            if (!pos) return;
            progressVehicle(vehicle, pos);
          },
          onDone: () => {
            vehicle.retourEnCours = false;
            vehicle.lastKnownPosition = target;
            vehicle.ready = true;

            if (vehicle.type === "SMUR") {
              const originBuilding = vehicle.building || building;
              if (
                originBuilding &&
                typeof originBuilding.personnelAvailable === "number"
              ) {
                originBuilding.personnelAvailable += vehicle.required || 1;
                refreshAllRefs(originBuilding);
              }
            } else {
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
              if (building) {
                refreshVehicleStatusForBuilding(building);
                updateVehicleListDisplay(getSafeId(building));
                refreshBuildingStatus(building);
              }
            }
            scheduleAutoSave();
          },
        });
      }
    });
  });

  scheduleAutoSave();
}

function updateMissionStateClass(mission, state) {
  const el = mission.domElement;
  if (!el) return;
  el.classList.remove("non-lancee", "attente", "transit", "en-cours");
  el.classList.add(state);
}

function startMissionProgress(mission) {
  if (mission.progressStarted) return;
  mission.progressStarted = true;
  updateMissionStateClass(mission, "en-cours");

  const progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");
  const timerLabel = document.createElement("div");
  timerLabel.classList.add("mission-timer");
  timerLabel.textContent = "";
  mission.domElement.appendChild(timerLabel);
  mission.domElement.appendChild(progressBar);

  const template = MISSION_TYPES[mission.sourceType]?.find(
    (m) => m.type === mission.realType
  );

  // Utilise la durée personnalisée si existante, sinon le template, sinon fallback
  const duration =
    typeof mission.durationMs === "number" && mission.durationMs >= 0
      ? mission.durationMs
      : typeof mission.duration === "number" && mission.duration >= 0
      ? mission.duration
      : typeof template?.duration === "number" && template.duration >= 0
      ? template.duration
      : 15000;

  const startTime = Date.now();

  mission.progressStarted = true;
  mission.startTime = Date.now();
  mission.durationMs = duration; // Toujours à jour
  const progressInterval = setInterval(() => {
    const percent = Math.min(100, ((Date.now() - startTime) / duration) * 100);
    progressBar.style.width = percent + "%";
    const timeLeft = Math.max(0, duration - (Date.now() - startTime));
    const seconds = Math.ceil(timeLeft / 1000);
    timerLabel.textContent = `⏱ ${seconds}s restantes`;

    if (percent >= 100) {
      clearInterval(progressInterval);
      timerLabel.remove();
      finishMission(mission);
    }
  }, 100);
}

function verifyMissionVehicles(mission) {
  if (!Array.isArray(mission.dispatched)) mission.dispatched = [];

  const template = MISSION_TYPES[mission.sourceType]?.find(
    (m) => m.type === mission.realType
  );
  if (!template) return;

  const requiredVehicles =
    template.vehicles?.length > 0
      ? template.vehicles
      : template.variants?.[0]?.vehicles || [];

  const requiredCounts = {};
  requiredVehicles.forEach((v) => {
    if (!v || !v.type) return;
    requiredCounts[v.type] = (requiredCounts[v.type] || 0) + v.nombre;
  });

  const arrivedCounts = {};
  mission.dispatched.forEach((d) => {
    const v = d.vehicle;
    if (["al", "tr", "ch"].includes(v.status)) {
      arrivedCounts[v.type] = (arrivedCounts[v.type] || 0) + 1;
    }
  });

  const atLeastOneArrived = Object.values(arrivedCounts).some((v) => v > 0);
  const hasEngaged = mission.dispatched.some(
    (d) => d.vehicle && d.vehicle.status === "er"
  );

  const missingVehicles = [];
  for (const type in requiredCounts) {
    const required = requiredCounts[type];
    const arrived = arrivedCounts[type] || 0;
    if (arrived < required) {
      missingVehicles.push(`${type} (${required - arrived} manquant)`);
    }
  }

  // Victimes
  let victimStatus = "";
  if (mission.victims && mission.victims.length > 0) {
    const treated = mission.victims.filter(
      (v) => v.beingTreated || v.treated || v.transported || v.leaveOnSite
    ).length;
    const total = mission.victims.length;
    victimStatus = `<div>👤 Victimes : ${treated}/${total}</div>`;
  }

  // Texte affiché dans la sidebar
  let stateText = "";
  if (atLeastOneArrived) {
    stateText += `<h4>📋 État des moyens engagés :</h4>`;
    stateText += Object.keys(requiredCounts)
      .map((type) => {
        const arrived = arrivedCounts[type] || 0;
        const required = requiredCounts[type];
        return arrived >= required
          ? `✅ <strong>${type}</strong> : ${arrived}/${required}`
          : `❌ <strong>${type}</strong> : ${arrived}/${required}`;
      })
      .join("<br>");
  }

  if (missingVehicles.length > 0) {
    stateText += `<br><span style="color:red">🛑 En attente : ${missingVehicles.join(
      ", "
    )}</span>`;
  }

  if (victimStatus && atLeastOneArrived) {
    stateText += `<br>${victimStatus}`;
  }

  const p = mission.domElement.querySelector("p");
  if (stateText) {
    p.innerHTML = stateText;
    p.style.display = "";
  } else {
    p.innerHTML = "";
    p.style.display = "none";
  }

  const allVehiclesOk = missingVehicles.length === 0;
  const allVictimsReady =
    !mission.victims ||
    mission.victims.length === 0 ||
    mission.victims.every(
      (v) => v.leaveOnSite || v.transported || v.inTransport
    );

  if (allVehiclesOk) {
    if (allVictimsReady) {
      updateMissionStateClass(mission, "en-cours");
      mission.awaitingProgress = false;
      if (!mission.progressStarted) {
        mission.durationMs = Math.max(mission.durationMs || 0, 10000); // 10s par défaut
        startMissionProgress(mission);
      }
    } else {
      updateMissionStateClass(mission, "attente");
      mission.awaitingProgress = true;
    }
  } else if (hasEngaged) {
    updateMissionStateClass(mission, "transit");
  } else if (atLeastOneArrived) {
    updateMissionStateClass(mission, "attente");
  } else {
    updateMissionStateClass(mission, "non-lancee");
  }

  updateMissionButton(mission);
}

function checkMissionArrival(mission) {
  if (mission.labelUpdated) return;

  const arrivedVehicles = mission.dispatched.filter(
    (d) => d.vehicle.status === "al"
  );
  if (arrivedVehicles.length === 0) return;

  const template = MISSION_TYPES[mission.sourceType].find(
    (m) => m.type === mission.realType
  );
  if (!template) return;

  mission.label = mission.realLabel; // <-- utilise le vrai label
  mission.domElement.querySelector("h3").textContent = mission.label;
  mission.labelUpdated = true;

  verifyMissionVehicles(mission, template.vehicles);
}

function dispatchReinforcementsToMission(mission, vehiclesList) {
  if (!mission) return;
  if (!Array.isArray(mission.dispatched)) mission.dispatched = [];

  const dispatched = [];
  const engagedBuildings = new Set();

  vehiclesList.forEach((v) => {
    const vehicle = v.vehicle;
    const building = v.building;
    const personnelNeeded = v.personnel;

    if (!vehicle || (vehicle.status !== "dc" && vehicle.status !== "ot"))
      return;
    if (vehicle.usure >= 100 || vehicle.status === "hs") {
      alert(
        "Ce véhicule est hors service et doit être réparé avant de repartir !"
      );
      return;
    }

    engagedBuildings.add(building);
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // On récupère les parts pro/vol à engager
      let engagedStaff = v.engagedStaff ||
        vehicle._engagedStaff || { pro: 0, vol: 0 };
      building.personnelAvailablePro =
        (building.personnelAvailablePro ?? building.personnelPro) -
        (engagedStaff.pro || 0);
      building.personnelAvailableVol =
        (building.personnelAvailableVol ?? building.personnelVol) -
        (engagedStaff.vol || 0);
      // Pour chaque véhicule engagé, on note ce qui a été pris pour le retour
      vehicle._engagedStaff = {
        pro: engagedStaff.pro || 0,
        vol: engagedStaff.vol || 0,
      };
    } else {
      building.personnelAvailable -= personnelNeeded;
    }

    refreshVehicleStatusForBuilding(building);
    updateVehicleListDisplay(getSafeId(building));
    refreshBuildingStatus(building);

    if (vehicle.status === "ot" && vehicle.retourEnCours) {
      stopActiveRoute(vehicle);
      vehicle.returnAnimation = null;
      vehicle.retourEnCours = false;
    }

    const existing = mission.dispatched.find(
      (d) => d.vehicle && d.vehicle.id === vehicle.id
    );

    if (existing) {
      existing.canceled = false;
    } else {
      mission.dispatched.push({ vehicle, building });
    }

    vehicle.ready = false;

    let delay = PERSONNEL_DISPATCH_DELAY.pro;
    let equipageType = "pro";

    // Si police ou hopital, pas de délai
    if (building.type === "police" || building.type === "hopital") {
      delay = 0;
    } else if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      const engaged = v.engagedStaff ||
        vehicle._engagedStaff || { pro: 0, vol: 0 };
      if ((engaged.vol || 0) > 0) {
        // dès qu'il y a des volontaires, délai volontaire
        delay = PERSONNEL_DISPATCH_DELAY.vol;
        equipageType = "vol";
      }
    }

    function launchVehicleAnimation() {
      const icon = L.icon({
        iconUrl: `assets/icons/${vehicle.type.toLowerCase()}.png`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const startPoint = vehicle.lastKnownPosition || building.latlng;

      if (!vehicle.marker) {
        vehicle.marker = L.marker(startPoint, { icon })
          .addTo(map)
          .bindTooltip(vehicle.label, { permanent: false, direction: "top" });
      } else {
        vehicle.marker.setLatLng(startPoint);
        vehicle.marker.setIcon(icon);
        vehicle.marker.bindTooltip(vehicle.label, {
          permanent: false,
          direction: "top",
        });
      }

      fetchRouteCoords(startPoint, mission.position).then((coords) => {
        if (coords.length < 2) {
          vehicle.marker.setLatLng(mission.position);
          setVehicleStatus(vehicle, "al", { mission, building });
          vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
          checkMissionArrival(mission);
          verifyMissionVehicles(mission);
          if (vehicle.type === "VSAV") {
            assignVSAVsToVictims(mission);
          }
          if (vehicle.type === "SMUR" && vehicle.status === "al") {
            retryCriticalVictimTreatment(mission);
          }
          return;
        }

        const { totalRouteDistance } = RouteMath.computeRouteProfile(coords);

        const { msPerMeter: speedFactor } = setVehicleArrivalFromDistance(
          vehicle,
          totalRouteDistance
        );
        startVehicleProgress(vehicle, coords[0]);

        // --- Remplacement RAF → RouteAnimator ---
        const speedMps = 1000 / speedFactor;

        vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
          coords,
          speedMps,
          marker: vehicle.marker,
          onProgress: ({ pos }) => {
            if (!pos) return;
            progressVehicle(vehicle, pos);
          },
          onDone: () => {
            setVehicleStatus(vehicle, "al", { mission, building });
            vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
            checkMissionArrival(mission);
            verifyMissionVehicles(mission);
            if (vehicle.type === "VSAV") {
              assignVSAVsToVictims(mission);
            }
            if (vehicle.type === "SMUR" && vehicle.status === "al") {
              retryCriticalVictimTreatment(mission);
            }
          },
        });
        // --- Fin remplacement ---
      });
    }

    // Si déjà OT, pas de délai : départ immédiat (statut er)
    if (vehicle.status === "ot") {
      setVehicleStatus(vehicle, "er", { mission, building });
      scheduleAutoSave();

      launchVehicleAnimation();
    } else {
      // Sinon, attente de délai (statut at)
      setVehicleStatus(vehicle, "at", { mission, building });
      scheduleAutoSave();

      setTimeout(() => {
        setVehicleStatus(vehicle, "er", { mission, building });
        scheduleAutoSave();

        launchVehicleAnimation();
      }, delay);
    }

    dispatched.push({
      vehicle,
      building,
      personnel: personnelNeeded,
      start: Date.now(),
    });
  });

  engagedBuildings.forEach(refreshBuildingStatus);

  mission.active = true;
  updateMissionStateClass(mission, "transit");

  if (mission.address) {
    const p = mission.domElement.querySelector("p");
    if (p) p.textContent = mission.address;
  }

  if (mission.domElement) {
    mission.domElement.querySelector("button").onclick = () =>
      openManageMission(mission.id);
  }
}

function dispatchMission(missionId) {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) return;
  if (!Array.isArray(mission.dispatched)) mission.dispatched = [];

  const engagedIds = new Set(
    mission.vehicles
      .filter((v) => v && v.vehicle && v.vehicle.id)
      .map((v) => v.vehicle.id)
  );

  mission.dispatched = mission.dispatched.filter(
    (d) => d.vehicle && engagedIds.has(d.vehicle.id)
  );

  const dispatched = [];
  const engagedBuildings = new Set();

  mission.vehicles.forEach((v) => {
    const vehicle = v.vehicle;
    const building = v.building;
    const personnelNeeded = v.personnel;

    if (!vehicle || (vehicle.status !== "dc" && vehicle.status !== "ot"))
      return;
    if (vehicle.usure >= 100 || vehicle.status === "hs") {
      alert(
        "Ce véhicule est hors service et doit être réparé avant de repartir !"
      );
      return;
    }

    if (!mission.firstDispatchedAt) {
      GameUtils.applyEarlyResponseBonus(mission);
    }

    engagedBuildings.add(building);
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // On récupère les parts pro/vol à engager
      let engagedStaff = v.engagedStaff ||
        vehicle._engagedStaff || { pro: 0, vol: 0 };
      building.personnelAvailablePro =
        (building.personnelAvailablePro ?? building.personnelPro) -
        (engagedStaff.pro || 0);
      building.personnelAvailableVol =
        (building.personnelAvailableVol ?? building.personnelVol) -
        (engagedStaff.vol || 0);
      // Pour chaque véhicule engagé, on note ce qui a été pris pour le retour
      vehicle._engagedStaff = {
        pro: engagedStaff.pro || 0,
        vol: engagedStaff.vol || 0,
      };
    } else {
      building.personnelAvailable -= personnelNeeded;
    }
    refreshVehicleStatusForBuilding(building);
    updateVehicleListDisplay(getSafeId(building));
    refreshBuildingStatus(building);

    if (vehicle.status === "ot" && vehicle.retourEnCours) {
      stopActiveRoute(vehicle);
      vehicle.returnAnimation = null;
      vehicle.retourEnCours = false;
    }

    const existing = mission.dispatched.find(
      (d) => d.vehicle && d.vehicle.id === vehicle.id
    );
    if (existing) {
      existing.canceled = false; // ✅ On le réactive s'il a été annulé avant
    } else {
      mission.dispatched.push({ vehicle, building });
    }

    vehicle.ready = false;

    // === DÉLAI DE DÉPART SELON TYPE PERSONNEL ===
    let delay = PERSONNEL_DISPATCH_DELAY.pro;
    let equipageType = "pro";

    // Si police ou hopital, pas de délai
    if (building.type === "police" || building.type === "hopital") {
      delay = 0;
    } else if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      const engaged = v.engagedStaff ||
        vehicle._engagedStaff || { pro: 0, vol: 0 };
      if ((engaged.vol || 0) > 0) {
        // dès qu'il y a des volontaires, délai volontaire
        delay = PERSONNEL_DISPATCH_DELAY.vol;
        equipageType = "vol";
      }
    }

    function launchVehicleAnimation() {
      const icon = L.icon({
        iconUrl: `assets/icons/${vehicle.type.toLowerCase()}.png`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const startPoint = vehicle.lastKnownPosition || building.latlng;

      if (!vehicle.marker) {
        vehicle.marker = L.marker(startPoint, { icon })
          .addTo(map)
          .bindTooltip(vehicle.label, { permanent: false, direction: "top" });
      } else {
        vehicle.marker.setLatLng(startPoint);
        vehicle.marker.setIcon(icon);
        vehicle.marker.bindTooltip(vehicle.label, {
          permanent: false,
          direction: "top",
        });
      }

      fetchRouteCoords(startPoint, mission.position).then((coords) => {
        if (coords.length < 2) {
          vehicle.marker.setLatLng(mission.position);
          vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
          setVehicleStatus(vehicle, "al", { mission, building });
          checkMissionArrival(mission);
          verifyMissionVehicles(mission);
          if (vehicle.type === "VSAV") {
            assignVSAVsToVictims(mission);
          }
          if (vehicle.type === "SMUR" && vehicle.status === "al") {
            retryCriticalVictimTreatment(mission);
          }
          return;
        }

        // Animation
        const { totalRouteDistance } = RouteMath.computeRouteProfile(coords);
        const { msPerMeter: speedFactor } = setVehicleArrivalFromDistance(
          vehicle,
          totalRouteDistance
        );
        startVehicleProgress(vehicle, coords[0]);

        // --- Remplacement RAF → RouteAnimator ---
        const speedMps = 1000 / speedFactor;

        vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
          coords,
          speedMps,
          marker: vehicle.marker,
          onProgress: ({ pos }) => {
            if (!pos) return;
            progressVehicle(vehicle, pos);
          },
          onDone: () => {
            setVehicleStatus(vehicle, "al", { mission, building });
            vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
            checkMissionArrival(mission);
            verifyMissionVehicles(mission);
            if (vehicle.type === "VSAV") {
              assignVSAVsToVictims(mission);
            }
            if (vehicle.type === "SMUR" && vehicle.status === "al") {
              retryCriticalVictimTreatment(mission);
            }
          },
        });
        // --- Fin remplacement ---
      });
    }

    // Si déjà OT, pas de délai : départ immédiat (statut er)
    if (vehicle.status === "ot") {
      setVehicleStatus(vehicle, "er", { mission, building });
      scheduleAutoSave();

      launchVehicleAnimation();
    } else {
      // Sinon, attente de délai (statut at)
      setVehicleStatus(vehicle, "at", { mission, building });
      scheduleAutoSave();

      setTimeout(() => {
        setVehicleStatus(vehicle, "er", { mission, building });
        scheduleAutoSave();

        launchVehicleAnimation();
      }, delay);
    }

    dispatched.push({
      vehicle,
      building,
      personnel: personnelNeeded,
      start: Date.now(),
    });
  });

  engagedBuildings.forEach(refreshBuildingStatus);

  mission.active = true;
  updateMissionStateClass(mission, "transit");

  if (mission.address) {
    const p = mission.domElement.querySelector("p");
    if (p) p.textContent = mission.address;
  }

  if (mission.domElement) {
    mission.domElement.querySelector("button").onclick = () =>
      openManageMission(mission.id);
  }
}

function resumeMissionProgress(mission) {
  const now = Date.now();
  const elapsed = now - mission.startTime;

  const template = MISSION_TYPES[mission.sourceType]?.find(
    (m) => m.type === mission.realType
  );

  // Utilise la durée personnalisée si existante, sinon le template, sinon fallback
  const duration =
    typeof mission.durationMs === "number"
      ? mission.durationMs
      : typeof mission.duration === "number"
      ? mission.duration
      : typeof template?.duration === "number"
      ? template.duration
      : 15000;

  const progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");

  const timerLabel = document.createElement("div");
  timerLabel.classList.add("mission-timer");
  timerLabel.textContent = "";

  mission.domElement.appendChild(timerLabel);
  mission.domElement.appendChild(progressBar);

  updateMissionStateClass(mission, "en-cours");

  const resumeStart = Date.now();

  mission.durationMs = duration; // Toujours à jour

  const progressInterval = setInterval(() => {
    const currentElapsed = Date.now() - resumeStart + elapsed;
    const percent = Math.min(100, (currentElapsed / duration) * 100);
    const secondsLeft = Math.ceil((duration - currentElapsed) / 1000);

    progressBar.style.width = percent + "%";
    timerLabel.textContent = `⏱ ${secondsLeft}s restantes`;

    if (percent >= 100) {
      clearInterval(progressInterval);
      timerLabel.remove();
      finishMission(mission);
    }
  }, 100);
}

function dispatchVehicleToMission(vehicle, mission, building) {
  if (!building) {
    building = buildings.find((b) => b.vehicles.includes(vehicle));
  }
  const start = vehicle.lastKnownPosition;
  const end = mission.position;

  const icon = L.icon({
    iconUrl: `assets/icons/${vehicle.type.toLowerCase()}.png`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  if (!vehicle.marker) {
    vehicle.marker = L.marker(start, { icon })
      .addTo(map)
      .bindTooltip(vehicle.label, { permanent: false, direction: "top" });
  } else {
    vehicle.marker.setLatLng(start);
    vehicle.marker.setIcon(icon);
    vehicle.marker.bindTooltip(vehicle.label, {
      permanent: false,
      direction: "top",
    });
  }

  fetchRouteCoords(start, end).then((coords) => {
    if (coords.length < 2) {
      vehicle.marker.setLatLng(end);
      setVehicleStatus(vehicle, "al", { mission, building });
      vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
      checkMissionArrival(mission);
      verifyMissionVehicles(mission);
      return;
    }

    const { totalRouteDistance } = RouteMath.computeRouteProfile(coords);

    const { msPerMeter: speedFactor } = setVehicleArrivalFromDistance(
      vehicle,
      totalRouteDistance
    );

    startVehicleProgress(vehicle, coords[0]);

    // --- Remplacement RAF → RouteAnimator ---
    const speedMps = 1000 / speedFactor;

    vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
      coords,
      speedMps,
      marker: vehicle.marker,
      onProgress: ({ pos }) => {
        if (!pos) return;
        progressVehicle(vehicle, pos);
      },
      onDone: () => {
        vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
        setVehicleStatus(vehicle, "al", { mission, building });
        checkMissionArrival(mission);
        verifyMissionVehicles(mission);
      },
    });
    // --- Fin remplacement ---
  });
  notifyMissionsChanged();
}

function returnVehicleToCaserne(vehicle, building) {
  const start = vehicle.lastKnownPosition || building.latlng;
  const end = building.latlng;

  setVehicleStatus(vehicle, "ot", { building });

  vehicle.retourEnCours = true;

  const icon = L.icon({
    iconUrl: `assets/icons/${vehicle.type.toLowerCase()}.png`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  if (!vehicle.marker) {
    vehicle.marker = L.marker(start, { icon })
      .addTo(map)
      .bindTooltip(vehicle.label, { permanent: false, direction: "top" });
  }

  fetchRouteCoords(start, end).then((coords) => {
    if (coords.length < 2) {
      if (
        building.type === "cpi" ||
        building.type === "cs" ||
        building.type === "csp"
      ) {
        // Caserne à gestion pro/vol
        const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
        building.personnelAvailablePro =
          (building.personnelAvailablePro || 0) + (engaged.pro || 0);
        building.personnelAvailableVol =
          (building.personnelAvailableVol || 0) + (engaged.vol || 0);
        vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
      } else {
        // Autres bâtiments, système classique
        building.personnelAvailable =
          (building.personnelAvailable || 0) + (vehicle.required || 0);
      }
      vehicle.lastKnownPosition = end;
      vehicle.status = "dc";
      updateVehicleStatus(vehicle, "dc");
      logVehicleRadio(vehicle, "dc", { targetBuilding: building });
      vehicle.ready = true;
      vehicle.retourEnCours = false;
      applyVehicleWear(vehicle);
      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));

      refreshBuildingStatus(building);
      scheduleAutoSave();
      return;
    }

    const speedFactor = getMsPerMeter(vehicle);
    startVehicleProgress(vehicle, coords[0]);

    {
      const speedMps = 1000 / speedFactor;

      vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
        coords,
        speedMps,
        marker: vehicle.marker,
        onProgress: ({ pos }) => {
          if (!pos) return;
          progressVehicle(vehicle, pos);
        },
        onDone: () => {
          vehicle.retourEnCours = false;
          vehicle.lastKnownPosition = end;
          vehicle.ready = true;

          if (vehicle.type === "SMUR") {
            const originBuilding = vehicle.building || building;
            if (
              originBuilding &&
              typeof originBuilding.personnelAvailable === "number"
            ) {
              originBuilding.personnelAvailable += vehicle.required || 1;
            }
            if (building) {
              refreshVehicleStatusForBuilding(building);
              updateVehicleListDisplay(getSafeId(building));
              refreshBuildingStatus(building);
            }
          } else {
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
            if (building) {
              refreshVehicleStatusForBuilding(building);
              updateVehicleListDisplay(getSafeId(building));
              refreshBuildingStatus(building);
            }
          }
          scheduleAutoSave();
        },
      });
    }
  });
}

function sendPatientToHospital(vehicle, mission, victim, hospitalOverride) {
  const hospital = hospitalOverride || getAvailableHospital();
  // Sécurise le champ reservedPatients
  if (!hospital.reservedPatients) hospital.reservedPatients = [];
  // Sécurise le bâtiment d'origine du VSAV
  if (!vehicle.building) {
    vehicle.building = buildings.find((b) => b.vehicles.includes(vehicle));
  }
  const building = vehicle.building;

  // BLOQUER SI PAS DE PLACE (patients + réservés >= capacité)
  const totalOccupancy =
    (hospital.patients?.length || 0) + (hospital.reservedPatients?.length || 0);
  if (totalOccupancy >= hospital.capacity) {
    alert("Pas de place disponible à l'hôpital !");
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // Caserne à gestion pro/vol
      const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
      building.personnelAvailablePro =
        (building.personnelAvailablePro || 0) + (engaged.pro || 0);
      building.personnelAvailableVol =
        (building.personnelAvailableVol || 0) + (engaged.vol || 0);
      vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
    } else {
      // Autres bâtiments, système classique
      building.personnelAvailable =
        (building.personnelAvailable || 0) + (vehicle.required || 0);
    }
    vehicle.ready = true;
    vehicle.status = "dc";
    updateVehicleStatus(vehicle, "dc");
    logVehicleRadio(vehicle, "dc", { targetBuilding: building });
    applyVehicleWear(vehicle);
    if (building) {
      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));
      refreshBuildingStatus(building);
    }

    return;
  }

  const start = vehicle.marker?.getLatLng?.();
  const target = hospital.latlng;

  fetchRouteCoords(start, target)
    .then((coords) => {
      if (coords.length < 2) {
        vehicle.marker.setLatLng(target);
        finishPatientTransfer(vehicle, hospital, mission, victim);
        return;
      }
      vehicle.status = "tr";
      vehicle.transporting = true;
      victim.inTransport = true;
      // RESERVE LA PLACE ICI
      hospital.reservedPatients.push({
        id: victim.id,
        missionId: mission.id,
        severity: victim.severity,
        name: victim.name,
      });
      refreshBuildingStatus(hospital);

      updateVehicleStatus(vehicle, "tr");
      logVehicleRadio(vehicle, "tr", { targetBuilding: hospital });
      verifyMissionVehicles(mission);
      if (building) {
        refreshVehicleStatusForBuilding(building);
        updateVehicleListDisplay(getSafeId(building));
        refreshBuildingStatus(building);
      }

      animateVehicleAlongRoute(vehicle, coords, () => {
        updateVehicleStatus(vehicle, "ch");

        logVehicleRadio(vehicle, "ch", { targetBuilding: hospital });
        refreshVehicleStatusForBuilding(building);
        updateVehicleListDisplay(getSafeId(building));
        refreshBuildingStatus(building);

        if (vehicle.marker && map.hasLayer(vehicle.marker)) {
          map.removeLayer(vehicle.marker);
          vehicle.markerVisible = false;
        }

        setTimeout(() => {
          // ENLÈVE DES RÉSERVÉS AVANT ADMISSION
          const reservedIdx = hospital.reservedPatients.findIndex(
            (p) => p.id === victim.id
          );
          if (reservedIdx !== -1)
            hospital.reservedPatients.splice(reservedIdx, 1);

          admitPatient(hospital, {
            id: victim.id,
            name: victim.name,
            missionId: mission.id,
            severity: victim.severity,
          });

          victim.transported = true;
          victim.inTransport = false;
          victim.beingTreated = false;
          vehicle.transporting = false;
          vehicle.assignedVictim = null;

          updateMissionVictimsUI(mission);
          verifyMissionVehicles(mission);

          if (building) {
            refreshVehicleStatusForBuilding(building);
            updateVehicleListDisplay(getSafeId(building));
          }

          returnFromHospital(vehicle, building);
        }, getUnloadingDelay());
      });
    })
    .catch((err) => {
      console.warn("🚑 Erreur de trajet vers hôpital :", err);
      if (
        building.type === "cpi" ||
        building.type === "cs" ||
        building.type === "csp"
      ) {
        // Caserne à gestion pro/vol
        const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
        building.personnelAvailablePro =
          (building.personnelAvailablePro || 0) + (engaged.pro || 0);
        building.personnelAvailableVol =
          (building.personnelAvailableVol || 0) + (engaged.vol || 0);
        vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
      } else {
        // Autres bâtiments, système classique
        building.personnelAvailable =
          (building.personnelAvailable || 0) + (vehicle.required || 0);
      }
      vehicle.ready = true;
      updateVehicleStatus(vehicle, "dc");
      logVehicleRadio(vehicle, "dc", { targetBuilding: building });
      vehicle.status = "dc";
      applyVehicleWear(vehicle);
      if (building) {
        refreshVehicleStatusForBuilding(building);
        updateVehicleListDisplay(getSafeId(building));
        refreshBuildingStatus(building);
      }
    });
}

function returnFromHospital(vehicle, building) {
  const start = vehicle.marker?.getLatLng?.();
  const target = building.latlng;

  setVehicleStatus(vehicle, "ot", { building });
  vehicle.retourEnCours = true;

  if (!start || start.equals(target)) {
    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      // Caserne à gestion pro/vol
      const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
      building.personnelAvailablePro =
        (building.personnelAvailablePro || 0) + (engaged.pro || 0);
      building.personnelAvailableVol =
        (building.personnelAvailableVol || 0) + (engaged.vol || 0);
      vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
    } else {
      // Autres bâtiments, système classique
      building.personnelAvailable =
        (building.personnelAvailable || 0) + (vehicle.required || 0);
    }
    vehicle.retourEnCours = false;
    vehicle.lastKnownPosition = target;
    vehicle.ready = true;
    vehicle.status = "dc";
    updateVehicleStatus(vehicle, "dc");
    refreshBuildingStatus(building);
    logVehicleRadio(vehicle, "dc", { targetBuilding: building });
    applyVehicleWear(vehicle);

    refreshVehicleStatusForBuilding(building);
    updateVehicleListDisplay(getSafeId(building));
    refreshBuildingStatus(building);
    return;
  }

  fetchRouteCoords(start, target).then((coords) => {
    if (coords.length < 2) {
      if (
        building.type === "cpi" ||
        building.type === "cs" ||
        building.type === "csp"
      ) {
        // Caserne à gestion pro/vol
        const engaged = vehicle._engagedStaff || { pro: 0, vol: 0 }; // Stocké à l'envoi (à faire si pas fait)
        building.personnelAvailablePro =
          (building.personnelAvailablePro || 0) + (engaged.pro || 0);
        building.personnelAvailableVol =
          (building.personnelAvailableVol || 0) + (engaged.vol || 0);
        vehicle._engagedStaff = { pro: 0, vol: 0 }; // Reset après restitution
      } else {
        // Autres bâtiments, système classique
        building.personnelAvailable =
          (building.personnelAvailable || 0) + (vehicle.required || 0);
      }
      vehicle.marker.setLatLng(target);
      vehicle.lastKnownPosition = target;
      vehicle.ready = true;
      updateVehicleStatus(vehicle, "dc");
      vehicle.status = "dc";
      logVehicleRadio(vehicle, "dc", { targetBuilding: building });
      applyVehicleWear(vehicle);

      refreshVehicleStatusForBuilding(building);
      updateVehicleListDisplay(getSafeId(building));
      refreshBuildingStatus(building);
      return;
    }

    // Réaffiche le marqueur s’il était masqué
    if (vehicle.marker && !map.hasLayer(vehicle.marker)) {
      vehicle.marker.addTo(map);
      vehicle.markerVisible = true;
    }
    startVehicleProgress(vehicle, coords[0]);

    {
      const speedFactor = getMsPerMeter(vehicle);
      const speedMps = 1000 / speedFactor;

      // Réaffiche le marqueur s’il était masqué
      if (vehicle.marker && !map.hasLayer(vehicle.marker)) {
        vehicle.marker.addTo(map);
        vehicle.markerVisible = true;
      }

      vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
        coords,
        speedMps,
        marker: vehicle.marker,
        onProgress: ({ pos }) => {
          if (!pos) return;
          progressVehicle(vehicle, pos);
        },
        onDone: () => {
          vehicle.retourEnCours = false;
          vehicle.status = "dc";
          applyVehicleWear(vehicle);

          refreshBuildingStatus(building);
          refreshVehicleStatusForBuilding(building);
          updateVehicleListDisplay(getSafeId(building));
          scheduleAutoSave();
        },
      });
    }
  });
}

function animateVehicleAlongRoute(vehicle, coords, callback) {
  const speedFactor = getMsPerMeter(vehicle);
  const speedMps = 1000 / speedFactor;
  startVehicleProgress(vehicle, coords[0]);

  vehicle.returnAnimation = RouteAnimator.animateAlongRoute({
    coords,
    speedMps,
    marker: vehicle.marker,
    onProgress: ({ pos }) => {
      if (!pos) return;
      progressVehicle(vehicle, pos);
    },
    onDone: () => {
      vehicle.lastKnownPosition = coords[coords.length - 1];
      if (vehicle.marker) vehicle.marker.setLatLng(vehicle.lastKnownPosition);
      callback?.();
    },
  });
}

function generateVictims(template) {
  function createVictim(overrides = {}) {
    return Object.assign(
      {
        id: `victim-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: getRandomName(),
        severity: randomSeverity(),
        leaveOnSite: false,
        treated: false,
        beingTreated: false,
        transported: false,
        assignedVSAV: null,
        progress: 0,
        waitingForSMUR: false,
      },
      overrides
    );
  }

  // Si victimCount défini → génère N victimes, sinon zéro
  if (template.victimCount) {
    const n = randInt(template.victimCount.min, template.victimCount.max);
    return Array.from({ length: n }, () => createVictim());
  }

  return [];
}

// Génère un état de gravité aléatoire pondéré
function randomSeverity() {
  const severities = ["light", "moderate", "critical"];
  const weights = [0.6, 0.3, 0.1]; // 60% léger, 30% grave, 10% critique
  const r = Math.random();
  if (r < weights[0]) return "light";
  if (r < weights[0] + weights[1]) return "moderate";
  return "critical";
}

// Entier aléatoire [min, max]
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function assignVSAVsToVictims(mission) {
  // 🔥 Correction : on débloque la prochaine critique si plus aucun traitement en cours
  (mission.victims || []).forEach((v) => {
    if (
      v.severity === "critical" &&
      v.waitingForSMUR &&
      !isSMUROccupied(mission)
    ) {
      v.waitingForSMUR = false;
    }
  });

  const availableVSAVs = (mission.dispatched || [])
    .filter(
      (d) =>
        d.vehicle.type === "VSAV" &&
        d.vehicle.status === "al" &&
        !d.vehicle.assignedVictim &&
        !d.vehicle.transporting
    )
    .map((d) => d.vehicle);

  const criticalVictimInProgress = (mission.victims || []).some(
    (v) =>
      v.severity === "critical" &&
      (v.beingTreated || v.waitingForSMUR) &&
      !v.treated &&
      !v.transported
  );
  let victimsToAssign;

  if (criticalVictimInProgress) {
    victimsToAssign = [];
  } else {
    victimsToAssign = (mission.victims || [])
      .filter(
        (v) =>
          !v.treated && !v.beingTreated && !v.transported && !v.waitingForSMUR
      )
      .sort((a, b) => {
        const severityOrder = { critical: 0, moderate: 1, light: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  for (
    let i = 0;
    i < availableVSAVs.length && i < victimsToAssign.length;
    i++
  ) {
    const vsav = availableVSAVs[i];
    const victim = victimsToAssign[i];
    startVictimTreatment(mission, victim, vsav);
  }
}

function isSMUROccupied(mission) {
  // Une victime critique en cours de traitement nécessite le SMUR
  return (mission.victims || []).some(
    (v) => v.severity === "critical" && v.beingTreated && !v.treated
  );
}

function getSMUROnScene(mission) {
  return (mission.dispatched || []).some(
    (d) => d.vehicle.type === "SMUR" && d.vehicle.status === "al"
  );
}

function startVictimTreatment(mission, victim, vsav) {
  const modal = document.getElementById("manage-modal");
  // On définit une fonction safe pour l'UI
  function safeUpdateVictimsUI() {
    if (!modal || modal.classList.contains("hidden")) return;
    if (String(modal.dataset.missionId) !== String(mission.id)) return;
    updateMissionVictimsUI(mission);
  }

  if (victim.severity === "critical") {
    // Pas de SMUR sur place OU déjà occupé => attente !
    if (!getSMUROnScene(mission) || isSMUROccupied(mission)) {
      victim.progress = 0;
      victim.waitingForSMUR = true;
      victim.beingTreated = false;
      if (vsav) vsav.assignedVictim = null;
      safeUpdateVictimsUI();
      return;
    }
  }

  victim.waitingForSMUR = false;
  victim.beingTreated = true;
  victim.assignedVSAV = vsav.id;
  vsav.assignedVictim = victim;

  const interval = setInterval(() => {
    if (!victim.beingTreated || victim.waitingForSMUR) {
      clearInterval(interval);
      return;
    }

    victim.progress += 10;
    safeUpdateVictimsUI();

    if (victim.progress >= 100) {
      clearInterval(interval);
      victim.treated = true;
      victim.beingTreated = false;
      safeUpdateVictimsUI();
      verifyMissionVehicles(mission);

      setTimeout(() => {
        assignVSAVsToVictims(mission); // Pour enchaîner le traitement de la prochaine victime
      }, 300);
    }
  }, 1000);
}

function retryCriticalVictimTreatment(mission) {
  mission.victims.forEach((victim) => {
    if (
      victim.severity === "critical" &&
      victim.waitingForSMUR &&
      !victim.treated &&
      !victim.beingTreated &&
      !victim.transported &&
      !victim.leaveOnSite
    ) {
      const allVSAV = (mission.dispatched || [])
        .filter((d) => d.vehicle.type === "VSAV" && d.vehicle.status === "al")
        .map((d) => d.vehicle);

      // Compare par id car parfois victim !== assignedVictim (référence différente)
      const vsav = allVSAV.find(
        (v) =>
          (v.assignedVictim && v.assignedVictim.id === victim.id) ||
          !v.assignedVictim
      );

      if (vsav) {
        startVictimTreatment(mission, victim, vsav);
      } else {
      }
    }
  });
}

let missionAutoEnabled = true;

function createMissionSafely() {
  if (isLoadingPOIs) return;
  if (missionAutoEnabled) createMission();
}

function toggleMissionGeneration() {
  missionAutoEnabled = !missionAutoEnabled;

  const icon = document.getElementById("mission-toggle");
  icon.title = missionAutoEnabled
    ? "Désactiver les appels automatiques"
    : "Activer les appels automatiques";
  icon.classList.toggle("paused", !missionAutoEnabled);
}

document
  .getElementById("mission-toggle")
  .addEventListener("click", toggleMissionGeneration);

let soundEnabled = true;

function toggleSound() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById("sound-toggle");
  icon.classList.toggle("muted", !soundEnabled);
  icon.title = soundEnabled ? "Son activé" : "Son désactivé";

  scheduleAutoSave(); // 👈 ajoute ceci pour enregistrer l’état
}

document.getElementById("sound-toggle").addEventListener("click", toggleSound);

// intervale existant à modifier :
setInterval(createMissionSafely, 3000);
