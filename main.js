import { THEMES } from './src/themes.js';
import { generateGridWithPrecomputed, applyColorBleed } from './src/image-processor.js';
import { renderFull, updateMovingForeground } from './src/renderer.js';

// ===== DOM Elements =====
const upload = document.getElementById('uploadInput');
const srcCanvas = document.getElementById('sourceCanvas');
const artCanvas = document.getElementById('artCanvas');
const ctxSrc = srcCanvas.getContext('2d');
const ctxArt = artCanvas.getContext('2d');
const ratioSelect = document.getElementById('ratioSelect');
const customCharsEl = document.getElementById('customChars');
const resSlider = document.getElementById('resSlider'), resVal = document.getElementById('resVal');
const objSens = document.getElementById('objSens'), objVal = document.getElementById('objVal');
const eulerMix = document.getElementById('eulerMix'), mixVal = document.getElementById('mixVal');
const contrastSlider = document.getElementById('contrastSlider'), contrastVal = document.getElementById('contrastVal');
const glowSlider = document.getElementById('glowSlider');
const waveSlider = document.getElementById('waveSlider');
const themeSelect = document.getElementById('themeSelect');
const bgModeSelect = document.getElementById('bgModeSelect');
const bgIntensity = document.getElementById('bgIntensity'), bgIntVal = document.getElementById('bgIntVal');
const randomBtn = document.getElementById('randomBtn');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressBar = document.getElementById('progressBar');
const dropOverlay = document.getElementById('dropOverlay');
const toastContainer = document.getElementById('toastContainer');
const maskToggle = document.getElementById('maskToggle');

// ===== State =====
let currentImage = null;
let originalImgWidth = 0, originalImgHeight = 0;
let artWidth = 800, artHeight = 800;
let alphabetSet = "MATRIX_0x5.1_";
const bgCharSet = ".:,;-~=+*!|/\\()[]{}";
const rampChars = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^'. ";
let grid = [];
let gridCols = 0, gridRows = 0;
let processing = false;
let showMask = false;
let bgCanvas = document.createElement('canvas');
let bgCtx = bgCanvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 2, 3);
let frame = 0;
let lastBgMode = '';

// ===== Helper =====
function showToast(msg, isErr = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
}

function updateProgress(percent) {
    progressBar.style.width = (percent * 100) + '%';
}

// ===== PRESETS FOR RANDOM =====
const presets = [
    { name: "Deep Space", theme: "cyan", bgMode: "noise", glow: 8, wave: 30, euler: 70, contrast: 130, objSens: 80, res: 75, customChars: "✦✧⭐🌙✨", bgIntensity: 55 },
    { name: "Retro Terminal", theme: "green", bgMode: "rain", glow: 3, wave: 50, euler: 60, contrast: 110, objSens: 90, res: 70, customChars: ">_#%&$", bgIntensity: 70 },
    { name: "Cyber Glitch", theme: "cyberpunk", bgMode: "noise", glow: 12, wave: 80, euler: 85, contrast: 150, objSens: 60, res: 80, customChars: "101010XOXO", bgIntensity: 40 },
    { name: "Neon Dream", theme: "neon", bgMode: "rain", glow: 10, wave: 60, euler: 75, contrast: 140, objSens: 70, res: 65, customChars: "💀🎸🔥⚡💎", bgIntensity: 80 },
    { name: "Amber Haze", theme: "amber", bgMode: "none", glow: 5, wave: 20, euler: 50, contrast: 100, objSens: 100, res: 70, customChars: "🔥♦♣♠★", bgIntensity: 30 },
    { name: "Matrix Overload", theme: "green", bgMode: "rain", glow: 7, wave: 90, euler: 95, contrast: 170, objSens: 50, res: 85, customChars: "01MATRIX", bgIntensity: 90 },
    { name: "Vaporwave Sunset", theme: "neon", bgMode: "noise", glow: 9, wave: 45, euler: 65, contrast: 120, objSens: 75, res: 72, customChars: "🌴🌊✨🎵🌀", bgIntensity: 60 }
];

// ===== Web Worker =====
const imageWorker = new Worker(new URL('./src/image-worker.js', import.meta.url));

