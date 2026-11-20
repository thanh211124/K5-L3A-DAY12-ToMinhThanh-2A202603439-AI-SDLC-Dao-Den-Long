# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Tô Minh Thành · MSSV 2A202603439 · Day 12 AI SDLC Lab (K5-L3A)

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi đội nón lá, gom **đom đóm** để thắp lại các **Đèn Lồng Lớn** của **ba hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), **tỏa sáng** xua **Bóng Mực** và giữ đom đóm khỏi **Gió Lạc**.

- Game chạy trên trình duyệt (Three.js / WebGL), nên chạy được trên macOS, Linux và Windows.
- Logic game là JavaScript thuần trong `src/core/`, dùng chung cho bản có giao diện và chế độ **headless** (Test Contract **v1.2**).
- Tài liệu gốc của lab: [docs/lab/](docs/lab/README.md).

## Cài đặt và chạy (3 lệnh)

Yêu cầu: Node.js ≥ 20 và một trình duyệt hiện đại (lần đầu cần internet để tải Three.js từ CDN).

```bash
git clone <repo-url> && cd <repo>
npm install
npm start          # rồi mở http://localhost:8080/
```

Headless và kiểm thử:

```bash
node src/headless.js --seed 1 --night 2 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
npm test           # 78 test: unit, contract, bảng màu, 58 scenario nghiệm thu qua CLI thật
npm run proof      # sinh lại bằng chứng vào docs/proof/phase-3/
node tools/ui-smoke.js ; node tools/fps-bench.js   # kiểm tra giao diện và FPS (cần npm start + Chrome)
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W` `A` `S` `D` / `↑` `↓` | Đi (theo hướng camera) |
| Kéo chuột / `←` `→` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Nạp ánh sáng vào đèn trong 2 m (đèn tắt: thắp; đèn đang sáng: châm dầu) |
| `F` | Tỏa Sáng (tốn 3 đom đóm, bán kính 5 m, hồi 3 s) |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

## Luật chơi (Ticket-02 + Ticket-03 "Đèn cạn dầu")

- **Ba Đêm:** Đảo Bến (5 đèn, 240 s), Đảo Cau (6 đèn, 270 s, cầu tre, bục nhảy), Đảo Chuông (7 đèn, 300 s, 3 tầng, dốc, bục, gió mạnh). Thắng Đêm 3 thì ra màn **Bình Minh**; thua thì chơi lại Đêm đó.
- **Mục tiêu:** **giữ đảo sáng tới bình minh.** Thắng khi hết giờ mà Mây còn sống và số đèn đang sáng ≥ 60% (3/5, 4/6, 5/7). Thắp hết đèn **không** kết thúc Đêm.
- **Dầu đèn:** đèn vừa thắp có 100 dầu, hao 1/giây. Hết dầu thì tắt; thắp lại chỉ cần 5 đom đóm. Nhấn `E` ở đèn đang sáng để châm dầu (+10 dầu mỗi đom đóm). Đèn dưới 30 dầu nhấp nháy, mất vùng an toàn, và Bóng Mực sẽ tới **hút dầu** (5/giây).
- **Đom đóm:** tự nhặt khi ≤ 1 m. Sức chứa ban đầu 10, mỗi lần thắp thành công +2 (tối đa 20). Đèn chưa từng sáng cần 10, nạp nhiều lần được.
- **Bóng Mực:** đuổi khi Mây ở trong 12 m, bỏ đuổi khi xa hơn 18 m. Chạm thì Mây mất 1 Ngọn Lửa và rơi một nửa số đom đóm ra xung quanh (nhặt lại được trong 8 s), sau đó bất tử 1.5 s. Đèn còn ≥ 30 dầu tạo vùng an toàn 6 m.
- **Gió Lạc** (Đêm 2 và 3): đuổi khi Mây mang ≥ 5 đom đóm và ở trong 15 m, cướp tối đa 3 rồi bay đi. Tỏa Sáng trúng thì nó bỏ chạy, hoặc thả lại đồ đã cướp.
- **Bùa Gió:** chạy 7.2 m/s và lướt không hồi chiêu trong 10 s; bùa xuất hiện lại sau 45 s.
- **Rơi khỏi đảo:** mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh sau 1 s ở điểm xuất phát.
- **Thua:** hết 3 Ngọn Lửa (ngay lập tức), hoặc trời sáng mà số đèn sáng dưới ngưỡng.

| Điểm | |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Bóng Mực trúng Tỏa Sáng | +5 (+15 nếu nó đang hút dầu) |
| Bình minh (khi thắng): mỗi đèn đang sáng | +50 + phần nguyên của dầu |
| Bình minh (khi thắng): mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game = tổng điểm các Đêm đã thắng.

