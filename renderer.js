/* ══════════════════════════════════════════════════════════
   Yuki Downloader — Renderer Logic
   ══════════════════════════════════════════════════════════ */

'use strict';

// ─── State ────────────────────────────────────────────────
let currentFormat    = 'mp4';
let currentQuality   = null;
let currentInfo      = null;
let currentSaveDir   = null;
let currentSource    = 'youtube'; // 'youtube' | 'spotify'
let fetchTimeout     = null;
let appSettings      = {};
const downloads      = new Map();

// ─── DOM refs ─────────────────────────────────────────────
// Navigation & Views
const navDownloaderBtn = document.getElementById('navDownloaderBtn');
const navSettingsBtn   = document.getElementById('navSettingsBtn');
const downloaderView   = document.getElementById('downloaderView');
const settingsView     = document.getElementById('settingsView');
const formatSwitcher   = document.getElementById('formatSwitcher');

// Downloader Elements
const urlInput          = document.getElementById('urlInput');
const pasteBtn          = document.getElementById('pasteBtn');
const clearBtn          = document.getElementById('clearBtn');
const previewSection    = document.getElementById('previewSection');
const skeletonWrap      = document.getElementById('skeletonWrap');
const previewContent    = document.getElementById('previewContent');
const previewError      = document.getElementById('previewError');
const thumbImg          = document.getElementById('thumbImg');
const durationBadge     = document.getElementById('durationBadge');
const videoTitle        = document.getElementById('videoTitle');
const playlistBadge     = document.getElementById('playlistBadge');
const videoChannel      = document.getElementById('videoChannel');
const qualityChips      = document.getElementById('qualityChips');
const savePath          = document.getElementById('savePath');
const downloadBtn       = document.getElementById('downloadBtn');
const downloadBtnText   = document.getElementById('downloadBtnText');
const downloadsList     = document.getElementById('downloadsList');
const emptyState        = document.getElementById('emptyState');
const errorMsg          = document.getElementById('errorMsg');
const retryBtn          = document.getElementById('retryBtn');
const changeFolderBtn   = document.getElementById('changeFolderBtn');
const openFolderBtn     = document.getElementById('openFolderBtn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

// Settings Elements
const settingDownloadPath          = document.getElementById('settingDownloadPath');
const settingChangeFolderBtn       = document.getElementById('settingChangeFolderBtn');
const settingOpenFolderBtn         = document.getElementById('settingOpenFolderBtn');
const settingDefaultVideoQuality   = document.getElementById('settingDefaultVideoQuality');
const settingDefaultAudioQuality   = document.getElementById('settingDefaultAudioQuality');
const settingSpotifyPlaylistFolder = document.getElementById('settingSpotifyPlaylistFolder');
const settingSpotifyFastEngine     = document.getElementById('settingSpotifyFastEngine');
const settingSpotifyLyrics         = document.getElementById('settingSpotifyLyrics');
const settingSystemNotifications   = document.getElementById('settingSystemNotifications');
const refreshToolsBtn              = document.getElementById('refreshToolsBtn');
const ytdlpPath                    = document.getElementById('ytdlpPath');
const ytdlpBadge                   = document.getElementById('ytdlpBadge');
const ffmpegPath                   = document.getElementById('ffmpegPath');
const ffmpegBadge                  = document.getElementById('ffmpegBadge');
const spotdlPath                   = document.getElementById('spotdlPath');
const spotdlBadge                  = document.getElementById('spotdlBadge');

// ─── Initialization ───────────────────────────────────────
async function initApp() {
  await loadAndApplySettings();
  loadToolsStatus();
}

// ─── View Navigation ──────────────────────────────────────
navDownloaderBtn.addEventListener('click', () => switchView('downloader'));
navSettingsBtn.addEventListener('click', () => switchView('settings'));

function switchView(view) {
  if (view === 'downloader') {
    navDownloaderBtn.classList.add('active');
    navDownloaderBtn.setAttribute('aria-selected', 'true');
    navSettingsBtn.classList.remove('active');
    navSettingsBtn.setAttribute('aria-selected', 'false');

    downloaderView.classList.remove('hidden');
    downloaderView.classList.add('active');
    settingsView.classList.add('hidden');
    settingsView.classList.remove('active');

    formatSwitcher.style.opacity = '1';
    formatSwitcher.style.pointerEvents = 'auto';
  } else {
    navSettingsBtn.classList.add('active');
    navSettingsBtn.setAttribute('aria-selected', 'true');
    navDownloaderBtn.classList.remove('active');
    navDownloaderBtn.setAttribute('aria-selected', 'false');

    settingsView.classList.remove('hidden');
    settingsView.classList.add('active');
    downloaderView.classList.add('hidden');
    downloaderView.classList.remove('active');

    formatSwitcher.style.opacity = '0.4';
    formatSwitcher.style.pointerEvents = 'none';
  }
}

// ─── Format Tabs ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentFormat = tab.dataset.format;
    currentQuality = null;
    if (currentInfo) renderQualities(currentInfo.formats);
  });
});

