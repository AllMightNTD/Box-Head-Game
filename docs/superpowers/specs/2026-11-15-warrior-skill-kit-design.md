# Thiết Kế Bộ Chiêu Thức Cận Chiến Warrior v2 (Stance & ARPG Skill Kit 1–8)

**Ngày:** 2026-11-15  
**Trạng thái:** Đã cập nhật theo phản hồi review & hoàn tất rà soát kỹ thuật

---

## 1. Mục đích & Bối cảnh (Intent & Why)

Trong **Boxhead: 2Play LAN**, hệ `WARRIOR` (150 HP, giảm 25% sát thương cận chiến, kháng đẩy lùi) hiện đang dùng chung bộ 8 khẩu súng với `HUMAN` và `MAGE`. Bản thiết kế này thay thế toàn bộ bộ vũ khí `1 -> 8` của riêng `WARRIOR` bằng **Hệ thống Thế Kiếm Động (Stance System)** và **Bộ Kỹ Năng ARPG Tương Tác Cao**, tập trung vào 3 trụ cột:

1. **Cự ly gần & Áp sát (Close Quarters):** Lướt xuyên đội hình (`Shadow Dash & Slash`), kéo gom quái và xoay kiếm dọn đám đông.
2. **Kiểm soát đám đông (Crowd Control - CC):** Sóng xung kích đẩy lùi, làm chậm, địa chấn 3 tầng tạo khe nứt cản đường, khiêu khích kèm hoảng sợ (Taunt + Fear), và phản đòn choáng.
3. **Chống chịu & Đỡ đòn chủ động (Tank, Armor & Parry):** Bổ sung **Thanh Giáp Phụ (`maxArmor = 75`)**, giảm sát thương trực diện ở Thế Phá Giáp, hồi giáp qua `War Cry`, và cơ chế Parry hấp thụ 100% sát thương để phản công.

---

## 2. Mục tiêu, Phi mục tiêu & Ràng buộc (Goals, Non-Goals & Constraints)

### Mục tiêu (Goals)
- **Giữ nguyên mốc mở khóa Combo hiện tại:** Ô `[1]` mở sẵn ở `x1`, các ô `[2] -> [8]` mở khóa vĩnh viễn trong trận tại các mốc Combo `x5, x10, x15, x20, x30, x40, x50`.
- **Tài nguyên Cooldown + Giáp (`Armor`):**
  - Chiêu `[1]` và `[2]` là 2 **Thế Kiếm Động** dùng vô hạn theo tốc độ đánh.
  - Chiêu `[3] -> [8]` dùng **Cooldown** (không dùng đạn). Nhặt hòm `AMMO` (hoặc đạt lại mốc `unlockCombo`) giảm **30%** thời gian hồi còn lại (tối thiểu `1.5s`) cho các chiêu `[3] -> [7]` đang hồi và cộng **+15% Nộ khí** (`ultCharge`).
  - Warrior sở hữu **Giáp phụ (`maxArmor = 75`, khởi đầu trận đầy 75/75)** hấp thụ sát thương trước khi trừ vào `HP`.
- **Điều khiển Hybrid ARPG:**
  - Phím `[1]` / `[2]` (hoặc cuộn chuột): Chuyển đổi giữa **Thế Cuồng Phong** và **Thế Phá Giáp**. Giữ `Chuột Trái` hoặc `Space` để tấn công liên tục theo thế đang cầm.
  - Phím `[3] -> [8]` (hoặc click ô trên HUD): Kích hoạt kỹ năng tức thì (**Instant Cast**) theo hướng con trỏ chuột mà không làm mất thế kiếm hiện tại.
  - Phím `[F]` / `Chuột Phải`: Kích hoạt Tuyệt kỹ `[8] Hóa Thân Chiến Thần` khi Nộ khí đạt 100% (đồng bộ hoàn toàn với ô `[8]`).

### Phi mục tiêu (Non-Goals)
- Không thay đổi bộ súng/đạn của `HUMAN`, `MAGE`, và các skin phụ (`BAMBO`, `BON`, `BINGO`, `BERT`).
- Không thay đổi cấu trúc bản đồ hoặc luật sinh quái theo Wave.

### Ràng buộc Kỹ thuật & Bảo mật (Constraints - Theo `GEMINI.md`)
- **Authoritative Server:** Toàn bộ logic hitbox, cộng/tiêu tán tầng Cuồng Nộ, giáp (`Armor`), khe nứt địa chấn, vòng hào quang đồng đội, Parry và đao lửa đều chạy trong vòng lặp 50Hz phía Server.
- **Input Validation:** Kiểm tra hợp lệ `slot`, `angle` (`Number.isFinite`), trạng thái sống/gục trước khi xử lý `player:skill`, `player:input` và `player:ultimate`.
- **Hiệu năng (Performance):** Các vùng hiệu ứng tạm thời (`hazardZones`, `slashMarks`, `warriorProjectiles`) có vòng đời hữu hạn và được dọn dẹp ngay khi hết hạn trong `GameRoom.tick()`.

