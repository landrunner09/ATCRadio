# ATCRadio — Google Play Store Launch Guide

A complete, in-order playbook for publishing ATCRadio to the Google Play Store.
This document is specific to the ATCRadio app. Bhagavad Gita app guidance lives
elsewhere; don't intermix.

---

## 1. App name strategy

Pick a name that **wins searches** and **describes the value** in under 30
characters (Play Store hard cap is 30). Three options ranked:

### Recommended: **ATCRadio — Pilot Comms Trainer**
- Brand-first, descriptive subtitle
- 32 chars in display, fits the 30-char hard cap if you drop the en-dash:
  `ATCRadio: Pilot Comms Trainer` (29 chars)
- "Pilot" and "Trainer" are high-intent search terms
- Reads professional, not spammy

### Alternative: **VFR Radio Coach**
- Three high-value SEO words
- Differentiates from generic "ATC sim" apps
- Shorter, sharper, but loses the ATCRadio brand recognition

### Avoid:
- "ATC Sim" (saturated category — you compete with traffic-control sims)
- "Radio Pilot" (wrong word order, ambiguous)
- Anything with emojis or marketing fluff like "Pro" / "Ultimate"

**Recommendation:** Use `ATCRadio: Pilot Comms Trainer` as the Play Store
title, keep `ATCRadio` as the launcher icon label (under 11 chars, no
truncation on home screen).

---

## 2. Pre-publishing legal & accounts

Do these BEFORE you touch the build:

