import { h, singlePdf, toast, download, openPdf, baseName, progress, wait } from '../util.js';

export default {
  id: 'pdf-to-text',
  group: 'convert',
  icon: 'file',
  title: 'PDF to text',
  desc: 'Copy all the text out of a PDF. For scans, use Image to text.',
  mount(root) {
    let name;
    const out = h('textarea', { class: 'out', readOnly: true });
    const bar = progress();
    const status = h('span', { class: 'status' });

    const panel = h('div', { class: 'panel', hidden: true },
      bar.el,
      out,
      h('div', { class: 'actions' },
        h('button', { class: 'btn main', onclick: () => { navigator.clipboard.writeText(out.value).then(() => toast('Copied')); } }, 'Copy'),
        h('button', { class: 'btn', onclick: () => download(out.value, name + '.txt', 'text/plain') }, 'Save .txt'),
        status
      )
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      name = baseName(file.name);
      panel.hidden = false;
      out.value = '';
      const doc = await openPdf(bytes);
      const parts = [];
      for (let i = 1; i <= doc.numPages; i++) {
        bar.set(i / doc.numPages);
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        // put line breaks back where pdf.js says a line ended
        parts.push(tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join(''));
        await wait();
      }
      bar.done();
      out.value = parts.join('\n\n').trim();
      if (!out.value) {
        status.textContent = 'No text found. This is probably a scan, try Image to text.';
      } else {
        status.textContent = out.value.length.toLocaleString() + ' characters from ' + doc.numPages + ' pages';
      }
    });

    root.append(panel);
  }
};
