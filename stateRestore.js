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

  // 🏢 Restauration des bâtiments
  for (const b of state.buildings) {
    createBuildingFromState(b);
    await preloadAllPOIs();
    const building = buildings.find(
      (x) => x.name === b.name && x.type === b.type
    );
    if (!building) continue;

    building.id = b.id;

    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
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

    building.vehicles = [];
    building.capacity = b.capacity || 10;
    building.patients = b.patients || [];
    building.reservedPatients = b.reservedPatients || [];

    const safeId = getSafeId(building);
    const vehList = document.getElementById(`veh-${safeId}`);
    if (vehList) vehList.innerHTML = "";

    for (const v of b.vehicles) {
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
        retourEnCours: "retourEnCours" in v ? v.retourEnCours : false,
      };

      if (v.position && v.status !== "dc") {
        const icon = L.icon({
          iconUrl: `assets/icons/${v.type.toLowerCase()}.png`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker(v.position, { icon })
          .addTo(map)
          .bindTooltip(`${v.label}`, { permanent: false, direction: "top" });

        vehicle.marker = marker;
        vehicle.lastKnownPosition = v.position;

        if (v.hospitalTargetId) {
          const targetHospital = buildings.find(
            (h) => h.id === v.hospitalTargetId
          );
          if (targetHospital) {
            vehicle.hospitalTarget = targetHospital;
          }
        }
      }

      const li = document.createElement("li");
      li.classList.add("vehicle-item");
      li.innerHTML = `
        <span>${vehicle.label}</span>
        <span
          class="status ${v.status}"
          data-vehicle-id="${v.id}"
          title="${v.status.toUpperCase()}"
        >
          ${v.status.toUpperCase()}
        </span>
      `;
      vehList?.appendChild(li);
      vehicle.statusElement = li.querySelector(".status");

      building.vehicles.push(vehicle);
      vehicleById[vehicle.id] = vehicle;
    }

    if (
      building.type === "cpi" ||
      building.type === "cs" ||
      building.type === "csp"
    ) {
      const spanProTotal = document.getElementById(`staff-pro-${safeId}`);
      const spanProAvail = document.getElementById(`staff-pro-avail-${safeId}`);
      if (spanProTotal) spanProTotal.textContent = building.personnelPro ?? 0;
      if (spanProAvail)
        spanProAvail.textContent = building.personnelAvailablePro ?? 0;

      const spanVolTotal = document.getElementById(`staff-vol-${safeId}`);
      const spanVolAvail = document.getElementById(`staff-vol-avail-${safeId}`);
      if (spanVolTotal) spanVolTotal.textContent = building.personnelVol ?? 0;
      if (spanVolAvail)
        spanVolAvail.textContent = building.personnelAvailableVol ?? 0;
    } else {
      const spanTotal = document.getElementById(`staff-${safeId}`);
      const spanAvail = document.getElementById(`staff-avail-${safeId}`);
      if (spanTotal) spanTotal.textContent = building.personnel ?? 0;
      if (spanAvail) spanAvail.textContent = building.personnelAvailable ?? 0;
    }

    buildingById[getSafeId(building)] = building;
    refreshBuildingStatus(building);
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
  if (typeof state.nextCallId === "number") {
    window.NEXT_CALL_ID = state.nextCallId;
  } else {
    const maxId = Math.max(
      -1,
      ...(state.missions || [])
        .map((m) => parseInt(m.id, 10))
        .filter((n) => Number.isFinite(n))
    );
    window.NEXT_CALL_ID = maxId + 1;
  }
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
  // 🚨 Restauration des missions
  for (const ms of state.missions) {
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
      iconUrl: "assets/icons/mission.png",
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
        const vehicle = vehicleById[d.vehicleId];
        const building = buildingById[d.buildingId];
        if (vehicle && building) {
          mission.dispatched.push({
            vehicle,
            building,
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
