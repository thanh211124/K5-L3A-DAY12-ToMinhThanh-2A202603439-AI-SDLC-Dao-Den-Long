# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Tô Minh Thành · MSSV 2A202603439 · Day 12 AI SDLC Lab (K5-L3A)

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi đội nón lá, gom **đom đóm** để thắp lại các **Đèn Lồng Lớn** của **ba hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), **tỏa sáng** xua **Bóng Mực** và giữ đom đóm khỏi **Gió Lạc**.

- Game chạy trên trình duyệt (Three.js / WebGL), nên chạy được trên macOS, Linux và Windows.
- Logic game là JavaScript thuần trong `src/core/`, dùng chung cho bản có giao diện và chế độ **headless** (Test Contract **v1.1**).
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
npm test           # 64 test: unit, contract v1.1, bảng màu, 44 scenario nghiệm thu qua CLI thật
npm run proof      # sinh lại bằng chứng vào docs/proof/phase-2/
node tools/ui-smoke.js ; node tools/fps-bench.js   # kiểm tra giao diện và FPS (cần npm start + Chrome)
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W` `A` `S` `D` / `↑` `↓` | Đi (theo hướng camera) |
| Kéo chuột / `←` `→` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Nạp ánh sáng vào đèn trong 2 m |
| `F` | Tỏa Sáng (tốn 3 đom đóm, bán kính 5 m, hồi 3 s) |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

## Luật chơi (số liệu chuẩn Ticket-02)

- **Ba Đêm:** Đảo Bến (5 đèn, 300 s), Đảo Cau (6 đèn, 330 s, cầu tre, bục nhảy), Đảo Chuông (7 đèn, 360 s, 3 tầng, dốc, bục, gió mạnh). Thắng Đêm 3 thì ra màn **Bình Minh**; thua thì chơi lại Đêm đó.
- **Đom đóm:** tự nhặt khi ≤ 1 m, mang tối đa 10. Mỗi đèn cần 10, nạp nhiều lần được và đèn nhớ tiến độ.
- **Bóng Mực:** đuổi khi Mây ở trong 12 m, bỏ đuổi khi xa hơn 18 m. Chạm thì Mây mất 1 Ngọn Lửa và rơi một nửa số đom đóm ra xung quanh (nhặt lại được trong 8 s), sau đó bất tử 1.5 s. Đèn đã sáng tạo vùng an toàn 6 m.
- **Gió Lạc** (Đêm 2 và 3): đuổi khi Mây mang ≥ 5 đom đóm và ở trong 15 m, cướp tối đa 3 rồi bay đi. Tỏa Sáng trúng thì nó bỏ chạy, hoặc thả lại đồ đã cướp.
- **Bùa Gió:** chạy 7.2 m/s và lướt không hồi chiêu trong 10 s; bùa xuất hiện lại sau 45 s.
- **Rơi khỏi đảo:** mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh sau 1 s ở điểm xuất phát.
- **Thua:** hết 3 Ngọn Lửa, hoặc trời sáng khi chưa thắp hết đèn.

| Điểm | |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game = tổng điểm các Đêm đã thắng.

## Test Contract v1.1

`game.contract.json` nằm ở gốc repo; `tuning` lấy từ [src/core/tuning.js](src/core/tuning.js) và có test bảo đảm hai nơi trùng nhau. Ghi chú:

- `fall_enabled: true`: ngoài mép đảo hoặc ngoài cầu là biển mây. `player_hit` do rơi có `by: "fall"` và `lost`.
- Đêm 3 xuất phát tại (0,0,−30), vì (0,0,0) nằm trong tháp chuông (giả định B1).
- Trạng thái Bóng Mực: `spawning`, `wander`, `chase`, `recoil`, `stunned`. Trạng thái Gió Lạc: `idle`, `chase`, `flee`, `removed`.
- Mã thoát: `0` ok · `1` tham số dòng lệnh sai / lỗi khác · `2` file inputs/scenario sai định dạng.
- Một Đêm đầy đủ (21.600 tick) chạy trong 0.13–0.20 s ([bằng chứng](docs/proof/phase-2/RESULTS.md)).
- Mọi giả định: [docs/notes/phase-2.md](docs/notes/phase-2.md).

## Sáng tạo của tôi

Tất cả chỉ nằm trong `web/` (phần hiển thị); `src/core/` không import `web/`, nên **không thể** đổi đầu ra headless:

1. **Lời dẫn tự viết cho Ông Đăng** (ticket chỉ yêu cầu có lời của ông ở màn giới thiệu): mỗi Đêm một lời dặn gợi ý mẹo chơi, cộng một câu ở màn Bình Minh.
2. **Đom đóm bay quanh nón** Mây, đúng bằng số đang mang.
3. **Âm thanh tự tổng hợp bằng WebAudio** (không dùng file): nhạc đêm ngũ cung, chuông thắp đèn, tiếng gió.
4. **Hiệu ứng nhỏ:** Bóng Mực phồng lên khi xuất hiện, lắc khi bị choáng; Gió Lạc là dải lụa uốn lượn; đom đóm rơi nhấp nháy khi sắp tan; vòng sáng an toàn quanh đèn; trời chuyển màu hồng ở màn Bình Minh.

Bằng chứng phần lõi vẫn đúng: [docs/proof/phase-2/RESULTS.md](docs/proof/phase-2/RESULTS.md) (47/47) và `npm test` (64/64) chạy trên `src/core`, không phụ thuộc `web/`.

## Tài liệu và bằng chứng

| Phase | Ghi chép | Bằng chứng |
|---|---|---|
| 1 (PRD-0) | [docs/notes/phase-1.md](docs/notes/phase-1.md) | [docs/proof/phase-1/](docs/proof/phase-1/RESULTS.md) (khớp tag `phase-1`) |
| 2 (Ticket-02) | [docs/notes/phase-2.md](docs/notes/phase-2.md) | [docs/proof/phase-2/](docs/proof/phase-2/RESULTS.md) · [ảnh](docs/proof/phase-2/screens/) · [FPS](docs/proof/phase-2/fps.json) · [UI](docs/proof/phase-2/ui-smoke.txt) |

- **Harness AI:**
  - [AGENTS.md](AGENTS.md) và [CLAUDE.md](CLAUDE.md).
  - Skills [verify-headless](.claude/skills/verify-headless/SKILL.md) và [verify-ui](.claude/skills/verify-ui/SKILL.md).
  - Hook Stop chặn kết thúc khi test đỏ: [.claude/settings.json](.claude/settings.json).
  - CI: [.github/workflows/ci.yml](.github/workflows/ci.yml).
- **Ghi nguồn:** [CREDITS.md](CREDITS.md). **Giấy phép:** [LICENSE](LICENSE). **Thay đổi:** [CHANGELOG.md](CHANGELOG.md).