### 2.1 Google Play Console account
- **Cost:** $25 one-time registration fee
- **Sign up:** https://play.google.com/console/signup
- Choose **Personal** or **Organisation** account. Organisation requires a
  D-U-N-S number (free, ~5 day approval at https://www.dnb.com/duns-number/get-a-duns.html).
  For solo founder, Personal is fine.
- Identity verification (passport or driver's license) takes 1-3 days. Start now.

### 2.2 Developer payment profile
Required to publish anything (even free apps). Bank account for affiliate /
subscription revenue if you add IAP later.

### 2.3 Privacy policy (REQUIRED — Play Store will reject without one)
You need a publicly hosted privacy policy URL. Quick option: use a generator
like https://app.termly.io/dashboard/website/free-privacy-policy and host the
output at `https://atcradio.vercel.app/privacy`. Add an Expo route:

```typescript
// app/privacy.tsx — markdown rendering or just HTML
```

Privacy policy MUST disclose:
- Microphone usage (for ASR)
- Audio recordings sent to OpenAI / AssemblyAI (third-party processors)
- Supabase Auth (email collection)
- Optional Amazon Associates / other affiliate cookies on outbound links
- Children's policy (you'll likely set the app to 16+ — see §6.2)

### 2.4 Terms of Service (optional but recommended)
Especially if you charge later. Same generator works. Host at
`https://atcradio.vercel.app/terms`.

---

## 3. Brand assets (specs & checklist)

Google Play has strict size requirements. Have these ready in two
sizes/formats each. Tools: Figma, Photoshop, or Canva.

### 3.1 App icon — REQUIRED
- **Adaptive icon foreground:** 432×432 px PNG (transparent background)
- **Adaptive icon background:** solid color or simple gradient
- **Legacy icon:** 512×512 px PNG (rendered fallback)
- Design notes:
  - High contrast — readable at 48dp launcher size
  - Recommended: dark cyan-on-navy (matches the in-app theme `#6FE3FF` on `#06080F`)
  - Avoid text — icon is too small to read words
  - Recommended motif: stylised radio waveform + tower symbol, or a sectional
    chart compass rose

Expo configures these in `app.json`:
```json
{
  "expo": {
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon-foreground.png",
        "backgroundColor": "#06080F"
      },
      "icon": "./assets/icon.png"
    }
  }
}
```

### 3.2 Feature graphic — REQUIRED
- **1024×500 px** JPG or PNG, ≤1 MB
- Shown at the top of the Play Store listing
- Treat it like a billboard. The title text + 1 strong visual:
  - **Headline:** "Master VFR Radio Calls"
  - **Visual:** Garmin-style ACT/STBY radio render or a clean cockpit silhouette
  - Avoid splatter design — keep it clean and aviation-themed

### 3.3 Screenshots — REQUIRED (minimum 2, recommend 6-8)
- **Phone:** 16:9 (1080×1920) or 9:16 (1920×1080), 320-3840 px on each side
- **7-inch tablet:** 1024×600 or 1200×1920
- **10-inch tablet:** 1920×1200 or 2560×1600

Recommended screenshot sequence (tells a story for the store browser):
1. **Hero shot** — HUD mid-flight, with ATC card showing "wind 310 at 8, runway 31L, cleared for takeoff" overlaid with "Train Real ATC Radio Calls"
2. **The Garmin radio** — ComRadio panel close-up, "Real Garmin-Style ACT/STBY Radio" caption
3. **AI coaching** — debrief screen showing slot-by-slot grading + textbook phrasing
4. **Airport picker** — multiple airports (KRHV, KLVK, etc.) with "200+ Airports — Any US Class D"
5. **Practice mode** — drill screen showing skill-by-skill selection
6. **Stats** — mastery dashboard
7. **Multiple accents** — settings page showing auto-detected ATC voices (USA/UK/AU/etc.)
8. **Marketing close** — text-heavy slide: "From Pre-Flight to Pattern. AIM-Compliant. Built by a CFI."

Annotation tool: **Mockuphone** (free) or Figma — overlay the screenshot in a
phone frame with marketing text. Avoid raw, unframed screenshots.

### 3.4 Optional: Promo video
- **YouTube link**, 30 seconds, 1080p
- Walks through one complete KRHV scenario: ATIS listen → taxi call → takeoff →
  debrief. Captioned for sound-off auto-play.
- Boosts conversion significantly (Google's own data: +35% install rate when
  present).

---

## 4. Store listing content

Two slots — short and full. Both shown to users on the listing page.

### 4.1 Short description — 80 characters max

```
FAA-accurate VFR radio call trainer with real-time AI coaching and ATC scoring.
```
(78 chars — leaves room for a 2-char emoji if you want one)

### 4.2 Full description — 4,000 characters max
Use the structure: hook → problem → solution → features → social proof → CTA.

```
Master Private Pilot radio communications with the only training app that grades you against real FAA standards.

THE PROBLEM
Most student pilots struggle with the mic. Flight schools don't have time to drill radio calls. Listening to LiveATC alone doesn't teach you how to speak. Your CFI is paid to fix your stalls, not your ATIS readbacks.

ATCRADIO FIXES THAT
Practice every Class D radio scenario — from ATIS extraction to taxi-to-parking — with realistic AI-generated ATC voices in your headphones and instant slot-by-slot grading of every readback.

WHAT YOU GET
• 200+ US airports — generated dynamically, with accurate Tower / Ground / Approach / ATIS frequencies from the FAA database
• Real Garmin-style ACT/STBY radio panel — tune the standby frequency and swap, just like a Cessna 172 panel
• AIM-correct phraseology — every controller line follows FAA AIM Chapter 4 and AC 90-66C exactly
• Tolerant grading — the app accepts every valid form of your readback ("25R", "25 right", "two five right") but coaching shows you the precise textbook version
• Regional ATC voices — automatic accent detection: FAA American at KRHV, UK CAA at EGLL, Airservices Australia at YSSY
• Drill mode — pick the one beat you keep flunking (Cleared for Takeoff readback?) and rep it
• Listening practice — ATIS broadcasts include time, sky, temperature, dewpoint, NOTAMs

WHO IT'S FOR
• Student pilots prepping for first solo or checkride
• Sport / Recreational pilots brushing up before a BFR
• CFIs who want their students to arrive prepared
• Anyone transitioning from uncontrolled to towered fields

DESIGNED BY A PILOT
Built around real FAA standards — AIM Chapter 4, AC 90-66C, P/CG. No fake phraseology, no Hollywood mic-flipping.

PRIVACY
Microphone audio is processed for transcription only and never stored. Email used solely for sign-in. See full policy: https://atcradio.vercel.app/privacy

START FLYING WITH CONFIDENCE
Download ATCRadio today and stop sounding like a student on the radio.
```

### 4.3 Tags / category
- **Category:** Education (NOT Travel — Education ranks better for trainers)
- **Tags:** Aviation, Pilot Training, FAA, Radio Communications, ATC, IFR, VFR, Cessna

### 4.4 Email + website + phone
- **Developer email:** Use a real address you check. Play reviews send tickets here.
- **Website:** https://atcradio.vercel.app
- **Phone:** optional but recommended for trust (use Google Voice for a free number)

---

## 5. Pricing & monetization model

### Recommended: Free + In-App Purchase ($14.99 one-time unlock OR $4.99/month subscription)
- Free tier: first 2 scenarios at KRHV + KLVK (taste of full flow, AI coaching, real ATC voices)
- Paid tier: unlocks all 200+ airports, drill mode, mastery stats, debrief PDF export
- One-time unlock has higher store conversion than subscriptions for sub-$20 prices

Subscription is better long-term revenue but requires Google Play Billing
integration (~2 days of dev work). Start with one-time, switch later.

### Alternative: Pure paid app, $9.99 flat
- Simpler — no IAP code needed
- Lower install volume (Play Store strongly favours free apps)
- No funnel for affiliate gear revenue if installs are blocked

### Affiliate revenue path (orthogonal to app price)
Already wired in `src/data/affiliateConfig.ts`. Activate by:
1. Apply for Amazon Associates: https://affiliate-program.amazon.com (instant approval)
2. Apply for Pilot Institute affiliate (20% commission): https://pilotinstitute.com/affiliates/
3. Apply for Pilot Mall (10%): https://affiliates.pilotmall.com/pilot-6/register
4. Apply for Lightspeed (~7%): https://www.lightspeedaviation.com/affiliate-area/
5. Apply for FlightInsight (20%): https://www.flight-insight.com/affiliate
6. Set the env vars on Vercel:
   - `EXPO_PUBLIC_AMAZON_TAG=atcradio-20` (or whatever Amazon assigns)
   - `EXPO_PUBLIC_PILOTMALL_REF=YOURCODE`
   - `EXPO_PUBLIC_PILOTINSTITUTE_REF=YOURCODE`
   - `EXPO_PUBLIC_LIGHTSPEED_REF=YOURCODE`
   - `EXPO_PUBLIC_FLIGHTINSIGHT_REF=YOURCODE`
7. Redeploy. All gear-tab clicks will now include your tracking parameter.

**Revenue expectation:** A trained pilot buying a Bose A30 ($1,295) at 3% Amazon
commission = $38.85 per conversion. Headsets are the highest-AOV category in
the gear list.

---

## 6. Content rating & policy

### 6.1 Content rating questionnaire
Google's IARC questionnaire takes ~5 mins. ATCRadio answers:
- Violence: None
- Sex/nudity: None
- Profanity: None (though ATC controllers say "Roger" not "Yeah, copy" — keep it clean)
- Drugs/alcohol: None
- Gambling: None
- User-generated content: None
- Location sharing: No
- Personal info collected: Email, microphone (transcript only, not stored)

Result: **Everyone (E)** rating.

### 6.2 Target audience
- **Recommended target age range:** 16+ (the FAA student pilot certificate minimum age is 16)
- Setting target age 16+ avoids the COPPA / Children's Online Privacy hassle
  — Google requires extra disclosures for apps that target under-13

### 6.3 Data safety form
Required for all new apps. Be honest. The form asks what data is:
- Collected (email, microphone audio, scenario completion stats)
- Shared with third parties (OpenAI, AssemblyAI, Supabase — list each)
- Used to track user behavior (analytics if you add PostHog/etc. later)

Honesty here protects you from removal later. Lying gets your app pulled.

---

## 7. Build & sign the AAB

### 7.1 Install EAS CLI
```bash
npm install -g eas-cli
eas login    # uses your Expo account
```

### 7.2 Configure
```bash
cd /Users/shekarmurthy/Documents/ATCRadio
eas build:configure
```

This adds an `eas.json` file. Choose the **Production** profile for Play Store
builds.

### 7.3 Set the bundle identifier
In `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "com.shekarmurthy.atcradio",
      "versionCode": 1
    },
    "version": "1.0.0"
  }
}
```

`versionCode` is an integer that MUST increment with every Play Store upload.
`version` is the user-visible string (1.0.0 → 1.0.1 → etc.).

### 7.4 Build the production AAB
```bash
eas build --platform android --profile production
```

EAS builds in the cloud (10-15 mins) and gives you a download link for the
`.aab` file. EAS auto-manages the signing keystore — Expo holds it. To migrate
keystores later (e.g. moving off EAS), you'd need `eas credentials`.

### 7.5 Local builds (alternative)
If you want full control:
```bash
npx expo run:android --variant release
# generates an APK in android/app/build/outputs/apk/release/
```
For Play Store you need an `.aab` (Android App Bundle), not an APK. Use
`eas build --profile production --local` for that.

---

## 8. Upload & release tracks

Play Console has four release tracks. Use them in order:

### 8.1 Internal testing (start here)
- Upload the AAB to **Internal testing**
- Add yourself + 2-3 trusted pilots as testers (email allowlist)
- Available within an hour
- No review delay — direct upload to allowed accounts
- Goal: catch crashes and obvious bugs before broader exposure

### 8.2 Closed testing (alpha)
- 20-100 invited testers
- Real Play Store review (3-7 days first time, ~24h after)
- Test on different Android versions / device sizes
- Get feedback through the Play Console feedback mechanism

### 8.3 Open testing (beta)
- Public opt-in via a Play Store link
- Up to 10,000 testers
- Use this for ~2 weeks before production
- Build hype + collect early reviews (reviews carry over to production)

### 8.4 Production
- Live on Play Store
- First production release requires the longest review (7-14 days possible)
- After that, updates typically clear in 24-48h

### Rollout percentage
For production, start at 5-10% rollout. Watch crash rate for 48h. Bump to 25%,
50%, 100% over a week. Google makes this trivial through the console.

---

## 9. Post-launch operations

### 9.1 Monitor
- Play Console **Vitals** — crash rate, ANR rate (target both <0.5%)
- Play Console **Statistics** — install rate, conversion rate from listing visit
- Reviews — respond to every 1-3 star review within 48h, polite + actionable

### 9.2 Optimize listing (App Store Optimization)
- A/B test the feature graphic + first screenshot — Play Console has built-in
  experiments
- Watch which keywords drive installs (Search Console-like data in Play Console)

### 9.3 Updates cadence
- 1-2 releases per month signals "active development" to the algorithm
- Bug-fix-only releases between feature updates keep crash rate low
- Each release: increment versionCode, write release notes (visible to users)

---

## 10. Quick-start checklist (chronological)

```
[ ] Sign up for Google Play Console ($25)              → 1-3 days for ID verify
[ ] Create developer payment profile
[ ] Write privacy policy + terms; host at /privacy /terms
[ ] Apply for Amazon Associates (instant approval)
[ ] Apply for Pilot Institute, Pilot Mall, Lightspeed, FlightInsight (1-2 weeks)
[ ] Design app icon (foreground 432×432 + background)
[ ] Design feature graphic (1024×500)
[ ] Capture + annotate 6-8 screenshots
[ ] Record 30s promo video (optional but ~+35% conversion)
[ ] Write short description (80 char) + full description (4000 char)
[ ] Complete content rating questionnaire (5 mins)
[ ] Complete data safety form (10 mins, be honest)
[ ] eas build --platform android --profile production
[ ] Upload AAB to Internal Testing track, invite testers
[ ] After 1 week of internal testing: promote to Closed Testing
[ ] After 2 weeks of closed testing: promote to Open Testing (beta)
[ ] After 2 weeks of beta + Vitals look healthy: Production at 5% rollout
[ ] Ramp rollout 5% → 25% → 50% → 100% over 1 week
[ ] Set up affiliate tag env vars on Vercel + redeploy web build
```

---

## 11. Common rejection reasons (and how to avoid them)

| Reason | Fix |
|---|---|
| No privacy policy URL | Host one at `/privacy` before submitting |
| Microphone permission with no explanation | Pre-PTT, show a tooltip explaining audio is for grading only |
| Misleading screenshots | All screenshots must show actual app — no marketing mockups that don't match the UI |
| Repeat content from another app | If you do the Bhagavad Gita app under the same dev account, keep visual identity distinct |
| Broken affiliate links | Test every gear-tab link before submitting |
| Children's data without COPPA compliance | Target 16+ in the Data Safety form |
| Default icon (the Expo splash) | Replace BEFORE uploading |
| Crashes on common devices | Internal test on at least one Pixel + one Samsung mid-range |

---

## 12. Bhagavad Gita app — pointer

The Bhagavad Gita app gets its own launch doc. Don't pour Sanskrit / dharma
content into this ATCRadio doc, and don't put PPL phraseology into the BG doc.
Keep brand identities, privacy policies, and store listings distinct under
the same developer account.
