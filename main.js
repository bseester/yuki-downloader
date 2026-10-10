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
const HISTORY_FILE  = path.join(app.getPath('userData'), 'yuki_history.json');

const MAX_HISTORY = 100;

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) { console.error('History load error:', e); }
  return [];
}

function saveHistoryEntry(entry) {
  try {
    const list = loadHistory();
    // Remove duplicate (same id) if somehow present
    const deduped = list.filter(e => e.id !== entry.id);
    deduped.unshift(entry); // newest first
    const trimmed = deduped.slice(0, MAX_HISTORY);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    return trimmed;
  } catch (e) { console.error('History save error:', e); return []; }
}

function removeHistoryEntry(id) {
  try {
    const list = loadHistory().filter(e => e.id !== id);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8');
    return list;
  } catch (e) { console.error('History remove error:', e); return []; }
}

function clearHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
  } catch (e) { console.error('History clear error:', e); }
}

const DEFAULT_SETTINGS = {
  downloadDir: DOWNLOADS_DIR,
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

// Download History
ipcMain.handle('get-history', () => loadHistory());
ipcMain.handle('save-history-entry', (_evt, entry) => saveHistoryEntry(entry));
ipcMain.handle('remove-history-entry', (_evt, id) => removeHistoryEntry(id));
ipcMain.on('clear-history', () => clearHistory());

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
    const isPlaylist = url.includes('list=');
    const args = isPlaylist
      ? ['--dump-single-json', '--flat-playlist', '--playlist-items', '1', url]
      : ['--dump-json', '--no-playlist', url];
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
          channel: info.uploader || info.channel || (isPlaylist ? 'YouTube Çalma Listesi' : ''),
          duration: isPlaylist ? 'Toplu Çalma Listesi' : (info.duration_string || formatDuration(info.duration)),
          thumbnail: (info.thumbnails && info.thumbnails.length) ? info.thumbnails[info.thumbnails.length - 1].url : (info.thumbnail || ''),
          formats: parseFormats(info.formats || []),
          source: 'youtube',
          isPlaylist: Boolean(isPlaylist),
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
            formats:   {
              video: [],
              audio: ['320k', '256k', '192k', '128k'],
              videoFormats: [],
              audioFormats: ['mp3', 'flac', 'm4a', 'wav', 'opus', 'ogg']
            },
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
    startSpotifyDownload(evt, { id, url, format, quality, outputDir, isPlaylist, downloadLyrics, lyricsLrc });
  } else {
    startYtdlpDownload(evt, { id, url, format, quality, outputDir, isPlaylist, autoTurkishSubtitles });
  }
});

