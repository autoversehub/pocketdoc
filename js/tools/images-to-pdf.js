import { h, dropZone, fileList, field, select, toast, download, size, imageToCanvas, canvasBytes, progress, wait, PAGE_SIZES } from '../util.js';

export default {
  id: 'images-to-pdf',
  group: 'make',
  icon: 'image',
  title: 'Images to PDF',
  desc: 'Turn photos and screenshots into one PDF. Take photos to scan paper documents.',
  mount(root) {
    const items = [];

    const list = fileList(items, update, it => [
      h('img', { src: it.url, alt: '' }),
      h('div', { class: 'name' }, it.file.name, h('div', { class: 'meta' }, size(it.file.size)))
    ]);

    const add = files => {
      for (const f of files) items.push({ file: f, url: URL.createObjectURL(f) });
      list.draw();
      update();
    };

    const pageSize = select([['fit', 'Same as image'], ['a4', 'A4'], ['letter', 'US Letter'], ['legal', 'US Legal'], ['a5', 'A5']], 'a4');
    const orient = select([['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], 'auto');
    const margin = select([['0', 'None'], ['20', 'Small'], ['40', 'Big']], '20');
    const look = select([['color', 'Color'], ['gray', 'Grayscale'], ['scan', 'Scanned paper (black and white)']], 'color');
    const quality = select([['0.92', 'High'], ['0.8', 'Medium'], ['0.65', 'Small file']], '0.8');

    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: make }, 'Make PDF');
    const status = h('span', { class: 'status' });

    const listPanel = h('div', { class: 'panel', hidden: true },
      list.el,
      h('div', { class: 'row', style: 'margin-top:16px' },
        field('Page size', pageSize),
        field('Orientation', orient),
        field('Margin', margin),
        field('Look', look),
        field('Quality', quality)
      ),
      h('div', { class: 'actions' }, go, status),
      bar.el
    );

    function update() {
      listPanel.hidden = !items.length;
      status.textContent = items.length + (items.length === 1 ? ' image' : ' images');
    }

    async function make() {
      go.disabled = true;
      try {
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        const m = +margin.value;

        for (let i = 0; i < items.length; i++) {
          bar.set(i / items.length);
          await wait();
          // big photos make huge pdfs, 2400px is still sharp when printed
          const c = await imageToCanvas(items[i].file, 2400);
          applyLook(c, look.value);
          const img = await pdf.embedJpg(await canvasBytes(c, 'image/jpeg', +quality.value));

          let pw, ph;
          if (pageSize.value === 'fit') {
            // page follows the image shape, longest side about A4 height
            const s = Math.min(1, 842 / Math.max(c.width, c.height));
            pw = c.width * s + m * 2;
            ph = c.height * s + m * 2;
          } else {
            [pw, ph] = PAGE_SIZES[pageSize.value];
            const wide = c.width > c.height;
            if (orient.value === 'landscape' || (orient.value === 'auto' && wide)) [pw, ph] = [ph, pw];
          }

          const page = pdf.addPage([pw, ph]);
          const boxW = pw - m * 2, boxH = ph - m * 2;
          const s = Math.min(boxW / c.width, boxH / c.height);
          const w = c.width * s, hh = c.height * s;
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - hh) / 2, width: w, height: hh });
        }

        bar.set(1);
        const bytes = await pdf.save();
        download(bytes, 'images.pdf');
        toast('Done, ' + size(bytes.length));
      } catch (e) {
        console.error(e);
        toast(e.message || 'Something went wrong');
      }
      bar.done();
      go.disabled = false;
    }

    root.append(
      h('div', { class: 'panel' },
        dropZone({ accept: 'image/*', multiple: true, camera: true, title: 'Add your images', note: 'JPG, PNG, WebP and more. You can add more later.', onFiles: add })
      ),
      listPanel
    );
  }
};

// grayscale or a strong black and white "scanner" look
function applyLook(c, look) {
  if (look === 'color') return;
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
    if (look === 'scan') {
      // push light grays to white and dark to black, keeps text clean
      g = (g - 70) * (255 / 120);
      g = g < 0 ? 0 : g > 255 ? 255 : g;
    }
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
}