---

## 3. Phương án Kiến trúc Đã Chọn (Architecture)

**Tách Module Kỹ năng Warrior độc lập (`WarriorSkillsConfig.js` & `WarriorAbilities.js`):**
- Giữ nguyên `WeaponsConfig.js` cho các class dùng súng.
- Tạo mới `server/game/WarriorSkillsConfig.js` (chứa toàn bộ hằng số 8 kỹ năng, Stance, Armor, Hazard, Projectile) và `server/game/WarriorAbilities.js` (xử lý trạng thái, va chạm hình quạt/chữ nhật/vòng tròn, chuỗi xoay 6 nhát, lướt & nổ vết cắt, địa chấn 3 tầng, parry phản đòn, và cập nhật theo tick `dt`).
- `Player.js`, `Zombie.js` và `GameRoom.js` tích hợp sạch qua các điểm giao tiếp định sẵn (không nhồi logic đặc thù vào `WeaponsConfig.js`).

---

## 4. Chi tiết Thiết kế Nghiệp vụ & Thông số Kỹ năng

### 4.1. Cải tiến 1: Hệ thống Thế Kiếm Động (Stance System — Nút `[1]` & `[2]`)

| Nút | ID | Tên Thế Kiếm | Mở khóa | Thông số Đánh Thường (`LMB / Space`) | Nội tại Thế Kiếm (Stance Passive) |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **[1]** | `BERSERKER_STANCE` | **Thế Cuồng Phong** | `x1` | Chém nhanh liên tục: nhịp `0.26s`, hình quạt hẹp **90°**, tầm **80px**, sát thương **42**. | **Cuồng Nộ (`furyStacks`):** Mỗi lần vung kiếm trúng ít nhất 1 zombie cộng **+1 tầng** (tối đa **10 tầng**, tự giữ trong `4.0s` khi giao tranh). Mỗi tầng tăng **+3% tốc độ đánh** và **+2% tốc độ di chuyển** (tối đa `+30%` tốc đánh, `+20%` tốc chạy). **Đổi sang thế `[2]` sẽ xóa sạch toàn bộ tầng tích lũy ngay lập tức.** |
| **[2]** | `JUGGERNAUT_STANCE` | **Thế Phá Giáp** | `x5` | Chém nặng tạo sóng xung kích tầm ngắn: nhịp `0.55s`, hình quạt rộng **130°**, tầm **125px**, sát thương **58**, đánh văng mạnh (`knockback: 260`), **xuyên thấu vô hạn** mọi zombie trong vùng chém. | **Kiên Cố & Chấn Áp:** Giảm **20% sát thương** nhận vào từ phía trước (`±70°`, cộng gộp vào kháng cận chiến của Warrior); đồng thời mọi zombie trúng đòn thế Phá Giáp (hoặc đánh cận chiến vào Warrior) bị **làm chậm 30%** (`slowFactor: 0.7`) trong **1.5 giây**. |

---

### 4.2. Cải tiến 2: Bộ Kỹ Năng Kích Hoạt ARPG (Nút `[3]` đến `[8]`)

