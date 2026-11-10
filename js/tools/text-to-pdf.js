import { h, field, select, toast, download, size, canvasBytes, PAGE_SIZES } from '../util.js';

export default {
  id: 'text-to-pdf',
  group: 'make',
  icon: 'text',
  title: 'Text to PDF',
  desc: 'Paste or type text and save it as a clean PDF. Works with Arabic and Kurdish too.',
  mount(root) {
    const area = h('textarea', { placeholder: 'Type or paste your text here...' });
    const title = h('input', { type: 'text', placeholder: 'Optional title' });
    const fontSize = select([['10', '10'], ['12', '12'], ['14', '14'], ['16', '16'], ['18', '18']], '12');
    const pageSize = select([['a4', 'A4'], ['letter', 'US Letter'], ['a5', 'A5']], 'a4');
    const font = select([['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']], 'sans');

    const txtFile = h('input', { type: 'file', accept: '.txt,.md,.csv,text/plain', hidden: true, onchange: async () => {
      const f = txtFile.files[0];
      if (f) area.value = await f.text();
      txtFile.value = '';
    } });

    const go = h('button', { class: 'btn main', onclick: make }, 'Make PDF');

    async function make() {
      const text = area.value.replace(/\r/g, '');
      if (!text.trim()) return toast('Type some text first');
      go.disabled = true;
      try {
        const opts = { text, title: title.value.trim(), fs: +fontSize.value, page: PAGE_SIZES[pageSize.value], font: font.value };
        let bytes;
        try {
          bytes = await withPdfFont(opts);
        } catch {
          // built in pdf fonts only know latin letters, so draw other scripts as images
          bytes = await withCanvas(opts);
        }
        download(bytes, (opts.title || 'text') + '.pdf');
        toast('Done, ' + size(bytes.length));
      } catch (e) {
        console.error(e);
        toast(e.message || 'Something went wrong');
      }
      go.disabled = false;
    }

    root.append(h('div', { class: 'panel' },
      h('div', { class: 'row' },
        field('Title', title, 'wide'),
        field('Text', area, 'wide'),
        field('Font', font),
        field('Font size', fontSize),
        field('Page size', pageSize)
      ),
      h('div', { class: 'actions' }, go, h('button', { class: 'btn', onclick: () => txtFile.click() }, 'Open .txt file'), txtFile)
    ));
  }
};

function wrap(text, maxW, measure) {
  const lines = [];
  for (const para of text.split('\n')) {
    if (!para) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (measure(test) <= maxW || !line) {
        line = test;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
      // a single very long word, cut it by letters
      while (measure(line) > maxW && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > maxW) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

async function withPdfFont({ text, title, fs, page, font }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const names = { sans: ['Helvetica', 'HelveticaBold'], serif: ['TimesRoman', 'TimesRomanBold'], mono: ['Courier', 'CourierBold'] }[font];
  const f = await pdf.embedFont(StandardFonts[names[0]]);
  const fb = await pdf.embedFont(StandardFonts[names[1]]);

  // throws if a letter is not in the font
  f.encodeText(text + title);

  const [pw, ph] = page;
  const m = 56;
  const lh = fs * 1.45;
  const lines = wrap(text.replace(/\t/g, '    '), pw - m * 2, s => f.widthOfTextAtSize(s, fs));

  let p = pdf.addPage([pw, ph]);
  let y = ph - m;

  if (title) {
    const ts = fs + 8;
    for (const l of wrap(title, pw - m * 2, s => fb.widthOfTextAtSize(s, ts))) {
      p.drawText(l, { x: m, y: y - ts, size: ts, font: fb, color: rgb(0.1, 0.1, 0.1) });
      y -= ts * 1.3;
    }
    y -= fs;
  }

  for (const l of lines) {
    if (y - lh < m) {
      p = pdf.addPage([pw, ph]);
      y = ph - m;
    }
    if (l) p.drawText(l, { x: m, y: y - fs, size: fs, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= lh;
  }

  pdf.setTitle(title || 'Text');
  return pdf.save();
}

async function withCanvas({ text, title, fs, page, font }) {
  const { PDFDocument } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const [pw, ph] = page;
  const k = 2.5; // pixels per point, keeps text sharp
  const W = Math.round(pw * k), H = Math.round(ph * k);
  const m = 56 * k;
  const family = { sans: 'system-ui, Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, Menlo, monospace' }[font];
  const rtl = /[֐-ࣿ]/.test(text + title);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.textBaseline = 'top';
  const x = rtl ? W - m : m;

  const blank = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1a1a';
  };

  const pages = [];
  const flush = async () => pages.push(await canvasBytes(c, 'image/png'));

  blank();
  let y = m;
  const lh = fs * k * 1.6;

  if (title) {
    ctx.font = `bold ${(fs + 8) * k}px ${family}`;
    for (const l of wrap(title, W - m * 2, s => ctx.measureText(s).width)) {
      ctx.fillText(l, x, y);
      y += (fs + 8) * k * 1.35;
    }
    y += fs * k;
  }

  ctx.font = `${fs * k}px ${family}`;
  for (const l of wrap(text, W - m * 2, s => ctx.measureText(s).width)) {
    if (y + lh > H - m) {
      await flush();
      blank();
      ctx.font = `${fs * k}px ${family}`;
      y = m;
    }
    ctx.fillText(l, x, y);
    y += lh;
  }
  await flush();

  for (const png of pages) {
    const img = await pdf.embedPng(png);
    pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  }
  pdf.setTitle(title || 'Text');
  return pdf.save();
}
