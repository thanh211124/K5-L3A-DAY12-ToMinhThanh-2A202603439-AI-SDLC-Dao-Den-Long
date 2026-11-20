# Phase 1 — PRD-0 (Test Contract v1.0)

Tô Minh Thành · 2A202603439 · tag `phase-1`

## 1. Yêu cầu bắt buộc (gạch chân từ PRD-0)

- Game 3D, 1 màn Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn; đi, nhảy, camera 3D.
- Đom đóm rải rác → nhặt → nạp vào đèn → thắp. Bóng Mực đuổi, chạm mất máu; tỏa sáng xua (tốn ánh sáng); Bóng Mực sợ đèn.
- Thắng khi thắp hết đèn, thua khi hết máu, có điểm, HUD, chơi lại.
- Phong cách: đêm ấm, vàng cam = tốt, tím đen = nguy hiểm; Mây đội nón lá có đèn lồng nhỏ; không bạo lực.
- Bàn giao: README (≤3 lệnh, điều khiển, tính điểm), `game.contract.json`, headless theo Contract v1.0, bằng chứng, giả định, nhật ký AI, harness.

## 2. Giả định cho chỗ mơ hồ

| # | Chỗ mơ hồ | Giả định của tôi | Lý do |
|---|---|---|---|
| A1 | "Máu" là gì | = `flames` (ngọn lửa), 3 | Contract dùng `flames` cho máu |
| A2 | Tỏa sáng tốn "ánh sáng" | Tốn `pulse_cost` = 1 đom đóm **đang mang**; không đủ thì không tỏa, không phát sự kiện | Đom đóm là đơn vị ánh sáng duy nhất |
| A3 | Pulse không trúng con nào | Vẫn tốn 1 đom đóm, vẫn ghi `pulse` với `stunned_ids: []` | Hành động đã xảy ra |
| A4 | Đẩy khi tỏa sáng | Đẩy tức thời `pulse_push_m` theo hướng từ Mây ra Bóng Mực (trùng vị trí → hướng +X) | Đơn giản, tất định |
| A5 | Bị choáng lại khi đang choáng | Đặt lại thời gian choáng, được cộng `per_stun` lần nữa | |
| A6 | Rơi đom đóm khi bị chạm | `dropped = floor(carried × 0.5)`, đom đóm rơi **mất hẳn** (không rơi xuống đất) | `motes_active` dễ kiểm tra |
| A7 | "Bóng Mực sợ đèn" | Chỉ **đèn đã thắp** tạo vùng `safe_radius` 5 m; Bóng Mực bị đẩy ra mép (5.01 m). Đèn chưa thắp không bảo vệ | Thắp đèn có thêm giá trị chiến thuật |
| A8 | Hết giờ Đêm | `night1_duration_s` = 300; hết giờ mà chưa thắp hết → `lost`, reason `dawn` | Contract có reason `dawn` |
| A9 | Điểm khi thắng | `+floor(time_left_s) × 2 + flames × 50`, chỉ cộng khi thắng | Theo `per_second_left`, `per_flame_left` |
| A10 | Nạp đèn | Nhấn interact trong `interact_radius` → nạp vào đèn **chưa thắp gần nhất**, lượng `min(carried, cost − deposited)`; nạp một phần được | |
| A11 | Nhặt đom đóm | Tự động khi khoảng cách XZ ≤ 1.5 m, theo thứ tự danh sách, dừng khi đầy | |
| A12 | Mép đảo | Bán kính 40 m, tường mềm, `fall_enabled=false` | Phase 1 không cần độ khó rơi |
| A13 | Vị trí đèn mặc định | Vòng tròn r = 25 m, L1 tại (0,0,25), mỗi đèn cách 72° | Trùng ví dụ contract |
| A14 | Sinh thực thể | 30 đom đóm (không gần gốc < 3 m), mọc lại 1 con / 2 s khi < 30; 2 Bóng Mực ở r = 36 m, +1 con / 30 s (tối đa 6), cách Mây ≥ 15 m, có `shade_spawned`. Tắt hoàn toàn khi `random_*: false` | |
| A15 | Thứ tự xử lý trong 1 tick | timers → di chuyển/nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển + vùng an toàn → va chạm → sinh → kiểm tra kết thúc (thắng ưu tiên trước thua) | Ghi đầu `src/core/sim.js` |
| A16 | Thời gian bất tử / choáng / hồi chiêu | Đếm theo tick: `round(s × 60)`; bị chạm ở tick t thì lần chạm sau sớm nhất ở t + 90 | |
| A17 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s²; khoảng cách tính trên XZ nên nhảy **không** né được va chạm | Contract: khoảng cách đo theo XZ |
| A18 | `dash` | Chưa có ở Phase 1, bỏ qua | PRD-0 không yêu cầu |
| A19 | Lỗi định dạng | JSON hỏng, tick không tăng nghiêm ngặt, kiểu sai, id đèn lạ, không đọc được file → exit 2. Tham số CLI sai → exit 1. `move` ngoài [−1,1] được kẹp lại | |
| A20 | Scenario `lit: true` | Đặt `deposited = lantern_cost` nếu không ghi `deposited`; không phát sự kiện, không cộng điểm | Contract D |

