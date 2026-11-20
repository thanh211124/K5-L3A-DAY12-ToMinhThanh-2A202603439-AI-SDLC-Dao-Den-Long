# Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)

Tô Minh Thành · 2A202603439 · tag `phase-2`

## 1. Ticket-02 thay đổi gì

1. **Số liệu chuẩn** thay toàn bộ số tự chọn ở Phase 1 (`src/core/tuning.js` + `game.contract.json`, test bắt buộc trùng nhau).
2. **3 Đêm, bản đồ chuẩn** (`src/core/maps.js`): Đảo Bến (r 40, rơi được), Đảo Cau (2 đảo + cầu tre + 2 bục nhảy), Đảo Chuông (3 tầng, 2 dốc, bục, tháp chuông, gió).
3. **Tính năng mới:** Lướt, Gió Lạc, Bùa Gió, chuỗi 3 Đêm, Tạm dừng, Cài đặt, Âm thanh, HUD đầy đủ, bảng màu chuẩn, ánh sáng theo tiến độ.
4. **Contract v1.1:** `--night 1|2|3`, các trường snapshot / scenario / input / sự kiện mới, tên trạng thái Bóng Mực bắt buộc, chạy một Đêm ≤ 30 s.

**Thiết kế:** giữ nguyên kiến trúc Phase 1 (lõi thuần JS tất định, dùng chung cho headless và trình duyệt), nhưng **viết lại `sim.js`** theo đúng thứ tự 12 bước bắt buộc của ticket, vì thứ tự ở Phase 1 (giả định A15) khác. Địa hình là hàm độ cao `ground(x,z)` theo từng Đêm, trả về `null` ở vùng rơi. Vách là chỗ chênh cao lớn hơn 0.35 m nên không đi lên được, còn dốc thì liên tục.

## 2. Giả định mới (chỗ Ticket-02 chưa nói rõ)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Điểm xuất phát Đêm 3 ((0,0,0) nằm trong tháp chuông) | Đêm 3 xuất phát tại **(0,0,−30)** trên tầng 0, quay mặt +Z. Đêm 1 và 2 xuất phát tại (0,0,0) |
| B2 | "Chênh cao ≤ 1.5 m" khi Bóng Mực chạm | Bóng Mực lơ lửng ở độ cao mặt đất + 1 m; chênh cao = \|shade.y − player.y\| |
| B3 | Trạng thái mặc định của Bóng Mực trong scenario | `wander`; ở trong 12 m thì chuyển `chase` ngay tick đầu |
| B4 | Điểm sinh Bóng Mực "hợp lệ" | Cách Mây ≥ 15 m (XZ), không nằm trong vùng an toàn của đèn đã sáng, không trùng Bóng Mực khác; chọn ngẫu nhiên theo seed |
| B5 | Trạng thái `spawning` kéo dài bao lâu | 30 tick, không di chuyển, không gây sát thương |
| B6 | `wander` di chuyển thế nào | 2 m/s tới một điểm ngẫu nhiên trong bán kính 8 m (có mặt đất), tới nơi hoặc bị chặn thì chọn điểm khác |
| B7 | Bóng Mực và địa hình | Không bước ra khỏi mặt đất, không leo vách (> 0.35 m); đi được trên dốc. Đẩy lùi / recoil dừng khi gặp vật cản |
| B8 | "Điểm sương" của Gió Lạc | Dùng các điểm sinh Bóng Mực của Đêm đó. Gió Lạc bay ở độ cao mặt đất + 1.5 m, không bị địa hình chặn |
| B9 | Gió Lạc chạm khi Mây không mang gì | Không cướp (cần mang > 0). Gió Lạc idle chạm vào cũng cướp. Con đã `removed` vẫn nằm trong snapshot với state `removed` và không tính vào giới hạn 2 con |
| B10 | Tỏa Sáng trúng Gió Lạc đang `idle` | Không có tác dụng (ticket chỉ nói chase và flee) |
| B11 | Sự kiện `night_start` | Ghi ở tick 0, ngay sau snapshot đầu (không phải sự kiện gameplay nên không vi phạm luật "dựng scenario không phát sự kiện") |
| B12 | Kiểu dữ liệu trường mới | `player.invuln` là boolean; các trường `*_s` là giây, làm tròn 3 chữ số; `wind.dir_deg` là số nguyên 0–359 khi có gió, `null` khi không; `ttl_s` của đom đóm thường là `null` |
| B13 | Lịch gió | Bắt đầu tại sim tick 1800k (k ≥ 1), kéo dài 300 tick, hướng ngẫu nhiên theo seed, chỉ đẩy Mây |
| B14 | Lướt và nhảy / bục | Đang lướt thì không nhảy được. Lướt trên không giữ Y, hết lướt thì rơi từ vận tốc Y = 0. Lướt khi đang bay từ bục thì 12 tick dùng vận tốc lướt rồi quay lại vận tốc phóng |
| B15 | Trong 60 tick chờ hồi sinh | Mây đứng yên tại chỗ rơi, không nhặt, không bị chạm, không cướp được, không nạp, không tỏa sáng; Bóng Mực về `wander` |
| B16 | So sánh "≤ r" với số thực | Cộng sai số 1e-9 (ví dụ 14.5 − 5×0.1 = 14.000000000000002) |
| B17 | Khoảng cách tương tác đèn và vùng an toàn | Chỉ đo theo XZ, không xét độ cao |
| B18 | Bùa Gió trong scenario | `charms: [{id, pos?, available?, respawn_ticks?}]`; thiếu `pos` thì lấy vị trí chuẩn theo id |
| B19 | Vị trí đom đóm rơi | Góc và bán kính 1.5–2.5 m ngẫu nhiên theo seed; Y = mặt đất ở đó (nếu là vùng rơi thì lấy Y của Mây) |
| B20 | Dòng `end` khi đang tạm dừng | `state: "playing"` (contract chỉ cho phép playing/won/lost) |
| B21 | Tạm dừng trong bản có giao diện | GUI dừng logic bằng cách không gọi `sim.step`, kết quả quan sát được giống hệt. Còn input `pause` trong headless theo đúng contract |
| B22 | Điểm hiển thị trên HUD | Tổng điểm các Đêm đã thắng + điểm Đêm hiện tại |

