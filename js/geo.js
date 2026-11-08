// Real-world geography of Ireland, hand-digitised from lat/lon.
// Coastline, loughs, rivers, terrain regions and historic sites.

export const BOUNDS = { lon0: -10.75, lon1: -5.35, lat0: 51.35, lat1: 55.5 };
export const H = 1040;
const COSLAT = Math.cos(53.4 * Math.PI / 180);
export const PX_PER_DEG = H / (BOUNDS.lat1 - BOUNDS.lat0);
export const W = Math.ceil((BOUNDS.lon1 - BOUNDS.lon0) * COSLAT * PX_PER_DEG);
export const KM_PER_PX = 111.2 / PX_PER_DEG;

export function project(lat, lon) {
  return [(lon - BOUNDS.lon0) * COSLAT * PX_PER_DEG, (BOUNDS.lat1 - lat) * PX_PER_DEG];
}

// Clockwise from Malin Head. [lat, lon]
export const COAST = [
  [55.38,-7.37],[55.32,-7.25],[55.23,-6.93],[55.20,-6.99],[55.19,-7.04],[55.12,-7.19],[55.05,-7.25],
  [55.05,-7.02],[55.19,-6.96],[55.17,-6.79],[55.19,-6.72],[55.21,-6.65],[55.24,-6.51],[55.21,-6.24],
  [55.23,-6.15],[55.20,-6.06],[55.08,-6.05],[54.97,-5.95],[54.86,-5.81],[54.82,-5.70],[54.76,-5.69],
  [54.71,-5.80],[54.62,-5.90],[54.64,-5.83],[54.67,-5.67],[54.64,-5.53],[54.55,-5.48],[54.46,-5.44],
  [54.38,-5.46],[54.33,-5.49],[54.33,-5.56],[54.26,-5.60],[54.22,-5.66],[54.26,-5.80],[54.21,-5.89],
  [54.11,-5.90],[54.06,-5.99],[54.02,-6.05],[54.10,-6.25],[54.08,-6.26],[54.04,-6.18],[53.99,-6.10],
  [53.98,-6.15],[54.00,-6.38],[53.96,-6.37],[53.88,-6.34],[53.86,-6.24],[53.79,-6.21],[53.72,-6.24],
  [53.68,-6.23],[53.61,-6.18],[53.58,-6.10],[53.52,-6.08],[53.45,-6.14],[53.38,-6.05],[53.35,-6.21],
  [53.30,-6.13],[53.27,-6.09],[53.20,-6.09],[53.14,-6.06],[52.96,-5.99],[52.88,-6.07],[52.79,-6.14],
  [52.64,-6.22],[52.56,-6.19],[52.44,-6.33],[52.36,-6.33],[52.34,-6.45],[52.27,-6.37],[52.25,-6.33],
  [52.17,-6.36],[52.17,-6.59],[52.21,-6.79],[52.19,-6.84],[52.12,-6.93],[52.22,-6.93],[52.27,-6.97],
  [52.24,-6.99],[52.15,-6.99],[52.16,-7.15],[52.13,-7.37],[52.08,-7.61],[52.05,-7.54],[51.99,-7.59],
  [51.95,-7.72],[51.95,-7.84],[51.88,-7.88],[51.83,-8.00],[51.79,-8.25],[51.85,-8.28],[51.89,-8.40],
  [51.82,-8.32],[51.74,-8.32],[51.70,-8.51],[51.60,-8.53],[51.63,-8.70],[51.57,-8.72],[51.60,-8.88],
  [51.53,-8.95],[51.56,-9.12],[51.49,-9.23],[51.48,-9.37],[51.52,-9.55],[51.47,-9.72],[51.45,-9.82],
  [51.54,-9.67],[51.54,-9.85],[51.68,-9.47],[51.75,-9.55],[51.69,-9.72],[51.64,-9.91],[51.59,-10.19],
  [51.71,-9.96],[51.87,-9.60],[51.83,-9.90],[51.76,-10.13],[51.78,-10.34],[51.88,-10.37],[51.94,-10.22],
  [52.06,-9.94],[52.15,-9.73],[52.13,-9.98],[52.13,-10.27],[52.10,-10.46],[52.18,-10.47],[52.27,-10.24],
  [52.27,-10.02],[52.27,-9.75],[52.28,-9.86],[52.42,-9.94],[52.51,-9.67],[52.57,-9.60],[52.58,-9.37],
  [52.61,-9.11],[52.62,-8.97],[52.66,-8.66],[52.69,-8.80],[52.75,-8.93],[52.67,-9.10],[52.62,-9.25],
  [52.63,-9.50],[52.60,-9.70],[52.56,-9.93],[52.68,-9.65],[52.74,-9.53],[52.85,-9.44],[52.94,-9.40],
  [52.97,-9.43],[53.02,-9.40],[53.15,-9.27],[53.12,-9.15],[53.14,-8.93],[53.27,-8.93],[53.27,-9.05],
  [53.25,-9.15],[53.24,-9.31],[53.26,-9.56],[53.30,-9.72],[53.32,-9.84],[53.39,-9.92],[53.40,-10.20],
  [53.49,-10.05],[53.56,-10.12],[53.61,-10.03],[53.60,-9.75],[53.63,-9.88],[53.77,-9.82],[53.80,-9.55],
  [53.88,-9.55],[53.90,-9.78],[53.96,-10.05],[53.97,-10.26],[54.03,-10.00],[54.10,-10.07],[54.22,-10.00],
  [54.30,-10.00],[54.25,-9.88],[54.34,-9.81],[54.31,-9.55],[54.32,-9.35],[54.21,-9.21],[54.15,-9.15],
  [54.22,-9.10],[54.29,-8.96],[54.28,-8.75],[54.27,-8.49],[54.31,-8.57],[54.41,-8.57],[54.47,-8.45],
  [54.48,-8.28],[54.50,-8.19],[54.64,-8.12],[54.63,-8.28],[54.63,-8.44],[54.62,-8.68],[54.66,-8.79],
  [54.71,-8.76],[54.78,-8.55],[54.82,-8.56],[54.95,-8.43],[55.06,-8.35],[55.15,-8.28],[55.12,-8.15],
  [55.22,-7.98],[55.18,-7.97],[55.13,-7.88],[55.24,-7.83],[55.18,-7.75],[55.28,-7.63],[55.10,-7.54],
  [54.96,-7.70],[55.05,-7.50],[55.13,-7.46],[55.20,-7.55],[55.28,-7.52],
];

