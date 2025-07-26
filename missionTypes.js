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
  const nbVehicules = mission.vehicles.length;
  let minLevel = 1,
    xp = 7,
    reward = 2500,
    duration = 0;
  // Police => jamais de duration à 0
  if (realType === "police") {
    duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000 par défaut
    if (nbVehicules === 1) {
      xp = Math.floor(Math.random() * 4) + 7;
      reward = Math.floor(Math.random() * 701) + 2500;
      minLevel = 1;
    } else if (nbVehicules === 2) {
      xp = Math.floor(Math.random() * 5) + 12;
      reward = Math.floor(Math.random() * 2001) + 4000;
      minLevel = 3;
      duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000
    } else if (nbVehicules >= 3) {
      xp = Math.floor(Math.random() * 8) + 18;
      reward = Math.floor(Math.random() * 6501) + 7500;
      minLevel = 5;
      duration = (Math.floor(Math.random() * 3001) + 9000) * 3; // 27000–36000
    }
    // Exceptionnel/catastrophe police (si tu en as)
    if (mission.type.startsWith("rare_") || reward > 20000) {
      xp = Math.floor(Math.random() * 11) + 30;
      reward = Math.floor(Math.random() * 35001) + 25000;
      minLevel = 8;
      duration = (Math.floor(Math.random() * 10001) + 15000) * 3; // 45000–75000+
    }
    return { ...mission, minLevel, xp, reward, duration, durationMs: duration };
  }
  // POMPIERS & AUTRES
  if (nbVehicules === 1) {
    const vt = mission.vehicles[0].type;
    if (vt === "VSAV") {
      // VSAV seul
      xp = Math.floor(Math.random() * 4) + 7;
      reward = Math.floor(Math.random() * 701) + 2500;
      minLevel = 1;
      duration = 0;
    } else if (vt === "FPT") {
      // FPT seul
      xp = Math.floor(Math.random() * 4) + 7;
      reward = Math.floor(Math.random() * 701) + 2500;
      minLevel = 1;
      duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000
    } else {
      // Autre véhicule seul (par exemple CDG ou EPA) — tu peux ajuster ici si besoin
      xp = Math.floor(Math.random() * 4) + 7;
      reward = Math.floor(Math.random() * 701) + 2500;
      minLevel = 1;
      duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000
    }
  } else if (nbVehicules === 2) {
    xp = Math.floor(Math.random() * 5) + 12;
    reward = Math.floor(Math.random() * 2001) + 4000;
    minLevel = 1;
    duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000
  } else if (nbVehicules >= 3) {
    xp = Math.floor(Math.random() * 8) + 18;
    reward = Math.floor(Math.random() * 6501) + 7500;
    minLevel = 1;
    duration = (Math.floor(Math.random() * 3001) + 9000) * 3; // 27000–36000
  }
  // Exceptionnel/catastrophe
  if (mission.type.startsWith("rare_") || reward > 20000) {
    xp = Math.floor(Math.random() * 11) + 30;
    reward = Math.floor(Math.random() * 35001) + 25000;
    minLevel = 1;
    duration = (Math.floor(Math.random() * 10001) + 15000) * 3; // 45000–75000
  }
  // Si la mission avait déjà une duration > à la durée max, tu gardes celle du scénario
  if (mission.duration && mission.duration > duration) {
    duration = mission.duration;
  }
  return {
    ...mission,
    minLevel,
    xp,
    reward,
    duration,
    durationMs: typeof duration === "number" && duration >= 0 ? duration : 0,
  };
}

