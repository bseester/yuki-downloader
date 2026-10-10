/* ══════════════════════════════════════════════════════════
   Yuki Downloader — Renderer Logic
   ══════════════════════════════════════════════════════════ */

'use strict';

// ─── State ────────────────────────────────────────────────
let currentFormat    = 'mp4'; // 'mp4'|'mkv'|'webm'|'mov'|'mp3'|'flac'|'m4a'|'wav'|'opus'
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
const modeBtnMp4       = document.getElementById('modeBtnMp4');
const modeBtnMp3       = document.getElementById('modeBtnMp3');
const modeBtnSpotify   = document.getElementById('modeBtnSpotify');

// Downloader Elements
const urlInput          = document.getElementById('urlInput');
const urlSourceBadge    = document.getElementById('urlSourceBadge');
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
const subtitlesBadge    = document.getElementById('subtitlesBadge');
const videoChannel      = document.getElementById('videoChannel');
const formatRow                 = document.getElementById('formatRow');
const formatChips               = document.getElementById('formatChips');
const qualityChips              = document.getElementById('qualityChips');
const savePath                  = document.getElementById('savePath');
const downloadBtn               = document.getElementById('downloadBtn');
const downloadBtnText           = document.getElementById('downloadBtnText');
const downloadsList             = document.getElementById('downloadsList');
const emptyState                = document.getElementById('emptyState');
const errorMsg                  = document.getElementById('errorMsg');
const retryBtn                  = document.getElementById('retryBtn');
const changeFolderBtn           = document.getElementById('changeFolderBtn');
const openFolderBtn             = document.getElementById('openFolderBtn');
const clearCompletedBtn         = document.getElementById('clearCompletedBtn');

// Settings & Preview Lyrics Elements
const lyricsOptionRow              = document.getElementById('lyricsOptionRow');
const lyricsToggleChip             = document.getElementById('lyricsToggleChip');
const lyricsChipDot                = document.getElementById('lyricsChipDot');
const lyricsChipText               = document.getElementById('lyricsChipText');
const settingDownloadPath          = document.getElementById('settingDownloadPath');
const settingChangeFolderBtn       = document.getElementById('settingChangeFolderBtn');
const settingOpenFolderBtn         = document.getElementById('settingOpenFolderBtn');
const settingDefaultVideoFormat    = document.getElementById('settingDefaultVideoFormat');
const settingDefaultAudioFormat    = document.getElementById('settingDefaultAudioFormat');
const settingDefaultVideoQuality   = document.getElementById('settingDefaultVideoQuality');
const settingDefaultAudioQuality   = document.getElementById('settingDefaultAudioQuality');
const settingAutoTurkishSubtitles  = document.getElementById('settingAutoTurkishSubtitles');
const settingSpotifyPlaylistFolder = document.getElementById('settingSpotifyPlaylistFolder');
const settingSpotifyFastEngine     = document.getElementById('settingSpotifyFastEngine');
const settingSpotifySmartSync      = document.getElementById('settingSpotifySmartSync');
const settingSpotifyDownloadLyrics = document.getElementById('settingSpotifyDownloadLyrics');
const settingSpotifyLyricsLrc      = document.getElementById('settingSpotifyLyricsLrc');
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
  initLanguageAndWebMode();
  loadToolsStatus();
  await loadAndRestoreHistory();
}

function initLanguageAndWebMode() {
  // If running in Web / GitHub Pages mode, show web banner
  if (window.api?.isWeb) {
    const webBanner = document.getElementById('webBanner');
    if (webBanner) webBanner.classList.remove('hidden');
  }

  // Initialize i18n
  const savedLang = appSettings.language || (navigator.language?.startsWith('en') ? 'en' : 'tr');
  if (window.yukiI18n) window.yukiI18n.initI18n(savedLang);

  const langSwitchBtn = document.getElementById('langSwitchBtn');
  if (langSwitchBtn) {
    langSwitchBtn.addEventListener('click', () => {
      const nextLang = window.yukiI18n.currentLang === 'tr' ? 'en' : 'tr';
      window.yukiI18n.setLanguage(nextLang);
      updateSetting('language', nextLang);
      appSettings.language = nextLang;
      refreshDynamicLabels();
    });
  }

  const settingLanguage = document.getElementById('settingLanguage');
  if (settingLanguage) {
    settingLanguage.value = savedLang;
    settingLanguage.addEventListener('change', (e) => {
      const nextLang = e.target.value;
      window.yukiI18n.setLanguage(nextLang);
      updateSetting('language', nextLang);
      appSettings.language = nextLang;
      refreshDynamicLabels();
    });
  }

  refreshDynamicLabels();
}

