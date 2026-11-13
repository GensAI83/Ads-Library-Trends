// POD Radar (V2) for the standalone Vercel build — real crawled data for
// one niche: Amazon US POD / print fashion. Static snapshot of the
// latest Apify crawl (src/podData.ts); decisions are stored per-visitor
// in localStorage (ads-library-trends:decisions-v1), NOT synced anywhere.

import { useEffect, useMemo, useState } from "react";
import {
  AD_IMAGES,
  POD_CRAWL_DATE,
  POD_CRAWL_LABEL,
  POD_IMAGES,
  POD_PRODUCTS,
  POD_SNAPSHOTS,
  POD_SOURCE_ADS,
  type PodProduct,
  type PodSnapshot,
  type PodSourceAd,
} from "./podData";
import { formatDate } from "./labels";

const CRAWL_DATE_VI = formatDate(POD_CRAWL_DATE);
import {
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  ExternalIcon,
  TrendingUpIcon,
  XIcon,
} from "./icons";

export type DecisionStatus = "Test" | "Watch" | "Skip";

export interface PodDecision {
  productAsin: string;
  status: DecisionStatus;
  priority: number;
  budget: number | null;
  notes: string;
  updatedAt: string;
  // Product signals captured at decision time (mirror of the Muse app's
  // decisions.signal_* columns) so later tests can be judged against the
  // signals that motivated the decision. Null on records saved before
  // this field existed, or when the signal itself was missing.
  signalBoughtMin: number | null;
  signalReviewCount: number | null;
  signalRating: number | null;
  signalAdsCount: number | null;
}

const DECISIONS_KEY = "ads-library-trends:decisions-v1";

export const STATUS_LABELS: Record<DecisionStatus, string> = {
  Test: "Test thử",
  Watch: "Theo dõi",
  Skip: "Bỏ qua",
};

const META_PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  AUDIENCE_NETWORK: "Audience Network",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  THREADS: "Threads",
};

