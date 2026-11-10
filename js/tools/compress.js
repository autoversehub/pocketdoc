import { h, singlePdf, field, select, toast, download, size, openPdf, renderPage, canvasBytes, baseName, progress, wait, grayscale } from '../util.js';

const levels = {
  low: { scale: 2, q: 0.8 },
  mid: { scale: 1.5, q: 0.65 },
  high: { scale: 1.1, q: 0.5 }
};

export default {
  id: 'compress',
  group: 'edit',
  icon: 'compress',
  title: 'Compress PDF',
  desc: 'Make big scanned PDFs much smaller so they are easy to send.',
  mount(root) {
    let bytesIn, name;
    const level = select([['low', 'Light, best quality'], ['mid', 'Normal'], ['high', 'Strong, smallest file']], 'mid');
    const gray = h('input', { type: 'checkbox' });
    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: run }, 'Compress');
    const status = h('span', { class: 'status' });

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Compression', level),
        h('label', { class: 'check' }, gray, 'Black and white')
      ),
      h('p', { class: 'hint' }, 'Pages are redrawn as images, so text will not be selectable after. Best for scans and photo heavy PDFs.'),
      h('div', { class: 'actions' }, go, status),
      bar.el
    );

    singlePdf(root, (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      bytesIn = bytes;
      name = baseName(file.name);
      status.textContent = 'Now ' + size(bytes.length);
      panel.hidden = false;
    });

    async function run() {
      go.disabled = true;
      try {
        const { scale, q } = levels[level.value];
        const doc = await openPdf(bytesIn);
        const out = await window.PDFLib.PDFDocument.create();

        for (let i = 1; i <= doc.numPages; i++) {
          bar.set((i - 1) / doc.numPages);
          await wait();
          const page = await doc.getPage(i);
          const v = page.getViewport({ scale: 1 });
          const c = await renderPage(doc, i, scale);
          if (gray.checked) grayscale(c);
          const img = await out.embedJpg(await canvasBytes(c, 'image/jpeg', q));
          out.addPage([v.width, v.height]).drawImage(img, { x: 0, y: 0, width: v.width, height: v.height });
          page.cleanup();
        }

        bar.set(1);
        const result = await out.save();
        const saved = 1 - result.length / bytesIn.length;
        if (saved <= 0.02) {
          toast('This file is already small, try a stronger level');
        } else {
          download(result, name + '-small.pdf');
          toast(size(bytesIn.length) + ' to ' + size(result.length) + ', ' + Math.round(saved * 100) + '% smaller');
        }
        status.textContent = 'Was ' + size(bytesIn.length) + ', now ' + size(result.length);
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      bar.done();
      go.disabled = false;
    }

    root.append(panel);
  }
};
