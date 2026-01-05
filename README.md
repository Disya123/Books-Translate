# Books-Translate

## 📱 Mobile App for Reading, Editing, and Translating Visual Novels

An offline Android and iOS app for importing, reading, editing, and translating novels in **FB2, EPUB, ZIP, and TXT** formats.

## ✨ Key Features

- **Import novels** from FB2, EPUB, ZIP, and TXT files *(partially implemented)*
- **Batch translation** of all chapters or a selected range *(partially implemented)*
- **Background translation** on Android (Foreground Service) *(not implemented)*
- **Translation caching** — translate once, reuse forever *(implemented)*
- **Offline storage** — works without internet *(implemented)*
- **Image support** — save and display covers and illustrations *(implemented)*
- **Dark/light/AMOLED themes** and font settings *(implemented)*
- **Bookmarks** and chapter navigation *(partially implemented — saved but not restored)*
- **Retranslation** — change target language after initial translation *(not implemented)*

## 📁 Supported Formats

| Format | Description |
|--------|-------------|
| **FB2** | Popular Russian e-book format *(not implemented)* |
| **EPUB** | Standard e-book format *(not implemented)* |
| **ZIP** | Archive with structure: chapters/images/cover *(implemented)* |
| **TXT** | Plain text files by chapter *(implemented)* |

## 🛠️ Technologies

- **React Native + Expo** — cross-platform development
- **TypeScript** — strict typing
- **SQLite** — local data storage
- **Expo File System** — file system access
- **Expo Notifications** — notifications on translation completion
- **Expo Foreground Service** — background translation on Android *(not implemented)*
- **Expo Keep Awake** — keep screen on for iOS *(not tested)*

## 📥 Installation

### Requirements
- Node.js 18+
- Expo CLI
- Android Studio / Xcode (for building)

### Instructions

```bash
# Clone the repository
git clone https://github.com/Disya123/Books-Translate.git
cd Books-Translate

# Install dependencies
npm install

# Run in emulator
npx expo start

# Build APK for Android
npx expo build:android -t apk
```

## 📸 Screenshots

*(Screenshots will be added later)*

## 📜 License

MIT

## 💬 Support

If you have questions, find a bug, or want to suggest an improvement — create an issue in the repository.

---

### 🌐 Language Switch

- **Русский** — [README-ru.md](README-ru.md)