function refreshDynamicLabels() {
  const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
  const fmtUp = (currentFormat || 'mp4').toUpperCase();

  if (currentInfo) {
    if (currentInfo.isPlaylist) {
      downloadBtnText.textContent = t('btn_download_all_fmt', { fmt: fmtUp });
    } else {
      downloadBtnText.textContent = t('btn_download_fmt', { fmt: fmtUp });
    }
  } else {
    if (modeBtnMp4?.classList.contains('active')) {
      downloadBtnText.textContent = `${t('btn_download_video')} (${fmtUp})`;
      urlInput.placeholder = t('input_placeholder_yt_video');
    } else if (modeBtnMp3?.classList.contains('active')) {
      downloadBtnText.textContent = `${t('btn_download_audio')} (${fmtUp})`;
      urlInput.placeholder = t('input_placeholder_yt_audio');
    } else if (modeBtnSpotify?.classList.contains('active')) {
      downloadBtnText.textContent = `${t('btn_download_spotify')} (${fmtUp})`;
      urlInput.placeholder = t('input_placeholder_spotify');
    }
  }
}

window.addEventListener('yuki-language-changed', () => {
  refreshDynamicLabels();
});

/** Restore completed/error downloads from disk on startup. */
async function loadAndRestoreHistory() {
  try {
    const history = await window.api.getHistory();
    if (!history || history.length === 0) return;

    history.forEach(entry => {
      // Don't re-add if already in DOM (shouldn't happen on fresh start)
      if (document.querySelector(`.dl-item[data-id="${entry.id}"]`)) return;
      restoreHistoryItem(entry);
    });

    emptyState.classList.add('hidden');
  } catch (err) {
    console.error('History restore error:', err);
  }
}

/** Create a frozen (already completed/errored) download item from a history entry. */
function restoreHistoryItem(entry) {
  const { id, title, thumbnail, format, quality, source, status, errorMsg: errMsg, isPlaylist, completedAt } = entry;

  const isSpotify  = source === 'spotify';
  let formatLabel  = (format || 'MP4').toUpperCase();
  let sourceBadge  = '';

  if (isSpotify) {
    formatLabel = isPlaylist ? '🎵 Spotify Çalma Listesi' : '🎵 Spotify ' + (format || 'MP3').toUpperCase();
    sourceBadge = `<span class="src-badge spotify">${isPlaylist ? 'Toplu İndirme' : 'Spotify'}</span>`;
  }

  const dateStr = completedAt ? new Date(completedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const isComplete = status === 'complete';

  const item = document.createElement('div');
  item.className = 'dl-item';
  item.dataset.id = id;
  item.dataset.status = status;
  item.dataset.history = 'true';

  item.innerHTML = `
    <div class="dl-header">
      <img class="dl-thumb" src="${thumbnail || ''}" alt="" />
      <div class="dl-info">
        <div class="dl-title">${escHtml(title || 'Bilinmeyen')}${sourceBadge}</div>
        <div class="dl-meta">
          <span>${formatLabel} · ${quality || ''}</span>
          <span class="status-badge ${isComplete ? 'complete' : 'error'}">${isComplete ? '✓ Tamamlandı' : '✗ Hata'}</span>
        </div>
      </div>
      <div class="dl-actions">
        <button class="dl-action-btn${isComplete ? '' : ' hidden'}" data-action="finder" title="Finder'da göster">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        </button>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill" style="width:100%;background:${isComplete ? 'var(--accent-from, #30d158)' : '#ff453a'}"></div>
      </div>
      <div class="progress-stats">
        <span>${isComplete ? 'Tamamlandı' : (escHtml(errMsg || 'Hata'))}</span>
        <span style="opacity:.5;font-size:11px">${dateStr}</span>
      </div>
    </div>
  `;

  item.querySelector('[data-action="finder"]')?.addEventListener('click', () => {
    window.api.showInFinder(null);
  });

  downloadsList.appendChild(item); // history goes to bottom, new downloads prepend
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
  } else {
    navSettingsBtn.classList.add('active');
    navSettingsBtn.setAttribute('aria-selected', 'true');
    navDownloaderBtn.classList.remove('active');
    navDownloaderBtn.setAttribute('aria-selected', 'false');

    settingsView.classList.remove('hidden');
    settingsView.classList.add('active');
    downloaderView.classList.add('hidden');
    downloaderView.classList.remove('active');
  }
}

