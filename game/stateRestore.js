// jeusecours/stateRestore.js
// Helpers extraits de loadState, AUCUNE logique modifiée. Tout reste global (pas de import/export).

/** 1) Contexte (météo / cycle / son) + flag de restauration */
function beginRestore(state) {
  if (state.currentWeather) {
    currentWeather = state.currentWeather;
    updateWeatherUI();
  }

  if (state.currentCycle) {
    currentCycle = state.currentCycle;
    updateCycleUI();
  }

  if (typeof state.soundEnabled === "boolean") {
    soundEnabled = state.soundEnabled;
    const icon = document.getElementById("sound-toggle");
    if (icon) {
      icon.classList.toggle("muted", !soundEnabled);
      icon.title = soundEnabled ? "Son activé" : "Son désactivé";
    }
  }
  window.RESTORE_MODE = true;
}

/** 2) Nettoyage DOM + tableaux + suppression des marqueurs */
function preClearDomAndArrays(map, buildings, missions) {
  buildings.forEach((b) => b.marker.remove());
  buildings.forEach((b) => {
    b.vehicles?.forEach((v) => {
      if (v.marker && map.hasLayer(v.marker)) {
        map.removeLayer(v.marker);
      }
    });
  });
  missions.forEach((m) => m.marker?.remove());

  buildings.length = 0;
  missions.length = 0;

  const buildingList = document.getElementById("building-list");
  const missionList = document.getElementById("mission-list");
  if (buildingList) buildingList.innerHTML = "";
  if (missionList) missionList.innerHTML = "";
}

/** 3) Joueur */
function restorePlayer(state, player, updatePlayerInfo) {
  if (state.player) {
    player.xp = state.player.xp || 0;
    player.money = state.player.money || 0;
    player.level = state.player.level || 1;
    updatePlayerInfo();
  }
}

/** 4) Historique */
function restoreHistory(state) {
  document.getElementById("history-list").innerHTML = "";
  const historyEl = document.getElementById("history-list");
  (state.history || []).forEach((entryHtml) => {
    historyEl.insertAdjacentHTML("beforeend", entryHtml);
  });
}

/** 5) Ordre des bâtiments (+ tri des données) */
function restoreBuildingOrder(state) {
  if (state.buildingOrder && Array.isArray(state.buildingOrder)) {
    const indexOf = Object.fromEntries(
      state.buildingOrder.map((bid, i) => [bid, i])
    );
    // tri du tableau state.buildings à partir de l’ordre sauvegardé
    state.buildings.sort((a, b) => {
      const sa = `${a.type}-${a.name}`.toLowerCase().replace(/\s+/g, "-");
      const sb = `${b.type}-${b.name}`.toLowerCase().replace(/\s+/g, "-");
      return (indexOf[sa] ?? 1e9) - (indexOf[sb] ?? 1e9);
    });
    // stock aussi l’ordre pour le DnD
    window.BUILDING_ORDER = state.buildingOrder.slice();
    // fonction de comparaison manuelle éventuellement utilisée ailleurs
    window.MANUAL_BUILDING_ORDER = (a, b) =>
      (indexOf[a] ?? Number.MAX_SAFE_INTEGER) -
      (indexOf[b] ?? Number.MAX_SAFE_INTEGER);
  } else {
    window.MANUAL_BUILDING_ORDER = null;
  }
}

