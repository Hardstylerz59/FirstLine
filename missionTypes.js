const PRENOMS = [
  "Lucas",
  "Jules",
  "Léo",
  "Louis",
  "Gabriel",
  "Arthur",
  "Hugo",
  "Raphaël",
  "Adam",
  "Nathan",
  "Ethan",
  "Paul",
  "Noah",
  "Tom",
  "Sacha",
  "Timéo",
  "Maël",
  "Aaron",
  "Gabin",
  "Noé",
  "Liam",
  "Mathis",
  "Axel",
  "Maxence",
  "Enzo",
  "Théo",
  "Oscar",
  "Eliott",
  "Nolan",
  "Antoine",
  "Marius",
  "Robin",
  "Valentin",
  "Clément",
  "Matteo",
  "Rayan",
  "Samuel",
  "Victor",
  "Benjamin",
  "Kylian",
  "Baptiste",
  "Mohamed",
  "Ayden",
  "Aymeric",
  "Evan",
  "Imran",
  "Ryan",
  "Quentin",
  "Simon",
  "Johan",
  "Camille",
  "Emma",
  "Léa",
  "Manon",
  "Chloé",
  "Lina",
  "Louise",
  "Jade",
  "Alice",
  "Rose",
  "Julia",
  "Léna",
  "Anna",
  "Sarah",
  "Eva",
  "Ambre",
  "Romane",
  "Agathe",
  "Lou",
  "Juliette",
  "Jeanne",
  "Zoé",
  "Inès",
  "Margaux",
  "Louna",
  "Lily",
  "Lucie",
  "Apolline",
  "Lola",
  "Elisa",
  "Eva",
  "Clara",
  "Mila",
  "Lisa",
  "Maya",
  "Charlotte",
  "Maëlys",
  "Mélina",
  "Nina",
  "Salomé",
  "Gabrielle",
  "Candice",
  "Emy",
  "Adèle",
  "Amandine",
  "Axelle",
  "Capucine",
  "Sarah",
  "Anaïs",
  "Eléa",
];

const NOMS = [
  "Martin",
  "Bernard",
  "Thomas",
  "Petit",
  "Robert",
  "Richard",
  "Durand",
  "Dubois",
  "Moreau",
  "Laurent",
  "Simon",
  "Michel",
  "Lefebvre",
  "Leroy",
  "Roux",
  "David",
  "Bertrand",
  "Morel",
  "Fournier",
  "Girard",
  "Bonnet",
  "Dupont",
  "Lambert",
  "Fontaine",
  "Rousseau",
  "Vincent",
  "Muller",
  "Lefèvre",
  "Faure",
  "André",
  "Mercier",
  "Blanc",
  "Guerin",
  "Boyer",
  "Garnier",
  "Chevalier",
  "Francois",
  "Legrand",
  "Gauthier",
  "Garcia",
  "Perrin",
  "Robin",
  "Clement",
  "Morin",
  "Nicolas",
  "Henry",
  "Roussel",
  "Mathieu",
  "Gautier",
  "Masson",
  "Marchand",
  "Duval",
  "Denis",
  "Dumont",
  "Marie",
  "Lemaire",
  "Noel",
  "Meyer",
  "Dufour",
  "Meunier",
  "Brun",
  "Blanchard",
  "Giraud",
  "Joly",
  "Rivière",
  "Lucas",
  "Brunet",
  "Gaillard",
  "Barbier",
  "Arnaud",
  "Martinez",
  "Poirier",
  "Charpentier",
  "Menard",
  "Carpentier",
  "Maillard",
  "Da Silva",
  "Besnard",
  "Lopez",
  "Vidal",
  "Bourgeois",
  "Dupuis",
  "Schmitt",
  "Bourdon",
  "Colin",
  "Pierre",
  "Renard",
  "Caron",
  "Aubry",
  "Martel",
  "Benoit",
  "Paris",
  "Leclerc",
  "Humbert",
  "Gilbert",
  "Lecomte",
  "Perrot",
  "Besson",
  "Guyot",
  "Baron",
];