// ─── Mode Squircles Handling (MP4 / MP3 / Spotify) ────────
const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'mov'];
const AUDIO_FORMATS = ['mp3', 'flac', 'm4a', 'wav', 'opus'];

function setMode(mode) {
  const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
  // mode: 'mp4' | 'mp3' | 'spotify'
  [modeBtnMp4, modeBtnMp3, modeBtnSpotify].forEach(btn => btn?.classList.remove('active'));

  if (mode === 'mp4') {
    modeBtnMp4?.classList.add('active');
    // Keep current video format or fall back to settings/default
    if (!VIDEO_FORMATS.includes(currentFormat)) {
      currentFormat = appSettings.defaultVideoFormat || 'mp4';
    }
    currentSource = 'youtube';
    urlInput.placeholder = t('input_placeholder_yt_video');
    if (!currentInfo) downloadBtnText.textContent = `${t('btn_download_video')} (${currentFormat.toUpperCase()})`;
  } else if (mode === 'mp3') {
    modeBtnMp3?.classList.add('active');
    // Keep current audio format or fall back to settings/default
    if (!AUDIO_FORMATS.includes(currentFormat)) {
      currentFormat = appSettings.defaultAudioFormat || 'mp3';
    }
    currentSource = 'youtube';
    urlInput.placeholder = t('input_placeholder_yt_audio');
    if (!currentInfo) downloadBtnText.textContent = `${t('btn_download_audio')} (${currentFormat.toUpperCase()})`;
  } else if (mode === 'spotify') {
    modeBtnSpotify?.classList.add('active');
    if (!AUDIO_FORMATS.includes(currentFormat)) {
      currentFormat = appSettings.defaultAudioFormat || 'mp3';
    }
    currentSource = 'spotify';
    urlInput.placeholder = t('input_placeholder_spotify');
    if (!currentInfo) downloadBtnText.textContent = `${t('btn_download_spotify')} (${currentFormat.toUpperCase()})`;
  }

  currentQuality = null;
  if (currentInfo) renderQualities(currentInfo.formats);
  else renderFormatChipsOnly(mode); // show format chips even without a loaded video
}

modeBtnMp4?.addEventListener('click', () => setMode('mp4'));
modeBtnMp3?.addEventListener('click', () => setMode('mp3'));
modeBtnSpotify?.addEventListener('click', () => {
  setMode('spotify');
  urlInput.focus();
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
  currentSource = 'youtube';
  updateSourceBadge('');
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
  const completed = document.querySelectorAll('.dl-item[data-status="complete"], .dl-item[data-status="error"]');
  completed.forEach(el => {
    window.api.removeHistoryEntry(el.dataset.id).catch(() => {});
    removeDownloadItemEl(el);
  });
});

/** Remove element directly (already handled history removal above). */
function removeDownloadItemEl(el) {
  if (!el) return;
  el.classList.add('removing');
  setTimeout(() => {
    el.remove();
    downloads.delete(el.dataset.id);
    if (!downloadsList.querySelector('.dl-item')) emptyState.classList.remove('hidden');
  }, 280);
}

