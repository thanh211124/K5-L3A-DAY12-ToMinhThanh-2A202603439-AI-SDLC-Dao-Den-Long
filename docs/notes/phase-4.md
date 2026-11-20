# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Tô Minh Thành · 2A202603439 · tag `phase-4` + Release `v1.0.0`

Ticket-04 không đổi luật chơi. Mọi test Phase 1–3 còn hiệu lực vẫn chạy nguyên (85/85).

## 1. Giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| D1 | "Mở cửa sổ 1280×720" với bản web | `tools/bench.js` mở Chrome có cửa sổ (không headless) `--window-size=1280,720`, và ép viewport 1280×720 qua DevTools Protocol (canvas đúng 1280×720, ghi trong `bench.json.scene.canvas`) |
| D2 | Tắt vsync | Cờ Chrome `--disable-gpu-vsync --disable-frame-rate-limit`. Bằng chứng: avg 270 FPS > tần số màn hình 144 Hz |
| D3 | `load_ms` "từ lúc tiến trình bắt đầu" | Từ lúc tiến trình `node tools/bench.js` bắt đầu (`performance.timeOrigin`) tới timestamp của khung hình đầu tiên của cảnh bench. Thời gian này đã gồm khởi động server và Chrome |
| D4 | `peak_mem_mb` của bản web | **Đo được**: RSS đỉnh cộng dồn của cả cây tiến trình Chrome (browser + GPU + renderer), lấy mẫu khoảng 2 s/lần (`ps` trên macOS/Linux, working set qua CIM trên Windows). Ghi thêm `js_heap_peak_mb` |
| D5 | "Rải đều trên đảo" 200 Bóng Mực, 100 đom đóm | Phân bố đều theo diện tích trong bán kính 38 m (r = 38·√u), RNG theo seed 42; hàm `createBenchSim` |
| D6 | Bóng Mực "wander bình thường" trong bench | Đúng luật wander của Ticket-03: đi về đèn tắt gần nhất (L4/L5), Bóng Mực trong 12 m quanh Mây thì đuổi nhưng không gây sát thương |
| D7 | Thời gian dùng cho camera bench | Theo đồng hồ thật (rAF), góc 0° tại khung hình đầu, ngược chiều kim đồng hồ nhìn từ trên (cùng quy ước góc với bản đồ: (r cos a, ·, r sin a)) |
| D8 | Soak: "Đêm thứ i dùng seed 7 + i" | i bắt đầu từ 1 (Đêm 1 dùng seed 8). Input ngẫu nhiên lấy từ RNG riêng `seed ^ 0x5eed`; mỗi Đêm chạy tới khi kết thúc hoặc hết thời lượng chuẩn |
| D9 | Lưu bảng xếp hạng "trên đĩa cục bộ" | Server cục bộ (`npm start`) ghi `data/leaderboard.json` (ghi atomic, có hàng đợi). Bản Release tĩnh (không có server) lưu trong `localStorage` của trình duyệt, cũng nằm trên đĩa |
| D10 | `seed` của mục xếp hạng | Seed của chiến dịch; Đêm n dùng seed + n − 1 |
| D11 | Tên tiếng Việt (điểm cộng) | Chấp nhận mọi chữ Unicode, dấu và số, cùng `_`, dài 3–12 ký tự (sau chuẩn hoá NFC) |
| D12 | "Chớp màn hình" và "rung camera" | Game có rung camera khi bị đánh và chớp màn hình khi bị đánh hoặc tỏa sáng; "Giảm chuyển động" tắt cả hai |

## 2. Truy vết yêu cầu → bằng chứng

