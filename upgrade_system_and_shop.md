# Kế hoạch hệ thống nâng cấp và cửa hàng – Box Head Co-op

*Bản tổng hợp v1.0 · 19/11/2026 · Phòng co-op tối đa 4 người, 3 lớp nhân vật*

## 1. Tổng quan

**Bối cảnh.** Game bắn zombie góc nhìn trên xuống, chơi theo wave, có Combo Streak, 8 vũ khí mở khóa theo số kill (x5 đến x50), Drone & Hào quang đạn và đèn pin. Phòng tối đa 4 người, 3 lớp nhân vật (Human, Warrior, Mage) và nhiều bản đồ (ví dụ Băng Đảo Bắc Cực).

**Mục tiêu**

- Người chơi cảm thấy mạnh dần sau mỗi wave.
- Mỗi lần mở cửa hàng là một quyết định: mua nhỏ liên tục hay để dành món lớn.
- Mỗi lớp có bản sắc riêng, cả đội có synergy.
- Có tiến trình dài hạn (meta) giữ người chơi giữa các lượt.

**Nguyên tắc thiết kế**

1. Bám vào cơ chế đã có: combo, kill-count, drone, đèn pin.
2. Dữ liệu dạng config; chỉ số được tính từ cấp nâng cấp, không cộng thẳng vào chỉ số gốc.
3. Server giữ coin và cấp nâng cấp, client chỉ gửi yêu cầu mua.
4. Luôn hiển thị “trước → sau” và giá trước khi mua.
5. Có cấp tối đa và giới hạn mua mỗi wave để tránh quá mạnh.

## 2. Vòng lặp sau mỗi wave

State machine: `COMBAT → WAVE_CLEAR → RESULT → SHOP → COUNTDOWN → COMBAT`.

| Thời gian | Giai đoạn | Diễn biến |
| --- | --- | --- |
| 0 – 1.5s | Wave Clear | Zombie cuối chết, slow-motion 0.5s, camera zoom nhẹ. Banner “WAVE X HOÀN THÀNH” trượt xuống. Coin còn trên sàn bay về người chơi. |
| 1.5 – 5s | Bảng kết quả | Đếm số tăng dần kèm tiếng tick: Kill, Combo cao nhất, thưởng Clear, không bị đánh, thời gian, tổng coin, MVP. Space để bỏ qua. |
| 5 – 35s | Cửa hàng | Màn hình tối đi, overlay cửa hàng mở, đếm ngược 30s, hồi 25% máu tự động. Nút **Sẵn sàng** để vào wave sớm. |
| 3s | Đếm ngược | Cửa hàng đóng, “3, 2, 1”, banner “WAVE X+1 – ZOMBIE: N”. |

**Đồng bộ nhiều người:** một bộ đếm chung do server quản lý. Mỗi người bấm Sẵn sàng; khi tất cả sẵn sàng thì vào wave sớm. Người đã chết được hồi sinh đầu wave với 50% HP (hoặc dùng Bộ hồi sinh, xem mục 5.8).

## 3. Kinh tế

**Coin mỗi kill:** thường 3, nhanh 5, tank 10, boss 100. Nhân hệ số combo `1 + 0.1 × (combo − 1)`, tối đa ×3.

**Thưởng cuối wave**

- Clear: `20 + 5 × wave`
- Không bị đánh: +25
- Nhanh hơn thời gian chuẩn: tối đa +30
- Combo cao nhất: ×2 (giá trị combo)

**Thu nhập ước tính (1 người, cần chỉnh khi playtest)**

| Wave | Số zombie | Coin ước tính |
| --- | --- | --- |
| 1 | 20 | \~100 |
| 3 | 30 | \~150 |
| 5 | 40 | \~210 |
| 10 | 65 | \~330 |

**Giá nâng cấp:** `cost = floor(baseCost × 1.5^cấp)`. Vật phẩm dùng một lần có giá cố định và giới hạn mua mỗi wave.

**Quy tắc multiplayer**

