
// returns bool
function isConvex(p0, p1, p2) {
    const v1 = p1.sub(p0).unit();
    const v2 = p2.sub(p1).unit();
    return determinant(v1, v2) < 0;
}

function determinant(a, b) {
    return a.x * b.y - b.x * a.y;
}

export function fixPolygon(pts) {
    if (isCounterClockwise()) {
        return pts;
    }
    const other =  [...pts].reverse();
    other.unshift(other.pop());
    return other;
    function isCounterClockwise() {
        let x = 0;
        for (let i = 0; i < pts.length; i++) {
            const prev = i - 1 < 0 ? pts.length - 1 : i - 1;
            const next = (i + 1) % pts.length;
            if (isConvex(pts[prev], pts[i % pts.length], pts[next])) {
                x++;
            } else {
                x--;
            }
        }
        return x > 0;
    }
}

export function findMinMaxOfPoints(pts) {
    const mn = pts[0].copy();
    const mx = pts[0].copy();
    for (const p of pts) {
        mn.x = Math.min(mn.x, p.x);
        mn.y = Math.min(mn.y, p.y);
        mx.x = Math.max(mx.x, p.x);
        mx.y = Math.max(mx.y, p.y);
    }
    return { min: mn, max: mx };
}