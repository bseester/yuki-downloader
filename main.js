const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, Notification } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const https = require('https');

// ─── Paths & Config ────────────────────────────────────────────────────────────
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'yuki_settings.json');

const DEFAULT_SETTINGS = {
  downloadDir: DOWNLOADS_DIR,
  defaultVideoQuality: '1080p',
  defaultAudioQuality: '320k',
  autoTurkishSubtitles: true,
  spotifyPlaylistFolder: true,
  spotifyDownloadLyrics: false,
  spotifyLyricsLrc: false,
  spotifyFastEngine: true,
  systemNotifications: true,
  soundAlert: true,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettingsToDisk(newSettings) {
  try {
    const merged = { ...loadSettings(), ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    console.error('Settings save error:', e);
    return loadSettings();
  }
}

// ─── Binaries Detection ───────────────────────────────────────────────────────
function findBin(name) {
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    `/Library/Frameworks/Python.framework/Versions/3.13/bin/${name}`,
    `/Library/Frameworks/Python.framework/Versions/3.12/bin/${name}`,
    `/Library/Frameworks/Python.framework/Versions/3.11/bin/${name}`,
    path.join(os.homedir(), `Library/Python/3.13/bin/${name}`),
    path.join(os.homedir(), `Library/Python/3.12/bin/${name}`),
    path.join(os.homedir(), `Library/Python/3.11/bin/${name}`),
    path.join(os.homedir(), `Library/Python/3.9/bin/${name}`),
    path.join(os.homedir(), `.local/bin/${name}`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return execSync(`which ${name}`, { encoding: 'utf8' }).trim();
  } catch {
    return name;
  }
}

const YTDLP_BIN  = findBin('yt-dlp');
const FFMPEG_BIN = findBin('ffmpeg');
const SPOTDL_BIN = findBin('spotdl');

function getBinVersion(binPath, flag = '--version') {
  if (!fs.existsSync(binPath)) return null;
  try {
    const out = execSync(`"${binPath}" ${flag}`, {
      timeout: 3000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().split('\n')[0];
  } catch {
    return 'Kurulu';
  }
}

// ─── URL Helpers ──────────────────────────────────────────────────────────────
function isSpotifyUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'open.spotify.com';
  } catch { return false; }
}

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
const activeProcesses = new Map(); // id → ChildProcess

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 660,
    minWidth: 700,
    minHeight: 540,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    transparent: true,
    frame: false,
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: ICON_PATH,
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconSize = 16;
  const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: iconSize, height: iconSize });
  tray = new Tray(trayIcon);
  tray.setToolTip('Yuki Downloader');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Aç / Open', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: 'separator' },
    { label: 'Çıkış / Quit', role: 'quit' },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // macOS behavior: keep tray active
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Settings
ipcMain.handle('get-settings', () => loadSettings());

ipcMain.handle('save-settings', (_evt, newSettings) => {
  return saveSettingsToDisk(newSettings);
});

// Tools Status
ipcMain.handle('get-tools-status', () => {
  const ytdlpExists = fs.existsSync(YTDLP_BIN);
  const ffmpegExists = fs.existsSync(FFMPEG_BIN);
  const spotdlExists = fs.existsSync(SPOTDL_BIN);

  return {
    ytdlp: {
      path: YTDLP_BIN,
      exists: ytdlpExists,
      version: ytdlpExists ? getBinVersion(YTDLP_BIN, '--version') : null,
    },
    ffmpeg: {
      path: FFMPEG_BIN,
      exists: ffmpegExists,
      version: ffmpegExists ? getBinVersion(FFMPEG_BIN, '-version')?.split(' ')[2] : null,
    },
    spotdl: {
      path: SPOTDL_BIN,
      exists: spotdlExists,
      version: spotdlExists ? getBinVersion(SPOTDL_BIN, '--version') : null,
    },
  };
});

// Fetch video/track metadata + thumbnail
ipcMain.handle('fetch-info', async (_evt, url) => {
  if (isSpotifyUrl(url)) return fetchSpotifyInfo(url);
  return fetchYtdlpInfo(url);
});