- Coin thuộc người hạ gục; assist chia 30% cho người ở gần.
- Người đang thua coin nhận thưởng bù +10%.
- Số zombie: `n × (1 + 0.6 × (số người − 1))`.

**Gem (tiền hiếm):** rơi từ boss và mốc wave 5, 10, 15; dùng cho nâng cấp vĩnh viễn (mục 7).

## 4. Giao diện cửa hàng

Cửa hàng là overlay phủ màn hình, nhanh hơn việc đi bộ tới NPC. Khi ổn định có thể nâng thành thùng tiếp tế thả giữa map.

```
┌────────────────────────────────────────────────────────────┐
│ CỬA HÀNG – WAVE 1 xong        💰 240      ⏱ 24s            │
├────────────────────────────────────────────────────────────┤
│ [Lớp: HUMAN] [Chung] [Ult] [Đồng đội] [Vật phẩm] [Chợ đen] [Bản đồ] │
├───────────────────────────────┬────────────────────────────┤
│ ▣ Sát thương Pistol  Lv2/8    │  XEM TRƯỚC                 │
│ ▣ Tốc độ bắn        Lv0/8     │  Sát thương: 10 → 13       │
│ ▣ Băng đạn          Lv1/8     │  ▓▓▓▓▓▓░░░░ → ▓▓▓▓▓▓▓░░░   │
│ ▣ Mod đặc biệt      🔒 Lv3    │  Giá: 75 💰  [MUA – Enter] │
├───────────────────────────────┴────────────────────────────┤
│ Đội: P1 Hero_1 (Đang mua) · P2 (Sẵn sàng) · P3 · P4         │
│                   [ SẴN SÀNG – Space ]                      │
└────────────────────────────────────────────────────────────┘
```

- **Tab Lớp** tự đổi theo nhân vật (Human: súng và tiện ích; Warrior: kiếm và khiên; Mage: mana và phép). Người chơi không thấy đồ không dùng được.
- **Tab Chung:** món mọi lớp đều mua được.
- **Tab Ult:** cùng khung, nội dung riêng cho từng lớp.
- **Tab Đồng đội:** quỹ đội, chuyển coin, hỗ trợ, hồi sinh.
- **Tab Bản đồ:** chỉ hiện món theo bản đồ đang chơi.
- Điều khiển: chuột hoặc phím (mũi tên, Enter, phím 1–7 chuyển tab, Space = Sẵn sàng).
- Mỗi ô hiển thị cấp hiện tại, giá và bảng so sánh “trước → sau”. Súng đang khóa theo kill vẫn hiện mờ như UI hiện tại.
- Cột đội luôn hiển thị avatar, coin và trạng thái (Đang mua, Sẵn sàng) của đồng đội.

## 5. Danh mục vật phẩm

Cấp tối đa mặc định là 8 nếu không ghi khác.

### 5.1 Tab Chung (mọi lớp)

| Vật phẩm | Mỗi cấp | Tối đa | Giá gốc | Mở từ |
| --- | --- | --- | --- | --- |
| Máu tối đa | +10 HP | 10 | 50 | Wave 1 |
| Tốc độ chạy | +6% | 5 | 80 | Wave 1 |
| Kháng sát thương | −4% sát thương nhận | 8 | 90 | Wave 2 |
| Tự hồi máu | +0.5 HP/s sau 5s không bị đánh | 5 | 100 | Wave 2 |
| Nam châm coin | +20% tầm hút | 5 | 40 | Wave 1 |
| Lướt (Dash) | Mua đầu mở khóa; mỗi cấp sau −0.5s hồi chiêu (Mage dùng Blink) | 6 | 150 | Wave 3 |
| Đèn pin: tầm chiếu | +10% | 5 | 60 | Wave 1 |
| Đèn pin: góc chiếu | +8° | 4 | 60 | Wave 1 |

### 5.2 Human (cân bằng, nạp đạn nhanh, súng 1–8)