## 3. Thay đổi so với Phase 1 (test và giả định cũ bị thay)

Ticket-02 **thay** các số và luật Phase 1. Test cũ được **sửa kèm lý do**, không bị tắt:

| Phase 1 | Phase 2 | Lý do |
|---|---|---|
| AC04 nhặt ở tick 35 (r 1.5), +10 điểm khi nhặt | Tick 40 (r 1.0), **0 điểm khi nhặt** | Số chuẩn; điểm tính "mỗi đom đóm **nạp**" |
| AC06 cost 5, điểm 100 | Cost 10, điểm 10×10 + 100 = 200 | Số chuẩn |
| AC08 điểm thắng 398 | 498 | Điểm theo đom đóm nạp |
| AC09 choáng 180 tick, đẩy tức thì 4 m, +25 | 120 tick, đẩy 4 m chia đều 15 tick, +5, tâm = chân + 0.8 m (3D) | Số chuẩn; thay giả định A4 |
| AC10 cost 1 / hồi 2 s | Cost 3 / hồi 3 s | Số chuẩn |
| AC11 đom đóm rơi mất hẳn (A6) | Rơi ra vành 1.5–2.5 m, TTL 480, Bóng gây hit thì recoil | Ticket quy định; thay A6 |
| AC14 mép an toàn 5.01 m | Chặn đúng mép 6 m | Số chuẩn |
| AC16 không rơi khỏi đảo (A12) | **Thay hẳn** bằng AC16 rơi và hồi sinh | Ticket: ngoài 40 m là biển mây, `fall_enabled: true` |
| AC18 2 Bóng Mực lúc đầu, +1 mỗi 30 s, 30 đom đóm ngẫu nhiên | 0 lúc đầu, 2 con ở tick 300, +1 mỗi 480 tick; 20 đom đóm ở 20 điểm chuẩn | Bản đồ và lịch sinh chuẩn; thay A13, A14 |
| AC19 chỉ có snapshot + end | Snapshot + `night_start` + end | Sự kiện mới của v1.1 |
| Thứ tự xử lý A15 | 12 bước bắt buộc của ticket | Ticket bắt buộc |
| A2, A3, A7, A9, A10, A16, A17, A19, A20 | Giữ nguyên (ticket xác nhận hoặc không đổi) | |

Bằng chứng Phase 1 cũ ở [docs/proof/phase-1/](../proof/phase-1/RESULTS.md) vẫn được **giữ nguyên** vì nó khớp mã ở tag `phase-1`. Chạy lại `node tools/proof.js phase-1` ở tag `phase-1` sẽ ra lại đúng kết quả đó.

## 4. Tiêu chí nghiệm thu và truy vết (Phần 3 và các điểm mới khác)

Scenario nằm trong [tests/scenarios/catalog.js](../../tests/scenarios/catalog.js). Output thật: [docs/proof/phase-2/RESULTS.md](../proof/phase-2/RESULTS.md).

