// Game rules data: eras, terrain, tech, institutions, units, buildings, laws, polities.

export const MONTHS = ['Eanáir', 'Feabhra', 'Márta', 'Aibreán', 'Bealtaine', 'Meitheamh', 'Iúil', 'Lúnasa', 'Meán Fómhair', 'Deireadh Fómhair', 'Samhain', 'Nollaig'];
export const WINTER = new Set([10, 11, 0, 1]);
export const START_YEAR = 1;
export const END_YEAR = 1801;

export const ERAS = [
  { id: 'iron', name: 'Iron Age', start: 1, desc: 'Túatha, druids and cattle-raids. Hillforts and royal sites rule the land.' },
  { id: 'christian', name: 'Early Christian', start: 432, desc: 'Patrick\'s mission. Monasteries become centres of wealth and learning.' },
  { id: 'viking', name: 'Viking Age', start: 795, desc: 'Norse raiders, then Norse towns. Coinage and trade arrive.' },
  { id: 'norman', name: 'Norman Invasion', start: 1169, desc: 'Cambro-Norman knights land. Castles and feudal lordship spread.' },
  { id: 'gaelic', name: 'Gaelic Resurgence', start: 1350, desc: 'The Black Death weakens the colony. Gaelic lords push back; galloglass dominate.' },
  { id: 'tudor', name: 'Tudor Conquest', start: 1534, desc: 'The Crown returns with guns, reform and plantation.' },
  { id: 'ascendancy', name: 'Ascendancy', start: 1691, desc: 'After the Williamite war. The century before Union.' },
];
export function eraOf(year) { let e = ERAS[0]; for (const x of ERAS) if (year >= x.start) e = x; return e; }

// density: people/km² carrying capacity in 1 AD; cattle: head/km²; def: defender dice; move: travel cost
export const TERRAIN = {
  plains:   { name: 'Machaire (Plains)', color: '#cfd98c', move: 1.0, def: 0, atr: 0, density: 10, cattle: 4.0, cav: 1.25, light: 0.9, supply: 1.2 },
  pasture:  { name: 'Féarach (Pasture)', color: '#a9cf7a', move: 1.0, def: 0, atr: 0, density: 7.5, cattle: 6.0, cav: 1.1, light: 1.0, supply: 1.1 },
  forest:   { name: 'Coill (Forest)', color: '#4f8a4a', move: 1.6, def: 1, atr: 0.5, density: 3, cattle: 1.2, cav: 0.55, light: 1.35, supply: 0.7 },
  bog:      { name: 'Portach (Bog)', color: '#8f7d57', move: 2.0, def: 1, atr: 1, density: 2, cattle: 1.5, cav: 0.4, light: 1.35, supply: 0.5 },
  drumlin:  { name: 'Droimníní (Drumlins)', color: '#bcc66e', move: 1.4, def: 1, atr: 0, density: 7, cattle: 5.0, cav: 0.8, light: 1.2, supply: 0.9 },
  hills:    { name: 'Cnoic (Uplands)', color: '#b8a874', move: 1.5, def: 1, atr: 0.5, density: 4, cattle: 3.0, cav: 0.7, light: 1.2, supply: 0.7 },
  mountain: { name: 'Sléibhte (Mountains)', color: '#8d8478', move: 2.2, def: 2, atr: 1, density: 1.5, cattle: 1.0, cav: 0.4, light: 1.45, supply: 0.4 },
  karst:    { name: 'Boirinn (Karst)', color: '#c3bfae', move: 1.5, def: 1, atr: 0.5, density: 4, cattle: 4.0, cav: 0.7, light: 1.2, supply: 0.6 },
};