// ─── URL Input Handling ───────────────────────────────────
urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  clearBtn.classList.toggle('hidden', !val);
  updateSourceBadge(val);
  if (val) scheduleInfoFetch(val);
  else hidePreview();
});

urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    const val = urlInput.value.trim();
    updateSourceBadge(val);
    if (val) scheduleInfoFetch(val);
  }, 0);
});

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.dispatchEvent(new Event('input'));
  } catch {}
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  clearBtn.classList.add('hidden');
  hidePreview();
  currentInfo = null;
});

// ─── Folder Picker ────────────────────────────────────────
changeFolderBtn.addEventListener('click', async () => {
  const chosen = await window.api.chooseFolder();
  if (chosen) {
    currentSaveDir = chosen;
    savePath.textContent = chosen;
    settingDownloadPath.textContent = chosen;
    updateSetting('downloadDir', chosen);
  }
});

openFolderBtn.addEventListener('click', () => window.api.openDownloads());

// ─── Retry Fetch ──────────────────────────────────────────
retryBtn.addEventListener('click', () => {
  const val = urlInput.value.trim();
  if (val) fetchInfo(val);
});

// ─── Clear Completed ──────────────────────────────────────
clearCompletedBtn.addEventListener('click', () => {
  document.querySelectorAll('.dl-item[data-status="complete"], .dl-item[data-status="error"]').forEach(el => {
    removeDownloadItem(el.dataset.id);
  });
});

// ─── Download Button ──────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!currentInfo || !currentQuality) return;

  const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  downloads.set(id, {
    title:      currentInfo.title,
    thumb:      currentInfo.thumbnail,
    format:     currentFormat,
    quality:    currentQuality,
    source:     currentSource,
    isPlaylist: Boolean(currentInfo.isPlaylist),
  });

  addDownloadItem(id, currentInfo, currentFormat, currentQuality, currentSource);

  window.api.startDownload({
    id,
    url:        urlInput.value.trim(),
    format:     currentFormat,
    quality:    currentQuality,
    outputDir:  currentSaveDir,
    source:     currentSource,
    isPlaylist: Boolean(currentInfo.isPlaylist),
  });
});

// ─── IPC Events from Main Process ────────────────────────
window.api.onProgress(({ id, percent, speed, eta }) => {
  const item = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!item) return;

  const fill  = item.querySelector('.progress-fill');
  const stats = item.querySelector('.progress-stats');

  fill.classList.remove('indeterminate');
  fill.style.width = Math.min(100, Math.max(0, percent)) + '%';

  if (stats) {
    const left  = stats.children[0];
    const right = stats.children[1];
    if (left)  left.textContent  = speed ? speed : `${percent}%`;
    if (right) right.textContent = eta   ? `ETA ${eta}` : '';
  }
});