export const LAKES = [
  { name: 'Loch nEathach (Lough Neagh)', pts: [[54.73,-6.50],[54.70,-6.36],[54.62,-6.28],[54.53,-6.30],[54.47,-6.40],[54.50,-6.55],[54.58,-6.60],[54.66,-6.57]] },
  { name: 'Loch Éirne (Lower Lough Erne)', pts: [[54.53,-7.97],[54.50,-7.85],[54.44,-7.70],[54.38,-7.65],[54.39,-7.70],[54.45,-7.82],[54.49,-7.95]] },
  { name: 'Upper Lough Erne', pts: [[54.30,-7.55],[54.25,-7.45],[54.20,-7.40],[54.22,-7.48],[54.27,-7.56]] },
  { name: 'Loch Coirib (Lough Corrib)', pts: [[53.56,-9.50],[53.52,-9.33],[53.45,-9.20],[53.32,-9.05],[53.30,-9.08],[53.40,-9.25],[53.47,-9.40],[53.52,-9.52]] },
  { name: 'Loch Measca (Lough Mask)', pts: [[53.72,-9.45],[53.68,-9.30],[53.58,-9.30],[53.55,-9.38],[53.60,-9.48],[53.67,-9.50]] },
  { name: 'Loch Rí (Lough Ree)', pts: [[53.63,-7.98],[53.58,-7.90],[53.47,-7.92],[53.45,-7.98],[53.52,-8.05],[53.60,-8.03]] },
  { name: 'Loch Deirgeirt (Lough Derg)', pts: [[53.10,-8.25],[53.03,-8.22],[52.93,-8.27],[52.83,-8.40],[52.83,-8.45],[52.92,-8.40],[53.00,-8.33],[53.08,-8.30]] },
  { name: 'Loch Cuan (Strangford Lough)', pts: [[54.58,-5.70],[54.52,-5.62],[54.42,-5.57],[54.36,-5.58],[54.38,-5.66],[54.47,-5.72],[54.55,-5.74]] },
  { name: 'Loch Aillionn (Lough Allen)', pts: [[54.18,-8.05],[54.13,-8.01],[54.08,-8.05],[54.12,-8.10]] },
  { name: 'Loch Con (Lough Conn)', pts: [[54.08,-9.27],[54.03,-9.20],[53.96,-9.25],[54.00,-9.32]] },
];

