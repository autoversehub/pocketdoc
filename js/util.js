// small helpers used by every tool

// make an element: h('div', { class: 'x', onclick: fn }, 'text', child)
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  }
  return el;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

export function download(data, name, type = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  // give the browser time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function size(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function baseName(name) {
  return name.replace(/\.[^.]+$/, '');
}

export const wait = () => new Promise(r => setTimeout(r, 0));

// drop area with a pick button, and a camera button on phones
export function dropZone({ accept, multiple = false, title, note, camera = false, onFiles }) {
  const input = h('input', { type: 'file', accept, multiple, hidden: true });
  const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  // some phone galleries only let you pick one photo, the files app lets you pick many
  const images = accept === 'image/*';
  const browse = h('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif', multiple, hidden: true });

  const send = list => {
    const files = [...list].filter(f => matches(f, accept));
    if (!files.length) return toast('That file type does not work here');
    onFiles(multiple ? files : [files[0]]);
  };

  input.onchange = () => { send(input.files); input.value = ''; };
  cam.onchange = () => { send(cam.files); cam.value = ''; };
  browse.onchange = () => { send(browse.files); browse.value = ''; };

  const box = h('div', { class: 'drop', onclick: e => { if (!e.target.closest('button')) input.click(); } },
    h('strong', {}, title),
    h('span', {}, note || 'or drop files here'),
    h('div', { class: 'drop-actions' },
      h('button', { class: 'btn main', type: 'button', onclick: () => input.click() }, images ? (multiple ? 'Choose photos' : 'Choose photo') : (multiple ? 'Choose files' : 'Choose file')),
      images && multiple && h('button', { class: 'btn', type: 'button', onclick: () => browse.click() }, 'Pick from files'),
      camera && h('button', { class: 'btn', type: 'button', onclick: () => cam.click() }, 'Take photo')
    ),
    images && multiple && h('p', { class: 'hint' }, 'Tip: to pick many photos at once, press and hold the first one, then tap the rest. If your gallery only takes one, use Pick from files.')
  );

  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', e => {
    e.preventDefault();
    box.classList.remove('over');
    send(e.dataTransfer.files);
  });

  // inputs sit outside the box so their clicks don't bubble back into it
  return h('div', {}, box, input, cam, browse);
}

function matches(file, accept) {
  if (!accept) return true;
  return accept.split(',').some(a => {
    a = a.trim();
    if (a === 'image/*' && !file.type) return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name);
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a);
    return file.type === a;
  });
}

// pdf.js is big so only load it when a tool needs it
let pdfjsPromise;
export function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdf.min.mjs').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

export async function openPdf(bytes) {
  const lib = await pdfjs();
  // pdf.js takes ownership of the buffer, so pass a copy
  return lib.getDocument({ data: bytes.slice(0) }).promise;
}

export async function renderPage(doc, num, scale = 1) {
  const page = await doc.getPage(num);
  const view = page.getViewport({ scale });
  const canvas = h('canvas');
  canvas.width = Math.floor(view.width);
  canvas.height = Math.floor(view.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: view }).promise;
  return canvas;
}

// fit a page into a box of w x h px
export async function thumb(doc, num, w = 160) {
  const page = await doc.getPage(num);
  const v = page.getViewport({ scale: 1 });
  return renderPage(doc, num, w / v.width);
}

export async function loadPdfLib(bytes) {
  const { PDFDocument } = window.PDFLib;
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    if (/encrypt/i.test(e.message)) {
      // some files have an owner lock but no open password, these still load
      return PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    throw e;
  }
}