**Nâng cấp từng súng** (4 chỉ số, tối đa 8 cấp): Sát thương +12%, Tốc độ bắn +8%, Băng đạn +15%, Nạp đạn −8% thời gian. Giá gốc `60 × hệ số súng`: Pistol ×1, Uzi ×1.3, Shotgun ×1.5, Rocket ×2.2, Railgun ×3.

| Vật phẩm | Mỗi cấp | Tối đa | Giá gốc |
| --- | --- | --- | --- |
| Túi đạn dự trữ | +20% đạn mang theo | 5 | 70 |
| Đổi súng nhanh | −10% thời gian rút súng | 5 | 50 |
| Xạ thủ tầm xa | +6% sát thương mục tiêu ở xa | 5 | 90 |
| Mở sớm súng bằng coin | Thay cho kill-count, giá ×2 | 1 | theo súng |
| Tường gỗ: độ bền | +25% | 5 | 70 |
| Thùng nổ: sát thương và bán kính | +15% | 5 | 90 |
| Lựu đạn: bán kính | +10% | 5 | 90 |

### 5.3 Warrior (150 HP, 75 giáp, kiếm và khiên 1–8)

Warrior được thưởng khi đứng gần zombie: hút máu, phản đòn, giáp.

| Vật phẩm | Mỗi cấp | Tối đa | Giá gốc |
| --- | --- | --- | --- |
| Sát thương kiếm | +12% | 8 | 60 |
| Tốc độ chém | +8% | 8 | 70 |
| Tầm chém / góc quét | +6% | 6 | 80 |
| Giáp tối đa | +10 giáp | 8 | 70 |
| Tái tạo giáp | +2 giáp/s sau 4s không bị đánh | 5 | 100 |
| Hút máu | +2% sát thương gây ra thành HP | 6 | 110 |
| Độ bền khiên | +15% giảm sát thương khi đỡ | 6 | 90 |
| Đỡ đòn chuẩn (parry) | +0.05s cửa sổ phản đòn | 4 | 120 |
| Giáp gai | Phản 10% sát thương cận chiến | 5 | 100 |
| Khiêu khích | Mua 1 lần: zombie quanh bạn đổi mục tiêu sang bạn 3s (hồi 20s) | 1 | 250 |

### 5.4 Mage (85 HP, 100 Mana +5/s, phép 1–8)

Mỏng máu, sát thương lớn: cửa hàng xoay quanh mana và khả năng sống sót.

| Vật phẩm | Mỗi cấp | Tối đa | Giá gốc |
| --- | --- | --- | --- |
| Mana tối đa | +10 | 10 | 50 |
| Hồi mana | +0.5/s | 8 | 80 |
| Tiết kiệm mana | −5% tiêu hao | 6 | 90 |
| Mana khi kill | +2 mana mỗi kill | 5 | 70 |
| Sát thương phép | +12% | 8 | 60 |
| Hồi chiêu phép | −6% | 8 | 80 |
| Bán kính phép (AoE) | +8% | 6 | 80 |
| Khiên mana | Mua 1 lần: 30% sát thương nhận trừ vào mana trước | 1 | 250 |
| Khiên mana: hiệu quả | +5% mỗi cấp | 4 | 100 |
| Dịch chuyển (Blink) | Thay Dash, mỗi cấp −0.5s hồi chiêu | 6 | 150 |

### 5.5 Tab Ult

Chung cho mọi lớp:

| Vật phẩm | Mỗi cấp | Tối đa | Giá gốc |
| --- | --- | --- | --- |
| Nạp Ult nhanh | +10% tốc độ nạp | 6 | 120 |
| Khởi đầu wave có sẵn Ult | +10% thanh Ult | 5 | 100 |

Riêng từng lớp:

| Lớp và Ult | Nâng cấp | Mỗi cấp |
| --- | --- | --- |
| Human – Drone & Đạn Vô Hạn (8s) | Thời lượng | +1s (tối đa 13s) |
|  | Sát thương drone | +15% |
| Warrior – Hóa Thân Chiến Thần | Thời lượng | +1.5s |
|  | Kích thước và sát thương Avatar | +8% |
| Mage – Thiên Thạch Hủy Diệt | Sát thương thiên thạch | +12% |
|  | Bán kính nổ | +8% |

