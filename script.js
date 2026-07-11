// ---------- helpers ----------
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function setupDropzone(dzEl, inputEl, onFiles) {
  dzEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFiles(inputEl.files);
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    dzEl.addEventListener(evt, (e) => {
      e.preventDefault();
      dzEl.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dzEl.addEventListener(evt, (e) => {
      e.preventDefault();
      dzEl.classList.remove('drag-over');
    })
  );
  dzEl.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) onFiles(files);
  });
}

// ---------- station switching ----------
const stationButtons = document.querySelectorAll('.station');
const panels = document.querySelectorAll('.panel');

stationButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    stationButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    panels.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.dataset.station).classList.add('active');
  });
});

// =====================================================
// STATION 1: PNG -> JPG
// =====================================================
(() => {
  const dz = document.getElementById('dz-pngjpg');
  const input = document.getElementById('input-pngjpg');
  const controls = document.getElementById('controls-pngjpg');
  const qualitySlider = document.getElementById('quality-pngjpg');
  const qualityVal = document.getElementById('quality-pngjpg-val');
  const resultBox = document.getElementById('result-pngjpg');
  const previewImg = document.getElementById('preview-pngjpg');
  const sizeBefore = document.getElementById('size-before-pngjpg');
  const sizeAfter = document.getElementById('size-after-pngjpg');
  const downloadLink = document.getElementById('download-pngjpg');

  let currentFile = null;
  let currentImg = null;

  async function convert() {
    if (!currentImg) return;
    const canvas = document.createElement('canvas');
    canvas.width = currentImg.naturalWidth;
    canvas.height = currentImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    // JPEG has no alpha channel, so flatten onto white first
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImg, 0, 0);

    const quality = Number(qualitySlider.value) / 100;
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);

    const url = URL.createObjectURL(blob);
    previewImg.src = url;
    sizeBefore.textContent = formatBytes(currentFile.size);
    sizeAfter.textContent = formatBytes(blob.size);
    downloadLink.href = url;
    downloadLink.download = currentFile.name.replace(/\.png$/i, '') + '.jpg';
    resultBox.hidden = false;
  }

  async function handleFiles(files) {
    currentFile = files[0];
    currentImg = await loadImage(currentFile);
    controls.hidden = false;
    convert();
  }

  setupDropzone(dz, input, handleFiles);
  qualitySlider.addEventListener('input', () => {
    qualityVal.textContent = `${qualitySlider.value}%`;
    convert();
  });
})();

