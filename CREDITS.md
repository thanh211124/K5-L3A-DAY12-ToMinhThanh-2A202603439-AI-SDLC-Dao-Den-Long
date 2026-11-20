# Credits

## Nội dung gốc
- **Nhân vật, bối cảnh, tên gọi** (Đảo Đèn Lồng, Mây, Bóng Mực, Đèn Lồng Lớn): bản gốc của lab Day 12 AI SDLC (PRD-0).
- **Ông Đăng, Gió Lạc, Bùa Gió, tên các đảo, bảng màu chuẩn**: từ Ticket-02 của lab. Nội dung lời thoại của Ông Đăng: tự viết.

## Thư viện
- **Three.js r160** (`three@0.160.0`), MIT License © three.js authors, https://threejs.org. Cài qua npm; bản Release đóng gói sẵn `vendor/three.module.js` kèm `THREE-LICENSE`.
- Không có thư viện runtime nào khác. Test dùng `node:test` có sẵn trong Node.js.

## Asset
- **Mô hình 3D**: tự dựng bằng hình khối Three.js trong code (`web/main.js`); không dùng file mô hình, texture hay font ngoài.
- **Âm thanh và nhạc nền**: tự tổng hợp bằng WebAudio trong code (`web/audio.js`); không dùng file âm thanh.
- **Ảnh chụp màn hình trong `docs/`**: chụp từ chính game bằng Chrome headless (`tools/shot.js`, `--screenshot`).

## Công cụ AI
- **Claude Code** (Anthropic, model Claude Opus) hỗ trợ viết code, test, công cụ kiểm chứng, tài liệu, ADR và retro trong cả 4 phase. Prompt và nhật ký nằm ở `docs/notes/phase-*.md` và `docs/retro.md`. Toàn bộ do Tô Minh Thành (2A202603439) dẫn dắt, kiểm chứng và chơi thử.
- Không có hình ảnh hay âm thanh nào do AI tạo sinh; mọi hình và âm đều sinh bằng code.
