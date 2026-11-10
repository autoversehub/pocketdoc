import { h, dropZone, field, select, toast, download, openPdf, renderPage, imageToCanvas, baseName, progress } from '../util.js';

// tesseract is only loaded when someone uses this tool
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = TESS;
    s.onload = () => ok(window.Tesseract);
    s.onerror = () => bad(new Error('Could not load the text reader, check your internet'));
    document.head.append(s);
  });
}

export default {
  id: 'ocr',
  group: 'convert',
  icon: 'scan',
  title: 'Image to text (OCR)',
  desc: 'Read the text from photos, screenshots and scanned PDFs.',
  mount(root) {
    let file;
    const lang = select([
      ['eng', 'English'],
      ['ara', 'Arabic'],
      ['eng+ara', 'English and Arabic'],
      ['kmr', 'Kurdish (Kurmanji, Latin letters)'],
      ['fas', 'Persian'],
      ['tur', 'Turkish'],
      ['fra', 'French'],
      ['deu', 'German'],
      ['spa', 'Spanish']
    ], 'eng');
    const out = h('textarea', { class: 'out', placeholder: 'Text shows up here' });
    const bar = progress();
    const status = h('span', { class: 'status' });
    const name = h('div', { class: 'status' });
    const go = h('button', { class: 'btn main', onclick: run }, 'Read text');

    const panel = h('div', { class: 'panel', hidden: true },
      name,
      h('div', { class: 'row', style: 'margin-top:10px' }, field('Language', lang)),
      h('p', { class: 'hint' }, 'The first run downloads the language data (a few MB), then it runs on your device. Sorani Kurdish is not supported by the reader yet.'),
      h('div', { class: 'actions' }, go, status),
      bar.el
    );

    const result = h('div', { class: 'panel', hidden: true },
      out,
      h('div', { class: 'actions' },
        h('button', { class: 'btn main', onclick: () => navigator.clipboard.writeText(out.value).then(() => toast('Copied')) }, 'Copy'),
        h('button', { class: 'btn', onclick: () => download(out.value, baseName(file.name) + '.txt', 'text/plain') }, 'Save .txt')
      )
    );

    async function pages() {
      // pdfs get turned into page images first
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
        const list = [];
        for (let i = 1; i <= doc.numPages; i++) list.push(() => renderPage(doc, i, 2.2));
        return list;
      }
      return [() => imageToCanvas(file, 3000)];
    }

    async function run() {
      go.disabled = true;
      out.value = '';
      let worker;
      try {
        status.textContent = 'Loading reader...';
        const T = await loadTesseract();
        const list = await pages();
        let page = 0;
        worker = await T.createWorker(lang.value, 1, {
          logger: m => {
            if (m.status === 'recognizing text') bar.set((page + m.progress) / list.length);
            else if (m.status) status.textContent = cap(m.status) + '...';
          }
        });
        if (lang.value.includes('ara') || lang.value === 'fas') {
          out.dir = 'rtl';
        } else {
          out.dir = 'ltr';
        }
        const parts = [];
        for (; page < list.length; page++) {
          status.textContent = 'Reading page ' + (page + 1) + ' of ' + list.length;
          const c = await list[page]();
          const { data } = await worker.recognize(c);
          parts.push(data.text.trim());
          out.value = parts.join('\n\n');
          result.hidden = false;
        }
        status.textContent = out.value ? 'Done' : 'No text found';
      } catch (e) {
        console.error(e);
        status.textContent = '';
        toast(e.message || 'Could not read the text');
      }
      if (worker) worker.terminate();
      bar.done();
      go.disabled = false;
    }

    root.append(
      h('div', { class: 'panel' },
        dropZone({ accept: 'image/*,application/pdf,.pdf', camera: true, title: 'Add a photo, screenshot or PDF', onFiles: ([f]) => {
          file = f;
          name.textContent = f.name;
          panel.hidden = false;
          result.hidden = true;
        } })
      ),
      panel,
      result
    );
  }
};

const cap = s => s[0].toUpperCase() + s.slice(1);