## 3. Tiêu chí nghiệm thu & truy vết

Mỗi dòng ứng với một scenario trong [tests/scenarios/catalog.js](../../tests/scenarios/catalog.js), chạy qua CLI thật. Kết quả và output thô: [docs/proof/phase-1/RESULTS.md](../proof/phase-1/RESULTS.md).

| Yêu cầu | Tiêu chí kiểm chứng được | Kiểm chứng | Kết quả |
|---|---|---|---|
| Đi lại | move [0,1] 60 tick → z = 6.0 | AC01 | Đạt |
| Camera 3D (hướng đi theo yaw) | yaw 90°, move [0,1] → x = 6.0 | AC02 + ảnh | Đạt |
| Chuẩn hóa move | [1,1] → quãng 6.0 m / s | AC03 | Đạt |
| Nhặt đom đóm | mote ở z=5 → `mote_picked` đúng tick 35 | AC04 | Đạt |
| Sức chứa | 14 mote trên đường → mang đúng 10 | AC05 | Đạt |
| Nạp + thắp đèn | carried 5 tại L1, interact → `deposit` 5, `lantern_lit`, +100 | AC06 | Đạt |
| Nạp một phần / ngoài bán kính | 3 → deposited 3, chưa sáng; ngoài 3 m không nạp | AC07 | Đạt |
| Thắng + điểm | thắp đèn cuối → `game_over won all_lit`, điểm = 100 + 99×2 + 2×50 | AC08 | Đạt |
| Tỏa sáng xua Bóng Mực | S1 ở 3 m bị stunned 180 tick, bị đẩy tới 7 m; S2 ở xa không bị | AC09 | Đạt |
| Tốn ánh sáng + hồi chiêu | pulse trong cooldown và khi hết đom đóm bị bỏ qua | AC10 | Đạt |
| Bị chạm mất máu | flames 3→2, dropped 2, lần chạm sau cách 90 tick | AC11 | Đạt |
| Thua khi hết máu | `lost no_flames`, dừng sớm, `end.ticks` = tick game_over | AC12 | Đạt |
| Hết giờ | time_left 2 → `lost dawn` ở tick 120 | AC13 | Đạt |
| Bóng Mực sợ đèn | không bao giờ vào ≤ 5 m quanh đèn đã thắp; người đứng ở đèn không bị chạm | AC14, AC15 | Đạt |
| Không rơi khỏi đảo | chạy ra ngoài → bị giữ ở r = 40 | AC16 | Đạt |
| Nhảy | y > 0 rồi về 0; giữ phím không nhảy lại | AC17 | Đạt |
| Màn mặc định Đêm 1 | 5 đèn L1–L5, 30 đom đóm, 2 Bóng Mực, `shade_spawned` S3 ở tick 1800 | AC18 | Đạt |
| Dựng scenario không phát sự kiện | ticks 0 → chỉ snapshot + end, score 0 | AC19 | Đạt |
| Định dạng output / snapshot-every / end | snapshot 0,10,…; `--snapshot-every 50`; 3 chữ số thập phân | tests/contract.test.js | Đạt |
| Tất định | 2 lần chạy giống hệt từng byte (sha256), seed khác → khác | contract.test.js + RESULTS.md | Đạt |
| Mã thoát 2 / khác 0 | 7 file hỏng → exit 2 + stderr; tham số sai → ≠ 0 | contract.test.js | Đạt |
| `tuning` khai đúng | `game.contract.json` == `src/core/tuning.js` | contract.test.js | Đạt |
| HUD, chơi lại, phong cách, Mây có nón lá + đèn | Ảnh chụp trình duyệt headless | [screens/](../proof/phase-1/screens/) | Đạt (ảnh) |
| Chơi được từ đầu đến thắng/thua bằng tay | Tự chơi thử trên trình duyệt | Ghi tay, chưa có video | **Chưa có bằng chứng dạng video** — sẽ quay ở Phase 4 |

