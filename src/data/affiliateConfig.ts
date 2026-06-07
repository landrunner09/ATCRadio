// src/data/affiliateConfig.ts
// Affiliate program tracking IDs. Replace placeholders with the real IDs once
// each program approves your application.
//
// To activate revenue:
//   1. Sign up for the programs listed below (commission rates noted).
//   2. Each program issues a tracking ID/tag/code.
//   3. Paste the ID into the matching env var on Vercel:
//        EXPO_PUBLIC_AMAZON_TAG=atcradio-20
//        EXPO_PUBLIC_PILOTMALL_REF=YOURCODE
//        EXPO_PUBLIC_PILOTINSTITUTE_REF=YOURCODE
//        EXPO_PUBLIC_LIGHTSPEED_REF=YOURCODE
//        EXPO_PUBLIC_FLIGHTINSIGHT_REF=YOURCODE
//   4. Redeploy. The constants below pick up the env vars at build time.
//
// Programs ranked by commission rate (highest first):
//   FlightInsight     — 20%  apply: https://www.flight-insight.com/affiliate
//   Pilot Institute   — 20%  apply: https://pilotinstitute.com/affiliates/
//   Pilot Mall        — 10%  apply: https://affiliates.pilotmall.com/pilot-6/register
//   Lightspeed Aviat. —  7%  apply: https://www.lightspeedaviation.com/affiliate-area/
//   Amazon Associates —  3%  apply: https://affiliate-program.amazon.com

export const AFFILIATE_TAGS = {
  amazon: process.env.EXPO_PUBLIC_AMAZON_TAG ?? '',
  pilotmall: process.env.EXPO_PUBLIC_PILOTMALL_REF ?? '',
  pilotinstitute: process.env.EXPO_PUBLIC_PILOTINSTITUTE_REF ?? '',
  lightspeed: process.env.EXPO_PUBLIC_LIGHTSPEED_REF ?? '',
  flightinsight: process.env.EXPO_PUBLIC_FLIGHTINSIGHT_REF ?? '',
}

/**
 * Decorate a raw URL with the right affiliate tracking parameter for the
 * destination domain. Returns the original URL unchanged if no tag is set
 * for that program (so the link still works pre-revenue).
 */
export function withAffiliateTracking(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()

    // Amazon — append `tag=`, the canonical affiliate parameter
    if (host.endsWith('amazon.com') && AFFILIATE_TAGS.amazon) {
      u.searchParams.set('tag', AFFILIATE_TAGS.amazon)
      return u.toString()
    }

    // Pilot Mall — append `?ref=` (their standard affiliate format)
    if (host.endsWith('pilotmall.com') && AFFILIATE_TAGS.pilotmall) {
      u.searchParams.set('ref', AFFILIATE_TAGS.pilotmall)
      return u.toString()
    }

    // Pilot Institute — append `?aff=`
    if (host.endsWith('pilotinstitute.com') && AFFILIATE_TAGS.pilotinstitute) {
      u.searchParams.set('aff', AFFILIATE_TAGS.pilotinstitute)
      return u.toString()
    }

    // Lightspeed Aviation — append `?utm_source=affiliate&utm_id=`
    if (host.endsWith('lightspeedaviation.com') && AFFILIATE_TAGS.lightspeed) {
      u.searchParams.set('utm_source', 'affiliate')
      u.searchParams.set('utm_id', AFFILIATE_TAGS.lightspeed)
      return u.toString()
    }

    // FlightInsight — append `?ref=`
    if (host.endsWith('flight-insight.com') && AFFILIATE_TAGS.flightinsight) {
      u.searchParams.set('ref', AFFILIATE_TAGS.flightinsight)
      return u.toString()
    }

    return url
  } catch {
    return url
  }
}

/**
 * Log a product click. Today this just goes to console; wire it into Supabase
 * or PostHog later for funnel analysis (which products drive most clicks /
 * which categories convert / which sources have highest commission).
 */
export function trackClick(productId: string, destinationUrl: string): void {
  const trackedUrl = withAffiliateTracking(destinationUrl)
  // eslint-disable-next-line no-console
  console.log('[gear-click]', { productId, destinationUrl, trackedUrl })
}