// "1-3, 5, 8-" -> [[0,1,2],[4],[7,8,9]] (zero based)
export function parseRanges(text, max) {
  const out = [];
  for (const part of text.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d*)\s*-\s*(\d*)$/);
    let a, b;
    if (m) {
      a = m[1] ? +m[1] : 1;
      b = m[2] ? +m[2] : max;
    } else if (/^\d+$/.test(p)) {
      a = b = +p;
    } else {
      throw new Error('Could not read "' + p + '"');
    }
    if (a < 1 || b > max || a > b) throw new Error('Page range "' + p + '" is outside 1 to ' + max);
    const list = [];
    for (let i = a; i <= b; i++) list.push(i - 1);
    out.push(list);
  }
  if (!out.length) throw new Error('Type some pages first');
  return out;
}

export function progress() {
  const bar = h('div');
  const el = h('div', { class: 'progress' }, bar);
  return {
    el,
    set(v) { el.classList.add('on'); bar.style.width = Math.round(v * 100) + '%'; },
    done() { el.classList.remove('on'); bar.style.width = '0'; }
  };
}

// list of files that can be moved up and down or removed
export function fileList(items, onChange, render) {
  const ul = h('ul', { class: 'files' });
  const draw = () => {
    ul.replaceChildren(...items.map((it, i) => h('li', {},
      render(it),
      h('div', { class: 'btns' },
        h('button', { class: 'btn icon small', title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { class: 'btn icon small', title: 'Move down', disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓'),
        h('button', { class: 'btn icon small danger', title: 'Remove', onclick: () => { items.splice(i, 1); draw(); onChange(); } }, '×')
      )
    )));
  };
  const move = (i, d) => {
    [items[i], items[i + d]] = [items[i + d], items[i]];
    draw();
    onChange();
  };
  draw();
  return { el: ul, draw };
}

export function field(label, input, cls = '') {
  return h('div', { class: 'field ' + cls }, h('label', {}, label), input);
}

export function select(options, value) {
  return h('select', {}, ...options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
}

// read an image file into a canvas, keeps phone photo rotation right
export async function imageToCanvas(file, maxSide = 0) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // older safari, fall back to an img tag
    bmp = await new Promise((ok, bad) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => bad(new Error('Could not open ' + file.name));
      img.src = URL.createObjectURL(file);
    });
  }
  let w = bmp.width, hgt = bmp.height;
  if (maxSide && Math.max(w, hgt) > maxSide) {
    const s = maxSide / Math.max(w, hgt);
    w = Math.round(w * s);
    hgt = Math.round(hgt * s);
  }
  const c = h('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, hgt);
  ctx.drawImage(bmp, 0, 0, w, hgt);
  return c;
}

export function canvasBlob(canvas, type = 'image/jpeg', quality = 0.9) {
  return new Promise(r => canvas.toBlob(r, type, quality));
}

export async function canvasBytes(canvas, type, quality) {
  const b = await canvasBlob(canvas, type, quality);
  return new Uint8Array(await b.arrayBuffer());
}

export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a5: [419.53, 595.28]
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return window.PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// pick one pdf, then show its name with a button to pick another
export function singlePdf(root, onLoad, title = 'Choose a PDF') {
  const drop = h('div', { class: 'panel' });
  const picked = h('div', { class: 'panel', hidden: true });
  const zone = dropZone({ accept: 'application/pdf,.pdf', title, onFiles: async ([file]) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      picked.replaceChildren(h('ul', { class: 'files' }, h('li', {},
        h('div', { class: 'doc' }, 'PDF'),
        h('div', { class: 'name' }, file.name, h('div', { class: 'meta' }, size(file.size))),
        h('button', { class: 'btn small', onclick: reset }, 'Change')
      )));
      drop.hidden = true;
      picked.hidden = false;
      await onLoad(file, bytes);
    } catch (e) {
      console.error(e);
      toast('Could not open that PDF: ' + e.message);
      reset();
    }
  } });
  drop.append(zone);
  function reset() {
    drop.hidden = false;
    picked.hidden = true;
    onLoad(null);
  }
  root.append(drop, picked);
}

export function grayscale(c) {
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = p[i + 1] = p[i + 2] = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
  }
  ctx.putImageData(d, 0, 0);
}
