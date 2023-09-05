import { LV2} from 'https://lukes611.github.io/LLA/LLA.js';
import { compilePath, computePoints } from './lbezier.js';
import { fixPolygon, findMinMaxOfPoints } from './helpers.js';

// svg path input
let rawString = localStorage.getItem('rawString') || '';
createInput('Input svg path:', 'textarea', rawString, document.body, newValue => {
    rawString = newValue;
    localStorage.setItem('rawString', rawString);
    setTimeout(update, 500);
}, {
    style: {
        width: '700px',
        minHeight: '180px',
    }
});


// quantization input
let quantization = Number(localStorage.getItem('quantization') || '10');
createInput('Quantization:', 'number', quantization, document.body, newValue => {
    quantization = Number(newValue);
    localStorage.setItem('quantization', quantization.toString());
    setTimeout(update, 500);
}, { min: 2, max: 2000 });

let offset = LV2.fromJSON(localStorage.getItem('offset') || new LV2(0, 0).toJSON());
createLV2Input('Offset:', offset, document.body, (v) => {
    offset = v;
    localStorage.setItem('offset', offset.toJSON().toString());
    setTimeout(update, 500);
});


let scale = Number(localStorage.getItem('scale') || 1);
createInput('Scale:', 'number', scale, document.body, (v) => {
    scale = v;
    localStorage.setItem('scale', scale.toString());
    setTimeout(update, 500);
});

let showIndices = JSON.parse(localStorage.getItem('showIndices') || 'false');
createInput('Draw Indices:', 'boolean', showIndices, document.body, (v) => {
    showIndices = v;
    localStorage.setItem('showIndices', showIndices.toString());
    setTimeout(update, 500);
});



// draw the path 
const pathOutputEl = document.createElement('div');
document.body.appendChild(pathOutputEl);
function ptEq(a, b) {
    return a.x === b.x && a.y === b.y;
}

function update() {
    pathOutputEl.innerHTML = '';
    const container = document.createElement('div');
    pathOutputEl.appendChild(container);
    try {
        const path = compilePath(rawString);
        const ptsTmp = computePoints(path, quantization);
        let pts = [];
        while (ptsTmp.length > 2) {
            const lastIndex = ptsTmp.length - 1;
            if (ptEq(ptsTmp[lastIndex], ptsTmp[lastIndex-1])) ptsTmp.pop();
            else if (ptEq(ptsTmp[0], ptsTmp[1])) ptsTmp.shift();
            else if (ptEq(ptsTmp[0], ptsTmp[lastIndex])) ptsTmp.pop();
            else break;
        }
        for (let i = 0; i < ptsTmp.length; i++) {
            const p = ptsTmp[i];
            if (i === 0) pts.push(p);
            else if (i === ptsTmp.length -1 && !ptEq(p, pts[0])) pts.push(p);
            else if (!ptEq(pts[pts.length-1], p)) pts.push(p);
        }
        pts = fixPolygon(pts);

        console.log(pts)
        textEl('Input:', container);
        textEl(`Points: ${pts.length}`, container);
        if (pts.length) {
            const oldSizes = findMinMaxOfPoints(pts);
            pts = pts.map(p => {
                return p.sub(oldSizes.min).scale(scale).add(offset);
            });
            const { min: mn, max: mx } = findMinMaxOfPoints(pts);
            

            textEl(`Top left: ${mn.toString()}`, container);
            textEl(`Size: ${(mx.sub(mn)).toString()}`, container);
            const polySize = mx.sub(mn);

            const padding = 16;
            const dpi = window.devicePixelRatio;
            const canvas = document.createElement('canvas');
            canvas.width = (500 + padding * 2) * dpi;
            canvas.height = (500 + padding * 2) * dpi;
            canvas.style.width = (500 + padding * 2) + 'px';
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const tp = (p) => {
                let s = 1;
                if (polySize.x > polySize.y) {
                    s = (500 * dpi) / polySize.x;
                } else {
                    s = (500 * dpi) / polySize.y;
                }
                return p.sub(mn).scale(s).add(new LV2(padding, padding));
            };
            

            ctx.beginPath();
            let p = tp(pts[0]);
            ctx.moveTo(p.x, p.y);
            for (let i = 1; i < pts.length; i++) {
                p = tp(pts[i]);
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();


            if (showIndices) {
                for (let i = 0; i < pts.length; i++) {
                    const p = tp(pts[i]);
                    ctx.fillStyle = 'green';
                    ctx.font = '50px serif';
                    const offset = 10;
                    ctx.fillText(`${i}.`, p.x, p.y + offset);
                }
            }


            container.appendChild(canvas);

            const jsonPoints = pts.map(p => {
                const tmp = p.copy();
                tmp.x = Number(tmp.x.toFixed(2));
                tmp.y = Number(tmp.y.toFixed(2));
                return tmp.toJSON();
            });
            textEl(`json points:`, container, 'div');
            textEl(`${JSON.stringify(jsonPoints)}`, container, 'textarea');
            textEl(`js points:`, container, 'div');
            textEl(`${JSON.stringify(jsonPoints).replace(/"/g, '')}`, container, 'textarea');

        }
        
    } catch (e) {
        
    
        console.log({ error: e, msg: 'error '});
        const errorDiv = textEl(e.message, container);
        errorDiv.style.color = 'red';
    }
}
if (rawString.length) update();
// button to set offset
// button to set scale
// output points list

function textEl(str = '', container = undefined, type = 'div') {
    const e = document.createElement(type);
    e.innerHTML = str;
    if (container != null) {
        console.log('appending', e);
        container.appendChild(e);
    }
    console.log(e)
    return e;
}

function createLV2Input(label, defaultValue, container, onInput) {
    label && textEl(label, container);
    const latest = defaultValue.copy();
    createInput(undefined, 'number', defaultValue.x, container, v => {
        latest.x = v;
        onInput(latest);
    })
    createInput(undefined, 'number', defaultValue.y, container, v => {
        latest.y = v;
        onInput(latest);
    })
}

// type = text | number | textarea
// settings: { min: number, max: number}, if type = text
// settings can also have { style: CssStyleProperties }
function createInput(label, type, defaultValue, container, onInput, settings) {
    label && textEl(label, container);
    const inputEl = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (type === 'number') {
        inputEl.type = type;
        if (settings != null) {
            if (settings.min != null) inputEl.min = settings.min;
            if (settings.max != null) inputEl.max = settings.max;
        }
    } else if (type === 'boolean') {
        inputEl.type = 'checkbox';
    }
    if (type === 'boolean') inputEl.checked = defaultValue;
    else inputEl.value = defaultValue;
    inputEl.oninput = () => {
        const raw = inputEl.value;
        if (type === 'number') onInput(Number(raw));
        else if (type === 'boolean') onInput(inputEl.checked);
        else onInput(raw);
    };
    container.appendChild(inputEl);
    if (settings?.style) {
        Object.assign(inputEl.style, settings.style);
    }

    return { inputEl };
}