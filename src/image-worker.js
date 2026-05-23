function computeEdgeMap(imgData, w, h) {
    const data = imgData;
    const edge = new Float32Array(w * h);
    const g = (x, y) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return 0;
        const i = (y * w + x) * 4;
        return (data[i] + data[i+1] + data[i+2]) / 3;
    };
    for (let y = 1; y < h-1; y++) {
        for (let x = 1; x < w-1; x++) {
            const gx = -g(x-1, y-1) + g(x+1, y-1)
                    - 2*g(x-1, y) + 2*g(x+1, y)
                    - g(x-1, y+1) + g(x+1, y+1);
            const gy = -g(x-1, y-1) - 2*g(x, y-1) - g(x+1, y-1)
                    + g(x-1, y+1) + 2*g(x, y+1) + g(x+1, y+1);
            edge[y*w + x] = Math.min(1, Math.hypot(gx, gy) / 255);
        }
    }
    return edge;
}

function dilateMask(mask, rows, cols) {
    const nm = mask.map(r => [...r]);
    for (let r = 1; r < rows-1; r++) {
        for (let c = 1; c < cols-1; c++) {
            if (mask[r][c]) continue;
            let neighbor = false;
            for (let dr = -1; dr <= 1 && !neighbor; dr++) {
                for (let dc = -1; dc <= 1 && !neighbor; dc++) {
                    if (mask[r+dr][c+dc]) neighbor = true;
                }
            }
            if (neighbor) nm[r][c] = true;
        }
    }
    return nm;
}

function erodeMask(mask, rows, cols) {
    const nm = mask.map(r => [...r]);
    for (let r = 1; r < rows-1; r++) {
        for (let c = 1; c < cols-1; c++) {
            if (!mask[r][c]) continue;
            let all = true;
            for (let dr = -1; dr <= 1 && all; dr++) {
                for (let dc = -1; dc <= 1 && all; dc++) {
                    if (!mask[r+dr][c+dc]) all = false;
                }
            }
            if (!all) nm[r][c] = false;
        }
    }
    return nm;
}

function computeForegroundMask(edgeMap, imgData, w, h, cols, rows, sens) {
    const threshold = sens / 100;
    const data = imgData;
    let bgR = 0, bgG = 0, bgB = 0, bgCnt = 0;
    const sampleCorner = (sx, sy, ex, ey) => {
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const i = (y * w + x) * 4;
                bgR += data[i]; bgG += data[i+1]; bgB += data[i+2];
                bgCnt++;
            }
        }
    };
    const s = Math.ceil(Math.min(w, h) * 0.05);
    sampleCorner(0, 0, s, s);
    sampleCorner(w-s, 0, w, s);
    sampleCorner(0, h-s, s, h);
    sampleCorner(w-s, h-s, w, h);
    if (bgCnt > 0) { bgR /= bgCnt; bgG /= bgCnt; bgB /= bgCnt; }

    const salientMap = new Float32Array(w * h);
    for (let i = 0; i < w*h; i++) {
        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
        salientMap[i] = Math.sqrt((r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2) / 441.67;
    }

    const cx = w/2, cy = h/2, maxDist = Math.hypot(cx, cy);
    const cellW = w/cols, cellH = h/rows;
    let mask = Array(rows).fill().map(() => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const sx = Math.floor(c * cellW), sy = Math.floor(r * cellH);
            const ex = Math.min(Math.floor((c+1) * cellW), w);
            const ey = Math.min(Math.floor((r+1) * cellH), h);
            let eSum = 0, sSum = 0, cnt = 0;
            for (let y = sy; y < ey; y++) {
                for (let x = sx; x < ex; x++) {
                    eSum += edgeMap[y*w + x];
                    sSum += salientMap[y*w + x];
                    cnt++;
                }
            }
            const avgE = cnt ? eSum/cnt : 0;
            const avgS = cnt ? sSum/cnt : 0;
            const distN = 1 - Math.hypot((c+0.5)*cellW - cx, (r+0.5)*cellH - cy) / maxDist;
            mask[r][c] = ((avgE * 0.5 + avgS * 0.3 + distN * 0.2) > (threshold * 0.15));
        }
    }

    for (let i = 0; i < 2; i++) mask = dilateMask(mask, rows, cols);
    mask = erodeMask(mask, rows, cols);

    for (let r = 1; r < rows-1; r++) {
        for (let c = 1; c < cols-1; c++) {
            if (mask[r][c]) continue;
            let hasFg = false;
            for (let dr = -1; dr <= 1 && !hasFg; dr++) {
                for (let dc = -1; dc <= 1 && !hasFg; dc++) {
                    if (mask[r+dr] && mask[r+dr][c+dc]) hasFg = true;
                }
            }
            if (!hasFg) continue;
            const sx = Math.floor(c * cellW), sy = Math.floor(r * cellH);
            const ex = Math.min(Math.floor((c+1) * cellW), w);
            const ey = Math.min(Math.floor((r+1) * cellH), h);
            let eSum = 0, cnt3 = 0;
            for (let y = sy; y < ey; y++) {
                for (let x = sx; x < ex; x++) {
                    eSum += edgeMap[y*w + x];
                    cnt3++;
                }
            }
            if (cnt3 && eSum/cnt3 > 0.12) mask[r][c] = true;
        }
    }
    return mask;
}

self.onmessage = function(e) {
    const { imageData, width, height, cols, rows, sens } = e.data;
    const edgeMap = computeEdgeMap(imageData, width, height);
    const mask = computeForegroundMask(edgeMap, imageData, width, height, cols, rows, sens);
    const flatMask = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            flatMask.push(mask[r][c]);
        }
    }
    self.postMessage({
        edgeMap: edgeMap.buffer,
        mask: flatMask,
        cols,
        rows
    }, [edgeMap.buffer]);
};