// ---- Technology ----
export const TECH_YEARS = [1, 100, 200, 300, 432, 500, 600, 700, 800, 900, 1000, 1100, 1170, 1250, 1330, 1400, 1475, 1540, 1600, 1650, 1700, 1760, 1800];
export const MAX_TECH = TECH_YEARS.length - 1;
export const TECH_MAX_AHEAD = 100; // hard stop: cannot research more than this many years early
export const TECH_GATES = {
  adm: { 5: 'christianity', 8: 'learning', 12: 'feudalism', 18: 'printing' },
  dip: { 5: 'christianity', 9: 'norse_trade', 14: 'feudalism', 18: 'printing' },
  mil: { 9: 'norse_trade', 12: 'feudalism', 16: 'gunpowder' },
};
export const TECH_NAMES = { adm: 'Rule (Riar)', dip: 'Diplomacy (Caidreamh)', mil: 'War (Cogadh)' };
export const TECH_INFO = {
  adm: 'Each level: +3% tax, +2% land capacity, cheaper coring.',
  dip: 'Each level: +4% trade & cattle value, better relations, cheaper claims.',
  mil: 'Each level: +6% combat strength, +2% morale.',
};
export function techCost(level, year) {
  const base = 380 + level * 25;
  const ahead = Math.max(0, TECH_YEARS[level] - year);
  return Math.round(base * (1 + ahead / 40));
}

export const INSTITUTIONS = [
  { id: 'christianity', name: 'Christianity', year: 432, origin: 'downpatrick', desc: 'Writing, churches and a new religion. Pagan rulers face unrest in converted lands.' },
  { id: 'learning', name: 'Monastic Learning', year: 560, origin: 'clonmacnoise', needs: 'christianity', desc: 'Scriptoria and schools. Monasteries become rich.' },
  { id: 'norse_trade', name: 'Coinage & Towns', year: 930, origin: 'dublin', desc: 'Silver, ports and markets, carried by Norse traders.' },
  { id: 'feudalism', name: 'Feudalism', year: 1175, origin: 'wexford', desc: 'Castles, knights and charters.' },
  { id: 'gunpowder', name: 'Gunpowder', year: 1470, origin: 'dublin', desc: 'Guns change war and sieges.' },
  { id: 'printing', name: 'Print & Reform', year: 1560, origin: 'dublin', desc: 'Printing presses and religious reform.' },
];
export const INST_IDS = INSTITUTIONS.map(i => i.id);

// ---- Military ----
// cls: foot / light (bonus in rough terrain) / cav (bonus in open terrain)
export const UNITS = {
  levy:       { name: 'Sluagh (Levy)', atk: 0.8, def: 0.8, mor: 0.7, cost: 6, up: 0.10, cls: 'foot', req: () => true },
  kern:       { name: 'Ceithern (Kern)', atk: 1.0, def: 0.9, mor: 0.9, cost: 9, up: 0.18, cls: 'light', req: c => c.culture === 'gaelic' || c.culture === 'norman' },
  horse:      { name: 'Marcshluagh (Horse)', atk: 1.4, def: 1.0, mor: 1.0, cost: 16, up: 0.35, cls: 'cav', req: () => true },
  axemen:     { name: 'Tuagairí (Norse Axemen)', atk: 1.8, def: 1.4, mor: 1.2, cost: 18, up: 0.45, cls: 'foot', req: c => c.culture === 'norse' },
  archers:    { name: 'Saighdeoirí (Longbowmen)', atk: 1.6, def: 1.0, mor: 1.0, cost: 14, up: 0.35, cls: 'foot', req: c => c.culture === 'norman' || c.culture === 'english' },
  knights:    { name: 'Ridirí (Knights)', atk: 2.6, def: 2.0, mor: 1.3, cost: 30, up: 0.8, cls: 'cav', req: c => c.culture === 'norman' || c.culture === 'english' || (c.inst.feudalism && c.tech.mil >= 12) },
  galloglass: { name: 'Gallóglaigh (Galloglass)', atk: 2.2, def: 2.0, mor: 1.4, cost: 22, up: 0.6, cls: 'foot', req: c => c.culture === 'gaelic' && c.tech.mil >= 13 },
  shot:       { name: 'Musaeidí (Shot)', atk: 2.6, def: 1.4, mor: 1.1, cost: 20, up: 0.5, cls: 'foot', req: c => c.inst.gunpowder && c.tech.mil >= 16 },
};
export const UNIT_SIZE = 100;