// ─── Download Button ──────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    urlInput.focus();
    return;
  }

  if (!currentInfo) {
    downloadBtn.disabled = true;
    const t = window.yukiI18n ? window.yukiI18n.t : (k => k);
    downloadBtnText.textContent = t('btn_checking');
    try {
      await fetchInfo(url);
    } catch {}
    downloadBtn.disabled = false;
    if (!currentInfo) {
      downloadBtnText.textContent = t('btn_start_download');
      return;
    }
  }

  const isVideo = isVideoFormat(currentFormat);
  const defaultQuality = isVideo ? (appSettings.defaultVideoQuality || '1080p') : (appSettings.defaultAudioQuality || '320k');
  const quality = currentQuality || (isLosslessFormat(currentFormat) ? 'lossless' : defaultQuality);
  const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  downloads.set(id, {
    title:      currentInfo.title,
    thumb:      currentInfo.thumbnail,
    format:     currentFormat,
    quality,
    source:     currentSource,
    isPlaylist: Boolean(currentInfo.isPlaylist),
  });

  addDownloadItem(id, currentInfo, currentFormat, quality, currentSource);

  window.api.startDownload({
    id,
    url,
    format:               currentFormat,
    quality,
    outputDir:            currentSaveDir,
    source:               currentSource,
    isPlaylist:           Boolean(currentInfo.isPlaylist),
    autoTurkishSubtitles: appSettings.autoTurkishSubtitles !== false,
    downloadLyrics:       appSettings.spotifyDownloadLyrics === true,
    lyricsLrc:            appSettings.spotifyLyricsLrc === true,
  });

  // Reset input after launching download
  urlInput.value = '';
  clearBtn.classList.add('hidden');
  hidePreview();
  currentInfo = null;
  downloadBtnText.textContent = 'İndirmeyi Başlat';
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
  const dateStr = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  if (statsWrap) statsWrap.innerHTML = `<span>Tamamlandı</span><span style="opacity:.5;font-size:11px">${dateStr}</span>`;

  // Persist to disk
  const meta = downloads.get(id);
  if (meta) {
    window.api.saveHistoryEntry({
      id,
      title:       meta.title,
      thumbnail:   meta.thumb,
      format:      meta.format,
      quality:     meta.quality,
      source:      meta.source,
      isPlaylist:  meta.isPlaylist,
      status:      'complete',
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  }
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

  // Persist error to disk
  const meta = downloads.get(id);
  if (meta) {
    window.api.saveHistoryEntry({
      id,
      title:       meta.title,
      thumbnail:   meta.thumb,
      format:      meta.format,
      quality:     meta.quality,
      source:      meta.source,
      isPlaylist:  meta.isPlaylist,
      status:      'error',
      errorMsg:    message?.slice(0, 120) || 'Bilinmeyen hata',
      completedAt: new Date().toISOString(),
    }).catch(() => {});
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
  const fmtUp = (currentFormat || 'mp4').toUpperCase();
  if (info.isPlaylist) {
    playlistBadge.classList.remove('hidden');
    downloadBtnText.textContent = `Tümünü İndir (${fmtUp} - Toplu Liste)`;
  } else {
    playlistBadge.classList.add('hidden');
    downloadBtnText.textContent = `İndir (${fmtUp})`;
  }

  // Subtitle badge for YouTube MP4
  if (currentSource === 'youtube' && appSettings.autoTurkishSubtitles !== false) {
    subtitlesBadge?.classList.remove('hidden');
  } else {
    subtitlesBadge?.classList.add('hidden');
  }

  // Lyrics toggle chip for Spotify
  if (currentSource === 'spotify') {
    lyricsOptionRow?.classList.remove('hidden');
    updateLyricsChipUI();
  } else {
    lyricsOptionRow?.classList.add('hidden');
  }

  // Mode squircle state
  if (currentSource === 'spotify') {
    setMode('spotify');
  } else {
    setMode(isAudioFormat(currentFormat) ? 'mp3' : 'mp4');
  }

  renderQualities(info.formats);
  savePath.textContent = currentSaveDir || appSettings.downloadDir || '~/Downloads';

  previewContent.classList.remove('hidden');
}

// ─── Format & Quality Chip Rendering ─────────────────────
function isVideoFormat(fmt) { return VIDEO_FORMATS.includes(fmt); }
function isAudioFormat(fmt) { return AUDIO_FORMATS.includes(fmt); }
function isLosslessFormat(fmt) { return ['flac', 'wav'].includes(fmt); }

/** Render only format chips (called when no video is loaded yet). */
function renderFormatChipsOnly(mode) {
  if (!formatRow || !formatChips) return;
  const isVideo = mode === 'mp4';
  const fmtList = isVideo ? VIDEO_FORMATS : AUDIO_FORMATS;
  formatRow.classList.remove('hidden');
  formatChips.innerHTML = '';
  fmtList.forEach(fmt => {
    const chip = document.createElement('button');
    chip.className = 'quality-chip' + (fmt === currentFormat ? ' selected' : '');
    chip.textContent = fmt.toUpperCase();
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(fmt === currentFormat));
    chip.addEventListener('click', () => {
      currentFormat = fmt;
      formatChips.querySelectorAll('.quality-chip').forEach(c => {
        c.classList.remove('selected'); c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('selected'); chip.setAttribute('aria-checked', 'true');
      // Refresh quality chips if we have info
      if (currentInfo) renderQualityChips(currentInfo.formats);
      else renderQualityChipsFromFormat(fmt);
    });
    formatChips.appendChild(chip);
  });
  renderQualityChipsFromFormat(currentFormat);
}

/** Render quality chips based on format only (no video info). */
function renderQualityChipsFromFormat(fmt) {
  qualityChips.innerHTML = '';
  currentQuality = null;
  if (isLosslessFormat(fmt)) {
    const chip = document.createElement('button');
    chip.className = 'quality-chip selected';
    chip.textContent = 'Kayıpsız (Lossless)';
    chip.setAttribute('role', 'radio'); chip.setAttribute('aria-checked', 'true');
    currentQuality = 'lossless';
    qualityChips.appendChild(chip);
  } else if (isVideoFormat(fmt)) {
    const qualities = ['4K', '1080p', '720p', '480p'];
    const pref = appSettings.defaultVideoQuality || '1080p';
    let defIdx = qualities.indexOf(pref); if (defIdx === -1) defIdx = 1;
    qualities.forEach((q, i) => {
      const chip = document.createElement('button');
      chip.className = 'quality-chip' + (i === defIdx ? ' selected' : '');
      chip.textContent = q;
      chip.setAttribute('role', 'radio'); chip.setAttribute('aria-checked', String(i === defIdx));
      if (i === defIdx) currentQuality = q;
      chip.addEventListener('click', () => {
        qualityChips.querySelectorAll('.quality-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-checked', 'false'); });
        chip.classList.add('selected'); chip.setAttribute('aria-checked', 'true'); currentQuality = q;
      });
      qualityChips.appendChild(chip);
    });
  } else {
    // Lossy audio: mp3, m4a, opus
    const bitrates = ['320k', '256k', '192k', '128k'];
    const pref = appSettings.defaultAudioQuality || '320k';
    let defIdx = bitrates.indexOf(pref); if (defIdx === -1) defIdx = 0;
    bitrates.forEach((q, i) => {
      const chip = document.createElement('button');
      chip.className = 'quality-chip' + (i === defIdx ? ' selected' : '');
      chip.textContent = q;
      chip.setAttribute('role', 'radio'); chip.setAttribute('aria-checked', String(i === defIdx));
      if (i === defIdx) currentQuality = q;
      chip.addEventListener('click', () => {
        qualityChips.querySelectorAll('.quality-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-checked', 'false'); });
        chip.classList.add('selected'); chip.setAttribute('aria-checked', 'true'); currentQuality = q;
      });
      qualityChips.appendChild(chip);
    });
  }
}