function getRandomName() {
  const prenom = PRENOMS[Math.floor(Math.random() * PRENOMS.length)];
  const nom = NOMS[Math.floor(Math.random() * NOMS.length)];
  return `${prenom} ${nom}`;
}

function enrichMissionBase(mission, realType) {
  mission.vehicles = mission.vehicles || [];
  const nbVehicules = mission.vehicles.length;

  let minLevel = 1;
  let xp = 7;
  let reward = 2500;
  let duration = 0;

  // Cas missions police
  if (realType === "police") {
    if (nbVehicules === 1) {
      xp = randBetween(7, 10);
      reward = randBetween(2500, 3200);
      duration = randBetween(7000, 9000) * 3;
    } else if (nbVehicules === 2) {
      xp = randBetween(12, 16);
      reward = randBetween(4000, 6000);
      minLevel = 3;
      duration = randBetween(7000, 9000) * 3;
    } else if (nbVehicules >= 3) {
      xp = randBetween(18, 25);
      reward = randBetween(7500, 14000);
      minLevel = 5;
      duration = randBetween(9000, 12000) * 3;
    }

    if (mission.type?.startsWith("rare_") || reward > 20000) {
      xp = randBetween(30, 40);
      reward = randBetween(25000, 60000);
      minLevel = 8;
      duration = randBetween(15000, 25000) * 3;
    }

    return { ...mission, minLevel, xp, reward, duration, durationMs: duration };
  }

  // Cas pompiers ou autre
  if (mission.type?.startsWith("rare_") || reward > 20000) {
    xp = randBetween(30, 40);
    reward = randBetween(25000, 60000);
    minLevel = 8;
    duration = randBetween(15000, 25000) * 3;
  } else if (nbVehicules === 1) {
    const vt = mission.vehicles[0].type;

    if (vt === "VSAV") {
      xp = randBetween(7, 10);
      reward = randBetween(2500, 3200);
      duration = 0; // volontaire
    } else {
      xp = randBetween(7, 10);
      reward = randBetween(2500, 3200);
      duration = randBetween(7000, 9000) * 3;
    }
  } else if (nbVehicules === 2) {
    xp = randBetween(12, 16);
    reward = randBetween(4000, 6000);
    minLevel = 3;
    duration = randBetween(7000, 9000) * 3;
  } else if (nbVehicules >= 3) {
    xp = randBetween(18, 25);
    reward = randBetween(7500, 14000);
    minLevel = 5;
    duration = randBetween(9000, 12000) * 3;
  }

  if (mission.duration && mission.duration > duration) {
    duration = mission.duration;
  }

  return {
    ...mission,
    minLevel,
    xp,
    reward,
    duration,
    durationMs: typeof duration === "number" ? duration : 0,
  };
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MISSION_TYPES = {
  caserne: [
    {
      type: "incendie_batiment",
      vehicles: [],
      variants: [
        {
          dialogue:
            "De la fumée s'échappe du troisième étage, des habitants font des signes à la fenêtre.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 1, max: 3 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
            { type: "EPA", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un incendie s’est déclenché dans une boutique d’un centre commercial, les clients évacuent en panique.",
          label: "Incendie dans un bâtiment",
          poiTags: ["shop", "mall", "commercial"],
          cycle: "jour",
          meteo: [],
          water: 10000,
          victimCount: { min: 1, max: 4 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "EPA", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un feu s'est déclaré dans un atelier de menuiserie, le propriétaire craint une propagation.",
          label: "Incendie dans un bâtiment",
          poiTags: ["craft", "industrial"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une maison fume intensément au niveau du salon, les voisins disent que quelqu’un est encore à l’intérieur.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "house", "residential"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
            { type: "EPA", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un feu s’est déclaré dans un garage attenant à une maison, il y aurait des bouteilles de gaz à l’intérieur.",
          label: "Incendie dans un bâtiment",
          poiTags: ["garage", "building", "residential"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
        {
          dialogue:
            "Un hôtel prend feu au petit matin, plusieurs clients sont à secourir.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "hotel", "residential"],
          cycle: "nuit",
          meteo: [],
          water: 10000,
          victimCount: { min: 2, max: 6 },
          vehicles: [
            { type: "FPT", nombre: 3 },
            { type: "CDG", nombre: 1 },
            { type: "EPA", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un important dégagement de fumée provient du dernier étage d’un immeuble, plusieurs personnes sont bloquées sur le balcon.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "apartments"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 2, max: 4 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
            { type: "EPA", nombre: 1 },
          ],
        },
      ],
    },
    {
      type: "incendie_vehicule",
      vehicles: [],
      variants: [
        {
          dialogue: "Une voiture brûle sur un parking, aucun blessé apparent.",
          label: "Incendie de véhicule",
          poiTags: ["amenity", "parking", "car"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
        {
          dialogue:
            "Un poids lourd est en feu sur la voie rapide, le chauffeur est sorti mais les flammes atteignent la cabine.",
          label: "Incendie de véhicule",
          poiTags: ["highway", "motorway"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "FPT", nombre: 1 },
            { type: "VSR", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une voiture brûle dans un parking souterrain, de la fumée épaisse s’échappe des bouches d’aération.",
          label: "Incendie de véhicule",
          poiTags: ["amenity", "parking", "underground"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un bus urbain s'est embrasé en pleine circulation, tous les passagers ont été évacués.",
          label: "Incendie de véhicule",
          poiTags: ["public_transport", "bus_stop"],
          cycle: "jour",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 2 },
          vehicles: [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
            { type: "EPA", nombre: 1 },
          ],
        },
      ],
    },

    {
      type: "incendie_exterieur",
      vehicles: [],
      variants: [
        {
          dialogue:
            "Un feu de broussailles est attisé par le vent et s’approche dangereusement d’un lotissement.",
          label: "Feu extérieur",
          poiTags: ["natural", "scrub", "residential"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
        {
          dialogue:
            "Un feu de broussailles menace un lotissement, les habitants arrosent leurs jardins.",
          label: "Feu extérieur",
          poiTags: ["natural", "scrub"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une benne à ordures brûle sur le trottoir devant un immeuble.",
          label: "Feu extérieur",
          poiTags: ["amenity", "waste_basket"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
        {
          dialogue:
            "Une benne à déchets industriels a pris feu en pleine rue, la chaleur menace les vitrines proches.",
          label: "Feu extérieur",
          poiTags: ["industrial", "shop"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
        {
          dialogue:
            "Un tracteur est la proie des flammes dans un champ, le propriétaire est sur place.",
          label: "Feu extérieur",
          poiTags: ["farmland", "agricultural", "natural"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT", nombre: 1 }],
        },
      ],
    },
    {
      type: "incendie_industriel",
      vehicles: [],
      variants: [
        {
          dialogue:
            "Un entrepôt industriel est totalement embrasé, des explosions sont entendues.",
          label: "Incendie industriel ou particulier",
          poiTags: ["industrial", "warehouse"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 2 },
          vehicles: [
            { type: "FPT", nombre: 3 },
            { type: "EPA", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un hangar agricole contenant du matériel et des animaux est en feu.",
          label: "Incendie industriel ou particulier",
          poiTags: ["farm", "agricultural", "barn"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un compteur électrique a explosé dans la cave, la fumée envahit l'escalier.",
          label: "Incendie industriel ou particulier",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une épaisse fumée sort d’un entrepôt industriel contenant des produits inflammables, le personnel est évacué.",
          label: "Incendie industriel ou particulier",
          poiTags: ["industrial", "warehouse", "hazardous"],
          cycle: "",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 3 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "EPA", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une friteuse a pris feu et les flammes se sont propagées au mobilier, le résident est sorti juste à temps.",
          label: "Incendie industriel ou particulier",
          poiTags: ["building", "residential", "kitchen"],
          cycle: "nuit",
          meteo: [],
          water: 10000,
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT", nombre: 2 },
            { type: "EPA", nombre: 1 },
            { type: "CDG", nombre: 1 },
          ],
        },
      ],
    },
  ],
  police: [],
};