imageWorker.onmessage = function(e) {
    const { edgeMap, mask, cols, rows } = e.data;
    const edgeMapArray = new Float32Array(edgeMap);
    // Reconstruct 2D mask from transferred Uint8Array buffer
    const maskFlat = new Uint8Array(mask);
    const mask2D = [];
    for (let r = 0; r < rows; r++) {
        mask2D[r] = [];
        for (let c = 0; c < cols; c++) {
            mask2D[r][c] = maskFlat[r * cols + c] === 1;
        }
    }
    updateProgress(0.55);
    
    const result = generateGridWithPrecomputed(
        currentImage, srcCanvas, ctxSrc,
        parseInt(resSlider.value), parseInt(objSens.value),
        alphabetSet, bgCharSet, rampChars,
        edgeMapArray, mask2D, cols, rows,
        updateProgress
    );
    if (!result) {
        showToast('Gagal generate grid', true);
        processing = false;
        return;
    }
    grid = result.grid;
    gridCols = result.gridCols;
    gridRows = result.gridRows;
    applyColorBleed(grid, gridRows, gridCols);
    
    const cellW = artWidth / gridCols, cellH = artHeight / gridRows;
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            grid[r][c].x = c * cellW;
            grid[r][c].y = r * cellH;
            grid[r][c].w = cellW;
            grid[r][c].h = cellH;
        }
    }
    
    lastBgMode = '';
    renderFull(
        ctxArt, bgCanvas, grid, artWidth, artHeight, frame,
        bgModeSelect.value, parseInt(bgIntensity.value)/100, dpr,
        THEMES[themeSelect.value] || THEMES.cyberpunk, bgCharSet,
        parseInt(glowSlider.value), parseInt(waveSlider.value),
        themeSelect.value, parseInt(eulerMix.value), parseInt(contrastSlider.value),
        showMask
    );
    const fgCount = grid.flat().filter(c => c.isForeground).length;
    const total = grid.flat().length;
    showToast(`Grid: ${gridCols}x${gridRows}, FG: ${fgCount} (${(fgCount/total*100).toFixed(0)}%)`);
    setTimeout(() => { progressBar.style.width = '0%'; }, 600);
    processing = false;
};

function refreshMatrix() {
    if (!currentImage || processing) return;
    processing = true;
    const srcW = srcCanvas.width, srcH = srcCanvas.height;
    if (srcW < 1 || srcH < 1) {
        processing = false;
        return;
    }
    ctxSrc.drawImage(currentImage, 0, 0, srcW, srcH);
    let imgData;
    try {
        imgData = ctxSrc.getImageData(0, 0, srcW, srcH);
    } catch(e) {
        showToast('Gagal baca gambar', true);
        processing = false;
        return;
    }
    const gridSize = parseInt(resSlider.value);
    const aspect = srcW / srcH;
    let cols = Math.min(gridSize, 90);
    let rows = Math.floor(cols / aspect);
    rows = Math.max(8, Math.min(120, rows));
    updateProgress(0.05);
    // Transfer the ArrayBuffer to the worker (zero-copy) to avoid main-thread blocking
    const buffer = imgData.data.buffer;
    imageWorker.postMessage({
        imageData: buffer,
        width: srcW,
        height: srcH,
        cols: cols,
        rows: rows,
        sens: parseInt(objSens.value)
    }, [buffer]);
}

// ===== Update Canvas Size =====
function updateCanvasSize() {
    if (!currentImage) return;
    const ratio = ratioSelect.value;
    const container = document.getElementById('artCanvasWrapper');
    let mw = container.clientWidth;
    if (mw < 100) mw = 500;
    let bw = mw, bh = mw;
    if (ratio === '1:1') bh = bw;
    else if (ratio === '4:5') bh = bw * 1.25;
    else if (ratio === '9:16') bh = bw * 16/9;
    else {
        const ir = originalImgWidth / originalImgHeight;
        if (ir > 1) bh = bw / ir;
        else bw = bh * ir;
    }
    artWidth = Math.floor(bw * dpr);
    artHeight = Math.floor(bh * dpr);
    artCanvas.width = artWidth;
    artCanvas.height = artHeight;
    bgCanvas.width = artWidth;
    bgCanvas.height = artHeight;
    artCanvas.style.width = bw + 'px';
    artCanvas.style.height = bh + 'px';
    
    const ms = 400, msh = 240;
    const rs = Math.min(ms / originalImgWidth, msh / originalImgHeight, 1);
    srcCanvas.width = Math.max(1, Math.floor(originalImgWidth * rs));
    srcCanvas.height = Math.max(1, Math.floor(originalImgHeight * rs));
    ctxSrc.drawImage(currentImage, 0, 0, srcCanvas.width, srcCanvas.height);
    
    lastBgMode = '';
    refreshMatrix();
}

