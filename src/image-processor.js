export function computeLocalFreqPhase(imgData, w, h, cols, rows) {
    const cellW = w / cols;
    const cellH = h / rows;
    const freqGrid = Array(rows).fill().map(() => Array(cols).fill(0));
    const phaseGrid = Array(rows).fill().map(() => Array(cols).fill(0));
    const data = imgData.data;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let sx = Math.floor(c * cellW);
            let sy = Math.floor(r * cellH);
            let ex = Math.min(Math.floor((c + 1) * cellW), w);
            let ey = Math.min(Math.floor((r + 1) * cellH), h);

            if (sx >= ex || sy >= ey) {
                freqGrid[r][c] = 0.5;
                phaseGrid[r][c] = 0;
                continue;
            }

            const vals = [];
            for (let y = sy; y < ey; y++) {
                for (let x = sx; x < ex; x++) {
                    const idx = (y * w + x) * 4;
                    if (idx + 2 >= data.length) continue;
                    const bright = (data[idx] + data[idx+1] + data[idx+2]) / (3 * 255);
                    vals.push(bright);
                }
            }

            if (vals.length < 2) {
                freqGrid[r][c] = 0.5;
                phaseGrid[r][c] = 0;
                continue;
            }

            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
            freqGrid[r][c] = Math.min(0.95, variance * 1.5);

            let dx = 0, dy = 0;
            const maxY = Math.min(ey, h - 1);
            const maxX = Math.min(ex, w - 1);
            for (let y = Math.max(1, sy); y < maxY; y++) {
                for (let x = Math.max(1, sx); x < maxX; x++) {
                    const i = (y * w + x) * 4;
                    if (i + 2 >= data.length) continue;
                    const gv = (data[i] + data[i+1] + data[i+2]) / 3;
                    const iR = (y * w + x + 1) * 4;
                    const iD = ((y + 1) * w + x) * 4;
                    if (iR + 2 < data.length && iD + 2 < data.length) {
                        const gR = (data[iR] + data[iR+1] + data[iR+2]) / 3;
                        const gD = (data[iD] + data[iD+1] + data[iD+2]) / 3;
                        dx += (gR - gv);
                        dy += (gD - gv);
                    }
                }
            }
            phaseGrid[r][c] = Math.atan2(dy, dx);
        }
    }
    return { freqGrid, phaseGrid };
}

