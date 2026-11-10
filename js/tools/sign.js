import { h, singlePdf, field, select, toast, download, loadPdfLib, openPdf, renderPage, baseName, canvasBytes } from '../util.js';

export default {
  id: 'sign',
  group: 'edit',
  icon: 'pen',
  title: 'Sign PDF',
  desc: 'Draw or type your signature and place it on any page.',
  mount(root) {
    let bytesIn, name, doc, sig = null;
    let pageNum = 1;
    const placed = []; // { page, x, y, w } as parts of the page size
    let active = null;

    // signature maker
    const pad = h('canvas', { class: 'sign-pad' });
    const typed = h('input', { type: 'text', placeholder: 'Type your name' });
    const fontPick = select([
      ['"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive', 'Script'],
      ['Georgia, "Times New Roman", serif', 'Classic'],
      ['system-ui, Arial, sans-serif', 'Plain']
    ], '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive');
    const ink = select([['#111111', 'Black'], ['#1b3d8f', 'Blue']], '#111111');
    const drawBox = h('div', {}, pad, h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: clearPad }, 'Clear')));
    const typeBox = h('div', { hidden: true }, h('div', { class: 'row' }, field('Name', typed), field('Style', fontPick)));
    const tabDraw = h('button', { class: 'btn small on', onclick: () => tab('draw') }, 'Draw');
    const tabType = h('button', { class: 'btn small', onclick: () => tab('type') }, 'Type');
    let mode = 'draw';

    function tab(m) {
      mode = m;
      tabDraw.classList.toggle('on', m === 'draw');
      tabType.classList.toggle('on', m === 'type');
      drawBox.hidden = m !== 'draw';
      typeBox.hidden = m !== 'type';
      if (m === 'draw') setupPad();
    }

    let ctx, drawing = false, hasInk = false;
    function setupPad() {
      const r = pad.getBoundingClientRect();
      if (!r.width) return;
      const k = window.devicePixelRatio || 1;
      pad.width = r.width * k;
      pad.height = r.height * k;
      ctx = pad.getContext('2d');
      ctx.scale(k, k);
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = 2.6;
      hasInk = false;
    }
    function clearPad() { setupPad(); }

    const point = e => {
      const r = pad.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    pad.addEventListener('pointerdown', e => {
      if (!ctx) setupPad();
      drawing = true;
      pad.setPointerCapture(e.pointerId);
      ctx.strokeStyle = ink.value;
      ctx.beginPath();
      ctx.moveTo(...point(e));
    });
    pad.addEventListener('pointermove', e => {
      if (!drawing) return;
      ctx.lineTo(...point(e));
      ctx.stroke();
      hasInk = true;
    });
    const stop = () => { drawing = false; };
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);

    // turn the signature into a cropped png
    async function makeSig() {
      let c;
      if (mode === 'draw') {
        if (!hasInk) throw new Error('Draw your signature first');
        c = crop(pad);
      } else {
        const t = typed.value.trim();
        if (!t) throw new Error('Type your name first');
        c = document.createElement('canvas');
        const x = c.getContext('2d');
        const font = '120px ' + fontPick.value;
        x.font = font;
        c.width = Math.ceil(x.measureText(t).width) + 40;
        c.height = 180;
        x.font = font;
        x.fillStyle = ink.value;
        x.textBaseline = 'middle';
        x.fillText(t, 20, 95);
        c = crop(c);
      }
      return { url: c.toDataURL('image/png'), bytes: await canvasBytes(c, 'image/png'), ratio: c.height / c.width };
    }

    // page preview and placing
    const pagePick = select([], '1');
    const sizeSlider = h('input', { type: 'range', min: '8', max: '70', value: '28' });
    const wrap = h('div', { class: 'place-wrap' });
    const go = h('button', { class: 'btn main', onclick: save }, 'Save signed PDF');

    pagePick.onchange = () => { pageNum = +pagePick.value; showPage(); };
    sizeSlider.oninput = () => {
      if (!active) return;
      active.w = +sizeSlider.value / 100;
      drawPlaced();
    };

    async function place() {
      try {
        sig = await makeSig();
      } catch (e) {
        return toast(e.message);
      }
      const w = +sizeSlider.value / 100;
      active = { page: pageNum, x: 0.5 - w / 2, y: 0.75, w, sig };
      placed.push(active);
      drawPlaced();
      toast('Drag it where you want it');
    }

    async function showPage() {
      const c = await renderPage(doc, pageNum, 1.5);
      c.style.width = Math.min(c.width / 1.5, 720) + 'px';
      wrap.replaceChildren(c);
      drawPlaced();
    }

    function drawPlaced() {
      wrap.querySelectorAll('.sig').forEach(n => n.remove());
      const canvas = wrap.querySelector('canvas');
      if (!canvas) return;
      const pageRatio = canvas.height / canvas.width;
      for (const p of placed.filter(p => p.page === pageNum)) {
        const box = h('div', { class: 'sig' },
          h('img', { src: p.sig.url, alt: 'signature' }),
          h('button', { class: 'x', title: 'Remove', onpointerdown: e => e.stopPropagation(), onclick: () => remove(p) }, '×')
        );
        box.style.left = p.x * 100 + '%';
        box.style.top = p.y * 100 + '%';
        box.style.width = p.w * 100 + '%';
        box.style.height = (p.w * p.sig.ratio / pageRatio) * 100 + '%';
        box.style.borderStyle = p === active ? 'dashed' : 'dotted';
        box.addEventListener('pointerdown', e => drag(e, p, box));
        wrap.append(box);
      }
    }

    function remove(p) {
      placed.splice(placed.indexOf(p), 1);
      if (active === p) active = null;
      drawPlaced();
    }

    function drag(e, p, box) {
      e.preventDefault();
      active = p;
      sizeSlider.value = Math.round(p.w * 100);
      const r = wrap.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y;
      box.setPointerCapture(e.pointerId);
      const moveTo = ev => {
        // keep it on the page
        const hh = box.offsetHeight / r.height;
        p.x = Math.min(Math.max(ox + (ev.clientX - sx) / r.width, 0), 1 - p.w);
        p.y = Math.min(Math.max(oy + (ev.clientY - sy) / r.height, 0), 1 - hh);
        box.style.left = p.x * 100 + '%';
        box.style.top = p.y * 100 + '%';
      };
      const end = () => {
        box.removeEventListener('pointermove', moveTo);
        box.removeEventListener('pointerup', end);
        drawPlaced();
      };
      box.addEventListener('pointermove', moveTo);
      box.addEventListener('pointerup', end);
    }

    async function save() {
      if (!placed.length) return toast('Place your signature first');
      go.disabled = true;
      try {
        const pdf = await loadPdfLib(bytesIn);
        const pages = pdf.getPages();
        const cache = new Map();
        for (const p of placed) {
          if (!cache.has(p.sig)) cache.set(p.sig, await pdf.embedPng(p.sig.bytes));
          const page = pages[p.page - 1];
          const b = page.getCropBox();
          const w = p.w * b.width;
          const hh = w * p.sig.ratio;
          page.drawImage(cache.get(p.sig), {
            x: b.x + p.x * b.width,
            y: b.y + b.height - p.y * b.height - hh,
            width: w,
            height: hh
          });
        }
        download(await pdf.save(), name + '-signed.pdf');
        toast('Signed');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      go.disabled = false;
    }

    const signPanel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'tabs' }, tabDraw, tabType),
      drawBox, typeBox,
      h('div', { class: 'row', style: 'margin-top:14px' }, field('Ink', ink))
    );

    const placePanel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Page', pagePick),
        field('Signature size', sizeSlider)
      ),
      h('div', { class: 'actions', style: 'margin-bottom:14px' },
        h('button', { class: 'btn', onclick: place }, 'Put signature on this page')
      ),
      wrap,
      h('p', { class: 'hint' }, 'Drag to move it. Tap the × to remove it. You can put more than one.'),
      h('div', { class: 'actions' }, go)
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) {
        signPanel.hidden = placePanel.hidden = true;
        return;
      }
      bytesIn = bytes;
      name = baseName(file.name);
      doc = await openPdf(bytes);
      placed.length = 0;
      active = null;
      pageNum = 1;
      pagePick.replaceChildren(...Array.from({ length: doc.numPages }, (_, i) => h('option', { value: i + 1 }, 'Page ' + (i + 1))));
      signPanel.hidden = placePanel.hidden = false;
      setupPad();
      await showPage();
    });

    root.append(signPanel, placePanel);
  }
};

// cut empty space around the ink
function crop(src) {
  const ctx = src.getContext('2d');
  const { width: w, height: hh } = src;
  const d = ctx.getImageData(0, 0, w, hh).data;
  let x1 = w, y1 = hh, x2 = 0, y2 = 0;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < x1) return src;
  const pad = 6;
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(w - 1, x2 + pad); y2 = Math.min(hh - 1, y2 + pad);
  const out = document.createElement('canvas');
  out.width = x2 - x1 + 1;
  out.height = y2 - y1 + 1;
  out.getContext('2d').drawImage(src, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
