# Retro — Đảo Đèn Lồng (Day 12 AI SDLC)

Tô Minh Thành · 2A202603439 · 4 phase, 4 giờ · công cụ AI: Claude Code (Opus), một phiên liên tục

## 1. Tổng hợp Evaluation 4 phase

| Phase | Yêu cầu chính | Kết quả | Hồi quy phase trước | Điều phải chỉnh |
|---|---|---|---|---|
| 1 · PRD-0 | Đêm 1 chơi được, Test Contract v1.0 | 32/32 test, 19 scenario, tất định | — | Repo chưa có tag `phase-1` khi Phase 2 mở. Đã gắn bù ngay đầu Phase 2 |
| 2 · Ticket-02 | Số chuẩn, 3 Đêm, lướt, Gió Lạc, bùa, tạm dừng, HUD, v1.1 | 64/64 test, 44 scenario, FPS ~143, UI 10/10 | 19 AC Phase 1 đưa về số chuẩn, có lý do | `sim.js` phải viết lại vì thứ tự 12 bước khác giả định A15 |
| 3 · Ticket-03 | Dầu đèn, drain, thắng ở bình minh, mù màu, v1.2 | 78/78 test, 58 scenario, UI 12/12, ADR 0001 | 9 test đỏ đúng dự kiến: xoá 2, sửa 7, có lý do | Cân bằng game người chơi thấy hơi khó (số chuẩn, không được chỉnh) |
| 4 · Ticket-04 | Bench, soak, bảng xếp hạng, dễ tiếp cận, Release, v1.3 | 85/85 test, UI 23/23, bench 270 FPS, soak ×1.13, clone sạch | Kiểm tra UI Phase 3 bắt 1 hồi quy CSS do Phase 4 gây ra | Soak phải chạy `--jitless` (công khai), Release và video cần người làm |

**Số liệu cuối:**
- 85 test tự động, trong đó 58 scenario headless chạy qua CLI thật.
- 23 bước kiểm tra UI qua Chrome thật.
- Khoảng 40 commit nhỏ, 4 tag.
- 1 ADR, 4 file notes (63 giả định có đánh số: A1–A20, B1–B22, C1–C11, D1–D12).

## 2. Điều hiệu quả / không hiệu quả khi làm với AI

**Hiệu quả**
- **Tách lõi tất định khỏi hiển thị ngay từ Phase 1.** Ba ticket sau đều chỉ sửa `src/core` và test chạy trong vài giây. Bench và soak ở Phase 4 dùng lại đúng `Sim` đó.
- **Một catalog scenario dùng cho cả test lẫn bằng chứng.** `npm run proof` sinh `RESULTS.md` từ chính các test, nên bằng chứng không lệch khỏi mã.
- **Mutation check** (cố tình đổi một con số rồi xem test có đỏ không) phát hiện test yếu mà "test xanh" không nói được (Phase 2, test lướt).
- **Lưu danh sách test đỏ trước khi sửa** ở Phase 3 biến change request thành một danh sách việc rõ ràng, và đó cũng là bằng chứng.
- **Kiểm tra giao diện bằng Chrome DevTools Protocol** (`ui-smoke`, `fps-bench`, `bench`, `shot`) thay cho "nhìn thử", nên chạy lại được và bắt được hồi quy.

**Không hiệu quả**
- Sửa file bằng heredoc Python hoặc `sed` trong bash trên Windows: vỡ dấu nháy, đổi CRLF, ký tự escape bị hiểu sai. Mất thời gian ở cả 3 phase sau. Cách đúng là dùng công cụ Edit, hoặc ghi script ra file rồi chạy (đã đưa vào AGENTS.md).
- Agent không đọc được tab Phase 2–4 của lab board (database của trang bị chặn), nên người phải dán ticket vào chat.
- Agent không có `gh`, token hay ffmpeg, nên Release và video phải để người làm.

## 3. Những lần AI sai và cách phát hiện

