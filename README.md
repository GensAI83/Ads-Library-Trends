# Ads Library Trends — bản Vercel độc lập

Bản export standalone của artifact Muse "Ads Library Trends" (slug
`ads-library-trends`), đóng gói ngày 2026-11-12 để chạy trên Vercel cho
người không có Muse. Thư mục gốc của artifact Muse KHÔNG bị sửa.

## Khác gì so với bản Muse

- Không dùng Muse runtime / `@hatch/space-sdk`, không server actions,
  không app.db/Drizzle.
- Lọc ads, tính Trend Score, tab Xu hướng: chuyển hết sang client-side
  trong `src/api.ts`, chạy trên dữ liệu mẫu nhúng sẵn (`src/sampleData.ts`,
  28 ads Meta/TikTok/Google/Pinterest, 8 cụm xu hướng) — vẫn ghi nhãn rõ
  "Prototype · Dữ liệu mẫu" trong UI như bản gốc. Đây KHÔNG phải dữ liệu
  quảng cáo thật (chưa nối API/scraper).
- Watchlist "Đã lưu": lưu bằng localStorage trên trình duyệt của từng
  người dùng (`ads-library-trends:saved-v1`), đã ghi nhãn rõ trong
  UI tab Đã lưu. Không đồng bộ máy chủ, không đồng bộ giữa các máy —
  khác bản Muse (lưu DB theo tài khoản).

## V2 — Tab "POD Radar" (dữ liệu thật, bản chụp tĩnh 2026-11-12)

Tab mới "POD Radar" mang luồng V2 của bản Muse sang bản web tĩnh, cho
một ngách + một thị trường: **Amazon US — POD / thời trang in ấn** (áo
thun, từ khóa crawl: "funny cat t-shirt", "funny dog t-shirt",
"christmas cat t-shirt").

- Dữ liệu là **dữ liệu thật crawl bằng Apify ngày 12/11/2026** (actor
  Amazon + actor Facebook Ads Library), xuất tĩnh từ cơ sở dữ liệu của
  bản Muse vào `src/podData.ts`: **52 sản phẩm, 80 ads nguồn Meta,
  52 snapshot ngày đầu**. Ghi nhãn "Dữ liệu thật · Apify crawl ngày
  12/11/2026" trong UI. Đây là bản chụp tĩnh — bản web này KHÔNG tự
  crawl thêm; đường cong tăng trưởng đầy đủ lớn dần theo crawl hằng
  ngày chỉ có trong bản Muse.
- Ảnh sản phẩm/ads: toàn bộ 77 ảnh crawl được (52 sản phẩm + 25 ads)
  đã tải về, nén WebP và nhúng data URI base64 trong
  `src/podAssets1.ts` – `src/podAssets2.ts` — KHÔNG hotlink URL CDN
  Amazon/Meta (các URL đó hết hạn). Ads không có ảnh tĩnh hiển thị ô
  trống ghi rõ (video/format khác).
- Luồng đầy đủ như bản Muse: feed phát hiện (xếp theo lượng mua tháng
  qua giảm dần → BSR tăng dần) → hồ sơ sản phẩm 5 mục (tổng quan &
  tăng trưởng kèm biểu đồ snapshot, ads nguồn Meta khớp theo
  brand/từ khóa, bảng so sánh đối thủ cùng từ khóa, quyết định thử,
  danh sách quyết định đã lưu) → ghim so sánh tối đa 5 sản phẩm.
- Quyết định Test/Watch/Skip + ưu tiên + ngân sách + ghi chú: lưu
  localStorage trên trình duyệt của từng người dùng
  (`ads-library-trends:decisions-v1`), ghi nhãn rõ trong UI là chỉ lưu
  trên trình duyệt này — không đồng bộ như DB của bản Muse.
- 3 tab V1 (Quảng cáo / Xu hướng / Đã lưu) giữ nguyên dữ liệu mẫu và
  cách hoạt động; header chỉ đổi nhãn "Dữ liệu thật" khi đang ở tab
  POD Radar.

## Build

```bash
bun install
bun run build   # ra dist/: index.html + main.js + main.css
```

Ảnh creative: 8 ảnh gốc `src/assets/*.webp` đã được chuyển thành data
URI base64 nhúng trong `src/assetsInline1.ts` – `src/assetsInline4.ts`
(và `src/labels.ts` import từ đó) để bản trên GitHub chỉ gồm file text.
Khi build, các data URI nằm thẳng trong `main.js`, `dist/` không còn
file .webp rời. Các file `src/assets/*.webp` chỉ còn là nguồn gốc local,
không cần cho build và không nằm trên GitHub.

Đã kiểm chứng local 2026-11-12 sau khi inline ảnh: build thành công,
server tĩnh phục vụ dist/ trả 200 cho `/`, bundle chứa
`data:image/webp` + dữ liệu mẫu + key localStorage, 0 tham chiếu tới
space-sdk/app.db.

## Trạng thái deploy Vercel (cập nhật 2026-11-12): đi đường GitHub Import

Deploy thẳng qua connector Vercel của Muse vẫn BỊ CHẶN ở ủy quyền
team: connector đã kết nối (user `gensai83`, team mặc định
`team_6wbpfi70l5kXjtZuVFoflbXb`, scope `gensai83s-projects`), nhưng MỌI
thao tác theo team đều bị Vercel trả:

```
403 forbidden — Not authorized: Trying to access resource under scope
"gensai83s-projects". You must re-authenticate to this scope or use a
token with access to this scope.
```

Đã thử và cùng lỗi 403: `list_projects`, `get_team`, `list_deployments`,
`create_project` (POST /v11/projects), `upload_file` (POST /v2/files).
`refresh` token không giải quyết được. Tool `authorize_team_access`
mà Vercel chỉ định KHÔNG nằm trong danh sách tool đã duyệt của
connector Hatch, nên không tạo được link cấp quyền team từ phía Muse.

### Đường đi hiện tại: Import từ GitHub

Toàn bộ bản export này đã được đẩy lên repo GitHub
`GensAI83/Ads-Library-Trends` (branch `main`) để Import vào Vercel từ
trang web Vercel (nơi tài khoản của chủ repo có quyền team bình
thường). Repo đi kèm sẵn `vercel.json`:

- Install Command: `bun install`
- Build Command: `bun run build`
- Output Directory: `dist`
- Framework Preset: Other (không chọn framework nào)

Nếu Import mà Vercel không tự đọc `vercel.json`, chọn tay đúng các
giá trị trên, Root Directory để `./` (gốc repo). Sau khi deploy, mở
URL Vercel được cấp để kiểm tra trang tải đúng tiêu đề
"Ads Library Trends".

Đã deploy thành công qua đường Import này: https://ads-library-trends.vercel.app/
(production READY, kiểm chứng render + lọc TikTok ngày 2026-11-12).

### Web Analytics

Web Analytics đã được bật trong Vercel dashboard (gói Hobby, miễn
phí). Phía code, `src/main.tsx` gọi `inject()` từ `@vercel/analytics`
để tải `/_vercel/insights/script.js` và ghi nhận page view — thiếu
bước code này thì dashboard bật cũng không có dữ liệu.
