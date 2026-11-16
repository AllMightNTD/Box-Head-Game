# 🧟 BOXHEAD x BROTATO ROGUELITE: KẾ HOẠCH PHÁT TRIỂN HYBRID
*(Giữ nguyên tạo hình Boxhead kinh điển x Vòng lặp Roguelite & Game Juice phong cách Brotato)*

> **Tài liệu Kế hoạch Kỹ thuật & Thiết kế Game (Docs-as-Code)**
> Ngày cập nhật: 16/11/2026
> Phiên bản: 1.1.0
> Tác giả: Senior Software Engineer & Tech Lead

---

## 1. TỔNG QUAN & MỤC TIÊU DỰ ÁN

Dự án nâng cấp hệ thống kết hợp giữa tính biểu tượng của **Boxhead** và phong cách chiến đấu, tiến trình nâng cấp gây nghiện của **Brotato** trên [itch.io](https://itch.io/games).

### 🎯 Nguyên tắc Cốt lõi:
1. **GIỮ NGUYÊN 100% TẠO HÌNH NHÂN VẬT & QUÁI VẬT BOXHEAD:**
   - Bảo toàn toàn bộ Sprite Sheets 32x32px và hệ thống dựng hình hộp khối (Boxy 2.5D Cube) kinh điển của 4 nhân vật (**Bambo, Bon, Bingo, Bert**) cùng 3 Class (**Human, Warrior, Mage**).
   - Bảo toàn tạo hình và hành vi của toàn bộ 6 chủng loài zombie kinh điển (**Normal, Runner, Tank, Devil, Vampire, Mummy**).
   - Bảo toàn toàn bộ chiêu thức Ultimate độc quyền và tính năng phối hợp đồng đội (Cứu sống Revive `E`, đặt tường gỗ Barricade, đặt thùng nổ Barrel).
2. **NÂNG CẤP HIỆU ỨNG CHIẾN ĐẤU (GAME JUICE PHONG CÁCH BROTATO):**
   - **Floating Combat Damage Numbers:** Số sát thương nảy tưng bừng theo quỹ đạo đường cong (màu trắng = đòn thường, màu vàng cam cực lớn = chí mạng Crit, màu đỏ = người chơi bị đánh trúng, màu xanh lá = hồi phục).
   - **White Hit-Flash:** Khi zombie trúng đạn hoặc dính chiêu, toàn thân nhấp nháy sáng trắng trong 80–100ms tạo cảm giác trúng đòn cực kỳ đã tay.
   - **Screen Shake & Arcade Particles:** Rung màn hình uy lực và hiệu ứng hạt nổ rực rỡ.
3. **KINH TẾ & VẬT PHẨM RƠI (MATERIALS & NAM CHÂM HÚT HẠT):**
   - Zombie khi chết bắn ra các **Hạt ngọc xanh (Materials)**.
   - Nhân vật sở hữu bán kính nam châm (`pickupRange`) tự động hút các hạt ngọc bay về phía mình. Nhặt hạt vừa tăng EXP vừa tích lũy tiền tệ Material để mua sắm.
4. **HỆ THỐNG CỬA HÀNG GIỮA CÁC WAVE (INTER-WAVE SHOP):**
   - Hết mỗi Wave, trò chơi chuyển sang trạng thái nghỉ giữa hiệp (`roomState = 'SHOP'`).
   - Màn hình Shop xuất hiện cho 1–4 người chơi: 4 thẻ bài ngẫu nhiên (Common, Rare, Epic, Legendary), cho phép mua nâng cấp các chỉ số RPG sâu rộng (Max HP, HP Regen, Life Steal, Armor, Dodge, Damage %, Attack Speed, v.v.), cơ chế Reroll và nút "Sẵn Sàng / Ready".
5. **ĐẢM BẢO HIỆU NĂNG & ĐỘ ỔN ĐỊNH:**
   - Giữ vững 60 FPS, tối ưu hóa hạt trên canvas, đồng bộ mạng LAN mượt mà và duy trì vượt qua 100% 162 unit tests hiện có.

---

## 2. BẢN THIẾT KẾ BỘ CHỈ SỐ NHÂN VẬT (CHARACTER ATTRIBUTE SYSTEM)

### 2.1. Danh mục Chỉ số & Công thức Tính toán (RPG Stats)

| Nhóm | Tên Chỉ Số | Mã Biến | Ý Nghĩa & Công Thức Tính | Giới Hạn (Cap) |
| :--- | :--- | :--- | :--- | :--- |
| **Sinh tồn** | **Max HP** | `maxHp` | Lượng máu tối đa của nhân vật. | Không giới hạn |
| | **HP Regen** | `hpRegen` | Lượng HP tự động hồi phục sau mỗi 5 giây (`hpRegen / 5` mỗi giây). | Max 50/5s |
| | **Life Steal** | `lifeSteal` | Tỉ lệ % kích hoạt hồi 1 HP khi một viên đạn/đòn đánh trúng mục tiêu. | Max 50% |
| | **Armor** | `armor` | Giảm trừ sát thương nhận vào: $\text{Damage Reduction} = \frac{\text{Armor}}{\text{Armor} + 15} \times 100\%$ | Max 90% |
| | **Dodge** | `dodge` | Tỉ lệ % né tránh hoàn toàn 100% sát thương từ đòn đánh của quái. | **Hard Cap: 60%** |
| **Tấn công** | **Damage %** | `damageBonus` | Tăng phần trăm sát thương toàn bộ vũ khí: $\text{Dmg} = \text{Base} \times (1 + \text{damageBonus}/100)$ | Không giới hạn |
| | **Attack Speed %** | `attackSpeedBonus` | Giảm thời gian trễ giữa các phát bắn: $\text{Delay} = \frac{\text{BaseDelay}}{1 + \text{attackSpeedBonus}/100}$ | Max +200% |
| | **Crit Chance %** | `critChance` | Tỉ lệ đòn đánh phát nổ sát thương chí mạng (hiển thị số vàng cam). | Max 100% |
| | **Crit Multiplier**| `critMultiplier` | Hệ số nhân sát thương khi nổ chí mạng (Mặc định: 1.5x - 2.0x). | Max 4.0x |
| | **Range** | `rangeBonus` | Gia tăng tầm bay của đạn và bán kính nổ. | Max +100% |
| **Tiện ích** | **Move Speed** | `speed` | Tốc độ di chuyển thực tế (px/giây). | 80 - 320 px/s |
| | **Pickup Range** | `pickupRange` | Bán kính nam châm (px) tự động hút hạt Material trên mặt đất. | 80 - 450 px |
| | **Harvesting** | `harvesting` | Lượng Material thưởng thêm cuối mỗi wave, tự tăng trưởng 5%/wave. | Không giới hạn |
| | **Luck** | `luck` | Tăng tỉ lệ rơi vật phẩm hiếm từ quái và tăng tỉ lệ ra thẻ xịn trong Shop. | Không giới hạn |

---

### 2.2. Bảng Chỉ Số Khởi Đầu 3 Class & Nhân Vật Độc Quyền

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BẢNG SO SÁNH CHỈ SỐ CƠ BẢN                            │
├─────────────────────┬──────────────────┬─────────────────┬──────────────────┤
│ Chỉ số              │ 🧍 HUMAN (Đặc Nhiệm)│ 🛡️ WARRIOR (Chiến Binh)│ ⚡ MAGE (Pháp Sư)  │
├─────────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ Max HP              │ 100              │ 150 (+50%)      │ 80 (-20%)        │
│ Shield / Giáp ảo    │ 0                │ 75              │ 0 (Mana Shield)  │
│ HP Regen (mỗi 5s)   │ +1               │ +3              │ 0                │
│ Life Steal          │ 0%               │ 3%              │ 5%               │
│ Armor               │ 3 (giảm ~16.7%)  │ 8 (giảm ~34.8%) │ -2 (nhận +11%)   │
│ Dodge               │ 0%               │ -5%             │ 10%              │
│ Damage %            │ +5%              │ +15%            │ +10%             │
│ Attack Speed %      │ +10%             │ -5%             │ +15%             │
│ Crit Chance         │ 5%               │ 3%              │ 12%              │
│ Move Speed          │ 160 px/s         │ 144 px/s        │ 188 px/s         │
│ Pickup Range        │ 140 px           │ 110 px          │ 160 px           │
│ Harvesting          │ 8                │ 0               │ 4                │
│ Luck                │ +5%              │ 0%              │ +10%             │
├─────────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ Đặc tính độc quyền  │ • +20% nhặt đạn  │ • Knockback     │ • Kéo dài combo  │
│ (Class Trait)       │ • Hào quang đạn  │   Immune        │   thêm +25%      │
│                     │   vô hạn & Drone │ • -25% sát      │ • Né đòn hồi     │
│                     │                  │   thương cận    │   ngay 3% Mana   │
│                     │                  │   chiến         │ • Tốc biến đóng  │
│                     │                  │ • Đập đất 360°  │   băng kép       │
└─────────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

---

## 3. THIẾT KẾ HỆ THỐNG CỬA HÀNG INTER-WAVE SHOP & KHO VẬT PHẨM (INVENTORY)

### 3.1. Cơ chế Cửa Hàng (Shop)
1. **Kích hoạt:** Khi toàn bộ zombie trong Wave bị tiêu diệt, server chuyển `roomState = 'SHOP'`.
2. **Thời gian chờ:** Đếm ngược tối đa 45 giây. Khi tất cả người chơi còn sống bấm **"READY / SẴN SÀNG"**, Wave tiếp theo lập tức khởi tranh.
3. **Thẻ Bài (Shop Cards):** Mỗi lượt mở Shop cung cấp 4 thẻ vật phẩm/nâng cấp ngẫu nhiên được phân hạng theo độ hiếm:
   - ⚪ **Common (Trắng - 60%):** Nâng cấp chỉ số nhỏ (+3 Max HP, +1 HP Regen, +5% Dmg, +5% Atk Spd, +1 Armor). Giá: 15 - 25 Materials.
   - 🔵 **Rare (Xanh Dương - 25%):** Nâng cấp chỉ số trung bình (+8 Max HP, +2 HP Regen, +10% Dmg, +10% Speed, +3 Armor, +2% Life Steal). Giá: 35 - 50 Materials.
   - 🟣 **Epic (Tím - 12%):** Nâng cấp mạnh mẽ (+15 Max HP, +4 Armor, +5% Life Steal, +8% Dodge, +20% Dmg). Giá: 65 - 90 Materials.
   - 🔴 **Legendary (Đỏ - 3%):** Cổ vật đột biến (+30 Max HP, +15% Life Steal, Đạn nảy mục tiêu, Aura thiêu đốt quái). Giá: 120+ Materials.
4. **Reroll:** Người chơi có thể tiêu tốn một khoản tiền nhỏ (5 Materials, tăng dần mỗi lần bấm) để quay vòng 4 thẻ bài mới.

### 3.2. Cơ chế Hiển Thị Kho Vật Phẩm Của Nhân Vật (Character Inventory & Stash)
1. **Lưới Hiển Thị Vật Phẩm (Owned Items Grid):**
   - Được bố trí ngay bên dưới khu vực Shop Cards (hoặc trong thanh trạng thái nhân vật / Menu Pause `ESC`).
   - Mọi vật phẩm sau khi mua sẽ xuất hiện ngay lập tức dưới dạng Icon SVG viền màu theo phẩm chất (Trắng, Xanh, Tím, Đỏ).
2. **Cơ Chế Cộng Dồn (Item Stacking):**
   - Khi người chơi mua nhiều lần cùng 1 loại vật phẩm (ví dụ 3 Băng đạn, 2 Hộp sơ cứu), icon vật phẩm sẽ tự động gộp vào 1 ô và hiển thị huy hiệu số lượng đè lên góc phải (`x2`, `x3`...).
3. **Bảng Soi Chi Tiết (Item Tooltip / Inspector):**
   - Rê chuột (Hover) hoặc Nhấp chuột (Click) vào bất kỳ ô vật phẩm nào sẽ bật bảng thông tin: Tên, Phẩm cấp, Tổng chỉ số đã đóng góp từ stack này.
4. **Cơ Chế Tái Chế / Bán Lại (Recycle Item):**
   - Cho phép người chơi bán lại vật phẩm đã mua để lấy lại **50% giá trị Materials**, giúp linh hoạt xoay chuyển chiến thuật hoặc gom tiền mua món đồ Huyền Thoại đắt giá.

### 3.3. Danh Mục 18 Vật Phẩm Chuẩn Hóa Theo 3 Class & Bối Cảnh Săn Zombie
1. **🎖️ Nhóm Đặc Nhiệm (Dành cho Súng & Class HUMAN):**
   - `bandolier` (Băng Đạn Tác Chiến - Common): +25% Sức chứa đạn tối đa, +15% Tốc nạp đạn.
   - `hollow_bullets` (Đạn Đầu Rỗng Xuyên Phá - Rare): +15% Sát thương đạn súng, +25 Đẩy lùi quái.
   - `laser_sight` (Laser Quân Đội - Rare): Giảm 30% độ lệch đạn, +8% Tỉ lệ chí mạng tầm xa.
   - `drone_chip` (Chip AI Drone Tác Chiến - Epic): +4.0s Thời gian bay của Drone, Drone bắn nhanh hơn +25%.
2. **🛡️ Nhóm Chiến Binh (Dành cho Cận Chiến & Class WARRIOR):**
   - `spiked_gauntlet` (Găng Thiết Gai - Common): +20% Sát thương cận chiến, +35% Lực đẩy lùi quái.
   - `titan_plate` (Giáp Thép Titan - Rare): +4 Giáp, +25 Max HP, Giảm 15% sát thương bị cắn sau lưng.
   - `war_horn` (Tù Và Cuồng Nộ - Rare): +2.5s Hống Nộ (War Cry), +15% Tốc chạy khi nộ.
   - `bloodlust_axe` (Rìu Răng Cưa Khát Máu - Epic): +25% Sát thương cận chiến, +5% Hút máu (Life Steal).
3. **⚡ Nhóm Pháp Sư (Dành cho Ma Pháp & Class MAGE):**
   - `mana_crystal` (Pha Lê Cổ Ngữ Mana - Common): +30 Max Mana, +1.5 Mana hồi phục mỗi giây.
   - `frost_ring` (Nhẫn Băng Vĩnh Cửu - Rare): +1.0s Thời gian đóng băng quái, tăng làm chậm thêm +20%.
   - `fire_orb` (Trượng Lõi Thiên Thạch - Epic): +20% Sát thương phép AoE, +30px Bán kính nổ thiên thạch.
   - `arcane_scroll` (Cổ Thư Tốc Biến - Epic): -20% Hồi chiêu Blink, nhận +15% Né đòn sau khi tốc biến.
4. **☣️ Nhóm Sinh Tồn & Tác Chiến Co-op (Dùng chung cho cả 3 Class):**
   - `combat_medkit` (Hộp Sơ Cứu Dã Chiến - Common): +20 Máu tối đa, hồi ngay 25 HP khi qua wave mới.
   - `bio_serum` (Huyết Thanh Kháng Virus - Common): +3 Hồi máu / 5s, giảm 15% sát thương nhiễm độc.
   - `reinforced_wood` (Bộ Gia Cố Tường Gỗ - Rare): +150 HP cho Barricade, phản 15 sát thương khi zombie cào tường.
   - `energy_vacuum` (Máy Hút Năng Lượng - Rare): +80px Bán kính nam châm hút ngọc (Pickup), +5 Harvesting/wave.
   - `defibrillator` (Máy Sốc Tim Cứu Đồng Đội - Epic): Giảm thời gian cứu bạn (`E`) xuống 1.0s, hồi sinh bạn với 60% HP.
   - `nitro_tank` (Hỗn Hợp Nổ Nitro - Legendary): +35% Bán kính nổ & +40% Sát thương nổ lan của Thùng Nổ (Barrel).

### 3.4. Cơ Chế Phân Bổ Tỉ Lệ Độ Hiếm & Giá Vật Phẩm Theo Wave (Wave Rarity Progression)
Để đáp ứng độ khó tăng tiến qua các Wave, Shop áp dụng bảng phân bổ tỉ lệ xuất hiện thẻ bài tự động thích ứng:

```
┌─────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Giai Đoạn Wave  │ ⚪ Common    │ 🔵 Rare      │ 🟣 Epic      │ 🔴 Legendary │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Wave 1 - 3      │ 80%          │ 20%          │ 0%           │ 0%           │
│ Wave 4 - 7      │ 50%          │ 35%          │ 15%          │ 0%           │
│ Wave 8 - 11     │ 30%          │ 40%          │ 25%          │ 5%           │
│ Wave 12+ (Boss) │ 15%          │ 35%          │ 35%          │ 15%          │
└─────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```
* **Tác động của May Mắn (`player.luck`):** Mỗi +10 điểm Luck sẽ tăng thêm 3% cơ hội dịch chuyển tỉ lệ từ Common sang Epic/Legendary.
* **Cơ chế Trượt Giá Lạm Phát (Inflation Scaling):** Càng về wave sau, lượng Material rơi từ quái càng nhiều, giá cơ bản của vật phẩm tăng nhẹ theo công thức:
  $$\text{Giá Mua} = \text{Base Price} \times (1 + \text{Wave} \times 0.05)$$

### 3.5. Quy Định Giới Hạn Kho Vật Phẩm (Inventory Slots & Stack Caps)
Nhằm giữ cân bằng game và đảm bảo UI luôn ngăn nắp không bị tràn màn hình:
1. **Số Ô Vật Phẩm Độc Nhất (Unique Slots):** Tối đa **18 Ô (3 hàng x 6 cột)** tương ứng với 18 loại vật phẩm trong game.
2. **Giới Hạn Cộng Dồn Cho Từng Món (Stack Cap):**
   - ⚪ **Common:** Tối đa **x5 Stack** (Ví dụ: Tối đa 5 Hộp sơ cứu = +100 Max HP; tối đa 5 Băng đạn = +125% đạn).
   - 🔵 **Rare:** Tối đa **x3 Stack** (Ví dụ: Tối đa 3 Giáp Titan = +12 Giáp; tối đa 3 Laser = giảm 90% độ lệch đạn).
   - 🟣 **Epic:** Tối đa **x2 Stack** (Ví dụ: Tối đa 2 Chip AI Drone, 2 Rìu Khát Máu = +10% Life Steal).
   - 🔴 **Legendary:** Tối đa **x1 Bản Duy Nhất** (Cổ vật độc bản, không thể sở hữu 2 cái).
3. **Cơ chế Loại Trừ Thẻ (Pool Pruning):**
   - Khi một vật phẩm đã đạt giới hạn Stack tối đa (ví dụ đã mua đủ 3 Giáp Titan), vật phẩm đó **tự động bị loại khỏi danh sách roll của Shop** đối với người chơi đó, nhường chỗ cho các món đồ khác xuất hiện, tránh lãng phí lượt quay!

---

## 4. THIẾT KẾ BẢN ĐỒ ĐẤU TRƯỜNG MỚI: QUARANTINE ARENA (BROTATO HYBRID MAP)

### 4.1. Triết Lý Thiết Kế Bản Đồ Theo Phong Cách Brotato
Bản đồ cũ của Boxhead (The Rooms) có 4 cột đá to và các góc tường vuông 90° khiến người chơi rất dễ bị kẹt góc khi lùi bắn, đồng thời che chắn tầm đạn và kỹ năng diện rộng. Đấu trường mới **Quarantine Arena** khắc phục triệt để bằng các nguyên tắc:
1. **4 Góc Vát Chéo Chống Kẹt (Beveled Anti-Stuck Chamfers):** 4 góc của đấu trường được vát góc 45° bằng các khối chướng ngại vật bê tông vạch vàng-đen. Khi người chơi chạm tường sẽ trượt lướt mượt mà, không bao giờ bị dồn vào góc chết.
2. **Không Gian Mở 360 Độ Cho Cơ Chế Kiting:** Mặt sàn thoáng đãng dạng Bát giác / Oval giúp người chơi kéo bầy zombie thành hàng dài để xả súng (Uzi, Shotgun, Railgun) hoặc gom quái nổ chiêu (Frost Nova, Meteor Storm, Seismic Slam).
3. **Kén Tiếp Tế Dị Biến (Mutant Supply Cysts - Tương đương Cây trong Brotato):**
   - Cứ mỗi 15 - 20 giây, 1 Bọc Kén Tiếp Tế màu xanh mọc ngẫu nhiên trên đấu trường (tối đa 4 kén cùng lúc).
   - Người chơi bắn vỡ kén sẽ rơi ra **Hộp Máu Cấp Cứu** hoặc **Bọc Tiền Material Cực Lớn (+15-30 🟢)**.
4. **Vùng Chiến Thuật Đặt Barricade & Barrel (Boxhead Identity):**
   - Dù không gian mở, bản đồ vẫn bố trí các điểm thắt phễu tự nhiên để 1-4 người chơi đặt các hàng rào gỗ Barricade và Thùng Thuốc Nổ Đỏ để tạo mê cung bẫy quái.
5. **8 Điểm Xuất Hiện Quái Dồn Dập (Zombie Incursion Grates):**
   - Zombie tràn vào liên tục từ 8 cống ngầm thoát hiểm ở 4 góc và 4 cạnh, tạo nhịp độ dồn dập nghẹt thở.

*(Bản vẽ phác thảo trực quan sơ đồ mặt bằng chi tiết được lưu trữ tại [docs/arena-map-sketch.html](file:///home/dev_ntd/Documents/Box-Head-Game/docs/arena-map-sketch.html))*

---

## 5. BẢN ĐỒ KIẾN TRÚC MÃ NGUỒN (CODE MAP & TIMELINE)

### Giai đoạn 1: Hiệu Ứng Chiến Đấu Game Juice & Đồ Họa Brotato (Client)
- **Bảo toàn 100%:** Giữ nguyên hàm vẽ và sprite nhân vật (`drawBoxyPlayer`, SpriteSheetManager) cùng toàn bộ zombie Boxhead.
- `client/js/renderer.js`:
  - Tích hợp hệ thống **Floating Damage Numbers**: Hiển thị số sát thương nhảy tưng tưng theo quỹ đạo nảy lên rồi mờ dần (màu trắng = thường, màu vàng cam to bản = crit, màu đỏ = player dính đòn, màu xanh lá = hồi máu/mana).
  - Tích hợp hiệu ứng **White Hit-Flash**: Khi quái nhận sát thương, toàn thân quái nhấp nháy sáng trắng (tint white / flash overlay) trong 80–100ms tạo cảm giác va chạm lực cực mạnh.
  - Tích hợp hiệu ứng **Hạt ngọc Material phát sáng**: Render các tinh thể năng lượng màu xanh lá xoay tròn, tỏa sáng lơ lửng trên mặt sàn chờ người chơi đến hút.
  - Tối ưu hóa Object Pool cho hạt và chữ sát thương để duy trì 60 FPS mượt mà.
- `client/css/style.css`: Bổ sung font chữ đậm phong cách Comic Arcade, thanh máu bo tròn (pill-shaped) và container HUD hiện đại.

### Giai đoạn 2: Hạt Material & Cơ Chế Nam Châm Hút (Server + Client)
- `server/game/Player.js`: Bổ sung các trường thuộc tính RPG (`materials`, `pickupRange`, `hpRegen`, `lifeSteal`, `armor`, `dodge`, `damageBonus`, `attackSpeedBonus`).
- `server/game/GameRoom.js`:
  - Khởi tạo mảng `this.materials = []`.
  - Trong sự kiện `ZOMBIE_DIE`: Spawn từ 1 - 5 hạt ngọc Material tùy theo loại quái (Normal: 1, Runner: 2, Tank: 4, Devil: 5).
  - Trong vòng lặp `tick()`: Duyệt qua các hạt Material, tính khoảng cách đến player. Nếu $d \le \text{player.pickupRange}$, gia tốc hạt bay về phía player. Khi $d \le 18\text{px}$, người chơi nhận thưởng tiền/EXP và phát sự kiện `MATERIAL_COLLECTED`.

### Giai đoạn 3: Shop Logic & Giao Diện Cửa Hàng (Server + Client)
- `server/game/ShopConfig.js`: Danh mục thẻ bài nâng cấp, công thức tính giá theo wave.
- `server/game/GameRoom.js`:
  - Quản lý trạng thái chuyển đổi giữa `COMBAT` và `SHOP`.
  - Xử lý các sự kiện socket: `BUY_SHOP_ITEM`, `REROLL_SHOP`, `PLAYER_READY`.
- `client/js/ui.js` & `client/index.html`:
  - Dựng Modal Shop xuất hiện giữa các wave với thiết kế thẻ bài Brotato, bảng chỉ số nhân vật thời gian thực, nút Reroll và nút Sẵn Sàng.

### Giai đoạn 4: Kiểm Thử Toàn Diện (Testing & Quality Assurance)
- `tests/brotato_hybrid.test.js`:
  - Test rơi ngọc Material khi quái chết.
  - Test thuật toán hút nam châm và nhận tiền/EXP.
  - Test giao dịch mua sắm, trừ tiền, roll đồ trong Shop.
  - Test áp dụng chính xác các chỉ số mới (Armor giảm sát thương, Life Steal hồi máu, Crit nổ x2 damage).
  - Đảm bảo 100% 162 unit tests hiện có tiếp tục vượt qua.

---
*Tài liệu này được lưu trữ trực tiếp trong repository tại [docs/box-tato-hybrid-plan.md](file:///home/dev_ntd/Documents/Box-Head-Game/docs/box-tato-hybrid-plan.md).*