// ---- Buildings ----
export const BUILDINGS = {
  rath:      { name: 'Ráth (Ringfort)', cost: 40, fort: 1, unrest: -0.5, req: () => true, desc: 'Earthen ringfort. Fort +1.' },
  oenach:    { name: 'Óenach (Assembly Fair)', cost: 90, tax: 0.10, cattle: 0.25, req: c => c.tech.dip >= 2, desc: '+10% tax, +25% cattle value.' },
  church:    { name: 'Teampall (Church)', cost: 80, tax: 0.15, unrest: -1, req: c => c.inst.christianity, desc: '+15% tax, −1 unrest.' },
  monastery: { name: 'Mainistir (Monastery)', cost: 160, tax: 0.15, cap: 0.10, prestige: 0.05, req: c => c.inst.learning && c.tech.adm >= 6, desc: '+15% tax, +10% capacity, prestige. A target for raiders.' },
  market:    { name: 'Baile Margaidh (Market Town)', cost: 200, tax: 0.30, cap: 0.10, req: c => c.inst.norse_trade && c.tech.dip >= 9, desc: '+30% tax, +10% capacity.' },
  mill:      { name: 'Muileann (Mill)', cost: 120, cap: 0.15, req: c => c.tech.adm >= 10, desc: '+15% capacity.' },
  motte:     { name: 'Mota (Motte & Bailey)', cost: 120, fort: 1, req: c => c.inst.feudalism || c.culture === 'norman', desc: 'Fort +1.' },
  castle:    { name: 'Caisleán (Stone Castle)', cost: 300, fort: 2, unrest: -1, req: c => c.inst.feudalism && c.tech.mil >= 12, desc: 'Fort +2, −1 unrest.' },
  towerhouse:{ name: 'Teach Túir (Tower House)', cost: 150, fort: 1, unrest: -1, req: c => c.tech.adm >= 14, desc: 'Fort +1, −1 unrest.' },
  walls:     { name: 'Ballaí Baile (Town Walls)', cost: 250, fort: 1, tax: 0.05, req: (c, p) => c.tech.dip >= 14 && p.bld.includes('market'), desc: 'Fort +1. Needs a market town.' },
  bastion:   { name: 'Dún Réalta (Star Fort)', cost: 400, fort: 2, req: c => c.inst.gunpowder && c.tech.mil >= 18, desc: 'Fort +2.' },
};
export const MAX_FORT = 5;

// ---- Laws (methods of rule) ----
export const LAWS = {
  succession: {
    tanistry: { name: 'Tanistry (Tánaisteacht)', desc: 'Heir chosen from the derbfine. Rulers are adults, but a death with no tanist named causes a succession dispute.', req: c => c.culture === 'gaelic' },
    primogeniture: { name: 'Primogeniture', desc: 'The eldest son inherits. No disputes, but child rulers bring regency.', req: (c, S) => c.culture !== 'gaelic' || S.year >= 1540 || c.inst.feudalism },
    thing: { name: 'Thing Election', desc: 'Norse free-men elect a jarl. Adult rulers, mild disputes.', req: c => c.culture === 'norse' },
  },
  law: {
    brehon: { name: 'Brehon Law (Féineachas)', desc: 'Compensation not punishment. −10% tax, −1 unrest in Gaelic lands, faster stability recovery.', req: c => c.culture === 'gaelic' || c.culture === 'norman' || c.culture === 'norse' },
    common: { name: 'Common Law', desc: 'Royal courts and sheriffs. +15% tax, +2 unrest in Gaelic lands.', req: c => c.inst.feudalism || c.culture === 'english' },
    norse: { name: 'Town Law (Lǫg)', desc: 'Merchant law of the ports. +20% tax in coastal lands.', req: c => c.culture === 'norse' || c.inst.norse_trade },
  },
  army: {
    risingout: { name: 'Rising-out (Slógad)', desc: 'Free-men owe service. Levies 30% cheaper, +20% manpower.', req: () => true },
    coign: { name: 'Coign and Livery', desc: 'Troops billeted on the people. −40% upkeep, +1 unrest everywhere.', req: (c, S) => S.year >= 1250 },
    standing: { name: 'Standing Army', desc: 'Paid professional soldiers. +20% morale, +30% upkeep.', req: c => c.tech.mil >= 18 },
  },
};

// ---- Ranks (Gaelic kingship hierarchy) ----
export const RANKS = [
  { id: 'tuath', name: 'Rí Túaithe', desc: 'Petty king of a túath', min: 0, subjects: 1 },
  { id: 'ruirech', name: 'Ruiri (Overking)', desc: 'King over several túatha', min: 9, subjects: 3 },
  { id: 'coiced', name: 'Rí Cóicid (Provincial King)', desc: 'King of a fifth of Ireland', min: 22, subjects: 6 },
];
export const OUTSIDER_RANKS = { norse: 'Jarldom', norman: 'Feudal Lordship', english: 'Crown Lordship' };