function loadDecisions(): Record<string, PodDecision> {
  try {
    const raw = localStorage.getItem(DECISIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: Record<string, PodDecision> = {};
    for (const [asin, v] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!v || typeof v !== "object") continue;
      const d = v as Partial<PodDecision>;
      if (
        (d.status === "Test" || d.status === "Watch" || d.status === "Skip") &&
        typeof d.priority === "number"
      ) {
        const dd = d as Record<string, unknown>;
        const numOrNull = (v: unknown): number | null =>
          typeof v === "number" && Number.isFinite(v) ? v : null;
        out[asin] = {
          productAsin: asin,
          status: d.status,
          priority: Math.min(5, Math.max(1, Math.round(d.priority))),
          budget: typeof d.budget === "number" ? d.budget : null,
          notes: typeof d.notes === "string" ? d.notes : "",
          updatedAt:
            typeof d.updatedAt === "string"
              ? d.updatedAt
              : new Date(0).toISOString(),
          signalBoughtMin: numOrNull(dd.signalBoughtMin),
          signalReviewCount: numOrNull(dd.signalReviewCount),
          signalRating: numOrNull(dd.signalRating),
          signalAdsCount: numOrNull(dd.signalAdsCount),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function storeDecisions(decisions: Record<string, PodDecision>): void {
  try {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  } catch {
    // storage unavailable (private mode / quota) — decisions won't persist
  }
}

export function formatPrice(v: number | null): string {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

export function formatNum(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("vi-VN");
}

export function formatBsr(v: number | null): string {
  return v == null ? "BSR: chưa có" : `BSR #${v.toLocaleString("vi-VN")}`;
}

function statusChipClass(status: DecisionStatus): string {
  if (status === "Test") return "bg-[#ff4d2e]/10 text-[var(--accent-ink)]";
  if (status === "Watch") return "bg-[#0e7c6b]/12 text-[var(--teal)]";
  return "bg-[var(--surface-2)] text-[var(--dim)]";
}

function startDateIso(ad: PodSourceAd): string {
  return new Date(ad.startDate * 1000).toISOString().slice(0, 10);
}

function adLibraryUrl(ad: PodSourceAd): string {
  return `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
}

export function adText(ad: PodSourceAd): string {
  return `${ad.pageName} ${ad.title ?? ""} ${ad.bodyText ?? ""}`.toLowerCase();
}

// True when the ad matched via the product's brand appearing in the ad
// text (the stronger signal); keyword-only matches return false.
export function adBrandMatch(ad: PodSourceAd, brand: string): boolean {
  const b = brand.trim().toLowerCase();
  return b.length >= 3 && adText(ad).includes(b);
}

// Mirrors the Muse server's matching rule: a source ad belongs to a product
// when the product's brand shows up in the ad's page name / title / body;
// otherwise when every meaningful token of the keyword that found the
// product appears in the ad text.
export function adMatchesProduct(
  ad: PodSourceAd,
  brand: string,
  searchQuery: string,
): boolean {
  if (adBrandMatch(ad, brand)) return true;
  const haystack = adText(ad);
  const tokens = searchQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  return tokens.length > 0 && tokens.every((t) => haystack.includes(t));
}

// Signals captured into a decision at save time (item C mirror).
export function decisionSignals(product: PodProduct): {
  signalBoughtMin: number | null;
  signalReviewCount: number | null;
  signalRating: number | null;
  signalAdsCount: number | null;
} {
  return {
    signalBoughtMin: product.boughtPastMonthMin ?? null,
    signalReviewCount: product.reviewCount ?? null,
    signalRating: product.rating ?? null,
    signalAdsCount: matchedAds(product).length,
  };
}

export function signalLine(d: PodDecision): string | null {
  if (
    d.signalBoughtMin == null &&
    d.signalReviewCount == null &&
    d.signalRating == null &&
    d.signalAdsCount == null
  ) {
    return null;
  }
  const badge =
    d.signalBoughtMin != null ? `${formatNum(d.signalBoughtMin)}+` : "—";
  const reviews =
    d.signalReviewCount != null ? formatNum(d.signalReviewCount) : "—";
  const rating = d.signalRating != null ? d.signalRating.toFixed(1) : "—";
  const ads = d.signalAdsCount != null ? String(d.signalAdsCount) : "—";
  return `Tín hiệu lúc quyết định: badge ${badge} · ${reviews} review · ★${rating} · ${ads} ads`;
}

// Honest review display: a 0/NULL review count together with a NULL rating
// means the crawl had no review data — not that the product has 0 reviews.
export function reviewText(p: PodProduct): string {
  if ((p.reviewCount == null || p.reviewCount === 0) && p.rating == null) {
    return "Chưa có review/dữ liệu";
  }
  return formatNum(p.reviewCount);
}

const SAIGON_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Saigon",
});

export function isNewProduct(p: PodProduct): boolean {
  if (p.firstSeenAt == null) return false;
  return SAIGON_DATE.format(new Date(p.firstSeenAt)) === POD_CRAWL_DATE;
}

export function matchedAds(product: PodProduct): PodSourceAd[] {
  return POD_SOURCE_ADS.filter((ad) =>
    adMatchesProduct(ad, product.brand, product.searchQuery),
  ).sort((a, b) => b.daysRunning - a.daysRunning);
}

export function snapshotsFor(asin: string): PodSnapshot[] {
  return POD_SNAPSHOTS.filter((s) => s.asin === asin).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function CompareToggle({
  active,
  disabled,
  onToggle,
  name,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
  name: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Bỏ ${name} khỏi danh sách so sánh`
          : `Thêm ${name} vào so sánh`
      }
      disabled={!active && disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border text-sm font-semibold ${
        active
          ? "border-[var(--teal)] bg-[#0e7c6b]/10 text-[var(--teal)]"
          : "border-[var(--border)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
      }`}
    >
      {active ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      {active ? "Đang so sánh" : "So sánh"}
    </button>
  );
}

export function PodProductCard({
  product,
  inCompare,
  compareFull,
  onToggleCompare,
  onOpen,
  decision,
  onQuickDecision,
}: {
  product: PodProduct;
  inCompare: boolean;
  compareFull: boolean;
  onToggleCompare: (asin: string) => void;
  onOpen: (asin: string) => void;
  decision?: PodDecision | null;
  onQuickDecision?: (asin: string, status: DecisionStatus) => void;
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
        {product.brand ? (
          <p className="-mt-1 truncate text-xs text-[var(--dim)]">
            Brand: {product.brand}
          </p>
        ) : null}

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold">
            {formatPrice(product.price)}
          </span>
          {product.listPrice != null &&
          product.price != null &&
          product.listPrice > product.price ? (
            <span className="font-mono text-[13px] text-[var(--dim)] line-through">
              {formatPrice(product.listPrice)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {product.rating != null ? (
            <span>
              <span className="font-semibold text-[var(--gold)]">★</span>{" "}
              <strong>{product.rating.toFixed(1)}</strong>{" "}
              <span className="text-[var(--dim)]">
                ({formatNum(product.reviewCount)} review)
              </span>
            </span>
          ) : product.reviewCount == null || product.reviewCount === 0 ? (
            <span className="text-[var(--dim)]">Chưa có review/dữ liệu</span>
          ) : (
            <span className="text-[var(--dim)]">Chưa có rating</span>
          )}
          <span className="font-mono text-[var(--dim)]">
            {formatBsr(product.bestSellerRank)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {isNewProduct(product) ? (
            <span className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-bold text-white">
              Mới
            </span>
          ) : null}
          {product.isBestSeller ? (
            <span className="rounded-md bg-[#b97f10]/15 px-2 py-1 text-xs font-semibold text-[var(--gold)]">
              Best Seller
            </span>
          ) : null}
          {product.isSponsored ? (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--dim)]">
              Sponsored
            </span>
          ) : null}
          {product.boughtPastMonthMin != null ? (
            <span className="rounded-md bg-[#0e7c6b]/12 px-2 py-1 text-xs font-semibold text-[var(--teal)]">
              Bán ≥{formatNum(product.boughtPastMonthMin)}/tháng
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex gap-2 pt-1.5">
          <button
            type="button"
            onClick={() => onOpen(product.asin)}
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white hover:bg-[var(--ink-2)]"
          >
            Xem hồ sơ
          </button>
          <CompareToggle
            active={inCompare}
            disabled={compareFull}
            onToggle={() => onToggleCompare(product.asin)}
            name={product.name}
          />
        </div>
        {onQuickDecision ? (
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label={`Quyết định nhanh cho ${product.name}`}
          >
            <span className="text-xs font-medium text-[var(--dim)]">
              {decision ? `Đã quyết định: ${decision.status}` : "Quyết định:"}
            </span>
            {(["Test", "Watch", "Skip"] as DecisionStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={decision?.status === s}
                onClick={() => onQuickDecision(product.asin, s)}
                className={`inline-flex min-h-8 flex-1 items-center justify-center rounded-md border px-2 text-xs font-bold ${
                  decision?.status === s
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--border)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function SourceAdCard({ ad }: { ad: PodSourceAd }) {
  const img = AD_IMAGES[ad.adArchiveId];
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] sm:flex-row">
      <div className="relative aspect-square w-full shrink-0 bg-[var(--surface-2)] sm:w-40">
        {img ? (
          <img
            src={img}
            alt={`Creative của ads Meta từ page ${ad.pageName}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-[var(--dim)]">
            Ads không có ảnh tĩnh (video/format khác)
          </div>
        )}
        {ad.isActive ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/85 px-2 py-0.5 text-xs font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Đang chạy
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold">{ad.pageName}</p>
          {ad.ctaText ? (
            <span className="shrink-0 rounded-md bg-[var(--ink)] px-2 py-1 text-xs font-semibold text-white">
              {ad.ctaText}
            </span>
          ) : null}
        </div>
        {ad.title ? (
          <p className="text-sm font-semibold leading-snug">{ad.title}</p>
        ) : null}
        {ad.bodyText ? (
          <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--dim)]">
            {ad.bodyText}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
          <span
            className="inline-flex items-center gap-1"
            title="Ngày bắt đầu chạy ads"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            {formatDate(startDateIso(ad))} · <strong>{ad.daysRunning}</strong>{" "}
            ngày
          </span>
          <span
            className="inline-flex items-center gap-1"
            title="Số bản trùng (collation) của ads"
          >
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
        {ad.firstSeenAt || ad.lastSeenAt ? (
          <p className="text-xs text-[var(--dim)]">
            {ad.firstSeenAt
              ? `Thấy lần đầu: ${formatDate(ad.firstSeenAt)}`
              : ""}
            {ad.firstSeenAt && ad.lastSeenAt ? " · " : ""}
            {ad.lastSeenAt ? `Lần cuối: ${formatDate(ad.lastSeenAt)}` : ""}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {ad.platforms.map((p) => (
            <span
              key={p}
              className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium"
            >
              {META_PLATFORM_LABELS[p] ?? p}
            </span>
          ))}
          <a
            href={adLibraryUrl(ad)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-[var(--accent-ink)] underline underline-offset-2"
          >
            Ad Library <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

function SnapshotChart({ snapshots }: { snapshots: PodSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-[var(--dim)]">
        Chưa có snapshot nào cho sản phẩm này.
      </p>
    );
  }
  const W = 640;
  const H = 180;
  const PAD = { top: 14, right: 14, bottom: 24, left: 44 };
  const values = snapshots
    .map((s) => s.reviewCount)
    .filter((v): v is number => v != null);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) =>
    snapshots.length === 1
      ? (PAD.left + W - PAD.right) / 2
      : PAD.left + (i * (W - PAD.left - PAD.right)) / (snapshots.length - 1);
  const y = (v: number) =>
    PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);
  const points = snapshots
    .map((s, i) => (s.reviewCount == null ? null : `${x(i)},${y(s.reviewCount)}`))
    .filter((p): p is string => p != null)
    .join(" ");
  const hasBsr = snapshots.some((s) => s.bestSellerRank != null);
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        role="img"
        aria-label="Biểu đồ snapshot: số review theo ngày crawl"
      >
        <line
          x1={PAD.left}
          y1={H - PAD.bottom}
          x2={W - PAD.right}
          y2={H - PAD.bottom}
          stroke="var(--border)"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={H - PAD.bottom}
          stroke="var(--border)"
        />
        <text x={4} y={PAD.top + 4} fontSize={11} fill="var(--dim)">
          {formatNum(max)}
        </text>
        <text x={4} y={H - PAD.bottom} fontSize={11} fill="var(--dim)">
          {formatNum(min)}
        </text>
        {points ? (
          <polyline
            points={points}
            fill="none"
            stroke="var(--teal)"
            strokeWidth={2}
          />
        ) : null}
        {snapshots.map((s, i) =>
          s.reviewCount == null ? null : (
            <g key={s.date}>
              <circle cx={x(i)} cy={y(s.reviewCount)} r={4.5} fill="var(--teal)" />
              <text
                x={x(i)}
                y={H - 6}
                fontSize={11}
                fill="var(--dim)"
                textAnchor="middle"
              >
                {formatDate(s.date)}
              </text>
            </g>
          ),
        )}
      </svg>
      <p className="mt-1 text-[13px] text-[var(--dim)]">
        Đường: số review theo ngày crawl. Hiện có {snapshots.length} ngày dữ
        liệu: {snapshots.map((s) => formatDate(s.date)).join(", ")} — đường
        cong sẽ dài ra sau mỗi lần crawl hằng ngày trong bản Muse.
        {!hasBsr
          ? " BSR chưa có trong lần crawl đầu (kết quả tìm kiếm Amazon không trả hạng số) — đường BSR sẽ xuất hiện khi các lần crawl sau lấy được hạng."
          : ""}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--dim)]">
              <th scope="col" className="px-2 py-2 font-semibold">Ngày</th>
              <th scope="col" className="px-2 py-2 font-semibold">Giá</th>
              <th scope="col" className="px-2 py-2 font-semibold">Rating</th>
              <th scope="col" className="px-2 py-2 font-semibold">Review</th>
              <th scope="col" className="px-2 py-2 font-semibold">BSR</th>
              <th scope="col" className="px-2 py-2 font-semibold">Bán/tháng (tối thiểu)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {snapshots.map((s) => (
              <tr key={s.date}>
                <td className="px-2 py-2 font-mono">{formatDate(s.date)}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(s.price)}</td>
                <td className="px-2 py-2 font-mono">
                  {s.rating != null ? s.rating.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-2 font-mono">{formatNum(s.reviewCount)}</td>
                <td className="px-2 py-2 font-mono">
                  {s.bestSellerRank != null
                    ? `#${formatNum(s.bestSellerRank)}`
                    : "Chưa có"}
                </td>
                <td className="px-2 py-2 font-mono">
                  {s.boughtPastMonthMin != null
                    ? `≥${formatNum(s.boughtPastMonthMin)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionForm({
  asin,
  decision,
  onSave,
}: {
  asin: string;
  decision: PodDecision | null;
  onSave: (d: PodDecision) => void;
}) {
  const [status, setStatus] = useState<DecisionStatus>(
    decision?.status ?? "Watch",
  );
  const [priority, setPriority] = useState<number>(decision?.priority ?? 3);
  const [budget, setBudget] = useState<string>(
    decision?.budget != null ? String(decision.budget) : "",
  );
  const [notes, setNotes] = useState<string>(decision?.notes ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(
    decision?.updatedAt ?? null,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d: PodDecision = {
          productAsin: asin,
          status,
          priority,
          budget: budget.trim() === "" ? null : Number(budget),
          notes: notes.trim(),
          updatedAt: new Date().toISOString(),
          // Placeholders — PodTab.saveDecision re-captures the product's
          // current signals on every save.
          signalBoughtMin: decision?.signalBoughtMin ?? null,
          signalReviewCount: decision?.signalReviewCount ?? null,
          signalRating: decision?.signalRating ?? null,
          signalAdsCount: decision?.signalAdsCount ?? null,
        };
        onSave(d);
        setSavedAt(d.updatedAt);
      }}
      className="flex flex-col gap-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Trạng thái quyết định
        </legend>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Chọn trạng thái quyết định"
        >
          {(Object.keys(STATUS_LABELS) as DecisionStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold ${
                status === s
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {STATUS_LABELS[s]} · {s}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Mức ưu tiên (1–5)</legend>
        <div
          className="flex gap-1.5"
          role="group"
          aria-label="Chọn mức ưu tiên từ 1 đến 5"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={priority === n}
              aria-label={`Ưu tiên ${n}`}
              onClick={() => setPriority(n)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-sm font-bold ${
                priority === n
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Ngân sách test (USD)
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="VD: 150"
            className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Ghi chú
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lý do test, góc thiết kế định thử…"
            className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--dim)]">
        Quyết định được lưu ngay trên trình duyệt của máy này (localStorage,
        khóa <span className="font-mono">{DECISIONS_KEY}</span>) — không đồng
        bộ sang máy hay trình duyệt khác, giống danh sách theo dõi ở tab Đã
        lưu.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white"
        >
          Lưu quyết định
        </button>
        {savedAt ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--teal)]">
            <CheckIcon className="h-4 w-4" /> Đã lưu · cập nhật{" "}
            {new Date(savedAt).toLocaleString("vi-VN")}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="flex items-baseline gap-2 text-base font-extrabold tracking-tight">
      <span className="font-mono text-[var(--accent)]">{n}.</span> {title}
    </h3>
  );
}

function PodDossier({
  product,
  compare,
  onToggleCompare,
  onOpen,
  onBack,
  decision,
  onSaveDecision,
}: {
  product: PodProduct;
  compare: string[];
  onToggleCompare: (asin: string) => void;
  onOpen: (asin: string) => void;
  onBack: () => void;
  decision: PodDecision | null;
  onSaveDecision: (d: PodDecision) => void;
}) {
  const img = POD_IMAGES[product.asin];
  const snapshots = snapshotsFor(product.asin);
  const ads = matchedAds(product);
  const brandMatchedCount = ads.filter((ad) =>
    adBrandMatch(ad, product.brand),
  ).length;
  const competitors = POD_PRODUCTS.filter(
    (p) => p.searchQuery === product.searchQuery && p.asin !== product.asin,
  );
  const earliestAd = ads.reduce<PodSourceAd | null>(
    (acc, ad) => (acc == null || ad.startDate < acc.startDate ? ad : acc),
    null,
  );

  return (
    <div className="py-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-bold"
      >
        ← Quay lại feed phát hiện
      </button>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-[var(--radius)] bg-white sm:w-56">
            {img ? (
              <img
                src={img}
                alt={`Ảnh sản phẩm ${product.name} trên Amazon`}
                className="h-full w-full object-cover"
              />
            ) : null}
            {product.boughtPastMonth ? (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-white">
                <TrendingUpIcon className="h-3.5 w-3.5" />
                {product.boughtPastMonth}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold leading-tight tracking-tight">
              {product.name}
            </h2>
            <p className="mt-1 font-mono text-[13px] text-[var(--dim)]">
              ASIN {product.asin}
              {product.brand ? ` · Brand: ${product.brand}` : ""}
              {product.seller ? ` · Seller: ${product.seller}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.isBestSeller ? (
                <span className="rounded-md bg-[#b97f10]/15 px-2 py-1 text-xs font-semibold text-[var(--gold)]">
                  Best Seller
                </span>
              ) : null}
              {product.isSponsored ? (
                <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--dim)]">
                  Sponsored trên Amazon
                </span>
              ) : null}
              <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium">
                Từ khóa crawl: “{product.searchQuery}”
              </span>
            </div>
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-white"
            >
              Xem trên Amazon <ExternalIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <section
          aria-label="Tổng quan và tăng trưởng"
          className="flex flex-col gap-3"
        >
          <SectionTitle n={1} title="Tổng quan & tăng trưởng" />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Giá bán", formatPrice(product.price)],
                ["Giá niêm yết", formatPrice(product.listPrice)],
                [
                  "Rating",
                  product.rating != null
                    ? `★ ${product.rating.toFixed(1)}`
                    : "—",
                ],
                ["Số review", reviewText(product)],
                [
                  "BSR",
                  product.bestSellerRank != null
                    ? `#${formatNum(product.bestSellerRank)}`
                    : "Chưa có",
                ],
                ["Bán tháng qua", product.boughtPastMonth ?? "Chưa có badge"],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <dt className="text-xs text-[var(--dim)]">{label}</dt>
                <dd className="mt-0.5 font-mono text-[15px] font-bold leading-snug">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <SnapshotChart snapshots={snapshots} />
          </div>
          <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm leading-relaxed">
            Đây là bản chụp tĩnh của lần crawl ngày {CRAWL_DATE_VI}. Đường cong
            tăng trưởng lớn dần theo các lần crawl hằng ngày trong bản Muse —
            bản web tĩnh này chỉ hiển thị dữ liệu đã crawl tới ngày đó.
          </p>
          {earliestAd ? (
            <p className="text-sm leading-relaxed text-[var(--dim)]">
              <strong className="text-[var(--text)]">Tín hiệu quá khứ:</strong>{" "}
              ads Meta khớp ngách này đã chạy từ{" "}
              {formatDate(startDateIso(earliestAd))} (page{" "}
              {earliestAd.pageName}, {earliestAd.daysRunning} ngày) — dùng
              ngày bắt đầu ads làm mốc tuổi nhu cầu của thiết kế/ngách khi chưa
              có lịch sử listing.
            </p>
          ) : null}
        </section>

        <section
          aria-label="Quảng cáo nguồn Meta"
          className="flex flex-col gap-3"
        >
          <SectionTitle n={2} title="Quảng cáo nguồn (Meta)" />
          {ads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              Chưa khớp được ads Meta nào cho sản phẩm này theo brand/từ khóa
              trong lần crawl {CRAWL_DATE_VI}.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">
                Ads cùng ngách/từ khóa (chưa khớp cứng từng sản phẩm)
              </p>
              <p className="text-sm text-[var(--dim)]">
                {ads.length} ads khớp theo{" "}
                {product.brand ? "brand hoặc " : ""}từ khóa “
                {product.searchQuery}” trong nội dung ads.
              </p>
              {brandMatchedCount > 0 ? (
                <p className="text-sm text-[var(--dim)]">
                  Trong đó khớp brand: {brandMatchedCount} ads
                </p>
              ) : null}
              <div className="flex flex-col gap-3">
                {ads.map((ad) => (
                  <SourceAdCard key={ad.adArchiveId} ad={ad} />
                ))}
              </div>
            </>
          )}
        </section>

        <section aria-label="So sánh đối thủ" className="flex flex-col gap-3">
          <SectionTitle n={3} title="So sánh đối thủ" />
          <p className="text-sm text-[var(--dim)]">
            Các sản phẩm cùng từ khóa “{product.searchQuery}” trong lần crawl
            — bấm “So sánh” để ghim tối đa 5 sản phẩm vào bảng đối chiếu.
          </p>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--dim)]">
                  <th scope="col" className="px-3 py-2.5 font-semibold">Sản phẩm</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Giá</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">BSR</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Bán/tháng</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Rating</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Review</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    <span className="sr-only">Hành động</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[product, ...competitors].map((p) => {
                  const isSelf = p.asin === product.asin;
                  const pImg = POD_IMAGES[p.asin];
                  return (
                    <tr
                      key={p.asin}
                      className={isSelf ? "bg-[var(--surface-2)]/60" : ""}
                    >
                      <td className="max-w-56 px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          {pImg ? (
                            <img
                              src={pImg}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-md object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          <span className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpen(p.asin)}
                              className="block max-w-full truncate text-left font-semibold hover:underline"
                            >
                              {p.name}
                            </button>
                            {isSelf ? (
                              <span className="text-xs font-semibold text-[var(--accent-ink)]">
                                Sản phẩm đang xem
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatPrice(p.price)}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {p.bestSellerRank != null
                          ? `#${formatNum(p.bestSellerRank)}`
                          : "Chưa có"}
                      </td>
                      <td className="px-3 py-2.5">{p.boughtPastMonth ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono">
                        {p.rating != null ? p.rating.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {reviewText(p)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="w-32">
                          <CompareToggle
                            active={compare.includes(p.asin)}
                            disabled={compare.length >= 5}
                            onToggle={() => onToggleCompare(p.asin)}
                            name={p.name}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Quyết định thử" className="flex flex-col gap-3">
          <SectionTitle n={4} title="Quyết định thử" />
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <DecisionForm
              key={`${product.asin}-${decision?.updatedAt ?? "new"}`}
              asin={product.asin}
              decision={decision}
              onSave={onSaveDecision}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ComparePanel({
  products,
  onRemove,
  onClear,
  onOpen,
}: {
  products: PodProduct[];
  onRemove: (asin: string) => void;
  onClear: () => void;
  onOpen: (asin: string) => void;
}) {
  if (products.length === 0) return null;
  const rows: { label: string; render: (p: PodProduct) => React.ReactNode }[] =
    [
      { label: "Giá", render: (p) => formatPrice(p.price) },
      { label: "Giá niêm yết", render: (p) => formatPrice(p.listPrice) },
      {
        label: "BSR",
        render: (p) =>
          p.bestSellerRank != null
            ? `#${formatNum(p.bestSellerRank)}`
            : "Chưa có",
      },
      { label: "Bán tháng qua", render: (p) => p.boughtPastMonth ?? "—" },
      {
        label: "Rating",
        render: (p) => (p.rating != null ? `★ ${p.rating.toFixed(1)}` : "—"),
      },
      { label: "Số review", render: (p) => reviewText(p) },
      {
        label: "Cờ",
        render: (p) =>
          [p.isBestSeller ? "Best Seller" : null, p.isSponsored ? "Sponsored" : null]
            .filter(Boolean)
            .join(" · ") || "—",
      },
    ];
  return (
    <section
      aria-label="Bảng so sánh sản phẩm đã chọn"
      className="mt-4 rounded-[var(--radius)] border border-[var(--teal)]/40 bg-[var(--surface)] p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold">
          Đối chiếu so sánh · {products.length}/5 sản phẩm
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 items-center rounded-md px-2 text-[13px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--surface-2)]"
        >
          Xóa hết
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                scope="col"
                className="w-28 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--dim)]"
              >
                Tiêu chí
              </th>
              {products.map((p) => (
                <th
                  key={p.asin}
                  scope="col"
                  className="min-w-36 px-2 py-2 align-top"
                >
                  <span className="flex items-start gap-2">
                    {POD_IMAGES[p.asin] ? (
                      <img
                        src={POD_IMAGES[p.asin]}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : null}
                    <span className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpen(p.asin)}
                        className="block text-left text-[13px] font-bold leading-snug hover:underline"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Bỏ ${p.name} khỏi so sánh`}
                        onClick={() => onRemove(p.asin)}
                        className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--accent-ink)]"
                      >
                        <XIcon className="h-3 w-3" /> Bỏ
                      </button>
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="px-2 py-2 text-[13px] font-semibold text-[var(--dim)]"
                >
                  {row.label}
                </th>
                {products.map((p) => (
                  <td key={p.asin} className="px-2 py-2 font-mono text-[13px]">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type PodView = "feed" | "decisions";
type PodSort = "default" | "reviews" | "priceAsc" | "priceDesc" | "rating";

function descNullsLast(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function ascNullsLast(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export function PodTab({
  requestedAsin,
  onRequestedAsinHandled,
}: {
  requestedAsin?: string | null;
  onRequestedAsinHandled?: () => void;
} = {}) {
  const [view, setView] = useState<PodView>("feed");
  const [dossierAsin, setDossierAsin] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [decisions, setDecisions] =
    useState<Record<string, PodDecision>>(loadDecisions);
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState<string | null>(null);
  const [hideSponsored, setHideSponsored] = useState(false);
  const [minBadge, setMinBadge] = useState(0);
  const [sort, setSort] = useState<PodSort>("default");

  const products = POD_PRODUCTS;
  const byAsin = useMemo(
    () => new Map(products.map((p) => [p.asin, p])),
    [products],
  );
  const keywords = useMemo(
    () => [...new Set(products.map((p) => p.searchQuery))],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.asin.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (keyword && p.searchQuery !== keyword) return false;
      if (hideSponsored && p.isSponsored) return false;
      if ((p.boughtPastMonthMin ?? 0) < minBadge) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "reviews") {
      sorted.sort((a, b) => descNullsLast(a.reviewCount, b.reviewCount));
    } else if (sort === "priceAsc") {
      sorted.sort((a, b) => ascNullsLast(a.price, b.price));
    } else if (sort === "priceDesc") {
      sorted.sort((a, b) => descNullsLast(a.price, b.price));
    } else if (sort === "rating") {
      sorted.sort((a, b) => descNullsLast(a.rating, b.rating));
    }
    return sorted;
  }, [products, query, keyword, hideSponsored, minBadge, sort]);

  const toggleCompare = (asin: string) =>
    setCompare((cur) =>
      cur.includes(asin)
        ? cur.filter((a) => a !== asin)
        : cur.length >= 5
          ? cur
          : [...cur, asin],
    );

  const openDossier = (asin: string) => {
    setDossierAsin(asin);
    window.scrollTo({ top: 0 });
  };

  // Cross-tab link from Spy Ads: open the requested product's dossier.
  useEffect(() => {
    if (requestedAsin) {
      openDossier(requestedAsin);
      onRequestedAsinHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAsin]);

  const saveDecision = (d: PodDecision) => {
    // Capture the product's current signals on every save (create or
    // update), mirroring the Muse app's saveDecision.
    const product = byAsin.get(d.productAsin);
    const enriched = product ? { ...d, ...decisionSignals(product) } : d;
    setDecisions((cur) => {
      const next = { ...cur, [enriched.productAsin]: enriched };
      storeDecisions(next);
      return next;
    });
  };

  const quickDecision = (asin: string, status: DecisionStatus) => {
    const existing = decisions[asin];
    saveDecision({
      productAsin: asin,
      status,
      priority: existing?.priority ?? 3,
      budget: existing?.budget ?? null,
      notes: existing?.notes ?? "",
      updatedAt: new Date().toISOString(),
      signalBoughtMin: null,
      signalReviewCount: null,
      signalRating: null,
      signalAdsCount: null,
    });
  };

  if (dossierAsin) {
    const product = byAsin.get(dossierAsin);
    if (product) {
      return (
        <PodDossier
          product={product}
          compare={compare}
          onToggleCompare={toggleCompare}
          onOpen={openDossier}
          onBack={() => setDossierAsin(null)}
          decision={decisions[dossierAsin] ?? null}
          onSaveDecision={saveDecision}
        />
      );
    }
  }

  const compareProducts = compare
    .map((asin) => byAsin.get(asin))
    .filter((p): p is PodProduct => p != null);
  const decided = Object.values(decisions)
    .filter((d) => byAsin.has(d.productAsin))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div>
      <div className="py-4">
        <h2 className="text-xl font-extrabold tracking-tight">
          POD Radar — phát hiện sản phẩm in ấn
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] text-[var(--dim)]">
          <span className="font-semibold text-[var(--teal)]">
            {POD_CRAWL_LABEL}
          </span>
          <span>Amazon US · POD / thời trang in ấn</span>
          <span>
            Từ khóa: “funny cat t-shirt” · “funny dog t-shirt” · “christmas
            cat t-shirt”
          </span>
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--dim)]">
          Bản web tĩnh này là bản chụp (snapshot) của dữ liệu crawl ngày{" "}
          {CRAWL_DATE_VI} — không tự crawl thêm. Quyết định Test/Watch/Skip được
          lưu trên trình duyệt này, không đồng bộ với bản Muse.
        </p>
      </div>

      <div
        className="flex gap-1.5"
        role="group"
        aria-label="Chế độ xem POD Radar"
      >
        <button
          type="button"
          aria-pressed={view === "feed"}
          onClick={() => setView("feed")}
          className={`inline-flex min-h-10 items-center rounded-lg px-3.5 text-sm font-bold ${
            view === "feed"
              ? "bg-[var(--ink)] text-white"
              : "border border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          Feed phát hiện
        </button>
        <button
          type="button"
          aria-pressed={view === "decisions"}
          onClick={() => setView("decisions")}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-bold ${
            view === "decisions"
              ? "bg-[var(--ink)] text-white"
              : "border border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          5. Quyết định đã lưu
          {decided.length > 0 ? (
            <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
              {decided.length}
            </span>
          ) : null}
        </button>
      </div>

      {view === "feed" ? (
        <>
          <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên sản phẩm hoặc ASIN…"
                aria-label="Tìm sản phẩm theo tên hoặc ASIN"
                className="h-10 min-w-52 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                aria-pressed={hideSponsored}
                onClick={() => setHideSponsored((v) => !v)}
                className={`inline-flex min-h-10 items-center rounded-lg border px-3.5 text-sm font-bold ${
                  hideSponsored
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                Ẩn Sponsored
              </button>
              <label className="flex items-center gap-2 text-sm font-semibold">
                Badge mua tối thiểu
                <select
                  value={minBadge}
                  onChange={(e) => setMinBadge(Number(e.target.value))}
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-normal outline-none focus:border-[var(--accent)]"
                >
                  <option value={0}>Tất cả</option>
                  <option value={50}>≥50</option>
                  <option value={100}>≥100</option>
                  <option value={300}>≥300</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                Sắp xếp
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as PodSort)}
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-normal outline-none focus:border-[var(--accent)]"
                >
                  <option value="default">Mặc định</option>
                  <option value="reviews">Review nhiều nhất</option>
                  <option value="priceAsc">Giá thấp → cao</option>
                  <option value="priceDesc">Giá cao → thấp</option>
                  <option value="rating">Rating cao nhất</option>
                </select>
              </label>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Lọc theo nhóm từ khóa"
            >
              <button
                type="button"
                aria-pressed={keyword === null}
                onClick={() => setKeyword(null)}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-bold ${
                  keyword === null
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                Tất cả
              </button>
              {keywords.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  aria-pressed={keyword === kw}
                  onClick={() => setKeyword(kw)}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-bold ${
                    keyword === kw
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
          <p className="py-3 text-sm text-[var(--dim)]" role="status">
            Hiển thị {visibleProducts.length}/{products.length} sản phẩm ·{" "}
            {POD_SOURCE_ADS.length} ads nguồn Meta · xếp mặc định theo lượng
            mua tháng qua giảm dần, rồi BSR tăng dần
            {compare.length > 0
              ? ` · Đang so sánh ${compare.length}/5 — bảng đối chiếu ở cuối feed`
              : ""}
          </p>
          {visibleProducts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--dim)]">
              Không có sản phẩm nào khớp bộ lọc hiện tại — thử bỏ bớt điều
              kiện lọc.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((p) => (
              <PodProductCard
                key={p.asin}
                product={p}
                inCompare={compare.includes(p.asin)}
                compareFull={compare.length >= 5}
                onToggleCompare={toggleCompare}
                onOpen={openDossier}
                decision={decisions[p.asin] ?? null}
                onQuickDecision={quickDecision}
              />
            ))}
          </div>
          <ComparePanel
            products={compareProducts}
            onRemove={toggleCompare}
            onClear={() => setCompare([])}
            onOpen={openDossier}
          />
        </>
      ) : (
        <div className="py-4">
          {decided.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="font-semibold">Chưa có quyết định nào</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
                Mở hồ sơ một sản phẩm ở feed phát hiện và lưu quyết định ở
                mục 4 “Quyết định thử” — quyết định sẽ hiện ở đây. Quyết định
                chỉ lưu trên trình duyệt này.
              </p>
              <button
                type="button"
                onClick={() => setView("feed")}
                className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-white"
              >
                Đi tới feed phát hiện
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {decided.map((decision) => {
                const product = byAsin.get(decision.productAsin);
                if (!product) return null;
                return (
                  <li
                    key={decision.productAsin}
                    className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:flex-row sm:items-center"
                  >
                    {POD_IMAGES[product.asin] ? (
                      <img
                        src={POD_IMAGES[product.asin]}
                        alt={`Ảnh sản phẩm ${product.name}`}
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold leading-snug">
                        {product.name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--dim)]">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-bold ${statusChipClass(decision.status)}`}
                        >
                          {STATUS_LABELS[decision.status]} · {decision.status}
                        </span>
                        <span>
                          Ưu tiên{" "}
                          <strong className="text-[var(--text)]">
                            {decision.priority}/5
                          </strong>
                        </span>
                        <span>
                          Ngân sách:{" "}
                          <strong className="text-[var(--text)]">
                            {decision.budget != null
                              ? `$${decision.budget.toLocaleString("vi-VN")}`
                              : "chưa đặt"}
                          </strong>
                        </span>
                        <span>
                          Cập nhật{" "}
                          {new Date(decision.updatedAt).toLocaleString("vi-VN")}
                        </span>
                      </p>
                      {signalLine(decision) ? (
                        <p className="mt-1 font-mono text-[13px] text-[var(--dim)]">
                          {signalLine(decision)}
                        </p>
                      ) : null}
                      {decision.notes ? (
                        <p className="mt-1 text-sm leading-relaxed">
                          {decision.notes}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => openDossier(product.asin)}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-white"
                    >
                      Mở hồ sơ
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
