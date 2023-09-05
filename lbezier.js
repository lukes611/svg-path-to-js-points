import { LV2, LMat3 } from 'https://lukes611.github.io/LLA/LLA.js';

export const BZC = {
    nChooseI(n, i) {
        return this.factorial(n) / (this.factorial(i) * this.factorial(n-i));
    },

    factorial(n) {
        let out = 1;
        for (let i = 1; i <= n; i++) out *= i;
        return out;
    },

    B(t, points) {
        let n = points.length-1;
        let out = points[0].copy().scale(0);
        for(let i = 0; i < points.length; i++) {
            const p1 = Math.pow(1-t, n-i);
            const p2 = Math.pow(t, i);

            const scalar = this.nChooseI(n, i) * p1 * p2;
            const v = points[i].scale(scalar);
            out = out.add(v);
        }
        return out;
    },
};

const Arc = {
    /**
     * @param {LV2} u
     * @param {LV2} v
     * @returns {number}
     */
    angularDiff(u, v) {
        const sign = u.x*v.y - u.y*v.x < 0 ? -1 : 1;
        const mags = u.mag() * v.mag();
        return sign * Math.acos(u.dot(v) / mags);
    },

    /**
     * @param {number} rotation - rotation in angles
     * @returns {LMat3}
     */
    createRotationMat(rotation) {
        return new LMat3([
            Math.cos(rotation / 57.3), -Math.sin(rotation / 57.3), 0,
            Math.sin(rotation / 57.3), Math.cos(rotation / 57.3), 0,
            0, 0, 1,
        ]);
    },

    /**
     * @param {number} x1 start x pos
     * @param {number} y1 start y pos
     * @param {number} x2 end x pos
     * @param {number} y2 end y pos
     * @param {1 | 0} fA - large arc flag, 1 if use large arc, else 0
     * @param {1 | 0} fS - sweep flag, 1 if use one side, else 0 
     * @param {number} rx - x-radius of arc
     * @param {number} ry - y-radius of arc
     * @param {number} rotationIn - rotation or arc in angles 
     * @returns {[LV2, number, number, number, number]} center, angle1, angleDist, rx, ry
     */
    computeVariables(x1, y1, x2, y2, fA, fS, rx, ry, rotationIn) {
        const rotation = rotationIn / 57.3; // in radians
        const _m = new LMat3([
            Math.cos(rotation), Math.sin(rotation), 0,
            -Math.sin(rotation), Math.cos(rotation), 0,
            0, 0, 1,
        ]);
        const _pc = new LV2(x1, y1).sub(new LV2(x2, y2)).scale(0.5);
        const pi = _m.multLV2(_pc); // pi is x1', y1'

        const primer = ((pi.x**2)/(rx**2)) + ((pi.y**2)/(ry**2));
        let scaledUp = false;
        if (primer > 1) {
            const oldRx = rx;
            const oldRy = ry;
            rx = Math.sqrt(primer) * rx;
            ry = Math.sqrt(primer) * ry;
            scaledUp = oldRx < rx && oldRy < ry;
        }

        const scalar_p1 = rx**2 * ry**2 - rx**2 * pi.y**2 - ry**2 * pi.x**2;
        const scalar_p2 = rx**2 * pi.y**2 + ry**2 * pi.x**2;
        const prefix = fA === fS ? -1 : 1;
        const scalar = prefix * Math.sqrt(scaledUp ? 0 : scalar_p1 / scalar_p2);
        const _center = new LV2(
            (rx * pi.y) / ry,
            -(ry * pi.x) / rx,
        ).scale(scalar);

        const _m2 = new LMat3([
            Math.cos(rotation), -Math.sin(rotation), 0,
            Math.sin(rotation),  Math.cos(rotation), 0,
            0, 0, 1,
        ]);
        const offset = new LV2(x1, y1).add(new LV2(x2, y2)).scale(0.5);
        const center = _m2.multLV2(_center).add(offset);

        let angle1 = undefined;
        let angleDist = undefined;
        {
            // compute angular variables
            const a1 = this.angularDiff(
                new LV2(1, 0),
                new LV2((pi.x-_center.x)/rx, (pi.y-_center.y)/ry),
            );
            let ad1 = this.angularDiff(
                new LV2((pi.x-_center.x)/rx, (pi.y-_center.y)/ry),
                new LV2((-pi.x-_center.x)/rx, (-pi.y-_center.y)/ry),
            );
            const sc = 180 / Math.PI;
            ad1 = isNaN(ad1) ? 180 / sc : ad1;
            angle1 = a1 * sc;
            angleDist = (ad1 * sc) % 360;
            if (fS === 0 && angleDist > 0) angleDist -= 360;
            else if (fS === 1 && angleDist < 0) angleDist += 360;
        }

        return [center, angle1, angleDist, rx, ry];
    },

    /**
     * @param {LMat3} m 
     * @param {number} rx 
     * @param {number} ry 
     * @param {number} angle 
     * @param {LV2} center
     * @returns {LV2}
     */
    getPoint(m, rx, ry, angle, center) {
        const scalar = Math.PI / 180;
        const _p = new LV2(rx * Math.cos(angle * scalar), ry * Math.sin(angle * scalar));
        return m.multLV2(_p).add(center);
    },

    /**
     * 
     * @param {LV2} start 
     * @param {LV2} end 
     * @param {LV2} radi 
     * @param {number} rotation 
     * @param {1 | 0} fA 
     * @param {1 | 0} fS
     * @returns {LV2}
     */
    makeGenerator(start, end, radi, rotation, fA, fS) {
        const [center, angleStart, anglularDistance, rx, ry] = Arc.computeVariables(start.x, start.y, end.x, end.y, fA, fS, radi.x, radi.y, rotation);
        const m = Arc.createRotationMat(rotation);
        return (t) => {
            const i = angleStart + t * anglularDistance;
            return this.getPoint(m, rx, ry, i, center);
        };
    }
};