### 5.6 Mod đặc biệt (chọn 1 trong 2)

**Mod súng và vũ khí:** mở khi 4 chỉ số của vũ khí đạt tổng 6 cấp, giá 300–600.

| Vũ khí | Mod A | Mod B |
| --- | --- | --- |
| Pistol | Đạn xuyên 1 zombie | Chí mạng 15% (x2 sát thương) |
| Uzi | Đạn cháy (đốt 3s) | Đạn làm chậm (−30% trong 2s) |
| Shotgun | Đẩy lùi mạnh | +2 viên đạn, chùm hẹp hơn |
| Rocket | Nổ lan +30% bán kính | Nổ chùm (tách 3 mảnh) |
| Railgun | Xuyên vô hạn | Bắn liên tiếp 2 phát |
| Kiếm (Warrior) | Sóng chém bay xa | Kiếm lửa đốt 3s |
| Khiên (Warrior) | Đập khiên gây choáng | Khiên băng làm chậm |
| Phép (Mage) | Mod theo nhóm phép (lửa, băng, sét…) – chờ tên 8 phép |  |

**Mod Ult:** mở khi nâng đủ 5 cấp Ult, giá 500.

- Human: thêm drone thứ 2, hoặc đạn xuyên trong lúc Ult.
- Warrior: Avatar hồi 3% HP mỗi cú chém, hoặc giậm đất gây choáng.
- Mage: thiên thạch tăng từ 5 lên 8, hoặc để lại vùng cháy 5s.

### 5.7 Vật phẩm dùng một lần

| Vật phẩm | Dành cho | Tác dụng | Giá | Tối đa/wave |
| --- | --- | --- | --- | --- |
| Bình máu nhỏ | Mọi lớp | +30 HP | 30 | 3 |
| Hồi đầy máu | Mọi lớp | Đầy HP ngay | 80 | 1 |
| Giáp tạm thời | Mọi lớp | +50 khiên trong 1 wave | 60 | 1 |
| Adrenaline | Mọi lớp | +30% tốc độ bắn/chém/niệm 30s | 70 | 2 |
| Thẻ nạp Ult | Mọi lớp | +25% thanh Ult | 90 | 2 |
| Không kích | Mọi lớp | Quét sạch zombie trong màn hình (từ wave 5) | 250 | 1 |
| Hộp đạn | Human | Nạp đầy mọi súng | 40 | 2 |
| Gói lựu đạn / thùng nổ | Human | +3 lựu đạn hoặc +2 thùng nổ | 50 | 2 |
| Đạn xuyên giáp | Human | +30% sát thương 1 wave | 60 | 1 |
| Đá mài | Warrior | +25% sát thương kiếm 1 wave | 60 | 1 |
| Giáp bổ sung | Warrior | +50 giáp ngay | 45 | 2 |
| Bình mana | Mage | +50 mana | 35 | 3 |
| Bình mana lớn | Mage | Đầy mana, hồi mana x2 trong 20s | 70 | 1 |

### 5.8 Tab Đồng đội

**Quỹ đội:** mỗi người góp coin vào quỹ chung để mua đồ cả đội dùng, giúp người ít coin vẫn có đồ mạnh.

| Vật phẩm | Tác dụng | Giá |
| --- | --- | --- |
| Tháp pháo tự động | Đặt 1 tháp, nâng 3 cấp | 300 / 450 / 700 |
| Trạm tiếp tế | Mỗi wave hồi đạn, mana và 20% HP cho người đứng gần | 250 |
| Hào quang hồi máu | Đồng đội trong 5m hồi 0.5 HP/s | 200 |
| Radar | Ping boss và zombie đặc biệt cho cả đội | 100 |
| Giáp đội | +5% giảm sát thương cho cả đội | 180 |