export function generateGridWithPrecomputed(
    img, srcCanvas, ctxSrc,
    resSliderValue, objSensValue,
    alphabetSet, bgCharSet, rampChars,
    edgeMap, foregroundMask, cols, rows,
    onProgress
) {
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    if (srcW < 1 || srcH < 1) return false;

    ctxSrc.drawImage(img, 0, 0, srcW, srcH);
    let imgData;
    try {
        imgData = ctxSrc.getImageData(0, 0, srcW, srcH);
    } catch (e) {
        console.error(e);
        return false;
    }
    const data = imgData.data;

    if (onProgress) onProgress(0.55);
    const { freqGrid, phaseGrid } = computeLocalFreqPhase(imgData, srcW, srcH, cols, rows);
    if (onProgress) onProgress(0.75);

    const cellW = srcW / cols;
    const cellH = srcH / rows;
    const mainChars = alphabetSet.split('');
    const bgChars = bgCharSet.split('');
    if (!mainChars.length) mainChars.push('A');
    if (!bgChars.length) bgChars.push('.');

    const newGrid = [];
    for (let r = 0; r < rows; r++) {
        newGrid[r] = [];
        for (let c = 0; c < cols; c++) {
            let sx = Math.floor(c * cellW);
            let sy = Math.floor(r * cellH);
            let ex = Math.min(Math.floor((c + 1) * cellW), srcW);
            let ey = Math.min(Math.floor((r + 1) * cellH), srcH);

            if (sx >= ex || sy >= ey) {
                newGrid[r][c] = {
                    brightness: 0, isForeground: false,
                    origR: 0, origG: 0, origB: 0,
                    bledR: 0, bledG: 0, bledB: 0,
                    freq: 0, phase: 0, edgeStr: 0,
                    gradAngle: 0, char: ' ',
                    x: c * cellW, y: r * cellH, w: cellW, h: cellH,
                    waveOffset: Math.random() * Math.PI * 2, isEdgeCell: false
                };
                continue;
            }

            let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
            let edgeSum = 0;
            for (let y = sy; y < ey; y++) {
                for (let x = sx; x < ex; x++) {
                    const idx = (y * srcW + x) * 4;
                    if (idx + 2 >= data.length) continue;
                    rSum += data[idx];
                    gSum += data[idx+1];
                    bSum += data[idx+2];
                    cnt++;
                    const edgeIdx = y * srcW + x;
                    if (edgeIdx < edgeMap.length) edgeSum += edgeMap[edgeIdx];
                }
            }

            const avgR = cnt > 0 ? rSum / cnt : 0;
            const avgG = cnt > 0 ? gSum / cnt : 0;
            const avgB = cnt > 0 ? bSum / cnt : 0;
            const brightness = cnt > 0 ? (rSum + gSum + bSum) / (3 * 255 * cnt) : 0;
            const edgeStr = cnt > 0 ? edgeSum / cnt : 0;
            const isFg = (r < foregroundMask.length && c < foregroundMask[r].length) ? foregroundMask[r][c] : false;

            newGrid[r][c] = {
                brightness,
                isForeground: isFg,
                origR: avgR, origG: avgG, origB: avgB,
                bledR: avgR, bledG: avgG, bledB: avgB,
                freq: freqGrid[r][c],
                phase: phaseGrid[r][c],
                edgeStr,
                gradAngle: phaseGrid[r][c],
                x: c * cellW,
                y: r * cellH,
                w: cellW,
                h: cellH,
                waveOffset: Math.random() * Math.PI * 2,
                isEdgeCell: false,
                char: ' '
            };
        }
    }

    let minB = 1, maxB = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = newGrid[r][c];
            if (cell.isForeground) {
                if (cell.brightness < minB) minB = cell.brightness;
                if (cell.brightness > maxB) maxB = cell.brightness;
            }
        }
    }
    if (maxB > minB && (maxB - minB) > 1e-6) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = newGrid[r][c];
                if (cell.isForeground) {
                    cell.brightness = (cell.brightness - minB) / (maxB - minB);
                    cell.brightness = Math.min(1, Math.max(0, cell.brightness));
                }
            }
        }
    }

    const ramp = rampChars.split('');
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = newGrid[r][c];
            if (!cell.isForeground) continue;
            const isEdge = cell.edgeStr > 0.2;
            const charSet = isEdge ? mainChars : ramp;
            if (charSet.length === 0) continue;
            let ci = Math.floor(cell.brightness * (charSet.length - 1));
            ci = Math.min(Math.max(0, ci), charSet.length - 1);
            cell.char = charSet[ci];
            cell.isEdgeCell = isEdge;
        }
    }

    if (onProgress) onProgress(1.0);
    return { grid: newGrid, gridCols: cols, gridRows: rows, foregroundMask };
}

export function applyColorBleed(grid, gridRows, gridCols) {
    if (!grid.length) return;
    const bleed = 0.15;
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const cell = grid[r][c];
            cell.bledR = cell.origR;
            cell.bledG = cell.origG;
            cell.bledB = cell.origB;
        }
    }
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const cell = grid[r][c];
            if (!cell.isForeground) continue;
            let rB = 0, gB = 0, bB = 0, n = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc].isForeground) {
                        rB += grid[nr][nc].origR;
                        gB += grid[nr][nc].origG;
                        bB += grid[nr][nc].origB;
                        n++;
                    }
                }
            }
            if (n > 0) {
                rB /= n;
                gB /= n;
                bB /= n;
                cell.bledR = cell.origR * (1 - bleed) + rB * bleed;
                cell.bledG = cell.origG * (1 - bleed) + gB * bleed;
                cell.bledB = cell.origB * (1 - bleed) + bB * bleed;
            }
        }
    }
}
