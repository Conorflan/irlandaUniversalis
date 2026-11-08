// Line icons drawn on a 16px grid. They inherit colour from the surrounding text.
const P = {
  coin: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v6M6.2 6.5h2.6a1.2 1.2 0 0 1 0 2.4H7.2a1.2 1.2 0 0 0 0 2.4h2.6"/>',
  cattle: '<path d="M2.5 4.5c1 1.2 2.2 1.5 3.5 1.5h4c1.3 0 2.5-.3 3.5-1.5"/><path d="M5 6v4.5a3 3 0 0 0 6 0V6"/><path d="M6.8 11.5h2.4"/>',
  men: '<circle cx="6" cy="5" r="2"/><path d="M2.5 13c0-2.2 1.6-4 3.5-4s3.5 1.8 3.5 4"/><circle cx="11" cy="5.5" r="1.6"/><path d="M10 9.2c2 0 3.5 1.6 3.5 3.8"/>',
  adm: '<path d="M2 6.5 8 3l6 3.5zM3.5 6.5v6M6.5 6.5v6M9.5 6.5v6M12.5 6.5v6M2 13.5h12"/>',
  dip: '<rect x="2" y="4" width="12" height="8.5" rx="1"/><path d="m2.5 4.8 5.5 4.2 5.5-4.2"/>',
  mil: '<path d="M8 2.2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z"/><path d="M8 5v6"/>',
  stab: '<path d="M8 3v10M4 13h8"/><path d="M3 6h10"/><path d="m3 6-1.5 3.5a1.6 1.6 0 0 0 3 0zM13 6l-1.5 3.5a1.6 1.6 0 0 0 3 0z"/>',
  prestige: '<path d="m8 2.3 1.7 3.6 3.9.5-2.9 2.7.7 3.9L8 11.1 4.6 13l.7-3.9-2.9-2.7 3.9-.5z"/>',
  realm: '<path d="M2.5 12.5h11M3 12.5 2 5l3.3 2.6L8 3l2.7 4.6L14 5l-1 7.5"/>',
  book: '<path d="M2 3.5h4.5A1.5 1.5 0 0 1 8 5v8.5a1.5 1.5 0 0 0-1.5-1.5H2zM14 3.5H9.5A1.5 1.5 0 0 0 8 5v8.5a1.5 1.5 0 0 1 1.5-1.5H14z"/>',
  rings: '<circle cx="6" cy="8" r="3.5"/><circle cx="10" cy="8" r="3.5"/>',
  swords: '<path d="M3 3l8.5 8.5M13 3l-8.5 8.5M10 13l3-3M3 10l3 3M11.5 11.5l1.5 1.5M4.5 11.5 3 13"/>',
  ledger: '<path d="M3.5 13V8.5M8 13V3.5M12.5 13V6.5M2 13.5h12"/>',
  annals: '<rect x="3" y="2" width="10" height="12" rx="1"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/>',
  menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  chev: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
  check: '<path d="m3 8.5 3 3 7-7"/>',
  play: '<path d="M5 3.2v9.6L12.5 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M4.5 3.5h2.2v9H4.5zM9.3 3.5h2.2v9H9.3z" fill="currentColor" stroke="none"/>',
  warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2v.1"/>',
  skull: '<path d="M3.5 7.5a4.5 4.5 0 0 1 9 0c0 1.6-.8 2.6-1.8 3.2V13H5.3v-2.3c-1-.6-1.8-1.6-1.8-3.2z"/><circle cx="6.2" cy="7.6" r=".9"/><circle cx="9.8" cy="7.6" r=".9"/>',
  leaf: '<path d="M3 13c0-6 4-10 10-10 0 6-4 10-10 10z"/><path d="M3 13 9 7"/>',
  pin: '<path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
};
export function ic(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
// A cost tag such as "25 ✉" rendered with the matching icon.
export function cost(n, kind) { return `<span class="cost">${ic({ gold: 'coin', adm: 'adm', dip: 'dip', mil: 'mil' }[kind] || kind)}${n}</span>`; }