**Hỗ trợ cá nhân (mua riêng, tác dụng lên đồng đội)**

- Human – Hộp đạn chia sẻ: khi nạp đạn, đồng đội gần được nạp 25%.
- Warrior – Tiếng thét chiến binh: khi khiêu khích, đồng đội gần +20% giáp trong 5s.
- Mage – Truyền mana: Ult hồi 30 mana cho đồng đội.

**Hồi sinh**

- Chết thì chuyển sang quan sát. Đồng đội giữ **E 3 giây** để cứu (nếu chọn cho cứu ngay trong trận), hoặc tự hồi sinh đầu wave sau với 50% HP.
- Hồi sinh nhanh: −0.5s mỗi cấp, tối đa 4 cấp, giá gốc 120.
- Bộ hồi sinh (80 coin): dùng trong cửa hàng để hồi sinh ngay đồng đội đã chết.

**Chuyển coin:** nút tặng 10 / 50 coin, kèm ping “Cần coin” để xin nhau.

### 5.9 Chợ đen (perk ngẫu nhiên)

- Mỗi lần mở cửa hàng có 3 ô perk ngẫu nhiên, trong đó ưu tiên 1 ô theo lớp của người chơi.
- Làm mới tốn 30 coin và tăng dần. Mốc wave 5, 10, 15 được 1 lượt chọn miễn phí.
- Độ hiếm: Thường (xám), Hiếm (xanh), Sử thi (tím), Huyền thoại (vàng).

| Perk | Phạm vi | Tác dụng |
| --- | --- | --- |
| Khát máu | Chung | Mỗi 10 kill hồi 5 HP |
| Chuỗi nổ | Chung | Kill khi combo ≥ x5 thì zombie nổ nhỏ |
| Liều lĩnh | Chung | Dưới 30% HP, nạp đạn nhanh gấp đôi |
| Nhà giàu | Chung | +20% coin nhưng −10% HP tối đa |
| Anh hùng đồng đội | Chung | Khi đồng đội bị hạ, +30% sát thương 10s |
| Bầy sói | Human | Drone bắn kèm 1 viên đạn thường |
| Đạn dội | Human | Viên cuối băng đạn gây x2 sát thương |
| Cuồng nộ | Warrior | Mỗi 5 kill liên tiếp, kiếm nhanh hơn 20% trong 5s |
| Dòng chảy | Mage | Không dùng phép 3s thì hồi 10 mana |

### 5.10 Tab Bản đồ (ví dụ Băng Đảo Bắc Cực)

Chỉ làm khi bản đồ có cơ chế riêng (lạnh, trơn trượt).

| Vật phẩm | Tác dụng | Giá |
| --- | --- | --- |
| Giày đinh | Giảm trơn trượt trên băng, +5% tốc độ chạy | 80 |
| Áo lông | Giảm sát thương hoặc debuff do lạnh | 100 |
| Lò sưởi | Đặt 1 lò hồi máu và mana cho người đứng gần | 150 |
| Đạn xuyên băng | Bắn vỡ khối băng của zombie bị làm chậm gây thêm sát thương | 120 |

## 6. Hiệu ứng

**Khi mua hàng**

- Nút mua nhấp nháy và nảy nhẹ (scale 1 → 1.15 → 1); biểu tượng coin bay từ ô vật phẩm lên bộ đếm, con số chạy giảm dần.
- Âm “ka-ching” có cao độ tăng theo cấp (Lv1 trầm, Lv8 cao).
- Thanh chỉ số chạy mượt từ giá trị cũ sang mới; hạt quanh ô đổi màu theo độ hiếm.
- Đạt cấp tối đa: viền vàng, nhãn “MAX” có vệt sáng quét qua.
- Không đủ tiền: nút rung ngang, viền đỏ, tiếng “bụp” trầm, không dùng popup.

**Nhân vật mạnh lên (trong trận)**