| Nút | ID | Tên Chiêu | Mở khóa | Cooldown | Cơ chế & Thông số Chi tiết |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **[3]** | `BLADE_WHIRLWIND` | **Xoay Kiếm Cuồng Loạn** | `x10` | `4.5s` | Xoay tròn liên tục trong **1.5 giây**, chém **6 nhát** đều đặn mỗi `0.25s` quanh bản thân (bán kính **105px**, sát thương **45/nhát**). Trong lúc xoay, Warrior di chuyển ở **70% tốc độ** hướng theo thao tác điều khiển/chuột.<br>• **Nếu kích hoạt ở Thế Cuồng Phong `[1]`:** Nhát chém thứ 6 phóng ra **4 lưỡi kiếm gió** bay về 4 hướng vuông góc (`angle + 0, π/2, π, -π/2`), tốc độ `560 px/s`, tầm `260px`, xuyên thấu, gây **65 sát thương**.<br>• **Nếu kích hoạt ở Thế Phá Giáp `[2]`:** Nhát chém thứ 6 đập mạnh xuống đất (bán kính **135px**), gây **90 sát thương**, đẩy lùi (`240`) và **Choáng nhẹ 1.2 giây** (Boss: `0.8s`). |
| **[4]** | `SHADOW_DASH_SLASH` | **Lướt Kích Xung Phong** | `x15` | `5.0s` | Lướt cực nhanh trong **0.18s** (`~1333 px/s`, quãng đường tối đa **240px**) xuyên qua đám zombie (dừng lại chỉ khi chạm tường map, cột đá hoặc `Barricade`), gây **55 sát thương** cho mọi zombie trên đường lướt.<br>• **Vết Cắt Tử Thần (Death Marks):** Để lại 2 dấu ấn tại **điểm xuất phát** và **điểm kết thúc**. Sau **0.5 giây**, cả 2 dấu ấn phát nổ (bán kính **115px**), gây **75 sát thương** và **kéo tụ tất cả zombie** trong bán kính **160px** về sát tâm vụ nổ. |
| **[5]** | `SEISMIC_SLAM` | **Địa Chấn Cuồng Nộ** | `x20` | `8.0s` | Nhảy lên nện mạnh xuống đất, tạo **3 vòng sóng chấn động** lan từ tâm ra ngoài (`t = 0s, 0.12s, 0.24s`):<br>• **Tâm chấn (`0–95px`):** Gây **165 sát thương** (tiêu diệt tức thì zombie thường yếu và phá hủy toàn bộ cầu lửa/đạn của quái trong `230px`; **bảo toàn Tường gỗ `Barricade` của đồng đội**).<br>• **Vòng giữa (`95–165px`):** Gây **105 sát thương**, đẩy lùi (`300`), **Choáng 2.0s** (Boss: `1.2s`).<br>• **Vòng ngoài (`165–230px`):** Gây **70 sát thương**, đẩy lùi (`380`), **Choáng 2.5s** (Boss: `1.5s`).<br>• **Khe Nứt Địa Chấn (4.0s):** Tạo vùng khe nứt dung nham/bụi đất (`radius: 210px`) tồn tại **4.0 giây**, làm chậm **-60% tốc chạy** (`slowFactor: 0.4`) và đốt **16 sát thương lửa/giây** (mỗi `0.5s` gây `8` `'FIRE'` dmg) lên zombie đi qua, không cản bước người chơi. |
| **[6]** | `WAR_CRY` | **Tiếng Thét Chiến Thần** | `x30` | `10.0s` | Gầm vang dội phạm vi rộng (**900px**):<br>• **Khiêu khích & Hoảng sợ:** Hút toàn bộ zombie trong vùng nhắm vào Warrior trong **4.0 giây** (`tauntTargetId = warrior.id`; tự hủy nếu Warrior gục/chết). Riêng các zombie thường ở cự ly gần (`<= 180px`, trừ Boss `TANK`/`DEVIL`) bị **Hoảng sợ (Fear)** chạy tản ngược ra xa trong **1.5 giây**.<br>• **Hồi Giáp & Hào Quang Đồng Đội:** Lập tức hồi phục **20% lượng Giáp tối đa** (**+15 Armor**, tối đa `75`). Tạo vùng hào quang bán kính **200px** dưới chân Warrior trong **5.0 giây**, tăng **+15% sát thương** đòn đánh/súng cho mọi đồng đội đứng trong vùng (đặc biệt hỗ trợ Human/Mage). |
| **[7]** | `COUNTER_SHIELD_BASH` | **Phản Đòn Bằng Khiên** | `x40` | `8.0s` (trúng) / `4.0s` (trượt) | **Cơ chế Timing/Parry:** Khi bấm `[7]`, Warrior dựng khiên chắn phía trước (**140°**, `±70°`) trong **1.5 giây** (giảm `25%` tốc chạy nếu không ở trạng thái Avatar).<br>• **Phản Đòn Hoàn Hảo:** Nếu có zombie đánh cận chiến hoặc cầu lửa Devil chạm khiên trong `1.5s` này, đòn đó bị **hấp thụ 100% (0 sát thương)** và tự động kích hoạt ngay: Warrior **lướt tới trước 75px**, đập mạnh khiên hình nón lớn (**130°**, tầm **130px**) gây **95 sát thương**, đẩy lùi (`360`), **Choáng 2.2s** (Boss: `1.4s`), đồng thời tung **1 nhát chém miễn phí cực mạnh** (`120` sát thương, quạt `130°`, tầm `125px`), rồi bắt đầu hồi chiêu `8.0s`.<br>• **Hết thời gian không trúng:** Hạ khiên nhẹ nhàng và chỉ chịu **50% Cooldown (`4.0s`)**. |
| **[8]** | `AVATAR_OF_WAR` | **Hóa Thân Chiến Thần** | `x50` (hoặc `Ult 100%`) | `60.0s` (Tích Nộ) | **Tuyệt kỹ Đỉnh cao (10.0 giây):** Đồng bộ với phím `[F]` / `Chuột Phải`. Hóa khổng lồ rực lửa (`scale 1.35x`):<br>• **+50% sát thương** mọi đòn đánh/kỹ năng, **+30% tốc độ đánh**, **+30% tốc độ di chuyển**, **miễn nhiễm toàn bộ khống chế & làm chậm** (`ccImmune = true`).<br>• Mọi đòn đánh cơ bản ở cả hai thế `[1]` và `[2]` đều tự động phóng ra **Lưỡi Đao Lửa tầm xa** (`speed: 750`, `range: 340px`, xuyên thấu, `55` sát thương cơ bản trước hệ số Avatar).<br>• **Bùng nổ kết thúc:** Khi hết `10.0s` biến hình (nếu còn sống), tự động phát nổ xung quanh (bán kính **210px**), gây **180 sát thương `'FIRE'`** và đẩy lùi (`350`). |

