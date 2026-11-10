import { h, singlePdf, field, select, toast, download, loadPdfLib, baseName } from '../util.js';

export default {
  id: 'page-numbers',
  group: 'edit',
  icon: 'hash',
  title: 'Add page numbers',
  desc: 'Put page numbers on every page, where you want them.',
  mount(root) {
    let bytesIn, name;
    const pos = select([
      ['bc', 'Bottom center'], ['br', 'Bottom right'], ['bl', 'Bottom left'],
      ['tc', 'Top center'], ['tr', 'Top right'], ['tl', 'Top left']
    ], 'bc');
    const format = select([['n', '1'], ['page', 'Page 1'], ['of', 'Page 1 of 9'], ['slash', '1 / 9']], 'n');
    const start = h('input', { type: 'number', value: '1', min: '0' });
    const fs = select([['9', 'Small'], ['11', 'Normal'], ['14', 'Big']], '11');
    const skip = h('input', { type: 'checkbox' });
    const go = h('button', { class: 'btn main', onclick: run }, 'Add numbers');

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Position', pos),
        field('Style', format),
        field('First number', start),
        field('Size', fs)
      ),
      h('label', { class: 'check', style: 'margin-top:14px' }, skip, 'Skip the first page (cover)'),
      h('div', { class: 'actions' }, go)
    );

    singlePdf(root, (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      bytesIn = bytes;
      name = baseName(file.name);
      panel.hidden = false;
    });

    async function run() {
      go.disabled = true;
      try {
        const { StandardFonts, rgb } = window.PDFLib;
        const pdf = await loadPdfLib(bytesIn);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const size = +fs.value;
        const pages = pdf.getPages();
        const first = skip.checked ? 1 : 0;
        const total = pages.length - first;
        let n = parseInt(start.value, 10) || 1;
        const last = n + total - 1;

        for (let i = first; i < pages.length; i++, n++) {
          const label = { n: '' + n, page: 'Page ' + n, of: 'Page ' + n + ' of ' + last, slash: n + ' / ' + last }[format.value];
          const p = pages[i];
          const box = p.getCropBox();
          const w = font.widthOfTextAtSize(label, size);
          const m = 28;
          const v = pos.value;
          const x = box.x + (v[1] === 'c' ? (box.width - w) / 2 : v[1] === 'r' ? box.width - m - w : m);
          const y = box.y + (v[0] === 'b' ? m - size / 2 : box.height - m - size / 2);
          p.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
        }

        download(await pdf.save(), name + '-numbered.pdf');
        toast('Numbers added');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      go.disabled = false;
    }

    root.append(panel);
  }
};