function svgStringToPathList(svg) {
    let rest = svg;
    const list = [];
    while (true) {
        const pathR = /\sd="([A-Za-z0-9\.,\s-]+)"/gm;
        const x = pathR.exec(rest);
        if (x && x.length >= 1) {
            list.push(x[1]);
            rest = rest.replace(x[0], '');
        } else {
            break;
        }
    }
    return list;
}

/**
 * @param {Array<object>} cp: CompiledPath 
 * @param {number} N 
 */
export function computePoints(cp, N = 10) {
    const points = [];
    let last = undefined;
    let secondLast = undefined;
    for (let i = 0; i < cp.length; i++) {
        const a = cp[i];
        const iz = (chars) => chars.includes(a.type);
        if (iz('ML')) {
            points.push(a.pts[0]);
            last = (a.pts[0]).copy();
            secondLast = last.copy();
        } else if (iz('Cc')) {
            const pts = [
                last.copy(),
                ...(a.pts.map(x => {
                    return a.type === 'c' ? (x).add(last) : x;
                })),
            ];
            for (let i = 0; i <= N; i++) {
                const p = BZC.B(i/N, pts);
                points.push(p);
            }
            last = pts[3].copy();
            secondLast = pts[2].copy();
        }  else if (iz('Aa')) {
            const start = last.copy();
            const options = a.options;
            const end = a.type === 'a' ? options.end.add(last) : options.end.copy();

            const gen = Arc.makeGenerator(start, end, options.rad, options.rotation, options.fA, options.fS);

            for (let i = 0; i <= N; i++) {
                const p = gen(i/N);
                points.push(p);
            }

            secondLast = end.copy();
            last = end.copy();
        } else if (iz('Hh')) {
            const hx = a.pts[0];
            const p = new LV2(
                a.type === 'h' ? hx + last.x : hx,
                last.y,
            );
            points.push(p);
            last = p.copy();
            secondLast = p.copy();
        }  else if (iz('Vv')) {
            const vy = a.pts[0];
            const p = new LV2(
                last.x,
                a.type === 'v' ? vy + last.y : vy,
            );
            points.push(p);
            last = p.copy();
            secondLast = p.copy();
        } else if (iz('Ss')) {
            const pts = [
                last.copy(),
                last.sub(secondLast).add(last),
                ...(a.pts.map(x => {
                    return a.type === 's' ? (x).add(last) : x;
                })),
            ];
            for (let i = 0; i <= N; i++) {
                const p = BZC.B(i/N, pts);
                points.push(p);
            }
            last = pts[3].copy();
            secondLast = pts[2].copy();
        } 
    }
    return points;
}

