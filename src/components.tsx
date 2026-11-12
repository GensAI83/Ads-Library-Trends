import { useQuery } from "@tanstack/react-query";
import { api, type AdOut, type OverviewOut, type TrendOut } from "./api";
import {
CREATIVES,
HOOK_LABELS,
LANDING_LABELS,
MEDIA_LABELS,
PLATFORM_COLORS,
PLATFORM_LABELS,
TREND_KIND_LABELS,
formatDate,
formatDuration,
} from "./labels";
import {
BookmarkFilledIcon,
BookmarkIcon,
CalendarIcon,
CheckIcon,
CopyIcon,
ExternalIcon,
FlameIcon,
GlobeIcon,
PlayIcon,
ResetIcon,
SparklesIcon,
TrendingUpIcon,
XIcon,
} from "./icons";

export type Ad = AdOut;
export type Trend = TrendOut;
export type Overview = OverviewOut;

export type Platform = "meta" | "tiktok" | "google" | "pinterest";
export type MediaType = "video" | "image" | "carousel";
export type HookType =
  | "ugc"
  | "unboxing"
  | "before-after"
  | "testimonial"
  | "review"
  | "demo";
export type LandingPlatform =
  | "shopify"
  | "woocommerce"
  | "tiktok-shop"
  | "amazon"
  | "etsy";

export interface AdFilters {
  query: string;
  platforms: Platform[];
  status: "all" | "active" | "inactive";
  minDays: number;
  minDuplicates: number;
  mediaTypes: MediaType[];
  hooks: HookType[];
  landingPlatforms: LandingPlatform[];
  niches: string[];
  countries: string[];
  crossPlatformOnly: boolean;
  scalingOnly: boolean;
  maxPrice: number | null;
  sort: "score" | "longevity" | "duplicates" | "velocity" | "newest";
}

export const DEFAULT_FILTERS: AdFilters = {
  query: "",
  platforms: [],
  status: "active",
  minDays: 0,
  minDuplicates: 0,
  mediaTypes: [],
  hooks: [],
  landingPlatforms: [],
  niches: [],
  countries: [],
  crossPlatformOnly: false,
  scalingOnly: false,
  maxPrice: null,
  sort: "score",
};

export function scoreTone(score: number): string {
  if (score >= 75) return "var(--accent)";
  if (score >= 55) return "var(--gold)";
  return "var(--dim)";
}

export function PlatformDot({ platform }: { platform: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: PLATFORM_COLORS[platform] ?? "#888" }}
      aria-hidden="true"
    />
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
      <PlatformDot platform={platform} />
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-[var(--dim)]">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: scoreTone(value) }}
        />
      </span>
      <span className="w-7 shrink-0 text-right font-mono text-xs font-semibold">
        {value}
      </span>
    </div>
  );
}

