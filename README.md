# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Tô Minh Thành · MSSV 2A202603439 · Day 12 AI SDLC Lab (K5-L3A)

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi đội nón lá, gom **đom đóm** để thắp lại **5 Đèn Lồng Lớn** của Đảo Bến và **tỏa sáng** xua **Bóng Mực** trong sương đen.

- Game chạy trên trình duyệt (Three.js / WebGL) → macOS, Linux, Windows đều được.
- Logic game là JavaScript thuần trong `src/core/`, dùng chung cho bản có giao diện và chế độ **headless** (Test Contract v1.0).
- Tài liệu gốc của lab: [docs/lab/](docs/lab/README.md).

## Cài đặt và chạy (3 lệnh)

Yêu cầu: Node.js ≥ 20 và một trình duyệt hiện đại (cần internet lần đầu để tải Three.js từ CDN).

```bash
git clone <repo-url> && cd <repo>
npm install
npm start          # rồi mở http://localhost:8080/
```

Chế độ headless và kiểm thử:

```bash
node src/headless.js --seed 1 --night 1 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
npm test           # unit + contract + 19 scenario nghiệm thu qua CLI thật
npm run proof      # sinh lại bằng chứng vào docs/proof/phase-1/
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W` `A` `S` `D` (hoặc `↑` `↓`) | Đi (theo hướng camera) |
| Kéo chuột / `←` `→` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 3 m) |
| `F` | Tỏa sáng (tốn 1 đom đóm, hồi 2 s) |
| `R` | Chơi lại · `M` tắt/bật tiếng · `Enter` bắt đầu |

## Luật chơi & cách tính điểm

- Đom đóm tự nhặt khi đi tới trong **1.5 m**; mang tối đa **10**.
- Mỗi đèn cần **5** đom đóm. Nạp từng phần được. Đứng trong **3 m** và nhấn `E`.
- **Bóng Mực** đuổi theo (3.5 m/s, Mây chạy 6 m/s). Chạm trong **1 m** → mất 1 **ngọn lửa** (máu, có 3), rơi mất **một nửa** số đom đóm đang mang (làm tròn xuống), rồi bất tử **1.5 s**.
- **Tỏa sáng**: Bóng Mực trong **6 m** bị choáng **3 s** và bị đẩy ra **4 m**.
- Bóng Mực **không vào được bán kính 5 m quanh đèn đã thắp** (đèn chưa thắp không bảo vệ).
- Ban đầu 30 đom đóm (2 giây mọc thêm 1 nếu dưới 30), 2 Bóng Mực, cứ 30 s thêm 1 con (tối đa 6).
- **Thắng**: thắp đủ 5 đèn. **Thua**: hết ngọn lửa, hoặc hết **300 s** (bình minh tới khi đảo còn tối).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi 1 lần tỏa sáng | +25 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Test Contract

`game.contract.json` ở gốc repo; mọi số trong `tuning` lấy từ [src/core/tuning.js](src/core/tuning.js) (test đảm bảo hai nơi trùng nhau). Giải thích các trường đặc biệt:

- `fall_enabled: false`: mép đảo (bán kính 40 m) là tường mềm, không rơi, nên không bao giờ có `player_hit` với `by: "fall"`.
- `dash`: chưa có ở Phase 1; trường `dash` trong inputs được chấp nhận nhưng bỏ qua.
- Trạng thái Bóng Mực: `chase` hoặc `stunned`.
- Mã thoát: `0` ok · `1` tham số dòng lệnh sai / lỗi khác · `2` file inputs/scenario sai định dạng hoặc không đọc được.
- Thứ tự xử lý trong một tick và mọi giả định khác: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Tất cả chỉ nằm trong `web/` (phần hiển thị), **không** có trong `src/core/` nên không thể đổi đầu ra headless:

1. **Đảo sáng dần**: mỗi đèn được thắp làm ánh sáng trời tăng và sương chuyển từ tím đen sang ấm.
2. **Đom đóm bay quanh nón** Mây, đúng bằng số đang mang, để người chơi nhìn là biết.
3. **Chuông WebAudio** tự tổng hợp (không dùng file âm thanh) khi nhặt, nạp, thắp đèn, tỏa sáng, bị chạm. `M` để tắt.
4. **La bàn** chỉ đèn chưa thắp gần nhất và vòng sáng an toàn hiển thị quanh đèn đã thắp.

Bằng chứng phần lõi vẫn đúng: `npm test` và [docs/proof/phase-1/RESULTS.md](docs/proof/phase-1/RESULTS.md) chạy trên `src/core` không hề import `web/`; ảnh: [docs/proof/phase-1/screens/](docs/proof/phase-1/screens/).

## Tài liệu

- Giả định, tiêu chí nghiệm thu, truy vết, đánh giá, nhật ký AI Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md)
- Bằng chứng: [docs/proof/phase-1/](docs/proof/phase-1/RESULTS.md)
- Harness AI: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), skill [.claude/skills/verify-headless](.claude/skills/verify-headless/SKILL.md), hook Stop chặn khi test đỏ [.claude/settings.json](.claude/settings.json), CI [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Ghi nguồn: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE)
