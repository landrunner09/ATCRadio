// src/data/gearCatalog.ts
import { Linking } from 'react-native'

export type CategoryId = 'headsets' | 'apps' | 'navigation' | 'kneeboards' | 'books'
export type BadgeType = 'TOP PICK' | 'BUDGET' | 'ESSENTIAL'

export interface GearProduct {
  id: string
  name: string
  tagline: string
  price: string
  category: CategoryId
  badge?: BadgeType
  affiliateUrl: string  // replace with tracking URL after joining each program
}

export const CATEGORIES: { id: CategoryId | 'all'; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'headsets',    label: 'Headsets' },
  { id: 'apps',        label: 'Apps' },
  { id: 'navigation',  label: 'Navigation' },
  { id: 'kneeboards',  label: 'Kneeboards' },
  { id: 'books',       label: 'Books' },
]

// affiliateUrl fields are placeholder direct links.
// Replace with your tracking URLs after joining each affiliate program:
//   Pilot Mall (10%):      https://affiliates.pilotmall.com/pilot-6/register
//   Pilot Institute (20%): https://pilotinstitute.com/affiliates/
//   Amazon Associates (3%): https://affiliate-program.amazon.com
//   Lightspeed Aviation:   https://www.lightspeedaviation.com/affiliate-area/
//   FlightInsight (20%):   https://www.flight-insight.com/affiliate
export const GEAR_PRODUCTS: GearProduct[] = [
  // ── Headsets ────────────────────────────────────────────────────────────
  {
    id: 'bose-proflight-2',
    name: 'Bose ProFlight 2',
    tagline: 'Best-in-class ANR for the flight deck',
    price: '$1,095',
    category: 'headsets',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.pilotmall.com/products/bose-proflight-series-2-aviation-headset',
  },
  {
    id: 'lightspeed-zulu3',
    name: 'Lightspeed Zulu 3',
    tagline: 'Premium comfort for long cross-countries',
    price: '$949',
    category: 'headsets',
    affiliateUrl: 'https://www.lightspeedaviation.com/zulu3/',
  },
  {
    id: 'lightspeed-sierra',
    name: 'Lightspeed Sierra',
    tagline: 'Full-featured at a mid-range price',
    price: '$599',
    category: 'headsets',
    affiliateUrl: 'https://www.lightspeedaviation.com/sierra/',
  },
  {
    id: 'david-clark-h10',
    name: 'David Clark H10-13.4',
    tagline: 'The bulletproof workhorse — every FBO has one',
    price: '$299',
    category: 'headsets',
    affiliateUrl: 'https://www.pilotmall.com/products/david-clark-h10-13-4-aviation-headset',
  },
  {
    id: 'rugged-air-ra452',
    name: 'Rugged Air RA452',
    tagline: 'Get started without breaking the bank',
    price: '$80',
    category: 'headsets',
    badge: 'BUDGET',
    affiliateUrl: 'https://www.amazon.com/dp/B01MYXKXH0',
  },
  // ── Apps & Subscriptions ─────────────────────────────────────────────────
  {
    id: 'pilot-institute-ppl',
    name: 'Pilot Institute Private Pilot',
    tagline: 'Top-rated online ground school',
    price: '$199',
    category: 'apps',
    badge: 'TOP PICK',
    affiliateUrl: 'https://pilotinstitute.com/course/private-pilot/',
  },
  {
    id: 'garmin-pilot',
    name: 'Garmin Pilot',
    tagline: 'Deep integration with Garmin avionics',
    price: '$199/yr',
    category: 'apps',
    affiliateUrl: 'https://www.pilotmall.com/products/garmin-pilot-app-subscription',
  },
  {
    id: 'flightinsight-gs',
    name: 'FlightInsight Ground School',
    tagline: 'Structured video curriculum for self-studiers',
    price: '$97',
    category: 'apps',
    affiliateUrl: 'https://www.flight-insight.com/private-pilot-ground-school',
  },
  {
    id: 'foreflight-basic',
    name: 'ForeFlight Basic',
    tagline: 'The EFB standard — every pilot eventually gets it',
    price: '$99/yr',
    category: 'apps',
    badge: 'ESSENTIAL',
    affiliateUrl: 'https://foreflight.com/products/foreflight-mobile/',
  },
  // ── Navigation ───────────────────────────────────────────────────────────
  {
    id: 'asa-cx3',
    name: 'ASA CX-3 Flight Computer',
    tagline: 'Electronic E6B with built-in flight planning',
    price: '$60',
    category: 'navigation',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.pilotmall.com/products/asa-cx-3-flight-computer',
  },
  {
    id: 'sportys-e6b',
    name: "Sporty's Electronic E6B",
    tagline: 'Compact and reliable for checkride day',
    price: '$20',
    category: 'navigation',
    affiliateUrl: 'https://www.pilotmall.com/products/sportys-electronic-e6b-flight-computer',
  },
  {
    id: 'asa-plotter',
    name: 'ASA VFR Plotter',
    tagline: 'Required for cross-country planning',
    price: '$8',
    category: 'navigation',
    affiliateUrl: 'https://www.amazon.com/dp/B000LPCSGE',
  },
  // ── Kneeboards ───────────────────────────────────────────────────────────
  {
    id: 'asa-kb3',
    name: 'ASA KB-3 Kneeboard',
    tagline: 'Secure clipboard for cockpit notes',
    price: '$35',
    category: 'kneeboards',
    badge: 'TOP PICK',
    affiliateUrl: 'https://www.pilotmall.com/products/asa-kb-3-kneeboard',
  },
  {
    id: 'sportys-kneeboard',
    name: "Sporty's Dual Ring Kneeboard",
    tagline: 'Two-ring design keeps pages flat',
    price: '$30',
    category: 'kneeboards',
    affiliateUrl: 'https://www.pilotmall.com/products/sportys-dual-ring-kneeboard',
  },
  // ── Books ────────────────────────────────────────────────────────────────
  {
    id: 'jeppesen-ppl',
    name: 'Jeppesen Private Pilot Manual',
    tagline: 'Comprehensive illustrated ground school text',
    price: '$70',
    category: 'books',
    affiliateUrl: 'https://www.amazon.com/s?k=Jeppesen+private+pilot+manual',
  },
  {
    id: 'rod-machado-ppl',
    name: "Rod Machado's Private Pilot Handbook",
    tagline: 'Conversational style, loved by self-studiers',
    price: '$55',
    category: 'books',
    affiliateUrl: 'https://www.amazon.com/s?k=Rod+Machado+private+pilot+handbook',
  },
  {
    id: 'far-aim-2025',
    name: 'FAR/AIM 2025',
    tagline: 'Required reading — regulations and procedures',
    price: '$20',
    category: 'books',
    badge: 'ESSENTIAL',
    affiliateUrl: 'https://www.amazon.com/s?k=FAR+AIM+2025',
  },
  {
    id: 'phak',
    name: "Pilot's Handbook of Aeronautical Knowledge",
    tagline: "The FAA's own textbook — print beats PDF",
    price: '$14',
    category: 'books',
    affiliateUrl: 'https://www.amazon.com/dp/1644251345',
  },
]

export function openProduct(product: GearProduct): void {
  Linking.openURL(product.affiliateUrl).catch(() => {})
}

export function filterProducts(category: CategoryId | 'all'): GearProduct[] {
  if (category === 'all') return GEAR_PRODUCTS
  return GEAR_PRODUCTS.filter(p => p.category === category)
}
