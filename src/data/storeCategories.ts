/**
 * Store category and item config. Logo URLs use Clearbit (replace with your own assets if needed).
 */

export interface StoreItem {
  id: string;
  name: string;
  /** Optional logo URL; fallback shows first letter of name */
  logoUrl?: string;
}

export interface StoreCategoryConfig {
  id: string;
  title: string;
  items: StoreItem[];
}

/** Clearbit logo base - use domain for brand logos */
const logo = (domain: string) => `https://logo.clearbit.com/${domain}`;

export const STORE_PLAYERS_ITEMS: StoreItem[] = [
  { id: 'pga', name: 'PGA', logoUrl: logo('pgatour.com') },
  { id: 'lpga', name: 'LPGA', logoUrl: logo('lpga.com') },
  { id: 'dpworld', name: 'DP World Tour', logoUrl: logo('dpworld.com') },
  { id: 'kornferry', name: 'Korn Ferry Tour', logoUrl: logo('kornferry.com') },
  { id: 'liv', name: 'LIV', logoUrl: logo('livgolf.com') },
  { id: 'nfl', name: 'NFL', logoUrl: logo('nfl.com') },
  { id: 'mlb', name: 'MLB', logoUrl: logo('mlb.com') },
  { id: 'nba', name: 'NBA', logoUrl: logo('nba.com') },
  { id: 'nhl', name: 'NHL', logoUrl: logo('nhl.com') },
  { id: 'celebrities', name: 'Celebrities', logoUrl: undefined },
  { id: 'presidents', name: 'Presidents', logoUrl: undefined },
  { id: 'ceos', name: 'CEOs', logoUrl: undefined },
];

export const STORE_PREMIUM_MAPS_ITEMS: StoreItem[] = [
  { id: 'weather', name: 'Weather', logoUrl: logo('weather.com') },
  { id: 'elevation', name: 'Elevation', logoUrl: logo('mapbox.com') },
  { id: 'strackaline', name: 'StrackaLine', logoUrl: logo('strackaline.com') },
];

export const STORE_ORGS_ITEMS: StoreItem[] = [
  { id: 'usga', name: 'USGA', logoUrl: logo('usga.org') },
  { id: 'ncaa', name: 'NCAA', logoUrl: logo('ncaa.com') },
  { id: 'arccos', name: 'Arccos', logoUrl: logo('arccosgolf.com') },
  { id: 'trackman', name: 'Trackman', logoUrl: logo('trackman.com') },
  { id: 'topgolf', name: 'Topgolf', logoUrl: logo('topgolf.com') },
];

export const STORE_CATEGORIES: StoreCategoryConfig[] = [
  { id: 'players', title: 'Players', items: STORE_PLAYERS_ITEMS },
  { id: 'premium-maps', title: 'Premium Maps', items: STORE_PREMIUM_MAPS_ITEMS },
  { id: 'orgs', title: 'Orgs & Integrations', items: STORE_ORGS_ITEMS },
];
