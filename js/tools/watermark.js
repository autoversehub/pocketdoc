import { h, singlePdf, field, select, toast, download, loadPdfLib, baseName, canvasBytes } from '../util.js';

export default {
  id: 'watermark',
  group: 'edit',
  icon: 'stamp',
  title: 'Add watermark',
  desc: 'Stamp text like CONFIDENTIAL or your name across every page.',
  mount(root) {
    let bytesIn, name;
    const text = h('input', { type: 'text', value: 'CONFIDENTIAL' });
    const style = select([['diag', 'Big, across the page'], ['center', 'Center, flat'], ['tile', 'Repeated pattern']], 'diag');
    const color = h('input', { type: 'color', value: '#a33a2c' });
    const opacity = h('input', { type: 'range', min: '5', max: '80', value: '20' });
    const bold = h('input', { type: 'checkbox', checked: true });
    const go = h('button', { class: 'btn main', onclick: run }, 'Add watermark');

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Text', text, 'wide'),
        field('Style', style),
        field('Color', color),
        field('See through', opacity)
      ),
      h('label', { class: 'check', style: 'margin-top:14px' }, bold, 'Bold'),
      h('div', { class: 'actions' }, go)
    );

    singlePdf(root, (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      bytesIn = bytes;
      name = baseName(file.name);
      panel.hidden = false;
    });

    async function run() {
      const t = text.value.trim();
      if (!t) return toast('Type the watermark text');
      go.disabled = true;
      try {
        const { degrees } = window.PDFLib;
        const pdf = await loadPdfLib(bytesIn);
        // draw the text as an image so any language and font works
        const stamp = await textImage(t, color.value, bold.checked);
        const img = await pdf.embedPng(stamp.bytes);
        const ratio = stamp.h / stamp.w;
        const alpha = +opacity.value / 100;

        for (const p of pdf.getPages()) {
          const box = p.getCropBox();
          const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

          if (style.value === 'tile') {
            const w = box.width / 3.2, hh = w * ratio;
            for (let y = box.y + 20; y < box.y + box.height; y += hh * 4) {
              for (let x = box.x + 10; x < box.x + box.width; x += w * 1.4) {
                p.drawImage(img, { x, y, width: w, height: hh, opacity: alpha, rotate: degrees(30) });
              }
            }
          } else {
            const angle = style.value === 'diag' ? Math.atan2(box.height, box.width) : 0;
            const w = style.value === 'diag' ? Math.hypot(box.width, box.height) * 0.7 : box.width * 0.6;
            const hh = w * ratio;
            // move the start point so the image ends up centered after turning
            const x = cx - (w / 2) * Math.cos(angle) + (hh / 2) * Math.sin(angle);
            const y = cy - (w / 2) * Math.sin(angle) - (hh / 2) * Math.cos(angle);
            p.drawImage(img, { x, y, width: w, height: hh, opacity: alpha, rotate: degrees(angle * 180 / Math.PI) });
          }
        }

        download(await pdf.save(), name + '-watermark.pdf');
        toast('Watermark added');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      go.disabled = false;
    }

    root.append(panel);
  }
};

async function textImage(text, color, bold) {
  const fs = 160;
  const font = (bold ? 'bold ' : '') + fs + 'px system-ui, Arial, sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  const hh = Math.ceil(fs * 1.3);
  c.width = w;
  c.height = hh;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, hh / 2);
  return { bytes: await canvasBytes(c, 'image/png'), w, h: hh };
}