---

### 4.3. Chỉ số Giáp (`Armor`), Trạng thái Zombie Mới (`Fear`, `Taunt`) & Đồng bộ Nộ Khí

1. **Hệ thống Giáp phụ (`Armor`) của Warrior:**
   - `CLASS_CONFIGS.WARRIOR` có `maxArmor: 75` (các class khác `maxArmor: 0`). Khởi đầu trận đấu `armor = 75`.
   - Trong `Player.takeDamage(amount, sourceType, options)`:
     1. Nếu đang bật `Counter Shield` và góc tấn công (`sourceX, sourceY`) nằm trong hình nón `±70°` trước mặt: trả về `{ blocked: true, damage: 0, parried: true }` (0 sát thương, kích hoạt Phản Đòn Hoàn Hảo).
     2. Tính giảm sát thương: Warrior có `25%` kháng `'MELEE'`, cộng thêm `20%` nếu đang ở `[2] Thế Phá Giáp` và đòn đánh từ phía trước `±70°` (tối đa giảm `45%`).
     3. Phần sát thương cuối cùng trừ vào `this.armor` trước; nếu `armor` không đủ, phần dư trừ tiếp vào `this.hp`.
   - Khi qua Wave (`WAVE_CLEAR`) hoặc được hồi sinh: Warrior hồi lại `50% maxArmor` (làm tròn `38` Giáp) nếu không còn bị gục.
2. **Trạng thái Zombie mới (`Zombie.js`):**
   - `tauntTimer` & `tauntTargetId`: Zombie ưu tiên bám đuổi `tauntTargetId` thay vì người chơi gần nhất (trừ khi mục tiêu đó chết/gục).
   - `fearTimer` & `fearSourcePos`: Zombie bị Fear (`1.5s`, chỉ áp dụng cho zombie thường, không áp dụng cho `TANK`/`DEVIL`) sẽ chạy ngược hướng khỏi Warrior ở tốc độ `0.8x` và không tấn công cho đến khi hết `fearTimer`.
3. **Nạp & Đồng bộ Tuyệt kỹ `[8]`:**
   - Khi không ở trạng thái `AVATAR_OF_WAR`, `ultCharge` tự hồi `+100 / 60` (`~1.667%`) mỗi giây + cộng thêm khi chém trúng (`+0.8%`), hạ gục zombie (`+4% * comboMult`), hồi sinh đồng đội (`+15%`), và nhặt hòm `AMMO` (`+15%`).
   - Phím `[F]` / `Chuột Phải` kích hoạt được ngay khi `ultCharge >= 100` (không phụ thuộc Combo x50), trong khi ô `[8]` trên thanh kỹ năng vẫn giữ mốc mở khóa hiển thị `x50 🔒` cho tới khi đạt `maxCombo >= 50`.

---

### 4.4. Luồng Dữ liệu (Data Flow), Giao diện (HUD) & Hiệu ứng Hình ảnh (VFX)

