import { h, singlePdf, toast, download, loadPdfLib, openPdf, thumb, baseName, wait } from '../util.js';

export default {
  id: 'organize',
  group: 'edit',
  icon: 'pages',
  title: 'Organize pages',
  desc: 'Rotate, delete and reorder pages. See every page before you save.',
  mount(root) {
    let src, name, pages = [];
    const grid = h('div', { class: 'pages' });
    const go = h('button', { class: 'btn main', onclick: save }, 'Save PDF');

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'actions', style: 'margin:0 0 14px' },
        h('button', { class: 'btn small', onclick: () => { pages.forEach(p => p.rot = (p.rot + 90) % 360); draw(); } }, 'Rotate all'),
        h('button', { class: 'btn small', onclick: () => { pages.reverse(); draw(); } }, 'Reverse order'),
        h('button', { class: 'btn small', onclick: () => { pages.forEach(p => p.gone = false); draw(); } }, 'Bring back all')
      ),
      grid,
      h('div', { class: 'actions' }, go)
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      src = await loadPdfLib(bytes);
      name = baseName(file.name);
      const doc = await openPdf(bytes);
      pages = [];
      for (let i = 0; i < doc.numPages; i++) pages.push({ i, rot: 0, gone: false, canvas: null });
      panel.hidden = false;
      draw();
      // draw thumbs one by one so the page stays usable
      for (const p of pages) {
        p.canvas = await thumb(doc, p.i + 1, 150);
        draw();
        await wait();
      }
    });

    function move(k, d) {
      const j = k + d;
      if (j < 0 || j >= pages.length) return;
      [pages[k], pages[j]] = [pages[j], pages[k]];
      draw();
    }

    function draw() {
      grid.replaceChildren(...pages.map((p, k) => {
        const view = p.canvas || h('span', { class: 'num' }, '...');
        // sideways pages get a bit smaller so they fit the box
        if (p.canvas) p.canvas.style.transform = 'rotate(' + p.rot + 'deg)' + (p.rot % 180 ? ' scale(.75)' : '');
        return h('div', { class: 'page' + (p.gone ? ' gone' : '') },
          h('div', { class: 'thumb' }, view),
          h('div', { class: 'num' }, 'Page ' + (p.i + 1)),
          h('div', { class: 'btns' },
            h('button', { class: 'btn icon small', title: 'Move left', onclick: () => move(k, -1) }, '←'),
            h('button', { class: 'btn icon small', title: 'Rotate', onclick: () => { p.rot = (p.rot + 90) % 360; draw(); } }, '↻'),
            h('button', { class: 'btn icon small' + (p.gone ? '' : ' danger'), title: p.gone ? 'Keep' : 'Delete', onclick: () => { p.gone = !p.gone; draw(); } }, p.gone ? '+' : '×'),
            h('button', { class: 'btn icon small', title: 'Move right', onclick: () => move(k, 1) }, '→')
          )
        );
      }));
    }

    async function save() {
      const keep = pages.filter(p => !p.gone);
      if (!keep.length) return toast('Keep at least one page');
      go.disabled = true;
      try {
        const { PDFDocument, degrees } = window.PDFLib;
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, keep.map(p => p.i));
        copied.forEach((pg, k) => {
          pg.setRotation(degrees((pg.getRotation().angle + keep[k].rot) % 360));
          out.addPage(pg);
        });
        download(await out.save(), name + '-edited.pdf');
        toast('Saved ' + keep.length + ' pages');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      go.disabled = false;
    }

    root.append(panel);
  }
};
