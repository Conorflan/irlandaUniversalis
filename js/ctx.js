// Shared runtime context: current map, state and RNG.
import { RNG } from './rng.js';
import { MONTHS } from './data.js';

export const ctx = { M: null, S: null, rng: new RNG(1), listeners: [] };

export function dateStr(S = ctx.S) { return `${MONTHS[S.month]} ${S.year}`; }

export function log(text, kind = 'info', opts = {}) {
  const S = ctx.S;
  const entry = { d: dateStr(S), text, kind, ...opts };
  S.log.push(entry);
  if (S.log.length > 250) S.log.splice(0, S.log.length - 250);
  for (const f of ctx.listeners) f(entry);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