1. **Giao thức Socket & Snapshot:**
   - Client gửi `player:input` (với `weaponId: 'BERSERKER_STANCE' | 'JUGGERNAUT_STANCE'`) và sự kiện `player:skill` (`{ slot, angle }`) khi bấm `[3] -> [8]` hoặc click HUD.
   - `Player.serialize()` bổ sung `armor`, `maxArmor`, `warriorState` (`activeStance`, `furyStacks`, `skills`, `counterShieldActive`, `whirlwindActive`, `warCryAuraActive`, `avatarActive`, `avatarTimer`).
   - `Zombie.serialize()` bổ sung `isTaunted` và `isFeared`.
   - `GameRoom` snapshot bổ sung `groundZones` (chứa các **Khe nứt địa chấn** `4.0s` và **Vết cắt tử thần** `0.5s` để Client vẽ trực tiếp trên mặt đất!).
   - `eventsBuffer` phát sự kiện `WARRIOR_SKILL`, `WARRIOR_COUNTER`, `WARRIOR_MARK_EXPLODE`, `WARRIOR_AVATAR_END` để Client dựng vệt kiếm, sóng chấn động, màn chắn parry, hiệu ứng tóe máu/lửa và rung màn hình.
2. **Thanh Kỹ năng & Giáp trên HUD (`client/js/ui.js`, `client/css/style.css`, `client/js/renderer.js`):**
   - Trên đầu nhân vật & trong bảng đội nhóm HUD, hiển thị thanh **Giáp (màu xanh thép / vàng kim `#4fc3f7`)** ngay trên thanh HP nếu `maxArmor > 0`.
   - Thanh 8 ô dưới đáy màn hình của Warrior hiển thị icon & tên 8 kỹ năng mới, badge số tầng **Cuồng Nộ (`x1..x10`)** trên ô `[1]`, highlight Thế Kiếm đang bật (`[1]` hoặc `[2]`), và đếm ngược Cooldown từng giây cho `[3] -> [8]`.
   - **VFX Canvas (`renderer.js`):**
     - Vệt kiếm xanh lam (Thế `[1]`), sóng xung kích bạc/vàng (Thế `[2]`), lốc xoay kiếm + 4 kiếm gió (`[3]`), vệt lướt bóng + 2 ấn tử thần nổ kéo (`[4]`), 3 vòng sóng chấn động + khe nứt dung nham phát sáng (`[5]`), sóng gầm + hào quang vàng dưới chân + icon đầu zombie (`[6]`), khiên phản đòn ánh kim + tia chớp Parry (`[7]`), thân hình `1.35x` rực lửa + lưỡi đao lửa tầm xa + nổ kết thúc (`[8]`).

---

### 4.5. Điểm Giao Tiếp Codebase & Tính Tương Thích

- [UltimateConfig.js](file:///d:/Box-Head-Game/server/game/UltimateConfig.js) & [UltimateAbilities.js](file:///d:/Box-Head-Game/server/game/UltimateAbilities.js): Chuyển Ultimate của `WARRIOR` sang `AVATAR_OF_WAR`.
- [Bullet.js](file:///d:/Box-Head-Game/server/game/Bullet.js) & [GameRoom.js](file:///d:/Box-Head-Game/server/game/GameRoom.js): Các lưỡi kiếm gió (`type: 'wind_blade'`) từ `[3]` và lưỡi đao lửa (`type: 'fire_slash'`) từ `[8]` sử dụng `Bullet` với `penetration: true` để dùng chung cơ chế va chạm tường và tính kill/combo chuẩn; đồng thời `GameRoom.tick()` tính `player.hasWarCryBuff` cho đồng đội đứng trong vùng `200px` quanh `War Cry` để nhân `1.15x` sát thương đạn/kỹ năng.
- [index.html](file:///d:/Box-Head-Game/client/index.html) & [ui.js](file:///d:/Box-Head-Game/client/js/ui.js): Cập nhật mô tả Warrior tại phòng chờ (`150 HP • 75 Giáp • Kiếm Khiên 1–8` & `Ult: Hóa Thân Chiến Thần`) và `ultimateMeta.WARRIOR`.
- [input.js](file:///d:/Box-Head-Game/client/js/input.js) & [main.js](file:///d:/Box-Head-Game/client/js/main.js): Cuộn chuột và phím `1`/`2` cho Warrior chỉ đổi Thế Kiếm `[1]` ↔ `[2]`; phím `3 -> 8` tung chiêu tức thì.
- [audio.js](file:///d:/Box-Head-Game/client/js/audio.js): Thêm âm thanh WebAudio cho vung kiếm, xung kích, lướt, địa chấn 3 nhịp, tiếng thét chiến thần, tiếng keng Parry khiên và gầm Hóa Thân.
- [ultimates.test.js](file:///d:/Box-Head-Game/tests/ultimates.test.js): Cập nhật test Ultimate của Warrior sang `AVATAR_OF_WAR` (và tách phần test đặt Barricade cho `HUMAN`), đồng thời bổ sung bộ test mới cho toàn bộ 8 kỹ năng Warrior (`tests/warrior_skills.test.js`).