// ===== Load Image (auto-resize) =====
function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('File bukan gambar', true);
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const MAX_DIM = 1024;
            let w = img.width, h = img.height;
            if (w > MAX_DIM || h > MAX_DIM) {
                const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
                w = Math.floor(w * scale);
                h = Math.floor(h * scale);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w; tempCanvas.height = h;
                tempCanvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const resizedImg = new Image();
                resizedImg.onload = () => {
                    currentImage = resizedImg;
                    originalImgWidth = w;
                    originalImgHeight = h;
                    updateCanvasSize();
                    showToast(`Resize: ${img.width}x${img.height} → ${w}x${h}`);
                };
                resizedImg.src = tempCanvas.toDataURL('image/jpeg', 0.9);
            } else {
                currentImage = img;
                originalImgWidth = img.width;
                originalImgHeight = img.height;
                updateCanvasSize();
                showToast(`Dimuat: ${img.width}x${img.height}`);
            }
        };
        img.onerror = () => showToast('Gagal muat gambar', true);
        img.src = e.target.result;
    };
    reader.onerror = () => showToast('Gagal baca file', true);
    reader.readAsDataURL(file);
}

// ===== MediaRecorder =====
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

async function startRecording() {
    if (isRecording) return;
    if (!artCanvas || artCanvas.width === 0) {
        showToast('Canvas belum siap', true);
        return;
    }
    let stream;
    try {
        stream = artCanvas.captureStream(30);
    } catch (e) {
        showToast('Gagal capture stream: ' + e.message, true);
        return;
    }
    if (!stream || stream.getVideoTracks().length === 0) {
        showToast('Tidak ada video track', true);
        return;
    }
    recordedChunks = [];
    let mimeType = '';
    const codecs = ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'];
    for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
            mimeType = codec;
            break;
        }
    }
    if (!mimeType) {
        showToast('Browser tidak mendukung perekaman video', true);
        return;
    }
    try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch (e) {
        showToast('Gagal inisialisasi MediaRecorder', true);
        return;
    }
    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
        if (recordedChunks.length === 0) {
            showToast('Tidak ada data video', true);
            isRecording = false;
            recordBtn.textContent = 'RECORD';
            return;
        }
        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nettext_recording_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Rekaman tersimpan sebagai .webm');
        isRecording = false;
        recordBtn.textContent = 'RECORD';
    };
    mediaRecorder.onerror = (e) => {
        console.error(e);
        showToast('Error saat merekam', true);
        isRecording = false;
        recordBtn.textContent = 'RECORD';
    };
    mediaRecorder.start(100);
    isRecording = true;
    recordBtn.textContent = 'RECORDING...';
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
        }
    }, 5000);
}

// ===== Random Preset =====
function applyRandomPreset() {
    const p = presets[Math.floor(Math.random() * presets.length)];
    customCharsEl.value = p.customChars;
    alphabetSet = [...new Set(p.customChars.split(''))].join('');
    themeSelect.value = p.theme;
    bgModeSelect.value = p.bgMode;
    glowSlider.value = p.glow;
    waveSlider.value = p.wave;
    eulerMix.value = p.euler;
    contrastSlider.value = p.contrast;
    objSens.value = p.objSens;
    resSlider.value = p.res;
    bgIntensity.value = p.bgIntensity;
    resVal.textContent = resSlider.value;
    objVal.textContent = objSens.value;
    mixVal.textContent = eulerMix.value;
    contrastVal.textContent = contrastSlider.value;
    bgIntVal.textContent = bgIntensity.value;
    refreshMatrix();
    showToast(`🎲 Preset: ${p.name}`);
}

