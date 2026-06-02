# 📚 StudyBuddy - Desktop App

Môi trường học tập hiệu quả với phòng học video, ghi chú, và chế độ tập trung.
Desktop app được xây dựng trên nền Electron.

## 🚀 Cài đặt & Chạy

```bash
# 1. Cài dependencies (bao gồm Electron)
npm install

# 2. Chạy desktop app
npm run dev

# 3. Chạy web-only mode (không cần Electron)
npm run web
# Mở http://localhost:3000
```

## 📁 Cấu trúc dự án

```
├── main.js                   # Electron main process (cửa sổ, tray)
├── preload.js                # Electron preload (OS API bridge)
├── server.js                 # Express + Socket.io server (nhúng trong app)
├── package.json              # Dependencies
├── public/                   # Frontend (renderer process)
│   ├── index.html            # SPA entry point
│   ├── css/                  # Stylesheets (modular)
│   │   ├── variables.css     # Design tokens
│   │   ├── base.css          # Reset, animations
│   │   ├── components.css    # Buttons, modals, forms
│   │   ├── home.css          # Home page
│   │   ├── room.css          # Video room
│   │   ├── memo.css          # Memo page
│   │   ├── focus.css         # Focus mode
│   │   ├── bgm.css           # BGM player
│   │   └── responsive.css    # Responsive window
│   ├── js/
│   │   ├── app.js            # Main app, router
│   │   ├── utils/            # Helpers, toast, storage (IndexedDB)
│   │   ├── services/         # Socket, media, WebRTC, BGM
│   │   └── pages/            # Home, room, memo, focus
│   └── assets/sounds/        # BGM audio files
```

## 🔧 Tech Stack

- **Desktop**: Electron (Chromium + Node.js)
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Backend**: Node.js + Express + Socket.io (nhúng trong Electron)
- **Storage**: localStorage + IndexedDB (client-side)
- **Video**: WebRTC
- **Realtime**: Socket.io

## 🖥️ Tính năng Desktop

- Cửa sổ desktop native với kích thước cố định
- System Tray — thu nhỏ vào khay hệ thống, click phải để tham gia lại phòng
- Single instance — chỉ mở 1 cửa sổ app
- Preload bridge — sẵn sàng cho chức năng khóa app/thông báo (Task 19-24)
- Vẫn chạy được web-only mode bằng `npm run web`

## 👥 Nhóm phát triển

ITSS2 - Urara Team

## 📝 Ghi chú

- Prototype cũ được giữ lại ở root (`index.html`, `style.css`, `app.js`) để tham khảo
- Desktop app chạy Electron → load web từ `public/` qua embedded server
- `npm run web` vẫn chạy web thuần không cần Electron
