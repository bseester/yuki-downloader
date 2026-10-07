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
let fetchAbortCtrl   = null;
let fetchTimeout     = null;
const downloads      = new Map();

// ─── DOM refs ─────────────────────────────────────────────
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
const videoChannel      = document.getElementById('videoChannel');
const qualityChips      = document.getElementById('qualityChips');
const savePath          = document.getElementById('savePath');
const downloadBtn       = document.getElementById('downloadBtn');
const downloadsList     = document.getElementById('downloadsList');
const emptyState        = document.getElementById('emptyState');
const errorMsg          = document.getElementById('errorMsg');
const retryBtn          = document.getElementById('retryBtn');
const changeFolderBtn   = document.getElementById('changeFolderBtn');
const openFolderBtn     = document.getElementById('openFolderBtn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

// ─── Format tabs ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentFormat = tab.dataset.format;
    currentQuality = null;
    if (currentInfo) renderQualities(currentInfo.formats);
  });
});

// ─── URL input handling ───────────────────────────────────
urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  clearBtn.classList.toggle('hidden', !val);
  updateSourceBadge(val);
  if (val) scheduleInfoFetch(val);
  else hidePreview();
});

urlInput.addEventListener('paste', (e) => {
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

// ─── Folder picker ────────────────────────────────────────
changeFolderBtn.addEventListener('click', async () => {
  const chosen = await window.api.chooseFolder();
  if (chosen) {
    currentSaveDir = chosen;
    savePath.textContent = chosen.replace(process?.env?.HOME || '/Users/' + (navigator.userAgent || ''), '~');
    savePath.textContent = '~' + chosen.slice(chosen.indexOf('/Downloads'));
    savePath.textContent = chosen;
  }
});

openFolderBtn.addEventListener('click', () => window.api.openDownloads());

// ─── Retry fetch ──────────────────────────────────────────
retryBtn.addEventListener('click', () => {
  const val = urlInput.value.trim();
  if (val) fetchInfo(val);
});

// ─── Clear completed ──────────────────────────────────────
clearCompletedBtn.addEventListener('click', () => {
  document.querySelectorAll('.dl-item[data-status="complete"], .dl-item[data-status="error"]').forEach(el => {
    removeDownloadItem(el.dataset.id);
  });
});

// ─── Download button ──────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!currentInfo || !currentQuality) return;

  const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  downloads.set(id, {
    title:   currentInfo.title,
    thumb:   currentInfo.thumbnail,
    format:  currentFormat,
    quality: currentQuality,
    source:  currentSource,
  });

  addDownloadItem(id, currentInfo, currentFormat, currentQuality, currentSource);

  window.api.startDownload({
    id,
    url:       urlInput.value.trim(),
    format:    currentFormat,
    quality:   currentQuality,
    outputDir: currentSaveDir,
    source:    currentSource,
  });
});

// ─── IPC events from main process ────────────────────────
window.api.onProgress(({ id, percent, speed, eta }) => {
  const item = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!item) return;

  const fill  = item.querySelector('.progress-fill');
  const stats = item.querySelector('.progress-stats');

  fill.classList.remove('indeterminate');
  fill.style.width = percent + '%';

  if (stats) {
    const left  = stats.children[0];
    const right = stats.children[1];
    if (left)  left.textContent  = speed ? `${speed}` : '';
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
  if (badge) { badge.textContent = '✓ Tamamlandı'; badge.className = 'status-badge complete'; }
  const cancelBtn = item.querySelector('.dl-action-btn.danger');
  if (cancelBtn) cancelBtn.remove();
  const finderBtn = item.querySelector('.dl-action-btn[data-action="finder"]');
  if (finderBtn) finderBtn.classList.remove('hidden');
  const statsWrap = item.querySelector('.progress-stats');
  if (statsWrap) statsWrap.innerHTML = '';
});

window.api.onError(({ id, message }) => {
  const item = document.querySelector(`.dl-item[data-id="${id}"]`);
  if (!item) return;
  item.dataset.status = 'error';
  const badge = item.querySelector('.status-badge');
  if (badge) { badge.textContent = '✗ Hata'; badge.className = 'status-badge error'; }
  const fill = item.querySelector('.progress-fill');
  if (fill) { fill.style.background = '#ff453a'; fill.style.width = '100%'; }
  const stats = item.querySelector('.progress-stats');
  if (stats) { stats.children[0].textContent = message?.slice(0, 60) || 'Bilinmeyen hata'; }
});

// ─── Info fetch ───────────────────────────────────────────
function scheduleInfoFetch(url) {
  if (fetchTimeout) clearTimeout(fetchTimeout);
  fetchTimeout = setTimeout(() => {
    if (isValidUrl(url)) fetchInfo(url);
    else hidePreview();
  }, 600);
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
    showError(err.message || 'Video bilgisi alınamadı.');
  }
}

// ─── Preview rendering ────────────────────────────────────
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

  // For Spotify: force MP3 tab, hide MP4 tab
  currentSource = info.source || 'youtube';
  if (currentSource === 'spotify') {
    currentFormat = 'mp3';
    document.querySelectorAll('.tab').forEach(t => {
      if (t.dataset.format === 'mp4') t.classList.add('hidden');
      if (t.dataset.format === 'mp3') { t.classList.add('active'); t.setAttribute('aria-selected','true'); }
    });
  } else {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('hidden'));
  }

  renderQualities(info.formats);
  savePath.textContent = currentSaveDir || '~/Downloads';

  previewContent.classList.remove('hidden');
}

function renderQualities(formats) {
  qualityChips.innerHTML = '';
  const options = currentFormat === 'mp3' ? formats.audio : formats.video;

  options.forEach((q, i) => {
    const chip = document.createElement('button');
    chip.className   = 'quality-chip' + (i === 0 ? ' selected' : '');
    chip.textContent = q;
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(i === 0));
    if (i === 0) currentQuality = q;

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

// ─── Download list ────────────────────────────────────────
function addDownloadItem(id, info, format, quality, source) {
  emptyState.classList.add('hidden');

  const item = document.createElement('div');
  item.className    = 'dl-item';
  item.dataset.id   = id;
  item.dataset.status = 'downloading';

  const isSpotify    = source === 'spotify';
  const formatLabel  = isSpotify ? '🎵 Spotify MP3' : format.toUpperCase();
  const sourceBadge  = isSpotify
    ? '<span class="src-badge spotify">Spotify</span>'
    : '';

  item.innerHTML = `
    <div class="dl-header">
      <img class="dl-thumb" src="${info.thumbnail || ''}" alt="" />
      <div class="dl-info">
        <div class="dl-title">${escHtml(info.title)}${sourceBadge}</div>
        <div class="dl-meta">
          <span>${formatLabel} · ${quality}</span>
          <span class="status-badge waiting">İndiriliyor…</span>
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
        <span></span>
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
  // Remove old badge
  document.querySelector('.url-source-badge')?.remove();
  if (!val) return;
  if (isSpotifyUrl(val)) {
    const badge = document.createElement('span');
    badge.className   = 'url-source-badge spotify';
    badge.textContent = '🎵 Spotify';
    document.querySelector('.url-bar').appendChild(badge);
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