- Vòng sáng dưới chân đổi màu theo tổng số cấp: xanh lá, xanh dương, tím, vàng. Vòng này cũng phân biệt người chơi trong co-op.
- Máu tối đa: thanh HP dài ra, nháy xanh lá một lần.
- Tốc độ: vệt mờ (afterimage) và bụi nhỏ khi chạy.
- Giáp và khiên: vòng lục giác nháy khi nhận sát thương, vỡ khi hết.
- Đèn pin: hình nón sáng nở rộng bằng tween 0.5s.
- Súng: tia lửa nòng và đạn đổi màu theo cấp (trắng → vàng → cam → đỏ). Mod hiện rõ: đạn cháy có đuôi lửa, đạn làm chậm có đuôi xanh và zombie phủ băng, đạn xuyên để lại vệt sáng dài.
- Drone thứ 2 xuất hiện bằng hiệu ứng bật lên (flash trắng, scale từ 0).

**Khi hạ zombie**

- Zombie chết văng 1–3 coin, nảy lên rồi nằm sàn, sau 1s tự bay về người chơi (nam châm).
- Chữ “+3” vàng nổi lên, to hơn khi combo cao; bộ đếm coin trên HUD nảy mỗi lần nhận.

## 7. Nâng cấp vĩnh viễn (meta, giai đoạn sau)

Dùng Gem, giữ sau khi chết, lưu theo tài khoản trên server.

| Nâng cấp | Hiệu ứng | Tối đa |
| --- | --- | --- |
| Vốn khởi đầu | +20 coin đầu lượt mỗi cấp | 5 |
| Thể trạng | +5 HP khởi đầu mỗi cấp | 5 |
| Chọn perk khởi đầu | Chọn 1 trong 3 perk ở wave 1 | 1 |
| Nhà sưu tầm | Mở skin, vòng sáng, hiệu ứng nòng súng | – |

Giới hạn tổng sức mạnh từ meta ở khoảng +10% để người mới vẫn chơi cùng được với người cũ.

## 8. Cấu trúc dữ liệu và code

Tách hai nhóm dữ liệu: `run` (coin, cấp trong lượt chơi, xóa khi kết thúc) và `meta` (gem, nâng cấp vĩnh viễn). Chỉ số luôn tính từ cấp.

```js
const STATE = { COMBAT: 0, WAVE_CLEAR: 1, RESULT: 2, SHOP: 3, COUNTDOWN: 4 };

const SHOP_ITEMS = {
  maxHp: {
    tab: 'common', name: 'Máu tối đa', baseCost: 50, maxLevel: 10,
    stat: lv => 100 + lv * 10,
    onBuy: p => p.recalcStats(),
  },
  swordDmg: {
    tab: 'class', classes: ['warrior'],
    name: 'Sát thương kiếm', baseCost: 60, maxLevel: 8,
    stat: lv => 1 + lv * 0.12,
  },
  manaShield: {
    tab: 'class', classes: ['mage'],
    name: 'Khiên mana', baseCost: 250, maxLevel: 1,
    onBuy: p => { p.flags.manaShield = true; },
  },
  teamTurret: {
    tab: 'team', scope: 'team',          // trừ từ quỹ đội
    name: 'Tháp pháo tự động', costs: [300, 450, 700], maxLevel: 3,
    onBuy: (room, lv) => room.spawnTurret(lv),
  },
  frostBoots: {
    tab: 'map', maps: ['frostbite'],
    name: 'Giày đinh', baseCost: 80, maxLevel: 1,
  },
};

const costOf = (item, lv) =>
  item.costs ? item.costs[lv]
  : item.fixedPrice ? item.baseCost
  : Math.floor(item.baseCost * Math.pow(1.5, lv));

// Lọc món hiển thị theo lớp và bản đồ
const visibleItems = (player, map) =>
  Object.entries(SHOP_ITEMS).filter(([, it]) =>
    (!it.classes || it.classes.includes(player.class)) &&
    (!it.maps || it.maps.includes(map.id)));

// Server xác thực; client chỉ gửi { itemId }
function tryBuy(room, player, id) {
  const item = SHOP_ITEMS[id], lv = player.run.levels[id] ?? 0;
  if (!item || lv >= item.maxLevel) return { ok: false, reason: 'max' };
  const price = costOf(item, lv);
  const wallet = item.scope === 'team' ? room.fund : player.run;
  if (wallet.coins < price) return { ok: false, reason: 'coins' };
  wallet.coins -= price;
  player.run.levels[id] = lv + 1;
  item.onBuy?.(item.scope === 'team' ? room : player, lv + 1);
  return { ok: true, level: lv + 1 };
}
```

