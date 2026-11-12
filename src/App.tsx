import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
AdCard,
AdDetailModal,
DEFAULT_FILTERS,
FilterPanel,
TrendCard,
type AdFilters,
type Platform,
} from "./components";
import { PLATFORM_LABELS, TREND_KIND_LABELS } from "./labels";
import { SearchIcon, SlidersIcon, XIcon } from "./icons";

type Tab = "trends" | "ads" | "saved";
type TrendKindFilter = "all" | "seasonal" | "new" | "evergreen";
type TrendSort = "score" | "velocity" | "ai" | "ads";

function countActiveFilters(f: AdFilters): number {
  let n = 0;
  n += f.platforms.length;
  if (f.status !== "active") n += 1;
  if (f.minDays > 0) n += 1;
  if (f.minDuplicates > 0) n += 1;
  n += f.mediaTypes.length;
  n += f.hooks.length;
  n += f.landingPlatforms.length;
  n += f.niches.length;
  n += f.countries.length;
  if (f.crossPlatformOnly) n += 1;
  if (f.scalingOnly) n += 1;
  if (f.maxPrice != null) n += 1;
  return n;
}

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("ads");
  const [filters, setFilters] = useState<AdFilters>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [detailAdId, setDetailAdId] = useState<string | null>(null);

  const [trendQuery, setTrendQuery] = useState("");
  const [trendKind, setTrendKind] = useState<TrendKindFilter>("all");
  const [trendPlatform, setTrendPlatform] = useState<Platform | null>(null);
  const [trendSort, setTrendSort] = useState<TrendSort>("score");

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.getOverview({}),
  });

  const ads = useQuery({
    queryKey: ["ads", filters],
    queryFn: () => api.searchAds(filters),
  });

  const trendsAll = useQuery({
    queryKey: ["trends", "all"],
    queryFn: () =>
      api.getTrends({ query: "", kind: "all", platform: null, sort: "score" }),
  });

  const trends = useQuery({
    queryKey: ["trends", trendQuery, trendKind, trendPlatform, trendSort],
    queryFn: () =>
      api.getTrends({
        query: trendQuery,
        kind: trendKind,
        platform: trendPlatform,
        sort: trendSort,
      }),
  });

  const saved = useQuery({
    queryKey: ["saved"],
    queryFn: () => api.listSaved({}),
  });

  const toggleSaved = useMutation({
    mutationFn: async (adId: string) => await api.toggleSaved({ adId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
      void queryClient.invalidateQueries({ queryKey: ["ad-detail"] });
    },
  });

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters],
  );

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, seasonal: 0, new: 0, evergreen: 0 };
    for (const t of trendsAll.data?.trends ?? []) {
      counts.all = (counts.all ?? 0) + 1;
      counts[t.kind] = (counts[t.kind] ?? 0) + 1;
    }
    return counts;
  }, [trendsAll.data]);

  const patchFilters = (patch: Partial<AdFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const jumpToNiche = (niche: string) => {
    setFilters({ ...DEFAULT_FILTERS, niches: [niche], status: "all" });
    setTab("ads");
  };

  const tabButton = (value: Tab, label: string, badge?: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={tab === value}
      onClick={() => setTab(value)}
      className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors sm:flex-none sm:px-4 ${
        tab === value
          ? "bg-white text-[var(--ink)]"
          : "text-white/75 hover:text-white"
      }`}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold ${
            tab === value
              ? "bg-[var(--accent)] text-white"
              : "bg-white/20 text-white"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Ink-navy chrome: view tabs + prototype data badge */}
      <header className="sticky top-0 z-40 bg-[var(--ink)] pt-safe">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-5">
          <nav
            className="flex flex-1 gap-1 sm:flex-none"
            aria-label="Chế độ xem"
          >
            {tabButton("ads", "Quảng cáo")}
            {tabButton("trends", "Xu hướng")}
            {tabButton("saved", "Đã lưu", saved.data?.ads.length ?? 0)}
          </nav>
          <span className="hidden shrink-0 rounded-full border border-white/30 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-white/85 md:inline-block">
            Prototype · Dữ liệu mẫu
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-10 sm:px-5">
        {tab === "ads" ? (
          <>
            {/* Stats strip */}
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-4 font-mono text-[13px] text-[var(--dim)]">
              <span>
                <strong className="text-base text-[var(--text)]">
                  {overview.data?.totalAds ?? "—"}
                </strong>{" "}
                ads trong kho mẫu
              </span>
              <span>
                <strong className="text-base text-[var(--teal)]">
                  {overview.data?.activeAds ?? "—"}
                </strong>{" "}
                đang chạy
              </span>
              <span>
                <strong className="text-base text-[var(--accent)]">
                  {overview.data?.crossPlatformBrands ?? "—"}
                </strong>{" "}
                brand chạy đa nền tảng
              </span>
              <span className="basis-full text-xs sm:basis-auto">
                Nguồn mẫu mô phỏng Meta Ads Library · TikTok Creative Center ·
                Google Transparency · Pinterest
              </span>
            </div>

            {/* Search + sort + mobile filter toggle */}
            <div className="flex items-stretch gap-2">
              <label className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--dim)]" />
                <span className="sr-only">Tìm quảng cáo</span>
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => patchFilters({ query: e.target.value })}
                  placeholder="Tìm theo brand, nội dung ads, ngách…"
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
                />
              </label>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3.5 text-sm font-bold text-white lg:hidden"
                aria-haspopup="dialog"
              >
                <SlidersIcon className="h-4.5 w-4.5" />
                Lọc
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <label className="hidden items-center gap-2 sm:flex">
                <span className="text-sm text-[var(--dim)]">Sắp xếp</span>
                <select
                  aria-label="Sắp xếp kết quả quảng cáo"
                  value={filters.sort}
                  onChange={(e) =>
                    patchFilters({ sort: e.target.value as AdFilters["sort"] })
                  }
                  className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
                >
                  <option value="score">Trend Score</option>
                  <option value="longevity">Chạy lâu nhất</option>
                  <option value="duplicates">Nhiều duplicate nhất</option>
                  <option value="velocity">Velocity cao nhất</option>
                  <option value="newest">Mới nhất</option>
                </select>
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 sm:hidden">
              <span className="text-sm text-[var(--dim)]">Sắp xếp</span>
              <select
                aria-label="Sắp xếp kết quả quảng cáo"
                value={filters.sort}
                onChange={(e) =>
                  patchFilters({ sort: e.target.value as AdFilters["sort"] })
                }
                className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
              >
                <option value="score">Trend Score</option>
                <option value="longevity">Chạy lâu nhất</option>
                <option value="duplicates">Nhiều duplicate nhất</option>
                <option value="velocity">Velocity cao nhất</option>
                <option value="newest">Mới nhất</option>
              </select>
            </label>

            <div className="mt-4 flex gap-6">
              {/* Desktop filter rail */}
              <aside className="sticky top-16 hidden h-fit w-72 shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:block">
                <FilterPanel
                  filters={filters}
                  overview={overview.data}
                  onChange={patchFilters}
                  onReset={() => setFilters(DEFAULT_FILTERS)}
                />
              </aside>

              {/* Results */}
              <section className="min-w-0 flex-1" aria-label="Kết quả quảng cáo">
                <p className="pb-3 text-sm text-[var(--dim)]" role="status">
                  {ads.isPending
                    ? "Đang lọc…"
                    : `${ads.data?.total ?? 0} quảng cáo khớp bộ lọc`}
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="ml-2 font-semibold text-[var(--accent-ink)] underline underline-offset-2"
                    >
                      Xóa {activeFilterCount} điều kiện lọc
                    </button>
                  ) : null}
                </p>
                {ads.isError ? (
                  <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm">
                    Không tải được dữ liệu.{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--accent-ink)] underline"
                      onClick={() => void ads.refetch()}
                    >
                      Thử lại
                    </button>
                  </p>
                ) : ads.data && ads.data.ads.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                    <p className="font-semibold">Không có ads nào khớp</p>
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      Thử nới lỏng điều kiện: giảm số ngày chạy hoặc bỏ bớt
                      nền tảng/hook đang chọn.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(ads.data?.ads ?? []).map((ad) => (
                      <AdCard
                        key={ad.id}
                        ad={ad}
                        onOpen={setDetailAdId}
                        onToggleSaved={(id) => toggleSaved.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Mobile filter drawer */}
            {mobileFiltersOpen ? (
              <div
                className="fixed inset-0 z-50 bg-black/55 lg:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Bộ lọc sâu"
                onClick={() => setMobileFiltersOpen(false)}
              >
                <div
                  className="absolute inset-y-0 right-0 flex w-[86vw] max-w-sm flex-col bg-[var(--surface)] pt-safe"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <span className="text-sm font-bold">
                      Bộ lọc sâu
                      {activeFilterCount > 0
                        ? ` · ${activeFilterCount} đang bật`
                        : ""}
                    </span>
                    <button
                      type="button"
                      aria-label="Đóng bộ lọc"
                      onClick={() => setMobileFiltersOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-2">
                    <FilterPanel
                      filters={filters}
                      overview={overview.data}
                      onChange={patchFilters}
                      onReset={() => setFilters(DEFAULT_FILTERS)}
                    />
                  </div>
                  <div className="border-t border-[var(--border)] p-3 pb-safe">
                    <button
                      type="button"
                      onClick={() => setMobileFiltersOpen(false)}
                      className="min-h-11 w-full rounded-lg bg-[var(--accent)] text-sm font-bold text-white"
                    >
                      Xem {ads.data?.total ?? 0} quảng cáo
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "trends" ? (
          <>
            <div className="py-4">
              <h2 className="text-xl font-extrabold tracking-tight">
                Xu hướng quảng cáo đa nền tảng
              </h2>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--dim)]">
                {trendsAll.data?.trends.length ?? 0} cụm xu hướng · gom từ ads
                Meta, TikTok, Google, Pinterest
              </p>
            </div>

            <label className="relative block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--dim)]" />
              <span className="sr-only">Tìm xu hướng</span>
              <input
                type="search"
                value={trendQuery}
                onChange={(e) => setTrendQuery(e.target.value)}
                placeholder="Tìm xu hướng, ngách…"
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["all", "Tất cả"],
                  ["new", TREND_KIND_LABELS.new],
                  ["seasonal", TREND_KIND_LABELS.seasonal],
                  ["evergreen", TREND_KIND_LABELS.evergreen],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={trendKind === v}
                  onClick={() => setTrendKind(v)}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold ${
                    trendKind === v
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {label}
                  <span className="font-mono text-xs opacity-70">
                    {kindCounts[v] ?? 0}
                  </span>
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />
              <button
                type="button"
                aria-pressed={trendPlatform === null}
                onClick={() => setTrendPlatform(null)}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
                  trendPlatform === null
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                Mọi nền tảng
              </button>
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={trendPlatform === p}
                  onClick={() =>
                    setTrendPlatform(trendPlatform === p ? null : p)
                  }
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
                    trendPlatform === p
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2">
                <span className="text-sm text-[var(--dim)]">Sắp xếp</span>
                <select
                  aria-label="Sắp xếp xu hướng"
                  value={trendSort}
                  onChange={(e) => setTrendSort(e.target.value as TrendSort)}
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-medium"
                >
                  <option value="score">Trend Score</option>
                  <option value="velocity">Velocity</option>
                  <option value="ai">AI Score</option>
                  <option value="ads">Số ads</option>
                </select>
              </label>
            </div>

            <p className="py-3 text-sm text-[var(--dim)]" role="status">
              {trends.isPending
                ? "Đang tải…"
                : `${trends.data?.trends.length ?? 0} xu hướng`}
            </p>

            {trends.data && trends.data.trends.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <p className="font-semibold">Không có xu hướng nào khớp</p>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Thử đổi từ khóa hoặc chọn lại loại xu hướng / nền tảng.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {(trends.data?.trends ?? []).map((t, i) => (
                  <TrendCard
                    key={t.id}
                    trend={t}
                    rank={i + 1}
                    onJumpToAds={jumpToNiche}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}

        {tab === "saved" ? (
          <>
            <div className="py-4">
              <h2 className="text-xl font-extrabold tracking-tight">
                Danh sách theo dõi
              </h2>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--dim)]">
                {saved.data?.ads.length ?? 0} ads đã lưu để soi lại sau
              </p>
              <p className="mt-1 max-w-xl text-[13px] text-[var(--dim)]">
                Bản web công khai này không có tài khoản/máy chủ: danh sách
                theo dõi được lưu ngay trên trình duyệt của máy này
                (localStorage), nên không đồng bộ sang máy hay trình duyệt
                khác.
              </p>
            </div>
            {saved.data && saved.data.ads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <p className="font-semibold">Chưa lưu ads nào</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
                  Bấm biểu tượng bookmark trên bất kỳ ads nào ở tab Quảng cáo
                  để ghim vào đây — tiện mở lại khi cần phân tích đối thủ.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("ads")}
                  className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-white"
                >
                  Đi tới tab Quảng cáo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(saved.data?.ads ?? []).map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    onOpen={setDetailAdId}
                    onToggleSaved={(id) => toggleSaved.mutate(id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>

      {detailAdId ? (
        <AdDetailModal
          adId={detailAdId}
          onClose={() => setDetailAdId(null)}
          onSelectAd={setDetailAdId}
          onToggleSaved={(id) => toggleSaved.mutate(id)}
        />
      ) : null}
    </div>
  );
}
