# ADR 0001 — Mô hình trạng thái đèn có nhiên liệu và luật "giữ đảo sáng tới bình minh"

- **Trạng thái:** Chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- **Người quyết định:** Tô Minh Thành (2A202603439), cùng Claude Code
- **Thay thế:** luật Phase 1–2 "đèn thắp xong là sáng mãi", "thắng ngay khi mọi đèn sáng", "Bóng Mực không bao giờ vào vùng an toàn"

## Bối cảnh

Đến Phase 2, đèn có 2 trạng thái `unlit → lit` và `lit` là trạng thái cuối. Game kết thúc ngay khi `litCount === total` (`all_lit`). Playtest cho thấy người chơi giỏi thắng sau khoảng 2 phút. Ticket-03 yêu cầu đèn có thể tắt lại, và mục tiêu chuyển thành giữ đủ đèn sáng tới bình minh.

## Quyết định

### 1. Đèn là máy trạng thái có nhiên liệu

```
            deposit ≥ cost(ever_lit ? 5 : 10)                 fuel ≤ 0 (bước 2b)
  UNLIT ─────────────────────────────────────▶ LIT(fuel) ───────────────────────▶ UNLIT (ever_lit = true,
  (deposited k)                                │  ▲                                        deposited = 0)
                                               │  │ refuel: +10 × used, tối đa 100
                                               ▼  │
                                         LIT, fuel < 30  ──▶ mất vùng an toàn, thành mục tiêu của drain
```

- Trường dữ liệu của đèn: `lit`, `deposited`, `fuel`, `everLit`, `relit`.
- **`fuel` lưu bằng số nguyên đơn vị 1/60** (100 = 6000). Hao 1 đơn vị/tick, mỗi Bóng Mực đang hút trừ 5 đơn vị/tick, châm dầu cộng 600 đơn vị cho mỗi đom đóm. Nhờ vậy không có sai số số thực (lỗi kiểu 14.000000000000002 từng làm hỏng bục nhảy ở Phase 2). Chỉ khi xuất ra mới làm tròn 1 chữ số; điểm bình minh dùng `floor(fuel / 60)`.
- Vùng an toàn là một **hàm** `hasZone(l) = l.lit && l.fuel ≥ 30·60`, không còn là thuộc tính cố định của "đèn sáng". Mọi chỗ trước đây dùng `l.lit` để chặn Bóng Mực, để chọn điểm sinh, hay để vẽ vòng sáng đều chuyển sang dùng `hasZone`.
- Tương tác thống nhất: chọn đèn "nhận được" gần nhất (chưa sáng, hoặc sáng nhưng chưa đầy), bằng nhau thì id nhỏ hơn. Nếu đèn chưa sáng thì nạp, nếu đang sáng thì châm dầu. Châm dầu từ dưới 30 lên ≥ 30 được xử lý **giống hệt lúc vừa thắp**: đẩy Bóng Mực ra mép trong 30 tick, không gây sát thương. Nhờ vậy dùng lại được code đẩy ra của Phase 2.

### 2. Thứ tự trong tick

Bước **2b** được chèn ngay sau phần đếm thời gian: hao dầu, rồi hút dầu (theo id tăng dần, phát `fuel_drain` mỗi 60 tick hút), rồi tắt các đèn có fuel ≤ 0 (`lantern_out`). Như vậy mọi bước sau trong cùng tick (tương tác, vùng an toàn, Bóng Mực, xét thắng) thấy trạng thái đèn đã cập nhật.

### 3. Bóng Mực thêm trạng thái `drain`

- `wander` → tìm đèn sáng yếu gần nhất; nếu không có thì đèn tắt gần nhất; nếu không có nữa thì đi lang thang ngẫu nhiên. Tới trong 2 m của một đèn yếu thì chuyển `drain`.
- Thoát `drain`: Mây trong 6 m → `chase` (không dùng ngưỡng 12 m); đèn tắt, dầu ≥ 30, hoặc cách > 2 m → `wander`; trúng Tỏa Sáng → `stunned` (+15 điểm thay vì +5). Bóng Mực đang `drain` không gây sát thương.
- Bóng Mực ghi lại `target` (đèn đang hút) và `drainTicks`. Scenario có thể đặt `target_lantern_id`.

### 4. Luật thắng chỉ xét ở bình minh

Bước 11 xét theo thứ tự: `flames ≤ 0` → `no_flames` (luôn thắng thế, kể cả ở tick cuối); `simTick ≥ endTick` → `litCount ≥ ceil(0.6 × n)` thì `dawn_survived`, ngược lại `dawn`. Không còn nhánh `all_lit`. Thưởng khi thắng: mỗi đèn đang sáng `50 + floor(fuel)`, mỗi Ngọn Lửa 50. Thưởng thời gian bị bỏ (`per_second_left: 0`).

### 5. Sức chứa là giá trị suy ra

`capacity = min(20, 10 + 2 × successfulLights)`, trong đó `successfulLights` tăng ở mỗi lần thắp hoặc thắp lại thành công (đèn đặt sẵn bằng scenario không tính). Giá trị này được tính lại, không lưu riêng, để không bao giờ lệch.

## Các phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Lưu `fuel` bằng số thực | Sai số tích lũy sau hàng nghìn tick; test so `fuel === 99.9` và thời điểm `lantern_out` chính xác sẽ dễ vỡ |
| Thêm trạng thái `weak` riêng cho đèn | Trùng lặp thông tin với `fuel`; ticket đặt ngưỡng theo số (đúng 30 vẫn còn vùng), nên một hàm suy ra là đủ |
| Hút dầu trong bước di chuyển Bóng Mực (bước 8) | Ticket yêu cầu trừ dầu ở bước 2 |
| Giữ `all_lit` như một điều kiện thắng phụ | Ticket nói rõ "thắp đủ đèn không kết thúc Đêm" |

## Hệ quả

- **Phá vỡ tương thích** (xem [CHANGELOG](../../CHANGELOG.md#phase-3)): mục tiêu thắng, thời lượng Đêm, điểm, snapshot và tên lý do kết thúc.
- 2 test cũ bị xoá và 7 test được sửa, có ghi lý do ở [phase-3 notes §3](../notes/phase-3.md). Danh sách test đỏ ngay sau khi đổi luật (trước khi sửa test) được lưu ở [old-tests-before-update.txt](../proof/phase-3/old-tests-before-update.txt).
- Bản giao diện chỉ đọc `fuel`, `hasZone`, `capacity` và `winThreshold` từ `Sim`, không tự tính lại luật.
