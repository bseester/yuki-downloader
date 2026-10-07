# Yuki Downloader

macOS için geliştirilmiş, minimal ve native hissettiren MP4/MP3 indirme uygulaması.  
**yt-dlp + ffmpeg + Electron** tabanlı, Liquid Glass tasarım diliyle.

---

## 🚀 Kurulum & Çalıştırma

### 1. Gereksinimler (otomatik kuruldu)
```bash
brew install yt-dlp ffmpeg
```

### 2. npm bağımlılıkları
```bash
npm install
```

### 3. Uygulamayı başlat
```bash
npm start
```

---

## 📂 Proje Yapısı

```
youtube-mp4/
├── main.js          # Electron ana süreç — pencere, IPC, yt-dlp bridge
├── preload.js       # Güvenli IPC köprüsü (contextBridge)
├── renderer.js      # Arayüz mantığı (format/kalite/indirme)
├── index.html       # UI şablonu
├── style.css        # Liquid Glass / macOS Sequoia CSS sistemi
├── assets/
│   └── icon.png     # Uygulama ikonu
└── package.json
```

---

## 🎨 Özellikler

| Özellik | Detay |
|---|---|
| **Liquid Glass UI** | `vibrancy: under-window` + yarı saydam cam efekti |
| **Dark/Light mod** | Sistem temasına otomatik uyum |
| **URL algılama** | Yapıştır → 600ms debounce → otomatik video bilgisi çekme |
| **Thumbnail önizleme** | Skeleton loader + kapak resmi + süre badge |
| **MP4 kaliteleri** | 4K / 1080p / 720p / 480p (videoya göre dinamik) |
| **MP3 kaliteleri** | 320k / 192k / 128k |
| **Spotify Toplu İndirme** | Çalma listeleri (`playlist`) ve albümleri (`album`) tek tıkla toplu MP3 indirme |
| **Ayarlar Sekmesi** | Klasör konumu, varsayılan kalite, hızlı motor, lrc sözlükleri ve araç teşhisi |
| **Eşzamanlı indirme** | Sınırsız, her biri kendi progress bar'ı |
| **İptal** | Tek tıkla aktif indirmeyi durdur |
| **Tray app** | Menu bar'dan küçük simgeyle kontrol |
| **Show in Finder** | Tamamlanan dosyayı anında bul |
| **Bildirim** | macOS sistem bildirimiyle tamamlama uyarısı |

---

## ⚙️ Desteklenen Servisler

- **Spotify**: Tekil şarkılar, Çalma Listeleri (`playlist`), Albümler (`album`) — 320k/192k/128k MP3
- **YouTube & YouTube Music**: 4K, 1080p, 720p MP4 Video ve 320k MP3
- **Vimeo, Twitter/X, Instagram, TikTok, SoundCloud** ve yt-dlp destekli 1000+ platform

---

## 🔧 Özelleştirme

`main.js` içindeki `buildArgs()` fonksiyonunu düzenleyerek yt-dlp parametrelerini özelleştirebilirsiniz.

```js
// Örnek: Altyazı da indir
'--write-auto-subs', '--sub-lang', 'tr,en',
```