// ---- Names ----
export const GAELIC_NAMES = [['Art', 'Airt'], ['Conn', 'Cuinn'], ['Niall', 'Néill'], ['Cormac', 'Cormaic'], ['Fergus', 'Fergusa'], ['Eochaid', 'Echach'], ['Ailill', 'Ailella'], ['Lugaid', 'Lugdach'], ['Muiredach', 'Muiredaig'], ['Domnall', 'Domnaill'], ['Áed', 'Áeda'], ['Brian', 'Briain'], ['Donnchad', 'Donnchada'], ['Diarmait', 'Diarmata'], ['Tadg', 'Taidg'], ['Conchobar', 'Conchobair'], ['Fiachra', 'Fiachrach'], ['Cathal', 'Cathail'], ['Flann', 'Flainn'], ['Murchad', 'Murchada'], ['Énna', 'Énnai'], ['Lóegaire', 'Lóegairi'], ['Bran', 'Brain'], ['Feidlimid', 'Feidlimthe'], ['Crimthann', 'Crimthainn'], ['Cellach', 'Cellaig'], ['Ruaidrí', 'Ruaidrí'], ['Toirdelbach', 'Toirdelbaig'], ['Máel Sechnaill', 'Máel Sechnaill'], ['Fínnachta', 'Fínnachta']];
export const GAELIC_SURNAMES = ['Ó Néill', 'Ó Briain', 'Ó Conchobhair', 'Ó Domhnaill', 'Ó Ceallaigh', 'Ó Ruairc', 'Ó Raghallaigh', 'Mac Mathghamhna', 'Ó Súilleabháin', 'Mac Carthaigh', 'Ó Caoimh', 'Ó Tuathail', 'Ó Broin', 'Ó Mórdha', 'Ó Ceinnéidigh', 'Ó Dubhda', 'Ó Flaithbheartaigh', 'Ó Madadháin', 'Mac Murchadha', 'Ó Fearghail', 'Mag Uidhir', 'Mac Giolla Phádraig', 'Ó Máille', 'Ó hEadhra', 'Ó Cearbhaill', 'Ó Dálaigh', 'Mac Aonghusa', 'Ó Catháin', 'Ó Conchobhair Fhailghe', 'Mac Diarmada', 'Ó Duinn', 'Ó Méalóid'];
export const NORSE_NAMES = ['Óláfr', 'Ívarr', 'Sigtryggr', 'Ragnall', 'Gofraid', 'Haraldr', 'Ottar', 'Thorir', 'Hálfdan', 'Ketill'];
export const NORMAN_FIRST = ['Richard', 'Hugh', 'Maurice', 'John', 'William', 'Theobald', 'Walter', 'Raymond', 'Gerald', 'Robert'];
export const NORMAN_SUR = ['de Clare', 'de Lacy', 'FitzGerald', 'de Courcy', 'de Burgh', 'Butler', 'le Gros', 'de Barry', 'de Prendergast', 'FitzStephen'];
export const ENGLISH_FIRST = ['Henry', 'John', 'Thomas', 'William', 'Richard', 'Edward', 'Robert', 'George', 'Arthur', 'Charles'];
export const ENGLISH_SUR = ['Sidney', 'Grey', 'Perrot', 'Fitzwilliam', 'Chichester', 'Wentworth', 'Talbot', 'Blount', 'Poynings', 'Mortimer', 'Skeffington', 'Carew'];

