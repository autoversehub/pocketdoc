import { h, singlePdf, field, select, toast, download, loadPdfLib, parseRanges, baseName, progress, wait } from '../util.js';

export default {
  id: 'split',
  group: 'edit',
  icon: 'split',
  title: 'Split PDF',
  desc: 'Pull out the pages you need, or break a PDF into many files.',
  mount(root) {
    let src, name, count;

    const mode = select([
      ['pick', 'Pick pages into one new PDF'],
      ['ranges', 'Each range as its own file'],
      ['every', 'Every page as its own file']
    ], 'pick');
    const ranges = h('input', { type: 'text', placeholder: 'e.g. 1-3, 5, 8-' });
    const rangeField = field('Pages', ranges);
    const info = h('p', { class: 'hint' });
    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: run }, 'Split');

    mode.onchange = () => { rangeField.hidden = mode.value === 'every'; };

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' }, field('What to do', mode), rangeField),
      info,
      h('div', { class: 'actions' }, go),
      bar.el
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      src = await loadPdfLib(bytes);
      name = baseName(file.name);
      count = src.getPageCount();
      info.textContent = 'This file has ' + count + ' pages. Use commas and dashes, like 1-3, 5. "8-" means page 8 to the end.';
      panel.hidden = false;
    });

    async function part(indexes) {
      const out = await window.PDFLib.PDFDocument.create();
      const pages = await out.copyPages(src, indexes);
      pages.forEach(p => out.addPage(p));
      return out.save();
    }

    async function run() {
      go.disabled = true;
      try {
        let groups;
        if (mode.value === 'every') groups = src.getPageIndices().map(i => [i]);
        else groups = parseRanges(ranges.value, count);

        if (mode.value === 'pick') {
          download(await part(groups.flat()), name + '-pages.pdf');
        } else if (groups.length === 1) {
          download(await part(groups[0]), name + '-part.pdf');
        } else {
          const zip = new JSZip();
          for (let i = 0; i < groups.length; i++) {
            bar.set(i / groups.length);
            await wait();
            const g = groups[i];
            const label = g.length === 1 ? g[0] + 1 : (g[0] + 1) + '-' + (g[g.length - 1] + 1);
            zip.file(name + '-' + label + '.pdf', await part(g));
          }
          download(await zip.generateAsync({ type: 'blob' }), name + '-split.zip', 'application/zip');
        }
        toast('Done');
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
