// Spy Ads POD (POD Spy) for the standalone Vercel build — a classified,
// POD-only feed of the real Meta ads from src/podData.ts. Classification
// (theme / productType / salesChannel / isPod) is computed once by the
// ingest pipeline (classify_ad in ingest.py) and stored in the data; this
// file only filters and ranks it. Topics are computed here with exactly
// the same rule as the Muse app's listSpyAds action.

import { useMemo, useState } from "react";
import {
  AD_IMAGES,
  POD_CRAWL_DATE,
  POD_IMAGES,
  POD_PRODUCTS,
  POD_SOURCE_ADS,
  type PodProduct,
  type PodSourceAd,
} from "./podData";
import { formatNum, formatPrice } from "./pod";
import { formatDate } from "./labels";
import {
  CalendarIcon,
  CopyIcon,
  ExternalIcon,
  SearchIcon,
  XIcon,
} from "./icons";

const META_PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  AUDIENCE_NETWORK: "Audience Network",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  THREADS: "Threads",
};

function startDateIso(ad: PodSourceAd): string {
  return new Date(ad.startDate * 1000).toISOString().slice(0, 10);
}

function adLibraryUrl(ad: PodSourceAd): string {
  return `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
}

// ---------------------------------------------------------------- topics
// Same scoring rule as the Muse server's listSpyAds topics: POD ads only,
// grouped by theme. Recency is measured against the snapshot's crawl date
// so the static export shows the same numbers as the app on export day.

export interface SpyTopic {
  theme: string;
  adsCount: number;
  longestDays: number;
  dupAds: number;
  newestFirstSeen: string | null;
  score: number;
  reason: string;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function computeTopics(ads: PodSourceAd[]): SpyTopic[] {
  const byTheme = new Map<string, PodSourceAd[]>();
  for (const ad of ads) {
    if (!ad.theme) continue;
    const list = byTheme.get(ad.theme) ?? [];
    list.push(ad);
    byTheme.set(ad.theme, list);
  }
  const topics: SpyTopic[] = [];
  for (const [theme, list] of byTheme) {
    const adsCount = list.length;
    const longestDays = Math.max(...list.map((a) => a.daysRunning));
    const dupAds = list.filter(
      (a) => a.collationCount != null && a.collationCount >= 3,
    ).length;
    const seen = list
      .map((a) => a.firstSeenAt)
      .filter((d): d is string => d != null)
      .sort();
    const newestFirstSeen = seen.length > 0 ? seen[seen.length - 1] : null;
    const recencyDays =
      newestFirstSeen != null
        ? daysBetween(newestFirstSeen, POD_CRAWL_DATE)
        : 9999;
    const score =
      adsCount * 10 +
      dupAds * 5 +
      Math.round(longestDays / 10) +
      (recencyDays <= 7 ? 5 : recencyDays <= 30 ? 2 : 0);
    let reason = `${adsCount} ads POD đang chạy · ads lâu nhất ${longestDays} ngày · ${dupAds} ads có ≥3 bản trùng`;
    if (dupAds >= 3) {
      reason += " — nhiều seller cùng đẩy, thiết kế có sức bán";
    } else if (longestDays >= 90) {
      reason += " — ads chạy bền, nhu cầu ổn định";
    } else if (recencyDays <= 2) {
      reason += " — có ads mới xuất hiện, chủ đề đang nóng lên";
    } else {
      reason += " — chủ đề đang có hoạt động quảng cáo POD";
    }
    topics.push({
      theme,
      adsCount,
      longestDays,
      dupAds,
      newestFirstSeen,
      score,
      reason,
    });
  }
  topics.sort((a, b) => b.score - a.score || b.adsCount - a.adsCount);
  return topics;
}

// Theme → Amazon keyword groups whose crawled products belong to the theme.
const THEME_QUERIES: Record<string, string[]> = {
  "Mèo": ["funny cat t-shirt", "christmas cat t-shirt"],
  "Chó": ["funny dog t-shirt"],
  "Giáng sinh & mùa lễ": ["christmas cat t-shirt"],
};

function relatedProducts(ad: PodSourceAd): PodProduct[] | null {
  if (!ad.theme) return null;
  const queries = THEME_QUERIES[ad.theme];
  if (!queries) return null;
  return POD_PRODUCTS.filter((p) => queries.includes(p.searchQuery));
}

// ------------------------------------------------------------------- cards

function Chip({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        accent
          ? "bg-[#ff4d2e]/10 text-[var(--accent-ink)]"
          : "bg-[var(--surface-2)] text-[var(--dim)]"
      }`}
    >
      {children}
    </span>
  );
}