// ---- Starting polities, c. 1 AD (names from early Irish tradition and Ptolemy's map) ----
export const POLITIES = [
  { tag: 'ULA', name: 'Ulaid', cap: 'armagh', color: '#b33a3a', desc: 'The Ulstermen of Emain Macha, heroes of the Táin.' },
  { tag: 'DNA', name: 'Dál nAraidi', cap: 'ballymena', color: '#d0703c', desc: 'Cruithin kingdom of the Antrim lowlands.' },
  { tag: 'DRI', name: 'Dál Riata', cap: 'ballycastle', color: '#5c7fb8', desc: 'Sea-kings of the north coast, looking toward Alba.' },
  { tag: 'VEN', name: 'Venicnii', cap: 'kilmacrenan', color: '#7c5aa6', desc: 'Peoples of the Donegal highlands.' },
  { tag: 'AIL', name: 'Ailech', cap: 'ailech', color: '#9c2f5a', desc: 'Lords of the stone fort above Lough Swilly.' },
  { tag: 'FIR', name: 'Fir Manach', cap: 'enniskillen', color: '#3f8f8a', desc: 'Lake-dwellers of the Erne.' },
  { tag: 'AIR', name: 'Airgialla', cap: 'clogher', color: '#c49a3a', desc: 'The hostage-givers of mid-Ulster.' },
  { tag: 'CRU', name: 'Uí Echach Cobo', cap: 'newry', color: '#8a4a2f', desc: 'Cruithin of the Mourne country.' },
  { tag: 'BRE', name: 'Bréifne', cap: 'cavan', color: '#6a8a3a', desc: 'Drumlin kingdom between Ulster and Connacht.' },
  { tag: 'CAI', name: 'Cairbre', cap: 'sligo', color: '#4a6a9a', desc: 'Lords of Benbulben and Sligo Bay.' },
  { tag: 'NAG', name: 'Nagnatae', cap: 'killala', color: '#9a6a8a', desc: 'Tribes of the Moy and the Mayo coast.' },
  { tag: 'UML', name: 'Umaill', cap: 'westport', color: '#2f6f6a', desc: 'Seafarers of Clew Bay.' },
  { tag: 'CON', name: 'Connachta', cap: 'cruachan', color: '#2e7d4f', desc: 'Medb\'s people of Cruachan.' },
  { tag: 'AUT', name: 'Auteini', cap: 'galway', color: '#7a9a4a', desc: 'Peoples of the Corrib and the western sea.' },
  { tag: 'UMA', name: 'Uí Maine', cap: 'ballinasloe', color: '#a0825a', desc: 'Kingdom of the Suck valley.' },
  { tag: 'GAN', name: 'Gangani', cap: 'ennis', color: '#c45a7a', desc: 'Peoples of the Burren and the Fergus — later Dál gCais.' },
  { tag: 'CIA', name: 'Ciarraige', cap: 'tralee', color: '#5a9ac4', desc: 'Kingdom of the Kerry peninsulas.' },
  { tag: 'IVE', name: 'Iverni', cap: 'rosscarbery', color: '#8ab04a', desc: 'The Érainn of the far south-west.' },
  { tag: 'ULI', name: 'Uí Liatháin', cap: 'cork', color: '#b05a2f', desc: 'Lords of the Lee and Cork Harbour.' },
  { tag: 'MUM', name: 'Mumu', cap: 'cashel', color: '#d4b13a', desc: 'The rock of Cashel and the Golden Vale.' },
  { tag: 'DES', name: 'Déisi', cap: 'lismore', color: '#6a4a9a', desc: 'Vassal-folk of the Blackwater and the Comeraghs.' },
  { tag: 'UFI', name: 'Uí Fidgenti', cap: 'limerick', color: '#3a7aa0', desc: 'Kingdom of the lower Shannon.' },
  { tag: 'ORM', name: 'Múscraige', cap: 'nenagh', color: '#a04a4a', desc: 'Peoples of Ormond and Lough Derg.' },
  { tag: 'OSR', name: 'Osraige', cap: 'kilkenny', color: '#4aa07a', desc: 'The buffer-kingdom between Leinster and Munster.' },
  { tag: 'BRI', name: 'Brigantes', cap: 'ferns', color: '#9a3a7a', desc: 'Southern Leinster — later Uí Chennselaig.' },
  { tag: 'MAN', name: 'Manapii', cap: 'arklow', color: '#5a5aa0', desc: 'Peoples of the Wicklow coast.' },
  { tag: 'LAI', name: 'Laigin', cap: 'dunailinne', color: '#3a5a8a', desc: 'Spear-men of Dún Ailinne and the Curragh.' },
  { tag: 'EBL', name: 'Eblani', cap: 'dublin', color: '#7a7a3a', desc: 'People of the Liffey mouth.' },
  { tag: 'MID', name: 'Mide', cap: 'tara', color: '#e0dcc8', desc: 'Keepers of Tara, seat of the High Kings.' },
  { tag: 'TET', name: 'Tethbae', cap: 'longford', color: '#8a8a6a', desc: 'Kingdom of the upper Shannon lakes.' },
  { tag: 'UFA', name: 'Uí Fáilge', cap: 'tullamore', color: '#6aa04a', desc: 'Lords of the great bogs.' },
  { tag: 'EIL', name: 'Éile', cap: 'roscrea', color: '#a07a3a', desc: 'Kingdom beneath Slieve Bloom.' },
];