/** 6) Bâtiments + véhicules (construction DOM + marqueurs) */
async function rebuildBuildingsAndVehicles(
  state,
  buildings,
  L,
  getSafeId,
  map
) {
  const vehicleById = {};
  const buildingById = {};

  // Index rapide des bâtiments "état" par id pour les recherches (ex: hospitalTargetId)
  const rawBuildingById = Object.fromEntries(
    (state.buildings || []).map((b) => [b.id, b])
  );

  for (const b of state.buildings || []) {
    // 1) Création DOM + marker via ta factory (retourne l'objet)
    const building = createBuildingFromState(b);
    if (!building) continue;

    // 2) Injecte l'id d'origine et le personnel
    building.id = b.id;

    if (["cpi", "cs", "csp"].includes(building.type)) {
      building.personnelPro = b.personnelPro ?? 0;
      building.personnelVol = b.personnelVol ?? 0;
      building.personnelAvailablePro =
        b.personnelAvailablePro ?? building.personnelPro ?? 0;
      building.personnelAvailableVol =
        b.personnelAvailableVol ?? building.personnelVol ?? 0;
    } else {
      building.personnel = b.personnel ?? 0;
      building.personnelAvailable = b.personnelAvailable ?? b.personnel ?? 0;
    }

    building.capacity = b.capacity || 10;
    building.patients = b.patients || [];
    building.reservedPatients = b.reservedPatients || [];

    // 3) Sidebar véhicules : clear et rebuild
    const safeId = getSafeId(building);
    const vehList = document.getElementById(`veh-${safeId}`);
    if (vehList) vehList.innerHTML = "";
    building.vehicles = [];

    for (const v of b.vehicles || []) {
      const vehicle = {
        id: v.id,
        type: v.type,
        label: v.label,
        required: v.personnel,
        status: v.status,
        kilometrage: v.kilometrage || 0,
        usure: typeof v.usure === "number" ? v.usure : 0,
        missionsCount: v.missionsCount || 0,
        ready: v.ready ?? true,
        retourEnCours: !!v.retourEnCours,
        capacityEau: v.capacityEau ?? null,
      };

      // Marker véhicule si position connue et pas "dc"
      if (v.position && v.status !== "dc") {
        const icon = L.icon({
          iconUrl: `../assets/icons/${v.type.toLowerCase()}.png`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker(v.position, { icon })
          .addTo(map)
          .bindTooltip(`${v.label}`, { permanent: false, direction: "top" });

        vehicle.marker = marker;
        vehicle.lastKnownPosition = v.position;

        if (v.hospitalTargetId) {
          const targetRaw = rawBuildingById[v.hospitalTargetId];
          if (targetRaw) {
            // On pointera vers l'objet reconstruit après indexation globale
            vehicle._hospitalTargetRawId = v.hospitalTargetId;
          }
        }
      }

      // DOM ligne véhicule
      const li = document.createElement("li");
      li.classList.add("vehicle-item");
      li.innerHTML = `
        <span>${vehicle.label}</span>
        <span class="status ${v.status}" data-vehicle-id="${v.id}" title="${
        v.status?.toUpperCase?.() || ""
      }">
          ${v.status?.toUpperCase?.() || ""}
        </span>
      `;
      vehList?.appendChild(li);
      vehicle.statusElement = li.querySelector(".status");

      building.vehicles.push(vehicle);
      vehicleById[vehicle.id] = vehicle;
    }

    // 4) Indexation par safeId (pour dispatched) ET par id (fallback)
    buildingById[safeId] = building;
    if (building.id) buildingById[building.id] = building;

    refreshBuildingStatus(building);

    // 5) POI : lit BDD → si vide, remplit depuis Overpass puis upsert
    try {
      if (typeof getOrFetchPOIsForBuilding === "function") {
        await getOrFetchPOIsForBuilding(building);
      }
      if (typeof refillPOIsForBuildingIfEmpty === "function") {
        await refillPOIsForBuildingIfEmpty(building);
      }
    } catch (e) {
      console.warn(
        `[POI] Erreur lors du chargement POI pour ${building.id || safeId}`,
        e
      );
    }
  }

  // 6) Finalise les hospitalTarget des véhicules (maintenant que tous les bâtiments sont indexés)
  for (const b of buildings) {
    for (const v of b.vehicles) {
      if (v._hospitalTargetRawId && buildingById[v._hospitalTargetRawId]) {
        v.hospitalTarget = buildingById[v._hospitalTargetRawId];
        delete v._hospitalTargetRawId;
      }
    }
  }

  return { vehicleById, buildingById };
}

/** 7) Statistiques d’appels (restauration) */
function setCallStats(state) {
  window.CALL_STATS = state.callStats || {
    total: 0,
    bySource: { "Relais 18/112": 0, "Centre 15": 0, 17: 0 },
  };
}

/** 8) NEXT_CALL_ID */
function computeNextCallId(state) {
  if (typeof state.nextCallId === "number" && state.nextCallId > 0) {
    window.NEXT_CALL_ID = state.nextCallId;
    return;
  }
  const maxId = Math.max(
    -1,
    ...(state.missions || [])
      .map((m) => parseInt(m.id, 10))
      .filter((n) => Number.isFinite(n))
  );
  window.NEXT_CALL_ID = maxId + 1;
}

/** 9) Missions + DOM + marqueurs + reprise de progression */
function restoreMissions(
  state,
  missionList,
  L,
  map,
  vehicleById,
  buildingById
) {
  for (const ms of state.missions || []) {
    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${ms.label}</h3>
      <p>
        <span class="mission-status">${ms.address || "Appel non traité"}</span>
        <span class="mission-timer">Depuis 00:00:00</span>
      </p>
      <button onclick="openCallModal('${ms.id}')">Traiter</button>
    `;
    missionList.appendChild(li);

    const icon = L.icon({
      iconUrl: "../assets/icons/mission.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    const marker = L.marker(ms.position, { icon })
      .addTo(map)
      .bindPopup(ms.label || "📞 Appel");

    const mission = {
      id: ms.id,
      type: ms.type,
      realLabel: ms.realLabel,
      realType: ms.realType,
      label: ms.label,
      address: ms.address,
      xp: ms.xp,
      reward: ms.reward,
      position: ms.position,
      marker,
      observations: ms.observations || "",
      createdAt: ms.createdAt || Date.now(),
      domElement: li,
      dialogue: ms.dialogue,
      hasAskedAddress: !!ms.hasAskedAddress,
      active: ms.active,
      progressStarted: ms.progressStarted,
      durationMs:
        typeof ms.durationMs === "number" && ms.durationMs >= 0
          ? ms.durationMs
          : 0,
      labelUpdated: ms.labelUpdated,
      sourceType: ms.sourceType,
      solutionType: ms.solutionType,
      vehicles: ms.vehicles ?? [],
      victims: ms.victims || [],
      dispatched: [],
      startTime: ms.startTime || Date.now(),
    };

    mission.timerElement = li.querySelector(".mission-timer");

    if (Array.isArray(ms.dispatched)) {
      for (const d of ms.dispatched) {
        const veh = vehicleById[d.vehicleId];
        // d.buildingId est un safeId sauvegardé; on tente safeId puis id brut en fallback
        const bld =
          buildingById[d.buildingId] || buildingById[String(d.buildingId)];
        if (veh && bld) {
          mission.dispatched.push({
            vehicle: veh,
            building: bld,
            canceled: d.canceled || false,
          });
        }
      }
    }

    missions.push(mission);

    if (mission.marker && mission.marker.getPopup()) {
      mission.marker.setPopupContent(() =>
        generateMissionPopupContent(mission)
      );
    }

    verifyMissionVehicles(mission);

    if (mission.progressStarted && mission.startTime && mission.durationMs) {
      resumeMissionProgress(mission);
      const btn = mission.domElement?.querySelector("button");
      if (btn) {
        btn.textContent = "Gérer";
        btn.onclick = () => openManageMission(mission.id);
      }
      updateMissionStateClass(mission, "en-cours");
    }

    updateMissionButton(mission);
  }
}

/** 10) Réassocier véhicules ↔ missions + retours/hôpital */
function reassociateVehiclesToMissions(
  buildings,
  missions,
  getSafeId,
  returnVehicleToCaserne
) {
  missions.forEach((m) => {
    checkMissionArrival(m);
    verifyMissionVehicles(m);
  });

  for (const b of buildings) {
    for (const v of b.vehicles) {
      if (v.status === "er" || v.status === "at") {
        const mission = missions.find((m) =>
          m.dispatched.some((d) => d.vehicle.id === v.id)
        );
        if (mission) {
          if (v.status === "at") {
            v.status = "er";
            updateVehicleStatus(v, "er");
            logVehicleRadio(v, "er", { mission });
            refreshVehicleStatusForBuilding(b);
            updateVehicleListDisplay(getSafeId(b));
          }
          dispatchVehicleToMission(v, mission, b);
        }
      }

      if (v.status === "tr" && v.hospitalTarget) {
        animateVehicleAlongRoute(
          v,
          [v.lastKnownPosition, v.hospitalTarget.latlng],
          () => {
            updateVehicleStatus(v, "ch");
            setTimeout(() => {
              admitPatient(v.hospitalTarget, {
                missionId: null,
                severity: "moderate",
              });
              updateVehicleStatus(v, "ot");
              returnFromHospital(v, b);
            }, getUnloadingDelay());
          }
        );
      }

      if (v.status === "ch" && v.hospitalTarget) {
        updateVehicleStatus(v, "ch");
        setTimeout(() => {
          admitPatient(v.hospitalTarget, {
            missionId: null,
            severity: "moderate",
          });
          updateVehicleStatus(v, "ot");
          returnFromHospital(v, b);
        }, getUnloadingDelay());
      }

      if (v.retourEnCours) {
        returnVehicleToCaserne(v, b);
      }
    }
  }
}

/** 11) Finalisation UI + DnD */
function finalizeRestore(
  buildings,
  updateSidebarVehicleList,
  bindBuildingDnd,
  getSafeId
) {
  window.RESTORE_MODE = false;
  // 🔁 Re-synchronise la sidebar véhicules après chargement
  buildings.forEach((b) => updateSidebarVehicleList(getSafeId(b)));

  if (window.MANUAL_BUILDING_ORDER) {
    bindBuildingDnd?.(document.getElementById("building-list"), true);
  }
}