**Kiểm tra test có thật sự bắt lỗi:** đổi tạm `player_speed` 6→7 và tắt bất tử → 3 test đỏ (contract, AC11, AC18), khôi phục → xanh. Tức là test không "luôn đạt".

## 4. Đánh giá Phase 1

- **Đạt:** toàn bộ Test Contract v1.0 (A–E), 19 scenario nghiệm thu + 13 test unit/contract xanh (32/32), bằng chứng tái lập bằng `npm run proof`.
- **Chưa đạt / hạn chế:** không có `dash`; bản web cần internet lần đầu để tải Three.js từ CDN; chưa có video chơi.
- **Rủi ro với test ẩn:** các chỗ diễn giải A2, A6, A7, A15 có thể khác cách giảng viên hiểu; tất cả đã ghi rõ ở trên.
- **Harness cần chỉnh:** chưa thấy agent sai lặp lại. Đã thêm sẵn hook Stop chặn kết thúc khi `npm test` đỏ và skill `verify-headless`.

## 5. Nhật ký dùng AI

| Bước | Công cụ | Việc | Ghi chú |
|---|---|---|---|
| Đọc yêu cầu | Claude Code (Opus) | Đọc README, GUIDE, RUBRIC, lab board Phase 1; trích Test Contract | Lấy nguyên văn JSON mẫu từ HTML vì bản tóm tắt bỏ sót định dạng event |
| Kiến trúc | Claude Code | Chọn JS thuần + Three.js: logic tách khỏi hiển thị, headless bằng Node không cần dependency | Chạy được macOS/Linux, không cần Docker |
| Code lõi + CLI | Claude Code | `sim.js`, `inputs.js`, `runner.js`, `headless.js` | |
| Kiểm chứng | Claude Code | Catalog 19 scenario, test contract, proof script, mutation check, ảnh qua Chrome headless | |
| Lỗi AI tự phát hiện | Claude Code | (1) AC18 ban đầu sẽ chết trước tick 1800 vì Mây đứng yên → sửa scenario cho 99 flames. (2) Đèn nhỏ của Mây bị thân che trong ảnh → dời sang bên vành nón. (3) Bản đầu `headless.js` dùng kiểm tra `isMain` dễ vỡ → tách `runner.js` | Phát hiện nhờ đọc lại logic / xem ảnh, không phải nhờ agent tự báo |

**Token / chi phí (ước tính):** khoảng 150–200k token cho Phase 1 (một phiên Claude Code, phần lớn là đọc tài liệu lab và viết code). Tiết kiệm bằng cách: đọc tài liệu một lần rồi ghi tóm tắt vào notes; không dùng subagent; dùng một catalog scenario chung cho cả test và bằng chứng; kiểm chứng bằng CLI thay vì chơi thử nhiều lần. *(Số chính xác xem `/cost` của phiên; đây là ước tính.)*