// width in base pixels
export const RIVERS = [
  { name: 'An tSionainn (Shannon)', w: 2.2, pts: [[54.13,-8.05],[53.95,-8.09],[53.80,-8.00],[53.62,-7.95],[53.42,-7.94],[53.33,-7.99],[53.19,-7.98],[53.09,-8.22],[52.83,-8.42],[52.81,-8.44],[52.66,-8.63]] },
  { name: 'An Bhóinn (Boyne)', w: 1.4, pts: [[53.40,-7.05],[53.56,-6.79],[53.65,-6.68],[53.71,-6.54],[53.72,-6.30]] },
  { name: 'An Life (Liffey)', w: 1.3, pts: [[53.13,-6.62],[53.13,-6.75],[53.18,-6.80],[53.36,-6.49],[53.35,-6.24]] },
  { name: 'An Bhearú (Barrow)', w: 1.5, pts: [[53.10,-7.40],[52.99,-6.98],[52.84,-6.93],[52.60,-6.95],[52.39,-6.94],[52.25,-6.96]] },
  { name: 'An Fheoir (Nore)', w: 1.3, pts: [[52.95,-7.60],[52.80,-7.40],[52.65,-7.25],[52.49,-7.06],[52.40,-6.95]] },
  { name: 'An tSiúir (Suir)', w: 1.5, pts: [[52.80,-7.83],[52.68,-7.81],[52.50,-7.87],[52.38,-7.92],[52.35,-7.70],[52.35,-7.41],[52.26,-7.11],[52.25,-6.98]] },
  { name: 'An Abhainn Mhór (Blackwater)', w: 1.4, pts: [[52.20,-9.20],[52.13,-8.65],[52.14,-8.28],[52.14,-7.93],[52.00,-7.85],[51.95,-7.85]] },
  { name: 'An Laoi (Lee)', w: 1.2, pts: [[51.90,-9.20],[51.88,-8.80],[51.90,-8.47]] },
  { name: 'An Bhanna (Bann)', w: 1.5, pts: [[54.73,-6.50],[54.95,-6.55],[55.13,-6.67],[55.17,-6.77]] },
  { name: 'Upper Bann', w: 1.1, pts: [[54.30,-6.10],[54.38,-6.30],[54.48,-6.40]] },
  { name: 'An Éirne (Erne)', w: 1.4, pts: [[53.95,-7.35],[54.10,-7.45],[54.20,-7.40],[54.38,-7.65],[54.53,-7.97],[54.50,-8.19]] },
  { name: 'An Feabhal (Foyle)', w: 1.5, pts: [[54.62,-7.30],[54.83,-7.47],[55.00,-7.32],[55.05,-7.25]] },
  { name: 'An Mhuaidh (Moy)', w: 1.1, pts: [[53.95,-8.95],[54.05,-9.10],[54.15,-9.15]] },
  { name: 'An tSláine (Slaney)', w: 1.2, pts: [[52.95,-6.60],[52.75,-6.62],[52.50,-6.56],[52.34,-6.45]] },
  { name: 'An Choirib (Corrib)', w: 1.0, pts: [[53.30,-9.08],[53.27,-9.05]] },
  { name: 'An Mháigh (Maigue)', w: 1.0, pts: [[52.35,-8.70],[52.50,-8.70],[52.63,-8.80]] },
  { name: 'An tSuca (Suck)', w: 1.1, pts: [[53.85,-8.50],[53.60,-8.35],[53.33,-8.22],[53.19,-8.05]] },
];