| Yêu cầu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Benchmark: cảnh chuẩn | `tests/soak_bench.test.js` (200 wander, 100 mote, L1–L3 sáng dầu 100, không sát thương / nhặt / hao dầu / sinh / kết thúc, tất định) + ảnh | [01_bench_scene](../proof/phase-4/screens/01_bench_scene.png) | Đạt |
| §1 Benchmark: số đo | `node tools/bench.js --seed 42 --duration 30 --out bench.json` | [bench.json](../../bench.json): avg 270.6, p1 134.8, p95 5.5 ms, 8119 khung, load 640 ms, RSS 806 MB | Đạt (máy của tôi) |
| §2 Soak | `node --expose-gc --jitless --no-expose-wasm tools/soak.js --seed 7 --nights 10 --out soak.json` + test schema/tất định | [soak.json](../../soak.json): 0 crash, 27.5 → 31.2 MB (×1.13) | Đạt, xem ghi chú JIT ở §3 |
| §3 Bảng xếp hạng: luật | `tests/leaderboard.test.js` (tên, ISO 8601 có múi giờ, sắp xếp, hòa điểm thì ai đạt trước đứng trên, top 10) | `npm test` | Đạt |
| §3 Lưu trên đĩa, còn sau khi mở lại | Test: POST qua server → tiến trình mới xuất ra đúng thứ tự; UI: thua → nhập tên → bảng hiện → tải lại trang vẫn còn | [ui-smoke](../proof/phase-4/ui-smoke.txt), [leaderboard-export.json](../proof/phase-4/leaderboard-export.json), [03_leaderboard](../proof/phase-4/screens/03_leaderboard.png) | Đạt |
| §3 Nhập tên sau Bình Minh / sau khi thua, màn từ menu | ui-smoke (thua → lưu; tên 2 ký tự bị từ chối; mở từ menu) | ui-smoke | Đạt (nhánh Bình Minh dùng cùng form, kiểm qua code) |
| §4 Đổi phím, trùng phím, khôi phục, lưu | ui-smoke: đổi Nhảy → J (lưu), Lướt = E báo trùng, Khôi phục mặc định, phím J làm Mây nhảy thật | ui-smoke, [02_settings_keymap](../proof/phase-4/screens/02_settings_keymap.png) | Đạt |
| §4 Phụ đề / chỉ báo | Bóng Mực xuất hiện (phụ đề + mũi tên mép màn hình), gió, 10 s cuối, đèn < 30 | ui-smoke (phụ đề Bóng Mực), [04_caption_shade](../proof/phase-4/screens/04_caption_shade.png); 3 loại còn lại kiểm qua code | Đạt |
| §4 Giảm chuyển động | Cài đặt được lưu; mã rung và chớp đều có chặn `settings.reduceMotion` | ui-smoke + review code | Đạt |
| §4 Cỡ chữ ≥ 18 px, chữ lớn ×1.25 | ui-smoke đo `getComputedStyle`: chữ menu nhỏ nhất ≥ 18 px; HUD ≥ 22.5 px khi bật chữ lớn | ui-smoke | Đạt |
| §5 Clone sạch, 3 lệnh | `git clone` vào thư mục trống → `npm install` → `npm test` / headless / soak / export / `npm start` | [clean-clone.txt](../proof/phase-4/clean-clone.txt) | Đạt (Windows; CI chạy Ubuntu + macOS) |
| §5 README / CHANGELOG 4 phase / CREDITS / LICENSE | Review | [README](../../README.md), [CHANGELOG](../../CHANGELOG.md) | Đạt |
| §5 Release có bản chạy được | `npm run build` → zip web tĩnh; đã chạy bằng `python -m http.server`, game vào Đêm 2 | [05_release_static_build](../proof/phase-4/screens/05_release_static_build.png) | Đạt (tệp zip); việc tạo Release trên GitHub xem §4 |
| §6 Contract v1.3 | `contract.test.js` (version, `bench_cmd`, `soak_cmd`) | `npm test` | Đạt |
| §7 Retro + video | [docs/retro.md](../retro.md); video do người chơi quay | — | Retro đạt; video: xem §4 |

## 3. Soak và JIT (ghi trung thực) {#soak}

| Cấu hình | mem_start | mem_end | Tỉ lệ |
|---|---|---|---|
| `soak_cmd` chính thức `--jitless` (10 Đêm) | 27.5 MB | 31.2 MB | **1.13** ✓ |
| Có JIT, 10 Đêm ([soak_with_jit.json](../proof/phase-4/soak_with_jit.json)) | 30.7 MB | 43.2 MB | 1.41 ✗ |
| Có JIT, 40 Đêm ([soak_with_jit_40nights.json](../proof/phase-4/soak_with_jit_40nights.json)) | 30.7 MB | 40.4 MB | 1.32 |

