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
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une dame âgée est tombée en marchant, elle se plaint de douleur à la hanche mais parle normalement.",
          label: "Chute",
          poiTags: ["highway", "footway", "residential"],
          cycle: "",
          meteo: ["pluie", "neige"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Mon fils est tombé du haut du toboggan, il pleure et dit qu’il peut plus bouger le bras.",
          label: "Chute",
          poiTags: ["leisure", "playground"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Ma mère âgée de 86 ans est tombée en se levant et reste au sol, elle ne semble pas blessée mais ne peut pas bouger.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Ma mère de 91 ans est tombée de son lit, elle n'a pas de blessure apparente mais ne peut pas se relever seule.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un enfant est tombé d’un muret et saigne abondamment du front, il est conscient mais en panique.",
          label: "Chute",
          poiTags: ["playground", "leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une personne âgée a chuté dans un escalier, suspicion de fracture.",
          label: "Chute",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Je me suis blessé à la cheville en descendant les escaliers, la douleur est intense.",
          label: "Chute",
          poiTags: ["building", "residential", "steps"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme a glissé sur une plaque de verglas devant son immeuble, il s’est cogné la tête et reste au sol.",
          label: "Chute",
          poiTags: ["highway", "footway", "residential"],
          cycle: "jour",
          meteo: ["neige"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un ouvrier est tombé de son escabeau en peignant une façade, il se plaint du dos et ne veut plus bouger.",
          label: "Chute",
          poiTags: ["building", "residential", "construction"],
          cycle: "jour",
          meteo: ["soleil", "nuageux"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une personne âgée a trébuché en sortant d’un commerce, elle est consciente mais a une plaie au bras.",
          label: "Chute",
          poiTags: ["shop", "commercial", "highway", "footway"],
          cycle: "jour",
          meteo: ["pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un adolescent a chuté en skateboard sur la place, il s’est ouvert la lèvre et saigne beaucoup.",
          label: "Chute",
          poiTags: ["place", "leisure", "park"],
          cycle: "jour",
          meteo: ["soleil", "nuageux"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme enceinte a glissé dans un escalier de parking souterrain, elle se plaint du ventre et ne peut pas se relever.",
          label: "Chute",
          poiTags: ["building", "parking", "steps"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
      ],
    },
    {
      type: "detresse_respiratoire",
      variants: [
        {
          dialogue:
            "Un enfant a du mal à respirer, il devient bleu malgré la ventoline.",
          label: "Détresse respiratoire",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme asthmatique fait une crise dans le parc, il ne trouve plus sa ventoline.",
          label: "Détresse respiratoire",
          poiTags: ["leisure", "park"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme dit qu’elle étouffe dans son appartement, elle tousse et a du mal à parler.",
          label: "Détresse respiratoire",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un joggeur est assis au sol, il dit qu’il n’arrive plus à reprendre son souffle.",
          label: "Détresse respiratoire",
          poiTags: ["leisure", "sports_centre", "footway"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un adolescent est pris de panique et halète bruyamment dans la cour du lycée.",
          label: "Détresse respiratoire",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [], // CORRECTION : pas de météo ici
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme de 70 ans est retrouvé assis sur un banc, il respire très difficilement et paraît confus.",
          label: "Détresse respiratoire",
          poiTags: ["amenity", "bench", "park"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un enfant tousse violemment à la cantine et semble s’étouffer avec un aliment.",
          label: "Détresse respiratoire",
          poiTags: ["amenity", "school", "restaurant"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme a inhalé beaucoup de fumée dans son garage en bricolant, il est très essoufflé.",
          label: "Détresse respiratoire",
          poiTags: ["building", "residential", "garage"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme enceinte dit qu’elle n’arrive plus à respirer correctement dans le centre commercial.",
          label: "Détresse respiratoire",
          poiTags: ["shop", "commercial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
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
          meteo: ["soleil", "pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme s’est allongé sur un banc, il dit qu’il ne se sent pas bien, ses amis sont inquiets.",
          label: "Malaise",
          poiTags: ["amenity", "bench", "highway"],
          cycle: "",
          meteo: ["soleil"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une jeune femme semble désorientée dans un commerce, elle tient à peine debout.",
          label: "Malaise",
          poiTags: ["shop", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un client vient de s’écrouler sur une chaise, il dit qu’il se sent faible mais il parle encore.",
          label: "Malaise",
          poiTags: ["amenity", "restaurant", "cafe"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une personne âgée dit avoir des vertiges en sortant de la pharmacie, elle doit s'asseoir.",
          label: "Malaise",
          poiTags: ["shop", "pharmacy", "bench"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un adolescent est pris de vertiges pendant un entraînement sportif, il est allongé au sol et dit qu’il voit flou.",
          label: "Malaise",
          poiTags: ["leisure", "sports_centre", "stadium"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme s’est effondré à l’arrêt de bus, il respire mais reste très faible.",
          label: "Malaise",
          poiTags: ["highway", "bus_stop", "bench"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme enceinte se sent mal dans le métro, elle dit avoir des vertiges et a besoin d’aide.",
          label: "Malaise",
          poiTags: ["railway", "subway", "station"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un cycliste est descendu de vélo et s’est assis sur le trottoir, il dit qu’il se sent faible et a des nausées.",
          label: "Malaise",
          poiTags: ["highway", "cycleway", "footway"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un client d’un cinéma fait un malaise en salle, il est conscient mais très pâle.",
          label: "Malaise",
          poiTags: ["amenity", "cinema"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
      ],
    },
    {
      type: "blesse_divers",
      variants: [
        {
          dialogue:
            "Un enfant s’est ouvert le front en jouant, il saigne beaucoup mais reste conscient.",
          label: "Blessé",
          poiTags: ["leisure", "playground", "park"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un ouvrier s’est blessé à la main avec un outil, la plaie est profonde et saigne fortement.",
          label: "Blessé",
          poiTags: ["construction", "workplace", "industrial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme s’est coupée profondément en cuisinant, le saignement est difficile à arrêter.",
          label: "Blessé",
          poiTags: ["building", "residential", "kitchen"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un cycliste est tombé sur la chaussée, il a une plaie ouverte au genou et des éraflures.",
          label: "Blessé",
          poiTags: ["highway", "cycleway", "residential"],
          cycle: "jour",
          meteo: ["soleil", "pluie"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un adolescent s’est blessé en brisant une vitre, il a plusieurs coupures aux bras.",
          label: "Blessé",
          poiTags: ["amenity", "school", "building"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme a glissé sur un sol mouillé dans le supermarché, il s’est ouvert la tête en tombant.",
          label: "Blessé",
          poiTags: ["shop", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un randonneur s’est tordu la cheville en forêt, il ne peut plus marcher.",
          label: "Blessé",
          poiTags: ["natural", "forest", "path"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un spectateur est tombé dans les gradins du stade, il saigne du cuir chevelu.",
          label: "Blessé",
          poiTags: ["leisure", "stadium", "sports_centre"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une personne âgée s’est coincé la main dans une porte d’ascenseur, la douleur est intense.",
          label: "Blessé",
          poiTags: ["building", "residential", "lift"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un employé s’est renversé de l’eau bouillante sur le bras dans une cuisine de restaurant.",
          label: "Blessé",
          poiTags: ["amenity", "restaurant", "kitchen"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
      ],
    },
    {
      type: "blesse_par_arme",
      variants: [
        {
          dialogue:
            "Un homme a été poignardé à la cuisse lors d’une bagarre devant un bar.",
          label: "Blessé par arme blanche",
          poiTags: ["amenity", "bar", "pub"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Une rixe a éclaté dans un parc, une personne présente une blessure par arme blanche.",
          label: "Blessé par arme blanche",
          poiTags: ["leisure", "park", "place"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un individu a été blessé par balle dans une ruelle, il est au sol et conscient.",
          label: "Blessé par arme à feu",
          poiTags: ["highway", "residential", "footway"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 2 },
          ],
        },
        {
          dialogue:
            "Une altercation devant une discothèque a fait un blessé par arme à feu.",
          label: "Blessé par arme à feu",
          poiTags: ["amenity", "nightclub"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 2 },
          ],
        },
        {
          dialogue:
            "Un jeune homme a été agressé avec un couteau à la sortie du lycée.",
          label: "Blessé par arme blanche",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un client d’un supermarché a été blessé par balle lors d’un braquage.",
          label: "Blessé par arme à feu",
          poiTags: ["shop", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 2 },
          ],
        },
        {
          dialogue:
            "Un homme est retrouvé blessé par arme blanche dans le hall d’un immeuble.",
          label: "Blessé par arme blanche",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Des coups de feu ont été signalés, une personne est blessée au bras.",
          label: "Blessé par arme à feu",
          poiTags: ["highway", "street", "place"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 3 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 2 },
          ],
        },
        {
          dialogue:
            "Un passant s’est interposé dans une altercation et a reçu un coup de couteau.",
          label: "Blessé par arme blanche",
          poiTags: ["place", "highway", "residential"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 1 },
          ],
        },
        {
          dialogue:
            "Un blessé par balle est signalé sur un parking de centre commercial.",
          label: "Blessé par arme à feu",
          poiTags: ["amenity", "parking", "shop"],
          cycle: "soir",
          meteo: [],
          victimCount: { min: 1, max: 2 },
          vehicles: [
            { type: "VSAV", nombre: 1 },
            { type: "PATROUILLE", nombre: 2 },
          ],
        },
      ],
    },
    {
      type: "detresse_neurologique",
      vehicles: [],
      variants: [
        {
          dialogue:
            "Mon père ne parle plus normalement et ne peut plus bouger son bras droit.",
          label: "Détresse neurologique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme fait une crise dans le parc, il convulse au sol !",
          label: "Détresse neurologique",
          poiTags: ["leisure", "park", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un élève est tombé en classe, il tremble de tout son corps !",
          label: "Détresse neurologique",
          poiTags: ["amenity", "school"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un jeune homme fait des gestes incohérents, il semble désorienté et tremble.",
          label: "Détresse neurologique",
          poiTags: ["highway", "footway", "place"],
          cycle: "",
          meteo: [], // conditions pouvant aggraver désorientation
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme a perdu connaissance après s’être mise à trembler violemment.",
          label: "Détresse neurologique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une personne âgée est tombée dans la rue, elle parle de manière incohérente et son visage est paralysé d’un côté.",
          label: "Détresse neurologique",
          poiTags: ["highway", "footway", "residential"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme s’est effondré dans le métro, il convulse et les passants paniquent.",
          label: "Détresse neurologique",
          poiTags: ["railway", "subway", "station"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un étudiant s’est mis à trembler brusquement dans la bibliothèque universitaire, il ne répond plus aux questions.",
          label: "Détresse neurologique",
          poiTags: ["amenity", "library", "university"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un ouvrier est retrouvé inconscient sur un chantier après avoir eu un comportement confus.",
          label: "Détresse neurologique",
          poiTags: ["construction", "industrial", "workplace"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une cliente dans un supermarché s’est effondrée brutalement, elle convulse près des caisses.",
          label: "Détresse neurologique",
          poiTags: ["shop", "supermarket"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
      ],
    },
    {
      type: "douleur_thoracique",
      variants: [
        {
          dialogue:
            "Mon mari dit qu’il a une forte douleur dans la poitrine et qu’il transpire abondamment.",
          label: "Douleur thoracique",
          poiTags: ["building", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme s’est assis brutalement sur un banc en tenant sa poitrine, il dit qu’il a mal au cœur.",
          label: "Douleur thoracique",
          poiTags: ["amenity", "bench", "place"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un client d’un restaurant se plaint d’une douleur violente à la poitrine, il est très pâle.",
          label: "Douleur thoracique",
          poiTags: ["amenity", "restaurant", "cafe"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un chauffeur de bus a arrêté son véhicule et dit qu’il a mal au thorax.",
          label: "Douleur thoracique",
          poiTags: ["highway", "bus_stop", "amenity"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un joggeur s’est arrêté en plein effort, il dit avoir une douleur très vive au niveau du cœur.",
          label: "Douleur thoracique",
          poiTags: ["leisure", "park", "sports_centre"],
          cycle: "jour",
          meteo: ["soleil"],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Une femme enceinte se plaint d’une oppression dans la poitrine dans le centre commercial.",
          label: "Douleur thoracique",
          poiTags: ["shop", "commercial"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un homme âgé a des douleurs thoraciques dans la rue, il s’est allongé au sol.",
          label: "Douleur thoracique",
          poiTags: ["highway", "footway", "residential"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un employé de bureau se tient la poitrine et dit qu’il a du mal à respirer.",
          label: "Douleur thoracique",
          poiTags: ["office", "building", "workplace"],
          cycle: "jour",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un spectateur au cinéma s’est effondré, il avait mal au thorax avant de perdre connaissance.",
          label: "Douleur thoracique",
          poiTags: ["amenity", "cinema"],
          cycle: "nuit",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
        },
        {
          dialogue:
            "Un conducteur sur l’autoroute a arrêté sa voiture sur la bande d’arrêt d’urgence, il dit avoir une douleur dans la poitrine.",
          label: "Douleur thoracique",
          poiTags: ["highway", "motorway"],
          cycle: "",
          meteo: [],
          victimCount: { min: 1, max: 1 },
          vehicles: [{ type: "VSAV", nombre: 1 }],
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