| Mục | Tiêu chí nghiệm thu (kiểm chứng được) | Kiểm chứng | Kết quả |
|---|---|---|---|
| Số liệu chuẩn | `game.contract.json.tuning` == code, v1.1, đủ 5 khóa mới | contract.test.js | Đạt |
| Lướt | 14 m/s × 12 tick; `dash` ở 11 và 101; bấm ở 51 và 96 bị bỏ (hồi 90 tick) | P2_01 | Đạt |
| Lướt khi đứng yên / trên không | Theo hướng quay mặt (+Z); Y không đổi trong lúc lướt | P2_02 | Đạt |
| **Gió Lạc** idle→chase→flee→removed | Mang 6, cách 5 m → chase, cướp 3, còn 3, flee, removed sau 240 tick; bất tử không ngăn; lửa không đổi | P2_05 | Đạt |
| Gió Lạc + Tỏa Sáng (chase) | Chuyển flee, không cướp | P2_06 | Đạt |
| Gió Lạc + Tỏa Sáng (flee có đồ) | `drifter_drop` 3, có 3 đom đóm rơi, removed sau 120 tick | P2_07 | Đạt |
| Gió Lạc sinh | Không có ở tick 1190, D1 xuất hiện ở tick 1200 (Đêm 2) | P2_08 | Đạt |
| **Bùa Gió** | Nhặt ở tick 10, `charm_picked` C1 600; chạy 7.2 m/s; lướt ở 31 và 51 (không hồi chiêu), bấm ở 36 bị bỏ (đang lướt); respawn_s 44.833 | P2_03 | Đạt |
| Bùa xuất hiện lại | available false → true khi hết thời gian chờ | P2_04 | Đạt |
| **Chuỗi 3 Đêm** | Menu → giới thiệu (tên đảo + Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 thì ra Bình Minh kèm tổng điểm; thua thì "Chơi lại Đêm N" | ui-smoke.txt (10 bước) | Đạt (*) |
| **Tạm dừng** | Headless: tick tăng, sim_tick đứng, state `paused`, `paused`/`resumed`. GUI: P/Esc dừng hẳn logic, có đủ 4 nút | P2_17 + ui-smoke | Đạt |
| **Cài đặt** | Âm lượng và độ nhạy chuột lưu qua lần tải lại trang | ui-smoke | Đạt |
| **Âm thanh** | Nhạc nền + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s, gió | Review mã [web/audio.js](../../web/audio.js); không có lỗi console | **Chưa nghe kiểm tra bằng tai** (tự động hóa không nghe được) |
| **HUD đầy đủ** | Lửa trên trái, đồng hồ trên giữa (đỏ, nhấp nháy khi ≤ 30 s), đèn k/n + điểm trên phải, thanh 10 ô dưới giữa, hồi chiêu Lướt/Tỏa Sáng dưới phải, nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn | Ảnh [screens/](../proof/phase-2/screens/) 03–05 | Đạt (ảnh); chưa có ảnh trạng thái ≤ 30 s |
| **Bảng màu chuẩn** | Mã hex trùng 100% với bảng chuẩn | palette.test.js | Đạt |
| Ánh sáng môi trường | `0.15 + 0.55 × sáng/tổng` | palette.test.js | Đạt |
| Gió mạnh (Đêm 3) | Gió bật ở tick 1800, tắt ở 2100, đẩy đúng 10 m theo `dir_deg`; GUI báo trước 2 s bằng lá bay và âm thanh | P2_16 (+ mã GUI) | Đạt (headless) |
| Bản đồ Đêm 2 | 6 đèn đúng thứ tự, 330 s, cầu đi qua được, cầu không lan can, bục nhảy đáp vào đảo B | P2_24, P2_10, P2_11, P2_09 | Đạt |
| Bản đồ Đêm 3 | 7 đèn, 360 s; vách chặn; dốc lên Y 3; bước khỏi tầng thì rơi xuống; bục lên Y 6 | P2_23, P2_12–15, sim.test | Đạt |
| Rơi khỏi đảo | Đúng 1 `player_hit` by fall, `lost` 4, chờ 60 tick, hồi sinh (0,0,0) + bất tử; bỏ qua bất tử; hết lửa thì thua ngay | AC16, P2_21 | Đạt |
| Bóng Mực | Phát hiện 12 / bỏ đuổi 18; recoil 2 m / 60 tick; tối đa 1 hit / tick; vùng an toàn đẩy ra trong 30 tick, không sát thương; tên trạng thái đúng | P2_18, AC11, P2_20, P2_19 | Đạt |
| Lịch sinh | Đom đóm 20 → +1 ở 240, 480… chỉ vào điểm trống (dừng ở 24); Bóng Mực S1, S2 ở tick 300, S3 ở 780 | P2_22, AC18 | Đạt |
| Thắng ngay tick hết giờ | `won` chứ không phải `dawn` | P2_25 | Đạt |
| Contract v1.1 | Đủ trường snapshot; scenario sai thì exit 2; tất định cả 3 Đêm; một Đêm đầy đủ ≤ 30 s (đo được 0.13–0.20 s) | contract_v11.test.js, RESULTS.md | Đạt |
| FPS ≥ 30 ở 1280×720 | Trung bình 142–143 FPS cả 3 Đêm | [fps.json](../proof/phase-2/fps.json) | Đạt (**trên máy Windows của tôi**: i5-12450H, Intel UHD) |

(*) Trong ui-smoke, bước "thua" và "thắng Đêm 3" được ép bằng cách đặt trạng thái qua DevTools (lửa = 0, thắp sẵn mọi đèn) để kiểm tra luồng màn hình. Đây không phải chơi thật từ đầu tới cuối.

## 5. Đánh giá Phase 2

- **Đạt:** 64/64 test (`npm test`), 44 scenario + 3 kiểm tra tất định/thời gian trong proof (47/47), 10/10 bước UI, FPS đạt.
- **Hồi quy Phase 1:** mọi tiêu chí Phase 1 vẫn được kiểm tra với số chuẩn (AC01–AC19). Những AC đổi luật đã ghi ở mục 3.
- **Chưa đạt / hạn chế:**
  - Âm thanh chưa nghe kiểm tra.
  - Chưa chơi tay trọn 3 Đêm.
  - FPS đo trên Windows chứ không phải máy chấm.
  - Đồ họa tầng 1 của Đêm 3 hơi thô.
  - Bản web vẫn cần internet để tải Three.js.
- **Rủi ro với test ẩn:** B1 (điểm xuất phát Đêm 3), B2 (cách đo chênh cao), B5 (thời gian spawning), B9, B11.

## 6. Lỗi của AI và cách phát hiện

| # | Lỗi | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Recoil chỉ lùi 1.967 m (thiếu 1 tick vì đếm ngược ở bước timer) | AC11 đỏ | Đếm recoil trong bước di chuyển |
| 2 | Gió Lạc biến mất sớm 1 tick sau `drifter_drop` | P2_07 đỏ | Dùng tick biến mất tuyệt đối `removeAt` |
| 3 | Bục nhảy Đêm 3 không kích hoạt: 14.000000000000002 > 14 | P2_15 đỏ | Sai số EPS 1e-9 (B16); thêm quy tắc vào AGENTS.md |
| 4 | **Test yếu:** test lướt không phân biệt được hồi chiêu 60 với 90 | Mutation check (đổi 90→60 mà test vẫn xanh) | Thêm lần bấm ở tick 95. AGENTS.md giờ yêu cầu mutation check cho mỗi luật mới |
| 5 | Test Phase 1 còn coi `--night 2` là tham số sai | Test đỏ sau khi đổi contract | Đổi thành `--night 4` |
| 6 | Patch Python chèn xuống dòng thật vào template string → `proof.js` lỗi cú pháp | `npm run proof` thoát mã 1 | Sửa; dùng công cụ Edit thay cho patch qua shell |

## 7. Nhật ký dùng AI và token

| Bước | Việc |
|---|---|
| Đọc ticket | Bạn dán Ticket-02 vào chat (agent không đọc được tab Phase 2 của lab board vì database của trang bị chặn) |
| Lõi | Viết lại `tuning.js`, `maps.js`, `sim.js` theo 12 bước, CLI `--night` |
| Kiểm chứng | Đưa 19 AC về số chuẩn, thêm 25 scenario P2, test contract v1.1, test bảng màu, mutation check |
| GUI | Viết lại `web/` (menu, 3 Đêm, tạm dừng, cài đặt, HUD, âm thanh) |
| Đo | `tools/fps-bench.js`, `tools/ui-smoke.js` qua Chrome DevTools Protocol |

**Token (ước tính):** khoảng 300–400k token cho Phase 2 (một phiên Claude Code; phần lớn là viết `sim.js`, `main.js` và catalog). Cách tiết kiệm:
- Không dùng subagent.
- Một catalog dùng chung cho test và bằng chứng.
- Đọc output tóm tắt (`grep "not ok"`) thay vì toàn bộ log test.
- Kiểm chứng giao diện bằng script thay vì chụp ảnh lặp lại nhiều lần.

*Số chính xác xem `/cost`.*