function fetchYtdlpInfo(url) {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', url];
    const proc = spawn(YTDLP_BIN, args, {
      env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' }
    });
    let raw = '';
    let err = '';

    proc.stdout.on('data', d => (raw += d));
    proc.stderr.on('data', d => (err += d));

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(err || 'yt-dlp bilgisi alınamadı'));
      try {
        const info = JSON.parse(raw);
        resolve({
          title: info.title,
          channel: info.uploader || info.channel || '',
          duration: info.duration_string || formatDuration(info.duration),
          thumbnail: info.thumbnail,
          formats: parseFormats(info.formats || []),
          source: 'youtube',
          isPlaylist: false,
        });
      } catch {
        reject(new Error('JSON parse error'));
      }
    });
  });
}

function fetchSpotifyInfo(url) {
  return new Promise((resolve, reject) => {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    https.get(oembedUrl, (res) => {
      let raw = '';
      res.on('data', d => (raw += d));
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const isPlaylist = url.includes('/playlist/');
          const isAlbum    = url.includes('/album/');
          const isArtist   = url.includes('/artist/');

          let spotifyType = 'track';
          let channelLabel = 'Spotify';
          let durationLabel = '';

          if (isPlaylist) {
            spotifyType = 'playlist';
            channelLabel = 'Spotify Çalma Listesi';
            durationLabel = 'Toplu İndirme';
          } else if (isAlbum) {
            spotifyType = 'album';
            channelLabel = 'Spotify Albümü';
            durationLabel = 'Toplu İndirme';
          } else if (isArtist) {
            spotifyType = 'artist';
            channelLabel = 'Spotify Sanatçısı';
            durationLabel = 'Toplu İndirme';
          }

          const fullTitle = data.title || (isPlaylist ? 'Spotify Çalma Listesi' : 'Spotify Parça');
          const dashIdx   = fullTitle.lastIndexOf(' - ');
          const title     = (dashIdx > -1 && !isPlaylist && !isAlbum) ? fullTitle.slice(0, dashIdx).trim() : fullTitle;
          const artist    = (dashIdx > -1 && !isPlaylist && !isAlbum) ? fullTitle.slice(dashIdx + 3).trim() : channelLabel;

          resolve({
            title,
            channel:   artist,
            duration:  durationLabel,
            thumbnail: data.thumbnail_url || '',
            formats:   { video: [], audio: ['320k', '192k', '128k'] },
            source:    'spotify',
            spotifyType,
            isPlaylist: isPlaylist || isAlbum || isArtist,
          });
        } catch (e) {
          reject(new Error('Spotify bilgisi alınamadı: ' + e.message));
        }
      });
    }).on('error', (e) => {
      reject(new Error('Spotify bağlantı hatası: ' + e.message));
    });
  });
}

// Start download — routes to yt-dlp or spotdl
ipcMain.on('start-download', (evt, { id, url, format, quality, outputDir, source, isPlaylist, autoTurkishSubtitles, downloadLyrics, lyricsLrc }) => {
  if (source === 'spotify' || isSpotifyUrl(url)) {
    startSpotifyDownload(evt, { id, url, quality, outputDir, isPlaylist, downloadLyrics, lyricsLrc });
  } else {
    startYtdlpDownload(evt, { id, url, format, quality, outputDir, autoTurkishSubtitles });
  }
});

function startYtdlpDownload(evt, { id, url, format, quality, outputDir, autoTurkishSubtitles }) {
  const settings = loadSettings();
  const dir = outputDir || settings.downloadDir || DOWNLOADS_DIR;
  const useAutoSubs = autoTurkishSubtitles !== undefined ? autoTurkishSubtitles : (settings.autoTurkishSubtitles !== false);
  const args = buildArgs(url, format, quality, dir, useAutoSubs);
  const proc = spawn(YTDLP_BIN, args, { env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' } });
  activeProcesses.set(id, proc);

  proc.stdout.on('data', data => {
    const line = data.toString();
    const m = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\s*\S+\/s).*?ETA\s+([\d:]+)/);
    if (m) evt.sender.send('download-progress', { id, percent: parseFloat(m[1]), speed: m[2], eta: m[3] });
    if (line.includes('[download] 100%') || line.includes('has already been downloaded'))
      evt.sender.send('download-progress', { id, percent: 100, speed: '', eta: '' });
  });

  proc.stderr.on('data', data => {
    // Only logged for debugging
  });

  proc.on('close', code => {
    activeProcesses.delete(id);
    if (code === 0) {
      evt.sender.send('download-complete', { id });
      if (settings.systemNotifications) {
        showNotification('İndirme Tamamlandı ✓', 'Dosyanız klasöre kaydedildi.');
      }
    } else if (code !== null) {
      evt.sender.send('download-error', { id, message: `Hata kodu: ${code}` });
    }
  });
}