function SpyAdCard({
  ad,
  onOpen,
}: {
  ad: PodSourceAd;
  onOpen: (ad: PodSourceAd) => void;
}) {
  const img = AD_IMAGES[ad.adArchiveId];
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative aspect-square bg-[var(--surface-2)]">
        {img ? (
          <img
            src={img}
            alt={`Creative của ads Meta từ page ${ad.pageName}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-[var(--dim)]">
            Ads video / chưa có ảnh tĩnh
          </div>
        )}
        {ad.isActive ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/85 px-2 py-0.5 text-xs font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Đang chạy
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold">{ad.pageName}</p>
          {ad.ctaText ? (
            <span className="shrink-0 rounded-md bg-[var(--ink)] px-2 py-1 text-xs font-semibold text-white">
              {ad.ctaText}
            </span>
          ) : null}
        </div>
        {ad.title && ad.title !== "{{product.name}}" ? (
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {ad.title}
          </p>
        ) : null}
        {ad.bodyText ? (
          <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--dim)]">
            {ad.bodyText}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {ad.theme ? <Chip accent>{ad.theme}</Chip> : null}
          {ad.productType && ad.productType !== "Không rõ" ? (
            <Chip>{ad.productType}</Chip>
          ) : null}
          {ad.salesChannel && ad.salesChannel !== "Không rõ" ? (
            <Chip>{ad.salesChannel}</Chip>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            {formatDate(startDateIso(ad))} · <strong>{ad.daysRunning}</strong>{" "}
            ngày
          </span>
          <span className="inline-flex items-center gap-1">
            <CopyIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            {ad.collationCount != null ? (
              <>
                <strong>{ad.collationCount}</strong> bản trùng
              </>
            ) : (
              "Số bản trùng: chưa rõ"
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(ad)}
          className="mt-auto inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white hover:bg-[var(--ink-2)]"
        >
          Xem chi tiết
        </button>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ detail

function SpyAdDetail({
  ad,
  onClose,
  onOpenProduct,
}: {
  ad: PodSourceAd;
  onClose: () => void;
  onOpenProduct: (asin: string) => void;
}) {
  const img = AD_IMAGES[ad.adArchiveId];
  const related = relatedProducts(ad);
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết ads của ${ad.pageName}`}
      onClick={onClose}
    >
      <div
        className="mx-auto my-4 w-[min(94vw,42rem)] overflow-hidden rounded-[var(--radius)] bg-[var(--surface)] shadow-xl sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video bg-[var(--surface-2)]">
          {img ? (
            <img
              src={img}
              alt={`Creative của ads Meta từ page ${ad.pageName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-[var(--dim)]">
              Ads video / chưa có ảnh tĩnh
            </div>
          )}
          <button
            type="button"
            aria-label="Đóng chi tiết ads"
            onClick={onClose}
            className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{ad.pageName}</h3>
            {ad.isActive ? (
              <span className="rounded-md bg-emerald-600/12 px-2 py-1 text-xs font-bold text-emerald-700">
                Đang chạy
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ad.theme ? <Chip accent>{ad.theme}</Chip> : null}
            {ad.productType ? <Chip>{ad.productType}</Chip> : null}
            {ad.salesChannel ? <Chip>{ad.salesChannel}</Chip> : null}
            {ad.platforms.map((p) => (
              <Chip key={p}>{META_PLATFORM_LABELS[p] ?? p}</Chip>
            ))}
          </div>
          {ad.title ? (
            <p className="text-base font-bold leading-snug">{ad.title}</p>
          ) : null}
          {ad.bodyText ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {ad.bodyText}
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-[var(--dim)]">Ngày bắt đầu</dt>
              <dd className="font-bold">{formatDate(startDateIso(ad))}</dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Đã chạy</dt>
              <dd className="font-bold">{ad.daysRunning} ngày</dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Số bản trùng</dt>
              <dd className="font-bold">
                {ad.collationCount != null ? ad.collationCount : "chưa rõ"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Thấy lần đầu</dt>
              <dd className="font-bold">
                {ad.firstSeenAt ? formatDate(ad.firstSeenAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--dim)]">Lần cuối thấy</dt>
              <dd className="font-bold">
                {ad.lastSeenAt ? formatDate(ad.lastSeenAt) : "—"}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {ad.linkUrl ? (
              <a
                href={ad.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white"
              >
                {ad.ctaText || "Tới trang bán"}{" "}
                <ExternalIcon className="h-4 w-4" />
              </a>
            ) : null}
            <a
              href={adLibraryUrl(ad)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 text-sm font-bold"
            >
              Xem trên Ads Library <ExternalIcon className="h-4 w-4" />
            </a>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <h4 className="text-sm font-extrabold">
              Sản phẩm Amazon cùng chủ đề
            </h4>
            {related == null || related.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">
                Chưa có dữ liệu sản phẩm cho chủ đề này
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {related.slice(0, 6).map((p) => (
                  <li key={p.asin}>
                    <button
                      type="button"
                      onClick={() => onOpenProduct(p.asin)}
                      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-2 text-left hover:bg-[var(--surface-2)]"
                    >
                      {POD_IMAGES[p.asin] ? (
                        <img
                          src={POD_IMAGES[p.asin]}
                          alt={`Ảnh sản phẩm ${p.name} trên Amazon`}
                          className="h-12 w-12 shrink-0 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded-md bg-[var(--surface-2)]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {p.name}
                        </span>
                        <span className="font-mono text-[13px] text-[var(--dim)]">
                          {formatPrice(p.price)}
                          {p.boughtPastMonth
                            ? ` · ${p.boughtPastMonth}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- tab

type SpySort = "longest" | "duplicates" | "newest";

export function SpyTab({
  onOpenProduct,
}: {
  onOpenProduct: (asin: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [productType, setProductType] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>("");
  const [minDays, setMinDays] = useState(0);
  const [sort, setSort] = useState<SpySort>("longest");
  const [detail, setDetail] = useState<PodSourceAd | null>(null);

  const podAds = useMemo(() => POD_SOURCE_ADS.filter((a) => a.isPod), []);
  const nonPodCount = POD_SOURCE_ADS.length - podAds.length;
  const topics = useMemo(() => computeTopics(podAds).slice(0, 4), [podAds]);

  // Stats summary — computed from the same podAds array the feed and topics
  // display, so the line always agrees with what is on the page.
  const summary = useMemo(() => {
    const themes = new Set<string>();
    const types = new Set<string>();
    let longest = 0;
    for (const a of podAds) {
      if (a.theme) themes.add(a.theme);
      if (a.productType) types.add(a.productType);
      if (a.daysRunning > longest) longest = a.daysRunning;
    }
    return {
      total: podAds.length,
      longestDays: longest,
      themeCount: themes.size,
      typeCount: types.size,
    };
  }, [podAds]);

  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of podAds) if (a.theme) m.set(a.theme, (m.get(a.theme) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [podAds]);
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of podAds)
      if (a.productType) m.set(a.productType, (m.get(a.productType) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [podAds]);
  const channels = useMemo(
    () =>
      [...new Set(podAds.map((a) => a.salesChannel).filter((c): c is string => !!c))].sort(),
    [podAds],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = podAds.filter((a) => {
      if (
        q &&
        !`${a.pageName} ${a.title ?? ""} ${a.bodyText ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (theme && a.theme !== theme) return false;
      if (productType && a.productType !== productType) return false;
      if (channel && a.salesChannel !== channel) return false;
      if (a.daysRunning < minDays) return false;
      return true;
    });
    switch (sort) {
      case "duplicates":
        out.sort(
          (a, b) => (b.collationCount ?? -1) - (a.collationCount ?? -1),
        );
        break;
      case "newest":
        out.sort((a, b) =>
          (b.firstSeenAt ?? "").localeCompare(a.firstSeenAt ?? ""),
        );
        break;
      default:
        out.sort((a, b) => b.daysRunning - a.daysRunning);
    }
    return out;
  }, [podAds, query, theme, productType, channel, minDays, sort]);

  const chipRow = (
    label: string,
    allLabel: string,
    value: string | null,
    setValue: (v: string | null) => void,
    counts: [string, number][],
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-semibold text-[var(--dim)]">
        {label}
      </span>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => setValue(null)}
        className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
          value === null
            ? "border-[var(--ink)] bg-[var(--ink)] text-white"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        {allLabel}
      </button>
      {counts.map(([name, count]) => (
        <button
          key={name}
          type="button"
          aria-pressed={value === name}
          onClick={() => setValue(value === name ? null : name)}
          className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold ${
            value === name
              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
              : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          {name}
          <span className="font-mono text-xs opacity-70">{count}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="py-4">
        <h2 className="text-xl font-extrabold tracking-tight">
          Spy Ads POD — soi quảng cáo in ấn trên Meta
        </h2>
        <p className="mt-0.5 font-mono text-[13px] text-[var(--dim)]">
          Dữ liệu thật · Meta Ads Library qua Apify · chỉ ads POD (in theo
          yêu cầu), đã phân loại theo chủ đề / loại sản phẩm / kênh bán
        </p>
        {podAds.length > 0 ? (
          <p className="mt-1 font-mono text-[13px] text-[var(--dim)]">
            {summary.total} ads POD · Ads chạy lâu nhất {summary.longestDays}{" "}
            ngày · {summary.themeCount} chủ đề · {summary.typeCount} loại sản
            phẩm
          </p>
        ) : null}
        {nonPodCount > 0 ? (
          <p className="mt-1 font-mono text-[13px] text-[var(--dim)]">
            Đã lọc {nonPodCount} ads không phải POD
          </p>
        ) : null}
      </div>

      {/* What to research today */}
      <section aria-label="Nghiên cứu hôm nay">
        <h3 className="text-base font-extrabold">🔥 Nghiên cứu hôm nay</h3>
        {topics.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
            Chưa có ads POD nào được phân loại.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {topics.map((t, i) => (
              <button
                key={t.theme}
                type="button"
                onClick={() => setTheme(t.theme)}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left hover:border-[var(--accent)]"
              >
                <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)]">
                  #{i + 1} · Ưu tiên nghiên cứu
                </p>
                <p className="mt-1 text-base font-extrabold">{t.theme}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--dim)]">
                  {t.reason}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--dim)]" />
          <span className="sr-only">Tìm ads POD</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo page, nội dung ads…"
            className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
          />
        </label>
        {chipRow("Chủ đề", "Tất cả", theme, setTheme, themeCounts)}
        {chipRow("Loại SP", "Tất cả", productType, setProductType, typeCounts)}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--dim)]">
              Kênh bán
            </span>
            <select
              aria-label="Lọc theo kênh bán"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
            >
              <option value="">Tất cả kênh</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--dim)]">
              Số ngày chạy
            </span>
            <select
              aria-label="Lọc theo số ngày chạy tối thiểu"
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
            >
              <option value={0}>Tất cả</option>
              <option value={7}>≥ 7 ngày</option>
              <option value={30}>≥ 30 ngày</option>
              <option value={90}>≥ 90 ngày</option>
            </select>
          </label>
          <label className="ml-auto flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--dim)]">
              Sắp xếp
            </span>
            <select
              aria-label="Sắp xếp ads POD"
              value={sort}
              onChange={(e) => setSort(e.target.value as SpySort)}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
            >
              <option value="longest">Chạy lâu nhất</option>
              <option value="duplicates">Nhiều bản trùng nhất</option>
              <option value="newest">Mới xuất hiện</option>
            </select>
          </label>
        </div>
      </div>

      <p className="py-3 text-sm text-[var(--dim)]" role="status">
        Hiển thị {visible.length}/{podAds.length} ads POD
      </p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="font-semibold">Không có ads POD nào khớp</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Thử bỏ bớt điều kiện lọc hoặc đổi chủ đề / loại sản phẩm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((ad) => (
            <SpyAdCard key={ad.adArchiveId} ad={ad} onOpen={setDetail} />
          ))}
        </div>
      )}

      {detail ? (
        <SpyAdDetail
          ad={detail}
          onClose={() => setDetail(null)}
          onOpenProduct={(asin) => {
            setDetail(null);
            onOpenProduct(asin);
          }}
        />
      ) : null}
    </div>
  );
}