// [type, lat, lon, radiusKm]
export const TERRAIN_BLOBS = [
  ['mountain',53.03,-6.38,20],['mountain',54.18,-5.98,9],['mountain',54.80,-7.05,15],['hills',54.95,-6.15,16],
  ['mountain',55.02,-8.05,16],['mountain',54.76,-8.12,10],['mountain',54.70,-8.55,8],['mountain',51.99,-9.75,14],
  ['mountain',51.88,-10.05,13],['mountain',52.20,-10.10,10],['mountain',51.70,-9.75,13],['hills',51.80,-9.25,12],
  ['mountain',52.37,-8.18,8],['hills',52.22,-7.92,9],['mountain',52.28,-7.55,8],['hills',53.08,-7.58,11],
  ['hills',52.80,-8.22,9],['mountain',53.50,-9.78,14],['mountain',53.65,-9.70,12],['mountain',54.00,-9.62,13],
  ['hills',54.10,-8.85,13],['hills',54.37,-8.40,9],['hills',54.20,-7.85,8],['hills',52.55,-6.80,8],
  ['hills',54.10,-6.43,7],['hills',52.30,-8.60,7],['hills',52.30,-9.15,12],['hills',52.95,-8.60,10],
  ['karst',53.07,-9.12,12],
  ['bog',53.30,-7.05,22],['bog',53.18,-7.75,24],['bog',53.70,-7.85,18],['bog',54.18,-9.70,24],['bog',53.40,-9.55,16],
  ['bog',53.55,-8.45,14],['bog',54.45,-6.62,10],['bog',53.95,-8.75,12],['bog',54.88,-8.25,12],['bog',52.45,-9.35,10],
  ['forest',54.82,-6.68,14],['forest',52.75,-6.55,12],['forest',52.40,-8.08,8],['forest',52.15,-8.95,14],
  ['forest',54.10,-6.62,9],['forest',53.25,-7.30,9],['forest',53.15,-8.65,12],['forest',54.40,-7.25,10],
  ['forest',52.70,-7.05,10],['forest',52.58,-7.65,9],['forest',53.80,-6.95,9],['forest',52.00,-9.55,8],
  ['forest',54.25,-8.20,9],['forest',54.60,-5.98,7],['forest',52.98,-6.80,8],['forest',51.85,-8.85,12],
  ['forest',53.45,-8.45,10],['forest',54.65,-7.75,9],['forest',53.95,-9.05,8],
  ['drumlin',54.10,-7.20,34],['drumlin',54.35,-5.95,14],['drumlin',53.85,-9.55,8],
  ['plains',53.58,-6.65,40],['plains',53.18,-6.85,18],['plains',53.90,-6.45,16],['plains',53.42,-6.30,14],
  ['plains',52.50,-8.05,30],['plains',52.58,-7.30,22],['plains',52.55,-8.75,22],['plains',51.95,-8.20,20],
  ['plains',53.75,-8.25,18],['plains',54.48,-6.05,18],['plains',52.35,-6.55,16],['plains',52.85,-6.95,14],
  ['plains',53.30,-8.75,14],['plains',54.95,-7.45,10],['plains',55.05,-6.60,10],
];