function startSpotifyDownload(evt, { id, url, quality, outputDir, isPlaylist, downloadLyrics, lyricsLrc }) {
  const settings = loadSettings();
  const dir = outputDir || settings.downloadDir || DOWNLOADS_DIR;
  const bitrate = quality || settings.defaultAudioQuality || '320k';
  const isBatch = isPlaylist || url.includes('/playlist/') || url.includes('/album/') || url.includes('/artist/');

  const shouldDownloadLyrics = downloadLyrics !== undefined
    ? downloadLyrics
    : (settings.spotifyDownloadLyrics === true);

  const shouldGenerateLrc = lyricsLrc !== undefined
    ? lyricsLrc
    : (settings.spotifyLyricsLrc === true);

  // Output formatting:
  // If batch & playlistFolder setting is on, put tracks inside a subfolder named after the list
  const outputTemplate = (isBatch && settings.spotifyPlaylistFolder)
    ? path.join(dir, '{list-name}', '{artist} - {title}.{output-ext}')
    : path.join(dir, '{artist} - {title}.{output-ext}');

  const args = [
    url,
    '--output', outputTemplate,
    '--bitrate', bitrate,
  ];

  // Disable lyrics providers if lyrics download is turned off
  if (!shouldDownloadLyrics) {
    args.push('--lyrics');
  }

  args.push(
    '--format', 'mp3',
    '--ffmpeg', FFMPEG_BIN,
    '--simple-tui'
  );

  // Fast audio engine preference
  if (settings.spotifyFastEngine) {
    args.push('--audio', 'youtube', 'youtube-music');
  }

  // Lyrics option (.lrc file)
  if (shouldDownloadLyrics && shouldGenerateLrc) {
    args.push('--generate-lrc');
  }

  const proc = spawn(SPOTDL_BIN, args, {
    env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/3.13/bin' }
  });
  activeProcesses.set(id, proc);

  let stderrBuffer = '';
  let downloadedCount = 0;
  let totalCount = isBatch ? 0 : 1;
  let currentSong = '';

  // Immediate status feedback so the UI never sits empty
  evt.sender.send('download-progress', {
    id,
    percent: 5,
    speed: isBatch ? 'Çalma listesi taranıyor…' : 'Şarkı aranıyor…',
    eta: ''
  });

  function parseOutput(data) {
    const text = data.toString();
    const lines = text.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Found X songs in playlist
      const mFound = line.match(/Found\s+(\d+)\s+songs?/i);
      if (mFound) {
        totalCount = parseInt(mFound[1], 10);
        evt.sender.send('download-progress', {
          id,
          percent: 10,
          speed: `${totalCount} şarkı bulundu, indiriliyor…`,
          eta: ''
        });
      }

      // Progress: "X/Y complete" or "Downloaded X/Y"
      const mComplete = line.match(/(\d+)\/(\d+)\s+(?:complete|songs?)/i);
      if (mComplete) {
        downloadedCount = parseInt(mComplete[1], 10);
        totalCount = parseInt(mComplete[2], 10);
        const pct = Math.min(99, Math.max(10, Math.round((downloadedCount / totalCount) * 100)));
        evt.sender.send('download-progress', {
          id,
          percent: pct,
          speed: `${downloadedCount}/${totalCount} şarkı tamamlandı`,
          eta: ''
        });
      }

      // Searching for a song: "Artist - Title: Searching for song"
      const mSearching = line.match(/^(.+?):\s*Searching for song/i);
      if (mSearching) {
        currentSong = mSearching[1].trim();
        const pct = (isBatch && totalCount > 0)
          ? Math.min(95, Math.max(10, Math.round((downloadedCount / totalCount) * 100)))
          : 30;
        const label = (isBatch && totalCount > 0)
          ? `[${downloadedCount + 1}/${totalCount}] ${currentSong}`
          : `Aranıyor: ${currentSong}`;
        evt.sender.send('download-progress', { id, percent: pct, speed: label, eta: '' });
      }

      // Downloaded single song
      const mDl = line.match(/Downloaded\s+"([^"]+)"/i);
      if (mDl) {
        currentSong = mDl[1];
        if (!isBatch) {
          evt.sender.send('download-progress', {
            id,
            percent: 98,
            speed: `İndirildi: ${currentSong}`,
            eta: ''
          });
        }
      }

      // Subprocess percentage like "64.2%"
      const mPct = line.match(/(\d+(?:\.\d+)?)%/);
      if (mPct) {
        const itemPct = parseFloat(mPct[1]);
        if (!isBatch) {
          const mapped = Math.min(95, Math.round(25 + (itemPct * 0.7)));
          evt.sender.send('download-progress', { id, percent: mapped, speed: 'İndiriliyor…', eta: '' });
        }
      }
    }
  }

  proc.stdout.on('data', parseOutput);
  proc.stderr.on('data', d => {
    stderrBuffer += d.toString();
    parseOutput(d);
  });

  proc.on('close', code => {
    activeProcesses.delete(id);
    if (code === 0) {
      evt.sender.send('download-progress', { id, percent: 100, speed: '', eta: '' });
      evt.sender.send('download-complete', { id });
      if (settings.systemNotifications) {
        showNotification(
          isBatch ? 'Spotify Çalma Listesi İndirildi ✓' : 'Spotify MP3 İndirildi ✓',
          `Dosyalar ${dir} klasörüne kaydedildi.`
        );
      }
    } else if (code !== null) {
      const cleanErr = stderrBuffer.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.includes('Processing query'))
        .slice(-2)
        .join(' ') || `spotdl hata kodu: ${code}`;
      evt.sender.send('download-error', { id, message: cleanErr.slice(0, 100) });
    }
  });
}