// =====================================================
// STATION 2: JPG -> PDF
// =====================================================
(() => {
  const dz = document.getElementById('dz-jpgpdf');
  const input = document.getElementById('input-jpgpdf');
  const controls = document.getElementById('controls-jpgpdf');
  const fileListEl = document.getElementById('filelist-jpgpdf');
  const fitSelect = document.getElementById('fit-jpgpdf');
  const resultBox = document.getElementById('result-jpgpdf');
  const pagesEl = document.getElementById('pages-jpgpdf');
  const sizeEl = document.getElementById('size-jpgpdf');
  const downloadLink = document.getElementById('download-jpgpdf');

  let queuedFiles = [];

  function renderFileList() {
    fileListEl.innerHTML = '';
    queuedFiles.forEach((f) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${f.name}</span><span>${formatBytes(f.size)}</span>`;
      fileListEl.appendChild(li);
    });
  }

  async function buildPdf() {
    if (!queuedFiles.length) return;
    const { jsPDF } = window.jspdf;
    let doc = null;

    for (const file of queuedFiles) {
      const img = await loadImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      const orientation = img.naturalWidth >= img.naturalHeight ? 'l' : 'p';

      if (fitSelect.value === 'image') {
        // page size matches image pixel size (in points, 1px = 1pt)
        if (!doc) {
          doc = new jsPDF({ orientation, unit: 'pt', format: [img.naturalWidth, img.naturalHeight] });
        } else {
          doc.addPage([img.naturalWidth, img.naturalHeight], orientation);
        }
        doc.addImage(dataUrl, 'JPEG', 0, 0, img.naturalWidth, img.naturalHeight);
      } else {
        // fit image onto an A4 page, centered, preserving aspect ratio
        if (!doc) {
          doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
        } else {
          doc.addPage('a4', orientation);
        }
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 24;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        doc.addImage(dataUrl, 'JPEG', x, y, w, h);
      }
    }

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    pagesEl.textContent = queuedFiles.length;
    sizeEl.textContent = formatBytes(pdfBlob.size);
    downloadLink.href = url;
    downloadLink.download = 'converted.pdf';
    resultBox.hidden = false;
  }

  function handleFiles(files) {
    queuedFiles = queuedFiles.concat(Array.from(files));
    controls.hidden = false;
    renderFileList();
    buildPdf();
  }

  setupDropzone(dz, input, handleFiles);
  fitSelect.addEventListener('change', buildPdf);
})();

// =====================================================
// STATION 3: Resize to target size (KB / MB)
// =====================================================
(() => {
  const dz = document.getElementById('dz-resize');
  const input = document.getElementById('input-resize');
  const controls = document.getElementById('controls-resize');
  const targetValue = document.getElementById('target-value');
  const targetUnit = document.getElementById('target-unit');
  const runBtn = document.getElementById('run-resize');
  const resultBox = document.getElementById('result-resize');
  const previewImg = document.getElementById('preview-resize');
  const sizeBefore = document.getElementById('size-before-resize');
  const sizeAfter = document.getElementById('size-after-resize');
  const dimsEl = document.getElementById('dims-resize');
  const statusEl = document.getElementById('status-resize');
  const downloadLink = document.getElementById('download-resize');

  let currentFile = null;
  let currentImg = null;

  function targetBytes() {
    const val = Number(targetValue.value) || 0;
    return targetUnit.value === 'MB' ? val * 1024 * 1024 : val * 1024;
  }

  // Reduces JPEG quality first; if that alone can't reach the target,
  // progressively scales the image dimensions down and tries again.
  async function compressToTarget(img, target) {
    let scale = 1;
    let bestBlob = null;
    let reachedTarget = false;

    for (let pass = 0; pass < 8; pass++) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // binary search quality 0.05 - 0.95 for this scale
      let lo = 0.05, hi = 0.95, blobAtScale = null;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        const blob = await canvasToBlob(canvas, 'image/jpeg', mid);
        blobAtScale = blob;
        if (blob.size > target) {
          hi = mid;
        } else {
          lo = mid;
          bestBlob = blob;
          bestBlob._w = w;
          bestBlob._h = h;
        }
      }

      if (bestBlob && bestBlob.size <= target) {
        reachedTarget = true;
        break;
      }
      // quality alone wasn't enough at this scale, shrink dimensions and retry
      scale *= 0.75;
      if (w <= 40 || h <= 40) break;
    }

    if (!bestBlob) {
      // fallback: smallest quality at smallest attempted scale
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      bestBlob = await canvasToBlob(canvas, 'image/jpeg', 0.05);
      bestBlob._w = canvas.width;
      bestBlob._h = canvas.height;
    }

    return { blob: bestBlob, reachedTarget, width: bestBlob._w, height: bestBlob._h };
  }

  async function run() {
    if (!currentImg) return;
    runBtn.disabled = true;
    runBtn.textContent = 'Compressing…';

    const target = targetBytes();
    const { blob, reachedTarget, width, height } = await compressToTarget(currentImg, target);

    const url = URL.createObjectURL(blob);
    previewImg.src = url;
    sizeBefore.textContent = formatBytes(currentFile.size);
    sizeAfter.textContent = formatBytes(blob.size);
    dimsEl.textContent = `${width} × ${height}px`;
    statusEl.textContent = reachedTarget
      ? 'Target reached'
      : 'Could not reach target without excessive quality loss — closest result shown';

    const baseName = currentFile.name.replace(/\.(png|jpe?g)$/i, '');
    downloadLink.href = url;
    downloadLink.download = `${baseName}-resized.jpg`;
    resultBox.hidden = false;

    runBtn.disabled = false;
    runBtn.textContent = 'Compress to target';
  }

  async function handleFiles(files) {
    currentFile = files[0];
    currentImg = await loadImage(currentFile);
    controls.hidden = false;
    resultBox.hidden = true;
  }

  setupDropzone(dz, input, handleFiles);
  runBtn.addEventListener('click', run);
})();
