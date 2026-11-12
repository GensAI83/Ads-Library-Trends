// Display labels (Vietnamese UI) and the creative-image map.
// Creative keys match `creative` values in server/src/sampleData.ts;
// duplicate ads of one creative intentionally share its image.

// Creative images are inlined as base64 data URIs (src/assetsInline*.ts),
// converted from the original .webp binaries so the GitHub copy of this
// export stays text-only; they render identically to the .webp files.
import { serum, projector } from "./assetsInline1";
import { posture, petroller } from "./assetsInline2";
import { podtee, blender } from "./assetsInline3";
import { chopper, neckpillow } from "./assetsInline4";

export const CREATIVES: Record<string, string> = {
  serum,
  projector,
  posture,
  petroller,
  podtee,
  blender,
  chopper,
  neckpillow,
};

export const PLATFORM_LABELS: Record<
  "meta" | "tiktok" | "google" | "pinterest",
  string
> = {
  meta: "Meta",
  tiktok: "TikTok",
  google: "Google",
  pinterest: "Pinterest",
};

// Solid brand-ish colors used for platform dots/badges.
export const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877f2",
  tiktok: "#fe2c55",
  google: "#f9ab00",
  pinterest: "#e60023",
};

export const HOOK_LABELS: Record<
  "ugc" | "unboxing" | "before-after" | "testimonial" | "review" | "demo",
  string
> = {
  ugc: "UGC",
  unboxing: "Unboxing",
  "before-after": "Before / After",
  testimonial: "Testimonial",
  review: "Review",
  demo: "Demo",
};

export const MEDIA_LABELS: Record<"video" | "image" | "carousel", string> = {
  video: "Video",
  image: "Ảnh",
  carousel: "Carousel",
};

export const LANDING_LABELS: Record<
  "shopify" | "woocommerce" | "tiktok-shop" | "amazon" | "etsy",
  string
> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  "tiktok-shop": "TikTok Shop",
  amazon: "Amazon",
  etsy: "Etsy",
};

export const TREND_KIND_LABELS: Record<string, string> = {
  seasonal: "Seasonal",
  new: "New Trend",
  evergreen: "Evergreen",
};

export function formatDate(iso: string): string {
  const [y = "", m = "", d = ""] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