window.api.onComplete(({ id }) => {
  const item = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!item) return;
  item.dataset.status = 'complete';

  const fill = item.querySelector('.progress-fill');
  if (fill) fill.style.width = '100%';

  const badge = item.querySelector('.status-badge');
  if (badge) {
    badge.textContent = '✓ Tamamlandı';
    badge.className = 'status-badge complete';
  }

  const cancelBtn = item.querySelector('.dl-action-btn.danger');
  if (cancelBtn) cancelBtn.remove();

  const finderBtn = item.querySelector('.dl-action-btn[data-action="finder"]');
  if (finderBtn) finderBtn.classList.remove('hidden');

  const statsWrap = item.querySelector('.progress-stats');
  if (statsWrap) statsWrap.innerHTML = '<span>Tamamlandı</span>';
});

window.api.onError(({ id, message }) => {
  const item = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!item) return;
  item.dataset.status = 'error';

  const badge = item.querySelector('.status-badge');
  if (badge) {
    badge.textContent = '✗ Hata';
    badge.className = 'status-badge error';
  }

  const fill = item.querySelector('.progress-fill');
  if (fill) {
    fill.style.background = '#ff453a';
    fill.style.width = '100%';
  }

  const stats = item.querySelector('.progress-stats');
  if (stats) {
    stats.children[0].textContent = message?.slice(0, 60) || 'Bilinmeyen hata';
  }
});

// ─── Info Fetch ───────────────────────────────────────────
function scheduleInfoFetch(url) {
  if (fetchTimeout) clearTimeout(fetchTimeout);
  fetchTimeout = setTimeout(() => {
    if (isValidUrl(url)) fetchInfo(url);
    else hidePreview();
  }, 500);
}

async function fetchInfo(url) {
  showSkeleton();
  currentInfo = null;
  currentQuality = null;

  try {
    const info = await window.api.fetchInfo(url);
    currentInfo = info;
    showPreview(info);
  } catch (err) {
    showError(err.message || 'Bilgi alınamadı.');
  }
}

// ─── Preview Rendering ────────────────────────────────────
function showSkeleton() {
  previewSection.classList.remove('hidden');
  skeletonWrap.classList.remove('hidden');
  previewContent.classList.add('hidden');
  previewError.classList.add('hidden');
}

function showPreview(info) {
  skeletonWrap.classList.add('hidden');
  previewError.classList.add('hidden');

  thumbImg.src              = info.thumbnail || '';
  durationBadge.textContent = info.duration || '';
  videoTitle.textContent    = info.title || 'Bilinmeyen';
  videoChannel.textContent  = info.channel || '';

  currentSource = info.source || 'youtube';

  // Check if Spotify playlist or album
  if (info.isPlaylist) {
    playlistBadge.classList.remove('hidden');
    downloadBtnText.textContent = 'Tümünü İndir (Toplu Çalma Listesi)';
  } else {
    playlistBadge.classList.add('hidden');
    downloadBtnText.textContent = currentSource === 'spotify' ? 'İndir (MP3)' : 'İndir';
  }

  // For Spotify: force MP3 tab, hide MP4 tab
  if (currentSource === 'spotify') {
    currentFormat = 'mp3';
    document.querySelectorAll('.tab').forEach(t => {
      if (t.dataset.format === 'mp4') t.classList.add('hidden');
      if (t.dataset.format === 'mp3') {
        t.classList.add('active');
        t.setAttribute('aria-selected', 'true');
      }
    });
  } else {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('hidden'));
  }

  renderQualities(info.formats);
  savePath.textContent = currentSaveDir || appSettings.downloadDir || '~/Downloads';

  previewContent.classList.remove('hidden');
}