/** Full render: format chips + quality chips (with video info). */
function renderQualities(formats) {
  if (!formatRow || !formatChips) return;

  // Determine format list by current mode
  const isVideo = isVideoFormat(currentFormat) || (currentSource === 'youtube' && modeBtnMp4?.classList.contains('active'));
  const fmtList  = isVideo ? (formats.videoFormats || VIDEO_FORMATS) : (formats.audioFormats || AUDIO_FORMATS);

  formatRow.classList.remove('hidden');
  formatChips.innerHTML = '';

  // Ensure currentFormat is in the list
  if (!fmtList.includes(currentFormat)) currentFormat = fmtList[0];

  fmtList.forEach(fmt => {
    const chip = document.createElement('button');
    chip.className = 'quality-chip' + (fmt === currentFormat ? ' selected' : '');
    chip.textContent = fmt.toUpperCase();
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(fmt === currentFormat));
    chip.addEventListener('click', () => {
      currentFormat = fmt;
      formatChips.querySelectorAll('.quality-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-checked', 'false'); });
      chip.classList.add('selected'); chip.setAttribute('aria-checked', 'true');
      renderQualityChips(formats);
      if (currentInfo) {
        const fmtUp = fmt.toUpperCase();
        if (currentInfo.isPlaylist) {
          downloadBtnText.textContent = `Tümünü İndir (${fmtUp} - Toplu Liste)`;
        } else {
          downloadBtnText.textContent = `İndir (${fmtUp})`;
        }
      }
    });
    formatChips.appendChild(chip);
  });

  renderQualityChips(formats);
}