// Cancel download
ipcMain.on('cancel-download', (_evt, id) => {
  const proc = activeProcesses.get(id);
  if (proc) {
    proc.kill('SIGKILL');
    activeProcesses.delete(id);
  }
});

// Open in Finder
ipcMain.on('show-in-finder', (_evt, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  } else {
    const settings = loadSettings();
    shell.openPath(settings.downloadDir || DOWNLOADS_DIR);
  }
});

// Open Downloads folder
ipcMain.on('open-downloads', () => {
  const settings = loadSettings();
  shell.openPath(settings.downloadDir || DOWNLOADS_DIR);
});

// Choose save folder
ipcMain.handle('choose-folder', async () => {
  const settings = loadSettings();
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: settings.downloadDir || DOWNLOADS_DIR,
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildArgs(url, format, quality, dir, autoTurkishSubtitles = true) {
  const output = path.join(dir, '%(title)s.%(ext)s');

  if (format === 'mp3') {
    const audioBitrate = quality || '320k';
    return [
      '--ffmpeg-location', path.dirname(FFMPEG_BIN),
      '-x', '--audio-format', 'mp3',
      '--audio-quality', audioBitrate,
      '-o', output,
      '--no-playlist',
      url,
    ];
  }

  // MP4
  const heightMap = { '4K': 2160, '1080p': 1080, '720p': 720, '480p': 480 };
  const h = heightMap[quality] || 1080;
  const args = [
    '--ffmpeg-location', path.dirname(FFMPEG_BIN),
    '-f', `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
    '--merge-output-format', 'mp4',
    '-o', output,
    '--no-playlist',
  ];

  // Embed Turkish auto-subtitles or official subtitles
  if (autoTurkishSubtitles !== false) {
    args.push(
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'tr,tr-orig',
      '--embed-subs',
      '--compat-options', 'no-keep-subs'
    );
  }

  args.push(url);
  return args;
}

function parseFormats(formats) {
  const heights = [...new Set(
    formats
      .filter(f => f.height && f.vcodec !== 'none')
      .map(f => f.height)
  )].sort((a, b) => b - a).slice(0, 5);

  const videoQualities = heights.map(h => {
    if (h >= 2160) return '4K';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    return `${h}p`;
  });

  return { video: videoQualities.length ? videoQualities : ['1080p', '720p'], audio: ['320k', '192k', '128k'] };
}

function formatDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}
