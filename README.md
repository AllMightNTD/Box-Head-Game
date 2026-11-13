# 🧟 BOXHEAD: 2PLAY LAN MULTIPLAYER (1 - 4 NGƯỜI CHƠI)

Game bắn zombie phong cách **Boxhead** kinh điển, tối ưu hóa chơi qua **mạng nội bộ (LAN)** cực kỳ mượt mà cho nhóm tối đa 4 người.

---

## 🚀 HƯỚNG DẪN KHỞI ĐỘNG NHANH

### Bước 1: Máy chủ (Host) bật Server
Tại máy làm Host (chỉ cần 1 máy duy nhất):
```bash
node server/server.js
```
Terminal sẽ hiển thị ngay địa chỉ IP mạng LAN của bạn, ví dụ:
```text
====================================================
   BOXHEAD MULTIPLAYER LAN SERVER (1-4 PLAYERS)    
====================================================
[Host] Local Machine:     http://localhost:3000
[LAN]  Cac may cung mang: http://192.168.1.15:3000
====================================================
```

### Bước 2: Bạn bè cùng mạng LAN vào chơi
- **Máy Host:** Mở trình duyệt truy cập `http://localhost:3000`
- **Các máy khác (tối đa 3 máy khác trong cùng Wi-Fi / LAN):** Mở trình duyệt (Chrome, Cốc Cốc, Edge, Firefox, Safari) gõ địa chỉ IP hiển thị ở trên (ví dụ: `http://192.168.1.15:3000`).
- **Không cần cài đặt bất kỳ phần mềm nào trên máy khách!**

---

## 🎮 ĐIỀU KHIỂN & PHÍM TẮT

| Phím | Hành Động |
| :--- | :--- |
| **`W - A - S - D`** (hoặc Mũi tên) | Di chuyển nhân vật 8 hướng |
| **`Chuột`** | Xoay 360 độ ngắm bắn theo con trỏ chuột |
| **`Chuột Trái`** (hoặc `Space`) | Bắn súng / Đặt tường chắn hoặc thùng nổ |
| **`Chuột Phải`** (hoặc **`F`**) | **Kích hoạt Chiêu thức Chủ động (Ultimate Ability)** khi nộ đạt 100% |
| **`Phím 1 - 8`** (hoặc Cuộn chuột) | Đổi nhanh vũ khí |
| **`E`** (giữ 2 giây gần đồng đội) | Cứu sống đồng đội đang bị gục ngã (Revive) |

---

## ⚡ HỆ THỐNG LỚP NHÂN VẬT & CHIÊU THỨC CHỦ ĐỘNG (ACTIVE ULTIMATES)

Mỗi người chơi có thể lựa chọn 1 trong 3 Lớp Nhân Vật với chỉ số bị động và **Chiêu Thức Chủ Động (Ultimate)** riêng biệt giúp lật kèo trong gang tấc:

### 1. 🧍 HUMAN (Đặc Nhiệm)
- **Chỉ số bị động:** Cân bằng toàn diện, tốc độ nạp đạn nhanh hơn 15%.
- **Chiêu thức:** `Tactical Drone & Infinite Ammo Aura`
  - Thả một drone chiến đấu mini tự động bay lượn và bắn tỉa zombie gần nhất trong 8 giây.
  - Tỏa ra **Hào quang đạn vô hạn (200px)**: Mọi người chơi đứng trong vòng hào quang được bắn xả đạn tẹt ga mà không tốn bất kỳ viên đạn súng nào (Uzi, Shotgun, Rocket, Railgun...).

### 2. 🛡️ WARRIOR (Chiến Binh)
- **Chỉ số bị động:** 150 HP, chống sốc sát thương từ đòn đánh lén phía sau (-25% dmg).
- **Chiêu thức:** `Seismic Slam (Đập Đất 360°)`
  - Đập đất rung chuyển toàn bộ bán kính 220px, gây 120 sát thương và đẩy lùi zombie cực mạnh (520px).
  - **Làm choáng (Stun)** toàn bộ quái trong 2.5s (Boss 1.5s), dập tắt mọi cầu lửa bay của Devil, an toàn tuyệt đối không làm vỡ tường chắn hay thùng nổ đồng đội đã đặt. Cực kỳ đắc lực để mở đường máu lao vào hồi sinh đồng đội.

