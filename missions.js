let isLoadingPOIs = true;

async function preloadAllPOIs() {
  isLoadingPOIs = true; // ← Blocage activé

  const loader = document.getElementById("loader-pois");
  loader.classList.remove("hidden");

  for (const building of buildings) {
    await getOrFetchPOIsForBuilding(building);
  }

  loader.classList.add("hidden");
  isLoadingPOIs = false; // ← Fin du blocage
}

function createMission() {
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

  const selected =
    missionsEligible[Math.floor(Math.random() * missionsEligible.length)];

  let latlng = null;

  if (selected.poiTags?.length > 0) {
    const pois = buildingPoisMap.get(origin.id);
    if (pois === undefined) return;

    const matchingPois = pois.filter((poi) =>
      selected.poiTags.some((tag) => poi.tags?.[tag])
    );

    if (matchingPois.length > 0) {
      const poi = matchingPois[Math.floor(Math.random() * matchingPois.length)];
      latlng = L.latLng(poi.lat, poi.lng);

      usedPoi = poi; // <-- Stocke le POI utilisé
    }
  }

  if (!latlng) {
    const lat = origin.latlng.lat + (Math.random() - 0.5) * 0.05;
    const lng = origin.latlng.lng + (Math.random() - 0.5) * 0.05;
    latlng = L.latLng(lat, lng);
  }

  console.log(
    `[Mission créée] ${selected.label} — POI utilisé :`,
    usedPoi ? usedPoi : "aucun (coordonnée aléatoire)"
  );

  const mission = {
    id: Date.now().toString(),
    type: selected.type,
    realLabel: selected.label,
    realType: selected.type,
    label: "📞 Appel en cours...",
    xp: selected.xp,
    reward: selected.reward,
    minLevel: selected.minLevel,
    duration: typeof selected.duration === "number" ? selected.duration : 0,
    durationMs:
      typeof selected.durationMs === "number" ? selected.durationMs : 0,
    vehicles: [],
    position: latlng,
    marker: null,
    active: false,
    dialogue: selected.dialogue,
    solutionType: selected.type,
    sourceType: realType,
    victims: generateVictims(selected),
    startTime: Date.now(),
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

  missionList.appendChild(li);
  missions.push(mission);

  const icon = L.icon({
    iconUrl: "assets/icons/mission.png",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const marker = L.marker(latlng, { icon })
    .addTo(map)
    .bindPopup(() => {
      return (
        mission.domElement?.cloneNode(true) || "<em>Pas d’info mission</em>"
      );
    });

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

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`
    )
      .then((res) => res.json())
      .then((data) => {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
          L.latLng(lat, lng)
        );
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

        const segmentDistances = [];
        let totalRouteDistance = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          const d = map.distance(coords[i], coords[i + 1]);
          segmentDistances.push(d);
          totalRouteDistance += d;
        }

        const cumulativeDistances = [0];
        for (let i = 0; i < segmentDistances.length; i++) {
          cumulativeDistances.push(
            cumulativeDistances[i] + segmentDistances[i]
          );
        }

        const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
        const totalDuration = totalRouteDistance * speedFactor;
        const startTime = Date.now();
        const start = coords[0];
        let prevLatLng = start;

        function animateReturn() {
          const elapsed = Date.now() - startTime;
          const distanceCovered = Math.min(
            elapsed / speedFactor,
            totalRouteDistance
          );

          let segmentIndex = 0;
          while (
            segmentIndex < cumulativeDistances.length - 1 &&
            cumulativeDistances[segmentIndex + 1] < distanceCovered
          ) {
            segmentIndex++;
          }

          const segmentStart = coords[segmentIndex];
          const segmentEnd = coords[segmentIndex + 1];
          const segDist = segmentDistances[segmentIndex];
          const distIntoSegment =
            distanceCovered - cumulativeDistances[segmentIndex];
          const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

          const lat =
            segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
          const lng =
            segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

          // --- PATCH KILOMÉTRAGE ---
          const currentLatLng = L.latLng(lat, lng);
          const distStep = prevLatLng.distanceTo(currentLatLng);
          vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
          prevLatLng = currentLatLng;
          // --- FIN PATCH ---

          vehicle.lastKnownPosition = currentLatLng;
          vehicle.marker.setLatLng(currentLatLng);

          if (distanceCovered < totalRouteDistance) {
            vehicle.returnAnimation = requestAnimationFrame(animateReturn);
          } else {
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
            scheduleAutoSave();
          }
        }
        animateReturn();
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

  const requiredVehicles = template.vehicles;

  const arrivedCounts = {};
  mission.dispatched.forEach((d) => {
    const v = d.vehicle;
    // Considère le VSAV comme "engagé" s'il est sur place OU en transport OU au CH OU retour
    const isEngagedStatus = ["al", "tr", "ch"].includes(v.status);
    if (isEngagedStatus) {
      arrivedCounts[v.type] = (arrivedCounts[v.type] || 0) + 1;
    }
  });

  const hasEngaged = mission.dispatched?.some(
    (d) => d.vehicle && d.vehicle.status === "er"
  );
  const arrivedCountTotal = Object.values(arrivedCounts).reduce(
    (a, b) => a + b,
    0
  );

  // Retourner en rouge uniquement si aucun véhicule n'est arrivé ET aucun véhicule n'est en route
  if (arrivedCountTotal === 0 && !hasEngaged) {
    updateMissionStateClass(mission, "non-lancee");
    updateMissionButton(mission);
    return;
  }

  const requiredCounts = {};
  requiredVehicles.forEach((rv) => {
    requiredCounts[rv.type] = (requiredCounts[rv.type] || 0) + 1;
  });

  const missingVehicles = [];
  for (const type in requiredCounts) {
    const required = requiredCounts[type];
    const arrived = arrivedCounts[type] || 0;
    if (arrived < required) {
      missingVehicles.push(`${type} (${required - arrived} manquant)`);
    }
  }

  let victimStatus = "";
  if (mission.victims && mission.victims.length > 0) {
    const treated = mission.victims.filter(
      (v) => v.beingTreated || v.treated || v.transported || v.leaveOnSite
    ).length;
    const total = mission.victims.length;
    victimStatus = `<div>👤 Victimes : ${treated}/${total}</div>`;
  }

  // === 📝 MAJ du contenu affiché ===
  let stateText = "";

  if (missingVehicles.length > 0) {
    stateText =
      `<h4>📋 État des moyens engagés :</h4>` +
      Object.keys(requiredCounts)
        .map((type) => {
          const arrived = arrivedCounts[type] || 0;
          const required = requiredCounts[type];
          return arrived >= required
            ? `✅ <strong>${type}</strong> : ${arrived}/${required}`
            : `❌ <strong>${type}</strong> : ${arrived}/${required}`;
        })
        .join("<br>") +
      `<br><span style="color:red">🛑 En attente : ${missingVehicles.join(
        ", "
      )}</span>`;
  } else if (!mission.progressStarted && arrivedCountTotal > 0) {
    // Tous les moyens sont sur place, n'affiche plus les véhicules, mais affiche l'état victimes si au moins un véhicule sur place
    stateText = victimStatus;
  } else if (mission.progressStarted && victimStatus) {
    // Mission en cours : afficher état victimes
    stateText = victimStatus;
  } else {
    stateText = "";
  }

  const p = mission.domElement.querySelector("p");
  if (stateText) {
    p.innerHTML = stateText;
    p.style.display = "";
  } else {
    p.innerHTML = "";
    p.style.display = "none";
  }

  const inTransit = hasEngaged;

  // === 🎨 MAJ état CSS + bouton ===
  if (missingVehicles.length === 0) {
    // Ajoute ce bloc pour vérifier les victimes
    const allVictimsReady =
      !mission.victims ||
      mission.victims.length === 0 ||
      mission.victims.every(
        (v) => v.leaveOnSite || v.transported || v.inTransport
      );

    if (allVictimsReady) {
      updateMissionStateClass(mission, "en-cours");

      mission.awaitingProgress = false;
      startMissionProgress(mission);
    } else {
      // Attendre que toutes les victimes soient traitées/transportées/laissées sur place
      updateMissionStateClass(mission, "attente");

      mission.awaitingProgress = true; // ✅ <<<<<< ICI
      // PAS de startMissionProgress ici !
    }
  } else if (inTransit) {
    updateMissionStateClass(mission, "transit");
  } else if (hasEngaged) {
    updateMissionStateClass(mission, "attente");
  } else {
    updateMissionStateClass(mission, "non-lancee");
  }

  updateMissionButton(mission); // 🔁 Gérer / Traiter
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
      cancelAnimationFrame(vehicle.returnAnimation);
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

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${mission.position.lng},${mission.position.lat}?overview=full&geometries=geojson`
      )
        .then((res) => res.json())
        .then((data) => {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
            L.latLng(lat, lng)
          );
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

          // Pré-calcul des distances cumulées
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
          const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
          const totalDuration = totalRouteDistance * speedFactor;
          vehicle.arrivalTime = Date.now() + totalDuration;
          const startTime = Date.now();
          const start = coords[0];
          let prevLatLng = start;

          function animateToMission() {
            const elapsed = Date.now() - startTime;
            const distanceCovered = Math.min(
              elapsed / speedFactor,
              totalRouteDistance
            );

            let segmentIndex = 0;
            while (
              segmentIndex < cumulativeDistances.length - 1 &&
              cumulativeDistances[segmentIndex + 1] < distanceCovered
            ) {
              segmentIndex++;
            }

            const segmentStart = coords[segmentIndex];
            const segmentEnd = coords[segmentIndex + 1];
            const segDist = segmentDistances[segmentIndex];
            const distIntoSegment =
              distanceCovered - cumulativeDistances[segmentIndex];
            const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

            const lat =
              segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
            const lng =
              segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

            // --- PATCH KILOMÉTRAGE ---
            const currentLatLng = L.latLng(lat, lng);
            const distStep = prevLatLng.distanceTo(currentLatLng);
            vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
            prevLatLng = currentLatLng;
            // --- FIN PATCH ---

            vehicle.lastKnownPosition = currentLatLng;
            vehicle.marker.setLatLng(currentLatLng);

            if (distanceCovered < totalRouteDistance) {
              vehicle.returnAnimation = requestAnimationFrame(animateToMission);
            } else {
              setVehicleStatus(vehicle, "al", { mission, building });
              vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
              cancelAnimationFrame(vehicle.returnAnimation);
              checkMissionArrival(mission);
              verifyMissionVehicles(mission);
              if (vehicle.type === "VSAV") {
                assignVSAVsToVictims(mission);
              }
              if (vehicle.type === "SMUR" && vehicle.status === "al") {
                retryCriticalVictimTreatment(mission);
              }
            }
          }
          animateToMission();
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
      cancelAnimationFrame(vehicle.returnAnimation);
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

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${mission.position.lng},${mission.position.lat}?overview=full&geometries=geojson`
      )
        .then((res) => res.json())
        .then((data) => {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
            L.latLng(lat, lng)
          );
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
          const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
          const totalDuration = totalRouteDistance * speedFactor;
          vehicle.arrivalTime = Date.now() + totalDuration;
          const startTime = Date.now();
          const start = coords[0];
          let prevLatLng = start;

          function animateToMission() {
            const elapsed = Date.now() - startTime;
            const distanceCovered = Math.min(
              elapsed / speedFactor,
              totalRouteDistance
            );

            let segmentIndex = 0;
            while (
              segmentIndex < cumulativeDistances.length - 1 &&
              cumulativeDistances[segmentIndex + 1] < distanceCovered
            ) {
              segmentIndex++;
            }

            const segmentStart = coords[segmentIndex];
            const segmentEnd = coords[segmentIndex + 1];
            const segDist = segmentDistances[segmentIndex];
            const distIntoSegment =
              distanceCovered - cumulativeDistances[segmentIndex];
            const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

            const lat =
              segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
            const lng =
              segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

            const currentLatLng = L.latLng(lat, lng);
            const distStep = prevLatLng.distanceTo(currentLatLng);
            vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
            prevLatLng = currentLatLng;

            vehicle.lastKnownPosition = currentLatLng;
            vehicle.marker.setLatLng(currentLatLng);

            if (distanceCovered < totalRouteDistance) {
              vehicle.returnAnimation = requestAnimationFrame(animateToMission);
            } else {
              vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
              setVehicleStatus(vehicle, "al", { mission, building });
              cancelAnimationFrame(vehicle.returnAnimation);
              checkMissionArrival(mission);
              verifyMissionVehicles(mission);
              if (vehicle.type === "VSAV") {
                assignVSAVsToVictims(mission);
              }
              if (vehicle.type === "SMUR" && vehicle.status === "al") {
                retryCriticalVictimTreatment(mission);
              }
            }
          }
          animateToMission();
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

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
        L.latLng(lat, lng)
      );
      if (coords.length < 2) {
        vehicle.marker.setLatLng(end);
        setVehicleStatus(vehicle, "al", { mission, building });
        vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
        checkMissionArrival(mission);
        verifyMissionVehicles(mission);
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

      const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
      const totalDuration = totalRouteDistance * speedFactor;
      const startTime = Date.now();
      vehicle.arrivalTime = Date.now() + totalDuration;
      const start = coords[0];
      let prevLatLng = start;

      function animateToMission() {
        const elapsed = Date.now() - startTime;
        const distanceCovered = Math.min(
          elapsed / speedFactor,
          totalRouteDistance
        );

        let segmentIndex = 0;
        while (
          segmentIndex < cumulativeDistances.length - 1 &&
          cumulativeDistances[segmentIndex + 1] < distanceCovered
        ) {
          segmentIndex++;
        }

        const segmentStart = coords[segmentIndex];
        const segmentEnd = coords[segmentIndex + 1];
        const segDist = segmentDistances[segmentIndex];
        const distIntoSegment =
          distanceCovered - cumulativeDistances[segmentIndex];
        const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

        const lat =
          segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
        const lng =
          segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

        // --- PATCH KILOMÉTRAGE ---
        const currentLatLng = L.latLng(lat, lng);
        const distStep = prevLatLng.distanceTo(currentLatLng);
        vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
        prevLatLng = currentLatLng;
        // --- FIN PATCH ---

        vehicle.lastKnownPosition = currentLatLng;
        vehicle.marker.setLatLng(currentLatLng);

        if (distanceCovered < totalRouteDistance) {
          vehicle.returnAnimation = requestAnimationFrame(animateToMission);
        } else {
          vehicle.missionsCount = (vehicle.missionsCount || 0) + 1;
          setVehicleStatus(vehicle, "al", { mission, building });
          cancelAnimationFrame(vehicle.returnAnimation);
          checkMissionArrival(mission);
          verifyMissionVehicles(mission);
        }
      }

      animateToMission();
    });
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

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
        L.latLng(lat, lng)
      );
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

      const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
      const startTime = Date.now();
      const start = coords[0];
      let prevLatLng = start;

      function animateReturn() {
        const elapsed = Date.now() - startTime;
        const distanceCovered = Math.min(
          elapsed / speedFactor,
          totalRouteDistance
        );

        let segmentIndex = 0;
        while (
          segmentIndex < cumulativeDistances.length - 1 &&
          cumulativeDistances[segmentIndex + 1] < distanceCovered
        ) {
          segmentIndex++;
        }

        const segmentStart = coords[segmentIndex];
        const segmentEnd = coords[segmentIndex + 1];
        const segDist = segmentDistances[segmentIndex];
        const distIntoSegment =
          distanceCovered - cumulativeDistances[segmentIndex];
        const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

        const lat =
          segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
        const lng =
          segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

        // --- PATCH KILOMÉTRAGE ---
        const currentLatLng = L.latLng(lat, lng);
        const distStep = prevLatLng.distanceTo(currentLatLng);
        vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
        prevLatLng = currentLatLng;
        // --- FIN PATCH ---

        vehicle.lastKnownPosition = currentLatLng;
        vehicle.marker.setLatLng(currentLatLng);

        if (distanceCovered < totalRouteDistance) {
          vehicle.returnAnimation = requestAnimationFrame(animateReturn);
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
          cancelAnimationFrame(vehicle.returnAnimation);
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
        }
      }

      animateReturn();
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

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
        L.latLng(lat, lng)
      );
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

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) =>
        L.latLng(lat, lng)
      );
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

      const segmentDistances = [];
      let totalRouteDistance = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const d = map.distance(coords[i], coords[i + 1]);
        segmentDistances.push(d);
        totalRouteDistance += d;
      }

      const cumulativeDistances = [0];
      for (let i = 0; i < segmentDistances.length; i++) {
        cumulativeDistances.push(cumulativeDistances[i] + segmentDistances[i]);
      }

      const speedFactor = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;
      const totalDuration = totalRouteDistance * speedFactor;
      const startTime = Date.now();

      // Réaffiche le marqueur s’il était masqué
      if (vehicle.marker && !map.hasLayer(vehicle.marker)) {
        vehicle.marker.addTo(map);
        vehicle.markerVisible = true;
      }
      const start = coords[0];
      let prevLatLng = start;

      function animateReturn() {
        const elapsed = Date.now() - startTime;
        const distanceCovered = Math.min(
          elapsed / speedFactor,
          totalRouteDistance
        );

        let segmentIndex = 0;
        while (
          segmentIndex < cumulativeDistances.length - 1 &&
          cumulativeDistances[segmentIndex + 1] < distanceCovered
        ) {
          segmentIndex++;
        }

        const segmentStart = coords[segmentIndex];
        const segmentEnd = coords[segmentIndex + 1];
        const segDist = segmentDistances[segmentIndex];
        const distIntoSegment =
          distanceCovered - cumulativeDistances[segmentIndex];
        const segRatio = segDist === 0 ? 0 : distIntoSegment / segDist;

        const lat =
          segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segRatio;
        const lng =
          segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segRatio;

        // --- PATCH KILOMÉTRAGE ---
        const currentLatLng = L.latLng(lat, lng);
        const distStep = prevLatLng.distanceTo(currentLatLng);
        vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
        prevLatLng = currentLatLng;
        // --- FIN PATCH ---

        vehicle.lastKnownPosition = currentLatLng;
        vehicle.marker.setLatLng(currentLatLng);

        if (distanceCovered < totalRouteDistance) {
          vehicle.returnAnimation = requestAnimationFrame(animateReturn);
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
          vehicle.retourEnCours = false;
          vehicle.lastKnownPosition = target;
          vehicle.ready = true;
          updateVehicleStatus(vehicle, "dc");
          logVehicleRadio(vehicle, "dc", { targetBuilding: building });
          vehicle.status = "dc";
          applyVehicleWear(vehicle);

          refreshBuildingStatus(building);

          refreshVehicleStatusForBuilding(building);
          updateVehicleListDisplay(getSafeId(building));
          scheduleAutoSave();
        }
      }

      animateReturn();
    });
}

function animateVehicleAlongRoute(vehicle, coords, callback) {
  const speed = VEHICLE_SPEED_BY_TYPE[vehicle.type] || 20;

  const segmentDistances = [];
  let totalDistance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = map.distance(coords[i], coords[i + 1]);
    segmentDistances.push(d);
    totalDistance += d;
  }

  const cumulativeDistances = [0];
  for (let i = 0; i < segmentDistances.length; i++) {
    cumulativeDistances.push(cumulativeDistances[i] + segmentDistances[i]);
  }

  const totalDuration = totalDistance * speed;
  const startTime = Date.now();

  let prevPos = coords[0]; // <-- AJOUT ICI

  function step() {
    const elapsed = Date.now() - startTime;
    const covered = Math.min(elapsed / speed, totalDistance);

    let segmentIndex = 0;
    while (
      segmentIndex < cumulativeDistances.length - 1 &&
      cumulativeDistances[segmentIndex + 1] < covered
    ) {
      segmentIndex++;
    }

    const segStart = coords[segmentIndex];
    const segEnd = coords[segmentIndex + 1];
    const segDist = segmentDistances[segmentIndex];
    const intoSegment = covered - cumulativeDistances[segmentIndex];
    const ratio = segDist === 0 ? 0 : intoSegment / segDist;

    const lat = segStart.lat + (segEnd.lat - segStart.lat) * ratio;
    const lng = segStart.lng + (segEnd.lng - segStart.lng) * ratio;
    const pos = L.latLng(lat, lng);

    // --- PATCH KILOMÉTRAGE ---
    const distStep = prevPos.distanceTo(pos);
    vehicle.kilometrage = (vehicle.kilometrage || 0) + distStep;
    prevPos = pos;
    // --- FIN PATCH ---

    vehicle.lastKnownPosition = pos;
    if (vehicle.marker) vehicle.marker.setLatLng(pos);

    if (covered < totalDistance) {
      vehicle.returnAnimation = requestAnimationFrame(step);
    } else {
      vehicle.lastKnownPosition = coords[coords.length - 1];
      if (vehicle.marker) vehicle.marker.setLatLng(vehicle.lastKnownPosition);
      callback?.();
    }
  }

  step();
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
