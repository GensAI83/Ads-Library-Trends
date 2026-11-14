// Etsy area for the standalone Vercel build — Shop Explorer / Listing
// Signal / Top Tags / Tools / Watchlist over the crawled Etsy POD data in
// src/podData.ts (ETSY_LISTINGS / ETSY_SNAPSHOTS / ETSY_IMAGES, exported
// from the Muse app's DB by ads-library-trends-v2/export_vercel.py).
// Everything is computed client-side. Images are the inlined data URIs from
// ETSY_IMAGES (no remote URL exists in the export). The watchlist lives in
// localStorage on this browser only — same honesty pattern as POD
// decisions in the Vercel build.

import { useEffect, useMemo, useState } from "react";
import {
  ETSY_CRAWL_DATE,
  ETSY_IMAGES,
  ETSY_LISTINGS,
  ETSY_SNAPSHOTS,
  type EtsyListing,
  type EtsySnapshot,
} from "./podData";
import { formatDate } from "./labels";
import { formatNum, formatPrice } from "./pod";
import { BookmarkFilledIcon, BookmarkIcon } from "./icons";

// ------------------------------------------------------------ types
export interface EtsyWatchItem {
  kind: "shop" | "listing";
  ref: string;
  title: string;
  note: string;
  createdAt: number;
}

const WATCHLIST_KEY = "ads-library-trends:etsy-watchlist-v1";

function loadWatchlist(): EtsyWatchItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is EtsyWatchItem =>
        typeof x === "object" &&
        x != null &&
        ((x as EtsyWatchItem).kind === "shop" ||
          (x as EtsyWatchItem).kind === "listing") &&
        typeof (x as EtsyWatchItem).ref === "string",
    );
  } catch {
    return [];
  }
}

function storeWatchlist(items: EtsyWatchItem[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable — watchlist just won't persist
  }
}