### 3. ⚡ MAGE (Pháp Sư)
- **Chỉ số bị động:** Tốc độ di chuyển nhanh (+12%), thời gian duy trì chuỗi combo lâu hơn 25%.
- **Chiêu thức:** `Blink & Frost Nova (Tốc Biến Băng Giá)`
  - Tức thời tốc biến 240px theo hướng con trỏ chuột, xuyên qua tường chắn và hàng rào an toàn không lo kẹt góc.
  - Kích hoạt song song **Frost Nova** kép tại cả điểm xuất phát và điểm đáp: gây 75 sát thương, **Đóng băng (Freeze) cứng đờ** toàn bộ zombie trong 3.0s (Boss 1.5s) và làm chậm 50% trong 1.5s kế tiếp.

### 🔋 Cơ chế Tích Lũy Năng Lượng (Ultimate Charge)
- **Bắn trúng quái:** +0.8% mỗi viên đạn trúng đích (+0.2% mỗi mảnh đạn shotgun).
- **Hạ gục quái:** +4.0% cơ bản x Hệ số nhân Combo (Combo x1 = 1.0x, x6 = 1.25x, x11 = 1.5x, x16 = 1.75x, x21+ = 2.0x tức +8.0%/kill).
- **Cứu đồng đội:** +15.0% nộ ngay khi hoàn tất cứu sống một người đồng đội.
- Sát thương từ chiêu cuối hoặc đạn của drone **không** sinh thêm nộ để tránh vòng lặp vô tận. Nộ được giữ nguyên qua từng wave.

---

## 🔥 BẢNG MỞ KHÓA VŨ KHÍ THEO MỐC COMBO

Bắn hạ zombie liên tiếp trước khi thanh Combo cạn để tăng chuỗi combo và mở khóa kho vũ khí hủy diệt:

| Phím | Tên Vũ Khí | Mốc Combo | Đặc Tính |
| :---: | :--- | :---: | :--- |
| **1** | **Pistol (Súng lục)** | **x1** | Đạn vô hạn, bắn từng viên chuẩn xác |
| **2** | **Uzi** | **x5** | Tiểu liên xả đạn nhanh càn quét quái |
| **3** | **Shotgun** | **x10** | Đạn chùm 6 viên, đẩy lùi zombie cực mạnh ở cự ly gần |
| **4** | **Barricade (Tường gỗ)** | **x15** | Đặt thùng gỗ chặn ngõ, tạo mê cung phòng thủ |
| **5** | **Explosive Barrel** | **x20** | Thùng thuốc nổ đỏ. Bắn nổ lan chuỗi barrel quét sạch wave quái |
| **6** | **Grenade (Lựu đạn)** | **x30** | Ném lựu đạn nổ diện rộng sau 1.2s |
| **7** | **Rocket Launcher** | **x40** | Tên lửa sát thương khủng khiếp |
| **8** | **Railgun** | **x50+** | Tia laser xuyên phá toàn bộ zombie trên đường thẳng |

---

## 👥 4 NHÂN VẬT ĐẦU HỘP ĐỘC QUYỀN
Khi vào phòng, mỗi người chơi chọn 1 nhân vật riêng biệt:
1. **BAMBO (Áo trắng / Băng trán đỏ):** Phong cách Rambo đầu hộp kinh điển.
2. **BON (Áo đỏ):** Sát thủ diệt quái.
3. **BINGO (Áo xanh dương):** Chuyên gia phòng thủ.
4. **BERT (Áo vàng cam):** Thiện xạ tầm xa.

---

## 🧟 CHỦNG LOẠI KẺ THÙ & BOSS QUỶ ĐỎ
- **Normal Zombie (Xanh lá):** Đi theo bầy, máu vừa phải.
- **Runner Zombie (Đỏ / Nâu gầy):** Chạy cực nhanh, lao vút áp sát người chơi.
- **Tank Zombie (Khổng lồ xám xịt):** Máu trâu gấp 5 lần, đấm đau và phá vỡ tường gỗ nhanh chóng.
- **Devil (Boss Quỷ Đỏ):** Xuất hiện từ Wave 4-5 trở đi, có sừng nhọn và kỹ năng bắn cầu lửa (Fireball) nổ diện rộng từ xa.

---

## 🛠️ CHẠY BỘ KIỂM THỬ TỰ ĐỘNG
Để chạy toàn bộ 45 bài kiểm thử vật lý, AI, combo, chiêu thức chủ động (Ultimates) và mô phỏng 4 người chơi cùng lúc:
```bash
node --test tests/*.test.js
```
Tất cả 45 bài test đều vượt qua (100% PASS).
# Box-Head-Game