// ===== Animation Loop =====
function animate() {
    if (grid.length && !processing) {
        updateMovingForeground(grid, frame, alphabetSet);
        renderFull(
            ctxArt, bgCanvas, grid, artWidth, artHeight, frame,
            bgModeSelect.value, parseInt(bgIntensity.value)/100, dpr,
            THEMES[themeSelect.value] || THEMES.cyberpunk, bgCharSet,
            parseInt(glowSlider.value), parseInt(waveSlider.value),
            themeSelect.value, parseInt(eulerMix.value), parseInt(contrastSlider.value),
            showMask
        );
        frame++;
    }
    requestAnimationFrame(animate);
}

// ===== Event Listeners =====
upload.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
ratioSelect.addEventListener('change', () => { if (currentImage) updateCanvasSize(); });
customCharsEl.addEventListener('input', () => {
    let raw = customCharsEl.value.trim();
    if (!raw) raw = 'MATRIX_0x5.1_';
    alphabetSet = [...new Set(raw.split(''))].join('');
    refreshMatrix();
});
resSlider.addEventListener('input', () => { resVal.textContent = resSlider.value; refreshMatrix(); });
objSens.addEventListener('input', () => { objVal.textContent = objSens.value; refreshMatrix(); });
eulerMix.addEventListener('input', () => { mixVal.textContent = eulerMix.value; });
contrastSlider.addEventListener('input', () => { contrastVal.textContent = contrastSlider.value; });
glowSlider.addEventListener('input', () => {});
waveSlider.addEventListener('input', () => {});
themeSelect.addEventListener('change', () => { lastBgMode = ''; showToast('Tema: ' + themeSelect.options[themeSelect.selectedIndex].text); });
bgModeSelect.addEventListener('change', () => { showToast('BG: ' + bgModeSelect.options[bgModeSelect.selectedIndex].text); });
bgIntensity.addEventListener('input', () => { bgIntVal.textContent = bgIntensity.value; });
randomBtn.addEventListener('click', applyRandomPreset);
recordBtn.addEventListener('click', startRecording);
downloadBtn.addEventListener('click', () => {
    if (!grid.length) { showToast('Tidak ada hasil', true); return; }
    const oldShow = showMask;
    showMask = false;
    renderFull(
        ctxArt, bgCanvas, grid, artWidth, artHeight, frame,
        bgModeSelect.value, parseInt(bgIntensity.value)/100, dpr,
        THEMES[themeSelect.value] || THEMES.cyberpunk, bgCharSet,
        parseInt(glowSlider.value), parseInt(waveSlider.value),
        themeSelect.value, parseInt(eulerMix.value), parseInt(contrastSlider.value),
        false
    );
    showMask = oldShow;
    const a = document.createElement('a');
    a.download = 'nettext_art_' + Date.now() + '.png';
    a.href = artCanvas.toDataURL('image/png', 1);
    a.click();
    showToast('Disimpan');
});
maskToggle.addEventListener('click', () => {
    showMask = !showMask;
    maskToggle.textContent = showMask ? 'SEMBUNYI MASK' : 'LIHAT MASK';
    maskToggle.style.background = showMask ? 'rgba(255,0,0,0.3)' : 'rgba(0,0,0,.7)';
});

// Drag & Drop
let dragC = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragC++; dropOverlay.classList.add('on'); });
document.addEventListener('dragleave', e => { e.preventDefault(); dragC--; if (dragC <= 0) dropOverlay.classList.remove('on'); });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    dragC = 0;
    dropOverlay.classList.remove('on');
    if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
});

// Resize Observer
let rTimer = null;
new ResizeObserver(() => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => { if (currentImage) updateCanvasSize(); }, 250);
}).observe(document.getElementById('artCanvasWrapper'));

// Placeholder splash
(function initPlaceholder() {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 400;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 600, 400);
    g.addColorStop(0, '#0a1f0e');
    g.addColorStop(1, '#050d07');
    x.fillStyle = g;
    x.fillRect(0, 0, 600, 400);
    x.fillStyle = '#00ff66';
    x.font = 'bold 20px "Courier New", monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('UPLOAD ATAU DROP FOTO', 300, 185);
    x.fillStyle = '#3d7a4a';
    x.font = '11px "Courier New", monospace';
    x.fillText('Seret gambar ke sini', 300, 212);
    c.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            originalImgWidth = img.width;
            originalImgHeight = img.height;
            updateCanvasSize();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
})();

animate();