function renderQualities(formats) {
  qualityChips.innerHTML = '';
  const options = currentFormat === 'mp3' ? formats.audio : formats.video;

  // Check user default quality preference
  const defaultPref = currentFormat === 'mp3'
    ? (appSettings.defaultAudioQuality || '320k')
    : (appSettings.defaultVideoQuality || '1080p');

  let defaultIdx = options.indexOf(defaultPref);
  if (defaultIdx === -1) defaultIdx = 0;

  options.forEach((q, i) => {
    const isSelected = i === defaultIdx;
    const chip = document.createElement('button');
    chip.className   = 'quality-chip' + (isSelected ? ' selected' : '');
    chip.textContent = q;
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(isSelected));
    if (isSelected) currentQuality = q;

    chip.addEventListener('click', () => {
      qualityChips.querySelectorAll('.quality-chip').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('selected');
      chip.setAttribute('aria-checked', 'true');
      currentQuality = q;
    });

    qualityChips.appendChild(chip);
  });
}

function showError(msg) {
  skeletonWrap.classList.add('hidden');
  previewContent.classList.add('hidden');
  errorMsg.textContent = msg;
  previewError.classList.remove('hidden');
}

function hidePreview() {
  previewSection.classList.add('hidden');
}

// ─── Download List ────────────────────────────────────────
function addDownloadItem(id, info, format, quality, source) {
  emptyState.classList.add('hidden');

  const item = document.createElement('div');
  item.className    = 'dl-item';
  item.dataset.id   = id;
  item.dataset.status = 'downloading';

  const isSpotify  = source === 'spotify';
  const isPlaylist = Boolean(info.isPlaylist);

  let formatLabel = format.toUpperCase();
  let sourceBadge = '';

  if (isSpotify) {
    if (isPlaylist) {
      formatLabel = '🎵 Spotify Çalma Listesi';
      sourceBadge = '<span class="src-badge spotify">Toplu İndirme</span>';
    } else {
      formatLabel = '🎵 Spotify MP3';
      sourceBadge = '<span class="src-badge spotify">Spotify</span>';
    }
  }

  item.innerHTML = `
    <div class="dl-header">
      <img class="dl-thumb" src="${info.thumbnail || ''}" alt="" />
      <div class="dl-info">
        <div class="dl-title">${escHtml(info.title)}${sourceBadge}</div>
        <div class="dl-meta">
          <span>${formatLabel} · ${quality}</span>
          <span class="status-badge waiting">Hazırlanıyor…</span>
        </div>
      </div>
      <div class="dl-actions">
        <button class="dl-action-btn hidden" data-action="finder" title="Finder'da göster">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        </button>
        <button class="dl-action-btn danger" data-action="cancel" title="İptal et">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill indeterminate" style="width:0%"></div>
      </div>
      <div class="progress-stats">
        <span>${isPlaylist ? 'Çalma listesi taranıyor…' : 'Bağlanıyor…'}</span>
        <span></span>
      </div>
    </div>
  `;

  item.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    window.api.cancelDownload(id);
    removeDownloadItem(id);
  });

  item.querySelector('[data-action="finder"]')?.addEventListener('click', () => {
    window.api.showInFinder(null);
  });

  downloadsList.prepend(item);
}

function removeDownloadItem(id) {
  const el = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('removing');
  setTimeout(() => {
    el.remove();
    downloads.delete(id);
    if (!downloadsList.querySelector('.dl-item')) {
      emptyState.classList.remove('hidden');
    }
  }, 280);
}

