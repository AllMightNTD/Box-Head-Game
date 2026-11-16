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
Để chạy toàn bộ kiểm thử vật lý, AI, combo, chiêu thức, socket đồng bộ và multi-platform deployment:
```bash
npm test
```

---

## ☁️ HƯỚNG DẪN DEPLOY ĐA NỀN TẢNG (RENDER / CLOUDFLARE PAGES / DOCKER / VPS)

Dự án hỗ trợ kiến trúc **Dual-Mode** được cấu hình tập trung tại `server/config/deployConfig.js`, sẵn sàng chạy trên nhiều môi trường khác nhau:

### 1. Cách 1: Render (Web Service Free Tier - Khuyên Dùng Cho Người Mới)
Game chạy chế độ **Monolith** (Node.js phục vụ cả Web Client + Socket.IO server).
- **Bước 1:** Đẩy mã nguồn lên GitHub.
- **Bước 2:** Vào [Render Dashboard](https://dashboard.render.com/) -> **New +** -> **Blueprint**.
- **Bước 3:** Chọn repository của bạn. Render sẽ tự động đọc file [render.yaml](file:///home/dev_ntd/Documents/Box-Head-Game/render.yaml) (vùng Singapore, Free tier, health check `/healthz`).
- **Bước 4:** Bấm **Apply**. Sau khi deploy xong, bạn nhận được link dạng `https://ten-game.onrender.com`. Mở link trên trình duyệt và gửi cho bạn bè cùng chơi!

> **Lưu ý về Render Free Tier:**
> - Máy chủ tự ngủ sau 15 phút không có người chơi. Khi có người truy cập lại, client hiển thị thông báo **"Đang đánh thức máy chủ (Cold Start 30–60s)"** và tự động kết nối lại ngay khi server sẵn sàng.
> - Preset `render` tự động điều chỉnh tần số đồng bộ mạng `SNAPSHOT_HZ=25` (vẫn giữ vật lý simulation 50Hz) để tiết kiệm CPU và tránh chạm ngưỡng 5 GB băng thông/tháng.

### 2. Cách 2: Tách Client (Cloudflare Pages / Vercel) + Backend Socket.IO (Render / VPS)
Phương án tối ưu băng thông: Tài nguyên tĩnh (ảnh, âm thanh ~6.5MB) được Cloudflare Pages phục vụ với băng thông không giới hạn, backend Render chỉ gánh gói tin Socket.IO.
1. **Chạy Backend:**
   - Deploy backend lên Render với biến môi trường:
     - `DEPLOY_PLATFORM=split-backend`
     - `CORS_ORIGIN=https://ten-du-an.pages.dev` (hoặc `*`)
2. **Build Client tĩnh:**
   - Trên Cloudflare Pages / Vercel, cài đặt build:
     - **Build Command:** `npm run build:client`
     - **Build Output Directory:** `dist`
     - **Environment Variable:** `BACKEND_URL=https://ten-backend.onrender.com`

### 3. Cách 3: Docker Container (Koyeb, Zeabur, Back4App, Hugging Face Spaces, VPS)
Dự án có sẵn `Dockerfile` chuẩn Node 20 Alpine với Healthcheck tích hợp:
```bash
# Build & chạy cục bộ hoặc trên VPS
docker build -t boxhead-game .
docker run -p 3000:3000 -e DEPLOY_PLATFORM=docker boxhead-game
```

### 📋 Bảng Biến Môi Trường (Environment Variables)

| Biến | Mặc định | Mô tả |
| :--- | :---: | :--- |
| `DEPLOY_PLATFORM` | `lan` | Preset: `lan`, `render`, `docker`, `huggingface`, `split-backend`, `static-client` |
| `DEPLOY_MODE` | theo preset | `monolith` (kèm static) hoặc `backend` (chỉ socket/API) |
| `PORT` | `3000` (`10000` trên Render) | Cổng lắng nghe HTTP & Socket.IO |
| `CORS_ORIGIN` | `*` | Danh sách domain được phép gọi socket (cách nhau bởi dấu phẩy) hoặc `*` |
| `SIMULATION_HZ` | `50` | Tần số vòng lặp vật lý trò chơi (50Hz = 20ms) |
| `SNAPSHOT_HZ` | `50` (LAN) / `25` (Cloud) | Tần số phát `game:snapshot` qua mạng tới client |
| `MAX_ROOMS` | `50` (LAN) / `20` (Render) | Giới hạn số phòng tạo tối đa để bảo vệ RAM server |
| `BACKEND_URL` | rỗng | URL máy chủ backend (dùng khi build static client `dist/`) |
| `HEALTHCHECK_PATH` | `/healthz` | Đường dẫn kiểm tra trạng thái sức khỏe máy chủ |
| `AUTO_PING_ENABLED` | `true` (Render) / `false` (LAN) | Bật/tắt cơ chế tự động ping public URL giữ server không bị ngủ sau 15p |
| `KEEP_ALIVE_URL` | tự lấy từ `RENDER_EXTERNAL_URL` + `/healthz` | URL đích cho cơ chế auto-ping (tự động nhận diện trên Render) |
| `KEEP_ALIVE_INTERVAL_MS` | `780000` (13 phút) | Chu kỳ gửi ping giữ kết nối (mili-giây) |

### ⏰ Giữ Render Free Luôn Active 24/7 (Chống Ngủ 15 Phút)
1. **Lớp 1 (Tích hợp sẵn):** Khi chạy trên Render (`AUTO_PING_ENABLED=true`), server tự động đọc `RENDER_EXTERNAL_URL` và ping `/healthz` mỗi 13 phút (`server/services/keepAlive.js`).
2. **Lớp 2 (External Watchdog dự phòng):** Để đánh thức server ngay cả khi bị restart/ngủ hẳn, hãy cấu hình **Cron-job.org / UptimeRobot** (miễn phí) trỏ đến `https://ten-game.onrender.com/healthz` mỗi 10-12 phút, hoặc bật Repository Variable `RENDER_HEALTHCHECK_URL` trên GitHub để kích hoạt workflow `.github/workflows/keep-alive.yml`. Xem chi tiết tại `docs/render-deployment-guide.html`.
