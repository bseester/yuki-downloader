const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, Notification, systemPreferences } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// ─── Paths ────────────────────────────────────────────────────────────────────
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const ICON_PATH     = path.join(__dirname, 'assets', 'icon.png');

// Try to locate yt-dlp and ffmpeg from common macOS locations
function findBin(name) {
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return execSync(`which ${name}`, { encoding: 'utf8' }).trim();
  } catch {
    return name; // fallback – let PATH resolve
  }
}

const YTDLP_BIN  = findBin('yt-dlp');
const FFMPEG_BIN = findBin('ffmpeg');

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
const activeProcesses = new Map(); // id → ChildProcess

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 620,
    minWidth: 680,
    minHeight: 520,
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
  // Inline 16×16 PNG (simple arrow‑down icon) as base64 so no external asset needed
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
  // On macOS keep the tray alive even if all windows closed
  // The app quits only via tray menu → Quit
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Fetch video metadata + thumbnail
ipcMain.handle('fetch-info', async (_evt, url) => {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', url];
    const proc = spawn(YTDLP_BIN, args);
    let raw = '';
    let err = '';

    proc.stdout.on('data', d => (raw += d));
    proc.stderr.on('data', d => (err += d));

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(err || 'yt-dlp failed'));
      try {
        const info = JSON.parse(raw);
        resolve({
          title:     info.title,
          channel:   info.uploader || info.channel || '',
          duration:  info.duration_string || formatDuration(info.duration),
          thumbnail: info.thumbnail,
          formats:   parseFormats(info.formats || []),
        });
      } catch {
        reject(new Error('JSON parse error'));
      }
    });
  });
});

// Start download
ipcMain.on('start-download', (evt, { id, url, format, quality, outputDir }) => {
  const dir = outputDir || DOWNLOADS_DIR;
  const args = buildArgs(url, format, quality, dir);

  const proc = spawn(YTDLP_BIN, args, { env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' } });
  activeProcesses.set(id, proc);

  let lastSpeed = '';
  let lastEta   = '';

  proc.stdout.on('data', data => {
    const line = data.toString();
    // [download]  12.3% of 45.67MiB at  1.23MiB/s ETA 00:35
    const m = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\s*\S+\/s).*?ETA\s+([\d:]+)/);
    if (m) {
      lastSpeed = m[2];
      lastEta   = m[3];
      evt.sender.send('download-progress', { id, percent: parseFloat(m[1]), speed: lastSpeed, eta: lastEta });
    }
    if (line.includes('[download] 100%') || line.includes('has already been downloaded')) {
      evt.sender.send('download-progress', { id, percent: 100, speed: '', eta: '' });
    }
  });

  proc.stderr.on('data', data => {
    const line = data.toString();
    if (line.includes('ERROR')) {
      evt.sender.send('download-error', { id, message: line.trim() });
    }
  });

  proc.on('close', code => {
    activeProcesses.delete(id);
    if (code === 0) {
      evt.sender.send('download-complete', { id });
      showNotification('İndirme Tamamlandı ✓', `Dosyanız Downloads klasörüne kaydedildi.`);
    } else if (code !== null) {
      evt.sender.send('download-error', { id, message: `İşlem hata koduyla kapandı: ${code}` });
    }
  });
});

// Cancel download
ipcMain.on('cancel-download', (_evt, id) => {
  const proc = activeProcesses.get(id);
  if (proc) { proc.kill(); activeProcesses.delete(id); }
});

// Open in Finder
ipcMain.on('show-in-finder', (_evt, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  } else {
    shell.openPath(DOWNLOADS_DIR);
  }
});

// Open Downloads folder
ipcMain.on('open-downloads', () => shell.openPath(DOWNLOADS_DIR));

// Choose save folder
ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: DOWNLOADS_DIR,
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildArgs(url, format, quality, dir) {
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
  const heightMap = { '4K': 2160, '1080p': 1080, '720p': 720 };
  const h = heightMap[quality] || 1080;
  return [
    '--ffmpeg-location', path.dirname(FFMPEG_BIN),
    '-f', `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
    '--merge-output-format', 'mp4',
    '-o', output,
    '--no-playlist',
    url,
  ];
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
    if (h >= 720)  return '720p';
    if (h >= 480)  return '480p';
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
