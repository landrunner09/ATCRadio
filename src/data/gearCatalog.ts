// src/data/gearCatalog.ts
// Curated list of gear ATCRadio recommends to student pilots. Every product
// link is decorated with affiliate tracking at click time (see affiliateConfig).
//
// Curation principles:
//   - Only items I'd recommend to my own student (no "filler" SKUs).
//   - At least one BUDGET pick and one TOP PICK per category.
//   - Direct product URLs (not search results) — fewer clicks to checkout.
//
// To update commission rates: see src/data/affiliateConfig.ts header.

import { Linking } from 'react-native'
import { withAffiliateTracking, trackClick } from './affiliateConfig'

export type CategoryId = 'headsets' | 'apps' | 'navigation' | 'kneeboards' | 'books'
export type BadgeType = 'TOP PICK' | 'BUDGET' | 'ESSENTIAL'

export interface GearProduct {
  id: string
  name: string
  tagline: string
  price: string
  category: CategoryId
  badge?: BadgeType
  affiliateUrl: string
}

export const CATEGORIES: { id: CategoryId | 'all'; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'headsets',    label: 'Headsets' },
  { id: 'apps',        label: 'Apps' },
  { id: 'navigation',  label: 'Navigation' },
  { id: 'kneeboards',  label: 'Kneeboards' },
  { id: 'books',       label: 'Books' },
]

export const GEAR_PRODUCTS: GearProduct[] = [
  // ── Headsets ────────────────────────────────────────────────────────────
  {
    id: 'bose-a30',
    name: 'Bose A30',
    tagline: 'Industry benchmark ANR — quiet enough for long XCs',
    price: '$1,299',
    category: 'headsets',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.amazon.com/dp/B0C2J42BKC',
  },
  {
    id: 'lightspeed-zulu3',
    name: 'Lightspeed Zulu 3',
    tagline: 'Premium comfort + 7-year warranty, half the Bose price',
    price: '$949',
    category: 'headsets',
    affiliateUrl: 'https://www.lightspeedaviation.com/products/zulu-3-headset/',
  },
  {
    id: 'lightspeed-sierra',
    name: 'Lightspeed Sierra',
    tagline: 'ANR without the premium tag — great first headset',
    price: '$650',
    category: 'headsets',
    badge: 'BUDGET',
    affiliateUrl: 'https://www.lightspeedaviation.com/products/sierra-headset/',
  },
  {
    id: 'david-clark-one-x',
    name: 'David Clark ONE-X',
    tagline: 'Light, durable ANR from the workhorse brand',
    price: '$895',
    category: 'headsets',
    affiliateUrl: 'https://www.amazon.com/dp/B00FYJCQQ8',
  },
  {
    id: 'david-clark-h10-13.4',
    name: 'David Clark H10-13.4',
    tagline: 'Classic passive — tank-tough for the rental fleet',
    price: '$355',
    category: 'headsets',
    badge: 'BUDGET',
    affiliateUrl: 'https://www.amazon.com/dp/B00069E602',
  },

  // ── Apps & Subscriptions ────────────────────────────────────────────────
  {
    id: 'foreflight',
    name: 'ForeFlight Basic Plus',
    tagline: 'The standard EFB — charts, weather, flight plan filing',
    price: '$120/yr',
    category: 'apps',
    badge: 'ESSENTIAL',
    affiliateUrl: 'https://foreflight.com/products/foreflight-mobile/',
  },
  {
    id: 'pilot-institute-ppl',
    name: 'Pilot Institute Private Pilot',
    tagline: 'Full PPL ground school — written-test prep included',
    price: '$199',
    category: 'apps',
    badge: 'TOP PICK',
    affiliateUrl: 'https://pilotinstitute.com/courses/private-pilot/',
  },
  {
    id: 'sportys-pilot-training',
    name: "Sporty's Learn to Fly Course",
    tagline: 'Video-first PPL curriculum — pairs well with flight lessons',
    price: '$280',
    category: 'apps',
    affiliateUrl: 'https://www.sportys.com/learn-to-fly-course.html',
  },

  // ── Navigation ──────────────────────────────────────────────────────────
  {
    id: 'stratus-3',
    name: 'Stratus 3',
    tagline: 'In-cockpit ADS-B traffic + weather, no subscription',
    price: '$699',
    category: 'navigation',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.amazon.com/dp/B07HJ9KFRR',
  },
  {
    id: 'sentry-mini',
    name: 'Sentry Mini',
    tagline: 'ADS-B-in for ForeFlight — pocketable backup',
    price: '$499',
    category: 'navigation',
    badge: 'BUDGET',
    affiliateUrl: 'https://www.amazon.com/dp/B07Y8KQSVT',
  },
  {
    id: 'garmin-d2-mach-1',
    name: 'Garmin D2 Mach 1 Watch',
    tagline: 'Wrist-mounted backup nav + flight logging',
    price: '$1,295',
    category: 'navigation',
    affiliateUrl: 'https://www.amazon.com/dp/B09T6JM8LY',
  },

  // ── Kneeboards ──────────────────────────────────────────────────────────
  {
    id: 'flight-gear-ipad-kneeboard',
    name: 'Flight Gear iPad Kneeboard',
    tagline: 'Pivoting mount — works in tight C172/C152 cockpits',
    price: '$45',
    category: 'kneeboards',
    badge: 'BUDGET',
    affiliateUrl: 'https://www.amazon.com/dp/B009UJVT38',
  },
  {
    id: 'mygoflight-folio',
    name: 'MyGoFlight Folio C',
    tagline: 'Premium leather — fits iPad Mini through Pro 11',
    price: '$159',
    category: 'kneeboards',
    affiliateUrl: 'https://www.amazon.com/dp/B07YC3GG3X',
  },
  {
    id: 'asa-tri-fold',
    name: 'ASA VFR Tri-Fold Kneeboard',
    tagline: 'Paper sectional + checklist holder — pre-checkride classic',
    price: '$29',
    category: 'kneeboards',
    affiliateUrl: 'https://www.amazon.com/dp/B000XX9OAQ',
  },

  // ── Books ───────────────────────────────────────────────────────────────
  {
    id: 'far-aim-current',
    name: 'FAR/AIM 2026',
    tagline: 'Reference you actually need on the checkride',
    price: '$22',
    category: 'books',
    badge: 'ESSENTIAL',
    affiliateUrl: 'https://www.amazon.com/dp/1644253291',
  },
  {
    id: 'phak',
    name: "Pilot's Handbook of Aeronautical Knowledge",
    tagline: "The FAA's own textbook — print beats PDF",
    price: '$32',
    category: 'books',
    affiliateUrl: 'https://www.amazon.com/dp/1644251345',
  },
  {
    id: 'airplane-flying-handbook',
    name: 'Airplane Flying Handbook',
    tagline: 'FAA H-8083-3C — the maneuvers reference',
    price: '$28',
    category: 'books',
    affiliateUrl: 'https://www.amazon.com/dp/1644251353',
  },
  {
    id: 'say-again-please',
    name: 'Say Again, Please',
    tagline: 'Bob Gardner — the classic VFR comms book',
    price: '$25',
    category: 'books',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.amazon.com/dp/1619544857',
  },
]

export function openProduct(product: GearProduct): void {
  const trackedUrl = withAffiliateTracking(product.affiliateUrl)
  trackClick(product.id, product.affiliateUrl)
  Linking.openURL(trackedUrl).catch(() => {})
}

export function filterProducts(category: CategoryId | 'all'): GearProduct[] {
  if (category === 'all') return GEAR_PRODUCTS
  return GEAR_PRODUCTS.filter(p => p.category === category)
}