// type CompiledPathItem = {
//     type: 'L' | 'M' | 'C' | 'A' | 'a' | 'c' | 'h' | 'H' | 'v' | 'V' | 's',
//     pts: LV2[] | number[],
//     options?: {
//         rad: LV2,
//         rotation: number,
//         fA: 0 | 1,
//         fS: 0 | 1,
//         end: LV2,
//     },
// };

/**
 * @param {string} an svg path 
 * @returns {Array<object>} a compiled path
 */
export function compilePath(path) {
    const items = [];
    let i = 0;
    let mode = 'space';
    let item = undefined;
    const types = 'MmcCQqLlVvhHsS';
    let _ = 0;
    while (i < path.length) {
        _++;
        if (_ > 5000) break;
        const ch = path.charAt(i);
        const rest = path.substring(i);
        if (rest === 'Z' || rest==='z') {
            item = { type: 'L', pts: [(items[0].pts[0]).copy()] };
            items.push(item);
            i++;
            continue;
        }
        switch(mode) {
            case 'num-1': {
                const numRegex = /(-?[\d]*\.?[\d]*)[\s,]*/g;
                const [full, g1] = numRegex.exec(rest);
                if (g1) {
                    const n1 = Number(g1);
                    i += full.length;
                    item.pts.push(n1);
                    mode = 'space';
                }
            } break;
            case 'num': {
                if (rest === 'Z') {
                    mode = 'space';
                    break;
                }
                const numRegex = /(-?[\d]*\.?[\d]*)([,\s]|-)+([\d]*\.?[\d]*)[,\s]*/g;
                const [full, g1,g2, g3] = numRegex.exec(rest);
                if (g1 && g3) {
                    const n1 = Number(g1);
                    const n2 = Number(g3) * (g2 === '-' ? -1 : 1);
                    const p = new LV2(n1, n2);
                    item.pts.push(p);
                    i += full.length;
                    if (full.length === 0) return;
                    if ('Mm'.includes(item.type)) {
                        mode = 'space';
                    } else if ('LltT'.includes(item.type)) {
                        if (item.pts.length === 1) mode = 'space';
                    } else if ('cC'.includes(item.type)) {
                        if (item.pts.length === 3) mode = 'space';
                    } else if ('qQsS'.includes(item.type)) {
                        if (item.pts.length === 2) mode = 'space';
                    }
                } else {
                    i++;
                }
            } break;
            case 'a-mode': {
                const list = [];
                for (let j = 0; j < 7; j++) {
                    const numRegex = /(-?[\d]+\.?[\d]*)[\s,]*/g;
                    const rest = path.substring(i);
                    const ls = numRegex.exec(rest);

                    const p = Number(ls[1]);
                    list.push(p);
                    i += ls[0].length;
                }
                item.options = {
                    rad: new LV2(list[0], list[1]),
                    rotation: list[2],
                    fA: list[3],
                    fS: list[4],
                    end: new LV2(list[5], list[6]),
                };
                mode = 'space';
            } break;
            case 'space': {
                const numRegex = /$(-?[\d]*\.?[\d]*)/g;
                if (' ,'.includes(ch)) i++;
                else if (types.includes(ch)) {
                    mode = 'vVhH'.includes(ch) ? 'num-1' : 'num';
                    item = { type: ch, pts: [], };
                    items.push(item);
                    i++;
                } else if ('Aa'.includes(ch)) {
                    mode = 'a-mode';
                    item = { type: ch, pts: [], };
                    items.push(item);
                    i++;
                } else if (numRegex.test(rest)) {
                    const lastType = items.slice(-1)[0].type;
                    item = { type: lastType, pts: [] };
                    items.push(item);
                    mode = 'vVhH'.includes(lastType) ? 'num-1' : 'num';
                } else if (ch === 'Z' || ch === 'z') {
                    item = { type: 'L', pts: [(items[0].pts[0]).copy()] };
                    i++;
                }
            } break;
            default:
                i++;
        }
    }
    return items;
}