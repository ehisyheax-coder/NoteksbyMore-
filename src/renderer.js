import { getEulerColor } from './themes.js';

function hashN(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = ((n ^ (n >> 13)) * 1274126177) | 0;
    n = n ^ (n >> 16);
    return (n & 0x7fffffff) / 0x7fffffff;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
    return (hashN(ix, iy) * (1 - fx) + hashN(ix+1, iy) * fx) * (1 - fy) +
           (hashN(ix, iy+1) * (1 - fx) + hashN(ix+1, iy+1) * fx) * fy;
}
function fbm(x, y) {
    return valueNoise(x, y) + valueNoise(x*2, y*2)*0.5 + valueNoise(x*4, y*4)*0.25;
}
export function generateNoiseTexture() {
    const s = 512;
    const canvas = document.createElement('canvas');
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(s, s);
    const data = imgData.data;
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            const v = fbm(x * 0.02, y * 0.02);
            const i = (y * s + x) * 4;
            data[i] = Math.floor(v * 20);
            data[i+1] = Math.floor(v * 70);
            data[i+2] = Math.floor(v * 30);
            data[i+3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

let rainColumns = [];
function initRainColumns(artWidth, artHeight, dpr, bgCharSet) {
    const sp = Math.max(12, 16 * dpr);
    const n = Math.ceil(artWidth / sp);
    rainColumns = [];
    for (let i = 0; i < n; i++) {
        const trailLen = 5 + Math.floor(Math.random() * 14);
        const chars = [];
        for (let j = 0; j < trailLen; j++) chars.push(bgCharSet[Math.floor(Math.random() * bgCharSet.length)]);
        rainColumns.push({
            x: i * sp + Math.random() * sp * 0.5,
            y: Math.random() * artHeight * 2 - artHeight,
            speed: (2 + Math.random() * 5) * dpr,
            size: Math.max(9, (10 + Math.random() * 4) * dpr),
            chars: chars,
            trailLen: trailLen,
            tick: 0
        });
    }
}
function renderRainFrame(bgCtx, artWidth, artHeight, intensity, themeRainColor, bgCharSet, dpr) {
    if (!rainColumns.length) initRainColumns(artWidth, artHeight, dpr, bgCharSet);
    bgCtx.fillStyle = `rgba(0,0,0,${0.04 + 0.12 * (1 - intensity)})`;
    bgCtx.fillRect(0, 0, artWidth, artHeight);
    const sf = 0.4 + intensity * 0.8;
    for (const col of rainColumns) {
        col.y += col.speed * sf;
        col.tick++;
        if (col.tick % 4 === 0) {
            col.chars[Math.floor(Math.random() * col.chars.length)] = bgCharSet[Math.floor(Math.random() * bgCharSet.length)];
        }
        bgCtx.font = `${col.size}px "Courier New", monospace`;
        bgCtx.textBaseline = 'top';
        for (let j = 0; j < col.trailLen; j++) {
            const cy = col.y - j * col.size;
            if (cy < -col.size || cy > artHeight + col.size) continue;
            if (j === 0) bgCtx.fillStyle = `rgba(220,255,230,${0.9 * intensity})`;
            else if (j < 3) bgCtx.fillStyle = `rgba(${themeRainColor[0]},${Math.min(255, themeRainColor[1]+60)},${themeRainColor[2]},${0.6 * intensity})`;
            else bgCtx.fillStyle = `rgba(${themeRainColor[0]},${themeRainColor[1]},${themeRainColor[2]},${Math.max(0.04, (1 - j/col.trailLen) * 0.4 * intensity)})`;
            bgCtx.fillText(col.chars[j % col.chars.length], col.x, cy);
        }
        if (col.y - col.trailLen * col.size > artHeight) {
            col.y = -Math.random() * artHeight * 0.5;
            col.speed = (2 + Math.random() * 5) * dpr;
        }
    }
}

let lastBgMode = '';
let noiseTexture = null;
let noiseTime = 0;
export function renderBackgroundDynamic(ctx, artWidth, artHeight, mode, intensity, dpr, theme, bgCharSet) {
    if (mode !== lastBgMode) {
        ctx.clearRect(0, 0, artWidth, artHeight);
        lastBgMode = mode;
        if (mode === 'rain') initRainColumns(artWidth, artHeight, dpr, bgCharSet);
        noiseTexture = null;
    }
    if (mode === 'noise') {
        if (!noiseTexture) noiseTexture = generateNoiseTexture();
        noiseTime += 0.4;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, artWidth, artHeight);
        ctx.globalAlpha = 0.25 + 0.55 * intensity;
        const ox = (noiseTime * 0.7) % 512;
        const oy = (noiseTime * 0.4) % 512;
        for (let y = -512; y < artHeight + 512; y += 512) {
            for (let x = -512; x < artWidth + 512; x += 512) {
                ctx.drawImage(noiseTexture, x + ox, y + oy);
                ctx.drawImage(noiseTexture, x + ox - 512, y + oy);
                ctx.drawImage(noiseTexture, x + ox, y + oy - 512);
                ctx.drawImage(noiseTexture, x + ox - 512, y + oy - 512);
            }
        }
        ctx.globalAlpha = 1;
    } else if (mode === 'rain') {
        renderRainFrame(ctx, artWidth, artHeight, intensity, theme.rainColor, bgCharSet, dpr);
    } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, artWidth, artHeight);
    }
}