// ─── Settings Logic ───────────────────────────────────────
async function loadAndApplySettings() {
  try {
    appSettings = await window.api.getSettings();
    currentSaveDir = appSettings.downloadDir;

    settingDownloadPath.textContent = appSettings.downloadDir || '~/Downloads';
    savePath.textContent = appSettings.downloadDir || '~/Downloads';

    settingDefaultVideoQuality.value = appSettings.defaultVideoQuality || '1080p';
    settingDefaultAudioQuality.value = appSettings.defaultAudioQuality || '320k';

    settingSpotifyPlaylistFolder.checked = appSettings.spotifyPlaylistFolder !== false;
    settingSpotifyFastEngine.checked     = appSettings.spotifyFastEngine !== false;
    settingSpotifyLyrics.checked         = Boolean(appSettings.spotifyLyrics);
    settingSystemNotifications.checked   = appSettings.systemNotifications !== false;
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

async function updateSetting(key, val) {
  appSettings[key] = val;
  try {
    await window.api.saveSettings({ [key]: val });
  } catch (err) {
    console.error('Settings save error:', err);
  }
}

settingChangeFolderBtn.addEventListener('click', async () => {
  const chosen = await window.api.chooseFolder();
  if (chosen) {
    currentSaveDir = chosen;
    settingDownloadPath.textContent = chosen;
    savePath.textContent = chosen;
    await updateSetting('downloadDir', chosen);
  }
});

settingOpenFolderBtn.addEventListener('click', () => window.api.openDownloads());

settingDefaultVideoQuality.addEventListener('change', (e) => {
  updateSetting('defaultVideoQuality', e.target.value);
});

settingDefaultAudioQuality.addEventListener('change', (e) => {
  updateSetting('defaultAudioQuality', e.target.value);
});

settingSpotifyPlaylistFolder.addEventListener('change', (e) => {
  updateSetting('spotifyPlaylistFolder', e.target.checked);
});

settingSpotifyFastEngine.addEventListener('change', (e) => {
  updateSetting('spotifyFastEngine', e.target.checked);
});

settingSpotifyLyrics.addEventListener('change', (e) => {
  updateSetting('spotifyLyrics', e.target.checked);
});

settingSystemNotifications.addEventListener('change', (e) => {
  updateSetting('systemNotifications', e.target.checked);
});

refreshToolsBtn.addEventListener('click', () => loadToolsStatus());

async function loadToolsStatus() {
  ytdlpBadge.textContent  = 'Taranıyor…';
  ffmpegBadge.textContent = 'Taranıyor…';
  spotdlBadge.textContent = 'Taranıyor…';

  try {
    const tools = await window.api.getToolsStatus();

    // yt-dlp
    if (tools.ytdlp.exists) {
      ytdlpPath.textContent = `${tools.ytdlp.path} (${tools.ytdlp.version || 'v2025'})`;
      ytdlpBadge.textContent = '✅ Hazır';
      ytdlpBadge.className = 'tool-badge ready';
    } else {
      ytdlpPath.textContent = 'Bulunamadı';
      ytdlpBadge.textContent = '❌ Eksik';
      ytdlpBadge.className = 'tool-badge missing';
    }

    // ffmpeg
    if (tools.ffmpeg.exists) {
      ffmpegPath.textContent = `${tools.ffmpeg.path} (${tools.ffmpeg.version || 'Kurulu'})`;
      ffmpegBadge.textContent = '✅ Hazır';
      ffmpegBadge.className = 'tool-badge ready';
    } else {
      ffmpegPath.textContent = 'Bulunamadı';
      ffmpegBadge.textContent = '❌ Eksik';
      ffmpegBadge.className = 'tool-badge missing';
    }

    // spotdl
    if (tools.spotdl.exists) {
      spotdlPath.textContent = `${tools.spotdl.path} (${tools.spotdl.version || 'v4.5'})`;
      spotdlBadge.textContent = '✅ Hazır';
      spotdlBadge.className = 'tool-badge ready';
    } else {
      spotdlPath.textContent = 'Bulunamadı (pip3 install spotdl)';
      spotdlBadge.textContent = '❌ Eksik';
      spotdlBadge.className = 'tool-badge missing';
    }
  } catch (err) {
    console.error('Tools check error:', err);
  }
}

// ─── Utilities ────────────────────────────────────────────
function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function isSpotifyUrl(s) {
  try { return new URL(s).hostname === 'open.spotify.com'; }
  catch { return false; }
}

function updateSourceBadge(val) {
  document.querySelector('.url-source-badge')?.remove();
  if (!val) return;
  if (isSpotifyUrl(val)) {
    const isPlaylist = val.includes('/playlist/') || val.includes('/album/');
    const badge = document.createElement('span');
    badge.className   = 'url-source-badge spotify';
    badge.textContent = isPlaylist ? '🎵 Spotify Çalma Listesi' : '🎵 Spotify';
    document.querySelector('.url-bar').appendChild(badge);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Start app
initApp();