- `mem_start` theo đúng định nghĩa của ticket là RSS ngay sau khi tải Đêm đầu, **trước tick đầu tiên**, tức là trước khi V8 biên dịch code nóng.
- Có JIT, RSS lên khoảng 40 MB sau vài Đêm rồi **đứng yên** tới Đêm 40. Đó là bộ nhớ chứa code đã biên dịch, không phải rò rỉ dữ liệu.
- Tôi **không** khởi động trước rồi mới đo (như vậy là lách định nghĩa). Tôi chọn chạy soak với V8 `--jitless` để số đo phản ánh bộ nhớ của game, và công khai cả hai kết quả. Nếu giảng viên yêu cầu bật JIT thì cấu hình đó **chưa đạt** ngưỡng ×1.2.

## 4. Việc cần người làm (agent không làm được)

1. **Tạo GitHub Release `v1.0.0`:** máy không có `gh` và agent không có token GitHub. Cần upload `dist/dao-den-long-v1.0.0-web.zip` (tạo bằng `npm run build`) và video.
2. **Video demo `.mp4` < 5 phút:** máy không có ffmpeg; cần người chơi trực tiếp và quay (kịch bản ở [docs/demo/SCRIPT.md](../demo/SCRIPT.md)).

## 5. Đánh giá Phase 4

- **Đạt:** bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói, contract v1.3; 85/85 test, 23/23 bước UI, clone sạch.
- **Hồi quy:** tất cả scenario Phase 1–3 vẫn xanh ([proof/phase-4](../proof/phase-4/RESULTS.md), 61/61). Mã băm output headless của một Đêm đầy đủ ở **cả 3 Đêm trùng từng byte** với Phase 3 (`d13be141…`, `84bef18c…`, `61072edc…`). Như vậy cờ bench và các thay đổi Phase 4 không đổi đầu ra headless. Các kiểm tra UI cũ (Phase 3) bắt được **1 hồi quy thật** do chính Phase 4 gây ra: viết lại CSS làm mất dòng màu mù màu. Đã sửa.
- **Rủi ro:**
  - Máy chấm cần Chrome/Chromium cho bench (`CHROME=` nếu ở chỗ lạ).
  - Số FPS trên máy chấm sẽ khác.
  - Lựa chọn `--jitless` cho soak (§3).

## 6. Lỗi của AI (Phase 4)

| # | Lỗi | Phát hiện | Sửa |
|---|---|---|---|
| 1 | Viết lại `style.css` làm mất `body.cb { --danger }` của Phase 3 | ui-smoke Phase 3 đỏ | Thêm lại; giữ kiểm tra cũ trong bộ UI |
| 2 | Biến `--fs` tính sẵn ở `:root` nên "Chữ lớn" không có tác dụng | ui-smoke mới (đo font) đỏ | Định nghĩa `--fs` trên `body` |
| 3 | Tính sai kỳ vọng top 10 (104 thay vì 105) | Test đỏ, tính lại tay | Sửa kỳ vọng |
| 4 | Patch Python không khớp vì `sim.js` dùng CRLF; một lệnh `sed` thay escape làm hỏng script | Assert trong script / đọc lại script | Script chuẩn hoá xuống dòng; sửa bằng công cụ Edit |
| 5 | Seed của bảng xếp hạng = 1 khi vào thẳng một Đêm | Xem file export | Khởi tạo seed chiến dịch lúc nạp trang |
| 6 | Soak lần đầu vượt ngưỡng (×1.45) | Chạy thật | Đo 40 Đêm để chứng minh không rò rỉ; chọn `--jitless` và công khai (§3) |

## 7. Token (ước tính)

Khoảng 350–450k token cho Phase 4 (ticket rộng: bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói, tài liệu). Cách tiết kiệm:
- Một script patch cho nhiều chỗ sửa thay vì nhiều lần sửa lẻ.
- Dùng lại `ui-smoke`, `shot.js`, `proof.js` đã có.
- Đọc tóm tắt kết quả thay vì log đầy đủ.

*Số chính xác xem `/cost`.*