// ------------------------------------------------------------ helpers
// Dates in the export are "YYYY-MM-DD" (or ISO instants); take the date part.
function datePart(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function fmtDate(s: string | null): string {
  const d = datePart(s);
  return d ? formatDate(d) : "—";
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function ascNullsLast(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

const BADGE_LABELS: [RegExp, string][] = [
  [/best\s?seller/, "Bestseller"],
  [/star\s?seller/, "Star Seller"],
  [/top\s?rated/, "Top Rated"],
  [/sale|discount/, "Đang sale"],
  [/made\s?to\s?order|custom/, "Made to order"],
  [/scarce|low\s?stock|only/, "Ít hàng"],
  [/digital/, "Digital"],
  [/free\s?ship/, "Free ship"],
];

function badgeLabels(badges: Record<string, boolean>): string[] {
  const out: string[] = [];
  for (const [key, on] of Object.entries(badges)) {
    if (!on) continue;
    const norm = key.replace(/[_-]/g, " ").toLowerCase();
    const hit = BADGE_LABELS.find(([re]) => re.test(norm));
    out.push(hit ? hit[1] : key);
  }
  return out;
}

function hasBadge(badges: Record<string, boolean>, re: RegExp): boolean {
  return Object.entries(badges).some(
    ([k, v]) => v && re.test(k.replace(/[_-]/g, " ").toLowerCase()),
  );
}

// ------------------------------------------------------------ tag generator
export const ETSY_THEMES = [
  "Tự do",
  "Giáng sinh & mùa lễ",
  "Mèo",
  "Chó",
  "Gia đình",
  "Nghề nghiệp",
  "Cựu binh & yêu nước",
  "Đức tin",
  "Sở thích",
  "Hài hước",
] as const;

const THEME_ROOTS: Record<string, string[]> = {
  "Mèo": ["cat", "cat mom", "cat dad", "cat lover", "kitten", "funny cat"],
  "Chó": ["dog", "dog mom", "dog dad", "dog lover", "puppy", "funny dog"],
  "Giáng sinh & mùa lễ": [
    "christmas",
    "christmas cat",
    "santa",
    "xmas",
    "funny christmas",
  ],
  "Gia đình": ["mom", "dad", "grandma", "grandpa", "mama", "mother", "father"],
  "Nghề nghiệp": ["nurse", "teacher", "doctor", "engineer", "firefighter"],
  "Cựu binh & yêu nước": ["veteran", "army", "military", "american flag"],
  "Đức tin": ["jesus", "christian", "faith", "blessed", "god"],
  "Sở thích": ["fishing", "camping", "gaming", "coffee", "book lover", "reading"],
  "Hài hước": ["funny", "sarcastic", "humor"],
};

const GENERIC_FILLERS = [
  "graphic tee",
  "funny shirt",
  "print on demand",
  "gift idea",
  "unisex t-shirt",
];

const STOPWORDS = new Set([
  "a", "an", "the", "for", "and", "with", "shirt", "tshirt", "tee",
]);

export interface GeneratedTag {
  tag: string;
  trimmed: boolean;
}

function normalizeTag(raw: string): { tag: string; trimmed: boolean } {
  let t = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let trimmed = false;
  if (t.length > 55) {
    trimmed = true;
    const cut = t.slice(0, 55);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return { tag: t, trimmed };
}

function expandRoot(r: string): string[] {
  const out = [`${r} shirt`, `${r} t-shirt`];
  if (!r.includes("funny")) out.push(`funny ${r} shirt`);
  out.push(`${r} gift`);
  if (!r.includes("lover")) out.push(`${r} lover gift`);
  return out;
}

export function generateEtsyTags(
  input: string,
  theme: string,
): GeneratedTag[] {
  const candidates: string[] = [];

  // (i) comma-separated phrases from the input title
  for (const phrase of input.split(",")) {
    const p = phrase.trim();
    if (p) candidates.push(p);
  }

  // (ii) theme bank expansions
  for (const root of THEME_ROOTS[theme] ?? []) {
    candidates.push(...expandRoot(root));
  }

  // (iii) keyword combos from significant words of the input
  const words: string[] = [];
  for (const w of input.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w) && !words.includes(w))
      words.push(w);
  }
  const top = words.slice(0, 6);
  for (let i = 0; i + 1 < top.length; i++) {
    const pair = `${top[i]} ${top[i + 1]}`;
    candidates.push(`${pair} shirt`, `${pair} gift`);
    if (i + 2 < top.length) {
      const triple = `${top[i]} ${top[i + 1]} ${top[i + 2]}`;
      candidates.push(`${triple} shirt`, `${triple} gift`);
    }
  }

  // (iv) generic fillers
  candidates.push(...GENERIC_FILLERS);

  const seen = new Set<string>();
  const out: GeneratedTag[] = [];
  for (const c of candidates) {
    const { tag, trimmed } = normalizeTag(c);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push({ tag, trimmed });
    if (out.length >= 13) break;
  }
  return out;
}

// ------------------------------------------------------------ shared bits
type EtsySubTab = "shops" | "listings" | "tags" | "tools" | "watchlist";

function subTabButton(
  value: EtsySubTab,
  label: string,
  current: EtsySubTab,
  onSelect: (v: EtsySubTab) => void,
) {
  return (
    <button
      key={value}
      type="button"
      aria-pressed={current === value}
      onClick={() => onSelect(value)}
      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
        current === value
          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      {label}
    </button>
  );
}

function BookmarkButton({
  saved,
  onToggle,
  label,
}: {
  saved: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Bỏ lưu ${label}` : `Lưu ${label}`}
      title={saved ? "Đã lưu — bấm để bỏ" : "Lưu vào Watchlist"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
        saved
          ? "border-[var(--accent)] bg-[#ff4d2e]/10 text-[var(--accent-ink)]"
          : "border-[var(--border)] text-[var(--dim)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {saved ? (
        <BookmarkFilledIcon className="h-4.5 w-4.5" />
      ) : (
        <BookmarkIcon className="h-4.5 w-4.5" />
      )}
    </button>
  );
}

function ListingImage({
  listing,
  className,
}: {
  listing: EtsyListing;
  className: string;
}) {
  const img = ETSY_IMAGES[listing.listingId];
  return (
    <div className={`bg-[var(--surface-2)] ${className}`}>
      {img ? (
        <img
          src={img}
          alt={`Ảnh listing ${listing.title} trên Etsy`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-[var(--dim)]">
          Chưa có ảnh
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ shop model
interface ShopAgg {
  shopName: string;
  listings: EtsyListing[];
  shopSales: number | null;
  shopRating: number | null;
  shopRatingCount: number | null;
  favoritesSum: number | null;
  avgPrice: number | null;
}

function buildShops(listings: EtsyListing[]): ShopAgg[] {
  const byShop = new Map<string, EtsyListing[]>();
  for (const l of listings) {
    const arr = byShop.get(l.shopName) ?? [];
    arr.push(l);
    byShop.set(l.shopName, arr);
  }
  return [...byShop.entries()].map(([shopName, items]) => {
    const firstNonNull = <T,>(pick: (l: EtsyListing) => T | null): T | null => {
      for (const l of items) {
        const v = pick(l);
        if (v != null) return v;
      }
      return null;
    };
    const favs = items
      .map((l) => l.favorites)
      .filter((v): v is number => v != null);
    const prices = items
      .map((l) => l.price)
      .filter((v): v is number => v != null);
    return {
      shopName,
      listings: items,
      shopSales: firstNonNull((l) => l.shopSales),
      shopRating: firstNonNull((l) => l.shopRating),
      shopRatingCount: firstNonNull((l) => l.shopRatingCount),
      favoritesSum:
        favs.length > 0 ? favs.reduce((a, b) => a + b, 0) : null,
      avgPrice:
        prices.length > 0
          ? prices.reduce((a, b) => a + b, 0) / prices.length
          : null,
    };
  });
}

// ------------------------------------------------------------ main tab
export function EtsyTab() {
  const [subTab, setSubTab] = useState<EtsySubTab>("shops");
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [shopSort, setShopSort] = useState<"sales" | "listings" | "favorites">(
    "sales",
  );
  const [watchlist, setWatchlist] = useState<EtsyWatchItem[]>(loadWatchlist);

  // Listing Signal state
  const [search, setSearch] = useState("");
  const [shopFilter, setShopFilter] = useState<string>("");
  const [signalFilter, setSignalFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [listingSort, setListingSort] = useState<
    "cart" | "favorites" | "newest" | "priceAsc" | "priceDesc"
  >("cart");

  const listings = ETSY_LISTINGS;
  const snapshots = ETSY_SNAPSHOTS;

  const latestCrawlDate = useMemo(() => {
    if (ETSY_CRAWL_DATE) return datePart(ETSY_CRAWL_DATE);
    let max: string | null = null;
    for (const l of listings) {
      const d = datePart(l.lastSeenAt);
      if (d && (max == null || d > max)) max = d;
    }
    return max;
  }, [listings]);

  const shops = useMemo(() => buildShops(listings), [listings]);
  const sortedShops = useMemo(() => {
    const out = [...shops];
    if (shopSort === "listings")
      out.sort((a, b) => b.listings.length - a.listings.length);
    else if (shopSort === "favorites")
      out.sort((a, b) => descNullsLast(a.favoritesSum, b.favoritesSum));
    else out.sort((a, b) => descNullsLast(a.shopSales, b.shopSales));
    return out;
  }, [shops, shopSort]);

  const shopNames = useMemo(
    () => [...new Set(listings.map((l) => l.shopName))].sort(),
    [listings],
  );

  // Snapshot deltas per listing (two most recent snapshots)
  const deltaByListing = useMemo(() => {
    const byId = new Map<string, EtsySnapshot[]>();
    for (const s of snapshots) {
      const arr = byId.get(s.listingId) ?? [];
      arr.push(s);
      byId.set(s.listingId, arr);
    }
    const out = new Map<
      string,
      { favorites: number | null; inCart: number | null }
    >();
    let anyMulti = false;
    for (const [id, snaps] of byId) {
      if (snaps.length < 2) continue;
      anyMulti = true;
      const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date));
      const prev = sorted[sorted.length - 2];
      const last = sorted[sorted.length - 1];
      if (!prev || !last) continue;
      const favorites =
        prev.favorites != null && last.favorites != null
          ? last.favorites - prev.favorites
          : null;
      const inCart =
        prev.inCartCount != null && last.inCartCount != null
          ? last.inCartCount - prev.inCartCount
          : null;
      if ((favorites != null && favorites !== 0) || (inCart != null && inCart !== 0))
        out.set(id, { favorites, inCart });
    }
    return { deltas: out, anyMulti };
  }, [snapshots]);

  // Signal computation
  const signalsOf = (l: EtsyListing): string[] => {
    const out: string[] = [];
    if (hasBadge(l.badges, /best\s?seller/)) out.push("Bestseller");
    if (l.inCartCount != null && l.inCartCount >= 20) out.push("Giỏ hàng cao");
    const lastSale = datePart(l.lastSaleDate);
    if (
      (l.boughtLast24h != null && l.boughtLast24h > 0) ||
      (lastSale != null && latestCrawlDate != null && lastSale === latestCrawlDate)
    )
      out.push("Vừa có sale");
    const created = datePart(l.createDate);
    if (
      created != null &&
      latestCrawlDate != null &&
      daysBetween(created, latestCrawlDate) >= 0 &&
      daysBetween(created, latestCrawlDate) <= 30
    )
      out.push("Mới");
    if (hasBadge(l.badges, /scarce|low\s?stock|only/)) out.push("Ít hàng");
    return out;
  };

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = listings.filter((l) => {
      if (
        q &&
        !`${l.title} ${l.shopName}`.toLowerCase().includes(q)
      )
        return false;
      if (shopFilter && l.shopName !== shopFilter) return false;
      if (signalFilter && !signalsOf(l).includes(signalFilter)) return false;
      if (tagFilter && !l.tags.includes(tagFilter)) return false;
      return true;
    });
    switch (listingSort) {
      case "favorites":
        out.sort((a, b) => descNullsLast(a.favorites, b.favorites));
        break;
      case "newest":
        out.sort((a, b) =>
          (datePart(b.createDate) ?? "").localeCompare(
            datePart(a.createDate) ?? "",
          ),
        );
        break;
      case "priceAsc":
        out.sort((a, b) => ascNullsLast(a.price, b.price));
        break;
      case "priceDesc":
        out.sort((a, b) => descNullsLast(a.price, b.price));
        break;
      default:
        out.sort((a, b) => descNullsLast(a.inCartCount, b.inCartCount));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, search, shopFilter, signalFilter, tagFilter, listingSort, latestCrawlDate]);

  // Top tags
  const tagStats = useMemo(() => {
    const tagged = listings.filter((l) => l.tags.length > 0);
    const byTag = new Map<string, { count: number; shops: string[] }>();
    for (const l of tagged) {
      for (const t of l.tags) {
        const agg = byTag.get(t) ?? { count: 0, shops: [] };
        agg.count += 1;
        if (!agg.shops.includes(l.shopName) && agg.shops.length < 2)
          agg.shops.push(l.shopName);
        byTag.set(t, agg);
      }
    }
    const rows = [...byTag.entries()]
      .map(([tag, agg]) => ({
        tag,
        count: agg.count,
        shops: agg.shops,
        share: tagged.length > 0 ? (agg.count / tagged.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return { rows, taggedCount: tagged.length };
  }, [listings]);

  // Watchlist helpers
  const isSaved = (kind: "shop" | "listing", ref: string) =>
    watchlist.some((w) => w.kind === kind && w.ref === ref);

  const toggleWatch = (item: Omit<EtsyWatchItem, "createdAt" | "note">) => {
    setWatchlist((cur) => {
      const exists = cur.some(
        (w) => w.kind === item.kind && w.ref === item.ref,
      );
      const next = exists
        ? cur.filter((w) => !(w.kind === item.kind && w.ref === item.ref))
        : [
            ...cur,
            { ...item, note: "", createdAt: Date.now() },
          ];
      storeWatchlist(next);
      return next;
    });
  };

  useEffect(() => {
    storeWatchlist(watchlist);
  }, [watchlist]);

  const selectedShopAgg = selectedShop
    ? shops.find((s) => s.shopName === selectedShop) ?? null
    : null;

  return (
    <div>
      <div className="py-4">
        <h2 className="text-xl font-extrabold tracking-tight">Etsy</h2>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          {shops.length} shop · dữ liệu crawl Etsy ngày{" "}
          {latestCrawlDate ? fmtDate(latestCrawlDate) : "—"}
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Mục con Etsy"
      >
        {subTabButton("shops", "Shop Explorer", subTab, setSubTab)}
        {subTabButton("listings", "Listing Signal", subTab, setSubTab)}
        {subTabButton("tags", "Top Tags", subTab, setSubTab)}
        {subTabButton("tools", "Tools", subTab, setSubTab)}
        {subTabButton("watchlist", "Watchlist", subTab, setSubTab)}
      </div>

      {/* ---------------- Shop Explorer ---------------- */}
      {subTab === "shops" ? (
        selectedShopAgg ? (
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setSelectedShop(null)}
              className="mb-4 inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-bold"
            >
              ← Quay lại danh sách shop
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-extrabold tracking-tight">
                {selectedShopAgg.shopName}
              </h3>
              <BookmarkButton
                saved={isSaved("shop", selectedShopAgg.shopName)}
                onToggle={() =>
                  toggleWatch({
                    kind: "shop",
                    ref: selectedShopAgg.shopName,
                    title: selectedShopAgg.shopName,
                  })
                }
                label={`shop ${selectedShopAgg.shopName}`}
              />
            </div>
            <p className="pt-1 text-sm text-[var(--dim)]">
              Sales shop (Etsy công khai):{" "}
              <strong className="text-[var(--text)]">
                {formatNum(selectedShopAgg.shopSales)}
              </strong>{" "}
              · {selectedShopAgg.listings.length} listing đang theo dõi
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedShopAgg.listings.map((l) => (
                <ListingCard
                  key={l.listingId}
                  listing={l}
                  signals={signalsOf(l)}
                  delta={deltaByListing.deltas.get(l.listingId) ?? null}
                  saved={isSaved("listing", l.listingId)}
                  onToggleSaved={() =>
                    toggleWatch({
                      kind: "listing",
                      ref: l.listingId,
                      title: l.title,
                    })
                  }
                  onOpenShop={null}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <h3 className="text-lg font-extrabold tracking-tight">
                Shop đang theo dõi qua crawl
              </h3>
              <label className="ml-auto flex items-center gap-2">
                <span className="text-sm text-[var(--dim)]">Sắp xếp</span>
                <select
                  aria-label="Sắp xếp shop"
                  value={shopSort}
                  onChange={(e) =>
                    setShopSort(e.target.value as typeof shopSort)
                  }
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
                >
                  <option value="sales">Sales cao nhất</option>
                  <option value="listings">Nhiều listing nhất</option>
                  <option value="favorites">Nhiều favorites nhất</option>
                </select>
              </label>
            </div>
            {sortedShops.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <p className="font-semibold">Chưa có shop nào</p>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Dữ liệu sẽ xuất hiện sau lượt crawl Etsy đầu tiên.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedShops.map((s) => {
                  const thumb = s.listings[0];
                  return (
                    <article
                      key={s.shopName}
                      className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]"
                    >
                      <div className="flex items-start gap-3 p-3.5">
                        {thumb ? (
                          <ListingImage
                            listing={thumb}
                            className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-bold">
                            {s.shopName}
                          </h4>
                          <p className="mt-0.5 text-[13px] text-[var(--dim)]">
                            Sales shop (Etsy công khai):{" "}
                            <strong className="text-[var(--text)]">
                              {formatNum(s.shopSales)}
                            </strong>
                          </p>
                          {s.shopRating != null ? (
                            <p className="text-[13px]">
                              <span className="font-semibold text-[var(--gold)]">
                                ★
                              </span>{" "}
                              <strong>{s.shopRating.toFixed(1)}</strong>{" "}
                              <span className="text-[var(--dim)]">
                                ({formatNum(s.shopRatingCount)} review shop)
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <BookmarkButton
                          saved={isSaved("shop", s.shopName)}
                          onToggle={() =>
                            toggleWatch({
                              kind: "shop",
                              ref: s.shopName,
                              title: s.shopName,
                            })
                          }
                          label={`shop ${s.shopName}`}
                        />
                      </div>
                      <dl className="grid grid-cols-3 gap-2 px-3.5 pb-3 text-[13px]">
                        <div>
                          <dt className="text-[var(--dim)]">Listing theo dõi</dt>
                          <dd className="font-mono font-bold">
                            {s.listings.length}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--dim)]">Tổng favorites</dt>
                          <dd className="font-mono font-bold">
                            {s.favoritesSum != null
                              ? formatNum(s.favoritesSum)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--dim)]">Giá TB listing</dt>
                          <dd className="font-mono font-bold">
                            {s.avgPrice != null
                              ? formatPrice(s.avgPrice)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-auto px-3.5 pb-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedShop(s.shopName)}
                          className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white hover:bg-[var(--ink-2)]"
                        >
                          Xem listing
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )
      ) : null}

      {/* ---------------- Listing Signal ---------------- */}
      {subTab === "listings" ? (
        <>
          <div className="flex flex-col gap-2 pt-4">
            <div className="flex flex-wrap items-stretch gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tiêu đề, shop…"
                aria-label="Tìm listing Etsy"
                className="h-11 min-w-52 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
              />
              <select
                aria-label="Lọc theo shop"
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
              >
                <option value="">Tất cả shop</option>
                {shopNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc theo tín hiệu"
                value={signalFilter}
                onChange={(e) => setSignalFilter(e.target.value)}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
              >
                <option value="">Tất cả tín hiệu</option>
                <option value="Bestseller">Bestseller</option>
                <option value="Giỏ hàng cao">Giỏ hàng cao</option>
                <option value="Vừa có sale">Vừa có sale</option>
                <option value="Mới">Mới</option>
              </select>
              <select
                aria-label="Sắp xếp listing"
                value={listingSort}
                onChange={(e) =>
                  setListingSort(e.target.value as typeof listingSort)
                }
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
              >
                <option value="cart">Giỏ hàng nhiều nhất</option>
                <option value="favorites">Favorites nhiều nhất</option>
                <option value="newest">Mới nhất</option>
                <option value="priceAsc">Giá thấp→cao</option>
                <option value="priceDesc">Giá cao→thấp</option>
              </select>
            </div>
            <p className="text-[13px] text-[var(--dim)]">
              Lưu ý: favorites chỉ có ở listing đã crawl chi tiết — listing
              chưa crawl chi tiết sẽ hiện “—”.
            </p>
            {tagFilter ? (
              <p className="text-sm">
                Đang lọc theo tag:{" "}
                <span className="rounded-md bg-[#ff4d2e]/10 px-2 py-1 text-xs font-semibold text-[var(--accent-ink)]">
                  {tagFilter}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => setTagFilter("")}
                  className="font-semibold text-[var(--accent-ink)] underline underline-offset-2"
                >
                  Xóa lọc tag
                </button>
              </p>
            ) : null}
            {!deltaByListing.anyMulti ? (
              <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
                Snapshot mới bắt đầu hôm nay — delta favorites/giỏ hàng sẽ
                xuất hiện từ ngày crawl tiếp theo.
              </p>
            ) : null}
            <p className="text-sm text-[var(--dim)]" role="status">
              Hiển thị {filteredListings.length}/{listings.length} listing
            </p>
          </div>
          {filteredListings.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="font-semibold">Không có listing nào khớp</p>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Thử nới lỏng bộ lọc hoặc chờ lượt crawl Etsy tiếp theo.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredListings.map((l) => (
                <ListingCard
                  key={l.listingId}
                  listing={l}
                  signals={signalsOf(l)}
                  delta={deltaByListing.deltas.get(l.listingId) ?? null}
                  saved={isSaved("listing", l.listingId)}
                  onToggleSaved={() =>
                    toggleWatch({
                      kind: "listing",
                      ref: l.listingId,
                      title: l.title,
                    })
                  }
                  onOpenShop={(shop) => {
                    setSelectedShop(shop);
                    setSubTab("shops");
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* ---------------- Top Tags ---------------- */}
      {subTab === "tags" ? (
        <>
          <h3 className="pt-4 text-lg font-extrabold tracking-tight">
            Top Tags
          </h3>
          <p className="pt-1 text-sm text-[var(--dim)]">
            Dựa trên {tagStats.taggedCount}/{listings.length} listing đã có
            dữ liệu tags (từ crawl chi tiết các shop lớn)
          </p>
          {tagStats.rows.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="font-semibold">Chưa có dữ liệu tags</p>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Tags xuất hiện khi crawl chi tiết listing của các shop lớn.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {tagStats.rows.map((r, i) => (
                <button
                  key={r.tag}
                  type="button"
                  onClick={() => {
                    setTagFilter(r.tag);
                    setSubTab("listings");
                  }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--accent)]"
                >
                  <span className="w-8 shrink-0 text-center font-mono text-base font-bold text-[var(--dim)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {r.tag}
                    </span>
                    {r.shops.length > 0 ? (
                      <span className="block truncate text-xs text-[var(--dim)]">
                        Ví dụ: {r.shops.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[13px]">
                    dùng bởi {r.count} listing · {r.share.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* ---------------- Tools ---------------- */}
      {subTab === "tools" ? <EtsyTools /> : null}

      {/* ---------------- Watchlist ---------------- */}
      {subTab === "watchlist" ? (
        <>
          <h3 className="pt-4 text-lg font-extrabold tracking-tight">
            Watchlist Etsy
          </h3>
          <p className="pt-1 text-sm text-[var(--dim)]">
            Lưu trên trình duyệt này (không đồng bộ)
          </p>
          {(["shop", "listing"] as const).map((kind) => {
            const items = watchlist.filter((w) => w.kind === kind);
            return (
              <section
                key={kind}
                aria-label={kind === "shop" ? "Shop đã lưu" : "Listing đã lưu"}
              >
                <h4 className="pb-2 pt-5 text-base font-bold">
                  {kind === "shop" ? "Shop đã lưu" : "Listing đã lưu"}{" "}
                  <span className="font-mono text-[13px] font-medium text-[var(--dim)]">
                    · {items.length}
                  </span>
                </h4>
                {items.length === 0 ? (
                  <p className="text-sm text-[var(--dim)]">
                    {kind === "shop"
                      ? "Chưa lưu shop nào — bấm bookmark trên thẻ shop ở Shop Explorer."
                      : "Chưa lưu listing nào — bấm bookmark trên thẻ listing ở Listing Signal."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((w) => (
                      <div
                        key={`${w.kind}-${w.ref}`}
                        className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {w.title || w.ref}
                          </p>
                          <p className="font-mono text-xs text-[var(--dim)]">
                            {w.ref}
                            {w.note ? ` · ${w.note}` : ""} · Đã lưu{" "}
                            {new Date(w.createdAt).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            toggleWatch({
                              kind: w.kind,
                              ref: w.ref,
                              title: w.title,
                            })
                          }
                          className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)]"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {watchlist.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="font-semibold">Watchlist đang trống</p>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Lưu shop hoặc listing đáng chú ý để quay lại xem sau.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ listing card
function ListingCard({
  listing: l,
  signals,
  delta,
  saved,
  onToggleSaved,
  onOpenShop,
}: {
  listing: EtsyListing;
  signals: string[];
  delta: { favorites: number | null; inCart: number | null } | null;
  saved: boolean;
  onToggleSaved: () => void;
  onOpenShop: ((shopName: string) => void) | null;
}) {
  const badges = badgeLabels(l.badges);
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative">
        <ListingImage listing={l} className="aspect-square w-full" />
        <div className="absolute right-2 top-2 rounded-full bg-white/90 shadow-sm">
          <BookmarkButton
            saved={saved}
            onToggle={onToggleSaved}
            label={`listing ${l.title}`}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <a
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 min-h-10 text-sm font-bold leading-snug hover:underline"
        >
          {l.title}
        </a>
        {onOpenShop ? (
          <button
            type="button"
            onClick={() => onOpenShop(l.shopName)}
            className="-mt-1 w-fit text-left text-xs font-semibold text-[var(--accent-ink)] underline underline-offset-2"
          >
            {l.shopName}
          </button>
        ) : (
          <p className="-mt-1 truncate text-xs text-[var(--dim)]">
            {l.shopName}
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold">
            {formatPrice(l.price)}
          </span>
          {l.listPrice != null && l.price != null && l.listPrice > l.price ? (
            <span className="font-mono text-[13px] text-[var(--dim)] line-through">
              {formatPrice(l.listPrice)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          <span>
            ♥ <strong>{l.favorites != null ? formatNum(l.favorites) : "—"}</strong>{" "}
            favorites
          </span>
          {l.rating != null ? (
            <span>
              <span className="font-semibold text-[var(--gold)]">★</span>{" "}
              <strong>{l.rating.toFixed(1)}</strong>{" "}
              <span className="text-[var(--dim)]">
                ({formatNum(l.reviewCount)} review)
              </span>
            </span>
          ) : l.reviewCount != null ? (
            <span className="text-[var(--dim)]">
              {formatNum(l.reviewCount)} review
            </span>
          ) : null}
          {l.inCartCount != null ? (
            <span>
              Trong giỏ: <strong>{formatNum(l.inCartCount)}</strong>
            </span>
          ) : null}
        </div>
        {delta ? (
          <div className="flex flex-wrap gap-1.5">
            {delta.favorites != null && delta.favorites !== 0 ? (
              <span
                className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${
                  delta.favorites > 0
                    ? "bg-[#0e7c6b]/12 text-[var(--teal)]"
                    : "bg-[#ff4d2e]/10 text-[var(--accent-ink)]"
                }`}
              >
                {delta.favorites > 0
                  ? `▲ +${delta.favorites} favorites`
                  : `▼ −${Math.abs(delta.favorites)} favorites`}
              </span>
            ) : null}
            {delta.inCart != null && delta.inCart !== 0 ? (
              <span
                className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${
                  delta.inCart > 0
                    ? "bg-[#0e7c6b]/12 text-[var(--teal)]"
                    : "bg-[#ff4d2e]/10 text-[var(--accent-ink)]"
                }`}
              >
                {delta.inCart > 0
                  ? `▲ +${delta.inCart} giỏ`
                  : `▼ −${Math.abs(delta.inCart)} giỏ`}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-md bg-[#b97f10]/15 px-2 py-1 text-xs font-semibold text-[var(--gold)]"
            >
              {b}
            </span>
          ))}
          {signals.map((s) => (
            <span
              key={s}
              className="rounded-md bg-[#0e7c6b]/12 px-2 py-1 text-xs font-semibold text-[var(--teal)]"
            >
              {s}
            </span>
          ))}
          {l.tags.length > 0 ? (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--dim)]">
              {l.tags.length} tags
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 font-mono text-xs text-[var(--dim)]">
          {l.lastSaleDate ? (
            <span>Sale gần nhất: {fmtDate(l.lastSaleDate)}</span>
          ) : null}
          {l.boughtLast24h != null && l.boughtLast24h > 0 ? (
            <span>{l.boughtLast24h} lượt mua/24h</span>
          ) : null}
          {l.createDate ? <span>Tạo: {fmtDate(l.createDate)}</span> : null}
        </div>
      </div>
    </article>
  );
}

// ------------------------------------------------------------ tools
function EtsyTools() {
  const [tagInput, setTagInput] = useState("");
  const [theme, setTheme] = useState<string>("Tự do");
  const [generated, setGenerated] = useState<GeneratedTag[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("");

  const runGenerate = () => {
    setGenerated(generateEtsyTags(tagInput, theme));
    setCopied(false);
  };

  const copyAll = async () => {
    if (!generated) return;
    const text = generated.map((g) => g.tag).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // clipboard blocked — the readonly textarea below is selectable
      setCopied(false);
    }
  };

  const titleLen = title.length;
  const titleWords =
    title.trim() === "" ? 0 : title.trim().split(/\s+/).length;
  const over = titleLen - 140;

  return (
    <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-2">
      {/* Tag Generator */}
      <section
        aria-label="Tạo tags Etsy"
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h3 className="text-base font-extrabold tracking-tight">
          Tạo tags Etsy
        </h3>
        <p className="mt-0.5 text-[13px] text-[var(--dim)]">
          Sinh tối đa 13 tags, mỗi tag tối đa 55 ký tự, từ tiêu đề và chủ đề.
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          Tiêu đề / từ khóa sản phẩm
          <textarea
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            rows={3}
            placeholder="VD: Funny Cat T-Shirt, Cat Mom Gift, Vintage Cat Lover Tee"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          Chủ đề
          <select
            aria-label="Chủ đề cho tag generator"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
          >
            {ETSY_THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={runGenerate}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white"
        >
          Tạo 13 tags
        </button>

        {generated ? (
          <div className="mt-4">
            <p className="text-sm font-semibold" role="status">
              Đã tạo {generated.length} tags
              {generated.length < 13
                ? " — chưa đủ 13 vì hết ứng viên không trùng; thử thêm từ khóa hoặc chọn chủ đề."
                : ""}
            </p>
            <ol className="mt-2 flex list-none flex-col gap-1.5">
              {generated.map((g, i) => (
                <li
                  key={`${g.tag}-${i}`}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-[var(--dim)]">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{g.tag}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--dim)]">
                    {g.tag.length}/55
                  </span>
                  {g.trimmed ? (
                    <span className="shrink-0 text-xs font-semibold text-[var(--accent-ink)]">
                      ⚠ đã rút gọn
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void copyAll()}
                className="inline-flex min-h-10 items-center rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-white"
              >
                Sao chép tất cả
              </button>
              {copied ? (
                <span className="text-sm font-medium text-[var(--teal)]">
                  Đã sao chép!
                </span>
              ) : null}
            </div>
            <textarea
              readOnly
              aria-label="Tags đã tạo (mỗi tag một dòng)"
              value={generated.map((g) => g.tag).join("\n")}
              rows={Math.min(13, Math.max(1, generated.length))}
              className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs outline-none"
            />
          </div>
        ) : null}
      </section>

      {/* Title Checker */}
      <section
        aria-label="Kiểm tra độ dài tiêu đề"
        className="h-fit rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h3 className="text-base font-extrabold tracking-tight">
          Kiểm tra độ dài tiêu đề
        </h3>
        <p className="mt-0.5 text-[13px] text-[var(--dim)]">
          Etsy khuyến nghị tiêu đề tối đa 140 ký tự.
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          Tiêu đề listing
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={3}
            placeholder="Nhập tiêu đề cần kiểm tra…"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
          />
        </label>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
          role="progressbar"
          aria-valuenow={Math.min(titleLen, 140)}
          aria-valuemin={0}
          aria-valuemax={140}
          aria-label="Độ dài tiêu đề so với 140 ký tự"
        >
          <div
            className={`h-full rounded-full ${
              over > 0 ? "bg-[var(--accent)]" : "bg-[var(--teal)]"
            }`}
            style={{
              width: `${Math.min(100, (titleLen / 140) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 font-mono text-sm" role="status">
          {titleLen}/140 ký tự · {titleWords} từ
        </p>
        {over > 0 ? (
          <p className="mt-1 text-sm font-semibold text-[var(--accent-ink)]">
            Vượt {over} ký tự — Etsy khuyến nghị tối đa 140
          </p>
        ) : titleLen > 0 ? (
          <p className="mt-1 text-sm font-medium text-[var(--teal)]">
            Trong giới hạn 140 ký tự.
          </p>
        ) : null}
      </section>
    </div>
  );
}
