// Merch Amazon area for the standalone Vercel build — Discovery / Trends /
// Best Sellers over the same crawled Amazon US POD product data as POD
// Radar (src/podData.ts). Everything here is computed client-side from
// POD_PRODUCTS + POD_SNAPSHOTS; clicking a product jumps to the POD Radar
// tab and opens its dossier (same cross-tab ASIN mechanism as Spy Ads).

import { useMemo, useState } from "react";
import {
  POD_IMAGES,
  POD_PRODUCTS,
  POD_SNAPSHOTS,
  type PodProduct,
} from "./podData";
import { formatDate } from "./labels";
import { formatNum, formatPrice } from "./pod";
import { TrendingUpIcon } from "./icons";

// ------------------------------------------------------------ themes
// Same keyword sets + priority order as the ingest classifier's
// THEME_RULES (ads-library-trends-v2/ingest.py), applied to product
// titles. Whole-phrase matching: "cat" must not fire inside other words,
// and plurals are listed explicitly.
const THEME_RULES: [string, string[]][] = [
  [
    "Giáng sinh & mùa lễ",
    [
      "christmas", "xmas", "santa", "halloween", "thanksgiving", "easter",
      "valentine", "valentines", "4th of july", "independence day",
      "patriotic",
    ],
  ],
  ["Mèo", ["cat", "cats", "kitten", "kittens", "kitty", "kitties"]],
  ["Chó", ["dog", "dogs", "puppy", "puppies"]],
  [
    "Gia đình",
    [
      "mom", "moms", "mommy", "mother", "mothers", "dad", "dads",
      "father", "fathers", "grandma", "grandmas", "grandpa", "grandpas",
      "nana", "mama", "wife", "husband", "sister", "sisters", "brother",
      "brothers", "aunt", "aunts", "uncle", "uncles",
    ],
  ],
  [
    "Nghề nghiệp",
    [
      "nurse", "nurses", "teacher", "teachers", "doctor", "doctors",
      "engineer", "engineers", "firefighter", "firefighters", "police",
    ],
  ],
  [
    "Cựu binh & yêu nước",
    [
      "veteran", "veterans", "army", "military", "soldier", "soldiers",
      "usa flag", "us flag", "american",
    ],
  ],
  [
    "Đức tin",
    ["jesus", "god", "christian", "christians", "faith", "blessed", "bible"],
  ],
  [
    "Sở thích",
    [
      "fishing", "hunting", "camping", "hiking", "gaming", "gamer",
      "gamers", "book", "books", "reading", "coffee", "wine", "gardening",
    ],
  ],
  ["Hài hước", ["funny", "humor", "humorous", "sarcastic", "joke", "jokes"]],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?<!\\w)${escapeRegExp(phrase)}(?!\\w)`).test(text);
}

export function productTheme(name: string): string {
  const text = name.toLowerCase();
  for (const [label, phrases] of THEME_RULES) {
    if (phrases.some((p) => hasPhrase(text, p))) return label;
  }
  return "Khác";
}

// ------------------------------------------------------------ helpers
const SAIGON_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Saigon",
});

function firstSeenDay(p: PodProduct): string {
  return SAIGON_DATE.format(new Date(p.firstSeenAt));
}

function descNullsLast(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function RatingLine({ product }: { product: PodProduct }) {
  if (product.rating != null) {
    return (
      <span>
        <span className="font-semibold text-[var(--gold)]">★</span>{" "}
        <strong>{product.rating.toFixed(1)}</strong>{" "}
        <span className="text-[var(--dim)]">
          ({formatNum(product.reviewCount)} review)
        </span>
      </span>
    );
  }
  if (product.reviewCount == null || product.reviewCount === 0) {
    return <span className="text-[var(--dim)]">Chưa có review/dữ liệu</span>;
  }
  return <span className="text-[var(--dim)]">Chưa có rating</span>;
}

function ThemeChip({ name }: { name: string }) {
  return (
    <span className="rounded-md bg-[#1877f2]/10 px-2 py-1 text-xs font-semibold text-[#1877f2]">
      {productTheme(name)}
    </span>
  );
}

function MerchProductCard({
  product,
  isNew,
  onOpen,
}: {
  product: PodProduct;
  isNew: boolean;
  onOpen: (asin: string) => void;
}) {
  const img = POD_IMAGES[product.asin];
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative aspect-square bg-white">
        {img ? (
          <img
            src={img}
            alt={`Ảnh sản phẩm ${product.name} trên Amazon`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {product.boughtPastMonth ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            <TrendingUpIcon className="h-3.5 w-3.5" />
            {product.boughtPastMonth}
          </span>
        ) : null}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
          {product.asin}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold">
            {formatPrice(product.price)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <RatingLine product={product} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ThemeChip name={product.name} />
          {isNew ? (
            <span className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-bold text-white">
              Mới
            </span>
          ) : null}
          {product.boughtPastMonthMin != null ? (
            <span className="rounded-md bg-[#0e7c6b]/12 px-2 py-1 text-xs font-semibold text-[var(--teal)]">
              Bán ≥{formatNum(product.boughtPastMonthMin)}/tháng
            </span>
          ) : null}
        </div>
        <div className="mt-auto pt-1.5">
          <button
            type="button"
            onClick={() => onOpen(product.asin)}
            className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white hover:bg-[var(--ink-2)]"
          >
            Xem hồ sơ
          </button>
        </div>
      </div>
    </article>
  );
}

// ------------------------------------------------------------ data math
type MerchSubTab = "discovery" | "trends" | "best";
type DiscoverySort = "newest" | "badge" | "reviews";

interface ThemeStat {
  theme: string;
  count: number;
  newLatest: number;
  badged: number;
  maxBadge: number | null;
}

interface Mover {
  product: PodProduct;
  reviewDelta: number | null;
  badgeFrom: number | null;
  badgeTo: number | null;
}

export function MerchTab({
  onOpenProduct,
}: {
  onOpenProduct: (asin: string) => void;
}) {
  const [sub, setSub] = useState<MerchSubTab>("discovery");
  const [sort, setSort] = useState<DiscoverySort>("newest");

  const products = POD_PRODUCTS;

  const snapshotDates = useMemo(
    () => [...new Set(POD_SNAPSHOTS.map((s) => s.date))].sort(),
    [],
  );
  const latestDate = snapshotDates[snapshotDates.length - 1] ?? "";
  const earliestDate = snapshotDates[0] ?? "";

  // Discovery: group by Saigon calendar day of firstSeenAt, newest first.
  const discoveryGroups = useMemo(() => {
    const map = new Map<string, PodProduct[]>();
    for (const p of products) {
      const day = firstSeenDay(p);
      const arr = map.get(day) ?? [];
      arr.push(p);
      map.set(day, arr);
    }
    const days = [...map.keys()].sort().reverse();
    return days.map((day) => {
      const items = [...(map.get(day) ?? [])];
      if (sort === "badge") {
        items.sort((a, b) =>
          descNullsLast(a.boughtPastMonthMin, b.boughtPastMonthMin),
        );
      } else if (sort === "reviews") {
        items.sort((a, b) => descNullsLast(a.reviewCount, b.reviewCount));
      } else {
        items.sort((a, b) => b.firstSeenAt - a.firstSeenAt);
      }
      return { day, items };
    });
  }, [products, sort]);
  const latestGroupDay = discoveryGroups[0]?.day ?? "";

  // Trends (a): per-theme components.
  const themeStats = useMemo<ThemeStat[]>(() => {
    const map = new Map<string, ThemeStat>();
    for (const p of products) {
      const theme = productTheme(p.name);
      const s = map.get(theme) ?? {
        theme,
        count: 0,
        newLatest: 0,
        badged: 0,
        maxBadge: null,
      };
      s.count += 1;
      if (firstSeenDay(p) === latestDate) s.newLatest += 1;
      if (p.boughtPastMonthMin != null) {
        s.badged += 1;
        s.maxBadge =
          s.maxBadge == null
            ? p.boughtPastMonthMin
            : Math.max(s.maxBadge, p.boughtPastMonthMin);
      }
      map.set(theme, s);
    }
    return [...map.values()].sort(
      (a, b) => b.newLatest - a.newLatest || b.count - a.count,
    );
  }, [products, latestDate]);

  // Trends (b): movers between earliest and latest snapshot (>= 2 snapshots).
  const movers = useMemo<Mover[]>(() => {
    const byAsin = new Map<string, typeof POD_SNAPSHOTS>();
    for (const s of POD_SNAPSHOTS) {
      const arr = byAsin.get(s.asin) ?? [];
      arr.push(s);
      byAsin.set(s.asin, arr);
    }
    const byProduct = new Map(products.map((p) => [p.asin, p]));
    const out: Mover[] = [];
    for (const [asin, snaps] of byAsin) {
      if (snaps.length < 2) continue;
      const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last) continue;
      const reviewDelta =
        first.reviewCount != null &&
        last.reviewCount != null &&
        last.reviewCount > first.reviewCount
          ? last.reviewCount - first.reviewCount
          : null;
      const badgeUp =
        first.boughtPastMonthMin != null &&
        last.boughtPastMonthMin != null &&
        last.boughtPastMonthMin > first.boughtPastMonthMin;
      if (reviewDelta == null && !badgeUp) continue;
      const product = byProduct.get(asin);
      if (!product) continue;
      out.push({
        product,
        reviewDelta,
        badgeFrom: badgeUp ? first.boughtPastMonthMin : null,
        badgeTo: badgeUp ? last.boughtPastMonthMin : null,
      });
    }
    return out.sort(
      (a, b) =>
        (b.reviewDelta ?? 0) - (a.reviewDelta ?? 0) ||
        (b.badgeTo ?? 0) - (a.badgeTo ?? 0),
    );
  }, [products]);

  // Best Sellers: badge holders only, badge desc → reviews desc → rating desc.
  const ranked = useMemo(
    () =>
      products
        .filter((p) => p.boughtPastMonthMin != null)
        .sort(
          (a, b) =>
            descNullsLast(a.boughtPastMonthMin, b.boughtPastMonthMin) ||
            descNullsLast(a.reviewCount, b.reviewCount) ||
            descNullsLast(a.rating, b.rating),
        ),
    [products],
  );
  const unbadgedCount = products.length - ranked.length;

  const subButton = (value: MerchSubTab, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={sub === value}
      onClick={() => setSub(value)}
      className={`inline-flex min-h-10 items-center rounded-lg px-3.5 text-sm font-bold ${
        sub === value
          ? "bg-[var(--ink)] text-white"
          : "border border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section aria-label="Merch Amazon">
      <div className="py-4">
        <h2 className="text-xl font-extrabold tracking-tight">Merch Amazon</h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-[var(--dim)]">
          Dữ liệu crawl Amazon US — listing in ấn POD gồm Merch by Amazon
          &amp; seller POD (chưa phân tách được từng listing thuộc chương
          trình nào)
        </p>
      </div>

      <div
        className="flex gap-1.5"
        role="group"
        aria-label="Mục trong Merch Amazon"
      >
        {subButton("discovery", "Discovery")}
        {subButton("trends", "Trends")}
        {subButton("best", "Best Sellers")}
      </div>

      {sub === "discovery" ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-extrabold">Sản phẩm mới phát hiện</h3>
            <span className="text-sm text-[var(--dim)]" role="status">
              {products.length} sản phẩm đã phát hiện
            </span>
            <label className="ml-auto flex items-center gap-2">
              <span className="text-sm text-[var(--dim)]">Sắp xếp</span>
              <select
                aria-label="Sắp xếp sản phẩm mới phát hiện"
                value={sort}
                onChange={(e) => setSort(e.target.value as DiscoverySort)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
              >
                <option value="newest">Mới nhất</option>
                <option value="badge">Badge mua cao nhất</option>
                <option value="reviews">Review nhiều nhất</option>
              </select>
            </label>
          </div>

          {discoveryGroups.map(({ day, items }) => (
            <div key={day} className="mt-5">
              <h4 className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
                {day === latestGroupDay
                  ? `Mới nhất — ${formatDate(day)}`
                  : formatDate(day)}
                <span className="font-mono text-xs font-medium text-[var(--dim)]">
                  {items.length} sản phẩm
                </span>
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => (
                  <MerchProductCard
                    key={p.asin}
                    product={p}
                    isNew={day === latestGroupDay}
                    onOpen={onOpenProduct}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {sub === "trends" ? (
        <div className="mt-4">
          <h3 className="text-base font-extrabold">Chủ đề đang có lực</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {themeStats.map((s) => (
              <article
                key={s.theme}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <h4 className="text-sm font-extrabold">{s.theme}</h4>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                  <div>
                    <dt className="text-[var(--dim)]">Sản phẩm</dt>
                    <dd className="font-mono text-base font-bold">{s.count}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">
                      Mới ngày {latestDate ? formatDate(latestDate) : "—"}
                    </dt>
                    <dd className="font-mono text-base font-bold">
                      {s.newLatest}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">Có badge mua</dt>
                    <dd className="font-mono text-base font-bold">
                      {s.badged}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">Badge cao nhất</dt>
                    <dd className="font-mono text-base font-bold">
                      {s.maxBadge != null ? `${formatNum(s.maxBadge)}+` : "—"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <h3 className="mt-7 text-base font-extrabold">
            Sản phẩm có biến động
          </h3>
          {movers.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--dim)]">
              Chưa có sản phẩm nào tăng review hoặc badge mua giữa các lần
              crawl.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {movers.map((m) => {
                const img = POD_IMAGES[m.product.asin];
                return (
                  <button
                    key={m.product.asin}
                    type="button"
                    onClick={() => onOpenProduct(m.product.asin)}
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-2)]"
                  >
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                      {img ? (
                        <img
                          src={img}
                          alt={`Ảnh sản phẩm ${m.product.name} trên Amazon`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {m.product.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5">
                        <ThemeChip name={m.product.name} />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {m.reviewDelta != null ? (
                        <span className="rounded-md bg-[#0e7c6b]/12 px-2 py-1 font-mono text-xs font-bold text-[var(--teal)]">
                          +{formatNum(m.reviewDelta)} review
                        </span>
                      ) : null}
                      {m.badgeFrom != null && m.badgeTo != null ? (
                        <span className="rounded-md bg-[#0e7c6b]/12 px-2 py-1 font-mono text-xs font-bold text-[var(--teal)]">
                          badge {formatNum(m.badgeFrom)}+ →{" "}
                          {formatNum(m.badgeTo)}+
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-6 text-[13px] text-[var(--dim)]">
            Dữ liệu tích lũy từ {earliestDate ? formatDate(earliestDate) : "—"}{" "}
            — hiện có {snapshotDates.length} ngày crawl; xu hướng sẽ rõ hơn
            khi thêm ngày.
          </p>
        </div>
      ) : null}

      {sub === "best" ? (
        <div className="mt-4">
          <h3 className="text-base font-extrabold">
            Bán chạy nhất (theo badge Amazon)
          </h3>
          <p className="mt-1 max-w-3xl text-[13px] text-[var(--dim)]">
            Xếp hạng theo badge “bought in past month” của Amazon — số lượt
            mua tối thiểu trong tháng qua mà Amazon công bố trên listing. ·{" "}
            {unbadgedCount} sản phẩm chưa có badge mua — chưa xếp hạng
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {ranked.map((p, i) => {
              const img = POD_IMAGES[p.asin];
              return (
                <button
                  key={p.asin}
                  type="button"
                  onClick={() => onOpenProduct(p.asin)}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-2)]"
                >
                  <span className="w-8 shrink-0 text-center font-mono text-lg font-extrabold text-[var(--dim)]">
                    {i + 1}
                  </span>
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                    {img ? (
                      <img
                        src={img}
                        alt={`Ảnh sản phẩm ${p.name} trên Amazon`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {p.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                      <RatingLine product={p} />
                      <span className="font-mono">
                        {formatPrice(p.price)}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <ThemeChip name={p.name} />
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-white">
                    <TrendingUpIcon className="h-3.5 w-3.5" />
                    {p.boughtPastMonth ??
                      `${formatNum(p.boughtPastMonthMin)}+ bought in past month`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
