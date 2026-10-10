// ─── Yuki Web Adapter & Polyfill (for Browser & GitHub Pages) ───────────────────

(function () {
  // If running inside Electron desktop app with preload API, do nothing
  if (window.api && !window.api.isWeb) {
    return;
  }

  console.log('🌐 Yuki: Running in Web / GitHub Pages mode. Initializing web adapter.');

  const progressListeners = new Set();
  const completeListeners = new Set();
  const errorListeners    = new Set();
  const activeSimulations = new Map();

  const DEFAULT_SETTINGS = {
    downloadDir: '~/Downloads (Tarayıcı)',
    defaultVideoFormat: 'mp4',
    defaultAudioFormat: 'mp3',
    defaultVideoQuality: '1080p',
    defaultAudioQuality: '320k',
    autoTurkishSubtitles: true,
    spotifyPlaylistFolder: true,
    spotifyDownloadLyrics: false,
    spotifyLyricsLrc: false,
    spotifyFastEngine: true,
    spotifySmartSync: true,
    systemNotifications: true,
    soundAlert: true,
    language: 'tr',
  };

  function loadSettings() {
    try {
      const stored = localStorage.getItem('yuki_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSetting(key, val) {
    try {
      const s = loadSettings();
      s[key] = val;
      localStorage.setItem('yuki_settings', JSON.stringify(s));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function loadHistory() {
    try {
      const stored = localStorage.getItem('yuki_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveHistoryEntry(entry) {
    try {
      const list = loadHistory();
      const deduped = list.filter(e => e.id !== entry.id);
      deduped.unshift(entry);
      const trimmed = deduped.slice(0, 100);
      localStorage.setItem('yuki_history', JSON.stringify(trimmed));
      return trimmed;
    } catch {
      return [];
    }
  }

  function removeHistoryEntry(id) {
    try {
      const list = loadHistory().filter(e => e.id !== id);
      localStorage.setItem('yuki_history', JSON.stringify(list));
      return list;
    } catch {
      return [];
    }
  }

  function clearHistory() {
    try {
      localStorage.removeItem('yuki_history');
    } catch {}
    return [];
  }

  function showToast(msg) {
    let toast = document.getElementById('yukiWebToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yukiWebToast';
      toast.className = 'web-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // Real metadata fetch via CORS-enabled oEmbed services
  async function fetchInfo(url) {
    const isSpotify = url.includes('spotify.com');
    const isPlaylist = url.includes('/playlist/') || url.includes('/album/') || url.includes('list=');

    try {
      if (isSpotify) {
        // Spotify oEmbed
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl);
        if (!res.ok) throw new Error('Spotify API yanıt vermedi');
        const data = await res.json();
        return {
          title: data.title || 'Spotify Parça',
          channel: 'Spotify',
          duration: isPlaylist ? 'Toplu İndirme' : '',
          thumbnail: data.thumbnail_url || 'assets/icon.png',
          formats: {
            video: [],
            audio: ['320k', '256k', '192k', '128k'],
            videoFormats: [],
            audioFormats: ['mp3', 'flac', 'm4a', 'wav', 'opus']
          },
          source: 'spotify',
          isPlaylist,
        };
      }

      // YouTube via noembed
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Video bilgisi alınamadı');
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      return {
        title: data.title || 'YouTube Video',
        channel: data.author_name || 'YouTube',
        duration: isPlaylist ? 'Toplu Çalma Listesi' : '03:45',
        thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${extractYtId(url)}/hqdefault.jpg`,
        formats: {
          video: ['4K', '1080p', '720p', '480p'],
          audio: ['320k', '256k', '192k', '128k'],
          videoFormats: ['mp4', 'mkv', 'webm', 'mov'],
          audioFormats: ['mp3', 'flac', 'm4a', 'wav', 'opus']
        },
        source: 'youtube',
        isPlaylist,
      };
    } catch (err) {
      // Graceful fallback metadata when offline or blocked
      return {
        title: isSpotify ? 'Spotify İçeriği' : 'YouTube Medyası',
        channel: isSpotify ? 'Spotify' : 'YouTube Kanalı',
        duration: isPlaylist ? 'Toplu Liste' : '04:12',
        thumbnail: 'assets/icon.png',
        formats: {
          video: ['1080p', '720p', '480p'],
          audio: ['320k', '256k', '192k'],
          videoFormats: ['mp4', 'mkv', 'webm'],
          audioFormats: ['mp3', 'flac', 'm4a']
        },
        source: isSpotify ? 'spotify' : 'youtube',
        isPlaylist,
      };
    }
  }

  function extractYtId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function startDownload(opts) {
    const { id } = opts;
    const isPlaylist = opts.isPlaylist;

    const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
    showToast(t('web_toast_download'));

    let current = 0;
    const totalSteps = 6;
    const timer = setInterval(() => {
      current++;
      const pct = Math.min(100, Math.round((current / totalSteps) * 100));
      const speed = isPlaylist
        ? `[1/1] ${(8 + Math.random() * 6).toFixed(1)} MB/s`
        : `${(10 + Math.random() * 8).toFixed(1)} MB/s`;

      progressListeners.forEach(cb => {
        try { cb({ id, percent: pct, speed, eta: `00:0${Math.max(1, totalSteps - current)}` }); } catch {}
      });

      if (current >= totalSteps) {
        clearInterval(timer);
        activeSimulations.delete(id);
        completeListeners.forEach(cb => {
          try { cb({ id }); } catch {}
        });
      }
    }, 450);

    activeSimulations.set(id, timer);
  }

  function cancelDownload(id) {
    if (activeSimulations.has(id)) {
      clearInterval(activeSimulations.get(id));
      activeSimulations.delete(id);
    }
  }

  // Polyfilled window.api
  window.api = {
    isWeb: true,
    fetchInfo,
    startDownload,
    cancelDownload,
    getSettings: async () => loadSettings(),
    saveSetting: async (key, val) => saveSetting(key, val),
    getHistory: async () => loadHistory(),
    saveHistoryEntry: async (entry) => saveHistoryEntry(entry),
    removeHistoryEntry: async (id) => removeHistoryEntry(id),
    clearHistory: async () => clearHistory(),
    chooseFolder: async () => {
      const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
      showToast(t('web_folder_notice'));
      return '~/Downloads';
    },
    openDownloads: () => {
      const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
      showToast(t('web_folder_notice'));
    },
    showInFinder: () => {
      const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
      showToast(t('web_folder_notice'));
    },
    getAppInfo: async () => ({
      ytdlp: 'Web Mode (oEmbed)',
      ffmpeg: 'Web Mode',
      spotdl: 'Web Mode',
      version: '1.0.0 (Web Edition)',
    }),
    onProgress: (cb) => progressListeners.add(cb),
    onComplete: (cb) => completeListeners.add(cb),
    onError: (cb) => errorListeners.add(cb),
  };
})();