export function SaveButton({
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
      aria-label={label}
      aria-pressed={saved}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
        saved
          ? "bg-[var(--accent)] text-white"
          : "bg-black/45 text-white hover:bg-black/65"
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

export function AdCard({
  ad,
  onOpen,
  onToggleSaved,
}: {
  ad: Ad;
  onOpen: (id: string) => void;
  onToggleSaved: (id: string) => void;
}) {
  const img = CREATIVES[ad.creative];
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative aspect-[4/3] bg-[var(--surface-2)]">
        {img ? (
          <img
            src={img}
            alt={`Creative của ${ad.pageName} trên ${PLATFORM_LABELS[ad.platform]}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute left-2 top-2">
          <PlatformBadge platform={ad.platform} />
        </div>
        <div className="absolute right-2 top-2">
          <SaveButton
            saved={ad.saved}
            onToggle={() => onToggleSaved(ad.id)}
            label={ad.saved ? `Bỏ lưu quảng cáo của ${ad.pageName}` : `Lưu quảng cáo của ${ad.pageName}`}
          />
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {ad.mediaType === "video" ? (
              <PlayIcon className="h-3 w-3" />
            ) : null}
            {MEDIA_LABELS[ad.mediaType]}
            {ad.durationSec != null ? ` · ${formatDuration(ad.durationSec)}` : ""}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${
              ad.status === "active"
                ? "bg-emerald-600/85 text-white"
                : "bg-zinc-600/85 text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {ad.status === "active" ? "Đang chạy" : "Đã dừng"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{ad.pageName}</p>
            <p className="flex items-center gap-1 text-xs text-[var(--dim)]">
              <GlobeIcon className="h-3 w-3" />
              {ad.country} · {ad.niche}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className="font-mono text-2xl font-bold leading-none"
              style={{ color: scoreTone(ad.trendScore) }}
            >
              {ad.trendScore}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--dim)]">
              Trend Score
            </p>
          </div>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm leading-snug">
          {ad.headline}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
          <span className="inline-flex items-center gap-1" title="Số ngày đã chạy">
            <CalendarIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            <strong>{ad.daysRunning}</strong> ngày
          </span>
          <span className="inline-flex items-center gap-1" title="Số bản duplicate của cùng creative">
            <CopyIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            <strong>{ad.duplicates}</strong> dup
          </span>
          <span className="inline-flex items-center gap-1" title="Ads mới của page trong 7 ngày">
            <FlameIcon className="h-3.5 w-3.5 text-[var(--dim)]" />
            <strong>+{ad.newAds7d}</strong>/7d
          </span>
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium">
            Hook: {HOOK_LABELS[ad.hook]}
          </span>
          <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium">
            {LANDING_LABELS[ad.landingPlatform]}
            {ad.priceUsd != null ? ` · $${ad.priceUsd}` : ""}
          </span>
          {ad.crossPlatform ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#0e7c6b]/12 px-2 py-1 text-xs font-semibold text-[var(--teal)]">
              <TrendingUpIcon className="h-3 w-3" />
              {ad.brandPlatforms.length} nền tảng
            </span>
          ) : null}
          {ad.scaling ? (
            <span className="rounded-md bg-[#ff4d2e]/10 px-2 py-1 text-xs font-semibold text-[var(--accent-ink)]">
              Đang scale
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpen(ad.id)}
          className="mt-1 inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-semibold hover:bg-[var(--surface-2)]"
        >
          Phân tích chi tiết
        </button>
      </div>
    </article>
  );
}

export function TrendCard({
  trend,
  rank,
  onJumpToAds,
}: {
  trend: Trend;
  rank: number;
  onJumpToAds: (niche: string) => void;
}) {
  const kindStyle =
    trend.kind === "seasonal"
      ? "bg-sky-600/12 text-sky-700 dark:text-sky-300"
      : trend.kind === "new"
        ? "bg-emerald-600/12 text-emerald-700 dark:text-emerald-300"
        : "bg-amber-600/15 text-amber-700 dark:text-amber-300";
  const tiles = trend.platforms.slice(0, 3);
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-snug">
          <span className="mr-1.5 font-mono font-bold text-[var(--accent)]">
            #{rank}
          </span>
          {trend.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${kindStyle}`}
        >
          {TREND_KIND_LABELS[trend.kind]}
        </span>
      </div>

      <p className="flex gap-1.5 text-sm leading-relaxed text-[var(--dim)]">
        <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
        <span>
          <strong className="text-[var(--text)]">AI Insight:</strong>{" "}
          {trend.insight}
        </span>
      </p>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map((p) => {
          const key = trend.creativeKeys[0] ?? "";
          const img = CREATIVES[key];
          return (
            <div
              key={p}
              className="relative aspect-square overflow-hidden rounded-lg bg-[var(--surface-2)]"
            >
              {img ? (
                <img
                  src={img}
                  alt={`Creative mẫu của xu hướng ${trend.title} trên ${PLATFORM_LABELS[p]}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <span className="absolute bottom-1 left-1">
                <PlatformBadge platform={p} />
              </span>
            </div>
          );
        })}
        <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-[var(--ink)] font-mono text-white">
          <span className="text-lg font-bold">+{trend.extraCount}</span>
          <span className="text-[11px] opacity-75">ads khác</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-2.5 font-mono text-[13px]">
        <span>
          <strong>{trend.adsCount}</strong> ads{" "}
          <span className="font-semibold text-[var(--teal)]">
            (+{trend.newAds} mới)
          </span>
        </span>
        <span>
          Velocity <strong>{trend.velocity.toFixed(1)}×</strong>
        </span>
        <span>
          Score{" "}
          <strong style={{ color: scoreTone(trend.score) }}>{trend.score}</strong>
        </span>
        <span>
          AI <strong className="text-sky-600 dark:text-sky-300">{trend.aiScore.toFixed(1)}</strong>
        </span>
      </div>

      <button
        type="button"
        onClick={() => onJumpToAds(trend.niche)}
        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white hover:bg-[var(--ink-2)]"
      >
        Xem ads trong ngách {trend.niche}
      </button>
    </article>
  );
}

function ChipToggle({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors ${
        active
          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {active ? <CheckIcon className="h-3 w-3" /> : null}
      {label}
      {count != null ? (
        <span className={active ? "opacity-70" : "text-[var(--dim)]"}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-[var(--border)] py-3.5 last:border-b-0">
      <legend className="float-left mb-2 w-full text-[13px] font-bold uppercase tracking-wide text-[var(--dim)]">
        {title}
      </legend>
      <div className="flex flex-wrap gap-1.5 clear-both">{children}</div>
    </fieldset>
  );
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function FilterPanel({
  filters,
  overview,
  onChange,
  onReset,
}: {
  filters: AdFilters;
  overview: Overview | undefined;
  onChange: (patch: Partial<AdFilters>) => void;
  onReset: () => void;
}) {
  const platformCounts = new Map(
    (overview?.platformCounts ?? []).map((p) => [p.platform, p.count]),
  );
  return (
    <div>
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-bold">Bộ lọc sâu</h2>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--surface-2)]"
        >
          <ResetIcon className="h-3.5 w-3.5" /> Đặt lại
        </button>
      </div>

      <FilterSection title="Nền tảng">
        {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
          <ChipToggle
            key={p}
            label={PLATFORM_LABELS[p]}
            count={platformCounts.get(p)}
            active={filters.platforms.includes(p)}
            onClick={() =>
              onChange({ platforms: toggleIn(filters.platforms, p) })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Trạng thái ads">
        {(
          [
            ["active", "Đang chạy"],
            ["all", "Tất cả"],
            ["inactive", "Đã dừng"],
          ] as const
        ).map(([v, label]) => (
          <ChipToggle
            key={v}
            label={label}
            active={filters.status === v}
            onClick={() => onChange({ status: v })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Số ngày đã chạy (tối thiểu)">
        {[0, 7, 14, 30, 60].map((d) => (
          <ChipToggle
            key={d}
            label={d === 0 ? "Mọi" : `≥ ${d} ngày`}
            active={filters.minDays === d}
            onClick={() => onChange({ minDays: d })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Bản duplicate (tối thiểu)">
        {[0, 3, 5, 10, 15].map((d) => (
          <ChipToggle
            key={d}
            label={d === 0 ? "Mọi" : `≥ ${d} bản`}
            active={filters.minDuplicates === d}
            onClick={() => onChange({ minDuplicates: d })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Loại creative">
        {(Object.keys(MEDIA_LABELS) as MediaType[]).map((m) => (
          <ChipToggle
            key={m}
            label={MEDIA_LABELS[m]}
            active={filters.mediaTypes.includes(m)}
            onClick={() =>
              onChange({ mediaTypes: toggleIn(filters.mediaTypes, m) })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Kiểu hook (AI gắn nhãn)">
        {(Object.keys(HOOK_LABELS) as HookType[]).map((h) => (
          <ChipToggle
            key={h}
            label={HOOK_LABELS[h]}
            active={filters.hooks.includes(h)}
            onClick={() => onChange({ hooks: toggleIn(filters.hooks, h) })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Landing page đích">
        {(Object.keys(LANDING_LABELS) as LandingPlatform[]).map((l) => (
          <ChipToggle
            key={l}
            label={LANDING_LABELS[l]}
            active={filters.landingPlatforms.includes(l)}
            onClick={() =>
              onChange({
                landingPlatforms: toggleIn(filters.landingPlatforms, l),
              })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Ngách">
        {(overview?.niches ?? []).map((n) => (
          <ChipToggle
            key={n}
            label={n}
            active={filters.niches.includes(n)}
            onClick={() => onChange({ niches: toggleIn(filters.niches, n) })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Quốc gia">
        {(overview?.countries ?? []).map((c) => (
          <ChipToggle
            key={c}
            label={c}
            active={filters.countries.includes(c)}
            onClick={() =>
              onChange({ countries: toggleIn(filters.countries, c) })
            }
          />
        ))}
      </FilterSection>

      <fieldset className="border-b border-[var(--border)] py-3.5">
        <legend className="float-left mb-2 w-full text-[13px] font-bold uppercase tracking-wide text-[var(--dim)]">
          Giá sản phẩm tối đa
        </legend>
        <div className="clear-both flex items-center gap-2">
          <input
            type="range"
            min={15}
            max={60}
            step={1}
            aria-label="Giá sản phẩm tối đa (USD)"
            value={filters.maxPrice ?? 60}
            onChange={(e) =>
              onChange({
                maxPrice:
                  Number(e.target.value) >= 60 ? null : Number(e.target.value),
              })
            }
            className="min-h-8 flex-1 accent-[#ff4d2e]"
          />
          <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold">
            {filters.maxPrice == null ? "Mọi giá" : `≤ $${filters.maxPrice}`}
          </span>
        </div>
      </fieldset>

      <fieldset className="py-3.5">
        <legend className="float-left mb-2 w-full text-[13px] font-bold uppercase tracking-wide text-[var(--dim)]">
          Tín hiệu thắng
        </legend>
        <div className="clear-both flex flex-col gap-2">
          <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
            Chỉ brand chạy đa nền tảng
            <input
              type="checkbox"
              checked={filters.crossPlatformOnly}
              onChange={(e) => onChange({ crossPlatformOnly: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-[#ff4d2e]"
            />
          </label>
          <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
            Chỉ page đang scale (≥5 ads mới/7 ngày)
            <input
              type="checkbox"
              checked={filters.scalingOnly}
              onChange={(e) => onChange({ scalingOnly: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-[#ff4d2e]"
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

export function AdDetailModal({
  adId,
  onClose,
  onSelectAd,
  onToggleSaved,
}: {
  adId: string;
  onClose: () => void;
  onSelectAd: (id: string) => void;
  onToggleSaved: (id: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["ad-detail", adId],
    queryFn: () => api.getAdDetail({ adId }),
  });
  const ad = detail.data?.ad;
  const brandAds = detail.data?.brandAds ?? [];
  const img = ad ? CREATIVES[ad.creative] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết quảng cáo"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[var(--surface)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {detail.isPending ? (
          <p className="p-8 text-center text-sm text-[var(--dim)]">
            Đang tải chi tiết…
          </p>
        ) : !ad ? (
          <p className="p-8 text-center text-sm text-[var(--dim)]">
            Không tìm thấy quảng cáo này.
          </p>
        ) : (
          <div>
            <div className="relative aspect-[16/9] bg-[var(--surface-2)]">
              {img ? (
                <img
                  src={img}
                  alt={`Creative của ${ad.pageName}`}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute left-3 top-3">
                <PlatformBadge platform={ad.platform} />
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết"
                onClick={onClose}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
              >
                <XIcon className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold leading-tight">{ad.pageName}</h3>
                  <p className="text-sm text-[var(--dim)]">
                    {ad.placements.join(" · ")} · {ad.country} · {ad.niche}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className="font-mono text-3xl font-bold leading-none"
                    style={{ color: scoreTone(ad.trendScore) }}
                  >
                    {ad.trendScore}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--dim)]">
                    Trend Score
                  </p>
                </div>
              </div>

              <p className="text-[15px] leading-relaxed">{ad.headline}</p>

              <div className="flex flex-col gap-1.5 rounded-xl bg-[var(--surface-2)]/60 p-3">
                <ScoreBar label="Độ bền (longevity)" value={ad.scoreLongevity} />
                <ScoreBar label="Duplicate" value={ad.scoreDuplication} />
                <ScoreBar label="Velocity của page" value={ad.scoreVelocity} />
                <ScoreBar label="Đa nền tảng" value={ad.scoreCrossPlatform} />
                <p className="pt-1 text-xs text-[var(--dim)]">
                  Trend Score = 35% độ bền + 30% duplicate + 20% velocity + 15%
                  hiện diện đa nền tảng của brand.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-[var(--dim)]">Bắt đầu chạy</dt>
                  <dd className="font-semibold">{formatDate(ad.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Đã chạy</dt>
                  <dd className="font-semibold">{ad.daysRunning} ngày</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Bản duplicate</dt>
                  <dd className="font-semibold">{ad.duplicates} bản</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Creative</dt>
                  <dd className="font-semibold">
                    {MEDIA_LABELS[ad.mediaType]}
                    {ad.durationSec != null
                      ? ` · ${formatDuration(ad.durationSec)}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Hook</dt>
                  <dd className="font-semibold">{HOOK_LABELS[ad.hook]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Text overlay / Voice</dt>
                  <dd className="font-semibold">
                    {ad.hasTextOverlay ? "Có text" : "Không text"} ·{" "}
                    {ad.hasVoice ? "Có voice" : "Không voice"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">CTA</dt>
                  <dd className="font-semibold">{ad.cta}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Landing page</dt>
                  <dd className="font-semibold">
                    {LANDING_LABELS[ad.landingPlatform]}
                    {ad.priceUsd != null ? ` · $${ad.priceUsd}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--dim)]">Domain đích</dt>
                  <dd className="flex items-center gap-1 font-semibold">
                    <span className="truncate">{ad.landingDomain}</span>
                    <ExternalIcon className="h-3.5 w-3.5 shrink-0 text-[var(--dim)]" />
                  </dd>
                </div>
              </dl>

              {brandAds.length > 1 ? (
                <div>
                  <h4 className="mb-2 text-sm font-bold">
                    Brand này trên các nền tảng khác ({brandAds.length} ads)
                  </h4>
                  <ul className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                    {brandAds.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => onSelectAd(b.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--surface-2)]"
                        >
                          <PlatformDot platform={b.platform} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {PLATFORM_LABELS[b.platform]} — {b.headline}
                            </span>
                            <span className="block text-xs text-[var(--dim)]">
                              {b.daysRunning} ngày · {b.duplicates} dup ·{" "}
                              {b.status === "active" ? "đang chạy" : "đã dừng"}
                            </span>
                          </span>
                          <span
                            className="shrink-0 font-mono text-base font-bold"
                            style={{ color: scoreTone(b.trendScore) }}
                          >
                            {b.trendScore}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => onToggleSaved(ad.id)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold ${
                  ad.saved
                    ? "bg-[var(--surface-2)] text-[var(--text)]"
                    : "bg-[var(--accent)] text-white"
                }`}
              >
                {ad.saved ? (
                  <>
                    <BookmarkFilledIcon className="h-4.5 w-4.5" /> Đã lưu — bấm để
                    bỏ lưu
                  </>
                ) : (
                  <>
                    <BookmarkIcon className="h-4.5 w-4.5" /> Lưu vào danh sách
                    theo dõi
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
