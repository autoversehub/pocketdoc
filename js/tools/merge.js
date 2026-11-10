import { h, dropZone, fileList, toast, download, size, loadPdfLib, progress, wait } from '../util.js';

export default {
  id: 'merge',
  group: 'edit',
  icon: 'merge',
  title: 'Merge PDFs',
  desc: 'Join several PDFs into one file, in the order you want.',
  mount(root) {
    const items = [];
    const list = fileList(items, update, f => [
      h('div', { class: 'doc' }, 'PDF'),
      h('div', { class: 'name' }, f.name, h('div', { class: 'meta' }, size(f.size)))
    ]);

    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: run }, 'Merge');
    const status = h('span', { class: 'status' });
    const panel = h('div', { class: 'panel', hidden: true }, list.el, h('div', { class: 'actions' }, go, status), bar.el);

    function update() {
      panel.hidden = !items.length;
      go.disabled = items.length < 2;
      status.textContent = items.length < 2 ? 'Add at least 2 files' : items.length + ' files';
    }

    async function run() {
      go.disabled = true;
      try {
        const { PDFDocument } = window.PDFLib;
        const out = await PDFDocument.create();
        for (let i = 0; i < items.length; i++) {
          bar.set(i / items.length);
          await wait();
          const src = await loadPdfLib(await items[i].arrayBuffer());
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(p => out.addPage(p));
        }
        bar.set(1);
        const bytes = await out.save();
        download(bytes, 'merged.pdf');
        toast('Merged ' + out.getPageCount() + ' pages');
      } catch (e) {
        console.error(e);
        toast('Could not merge: ' + e.message);
      }
      bar.done();
      go.disabled = false;
    }

    root.append(
      h('div', { class: 'panel' }, dropZone({ accept: 'application/pdf,.pdf', multiple: true, title: 'Add PDF files', onFiles: fs => { items.push(...fs); list.draw(); update(); } })),
      panel
    );
  }
};