## 9. Lộ trình triển khai

| Giai đoạn | Nội dung | Hoàn thành khi |
| --- | --- | --- |
| P0 – Nền tảng | State machine, bộ đếm chung do server quản lý, xác thực mua, coin rơi, nam châm, HUD coin | Chơi hết 1 wave và quay lại wave sau không lỗi |
| P1 – MVP | Bảng kết quả, overlay cửa hàng, tab Chung, 4–5 món mỗi lớp, vật phẩm dùng một lần cơ bản | Cả 3 lớp mua được và thấy chỉ số đổi |
| P2 – Đầy đủ lớp | Toàn bộ tab Lớp, tab Ult, tiện ích Human, bảng trước → sau | Mỗi lớp có ít nhất 10 món có ý nghĩa |
| P3 – Co-op | Quỹ đội, chuyển coin, hồi sinh, cột trạng thái đồng đội, MVP | 4 người chơi đủ một buổi không desync |
| P4 – Chiều sâu | Mod súng và Ult, Chợ đen, perk theo lớp | Có ít nhất 2 build khác nhau cho mỗi lớp |
| P5 – Hoàn thiện | Tab Bản đồ, toàn bộ VFX và âm thanh, slow-motion | Cảm giác mua hàng và mạnh lên rõ ràng |
| P6 – Meta | Gem, nâng cấp vĩnh viễn, skin, cân bằng lần cuối | Số liệu cân bằng đạt ngưỡng mục 10 |

## 10. Cân bằng và đo lường

Log các chỉ số sau cho mỗi lượt chơi để chỉnh giá và thu nhập:

- Tỉ lệ người mua từng món (món không ai mua thì quá yếu hoặc quá đắt, món ai cũng mua thì quá mạnh).
- Coin dư khi bắt đầu wave mới (nên dưới 30% thu nhập wave trước).
- Thời gian trung bình trong cửa hàng (mục tiêu 15–25s trên 30s).
- Tỉ lệ chết theo wave và theo lớp.
- Chênh lệch sát thương và coin giữa các lớp trong cùng đội.

**Rủi ro chính**

- Một lớp quá mạnh: chỉnh hệ số giá hoặc giá trị mỗi cấp trong config, không sửa logic.
- Người chơi dồn coin: giới hạn mua mỗi wave và để các món lớn mở theo wave.
- Lệch nhau trong co-op: thưởng bù, quỹ đội và chuyển coin.
- Gian lận: server là nguồn sự thật cho coin và cấp nâng cấp.

## 11. Câu hỏi còn mở

1. **Tên 8 phép của Mage và 8 vũ khí/kỹ năng của Warrior** để viết mod đặc biệt cụ thể thay cho mô tả chung.
2. **Hồi sinh:** chờ đầu wave sau hay có thể cứu ngay trong trận? Quyết định giá và vai trò của Bộ hồi sinh.
3. **Bản đồ:** ngoài Băng Đảo Bắc Cực còn bản đồ nào có cơ chế riêng để làm tab Bản đồ?
4. **Kiến trúc mạng:** server hiện có đang giữ trạng thái game (authoritative) hay chỉ relay? Ảnh hưởng tới cách xác thực mua hàng ở P0.
5. Đèn pin, Dash và Kháng sát thương có áp dụng cho cả 3 lớp không, hay có lớp bị loại trừ?
