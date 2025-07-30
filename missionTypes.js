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
  // Exceptionnel/catastrophe
  if (mission.type.startsWith("rare_") || reward > 20000) {
    xp = Math.floor(Math.random() * 11) + 30;
    reward = Math.floor(Math.random() * 35001) + 25000;
    minLevel = 8;
    duration = (Math.floor(Math.random() * 10001) + 15000) * 3; // 45000–75000
  } else if (nbVehicules === 1) {
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
    minLevel = 3;
    duration = (Math.floor(Math.random() * 2001) + 7000) * 3; // 21000–27000
  } else if (nbVehicules >= 3) {
    xp = Math.floor(Math.random() * 8) + 18;
    reward = Math.floor(Math.random() * 6501) + 7500;
    minLevel = 5;
    duration = (Math.floor(Math.random() * 3001) + 9000) * 3; // 27000–36000
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
      type: "douleur_thoracique",
      variants: [
        {
          dialogue:
            "Mon mari dit qu’il a super mal à la poitrine, il transpire et il arrive plus à parler.",
          label: "Douleur thoracique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un collègue se tient la poitrine, il dit que ça lance jusque dans le bras gauche.",
          label: "Douleur thoracique",
          poiTags: ["office", "commercial", "building"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un homme est tombé au sol sur la place, il se tient la poitrine et a du mal à respirer.",
          label: "Douleur thoracique",
          poiTags: ["amenity", "square", "bench", "marketplace"],
          cycle: "jour",
          meteo: ["chaleur", "soleil"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Dans la salle de sport, un client est allongé, il a dit qu’il avait une douleur vive au torse.",
          label: "Douleur thoracique",
          poiTags: ["leisure", "sports_centre", "fitness_centre"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une femme vient d’appeler depuis son balcon, elle dit qu’elle a une pression forte dans la poitrine.",
          label: "Douleur thoracique",
          poiTags: ["building", "residential", "balcony"],
          cycle: "",
          meteo: ["pollution"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },
    {
      type: "urgence_chute_relevage",
      variants: [
        {
          dialogue:
            "Ma voisine est tombée dans l’escalier, elle dit qu’elle a super mal à la hanche.",
          label: "Chute",
          poiTags: ["building", "residential", "steps"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une dame âgée est tombée en marchant, elle se plaint de douleur à la hanche mais parle normalement.",
          label: "Chute",
          poiTags: ["highway", "footway", "residential"],
          cycle: "",
          meteo: ["pluie", "neige"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Mon fils est tombé du haut du toboggan, il pleure et dit qu’il peut plus bouger le bras.",
          label: "Chute",
          poiTags: ["leisure", "playground"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Ma mère âgée de 86 ans est tombée en se levant et reste au sol, elle ne semble pas blessée mais ne peut pas bouger.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Ma mère de 91 ans est tombée de son lit, elle n'a pas de blessure apparente mais ne peut pas se relever seule.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un enfant est tombé d’un muret et saigne abondamment du front, il est conscient mais en panique.",
          label: "Chute",
          poiTags: ["playground", "leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une personne âgée a chuté dans un escalier, suspicion de fracture.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Je me suis blessé à la cheville en descendant les escaliers, la douleur est intense.",
          label: "Chute",
          poiTags: ["building", "residential", "steps"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },

    {
      type: "malaise",
      variants: [
        {
          dialogue:
            "Une femme titube, elle est tombée sur le trottoir et ne parvient plus à se relever, elle semble confuse.",
          label: "Malaise",
          poiTags: ["highway", "footway", "place"],
          cycle: "",
          meteo: ["soleil", "chaleur", "pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un homme s’est allongé sur un banc, il dit qu’il ne se sent pas bien, ses amis sont inquiets.",
          label: "Malaise",
          poiTags: ["amenity", "bench", "highway"],
          cycle: "",
          meteo: ["chaleur", "pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une jeune femme semble désorientée dans un commerce, elle tient à peine debout.",
          label: "Malaise",
          poiTags: ["shop", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un client vient de s’écrouler sur une chaise, il dit qu’il se sent faible mais il parle encore.",
          label: "Malaise",
          poiTags: ["amenity", "restaurant", "cafe"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une personne âgée dit avoir des vertiges en sortant de la pharmacie, elle doit s'asseoir.",
          label: "Malaise",
          poiTags: ["shop", "pharmacy", "bench"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },

    {
      type: "detresse_respiratoire",
      vehicles: [{ type: "VSAV" }],
      variants: [
        {
          dialogue:
            "Un enfant a du mal à respirer, il devient bleu malgré la ventoline.",
          label: "Détresse respiratoire",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un homme asthmatique fait une crise dans le parc, il ne trouve plus sa ventoline.",
          label: "Détresse respiratoire",
          poiTags: ["leisure", "park"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une femme dit qu’elle étouffe dans son appartement, elle tousse et a du mal à parler.",
          label: "Détresse respiratoire",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un joggeur est assis au sol, il dit qu’il n’arrive plus à reprendre son souffle.",
          label: "Détresse respiratoire",
          poiTags: ["leisure", "sports_centre", "footway"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un adolescent est pris de panique et halète bruyamment dans la cour du lycée.",
          label: "Détresse respiratoire",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [], // CORRECTION : pas de météo ici
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },

    {
      type: "detresse_neurologique",
      vehicles: [{ type: "VSAV" }],
      variants: [
        {
          dialogue:
            "Mon père ne parle plus normalement et ne peut plus bouger son bras droit.",
          label: "Détresse neurologique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un homme fait une crise dans le parc, il convulse au sol !",
          label: "Détresse neurologique",
          poiTags: ["leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un élève est tombé en classe, il tremble de tout son corps !",
          label: "Détresse neurologique",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un jeune homme fait des gestes incohérents, il semble désorienté et tremble.",
          label: "Détresse neurologique",
          poiTags: ["highway", "footway", "place"],
          cycle: "",
          meteo: ["soleil", "brouillard"], // conditions pouvant aggraver désorientation
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une femme a perdu connaissance après s’être mise à trembler violemment.",
          label: "Détresse neurologique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },

    {
      type: "douleurs_abdominales",
      vehicles: [{ type: "VSAV" }],
      variants: [
        {
          dialogue:
            "Ma fille a super mal au ventre et vomit depuis ce matin, elle tient plus debout.",
          label: "Douleurs abdominales",
          poiTags: ["building", "residential", "school"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une personne se tord de douleur au ventre sur le trottoir, elle gémit sans arrêt.",
          label: "Douleurs abdominales",
          poiTags: ["highway", "footway", "amenity", "bench"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Plusieurs personnes vomissent après un repas au restaurant, ça devient inquiétant.",
          label: "Douleurs abdominales",
          poiTags: ["amenity", "restaurant", "fast_food", "cafe"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 2, max: 3 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Des enfants de l’école ont mal au ventre après avoir mangé à la cantine.",
          label: "Douleurs abdominales",
          poiTags: ["amenity", "school", "canteen"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },
    {
      type: "urgence_blessures_traumatiques",
      vehicles: [{ type: "VSAV" }],
      variants: [
        {
          dialogue:
            "Un enfant est tombé d’un muret et saigne abondamment du front, il est conscient mais en panique.",
          label: "Blessure ou traumatisme",
          poiTags: ["playground", "leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un bricoleur s’est profondément coupé la main avec une scie, il perd du sang.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "residential"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un ouvrier s’est blessé avec une disqueuse, il saigne beaucoup de l’avant-bras.",
          label: "Blessure ou traumatisme",
          poiTags: ["landuse", "construction", "industrial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Mon fils est tombé du toboggan, il pleure et dit qu’il a mal à l’épaule.",
          label: "Blessure ou traumatisme",
          poiTags: ["leisure", "playground"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Je me suis blessé à la cheville en descendant les escaliers, la douleur est intense.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "residential", "steps"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une dame âgée est tombée dans la salle de bain, elle n’arrive pas à se relever.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une personne s’est blessée en glissant sur une flaque dans un hall d’immeuble.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "entrance", "residential"],
          cycle: "",
          meteo: ["pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un élève s’est coupé profondément en manipulant du matériel pendant le cours de techno.",
          label: "Blessure ou traumatisme",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un agent de maintenance s’est coincé le doigt dans une porte coupe-feu.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "industrial"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un homme s’est entaillé la jambe en jardinant avec une débroussailleuse.",
          label: "Blessure ou traumatisme",
          poiTags: ["landuse", "residential", "garden"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une femme s’est tordue la cheville dans un escalier de la mairie.",
          label: "Blessure ou traumatisme",
          poiTags: ["building", "amenity", "public"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un cuisinier s’est brûlé avec de l’huile chaude, il crie de douleur.",
          label: "Blessure ou traumatisme",
          poiTags: ["amenity", "restaurant", "kitchen"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un ado est tombé sur un plot en béton et s’est ouvert le genou.",
          label: "Blessure ou traumatisme",
          poiTags: ["leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une personne s’est prise une étagère sur la tête dans un local d’archives.",
          label: "Blessure ou traumatisme",
          poiTags: ["office", "building", "archive"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un bénévole s’est cogné violemment à un poteau métallique en montant une scène.",
          label: "Blessure ou traumatisme",
          poiTags: ["leisure", "event_venue", "public"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
      ],
    },

    {
      type: "accident_routier",
      vehicles: [],
      variants: [
        {
          dialogue:
            "Un carambolage impliquant quatre voitures a eu lieu, plusieurs blessés sont étendus sur la chaussée.",
          label: "Accident de la route",
          poiTags: ["highway", "primary", "secondary"],
          cycle: "",
          meteo: [],
          victimCount: { min: 3, max: 6 },
          vehicles: [{ type: "VSR" }, { type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un enfant a été renversé par une voiture en sortant de l’école, il est au sol et ne bouge plus.",
          label: "Accident de la route",
          poiTags: ["amenity", "school", "crossing"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un jeune conducteur de scooter gît au sol après avoir percuté une voiture à un stop, son casque est fendu.",
          label: "Accident de la route",
          poiTags: ["highway", "residential", "stop"],
          cycle: "",
          meteo: ["pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une voiture s’est encastrée dans un arbre, le conducteur est coincé dans l’habitacle et ne répond pas.",
          label: "Accident de la route",
          poiTags: ["natural", "tree", "highway"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Un bus s’est renversé sur une route de campagne, plusieurs passagers sont blessés, certains crient de douleur.",
          label: "Accident de la route",
          poiTags: ["highway", "bus_stop", "rural"],
          cycle: "",
          meteo: [],
          victimCount: { min: 4, max: 10 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Deux voitures sont entrées en collision frontale, les airbags ont explosé, il y a des blessés à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["highway", "residential", "crossing"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Un motard a glissé sur une route mouillée et semble inconscient, sa moto est en travers de la route.",
          label: "Accident de la route",
          poiTags: ["highway", "residential", "cycleway"],
          cycle: "",
          meteo: ["pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un poids lourd s’est couché sur le flanc dans un rond-point, le chauffeur semble bloqué à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["highway", "roundabout"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Un cycliste a été projeté au sol lorsqu’une portière s’est ouverte brusquement devant lui, il saigne du visage.",
          label: "Accident de la route",
          poiTags: ["cycleway", "highway", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une voiture est restée coincée sur un passage à niveau, le train l’a percutée, plusieurs blessés graves.",
          label: "Accident de la route",
          poiTags: ["railway", "crossing"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Un piéton a été fauché sur un passage piéton, il saigne de la tête et ne répond pas.",
          label: "Accident de la route",
          poiTags: ["highway", "crossing", "footway"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un cycliste a été percuté par une voiture en sortant d’un parking, il ne peut plus bouger sa jambe.",
          label: "Accident de la route",
          poiTags: ["cycleway", "highway", "parking"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une voiture a terminé sa course dans un mur après une perte de contrôle, le conducteur est blessé.",
          label: "Accident de la route",
          poiTags: ["highway", "residential", "building"],
          cycle: "",
          meteo: ["pluie", "brouillard"],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSR" }, { type: "VSAV" }],
        },
        {
          dialogue:
            "Un bus a freiné brusquement, plusieurs passagers sont tombés et blessés à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["public_transport", "bus_stop"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 2, max: 5 },
          vehicles: [{ type: "VSAV" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture a pris feu après un accident, une personne serait encore à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["highway", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "FPT" }, { type: "VSR" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture a foncé dans un abribus, plusieurs personnes sont au sol.",
          label: "Accident de la route",
          poiTags: ["highway", "amenity", "public_transport"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [{ type: "VSAV" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un accident entre deux véhicules bloque complètement un carrefour, des blessés légers sont signalés.",
          label: "Accident de la route",
          poiTags: ["highway", "junction", "residential"],
          cycle: "",
          meteo: ["pluie", "brouillard"],
          victimCount: { min: 1, max: 3 },
          vehicles: [{ type: "VSAV" }, { type: "VSR" }],
        },
        {
          dialogue:
            "Une voiture a percuté une terrasse de café, plusieurs clients sont blessés.",
          label: "Accident de la route",
          poiTags: ["amenity", "cafe", "restaurant"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 2, max: 5 },
          vehicles: [{ type: "VSAV" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un accident avec un véhicule utilitaire transportant du matériel lourd, risque de blessure par écrasement.",
          label: "Accident de la route",
          poiTags: ["highway", "industrial"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture a terminé sa course dans une vitrine de magasin, un employé est blessé à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["shop", "retail", "commercial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture a percuté un pylône électrique, des fils sont tombés au sol et le conducteur ne bouge plus.",
          label: "Accident de la route",
          poiTags: ["highway", "residential", "power"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Un piéton a été fauché sur un passage piéton, il est inconscient et saigne abondamment.",
          label: "Accident de la route",
          poiTags: ["highway", "crossing"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Un minibus transportant des enfants a percuté un mur, plusieurs blessés sont à l’intérieur.",
          label: "Accident de la route",
          poiTags: ["highway", "school"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 3, max: 5 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Une voiture est sortie de route et s’est retournée dans un fossé, deux passagers sont bloqués.",
          label: "Accident de la route",
          poiTags: ["highway", "rural"],
          cycle: "",
          meteo: ["pluie", "brouillard"],
          victimCount: { min: 2, max: 2 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un piéton a été renversé sur un parking de supermarché, il gémit de douleur au sol.",
          label: "Accident de la route",
          poiTags: ["shop", "parking", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }],
        },
        {
          dialogue:
            "Une voiture a percuté une façade de magasin, il y a des blessés à l’intérieur et à l’extérieur.",
          label: "Accident de la route",
          poiTags: ["shop", "commercial"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 3 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "FPT" }],
        },
        {
          dialogue:
            "Une moto et un camion sont entrés en collision, le motard est gravement blessé.",
          label: "Accident de la route",
          poiTags: ["highway", "primary"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un piéton a été percuté par un bus en centre-ville, il est coincé sous le véhicule.",
          label: "Accident de la route",
          poiTags: ["highway", "bus_stop", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSR" }, { type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un véhicule a fait plusieurs tonneaux sur la voie rapide, les secours sont difficiles à atteindre.",
          label: "Accident de la route",
          poiTags: ["highway", "motorway"],
          cycle: "",
          meteo: ["brouillard", "pluie"],
          victimCount: { min: 1, max: 3 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture s’est encastrée dans un abribus, des passants sont blessés.",
          label: "Accident de la route",
          poiTags: ["highway", "amenity", "shelter"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [{ type: "VSR" }, { type: "CDG" }, { type: "VSAV" }],
        },
      ],
    },
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
          victimCount: { min: 1, max: 3 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Un incendie s’est déclenché dans une boutique d’un centre commercial, les clients évacuent en panique.",
          label: "Incendie dans un bâtiment",
          poiTags: ["shop", "mall", "commercial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 4 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "EPA" },
            { type: "CDG" },
          ],
        },
        {
          dialogue:
            "Un feu s'est déclaré dans un atelier de menuiserie, le propriétaire craint une propagation.",
          label: "Incendie dans un bâtiment",
          poiTags: ["craft", "industrial"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une maison fume intensément au niveau du salon, les voisins disent que quelqu’un est encore à l’intérieur.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "house", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Un feu s’est déclaré dans un garage attenant à une maison, il y aurait des bouteilles de gaz à l’intérieur.",
          label: "Incendie dans un bâtiment",
          poiTags: ["garage", "building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }],
        },
        {
          dialogue:
            "Un hôtel prend feu au petit matin, plusieurs clients sont à secourir.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "hotel", "residential"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 2, max: 6 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Un important dégagement de fumée provient du dernier étage d’un immeuble, plusieurs personnes sont bloquées sur le balcon.",
          label: "Incendie dans un bâtiment",
          poiTags: ["building", "apartments"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 4 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "EPA" },
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
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT" }],
        },
        {
          dialogue:
            "Un poids lourd est en feu sur la voie rapide, le chauffeur est sorti mais les flammes atteignent la cabine.",
          label: "Incendie de véhicule",
          poiTags: ["highway", "motorway"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "FPT" }, { type: "VSR" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une voiture brûle dans un parking souterrain, de la fumée épaisse s’échappe des bouches d’aération.",
          label: "Incendie de véhicule",
          poiTags: ["amenity", "parking", "underground"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un bus urbain s'est embrasé en pleine circulation, tous les passagers ont été évacués.",
          label: "Incendie de véhicule",
          poiTags: ["public_transport", "bus_stop"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 0, max: 2 },
          vehicles: [{ type: "FPT" }, { type: "CDG" }, { type: "EPA" }],
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
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }],
        },
        {
          dialogue:
            "Un feu de broussailles menace un lotissement, les habitants arrosent leurs jardins.",
          label: "Feu extérieur",
          poiTags: ["natural", "scrub"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une benne à ordures brûle sur le trottoir devant un immeuble.",
          label: "Feu extérieur",
          poiTags: ["amenity", "waste_basket"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT" }],
        },
        {
          dialogue:
            "Une benne à déchets industriels a pris feu en pleine rue, la chaleur menace les vitrines proches.",
          label: "Feu extérieur",
          poiTags: ["industrial", "shop"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 0 },
          vehicles: [{ type: "FPT" }],
        },
        {
          dialogue:
            "Un tracteur est la proie des flammes dans un champ, le propriétaire est sur place.",
          label: "Feu extérieur",
          poiTags: ["farmland", "agricultural", "natural"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }],
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
          victimCount: { min: 0, max: 2 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "FPT" },
            { type: "EPA" },
            { type: "CDG" },
          ],
        },
        {
          dialogue:
            "Un hangar agricole contenant du matériel et des animaux est en feu.",
          label: "Incendie industriel ou particulier",
          poiTags: ["farm", "agricultural", "barn"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Un compteur électrique a explosé dans la cave, la fumée envahit l'escalier.",
          label: "Incendie industriel ou particulier",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [{ type: "FPT" }, { type: "CDG" }],
        },
        {
          dialogue:
            "Une épaisse fumée sort d’un entrepôt industriel contenant des produits inflammables, le personnel est évacué.",
          label: "Incendie industriel ou particulier",
          poiTags: ["industrial", "warehouse", "hazardous"],
          cycle: "",
          meteo: [],
          victimCount: { min: 0, max: 3 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "EPA" },
            { type: "CDG" },
          ],
        },
        {
          dialogue:
            "Une friteuse a pris feu et les flammes se sont propagées au mobilier, le résident est sorti juste à temps.",
          label: "Incendie industriel ou particulier",
          poiTags: ["building", "residential", "kitchen"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 0, max: 1 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "EPA" },
            { type: "CDG" },
          ],
        },
      ],
    },

    {
      type: "rare_intervention",
      vehicles: [],
      variants: [
        {
          dialogue:
            "Un immeuble s’est effondré en centre-ville, de nombreuses victimes pourraient être ensevelies.",
          label: "Situation exceptionnelle",
          poiTags: ["building", "apartments", "residential", "commercial"],
          cycle: "",
          meteo: ["pluie", "neige", "orageux"],
          victimCount: { min: 3, max: 12 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "VSR" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Une violente explosion s’est produite dans un immeuble, la rue est couverte de débris.",
          label: "Situation exceptionnelle",
          poiTags: ["building", "residential", "commercial"],
          cycle: "",
          meteo: [],
          victimCount: { min: 2, max: 8 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "VSR" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Un car scolaire s’est renversé, de nombreux enfants sont blessés, plan rouge déclenché.",
          label: "Situation exceptionnelle",
          poiTags: ["highway", "bus_stop", "school"],
          cycle: "jour",
          meteo: ["pluie", "brouillard", "neige"],
          victimCount: { min: 8, max: 25 },
          vehicles: [
            { type: "FPT" },
            { type: "FPT" },
            { type: "CDG" },
            { type: "VSR" },
            { type: "EPA" },
          ],
        },
        {
          dialogue:
            "Un camion transportant des produits toxiques s’est renversé, fuite de produits sur la chaussée.",
          label: "Situation exceptionnelle",
          poiTags: ["highway", "industrial", "landuse"],
          cycle: "",
          meteo: ["pluie", "brouillard"],
          victimCount: { min: 0, max: 2 },
          vehicles: [{ type: "FPT" }, { type: "FPT" }, { type: "CDG" }],
        },
      ],
    },
  ],
  police: [],
};