## Test Contract v1.2

`game.contract.json` nằm ở gốc repo; `tuning` lấy từ [src/core/tuning.js](src/core/tuning.js) và có test bảo đảm hai nơi trùng nhau. Ghi chú:

- `fall_enabled: true`: ngoài mép đảo hoặc ngoài cầu là biển mây. `player_hit` do rơi có `by: "fall"` và `lost`.
- Đêm 3 xuất phát tại (0,0,−30), vì (0,0,0) nằm trong tháp chuông (giả định B1).
- Trạng thái Bóng Mực: `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`. Lý do kết thúc: `dawn_survived`, `dawn`, `no_flames`. Trạng thái Gió Lạc: `idle`, `chase`, `flee`, `removed`.
- Mã thoát: `0` ok · `1` tham số dòng lệnh sai / lỗi khác · `2` file inputs/scenario sai định dạng.
- Một Đêm đầy đủ (21.600 tick) chạy trong 0.13–0.20 s ([bằng chứng](docs/proof/phase-2/RESULTS.md)).
- Giả định: [phase-2](docs/notes/phase-2.md), [phase-3](docs/notes/phase-3.md). Quyết định thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG](CHANGELOG.md#phase-3).

## Sáng tạo của tôi

Tất cả chỉ nằm trong `web/` (phần hiển thị); `src/core/` không import `web/`, nên **không thể** đổi đầu ra headless:

1. **Lời dẫn tự viết cho Ông Đăng** (ticket chỉ yêu cầu có lời của ông ở màn giới thiệu): mỗi Đêm một lời dặn gợi ý mẹo chơi, cộng một câu ở màn Bình Minh.
2. **Đom đóm bay quanh nón** Mây, đúng bằng số đang mang.
3. **Âm thanh tự tổng hợp bằng WebAudio** (không dùng file): nhạc đêm ngũ cung, chuông thắp đèn, tiếng gió.
4. **Hiệu ứng nhỏ:** Bóng Mực phồng lên khi xuất hiện, lắc khi bị choáng; Gió Lạc là dải lụa uốn lượn; đom đóm rơi nhấp nháy khi sắp tan; vòng sáng an toàn quanh đèn; trời chuyển màu hồng ở màn Bình Minh.

5. **Chế độ mù màu** (yêu cầu của Ticket-03) đi kèm vết rách giấy trên đèn tắt, nên trạng thái đèn đọc được không cần màu.

Bằng chứng phần lõi vẫn đúng: [docs/proof/phase-3/RESULTS.md](docs/proof/phase-3/RESULTS.md) (61/61) và `npm test` (78/78) chạy trên `src/core`, không phụ thuộc `web/`.

## Tài liệu và bằng chứng

| Phase | Ghi chép | Bằng chứng |
|---|---|---|
| 1 (PRD-0) | [docs/notes/phase-1.md](docs/notes/phase-1.md) | [docs/proof/phase-1/](docs/proof/phase-1/RESULTS.md) (khớp tag `phase-1`) |
| 2 (Ticket-02) | [docs/notes/phase-2.md](docs/notes/phase-2.md) | [docs/proof/phase-2/](docs/proof/phase-2/RESULTS.md) · [ảnh](docs/proof/phase-2/screens/) · [FPS](docs/proof/phase-2/fps.json) · [UI](docs/proof/phase-2/ui-smoke.txt) |
| 3 (Ticket-03) | [docs/notes/phase-3.md](docs/notes/phase-3.md) · [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md) | [docs/proof/phase-3/](docs/proof/phase-3/RESULTS.md) · [test cũ trước khi sửa](docs/proof/phase-3/old-tests-before-update.txt) · [ảnh](docs/proof/phase-3/screens/) · [UI](docs/proof/phase-3/ui-smoke.txt) · [FPS](docs/proof/phase-3/fps.json) |

- **Harness AI:**
  - [AGENTS.md](AGENTS.md) và [CLAUDE.md](CLAUDE.md).
  - Skills [verify-headless](.claude/skills/verify-headless/SKILL.md) và [verify-ui](.claude/skills/verify-ui/SKILL.md).
  - Hook Stop chặn kết thúc khi test đỏ: [.claude/settings.json](.claude/settings.json).
  - CI: [.github/workflows/ci.yml](.github/workflows/ci.yml).
- **Ghi nguồn:** [CREDITS.md](CREDITS.md). **Giấy phép:** [LICENSE](LICENSE). **Thay đổi:** [CHANGELOG.md](CHANGELOG.md).