// [key, name, lat, lon, special]
export const PLACES = [
  // Leinster & Mide
  ['tara','Teamhair (Tara)',53.578,-6.612,'tara'],['dublin','Áth Cliath (Dublin)',53.347,-6.26,'port'],
  ['dunailinne','Dún Ailinne',53.10,-6.77,'royal'],['kildare','Cill Dara (Kildare)',53.157,-6.91,'church'],
  ['glendalough','Gleann Dá Loch (Glendalough)',53.01,-6.33,'church'],['drogheda','Droichead Átha (Drogheda)',53.717,-6.35,'port'],
  ['kells','Ceanannas (Kells)',53.726,-6.879,'church'],['trim','Baile Átha Troim (Trim)',53.555,-6.79],
  ['uisneach','Uisneach',53.488,-7.56,'royal'],['athlone','Áth Luain (Athlone)',53.423,-7.94,'ford'],
  ['clonmacnoise','Cluain Mhic Nóis (Clonmacnoise)',53.326,-7.986,'church'],['carlow','Ceatharlach (Carlow)',52.836,-6.93],
  ['wexford','Loch Garman (Wexford)',52.336,-6.463,'port'],['enniscorthy','Inis Córthaidh (Enniscorthy)',52.50,-6.56],
  ['newross','Ros Mhic Thriúin (New Ross)',52.396,-6.94],['kilkenny','Cill Chainnigh (Kilkenny)',52.654,-7.244],
  ['wicklow','Cill Mhantáin (Wicklow)',52.98,-6.04,'port'],['arklow','An tInbhear Mór (Arklow)',52.80,-6.15],
  ['swords','Sord (Swords)',53.46,-6.22],['birr','Biorra (Birr)',53.09,-7.91],['portlaoise','Port Laoise',53.03,-7.30],
  ['tullamore','Tulach Mhór (Tullamore)',53.27,-7.49],['longford','An Longfort (Longford)',53.73,-7.80],
  ['mullingar','An Muileann gCearr (Mullingar)',53.52,-7.34],['dundalk','Dún Dealgan (Dundalk)',54.00,-6.40],
  ['athy','Baile Átha Í (Athy)',52.99,-6.98],['ferns','Fearna (Ferns)',52.59,-6.50,'royal'],['louth','Lú (Louth)',53.95,-6.54],
  ['edenderry','Éadan Doire (Edenderry)',53.34,-7.05],['naas','Nás na Ríogh (Naas)',53.22,-6.66],
  // Munster
  ['cashel','Caiseal (Cashel)',52.516,-7.885,'royal'],['cork','Corcaigh (Cork)',51.898,-8.47,'port'],
  ['limerick','Luimneach (Limerick)',52.664,-8.63,'port'],['killarney','Cill Airne (Killarney)',52.06,-9.51],
  ['tralee','Trá Lí (Tralee)',52.27,-9.70],['dingle','An Daingean (Dingle)',52.14,-10.27,'port'],
  ['waterford','Port Láirge (Waterford)',52.259,-7.11,'port'],['dungarvan','Dún Garbhán (Dungarvan)',52.09,-7.62],
  ['youghal','Eochaill (Youghal)',51.95,-7.85,'port'],['lismore','Lios Mór (Lismore)',52.137,-7.93,'church'],
  ['kinsale','Cionn tSáile (Kinsale)',51.71,-8.52,'port'],['bantry','Beanntraí (Bantry)',51.68,-9.45],
  ['ennis','Inis (Ennis)',52.84,-8.98],['killaloe','Cill Dalua (Killaloe)',52.81,-8.44,'royal'],
  ['thurles','Durlas (Thurles)',52.68,-7.81],['clonmel','Cluain Meala (Clonmel)',52.355,-7.70],
  ['cahir','An Chathair (Cahir)',52.375,-7.92],['mallow','Mala (Mallow)',52.13,-8.65],
  ['rosscarbery','Ros Ó gCairbre (Rosscarbery)',51.58,-9.03,'church'],['emly','Imleach Iubhair (Emly)',52.46,-8.35,'church'],
  ['kenmare','Neidín (Kenmare)',51.88,-9.58],['cahersiveen','Cathair Saidhbhín (Cahersiveen)',51.95,-10.22],
  ['listowel','Lios Tuathail (Listowel)',52.45,-9.49],['tipperary','Tiobraid Árann (Tipperary)',52.47,-8.16],
  ['roscrea','Ros Cré (Roscrea)',52.95,-7.80],['nenagh','An tAonach (Nenagh)',52.86,-8.20],
  ['midleton','Mainistir na Corann (Midleton)',51.91,-8.17],['kilrush','Cill Rois (Kilrush)',52.64,-9.49],
  ['burren','Boirinn (The Burren)',53.03,-9.20],['macroom','Maigh Chromtha (Macroom)',51.90,-8.96],
  ['skibbereen','An Sciobairín (Skibbereen)',51.55,-9.27],
  // Connacht
  ['cruachan','Cruachan (Rathcroghan)',53.80,-8.30,'royal'],['galway','Gaillimh (Galway)',53.27,-9.05,'port'],
  ['sligo','Sligeach (Sligo)',54.27,-8.47,'port'],['westport','Cathair na Mart (Westport)',53.80,-9.52],
  ['ballina','Béal an Átha (Ballina)',54.115,-9.155],['roscommon','Ros Comáin (Roscommon)',53.63,-8.19],
  ['tuam','Tuaim (Tuam)',53.51,-8.85,'church'],['cong','Conga (Cong)',53.54,-9.29],['clifden','An Clochán (Clifden)',53.49,-10.02],
  ['athenry','Baile Átha an Rí (Athenry)',53.30,-8.75],['ballinasloe','Béal Átha na Sluaighe (Ballinasloe)',53.33,-8.22],
  ['killala','Cill Ala (Killala)',54.21,-9.22],['castlebar','Caisleán an Bharraigh (Castlebar)',53.85,-9.30],
  ['belmullet','Béal an Mhuirthead (Belmullet)',54.22,-9.99],['boyle','Mainistir na Búille (Boyle)',53.97,-8.30],
  ['carrick','Cora Droma Rúisc (Carrick-on-Shannon)',53.95,-8.09],['manorhamilton','Cluainín (Manorhamilton)',54.30,-8.18],
  ['portumna','Port Omna (Portumna)',53.09,-8.22],['gort','An Gort (Gort)',53.07,-8.82],['claremorris','Clár Chlainne Mhuiris (Claremorris)',53.72,-9.00],
  ['carraroe','An Cheathrú Rua (Carraroe)',53.26,-9.60],['achill','Acaill (Achill)',53.95,-9.90],
  // Ulster
  ['armagh','Ard Mhacha (Armagh / Emain Macha)',54.35,-6.67,'royal'],['derry','Doire (Derry)',54.97,-7.25,'church'],
  ['ailech','Ailech (Grianán)',55.02,-7.48,'royal'],['downpatrick','Dún Pádraig (Downpatrick)',54.33,-5.72,'church'],
  ['belfast','Béal Feirste (Belfast)',54.60,-5.93],['carrickfergus','Carraig Fhearghais (Carrickfergus)',54.715,-5.81,'port'],
  ['newry','An tIúr (Newry)',54.18,-6.34],['enniskillen','Inis Ceithleann (Enniskillen)',54.345,-7.64],
  ['monaghan','Muineachán (Monaghan)',54.25,-6.97],['cavan','An Cabhán (Cavan)',53.99,-7.36],
  ['dungannon','Dún Geanainn (Dungannon)',54.50,-6.77],['tullaghoge','Tulach Óg',54.62,-6.73,'royal'],
  ['letterkenny','Leitir Ceanainn (Letterkenny)',54.95,-7.73],['donegal','Dún na nGall (Donegal)',54.65,-8.11,'port'],
  ['coleraine','Cúil Raithin (Coleraine)',55.13,-6.67],['ballycastle','Baile an Chaistil (Ballycastle)',55.20,-6.24],
  ['omagh','An Ómaigh (Omagh)',54.60,-7.30],['stranorlar','Srath an Urláir (Stranorlar)',54.80,-7.77],
  ['lisburn','Lios na gCearrbhach (Lisburn)',54.51,-6.04],['bangor','Beannchar (Bangor)',54.66,-5.67,'church'],
  ['ards','An Aird (The Ards)',54.48,-5.50],['larne','Latharna (Larne)',54.85,-5.82],
  ['ballymena','An Baile Meánach (Ballymena)',54.86,-6.28],['magherafelt','Machaire Fíolta (Magherafelt)',54.75,-6.61],
  ['gweedore','Gaoth Dobhair (Gweedore)',55.05,-8.23],['raphoe','Ráth Bhoth (Raphoe)',54.87,-7.60,'church'],
  ['kilmacrenan','Cill Mhic Réanáin (Kilmacrenan)',55.03,-7.78,'royal'],['clones','Cluain Eois (Clones)',54.18,-7.23,'church'],
  ['ardara','Ard an Rátha (Ardara)',54.77,-8.41],['clogher','Clochar (Clogher)',54.41,-7.17,'royal'],
  ['strabane','An Srath Bán (Strabane)',54.83,-7.47],['cookstown','An Chorr Chríochach (Cookstown)',54.64,-6.75],
  ['carndonagh','Carn Domhnach (Carndonagh)',55.25,-7.26],['killybegs','Na Cealla Beaga (Killybegs)',54.63,-8.44],
  ['portadown','Port an Dúnáin (Portadown)',54.42,-6.44],['banbridge','Droichead na Banna (Banbridge)',54.35,-6.27],
];