function startYtdlpDownload(evt, { id, url, format, quality, outputDir, isPlaylist, autoTurkishSubtitles }) {
  const settings = loadSettings();
  const dir = outputDir || settings.downloadDir || DOWNLOADS_DIR;
  const useAutoSubs = autoTurkishSubtitles !== undefined ? autoTurkishSubtitles : (settings.autoTurkishSubtitles !== false);
  const args = buildArgs(url, format, quality, dir, useAutoSubs, isPlaylist);
  const proc = spawn(YTDLP_BIN, args, { env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' } });
  activeProcesses.set(id, proc);

  let playlistCurrent = 0;
  let playlistTotal = 0;

  proc.stdout.on('data', data => {
    const line = data.toString();

    // Playlist item indicator (e.g. "[download] Downloading item 3 of 42")
    const mItem = line.match(/\[download\]\s+Downloading\s+(?:item|video)\s+(\d+)\s+of\s+(\d+)/i);
    if (mItem) {
      playlistCurrent = parseInt(mItem[1], 10);
      playlistTotal = parseInt(mItem[2], 10);
      const pct = Math.round((playlistCurrent / playlistTotal) * 100);
      evt.sender.send('download-progress', { id, percent: pct, speed: `[${playlistCurrent}/${playlistTotal}] İndiriliyor…`, eta: '' });
    }

    // Existing file skipped (smart sync: checks disk before downloading)
    if (line.includes('has already been downloaded')) {
      const mName = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/);
      const name = mName ? path.basename(mName[1]) : 'Dosya';
      const pct = playlistTotal > 0 ? Math.round((playlistCurrent / playlistTotal) * 100) : 100;
      const speedText = playlistTotal > 0
        ? `[${playlistCurrent}/${playlistTotal}] Atlandı (Mevcut): ${name}`
        : `Atlandı (Mevcut): ${name}`;
      evt.sender.send('download-progress', { id, percent: pct, speed: speedText, eta: '' });
    }

    // Percentage progress
    const m = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\s*\S+\/s).*?ETA\s+([\d:]+)/);
    if (m) {
      let pct = parseFloat(m[1]);
      let speedText = m[2];
      if (playlistTotal > 0) {
        pct = Math.min(99, Math.round(((Math.max(0, playlistCurrent - 1) + (pct / 100)) / playlistTotal) * 100));
        speedText = `[${playlistCurrent}/${playlistTotal}] ${m[2]}`;
      }
      evt.sender.send('download-progress', { id, percent: pct, speed: speedText, eta: m[3] });
    }
    if (line.includes('[download] 100%') && playlistTotal === 0) {
      evt.sender.send('download-progress', { id, percent: 100, speed: '', eta: '' });
    }
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

function startSpotifyDownload(evt, { id, url, format, quality, outputDir, isPlaylist, downloadLyrics, lyricsLrc }) {
  const settings = loadSettings();
  const dir = outputDir || settings.downloadDir || DOWNLOADS_DIR;
  const audioFormat = (format || settings.defaultAudioFormat || 'mp3').toLowerCase();
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
  ];

  // Only pass bitrate for lossy formats (mp3, m4a, opus)
  if (!['flac', 'wav'].includes(audioFormat)) {
    args.push('--bitrate', bitrate);
  }

  // Smart Sync for playlists/batches: check if files are on disk, skip existing, only download new; redownload if deleted
  // scan-for-songs checks the output dir for existing files matching the output format; missing = redownload, present = skip
  if (settings.spotifySmartSync !== false) {
    args.push('--overwrite', 'skip');
    if (isBatch) {
      args.push('--scan-for-songs');
    }
  }

  // Disable lyrics providers if lyrics download is turned off
  // Passing --lyrics with zero providers makes spotdl use an empty lyrics_providers list
  if (!shouldDownloadLyrics) {
    args.push('--lyrics'); // no provider args → empty list → no lyrics fetched
  }

  args.push(
    '--format', audioFormat,
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

      // Skipped existing song (smart playlist sync)
      const mSkip = line.match(/Skipping\s+["']?([^"']+)["']?\s+as it already exists/i) || line.match(/Skipped:\s*(.+)/i);
      if (mSkip) {
        const skippedSong = mSkip[1];
        downloadedCount++;
        const pct = (isBatch && totalCount > 0)
          ? Math.min(99, Math.round((downloadedCount / totalCount) * 100))
          : 100;
        evt.sender.send('download-progress', {
          id,
          percent: pct,
          speed: isBatch
            ? `[${downloadedCount}/${totalCount}] Atlandı (Mevcut): ${skippedSong}`
            : `Mevcut dosya atlandı: ${skippedSong}`,
          eta: ''
        });
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
function buildArgs(url, format = 'mp4', quality = '1080p', dir = DOWNLOADS_DIR, autoTurkishSubtitles = true, isPlaylist = false) {
  const fmt = (format || 'mp4').toLowerCase();
  const isAudio = ['mp3', 'flac', 'm4a', 'wav', 'opus', 'ogg'].includes(fmt);
  const hasPlaylist = isPlaylist || url.includes('list=');
  const output = hasPlaylist
    ? path.join(dir, '%(playlist_title,playlist)s', '%(title)s.%(ext)s')
    : path.join(dir, '%(title)s.%(ext)s');

  if (isAudio) {
    const audioFmt = fmt === 'ogg' ? 'vorbis' : fmt;
    const audioBitrate = quality || '320k';
    const args = [
      '--ffmpeg-location', path.dirname(FFMPEG_BIN),
      '-x', '--audio-format', audioFmt,
      '-o', output,
      '--no-overwrites',
    ];

    if (['mp3', 'm4a', 'opus', 'vorbis'].includes(audioFmt)) {
      args.push('--audio-quality', audioBitrate);
    }

    if (hasPlaylist) {
      args.push('--yes-playlist');
    } else {
      args.push('--no-playlist');
    }

    args.push(url);
    return args;
  }

  // Video formats: mp4, mkv, webm, mov
  const heightMap = { '4K': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
  const h = heightMap[quality] || 1080;
  const args = [
    '--ffmpeg-location', path.dirname(FFMPEG_BIN),
    '-f', `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
    '--merge-output-format', fmt,
    '-o', output,
    '--no-overwrites',
  ];

  if (hasPlaylist) {
    args.push('--yes-playlist');
  } else {
    args.push('--no-playlist');
  }

  // Embed Turkish auto-subtitles or official subtitles
  if (autoTurkishSubtitles !== false && ['mp4', 'mkv', 'webm'].includes(fmt)) {
    args.push(
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'tr,tr-en,tr-orig',
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

  return {
    video: videoQualities.length ? videoQualities : ['1080p', '720p'],
    audio: ['320k', '256k', '192k', '128k'],
    videoFormats: ['mp4', 'mkv', 'webm', 'mov'],
    audioFormats: ['mp3', 'flac', 'm4a', 'wav', 'opus'],
  };
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