/** Render quality chips based on current format and the video/audio format info. */
function renderQualityChips(formats) {
  qualityChips.innerHTML = '';
  currentQuality = null;

  if (isLosslessFormat(currentFormat)) {
    const chip = document.createElement('button');
    chip.className = 'quality-chip selected';
    chip.textContent = 'Kayıpsız (Lossless)';
    chip.setAttribute('role', 'radio'); chip.setAttribute('aria-checked', 'true');
    currentQuality = 'lossless';
    qualityChips.appendChild(chip);
    return;
  }

  const options = isVideoFormat(currentFormat) ? (formats.video || []) : (formats.audio || []);
  const defaultPref = isVideoFormat(currentFormat)
    ? (appSettings.defaultVideoQuality || '1080p')
    : (appSettings.defaultAudioQuality || '320k');

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
      qualityChips.querySelectorAll('.quality-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-checked', 'false'); });
      chip.classList.add('selected'); chip.setAttribute('aria-checked', 'true'); currentQuality = q;
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
      formatLabel = `🎵 Spotify ${format.toUpperCase()} (Liste)`;
      sourceBadge = '<span class="src-badge spotify">Toplu İndirme</span>';
    } else {
      formatLabel = `🎵 Spotify ${format.toUpperCase()}`;
      sourceBadge = '<span class="src-badge spotify">Spotify</span>';
    }
  } else if (isPlaylist) {
    formatLabel = `${format.toUpperCase()} (Çalma Listesi)`;
    sourceBadge = '<span class="src-badge spotify">Toplu İndirme</span>';
  } else if (format === 'mp4' && appSettings.autoTurkishSubtitles !== false) {
    sourceBadge = '<span class="src-badge" style="background:rgba(255,107,107,0.18);color:#ff6b6b;border:1px solid rgba(255,107,107,0.3)">TR Altyazı</span>';
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

  const status = el.dataset.status;
  // If removing a completed/errored item, also remove from persistent history
  if (status === 'complete' || status === 'error') {
    window.api.removeHistoryEntry(id).catch(() => {});
  }

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

    if (settingDefaultVideoFormat) settingDefaultVideoFormat.value = appSettings.defaultVideoFormat || 'mp4';
    if (settingDefaultAudioFormat) settingDefaultAudioFormat.value = appSettings.defaultAudioFormat || 'mp3';
    settingDefaultVideoQuality.value = appSettings.defaultVideoQuality || '1080p';
    settingDefaultAudioQuality.value = appSettings.defaultAudioQuality || '320k';

    // Apply default format to currentFormat based on current mode
    if (isVideoFormat(currentFormat) || currentFormat === 'mp4') {
      currentFormat = appSettings.defaultVideoFormat || 'mp4';
    } else {
      currentFormat = appSettings.defaultAudioFormat || 'mp3';
    }

    if (settingAutoTurkishSubtitles) {
      settingAutoTurkishSubtitles.checked = appSettings.autoTurkishSubtitles !== false;
    }

    settingSpotifyPlaylistFolder.checked = appSettings.spotifyPlaylistFolder !== false;
    settingSpotifyFastEngine.checked     = appSettings.spotifyFastEngine !== false;
    if (settingSpotifySmartSync) {
      settingSpotifySmartSync.checked = appSettings.spotifySmartSync !== false;
    }
    if (settingSpotifyDownloadLyrics) {
      settingSpotifyDownloadLyrics.checked = appSettings.spotifyDownloadLyrics === true;
    }
    if (settingSpotifyLyricsLrc) {
      settingSpotifyLyricsLrc.checked = appSettings.spotifyLyricsLrc === true;
    }
    settingSystemNotifications.checked   = appSettings.systemNotifications !== false;
    updateLyricsChipUI();
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

function updateLyricsChipUI() {
  const isEnabled = appSettings.spotifyDownloadLyrics === true;
  if (lyricsToggleChip) {
    lyricsToggleChip.classList.toggle('active', isEnabled);
    if (lyricsChipText) {
      lyricsChipText.textContent = isEnabled ? 'Şarkı Sözleri: Açık' : 'Şarkı Sözleri: Kapalı';
    }
  }
}

if (lyricsToggleChip) {
  lyricsToggleChip.addEventListener('click', () => {
    const newState = !(appSettings.spotifyDownloadLyrics === true);
    updateSetting('spotifyDownloadLyrics', newState);
    if (settingSpotifyDownloadLyrics) settingSpotifyDownloadLyrics.checked = newState;
    updateLyricsChipUI();
  });
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

if (settingDefaultVideoFormat) {
  settingDefaultVideoFormat.addEventListener('change', (e) => {
    updateSetting('defaultVideoFormat', e.target.value);
    appSettings.defaultVideoFormat = e.target.value;
    // If currently in video mode, update currentFormat & re-render chips
    if (isVideoFormat(currentFormat) || modeBtnMp4?.classList.contains('active')) {
      currentFormat = e.target.value;
      if (currentInfo) renderQualities(currentInfo.formats);
      else renderFormatChipsOnly('mp4');
    }
  });
}

if (settingDefaultAudioFormat) {
  settingDefaultAudioFormat.addEventListener('change', (e) => {
    updateSetting('defaultAudioFormat', e.target.value);
    appSettings.defaultAudioFormat = e.target.value;
    // If currently in audio/spotify mode, update currentFormat & re-render chips
    if (AUDIO_FORMATS.includes(currentFormat) || modeBtnMp3?.classList.contains('active') || modeBtnSpotify?.classList.contains('active')) {
      currentFormat = e.target.value;
      if (currentInfo) renderQualities(currentInfo.formats);
      else renderFormatChipsOnly('mp3');
    }
  });
}

settingDefaultVideoQuality.addEventListener('change', (e) => {
  updateSetting('defaultVideoQuality', e.target.value);
});

settingDefaultAudioQuality.addEventListener('change', (e) => {
  updateSetting('defaultAudioQuality', e.target.value);
});

if (settingAutoTurkishSubtitles) {
  settingAutoTurkishSubtitles.addEventListener('change', (e) => {
    updateSetting('autoTurkishSubtitles', e.target.checked);
    if (currentInfo && currentSource === 'youtube') {
      subtitlesBadge?.classList.toggle('hidden', !e.target.checked);
    }
  });
}

settingSpotifyPlaylistFolder.addEventListener('change', (e) => {
  updateSetting('spotifyPlaylistFolder', e.target.checked);
});

settingSpotifyFastEngine.addEventListener('change', (e) => {
  updateSetting('spotifyFastEngine', e.target.checked);
});

if (settingSpotifySmartSync) {
  settingSpotifySmartSync.addEventListener('change', (e) => {
    updateSetting('spotifySmartSync', e.target.checked);
  });
}

if (settingSpotifyDownloadLyrics) {
  settingSpotifyDownloadLyrics.addEventListener('change', (e) => {
    updateSetting('spotifyDownloadLyrics', e.target.checked);
    updateLyricsChipUI();
  });
}

if (settingSpotifyLyricsLrc) {
  settingSpotifyLyricsLrc.addEventListener('change', (e) => {
    updateSetting('spotifyLyricsLrc', e.target.checked);
  });
}

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
  if (!val) {
    urlSourceBadge?.classList.add('hidden');
    return;
  }
  if (isSpotifyUrl(val)) {
    const isPlaylist = val.includes('/playlist/') || val.includes('/album/');
    if (urlSourceBadge) {
      urlSourceBadge.textContent = isPlaylist ? '🎵 Spotify Çalma Listesi' : '🎵 Spotify';
      urlSourceBadge.classList.remove('hidden');
    }
    setMode('spotify');
  } else {
    urlSourceBadge?.classList.add('hidden');
    if (modeBtnSpotify?.classList.contains('active')) {
      setMode(isAudioFormat(currentFormat) ? 'mp3' : 'mp4');
    }
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