function computeWaveOffset(grid, r, c, frame, waveAmp, artWidth, artHeight) {
    if (waveAmp < 0.01) return { dx: 0, dy: 0 };
    const cols = grid[0].length, rows = grid.length;
    const cx = cols/2, cy = rows/2;
    const dist = Math.hypot(c - cx, r - cy);
    const wave1 = Math.sin(dist * 0.4 - frame * 0.06 + grid[r][c].waveOffset) * waveAmp;
    const wave2 = Math.sin(c * 0.3 + frame * 0.04) * waveAmp * 0.5;
    const cellW = artWidth / cols, cellH = artHeight / rows;
    return { dx: (wave1 + wave2) * cellW * 0.12, dy: wave1 * cellH * 0.08 };
}

export function drawForeground(ctx, grid, frame, artWidth, artHeight, glowValue, waveSliderValue, themeName, eulerMixValue, contrastValue, dpr) {
    if (!grid.length) return;
    const glow = glowValue;
    const waveAmp = waveSliderValue / 100;
    const isChroma = (themeName === 'cyberpunk');
    const rows = grid.length, cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            if (!cell.isForeground) continue;
            const baseFS = Math.max(8 * dpr, Math.min(cell.w * 0.82, 26 * dpr));
            const detailBoost = 1 + cell.edgeStr * 0.35;
            const fontSize = Math.min(baseFS * detailBoost, cell.w * 0.95, cell.h * 0.95);
            const wave = computeWaveOffset(grid, r, c, frame, waveAmp, artWidth, artHeight);
            ctx.font = `bold ${fontSize}px "Courier New", monospace`;
            ctx.textBaseline = 'top';
            const col = getEulerColor(cell, eulerMixValue, contrastValue, themeName);
            const tw = ctx.measureText(cell.char).width;
            let xPos = cell.x + (cell.w - tw)/2 + wave.dx;
            let yPos = cell.y + (cell.h - fontSize)/2 + wave.dy;

            if (isChroma && cell.isEdgeCell) {
                const shift = 2 * dpr;
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = `rgb(${col.r}, 0, 0)`;
                ctx.fillText(cell.char, xPos - shift, yPos);
                ctx.fillStyle = `rgb(0, ${Math.min(255, col.g + 50)}, ${col.b})`;
                ctx.fillText(cell.char, xPos + shift, yPos);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
                if (cell.edgeStr > 0.3 && glow > 0) {
                    ctx.shadowBlur = glow + cell.edgeStr * 5;
                    ctx.shadowColor = '#00ffff';
                } else {
                    ctx.shadowBlur = glow;
                    ctx.shadowColor = '#00ffff';
                }
                if (waveAmp > 0.1 && cell.edgeStr > 0.1) {
                    ctx.save();
                    ctx.translate(xPos + tw/2, yPos + fontSize/2);
                    ctx.rotate(cell.gradAngle * 0.12);
                    ctx.fillText(cell.char, -tw/2, -fontSize/2);
                    ctx.restore();
                } else {
                    ctx.fillText(cell.char, xPos, yPos);
                }
                ctx.shadowBlur = 0;
            }
        }
    }
}

export function drawMaskOverlay(ctx, grid, artWidth, artHeight, dpr, showMask) {
    if (!grid.length || !showMask) return;
    ctx.fillStyle = 'rgba(255,0,0,0.25)';
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c].isForeground) {
                ctx.fillRect(grid[r][c].x, grid[r][c].y, grid[r][c].w, grid[r][c].h);
            }
        }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${14 * dpr}px monospace`;
    ctx.textBaseline = 'top';
    const fgCount = grid.flat().filter(cell => cell.isForeground).length;
    const total = grid.flat().length;
    ctx.fillText(`MASK: ${fgCount}/${total} cells (${(fgCount/total*100).toFixed(1)}%)`, 10*dpr, 10*dpr);
}

export function renderFull(ctxArt, bgCanvas, grid, artWidth, artHeight, frame, mode, intensity, dpr, theme, bgCharSet, glowValue, waveSliderValue, themeName, eulerMixValue, contrastValue, showMask) {
    if (!grid.length) return;
    const bgCtx = bgCanvas.getContext('2d');
    renderBackgroundDynamic(bgCtx, artWidth, artHeight, mode, intensity, dpr, theme, bgCharSet);
    ctxArt.clearRect(0, 0, artWidth, artHeight);
    ctxArt.drawImage(bgCanvas, 0, 0, artWidth, artHeight);
    drawForeground(ctxArt, grid, frame, artWidth, artHeight, glowValue, waveSliderValue, themeName, eulerMixValue, contrastValue, dpr);
    drawMaskOverlay(ctxArt, grid, artWidth, artHeight, dpr, showMask);
}

export function updateMovingForeground(grid, frame, alphabetSet) {
    if (!grid.length) return;
    if (frame % 3 === 0) {
        const rows = grid.length, cols = grid[0].length;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (!cell.isForeground || !cell.isEdgeCell) continue;
                const prob = cell.edgeStr > 0.2 ? 0.18 : 0.06;
                if (alphabetSet.length > 0 && Math.random() < prob) {
                    cell.char = alphabetSet[Math.floor(Math.random() * alphabetSet.length)];
                }
            }
        }
    }
}
