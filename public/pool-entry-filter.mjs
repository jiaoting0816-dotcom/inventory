import {cards, norm} from './pool-center-core.mjs';

// CPs keep a third of a desktop row even when they have multiple editions.
export function entryLayout(asset) {
  const isTeam = ['lykn', 'jasper', 'clover', 'felizz'].includes(norm(asset.ip));
  return !isTeam ? 'pair' : cards(asset).length >= 6 ? 'wide' : 'team';
}

// Filtering never changes the draft or which cards are submitted.
export function entryCards(asset, query = '', quantities = {}, onlyFilled = false) {
  const terms = String(query).trim().split(/\s+/).map(norm).filter(Boolean);
  const group = [asset.ip, ...(asset.search_aliases || [])].map(norm).join(' ');
  const all = cards(asset);
  const memberTerms = new Set(terms.filter(term => all.some(card => norm(card.label).includes(term))));
  return all.filter(card => {
    return terms.every(term => memberTerms.has(term)
      ? norm(card.label).includes(term) : group.includes(term)) &&
      (!onlyFilled || Number(quantities[card.id]) > 0);
  });
}
