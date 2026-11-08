// Random flavour events. The player gets a choice; AI realms take the first option.
import { ctx, log, clamp } from './ctx.js';
import { addArmy } from './game.js';

const S_ = () => ctx.S, M_ = () => ctx.M, R = () => ctx.rng;
const randProv = c => c.provs.length ? R().pick(c.provs) : -1;

export const EVENTS = {
  satire: {
    title: 'The Satire of the Filí', mtth: 160,
    cond: c => c.culture === 'gaelic',
    text: c => `A poet of the ollam grade has composed a biting satire on ${c.ruler.name}'s meanness. Men say his face has broken out in blotches. The poet waits at the gate.`,
    options: [
      { text: 'Pay the poet richly (−25 wealth)', fx: c => { c.gold -= 25; c.prestige += 3; } },
      { text: 'Drive him away (−10 prestige)', fx: c => { c.prestige -= 10; } },
    ],
  },
  murrain: {
    title: 'Cattle Murrain', mtth: 180,
    cond: c => c.provs.length > 0,
    text: () => 'A sickness runs through the herds. Cows lie dead in the fields.',
    options: [{ text: 'A bitter year', fx: c => { for (const id of c.provs) S_().provinces[id].cattle *= 0.8; } }],
  },
  saint: {
    title: 'A Holy Man at Court', mtth: 60,
    cond: c => c.religion === 'pagan' && S_().instOn.christianity,
    text: c => 'A tonsured stranger asks leave to preach and to found a church. The druids warn that the old gods will be angered.',
    options: [
      { text: 'Grant him land for a church', fx: c => { const id = c.capital; S_().provinces[id].inst.christianity = Math.min(100, S_().provinces[id].inst.christianity + 50); c.stability = clamp(c.stability - 1, -3, 3); } },
      { text: 'Side with the druids (+1 stability)', fx: c => { c.stability = clamp(c.stability + 1, -3, 3); c.prestige -= 5; } },
    ],
  },
  tailten: {
    title: 'Óenach Tailten', mtth: 200,
    cond: c => c.culture === 'gaelic' && c.provs.length >= 6,
    text: () => 'The great assembly gathers for games, horse-racing and the settling of law. Hosting it would bring honour — and expense.',
    options: [
      { text: 'Host the games (−40 wealth, +15 prestige)', fx: c => { c.gold -= 40; c.prestige += 15; } },
      { text: 'Let others host', fx: () => {} },
    ],
  },
  galloglass: {
    title: 'Galloglass Seek Service', mtth: 90,
    cond: c => c.culture === 'gaelic' && S_().year >= 1250 && S_().year < 1620,
    text: () => 'A MacSweeney captain from the Isles offers his axe-men in return for land and keep.',
    options: [
      { text: 'Hire 300 galloglass (−60 wealth)', fx: c => { if (c.gold >= 60) { c.gold -= 60; addArmy(c.id, c.capital, { galloglass: 300 }); } } },
      { text: 'Send them away', fx: () => {} },
    ],
  },
  harvest: {
    title: 'A Fat Harvest', mtth: 150,
    cond: () => true,
    text: () => 'Calves are many and the grain stands high. Your people prosper.',
    options: [{ text: 'Excellent', fx: c => { for (const id of c.provs) S_().provinces[id].pop *= 1.02; c.gold += 10; } }],
  },
  derbfine: {
    title: 'Quarrel in the Derbfine', mtth: 140,
    cond: c => c.laws.succession === 'tanistry' && !!c.tanist,
    text: c => `Cousins of the royal kin dispute the choice of ${c.tanist.name} as tanist.`,
    options: [
      { text: 'Buy them off (−30 wealth)', fx: c => { c.gold -= 30; } },
      { text: 'Stand by the tanist (−1 stability)', fx: c => { c.stability = clamp(c.stability - 1, -3, 3); } },
      { text: 'Set the tanist aside', fx: c => { c.tanist = null; } },
    ],
  },
  monastery: {
    title: 'A Saint Founds a Monastery', mtth: 120,
    cond: c => c.inst.christianity && S_().year < 1150,
    text: () => 'A holy founder gathers monks in a quiet valley. Pilgrims and gifts will follow.',
    options: [{ text: 'Endow it', fx: c => { const id = randProv(c); const P = S_().provinces[id]; if (P && !P.bld.includes('church')) P.bld.push('church'); c.prestige += 5; } }],
  },
  kilkenny: {
    title: 'The Statutes of Kilkenny', mtth: 24,
    cond: c => c.culture === 'english' && S_().year >= 1366 && !S_().flags.kilkenny,
    text: () => 'The colonists are going native — speaking Irish, using Brehon law, fostering with Gaelic families. Parliament proposes harsh statutes to stop it.',
    options: [
      { text: 'Enforce the statutes', fx: c => { S_().flags.kilkenny = 1; for (const id of c.provs) if (S_().provinces[id].culture === 'gaelic') S_().provinces[id].boost += 2; c.stability = clamp(c.stability + 1, -3, 3); } },
      { text: 'Ignore them', fx: c => { S_().flags.kilkenny = 2; } },
    ],
  },
  regrant: {
    title: 'Surrender and Regrant', mtth: 36,
    cond: c => c.culture === 'gaelic' && S_().year >= 1541 && S_().year < 1600 && c.laws.succession === 'tanistry' && !c.flags_regrant && S_().countries.some(x => x.tag === 'ENG' && x.alive),
    text: () => 'The Crown offers to recognise you as an earl, with English title and inheritance, if you surrender your lands and receive them back under English law.',
    options: [
      { text: 'Accept the earldom (Primogeniture; Crown is pleased)', fx: c => { c.flags_regrant = 1; c.laws.succession = 'primogeniture'; c.heir = null; const e = S_().countries.find(x => x.tag === 'ENG'); if (e) e.rel[c.id] += 60; c.prestige -= 10; } },
      { text: 'Refuse — keep the old ways', fx: c => { c.flags_regrant = 2; c.prestige += 10; const e = S_().countries.find(x => x.tag === 'ENG'); if (e) e.rel[c.id] -= 30; } },
    ],
  },
};

export function eventsTick() {
  const S = S_();
  for (const c of S.countries) {
    if (!c.alive) continue;
    for (const [id, e] of Object.entries(EVENTS)) {
      if (!R().chance(1 / e.mtth) || !e.cond(c)) continue;
      if (c.id === S.player) S.pending.push({ kind: 'event', id });
      else e.options[0].fx(c);
      break;
    }
  }
}
export function resolveEvent(id, i) {
  const S = S_(), c = S.countries[S.player], e = EVENTS[id];
  e.options[i].fx(c);
  log(`${e.title}: ${e.options[i].text}`, 'info');
}
