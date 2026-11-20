# Phase 3 — Ticket-03 "Đèn cạn dầu" (Change Request, Contract v1.2)

Tô Minh Thành · 2A202603439 · tag `phase-3`

- **Quyết định thiết kế:** [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) (máy trạng thái đèn có nhiên liệu, trạng thái `drain`, luật thắng ở bình minh).
- **Breaking changes:** [CHANGELOG.md § phase-3](../../CHANGELOG.md#phase-3).
- **Bằng chứng:** [docs/proof/phase-3/RESULTS.md](../proof/phase-3/RESULTS.md) (61/61), [ui-smoke](../proof/phase-3/ui-smoke.txt) (12/12), [ảnh](../proof/phase-3/screens/), [FPS](../proof/phase-3/fps.json).

## 1. Giả định mới

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| C1 | Đèn đặt `lit: true` bằng scenario mà không ghi `ever_lit` | `ever_lit = true` (đèn đang sáng thì đã từng sáng); không tính vào `successful_lights` |
| C2 | Scenario đặt `fuel` cho đèn tắt | Bỏ qua; đèn tắt luôn có `fuel: 0` |
| C3 | Lượng nạp khi thắp lại | Ngưỡng là `cost = 5` nếu `ever_lit`, ngược lại 10; `deposited` của đèn sáng giữ bằng `cost`; khi tắt thì `deposited = 0` |
| C4 | `wander` "đi về đèn tắt gần nhất như trước" | Bóng Mực wander đi về đèn tắt gần nhất ở 2 m/s và dừng cách đèn 2 m; nếu không có đèn tắt nào thì lang thang ngẫu nhiên như Phase 2 |
| C5 | Bóng Mực tới đèn yếu | Kiểm tra khoảng cách ≤ 2 m sau khi di chuyển trong cùng tick; vào `drain` ngay tick đó, bắt đầu trừ dầu từ bước 2 của tick sau |
| C6 | `fuel_drain` "mỗi 60 tick" | Đếm theo số tick hút của từng con (tick hút thứ 60, 120, …); `fuel` trong sự kiện là dầu sau khi trừ, làm tròn 1 chữ số |
| C7 | Điểm Tỏa Sáng khi Bóng Mực đang drain | Cộng 15 (thay cho 5, không phải 5 + 15) |
| C8 | `winThreshold` | `ceil(0.6 × n)` tính với sai số 1e-9 (3/5, 4/6, 5/7) |
| C9 | Dòng `end` | Đêm kết thúc chỉ khi hết giờ hoặc hết Ngọn Lửa |
| C10 | Mũi tên HUD | Vẫn chỉ tới đèn chưa sáng gần nhất (ticket không đổi) |
| C11 | Mù màu: đèn sáng / tắt phân biệt bằng hình | Đèn tắt bị xẹp 20% theo chiều cao, có mảng giấy rách tối màu, không có thanh dầu; đèn sắp cạn nhấp nháy 1 Hz (đèn và thanh dầu); vòng an toàn chỉ hiện khi đèn còn vùng an toàn |

## 2. Tiêu chí nghiệm thu và truy vết

| Yêu cầu Ticket-03 | Tiêu chí kiểm chứng được | Kiểm chứng | Kết quả |
|---|---|---|---|
| §1 Hao dầu, tắt đèn | Dầu 1 → `lantern_out` đúng tick 60; deposited 0, ever_lit true, fuel 0; dầu 100 sau 100 tick còn 98.3 | P3_01 | Đạt |
| §1 Châm dầu | Dầu 55, mang 10 → used 5, fuel 100, +25, sự kiện `refuel`, không có `deposit` | P3_02 | Đạt |
| §1 Thắp lại cần 5 | `lantern_lit` relight true, +25 +40 = 65, relit_count 1, fuel 100 | P3_03 | Đạt |
| §1 Thắp lần đầu vẫn cần 10 | Nạp 3 → chưa sáng | AC07 | Đạt |
| §1 Hiển thị thanh dầu, nhấp nháy < 30 | Thanh cam trên đèn sáng; đèn yếu nhấp nháy, mất vòng an toàn | [04](../proof/phase-3/screens/04_fuel_bar_full.png), [07](../proof/phase-3/screens/07_lowfuel_blink_a.png) / [08](../proof/phase-3/screens/08_lowfuel_blink_b.png) (cách 0,5 s) | Đạt |
| §2 Đèn < 30 mất vùng an toàn | Đứng ở đèn có dầu 25 vẫn bị đánh (đèn có dầu 100 thì không, AC14) | P3_09, AC14 | Đạt |
| §2 Wander → đèn yếu → drain | Bóng Mực đi về đèn yếu L1 (bỏ qua L2 đang đầy), tới ≤ 2 m thì drain | P3_16 | Đạt |
| §2 Hút 5/s + hao 1/s, `fuel_drain` mỗi 60 tick, hết dầu thì về wander | `fuel_drain` đầu tiên ở tick 61 với fuel 23.0; `lantern_out` ở tick 291 (= 1739/6); wander lúc tick 300 | P3_05 | Đạt |
| §2 Drain → chase chỉ khi ≤ 6 m | Mây ở 8 m: vẫn drain; vào 6 m: chase | P3_06 | Đạt |
| §2 Châm lên ≥ 30 thì đẩy Bóng Mực ra, không sát thương | used 9, fuel 100, Bóng Mực ở mép 6 m lúc tick 30, 0 lần bị đánh | P3_07 | Đạt |
| §2 Tỏa Sáng trúng Bóng Mực đang drain | Điểm 15, chuyển stunned | P3_08 | Đạt |
| §3 Không còn thắng sớm | Thắp đủ 5/5 → không có `game_over` | P3_10, ui-smoke | Đạt |
| §3 Thắng ở bình minh | 3/5 sáng → `dawn_survived`, điểm 3×(50+99)+150 = 597 | P3_11 | Đạt |
| §3 Thua ở bình minh | 2/5 → `dawn`, điểm 0 | P3_12 | Đạt |
| §3 Ngưỡng ceil(0.6 n) | Đêm 2: 4/6 thắng; Đêm 3: 4/7 thua | P3_13, P3_14 | Đạt |
| §3 Hết lửa thắng thế ở tick cuối | `no_flames` ở tick 1 khi time_left = 1/60 | P3_15 | Đạt |
| §3 Thời lượng 240/270/300 | Snapshot tick 0 | AC18, P2_23, P2_24 | Đạt |
| §4 Sức chứa tăng | 7 lần thắp → sức chứa 20 (tối đa), mang 20; một lần thắp → 12 | P3_04, P3_03, AC06 | Đạt |
| §5 Điểm mới | +5/đom đóm, +100 thắp lần đầu, +40 thắp lại, +5/+15 Tỏa Sáng, thưởng bình minh | AC06, P3_02, P3_03, P3_08, P3_11 | Đạt |
| §6 Chế độ mù màu | Cài đặt được lưu; `--danger` = #FFFFFF; viền + mắt #00B3FF; ⚠ trên đồng hồ | ui-smoke, palette.test, ảnh [05](../proof/phase-3/screens/05_shades_normal.png) / [06](../proof/phase-3/screens/06_shades_colourblind.png), người chơi bật thử | Đạt |
| §7 Contract v1.2 | Version 1.2, đủ 8 khóa tuning mới; snapshot có `fuel` / `ever_lit` / `relit_count` / `capacity`; trạng thái `drain` hợp lệ | contract.test, catalog | Đạt |
| Không hồi quy | Mọi scenario Phase 1–2 không bị thay thế vẫn xanh; tất định 3 Đêm, ≤ 30 s (0.19–0.40 s) | RESULTS.md | Đạt |

## 3. Test cũ bị Ticket-03 làm sai: sửa hoặc xoá kèm lý do

Ngay sau khi cài luật mới, **9 test đỏ** ([old-tests-before-update.txt](../proof/phase-3/old-tests-before-update.txt)). Không có test nào bị skip.

| Test | Xử lý | Lý do |
|---|---|---|
| contract.test (version) | Sửa `1.1` → `1.2` | Contract v1.2 |
| AC06_deposit_and_light | Sửa điểm 200 → 150, thêm kiểm tra `relight: false`, fuel và sức chứa 12 | §5 +5/đom đóm; §1, §4 |
| **AC08_win_all_lit** | **Xoá** | §3 [THAY THẾ]: thắp hết đèn không còn kết thúc Đêm; được thay bằng P3_10 (không thắng sớm) và P3_11 (thắng ở bình minh) |
| AC18_default_level_night1 | Sửa `time_left_s` 300 → 240 | §3 thời lượng mới |
| P2_17_pause | Sửa kỳ vọng time_left 300 − 10/60 → 240 − 10/60 | Thời lượng mới; luật tạm dừng không đổi |
| P2_23 / P2_24 | Sửa 360 → 300 và 330 → 270 | Thời lượng mới |
| **P2_25_win_on_dawn_tick** | **Xoá** | Kiểm tra "thắng all_lit đúng tick hết giờ"; `all_lit` không còn. Ý "thứ tự xét ở tick cuối" được giữ ở P3_15 (no_flames thắng thế) và P3_11 |
| sim.test time_left | Sửa 298.5 → 238.5 | Thời lượng mới |
| tools/ui-smoke (bước Bình Minh) | Sửa: ép hết giờ với 5/7 đèn thay vì thắp hết đèn | Không còn thắng sớm |

**Giả định Phase 1–2 bị thay:** A7 / AC14 ("đèn đã sáng luôn chặn Bóng Mực") giờ chỉ đúng khi fuel ≥ 30. Giả định B3 về `wander` có thêm đích đến (C4).

## 4. Đánh giá Phase 3

- **Đạt:** 78/78 test, 61/61 proof, 12/12 bước UI; FPS khoảng 140 (Đêm 1 và 3, 1280×720, máy của tôi).
- **Kiểm tra lỗi (mutation check):** tôi cố tình đổi 5 số (drain 5→4, relight 5→6, ngưỡng 30→20, điểm drain 15→10, tỉ lệ thắng 0.6→0.5). Lần nào cũng có ít nhất một scenario P3 đỏ.
- **Đã bổ sung sau khi chơi thử:**
  - Ảnh Bóng Mực thường và ở chế độ mù màu: [05](../proof/phase-3/screens/05_shades_normal.png) viền và mắt tím #7A3CFF, [06](../proof/phase-3/screens/06_shades_colourblind.png) xanh #00B3FF. Bóng Mực vẫn hiện vì ticket chỉ đổi màu viền và mắt.
  - Đèn sắp cạn dầu nhấp nháy: [07](../proof/phase-3/screens/07_lowfuel_blink_a.png) / [08](../proof/phase-3/screens/08_lowfuel_blink_b.png), chụp cách nhau 0,5 s = nửa chu kỳ 1 Hz (sáng + thanh dầu đỏ → tối, mất thanh). Bối cảnh được dựng bằng `tools/shot.js` (đặt trạng thái qua `__game`, chỉ để chụp ảnh).
- **Playtest của người (Tô Minh Thành, chơi tay trên trình duyệt):**
  - Âm thanh có và nghe được: **đạt** (kiểm tra bằng tai).
  - Chế độ mù màu bật được; Bóng Mực vẫn hiện (đúng yêu cầu).
  - Mây nhấp nháy khi bị Bóng Mực chạm. Đây là hiệu ứng bất tử của Mây (Phase 2), khác với nhấp nháy của đèn sắp cạn dầu (kiểm tra bằng ảnh 07/08).
  - **Độ khó:** "chơi một ván thì hơi khó". Số liệu (dầu hao 1/s, Bóng Mực hút 5/s, Đêm 240 s, cần 3/5) là số chuẩn của ticket nên **không được chỉnh**. Có thể giảm khó bằng phần hiển thị (không đổi luật) ở Phase 4, ví dụ gợi ý trên HUD đèn nào sắp tắt.
- **Còn hạn chế:**
  - Nhịp 1 Hz kiểm tra bằng hai ảnh, chưa có video.
  - Chưa chơi thắng trọn cả 3 Đêm bằng tay.
- **Rủi ro với test ẩn:** C4 (tốc độ và điểm dừng của wander), C5 (drain bắt đầu trừ từ tick sau), C6 (cách đếm `fuel_drain`).

## 5. Lỗi của AI (Phase 3)

| # | Lỗi | Phát hiện bằng | Sửa |
|---|---|---|---|
| 1 | Kỳ vọng sai trong test của chính AI: fuel ở tick 10 ghi 99.8, thực tế 99.85 làm tròn ra 99.9 | P3_03 đỏ; đối chiếu với AC06 | Sửa kỳ vọng (code đúng) |
| 2 | Thanh dầu đặt lệch +z nên bị tấm nền che khi nhìn từ camera | Xem ảnh chụp | Gom vào nhóm quay về camera, thanh đặt phía trước nền |
| 3 | Heredoc Python dài trong bash bị lỗi dấu nháy (2 lần); script đồng bộ contract khi làm mutation dùng `/tmp` không tồn tại trên Windows | Lệnh lỗi | Ghi script ra file bằng công cụ Write rồi chạy |
| 4 | Một script Python đọc rồi ghi lại `maps.js` "cho chắc", làm đổi toàn bộ ký tự xuống dòng (182 dòng diff giả) | `git diff --stat` trước khi commit (`--ignore-all-space` cho thấy 0 thay đổi thật) | `git checkout` lại file; AGENTS.md giờ yêu cầu dùng I/O `newline=''` |

## 6. Token (ước tính)

Khoảng 150–200k token cho Phase 3 (ticket ngắn nhưng phải sửa nhiều chỗ). Tiết kiệm bằng cách:
- Grep đúng vị trí cần sửa thay vì đọc lại cả `sim.js`.
- Dùng lại cơ chế đẩy ra của Phase 2 cho châm dầu.
- Lưu một lần danh sách test đỏ làm bằng chứng thay vì chạy lại nhiều lần.

*Số chính xác xem `/cost`.*
