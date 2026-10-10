// ─── Yuki Internationalization (i18n) ─────────────────────────────────────────

const translations = {
  tr: {
    // Navigation
    nav_downloader: 'İndirici',
    nav_settings: 'Ayarlar',
    open_folder_title: 'İndirilenler klasörünü aç',

    // Hero
    hero_title: 'Yuki Downloader',
    hero_subtitle: 'YouTube ve Spotify içeriklerini tek tıkla en yüksek kalitede indirin.',

    // Mode Buttons
    mode_video: 'Video',
    mode_audio: 'Ses',
    mode_spotify: 'Spotify',

    // URL Input & Placeholders
    input_placeholder_yt_video: 'YouTube video veya çalma listesi bağlantısı yapıştırın…',
    input_placeholder_yt_audio: 'YouTube ses veya video bağlantısı yapıştırın…',
    input_placeholder_spotify: 'Spotify şarkı veya çalma listesi bağlantısı yapıştırın…',
    input_placeholder_default: 'YouTube veya Spotify bağlantısı yapıştırın…',
    paste_tooltip: 'Panodan yapıştır',
    clear_tooltip: 'Temizle',
    save_folder_label: 'Kayıt klasörü:',
    change_btn: 'Değiştir',

    // Preview
    playlist_badge: 'Toplu Çalma Listesi',
    turkish_sub_badge: '🇹🇷 Türkçe Altyazı',
    format_label: 'Format',
    quality_label: 'Kalite',
    lyrics_chip: 'Şarkı Sözleri (.lrc)',
    lossless_label: 'Kayıpsız (Lossless)',
    btn_checking: 'Bağlantı kontrol ediliyor…',
    btn_start_download: 'İndirmeyi Başlat',
    btn_download_video: 'Video İndir',
    btn_download_audio: 'Ses İndir',
    btn_download_spotify: 'Spotify İndir',
    btn_download_fmt: 'İndir ({fmt})',
    btn_download_all_fmt: 'Tümünü İndir ({fmt} - Toplu Liste)',

    // Downloads List
    section_downloads_title: 'İndirilenler & Geçmiş',
    clear_completed_btn: 'Tamamlananları temizle',
    empty_title: 'Henüz indirme yok',
    empty_desc: 'Yukarıya bir YouTube veya Spotify bağlantısı yapıştırıp indirmeyi başlatın.',
    finder_title: "Finder'da göster",
    cancel_title: 'İptal et',
    status_preparing: 'Hazırlanıyor…',
    status_scanning: 'Çalma listesi taranıyor…',
    status_connecting: 'Bağlanıyor…',
    status_downloading: 'İndiriliyor…',
    status_complete: 'Tamamlandı',
    status_error: 'Hata',
    badge_batch: 'Toplu İndirme',

    // Settings View
    settings_title: 'Ayarlar',
    section_general: 'Genel & Tercihler',
    setting_lang: 'Uygulama Dili',
    setting_lang_desc: 'Arayüz görüntüleme dilini seçin (Türkçe / English)',
    setting_download_dir: 'İndirme Klasörü',
    setting_download_dir_desc: 'Tüm indirilen dosyaların kaydedileceği varsayılan konum',
    setting_change_folder_btn: 'Klasör Seç…',
    setting_open_folder_btn: 'Klasörü Aç',

    section_formats: 'Format & Kalite Tercihleri',
    setting_def_video_format: 'Varsayılan Video Formatı',
    setting_def_video_format_desc: 'YouTube ve video indirmeleri için dosya konteyneri',
    setting_def_video_quality: 'Varsayılan Video Kalitesi',
    setting_def_video_quality_desc: 'Yeni eklenen YouTube videoları için varsayılan çözünürlük',
    setting_def_audio_format: 'Varsayılan Ses Formatı',
    setting_def_audio_format_desc: 'Müzik indirmeleri için kullanılacak ses formatı',
    setting_def_audio_quality: 'Varsayılan Ses Kalitesi (Bitrate)',
    setting_def_audio_quality_desc: 'YouTube ve Spotify indirmeleri için ses kalitesi',

    section_youtube: 'YouTube Seçenekleri',
    setting_auto_subs: 'Otomatik Türkçe Altyazı Ekle',
    setting_auto_subs_desc: 'Mevcutsa resmi altyazıyı, yoksa otomatik oluşturulan Türkçe altyazıyı MP4/MKV videoya göm',

    section_spotify: 'Spotify Tercihleri',
    setting_smart_sync: 'Akıllı Çalma Listesi Senkronizasyonu',
    setting_smart_sync_desc: 'Daha önce indirilen şarkıları atlar, yeni eklenenleri ve silinmişleri otomatik tespit edip indirir',
    setting_spotify_folder: 'Çalma Listelerini Alt Klasöre Kaydet',
    setting_spotify_folder_desc: 'Toplu indirmelerde şarkıları çalma listesi adında ayrı bir klasöre yerleştir',
    setting_spotify_engine: 'Hızlı İndirme Motoru',
    setting_spotify_engine_desc: 'Şarkı seslerini YouTube Music üzerinden optimize edilmiş hızla çek',
    setting_spotify_lyrics: 'Şarkı Sözlerini İndir (.lrc)',
    setting_spotify_lyrics_desc: 'Şarkının yanına senkronize şarkı sözü (.lrc) dosyasını otomatik ekle',

    section_system: 'Sistem & Bildirimler',
    setting_notifications: 'Masaüstü Bildirimleri',
    setting_notifications_desc: 'İndirme tamamlandığında sistem bildirimi göster',
    setting_sound: 'Sesli Uyarı',
    setting_sound_desc: 'İşlem bittiğinde hafif bir ses efekti çal',

    section_about: 'Hakkında & Bağımlılıklar',
    about_desc: 'Yuki Downloader v1.0.0 — Modern macOS & Web Media Downloader',

    web_banner_text: '🌐 Yuki Web Sürümü — Tarayıcınız üzerinden doğrudan indirin. Sınırsız format ve ek özellikler için macOS sürümünü edinin.',
    web_banner_btn: 'macOS Sürümünü İndir ↗',
    web_toast_download: 'İndirme başlatıldı — dosya cihazınıza aktarılıyor…',
    web_download_started: 'İndirme başladı — veri alınıyor…',
    web_download_complete: '✓ İndirme tamamlandı! Dosya İndirilenler klasörüne kaydedildi.',
    web_download_error: 'Medya akışı alınamadı. Lütfen bağlantıyı kontrol edin.',
    web_folder_notice: 'Web sürümünde dosyalar doğrudan tarayıcınızın İndirilenler klasörüne kaydedilir.',
  },

  en: {
    // Navigation
    nav_downloader: 'Downloader',
    nav_settings: 'Settings',
    open_folder_title: 'Open downloads folder',

    // Hero
    hero_title: 'Yuki Downloader',
    hero_subtitle: 'Download YouTube and Spotify media in the highest quality with one click.',

    // Mode Buttons
    mode_video: 'Video',
    mode_audio: 'Audio',
    mode_spotify: 'Spotify',

    // URL Input & Placeholders
    input_placeholder_yt_video: 'Paste YouTube video or playlist link…',
    input_placeholder_yt_audio: 'Paste YouTube audio or video link…',
    input_placeholder_spotify: 'Paste Spotify track or playlist link…',
    input_placeholder_default: 'Paste YouTube or Spotify link…',
    paste_tooltip: 'Paste from clipboard',
    clear_tooltip: 'Clear',
    save_folder_label: 'Save folder:',
    change_btn: 'Change',

    // Preview
    playlist_badge: 'Batch Playlist',
    turkish_sub_badge: '🇹🇷 Turkish Subtitles',
    format_label: 'Format',
    quality_label: 'Quality',
    lyrics_chip: 'Lyrics (.lrc)',
    lossless_label: 'Lossless',
    btn_checking: 'Checking link…',
    btn_start_download: 'Start Download',
    btn_download_video: 'Download Video',
    btn_download_audio: 'Download Audio',
    btn_download_spotify: 'Download Spotify',
    btn_download_fmt: 'Download ({fmt})',
    btn_download_all_fmt: 'Download All ({fmt} - Batch)',

    // Downloads List
    section_downloads_title: 'Downloads & History',
    clear_completed_btn: 'Clear completed',
    empty_title: 'No downloads yet',
    empty_desc: 'Paste a YouTube or Spotify link above to start downloading.',
    finder_title: 'Show in Finder',
    cancel_title: 'Cancel',
    status_preparing: 'Preparing…',
    status_scanning: 'Scanning playlist…',
    status_connecting: 'Connecting…',
    status_downloading: 'Downloading…',
    status_complete: 'Completed',
    status_error: 'Error',
    badge_batch: 'Batch Download',

    // Settings View
    settings_title: 'Settings',
    section_general: 'General & Preferences',
    setting_lang: 'Application Language',
    setting_lang_desc: 'Select interface language (Türkçe / English)',
    setting_download_dir: 'Download Folder',
    setting_download_dir_desc: 'Default location where all files are saved',
    setting_change_folder_btn: 'Choose Folder…',
    setting_open_folder_btn: 'Open Folder',

    section_formats: 'Format & Quality Preferences',
    setting_def_video_format: 'Default Video Format',
    setting_def_video_format_desc: 'Container format for YouTube and video downloads',
    setting_def_video_quality: 'Default Video Quality',
    setting_def_video_quality_desc: 'Default resolution for newly added YouTube videos',
    setting_def_audio_format: 'Default Audio Format',
    setting_def_audio_format_desc: 'Audio container used for music downloads',
    setting_def_audio_quality: 'Default Audio Quality (Bitrate)',
    setting_def_audio_quality_desc: 'Audio bitrate for YouTube and Spotify downloads',

    section_youtube: 'YouTube Options',
    setting_auto_subs: 'Embed Turkish Subtitles',
    setting_auto_subs_desc: 'Embed official or auto-generated Turkish subtitles into MP4/MKV video',

    section_spotify: 'Spotify Preferences',
    setting_smart_sync: 'Smart Playlist Sync',
    setting_smart_sync_desc: 'Skips already downloaded songs, downloads only new additions and missing files',
    setting_spotify_folder: 'Save Playlists in Subfolders',
    setting_spotify_folder_desc: 'Organize batch downloads inside a folder named after the playlist',
    setting_spotify_engine: 'Fast Download Engine',
    setting_spotify_engine_desc: 'Fetch audio streams via YouTube Music with optimized speed',
    setting_spotify_lyrics: 'Download Lyrics (.lrc)',
    setting_spotify_lyrics_desc: 'Automatically save synchronized lyrics (.lrc) alongside the track',

    section_system: 'System & Notifications',
    setting_notifications: 'Desktop Notifications',
    setting_notifications_desc: 'Show system notification when a download completes',
    setting_sound: 'Sound Alert',
    setting_sound_desc: 'Play a gentle sound effect upon download completion',

    section_about: 'About & Dependencies',
    about_desc: 'Yuki Downloader v1.0.0 — Modern macOS & Web Media Downloader',

    web_banner_text: '🌐 Yuki Web Edition — Direct browser media downloader. Download the macOS desktop app for advanced format conversions.',
    web_banner_btn: 'Download macOS App ↗',
    web_toast_download: 'Download started — saving file to your device…',
    web_download_started: 'Download started — fetching data…',
    web_download_complete: '✓ Download complete! File saved to your Downloads folder.',
    web_download_error: 'Could not fetch media stream. Please verify the URL.',
    web_folder_notice: 'In web mode, files are saved directly to your browser Downloads folder.',
  }
};

let currentLang = 'tr';

function t(key, params = {}) {
  const dict = translations[currentLang] || translations.tr;
  let str = dict[key] || translations.tr[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

function setLanguage(lang) {
  if (!translations[lang]) lang = 'tr';
  currentLang = lang;
  document.documentElement.lang = lang;

  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // Update title tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });

  // Update language switcher pill if exists
  const langText = document.getElementById('langText');
  if (langText) langText.textContent = lang === 'tr' ? 'EN' : 'TR';

  // Update settings select if exists
  const settingLanguage = document.getElementById('settingLanguage');
  if (settingLanguage && settingLanguage.value !== lang) {
    settingLanguage.value = lang;
  }

  // Dispatch custom event for renderer.js to refresh dynamic labels
  window.dispatchEvent(new CustomEvent('yuki-language-changed', { detail: { lang } }));
}

function initI18n(preferredLang) {
  const lang = preferredLang || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'tr');
  setLanguage(lang);
}

// Expose globally
window.yukiI18n = {
  t,
  setLanguage,
  initI18n,
  get currentLang() { return currentLang; },
  translations,
};