// ---- Outside powers. They exist only through what they hold on the island. ----
export const OUTSIDERS = {
  DYF: { name: 'Dyflin (Norse Dublin)', culture: 'norse', color: '#2a2a40' },
  VED: { name: 'Veðrafjǫrðr (Norse Waterford)', culture: 'norse', color: '#3a3a55' },
  HLY: { name: 'Hlymrekr (Norse Limerick)', culture: 'norse', color: '#45455f' },
  NOR: { name: 'Norman Lords of Leinster', culture: 'norman', color: '#b8b8c8' },
  ENG: { name: 'Lordship of Ireland (English Crown)', culture: 'english', color: '#d8433a' },
};
// Timed arrivals. troops in men. landing = preferred place keys (first owned / free coastal one used)
export const WAVES = [
  { year: 841, tag: 'DYF', landing: ['dublin'], troops: { axemen: 1200, levy: 600 }, msg: 'Norse ships winter at the Black Pool — a longphort rises at Dyflin.' },
  { year: 902, tag: 'DYF', landing: ['dublin', 'drogheda', 'wicklow'], troops: { axemen: 1000, levy: 400 }, msg: 'Norse fleets return from Britain to retake Dyflin.', onlyIfDead: true },
  { year: 914, tag: 'VED', landing: ['waterford'], troops: { axemen: 1100, levy: 500 }, msg: 'A great Norse fleet settles at Waterford.' },
  { year: 922, tag: 'HLY', landing: ['limerick'], troops: { axemen: 1000, levy: 500 }, msg: 'Norse raiders fortify an island at Limerick.' },
  { year: 1169, tag: 'NOR', landing: ['wexford', 'newross', 'waterford'], troops: { knights: 400, archers: 600, levy: 300 }, msg: 'Norman knights land at Bannow Bay.' },
  { year: 1170, tag: 'NOR', landing: ['waterford', 'wexford'], troops: { knights: 500, archers: 900 }, msg: 'Strongbow lands near Waterford with a larger host.' },
  { year: 1171, tag: 'ENG', landing: ['waterford', 'dublin', 'wexford'], troops: { knights: 600, archers: 1200, levy: 800 }, msg: 'King Henry II lands to take the Lordship of Ireland.' },
  { year: 1210, tag: 'ENG', landing: ['waterford', 'dublin'], troops: { knights: 500, archers: 1000 }, msg: 'King John brings an army to Ireland.' },
  { year: 1394, tag: 'ENG', landing: ['waterford', 'dublin'], troops: { knights: 900, archers: 2500 }, msg: 'King Richard II crosses with the largest army yet seen.' },
  { year: 1535, tag: 'ENG', landing: ['dublin', 'drogheda', 'waterford'], troops: { archers: 1500, shot: 1000, horse: 600 }, msg: 'Skeffington\'s guns break the Kildare rebellion.' },
  { year: 1569, tag: 'ENG', landing: ['cork', 'waterford', 'dublin'], troops: { shot: 2000, horse: 600, levy: 800 }, msg: 'Crown armies arrive to put down the Desmond risings.' },
  { year: 1599, tag: 'ENG', landing: ['dublin', 'carrickfergus', 'waterford'], troops: { shot: 6000, horse: 1200, levy: 2000 }, msg: 'Essex, then Mountjoy, land with the largest Tudor army.' },
  { year: 1649, tag: 'ENG', landing: ['dublin', 'drogheda', 'wexford'], troops: { shot: 8000, horse: 3000 }, msg: 'Cromwell lands at Ringsend with the New Model Army.' },
  { year: 1690, tag: 'ENG', landing: ['carrickfergus', 'dublin', 'waterford'], troops: { shot: 12000, horse: 3000 }, msg: 'King William lands at Carrickfergus.' },
];
// Off-island support per year while they hold land (gold, men)
export const OUTSIDER_SUPPORT = { norse: [30, 500], norman: [40, 600], english: [80, 1500] };