export const NAME_PARTS = {
  mountain: ['Sliabh','Gleann','Mullach','Cnoc','Binn','Com'],
  hills: ['Cnoc','Ard','Mullach','Tulach','Druim','Sliabh'],
  bog: ['Móin','Currach','Achadh','Eanach','Cluain','Muine'],
  forest: ['Coill','Doire','Ros','Fiodh','Dair','Coillte'],
  coast: ['Port','Carraig','Inis','Bun','Trá','Rinn','Ceann'],
  drumlin: ['Druim','Cnoc','Leacht','Mullach','Lios'],
  karst: ['Carn','Cathair','Leacht','Lios'],
  default: ['Baile','Cill','Ráth','Lios','Cluain','Tulach','Dún','Gort','Achadh','Teach','Domhnach','Machaire','Áth'],
  suffix: ['Mór','Beag','na Manach','Bhuí','Fhada','Rua','Dubh','Gheal','na gCloch','an Fhia','Éanna','Bhríde','Chiaráin',
    'Cholmáin','Bhreandáin','na hAbhann','an Iúir','na Darach','na Coille','na Móna','an Locha','Chonaill','Phádraig',
    'Fhionáin','an Easa','na Sí','Laoire','Mhuire','Dá Chích','na Rí','an Chairn','Uí Fhiachrach','na nGabhar','Lughdach',
    'Bréanainn','an Fhéich','na Fearna','an Bhealaigh','Mhic Dara','na Leac','Ó gCuanach','na Bó','an Chnoic','Sheáin',
    'Muireadhaigh','Cormaic','Néill','an Ghabhann','Chuile','na Foraoise','Ultach','Cuain','Fothaid','Íde','Bhrain'],
};