| Loại | Ví dụ | Cách phát hiện |
|---|---|---|
| Lệch 1 tick | Recoil lùi 1.967 m thay vì 2 m; Gió Lạc biến mất sớm 1 tick | Scenario `every: 1` kiểm đúng tick bắt đầu / kết thúc |
| Sai số dấu phẩy động | 14.000000000000002 > 14 làm bục nhảy không kích hoạt | Scenario P2_15 đỏ → thêm EPS; Phase 3 lưu dầu bằng số nguyên 1/60 |
| Test yếu hoặc kỳ vọng sai | Test lướt không phân biệt hồi chiêu 60/90; kỳ vọng 99.8 thay vì 99.9; top 10 = 104 thay vì 105 | Mutation check; đối chiếu với tính tay |
| Hồi quy khi viết lại | Viết lại CSS làm mất màu mù màu của Phase 3 | Giữ các kiểm tra UI cũ trong bộ chạy mỗi phase |
| Tự nhận phần sáng tạo không phải của mình | Định ghi "Ông Đăng" là sáng tạo, trong khi Ticket-02 đã yêu cầu | Đọc lại ticket trước khi viết README |
| Kết quả "đẹp" đáng ngờ | Soak lần đầu vượt ngưỡng; định lách bằng cách khởi động trước | Từ chối cách đó; đo 40 Đêm để chứng minh không rò rỉ; công khai `--jitless` |
| Bằng chứng chưa đủ | Ảnh thanh dầu bị che; ảnh mù màu không có Bóng Mực | Mở ảnh xem trước khi trích dẫn (quy tắc trong skill `verify-ui`) |

## 4. Harness nào giúp nhiều nhất

1. **Catalog scenario + `npm run proof`** (không phải harness của agent, nhưng là nơi chắc chắn nhất): mỗi yêu cầu thành một hàm `check(lines)`.
2. **`AGENTS.md`**, được cập nhật mỗi phase (lịch sử git thể hiện). Những dòng giá trị nhất đều đến từ lỗi thật: "EPS cho mọi so sánh ≤ r", "dầu là số nguyên 1/60", "`hasZone` chứ không phải `lit`", "quy trình change request", "đừng patch bằng shell".
3. **Hook Stop chạy `npm test`**: chặn kết thúc khi test đỏ, nên agent không thể báo "xong" lúc đang đỏ.
4. **Skill `verify-headless` và `verify-ui`**: biến cách kiểm chứng thành quy trình lặp lại (scenario trước, thấy đỏ, cài đặt, mutation check, proof).
5. **CI** (Ubuntu + macOS): kiểm hệ điều hành mà máy Windows của tôi không có.

## 5. Token và chi phí AI (ước tính)

| Phase | Token ước tính | Ghi chú |
|---|---|---|
| 1 | 150–200k | Phần lớn là đọc tài liệu lab và viết lõi |
| 2 | 300–400k | Viết lại `sim.js`, `main.js`, catalog |
| 3 | 150–200k | Sửa có mục tiêu bằng grep |
| 4 | 350–450k | Nhiều mảng: bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói, tài liệu |
| **Tổng** | **khoảng 1.0–1.25 triệu token** | Một phiên, không dùng subagent. *Số chính xác lấy từ `/cost` của phiên* |

**Cách tiết kiệm:**
- Không dùng subagent; một phiên giữ ngữ cảnh xuyên suốt 4 phase.
- `grep "not ok"` thay vì đọc toàn bộ log test.
- Grep đúng vị trí cần sửa thay vì đọc lại file 800 dòng.
- Một script patch cho nhiều chỗ sửa liên quan.
- Dùng lại công cụ cũ (`ui-smoke`, `shot.js`, `proof.js`) qua các phase.
- AGENTS.md ngắn (khoảng 30 dòng).

**Chỗ còn lãng phí:** các lần patch bằng shell bị lỗi rồi chạy lại; đọc lại toàn bộ `main.js` ở Phase 4.

## 6. Nếu làm lại

- Gắn tag và push **ngay khi hết giờ phase**, không chờ người nhắc (Phase 1 suýt không có tag).
- Ngay từ Phase 1: dùng công cụ Edit, cố định xuống dòng LF bằng `.gitattributes`, cài Three.js qua npm thay vì CDN.
- Viết scenario dạng dữ liệu (JSON) thay vì hàm JS, để test của mình gần với cách giảng viên sinh tình huống.
- Kiểm tra bộ nhớ (soak) sớm từ Phase 2, để biết trước giới hạn đo RSS khi bật JIT.
- Lên lịch chơi thử bằng tay sau **mỗi** phase (playtest Phase 3 cho thấy game khó; nếu biết sớm thì có thể thêm hỗ trợ ở phần hiển thị).
- Chia `web/main.js` (khoảng 900 dòng) thành các module (`hud`, `settings`, `leaderboard`, `bench`) trước Phase 4.
