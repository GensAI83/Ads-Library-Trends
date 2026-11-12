// Client-side data layer for the standalone Vercel build of Ads Library Trends.
//
// The Muse version served the same catalog through server actions backed by
// a Drizzle/SQLite watchlist (see the original space's server/src/actions.ts).
// This standalone build has NO backend: filtering / Trend Score computation
// run in the browser over the embedded sample dataset (src/sampleData.ts),
// and the watchlist is stored per-visitor in localStorage — it is NOT synced
// across devices or accounts.

import { ADS, TRENDS, type Platform, type SampleAd } from "./sampleData";

export type PlatformId = Platform;

export interface AdOut {
  id: string;
  brand: string;
  pageName: string;
  platform: Platform;
  placements: string[];
  status: "active" | "inactive";
  startDate: string;
  daysRunning: number;
  duplicates: number;
  mediaType: "video" | "image" | "carousel";
  durationSec: number | null;
  hook: "ugc" | "unboxing" | "before-after" | "testimonial" | "review" | "demo";
  hasTextOverlay: boolean;
  hasVoice: boolean;
  cta: string;
  landingPlatform: "shopify" | "woocommerce" | "tiktok-shop" | "amazon" | "etsy";
  landingDomain: string;
  priceUsd: number | null;
  country: string;
  niche: string;
  headline: string;
  creative: string;
  newAds7d: number;
  trendScore: number;
  scoreLongevity: number;
  scoreDuplication: number;
  scoreVelocity: number;
  scoreCrossPlatform: number;
  brandPlatforms: Platform[];
  crossPlatform: boolean;
  scaling: boolean;
  saved: boolean;
}

export interface TrendOut {
  id: string;
  title: string;
  kind: "seasonal" | "new" | "evergreen";
  insight: string;
  niche: string;
  creativeKeys: string[];
  extraCount: number;
  adsCount: number;
  newAds: number;
  velocity: number;
  score: number;
  aiScore: number;
  platforms: Platform[];
  countries: string[];
}

export interface OverviewOut {
  totalAds: number;
  activeAds: number;
  crossPlatformBrands: number;
  platformCounts: { platform: Platform; count: number }[];
  niches: string[];
  countries: string[];
}

export interface SearchFilters {
  query: string;
  platforms: Platform[];
  status: "all" | "active" | "inactive";
  minDays: number;
  minDuplicates: number;
  mediaTypes: ("video" | "image" | "carousel")[];
  hooks: AdOut["hook"][];
  landingPlatforms: AdOut["landingPlatform"][];
  niches: string[];
  countries: string[];
  crossPlatformOnly: boolean;
  scalingOnly: boolean;
  maxPrice: number | null;
  sort: "score" | "longevity" | "duplicates" | "velocity" | "newest";
}

// ---------- watchlist (localStorage, per visitor/browser) ----------

const SAVED_KEY = "ads-library-trends:saved-v1";

function loadSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function loadSavedOrder(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function storeSavedOrder(ids: string[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable (private mode / quota) — watchlist just won't persist
  }
}

// ---------- scoring / filtering (ported from the Muse server actions) ----------

const brandPlatformMap = new Map<string, Set<Platform>>();
for (const ad of ADS) {
  const set = brandPlatformMap.get(ad.brand) ?? new Set<Platform>();
  set.add(ad.platform);
  brandPlatformMap.set(ad.brand, set);
}

function crossPlatformScore(platformCount: number): number {
  if (platformCount >= 4) return 100;
  if (platformCount === 3) return 85;
  if (platformCount === 2) return 65;
  return 25;
}

function toAdOut(ad: SampleAd, savedIds: Set<string>): AdOut {
  const brandPlatforms = [...(brandPlatformMap.get(ad.brand) ?? [])].sort() as Platform[];
  const xpScore = crossPlatformScore(brandPlatforms.length);
  const trendScore = Math.round(
    ad.scoreLongevity * 0.35 +
      ad.scoreDuplication * 0.3 +
      ad.scoreVelocity * 0.2 +
      xpScore * 0.15,
  );
  return {
    id: ad.id,
    brand: ad.brand,
    pageName: ad.pageName,
    platform: ad.platform,
    placements: ad.placements,
    status: ad.status,
    startDate: ad.startDate,
    daysRunning: ad.daysRunning,
    duplicates: ad.duplicates,
    mediaType: ad.mediaType,
    durationSec: ad.durationSec,
    hook: ad.hook,
    hasTextOverlay: ad.hasTextOverlay,
    hasVoice: ad.hasVoice,
    cta: ad.cta,
    landingPlatform: ad.landingPlatform,
    landingDomain: ad.landingDomain,
    priceUsd: ad.priceUsd,
    country: ad.country,
    niche: ad.niche,
    headline: ad.headline,
    creative: ad.creative,
    newAds7d: ad.newAds7d,
    trendScore,
    scoreLongevity: ad.scoreLongevity,
    scoreDuplication: ad.scoreDuplication,
    scoreVelocity: ad.scoreVelocity,
    scoreCrossPlatform: xpScore,
    brandPlatforms,
    crossPlatform: brandPlatforms.length >= 2,
    scaling: ad.newAds7d >= 5,
    saved: savedIds.has(ad.id),
  };
}

function applyFilters(list: AdOut[], f: SearchFilters): AdOut[] {
  const q = f.query.trim().toLowerCase();
  const out = list.filter((ad) => {
    if (
      q &&
      !`${ad.pageName} ${ad.headline} ${ad.niche} ${ad.brand}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (f.platforms.length > 0 && !f.platforms.includes(ad.platform))
      return false;
    if (f.status !== "all" && ad.status !== f.status) return false;
    if (ad.daysRunning < f.minDays) return false;
    if (ad.duplicates < f.minDuplicates) return false;
    if (f.mediaTypes.length > 0 && !f.mediaTypes.includes(ad.mediaType))
      return false;
    if (f.hooks.length > 0 && !f.hooks.includes(ad.hook)) return false;
    if (
      f.landingPlatforms.length > 0 &&
      !f.landingPlatforms.includes(ad.landingPlatform)
    )
      return false;
    if (f.niches.length > 0 && !f.niches.includes(ad.niche)) return false;
    if (f.countries.length > 0 && !f.countries.includes(ad.country))
      return false;
    if (f.crossPlatformOnly && !ad.crossPlatform) return false;
    if (f.scalingOnly && !ad.scaling) return false;
    if (f.maxPrice != null && (ad.priceUsd == null || ad.priceUsd > f.maxPrice))
      return false;
    return true;
  });
  switch (f.sort) {
    case "longevity":
      out.sort((a, b) => b.daysRunning - a.daysRunning);
      break;
    case "duplicates":
      out.sort((a, b) => b.duplicates - a.duplicates);
      break;
    case "velocity":
      out.sort((a, b) => b.scoreVelocity - a.scoreVelocity);
      break;
    case "newest":
      out.sort((a, b) => a.daysRunning - b.daysRunning);
      break;
    default:
      out.sort((a, b) => b.trendScore - a.trendScore);
  }
  return out;
}

// ---------- public API (same shape the UI used against the Muse actions) ----------

export const api = {
  async getOverview(_args: Record<string, never>): Promise<OverviewOut> {
    const counts = new Map<Platform, number>();
    for (const ad of ADS)
      counts.set(ad.platform, (counts.get(ad.platform) ?? 0) + 1);
    return {
      totalAds: ADS.length,
      activeAds: ADS.filter((a) => a.status === "active").length,
      crossPlatformBrands: [...brandPlatformMap.values()].filter(
        (s) => s.size >= 2,
      ).length,
      platformCounts: [...counts.entries()].map(([platform, count]) => ({
        platform,
        count,
      })),
      niches: [...new Set(ADS.map((a) => a.niche))].sort(),
      countries: [...new Set(ADS.map((a) => a.country))].sort(),
    };
  },

  async searchAds(
    filters: SearchFilters,
  ): Promise<{ ads: AdOut[]; total: number }> {
    const savedIds = loadSavedIds();
    const all = ADS.map((ad) => toAdOut(ad, savedIds));
    const ads = applyFilters(all, filters);
    return { ads, total: ads.length };
  },

  async getAdDetail(args: {
    adId: string;
  }): Promise<{ ad: AdOut | null; brandAds: AdOut[] }> {
    const savedIds = loadSavedIds();
    const found = ADS.find((a) => a.id === args.adId);
    if (!found) return { ad: null, brandAds: [] };
    const brandAds = ADS.filter((a) => a.brand === found.brand)
      .map((a) => toAdOut(a, savedIds))
      .sort((a, b) => b.trendScore - a.trendScore);
    return { ad: toAdOut(found, savedIds), brandAds };
  },

  async getTrends(args: {
    query: string;
    kind: "all" | "seasonal" | "new" | "evergreen";
    platform: Platform | null;
    sort: "score" | "velocity" | "ai" | "ads";
  }): Promise<{ trends: TrendOut[] }> {
    const q = args.query.trim().toLowerCase();
    const trends = TRENDS.filter((t) => {
      if (q && !`${t.title} ${t.niche}`.toLowerCase().includes(q)) return false;
      if (args.kind !== "all" && t.kind !== args.kind) return false;
      if (args.platform && !t.platforms.includes(args.platform)) return false;
      return true;
    }) as TrendOut[];
    switch (args.sort) {
      case "velocity":
        trends.sort((a, b) => b.velocity - a.velocity);
        break;
      case "ai":
        trends.sort((a, b) => b.aiScore - a.aiScore);
        break;
      case "ads":
        trends.sort((a, b) => b.adsCount - a.adsCount);
        break;
      default:
        trends.sort((a, b) => b.score - a.score);
    }
    return { trends };
  },

  async toggleSaved(args: { adId: string }): Promise<{ saved: boolean }> {
    const order = loadSavedOrder();
    const idx = order.indexOf(args.adId);
    if (idx >= 0) {
      order.splice(idx, 1);
      storeSavedOrder(order);
      return { saved: false };
    }
    order.push(args.adId);
    storeSavedOrder(order);
    return { saved: true };
  },

  async listSaved(_args: Record<string, never>): Promise<{ ads: AdOut[] }> {
    const order = loadSavedOrder();
    const savedIds = new Set(order);
    const byId = new Map(ADS.map((a) => [a.id, a]));
    const ads: AdOut[] = [];
    // Most recently saved first (same as the Muse version).
    for (const id of [...order].reverse()) {
      const ad = byId.get(id);
      if (ad) ads.push(toAdOut(ad, savedIds));
    }
    return { ads };
  },
};