const MISSION_TYPES = {
  caserne: [
    {
      type: "urgence_medicale_20",
      label: "Chute dans la rue sans blessure grave",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une dame âgée est tombée en marchant, elle se plaint de douleur à la hanche mais parle normalement.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "footway", "residential"],
    },
    {
      type: "urgence_medicale_21",
      label: "Malaise sur la voie publique",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un homme s’est allongé sur un banc, il dit qu’il ne se sent pas bien, ses amis sont inquiets.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["amenity", "bench", "highway"],
    },
    {
      type: "urgence_medicale_22",
      label: "Crise d’angoisse dans un commerce",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une jeune femme ne parvient plus à respirer, elle panique, le gérant appelle les secours.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["shop"],
    },
    {
      type: "urgence_medicale_23",
      label: "Épistaxis abondant (saignement de nez)",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un adolescent a un saignement de nez qui ne s’arrête pas malgré plusieurs tentatives.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["school", "leisure", "park", "residential"],
    },
    {
      type: "urgence_medicale_24",
      label: "Douleurs abdominales aiguës",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne se tord de douleur au ventre sur le trottoir, elle a du mal à expliquer ce qui se passe.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "footway", "amenity", "bench"],
    },
    {
      type: "urgence_medicale_25",
      label: "Plaie saignante après coupure",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un bricoleur s’est profondément coupé la main avec une scie, il perd du sang.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"],
    },
    {
      type: "urgence_medicale_26",
      label: "Fièvre élevée enfant",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un enfant de 2 ans présente une forte fièvre, la crèche appelle car il a convulsé.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["amenity", "kindergarten", "school"],
    },
    {
      type: "urgence_medicale_27",
      label: "Crise d’asthme légère",
      vehicles: [{ type: "VSAV" }],
      dialogue: "Un adolescent a du mal à respirer, il a oublié sa ventoline.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["school", "residential", "leisure", "park"],
    },
    {
      type: "urgence_medicale_28",
      label: "Forte douleur lombaire",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne souffre d’une lombalgie aiguë, ne peut plus se relever dans son jardin.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"],
    },
    {
      type: "urgence_medicale_29",
      label: "Intoxication alimentaire en restaurant",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Plusieurs personnes vomissent après un repas, le restaurateur appelle les secours.",
      victimCount: { min: 2, max: 3 },
      poiTags: ["amenity", "restaurant", "fast_food", "cafe"],
    },
    {
      type: "urgence_medicale_30",
      label: "Allergie alimentaire sévère",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un homme fait un œdème de Quincke après avoir mangé des cacahuètes.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["amenity", "restaurant", "cafe", "school", "shop"],
    },
    {
      type: "urgence_medicale_31",
      label: "Perte de connaissance sur la voie publique",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un passant s'est effondré subitement, il est inconscient aidez nous.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "footway", "place", "bench"],
    },
    {
      type: "urgence_medicale_32",
      label: "Chute dans les escaliers (blessure grave)",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne âgée a chuté dans un escalier, suspicion de fracture.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"],
    },
    {
      type: "urgence_medicale_33",
      label: "Tentative de suicide",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne a absorbé un grand nombre de médicaments, inconsciente.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"],
    },
    {
      type: "urgence_medicale_34",
      label: "ACR sur voie publique",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne a fait un arrêt cardiaque sur la place du marché, massage cardiaque en cours.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["amenity", "marketplace", "square", "bench"],
    },
    {
      type: "rare_01",
      label: "Effondrement d’immeuble",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "VSR" },
        { type: "EPA" },
      ],
      dialogue:
        "Un immeuble s’est effondré en centre-ville, de nombreuses victimes pourraient être ensevelies.",
      victimCount: { min: 3, max: 12 },
      poiTags: ["building", "apartments", "residential", "commercial"],
    },
    {
      type: "rare_02",
      label: "Explosion de gaz",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "VSR" },
        { type: "EPA" },
      ],
      dialogue:
        "Une violente explosion s’est produite dans un immeuble, la rue est couverte de débris.",
      victimCount: { min: 2, max: 8 },
      poiTags: ["building", "residential", "commercial"],
    },

    {
      type: "rare_03",
      label: "Plan rouge – accident de car scolaire",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "VSR" },
        { type: "EPA" },
      ],
      dialogue:
        "Un car scolaire s’est renversé, de nombreux enfants sont blessés, plan rouge déclenché.",
      victimCount: { min: 8, max: 25 },
      poiTags: ["highway", "bus_stop", "school"],
    },
    {
      type: "rare_04",
      label: "Électrisation chantier",
      vehicles: [{ type: "FPT" }, { type: "CDG" }, { type: "VSR" }],
      dialogue:
        "Un ouvrier s’est électrisé sur un chantier, il est inconscient.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["landuse", "construction", "industrial"],
    },
    {
      type: "rare_05",
      label: "Accident de matières dangereuses",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un camion transportant des produits toxiques s’est renversé, fuite de produits sur la chaussée.",
      victimCount: { min: 0, max: 2 },
      poiTags: ["highway", "industrial", "landuse"],
    },
    {
      type: "secdiv_01",
      label: "Sauvetage d'animal en hauteur",
      vehicles: [{ type: "FPT" }, { type: "EPA" }],
      dialogue: "Un chat ne peut plus redescendre d’un arbre depuis 2 jours.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["natural", "tree", "park"],
    },
    {
      type: "secdiv_02",
      label: "Récupération d'objet dangereux sur voie publique",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Une bouteille suspecte traîne devant une école, le signalement est urgent.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["highway", "school", "footway"],
    },
    {
      type: "secdiv_03",
      label: "Fuite d’eau dans immeuble",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "L'eau coule du plafond d’un appartement, la fuite semble importante.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "apartments", "residential"],
    },
    {
      type: "secdiv_04",
      label: "Personne coincée ascenseur (aucun blessé)",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Une personne est bloquée seule dans un ascenseur, elle ne présente pas de détresse.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "apartments", "residential"],
    },
    {
      type: "secdiv_05",
      label: "Secours à personne légère sur lieu public",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne a eu un léger malaise lors d'un marché, elle se relève.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["marketplace", "amenity", "bench", "square"],
    },

    // --- INTERVENTIONS DIVERSES ---
    {
      type: "div_01",
      label: "Ouverture de porte",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Une personne âgée n'ouvre plus sa porte, la famille est inquiète.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "residential"],
    },
    {
      type: "div_02",
      label: "Ascenseur bloqué",
      vehicles: [{ type: "FPT" }],
      dialogue: "Plusieurs personnes sont bloquées dans un ascenseur en panne.",
      victimCount: { min: 0, max: 2 },
      poiTags: ["building", "apartments"],
    },
    {
      type: "div_04",
      label: "Nettoyage chaussée (hydrocarbure)",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Une grande flaque d’huile bloque une voie, la circulation est perturbée.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["highway"],
    },
    {
      type: "div_05",
      label: "Dégagement d’arbre sur chaussée",
      vehicles: [{ type: "FPT" }],
      dialogue: "Un arbre tombé bloque une petite route après un coup de vent.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["natural", "tree", "highway"],
    },
    {
      type: "spe_01",
      label: "Sauvetage en rivière",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une personne est tombée dans la rivière, la crue complique les opérations de sauvetage.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["waterway", "river"],
    },
    {
      type: "spe_02",
      label: "Sauvetage animalier dangereux",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Un chien est tombé dans un puits profond, la famille est paniquée.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["man_made", "well", "garden"],
    },
    {
      type: "spe_03",
      label: "Inondation de sous-sol",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Le sous-sol d'une maison est totalement inondé suite à de fortes pluies.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "residential"],
    },
    {
      type: "spe_04",
      label: "Dégagement de personne coincée sous gravats",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue: "Un ouvrier est bloqué sous des gravats sur un chantier.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["landuse", "construction"],
    },
    {
      type: "spe_05",
      label: "Sauvetage en hauteur",
      vehicles: [{ type: "FPT" }, { type: "EPA" }, { type: "CDG" }],
      dialogue: "Un enfant s'est retrouvé bloqué sur une grue de chantier.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["man_made", "crane", "construction"],
    },

    // --- RISQUES TECHNOLOGIQUES ---
    {
      type: "gaz_01",
      label: "Fuite de gaz - procédure courante",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une forte odeur de gaz est détectée dans la rue, le réseau a été coupé.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["highway", "pipeline"],
    },
    {
      type: "gaz_02",
      label: "Fuite de gaz - procédure renforcée",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une fuite importante est signalée près d’un immeuble d’habitation, l’évacuation est en cours.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["building", "residential"],
    },
    {
      type: "gaz_03",
      label: "Fuite de produit chimique",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un fût contenant un produit dangereux s’est percé dans un local industriel.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["landuse", "industrial"],
    },
    {
      type: "gaz_04",
      label: "Pollution aquatique",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une nappe d’huile flotte à la surface d’un étang, un barrage de fortune a été mis en place.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["natural", "water", "waterway"],
    },
    {
      type: "inc_01",
      label: "Feu d'appartement",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "EPA" },
      ],
      dialogue:
        "De la fumée s'échappe du troisième étage, des habitants font des signes à la fenêtre.",
      victimCount: { min: 1, max: 3 },
      poiTags: ["building", "apartments"],
    },
    {
      type: "inc_02",
      label: "Feu d'atelier ou local artisanal",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un feu s'est déclaré dans un atelier de menuiserie, le propriétaire craint une propagation.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["craft", "workshop", "building"],
    },
    {
      type: "inc_03",
      label: "Feu d'entrepôt industriel",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "FPT" },
        { type: "EPA" },
        { type: "CDG" },
      ],
      dialogue:
        "Un entrepôt industriel est totalement embrasé, des explosions sont entendues.",
      victimCount: { min: 0, max: 2 },
      poiTags: ["building", "warehouse", "industrial"],
    },
    {
      type: "inc_04",
      label: "Feu d'exploitation agricole",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un hangar agricole contenant du matériel et des animaux est en feu.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["farmyard", "building", "agricultural"],
    },
    {
      type: "inc_05",
      label: "Feu d'origine électrique",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un compteur électrique a explosé dans la cave, la fumée envahit l'escalier.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["building", "substation", "power"],
    },
    {
      type: "inc_06",
      label: "Feu de camion / bus",
      vehicles: [{ type: "FPT" }, { type: "CDG" }, { type: "EPA" }],
      dialogue:
        "Un bus urbain s'est embrasé en pleine circulation, tous les passagers ont été évacués.",
      victimCount: { min: 0, max: 2 },
      poiTags: ["highway", "bus_stop", "amenity"],
    },
    {
      type: "inc_07",
      label: "Feu de cheminée",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Des flammes sortent du conduit de cheminée, le propriétaire a éteint le feu dans l'âtre.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "residential"],
    },
    {
      type: "inc_08",
      label: "Feu de parking en sous-sol",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une épaisse fumée sort des bouches d'aération d'un parking souterrain, plusieurs véhicules brûlent.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["amenity", "parking", "underground"],
    },

    {
      type: "inc_10",
      label: "Feu d'engin agricole",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Un tracteur est la proie des flammes dans un champ, le propriétaire est sur place.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["landuse", "farmland", "agricultural"],
    },
    {
      type: "inc_12",
      label: "Feu ERP avec locaux à sommeil",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "EPA" },
      ],
      dialogue:
        "Un hôtel prend feu au petit matin, plusieurs clients sont à secourir.",
      victimCount: { min: 2, max: 6 },
      poiTags: ["tourism", "hotel"],
    },
    {
      type: "inc_13",
      label: "Feu de VL ou 2 roues",
      vehicles: [{ type: "FPT" }],
      dialogue: "Une voiture brûle sur un parking, aucun blessé apparent.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["amenity", "parking"],
    },
    {
      type: "inc_14",
      label: "Feu de benne à ordures",
      vehicles: [{ type: "FPT" }],
      dialogue: "Une benne à ordures brûle sur le trottoir devant un immeuble.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["building", "residential"],
    },
    {
      type: "inc_15",
      label: "Feu de végétation / broussailles",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un feu de broussailles menace un lotissement, les habitants arrosent leurs jardins.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["natural", "scrub", "landuse", "grass"],
    },
    {
      type: "incendie_0",
      label: "Feu de maison individuelle",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "EPA" },
      ],
      dialogue:
        "Une maison fume intensément au niveau du salon, les voisins disent que quelqu’un est encore à l’intérieur.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["building", "house"],
    },
    {
      type: "incendie_1",
      label: "Feu d’appartement au dernier étage",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "CDG" },
        { type: "EPA" },
      ],
      dialogue:
        "Un important dégagement de fumée provient du dernier étage d’un immeuble, plusieurs personnes sont bloquées sur le balcon.",
      victimCount: { min: 2, max: 4 },
      poiTags: ["building", "apartments"],
    },
    {
      type: "incendie_2",
      label: "Incendie dans un garage privé",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Un feu s’est déclaré dans un garage attenant à une maison, il y aurait des bouteilles de gaz à l’intérieur.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["building", "garage"],
    },
    {
      type: "incendie_3",
      label: "Feu de poids lourd sur autoroute",
      vehicles: [{ type: "FPT" }, { type: "VSR" }, { type: "CDG" }],
      dialogue:
        "Un poids lourd est en feu sur la voie rapide, le chauffeur est sorti mais les flammes atteignent la cabine.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["highway", "motorway"],
    },
    {
      type: "incendie_4",
      label: "Incendie dans un local industriel avec produits chimiques",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "EPA" },
        { type: "CDG" },
      ],
      dialogue:
        "Une épaisse fumée sort d’un entrepôt industriel contenant des produits inflammables, le personnel est évacué.",
      victimCount: { min: 0, max: 3 },
      poiTags: ["landuse", "industrial", "building", "warehouse"],
    },
    {
      type: "incendie_5",
      label: "Début d’incendie de cuisine dans un appartement",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "EPA" },
        { type: "CDG" },
      ],
      dialogue:
        "Une friteuse a pris feu et les flammes se sont propagées au mobilier, le résident est sorti juste à temps.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["building", "apartments"],
    },
    {
      type: "incendie_6",
      label: "Feu de broussailles menaçant des habitations",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Un feu de broussailles est attisé par le vent et s’approche dangereusement d’un lotissement.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["natural", "scrub"],
    },
    {
      type: "incendie_7",
      label: "Feu de véhicule sur parking souterrain",
      vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Une voiture brûle dans un parking souterrain, de la fumée épaisse s’échappe des bouches d’aération.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["amenity", "parking", "underground"],
    },
    {
      type: "incendie_8",
      label: "Feu de benne à ordures sur la voie publique",
      vehicles: [{ type: "FPT" }],
      dialogue:
        "Une benne à déchets industriels a pris feu en pleine rue, la chaleur menace les vitrines proches.",
      victimCount: { min: 0, max: 0 },
      poiTags: ["landuse", "commercial"],
    },
    {
      type: "incendie_9",
      label: "Incendie dans un centre commercial",
      vehicles: [
        { type: "FPT" },
        { type: "FPT" },
        { type: "EPA" },
        { type: "CDG" },
      ],
      dialogue:
        "Un incendie s’est déclenché dans une boutique d’un centre commercial, les clients évacuent en panique.",
      victimCount: { min: 1, max: 4 },
      poiTags: ["shop", "mall", "retail"],
    },

    // --- INTERVENTIONS VSAV SEUL, DURATION 0 ---
    {
      type: "urgence_medicale_10",
      label: "Crise d’épilepsie dans un parc",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un jeune homme convulse au sol dans un parc public, des passants tentent de le maintenir en sécurité.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["leisure", "park", "place"], // parcs publics
    },
    {
      type: "urgence_medicale_11",
      label: "Perte de connaissance dans un supermarché",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un homme s’est effondré sans raison au rayon surgelé, il ne réagit plus malgré les appels.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["shop", "supermarket"], // magasins alimentaires
    },
    {
      type: "urgence_medicale_12",
      label: "Femme enceinte avec douleurs intenses",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une femme enceinte de 8 mois ressent des douleurs abdominales violentes et a perdu du liquide amniotique.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"], // peut arriver à domicile
    },
    {
      type: "urgence_medicale_13",
      label: "Enfant avec forte fièvre et convulsions",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un enfant de 3 ans tremble de tout son corps, il a plus de 40°C de fièvre depuis ce matin.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"], // domicile
    },
    {
      type: "urgence_medicale_14",
      label: "Personne âgée tombée dans sa salle de bain",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Ma mère âgée de 86 ans est tombée en se levant et reste au sol, elle ne semble pas blessée mais ne peut pas bouger.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"], // logement
    },
    {
      type: "urgence_medicale_15",
      label: "Douleurs thoraciques dans un bureau",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un collègue se tient la poitrine et a du mal à respirer, il dit que la douleur s’étend à son bras gauche.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["office", "building", "commercial"], // bureaux
    },
    {
      type: "urgence_medicale_16",
      label: "Détresse respiratoire chez un asthmatique",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Mon fils asthmatique n’arrive plus à respirer correctement malgré sa ventoline, il devient bleu.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"], // domicile
    },
    {
      type: "urgence_medicale_17",
      label: "Troubles de la parole et paralysie soudaine",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Mon père a soudain du mal à parler et ne peut plus bouger son bras droit, cela ne fait que quelques minutes.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "residential"], // domicile
    },
    {
      type: "urgence_medicale_18",
      label: "Victime d'un malaise dans la rue",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une femme titube, elle est tombée sur le trottoir et ne parvient plus à se relever, elle semble confuse.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "footway", "place"], // voie publique, trottoir, place
    },
    {
      type: "urgence_medicale_19",
      label: "Saignement abondant après une chute",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un enfant est tombé d’un muret et saigne abondamment du front, il est conscient mais en panique.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["playground", "leisure", "park", "place"], // jeux, lieux publics
    },

    // --- ACCIDENTS ---
    {
      type: "accident_20",
      label: "Accident de la route avec plusieurs véhicules",
      vehicles: [{ type: "VSR" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un carambolage impliquant quatre voitures a eu lieu, plusieurs blessés sont étendus sur la chaussée.",
      victimCount: { min: 3, max: 6 },
      poiTags: ["highway", "junction", "motorway", "primary"], // grandes routes
    },
    {
      type: "accident_21",
      label: "Accident piéton devant une école",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un enfant a été renversé par une voiture en sortant de l’école, il est au sol et ne bouge plus.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["amenity", "school", "crossing"], // écoles + passages piétons
    },
    {
      type: "accident_22",
      label: "Scooter contre voiture à un croisement",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un jeune conducteur de scooter gît au sol après avoir percuté une voiture à un stop, son casque est fendu.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "junction", "stop", "traffic_signals"], // intersections
    },
    {
      type: "accident_23",
      label: "Voiture encastrée dans un arbre, victime coincée",
      vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
      dialogue:
        "Une voiture s’est encastrée dans un arbre, le conducteur est coincé dans l’habitacle et ne répond pas.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["natural", "wood", "tree", "highway"], // arbres / campagne
    },
    {
      type: "accident_24",
      label: "Accident de bus avec plusieurs passagers blessés",
      vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
      dialogue:
        "Un bus s’est renversé sur une route de campagne, plusieurs passagers sont blessés, certains crient de douleur.",
      victimCount: { min: 4, max: 10 },
      poiTags: ["route", "highway", "bus_stop"], // route + arrêt bus
    },
    {
      type: "accident_25",
      label: "Choc frontal entre deux véhicules",
      vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
      dialogue:
        "Deux voitures sont entrées en collision frontale, les airbags ont explosé, il y a des blessés à l’intérieur.",
      victimCount: { min: 2, max: 4 },
      poiTags: ["highway", "primary", "junction"], // grandes routes
    },
    {
      type: "accident_26",
      label: "Accident de moto avec glissade sur chaussée mouillée",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un motard a glissé sur une route mouillée et semble inconscient, sa moto est en travers de la route.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "residential", "secondary"], // routes normales
    },
    {
      type: "accident_27",
      label: "Camion renversé sur un rond-point",
      vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
      dialogue:
        "Un poids lourd s’est couché sur le flanc dans un rond-point, le chauffeur semble bloqué à l’intérieur.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["junction", "roundabout", "highway"], // rond-points
    },
    {
      type: "accident_28",
      label: "Vélo percuté par une portière de voiture",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un cycliste a été projeté au sol lorsqu’une portière s’est ouverte brusquement devant lui, il saigne du visage.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["cycleway", "highway", "parking"], // pistes cyclables, rues, stationnement
    },
    {
      type: "accident_29",
      label: "Accident de chantier : ouvrier blessé",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un ouvrier s’est fait renverser par une pelleteuse sur un chantier, il hurle de douleur et ne peut plus bouger la jambe.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["landuse", "construction", "industrial"], // zones de travaux
    },

    {
      type: "sap_01",
      label: "Personne âgée relevée au domicile",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Ma mère de 91 ans est tombée de son lit, elle n'a pas de blessure apparente mais ne peut pas se relever seule.",
      victimCount: { min: 1, max: 1 },
      // Aucun POI : intervention à domicile
    },
    {
      type: "sap_02",
      label: "Malaise sur la voie publique",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un homme est allongé sur le trottoir, il semble confus et transpire beaucoup.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "footway", "pedestrian"], // zones publiques piétonnes
    },
    {
      type: "sap_03",
      label: "Arrêt cardiaque dans un commerce",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un client ne respire plus et ne réagit plus malgré les gestes de secours.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["shop", "amenity"], // commerces
    },
    {
      type: "sap_04",
      label: "Blessé à domicile suite à une chute",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Je me suis blessé à la cheville en descendant les escaliers, la douleur est intense.",
      victimCount: { min: 1, max: 1 },
      // Pas de POI (domicile)
    },
    {
      type: "sap_05",
      label: "Blessure sportive",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un adolescent s’est blessé à la jambe lors d’un match de foot, il ne peut plus se relever.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["leisure", "pitch", "sports_centre", "stadium"], // terrains et centres sportifs
    },
    {
      type: "sap_06",
      label: "Défenestration",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne est tombée d’un balcon au 2ème étage, elle est gravement blessée.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "apartments", "residential"], // immeubles d’habitation
    },
    {
      type: "sap_07",
      label: "Intoxication alimentaire collective",
      vehicles: [{ type: "VSAV" }, { type: "VSAV" }],
      dialogue:
        "Plusieurs personnes présentent des vomissements après avoir mangé ensemble à la cantine.",
      victimCount: { min: 2, max: 4 },
      poiTags: ["amenity", "restaurant", "school", "canteen", "fast_food"], // lieux de repas
    },
    {
      type: "sap_08",
      label: "Electrocution",
      vehicles: [{ type: "VSAV" }],
      dialogue: "Mon collègue a touché un fil dénudé et ne réagit plus.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "industrial", "substation", "power"], // zones à risques électriques
    },
    {
      type: "sap_09",
      label: "Carence ambulance privée",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Aucune ambulance disponible pour ramener un patient à son domicile, il est allongé et ne peut pas se déplacer.",
      victimCount: { min: 1, max: 1 },
      // Pas de POI (souvent centre hospitalier ou domicile)
    },
    {
      type: "sap_10",
      label: "Pendaison",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un homme a tenté de se pendre dans son garage, il est inconscient mais respire encore.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building", "garage", "residential"], // lieu privé ou garage
    },

    {
      type: "avp_01",
      label: "Accident voiture contre arbre",
      vehicles: [{ type: "VSR" }, { type: "CDG" }],
      dialogue:
        "Une voiture s’est encastrée dans un arbre en sortie de virage, le conducteur est coincé à l’intérieur.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["natural", "wood", "highway"], // zones arborées ou routières
    },
    {
      type: "avp_03",
      label: "Accident de bus scolaire",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un bus transportant des enfants a quitté la route et s’est renversé, plusieurs blessés sont signalés.",
      victimCount: { min: 4, max: 12 },
      poiTags: ["highway", "school"], // zone scolaire ou route
    },
    {
      type: "avp_05",
      label: "Accident de train à un passage à niveau",
      vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
      dialogue:
        "Une voiture est restée coincée sur un passage à niveau, le train l’a percutée, plusieurs blessés graves.",
      victimCount: { min: 2, max: 4 },
      poiTags: ["railway", "level_crossing"], // passages à niveau
    },
    {
      type: "avp_06",
      label: "Collision PL/voiture - désincarcération",
      vehicles: [{ type: "VSR" }, { type: "CDG" }],
      dialogue:
        "Un poids lourd et une voiture se sont percutés à une intersection, un blessé coincé dans le véhicule léger.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["highway", "crossing", "traffic_signals"], // intersections urbaines
    },
    {
      type: "avp_08",
      label: "Accident de car scolaire avec feu",
      vehicles: [{ type: "FPT" }, { type: "CDG" }, { type: "EPA" }],
      dialogue:
        "Un car scolaire a pris feu après une collision, de nombreux enfants sont à évacuer et à prendre en charge.",
      victimCount: { min: 6, max: 20 },
      poiTags: ["highway", "school"], // routes proches d'écoles
    },
    {
      type: "avp_09",
      label: "Accident de camion sur autoroute",
      vehicles: [{ type: "VSR" }, { type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un camion s’est renversé sur l’autoroute, des bidons dangereux sont tombés sur la chaussée.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["highway", "motorway"], // autoroutes
    },
    {
      type: "avp_10",
      label: "Accident avion de tourisme en campagne",
      vehicles: [{ type: "FPT" }, { type: "CDG" }],
      dialogue:
        "Un petit avion s’est écrasé dans un champ, il y aurait des blessés dans la carcasse.",
      victimCount: { min: 1, max: 3 },
      poiTags: ["aeroway", "airstrip", "farmland", "meadow"], // petits aérodromes ou champs
    },
    {
      type: "avp_11",
      label: "Accident ferroviaire",
      vehicles: [
        { type: "FPT" },
        { type: "CDG" },
        { type: "VSR" },
        { type: "EPA" },
      ],
      dialogue:
        "Un train a déraillé en gare, plusieurs voyageurs sont blessés ou coincés dans les wagons.",
      victimCount: { min: 8, max: 18 },
      poiTags: ["railway", "station"], // gares
    },

    // Missions “simples” où le VSAV reste requis seul, sans duplication inutile
    {
      type: "avp_02",
      label: "Collision moto/voiture",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un motard est au sol après avoir percuté une voiture à une intersection, il se plaint de douleurs à la jambe.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "crossing", "traffic_signals"],
    },
    {
      type: "avp_04",
      label: "Accident de piéton sur passage protégé",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Une personne âgée a été renversée par une voiture alors qu’elle traversait sur un passage piéton.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway", "crossing"],
    },
    {
      type: "avp_07",
      label: "Accident de vélo en agglomération",
      vehicles: [{ type: "VSAV" }],
      dialogue:
        "Un cycliste a chuté lourdement après avoir été percuté par une portière, il saigne au visage.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["cycleway", "highway", "shop"],
    },
    {
      type: "accident_grave_route",
      label: "Accident grave sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }, { type: "VSR" }],
      dialogue:
        "Une collision violente entre deux véhicules vient d’avoir lieu, des blessés sont coincés et la circulation est bloquée.",
      victimCount: { min: 2, max: 4 },
      poiTags: ["highway"],
    },
    {
      type: "decouverte_corps",
      label: "Découverte de corps",
      vehicles: [{ type: "PATROUILLE" }, { type: "VSAV" }],
      dialogue:
        "Un promeneur a trouvé une personne inanimée dans un parc, le décès est probable.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["leisure", "park"],
    },
    {
      type: "incendie_vehicule_suspect",
      label: "Véhicule incendié suspect",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }],
      dialogue:
        "Un véhicule brûle en pleine nuit sur un parking, des individus suspects ont été vus s’enfuir.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["amenity", "parking"],
    },
    {
      type: "bagarre_blesses",
      label: "Bagarre avec blessés",
      vehicles: [{ type: "PATROUILLE" }, { type: "VSAV" }],
      dialogue:
        "Une rixe a éclaté devant un bar, plusieurs personnes sont au sol et l’une d’elles saigne abondamment.",
      victimCount: { min: 1, max: 2 },
      poiTags: ["amenity", "bar", "pub"],
    },
    {
      type: "suicide_voie_ferree",
      label: "Tentative de suicide sur voie ferrée",
      vehicles: [{ type: "PATROUILLE" }, { type: "VSAV" }],
      dialogue:
        "Un témoin a vu une personne descendre sur les rails et s’immobiliser à l’approche d’un train.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["railway", "station", "level_crossing"],
    },
    {
      type: "personne_coincee_ascenseur",
      label: "Personne coincée dans un ascenseur",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }],
      dialogue:
        "Un individu paniqué est coincé dans un ascenseur entre deux étages, il dit avoir des douleurs thoraciques.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["building"],
    },
    {
      type: "maladie_psy_rue",
      label: "Comportement dangereux sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }, { type: "VSAV" }],
      dialogue:
        "Une personne déambule au milieu de la route, tient des propos incohérents et menace de se jeter sous les voitures.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["highway"],
    },
    {
      type: "incendie_provoque",
      label: "Incendie probablement volontaire",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }, { type: "EPA" }],
      dialogue:
        "Un feu de conteneurs s’est propagé à une façade d’immeuble, des jeunes sont vus près des flammes.",
      victimCount: { min: 0, max: 1 },
      poiTags: ["building", "amenity", "recycling"],
    },
    {
      type: "enfant_ferme_vehicule",
      label: "Enfant enfermé dans un véhicule",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }],
      dialogue:
        "Un nourrisson est accidentellement resté enfermé dans une voiture en plein soleil, la mère panique.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["amenity", "parking"],
    },
    {
      type: "sauvetage_animalier_violent",
      label: "Animal dangereux en liberté",
      vehicles: [{ type: "PATROUILLE" }, { type: "FPT" }],
      dialogue:
        "Un chien agressif erre dans le quartier, il vient de mordre un passant.",
      victimCount: { min: 1, max: 1 },
      poiTags: ["residential", "park", "leisure"],
    },
  ],
  police: [
    {
      type: "violence_conjugale",
      label: "Suspicion de violence conjugale",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Des cris et des bruits de coups proviennent de l’appartement d’à côté, cela fait plusieurs minutes.",
    },
    {
      type: "disparition_majeur",
      label: "Disparition inquiétante adulte",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Mon collègue n’est jamais arrivé à son travail, sa voiture est encore devant chez lui.",
    },
    {
      type: "vol_a_larraché",
      label: "Vol à l’arraché sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Une femme s’est fait arracher son sac à main, le voleur est parti en courant vers le parc.",
    },
    {
      type: "degradation_biens",
      label: "Dégradations sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un groupe de jeunes casse des vitres d’abribus et tague les murs près de l’arrêt de bus.",
    },
    {
      type: "trafic_stupefiants",
      label: "Suspicion de trafic de stupéfiants",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Plusieurs échanges suspects se font près du parking, des individus cachent des sachets.",
    },
    {
      type: "ivresse_publique",
      label: "Ivresse manifeste sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un homme titube, crie et importune les passants à la sortie du métro.",
    },
    {
      type: "enfant_egare",
      label: "Enfant égaré",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Une petite fille pleure à l’entrée du centre commercial, elle dit avoir perdu ses parents.",
    },
    {
      type: "suicide_public",
      label: "Menace de suicide sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un homme est assis sur le rebord du pont et menace de sauter, des passants tentent de le calmer.",
    },
    {
      type: "conflit_voisinage",
      label: "Conflit de voisinage bruyant",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Deux voisins se crient dessus dans la cour, la situation risque de dégénérer.",
    },
    {
      type: "faux_monnayeur",
      label: "Usage de fausse monnaie",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un commerçant vient de recevoir un billet suspect, le client a pris la fuite.",
    },
    {
      type: "arrestation_musclee",
      label: "Arrestation avec opposition",
      vehicles: [{ type: "PATROUILLE" }, { type: "PATROUILLE" }],
      dialogue:
        "Un individu refuse de se laisser interpeller et se débat violemment, renforts demandés.",
    },
    {
      type: "agression_sexuelle",
      label: "Agression sexuelle signalée",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Une jeune femme affirme avoir été agressée dans une ruelle, elle est choquée.",
    },
    {
      type: "prise_otage",
      label: "Prise d’otage en cours",
      vehicles: [{ type: "PATROUILLE" }, { type: "PATROUILLE" }],
      dialogue:
        "Un individu armé retient plusieurs personnes à l’intérieur d’un bureau de tabac.",
    },
    {
      type: "incendie_vehicule",
      label: "Véhicule incendié retrouvé",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Une voiture brûlée a été découverte sur le parking de la résidence.",
    },
    {
      type: "accident_vehicule_police",
      label: "Accident impliquant un véhicule de police",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Une patrouille de police a été percutée par un autre véhicule lors d’une intervention.",
    },
    {
      type: "tapage_nocturne",
      label: "Tapage nocturne",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Des gens font la fête en pleine rue, ça crie et ça dérange tout le voisinage !",
    },
    {
      type: "vol_vehicule",
      label: "Vol de véhicule en cours",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Je viens de voir quelqu’un forcer une voiture, il est encore sur place !",
    },
    {
      type: "bagarre_rue",
      label: "Rixe sur la voie publique",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Deux groupes s'affrontent en pleine rue, c’est très violent et ça attire la foule !",
    },
    {
      type: "violation_domicile",
      label: "Intrusion dans une habitation",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Quelqu’un essaie de rentrer chez moi par effraction, il est déjà dans le jardin !",
    },
    {
      type: "fuite_suspect",
      label: "Fuite de suspect",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un individu vient de voler un sac et court dans la rue, on le suit à distance !",
    },
    {
      type: "braquage_magasin",
      label: "Braquage en cours dans un commerce",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un homme armé menace le caissier d’une supérette, il demande l’argent de la caisse !",
    },
    {
      type: "enlevement_signalement",
      label: "Signalement d’enlèvement",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un enfant vient d’être embarqué de force dans une voiture grise, la plaque est partiellement lisible.",
    },
    {
      type: "manifestation_non_autorisee",
      label: "Manifestation non autorisée",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un groupe bloque la circulation avec des pancartes, ils refusent de se disperser malgré les sommations.",
    },
    {
      type: "controle_alcool_route",
      label: "Conduite en état d’ivresse",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un conducteur roule en zigzag, il semble totalement ivre, il vient de percuter un plot.",
    },
    {
      type: "menace_arme",
      label: "Individu menaçant avec une arme",
      vehicles: [{ type: "PATROUILLE" }],
      dialogue:
        "Un homme brandit une arme sur la place centrale, il crie et semble désorienté.",
    },
  ],
};
