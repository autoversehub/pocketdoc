import { h } from './util.js';

import imagesToPdf from './tools/images-to-pdf.js';
import textToPdf from './tools/text-to-pdf.js';
import merge from './tools/merge.js';
import split from './tools/split.js';
import organize from './tools/organize.js';
import compress from './tools/compress.js';
import numbers from './tools/page-numbers.js';
import watermark from './tools/watermark.js';
import sign from './tools/sign.js';
import info from './tools/metadata.js';
import pdfToImages from './tools/pdf-to-images.js';
import pdfToText from './tools/pdf-to-text.js';
import ocr from './tools/ocr.js';
import images from './tools/image-convert.js';

const tools = [
  imagesToPdf, textToPdf,
  merge, split, organize, compress, numbers, watermark, sign, info,
  pdfToImages, pdfToText, ocr, images
];

const groups = [
  ['make', 'Make a PDF'],
  ['edit', 'Edit a PDF'],
  ['convert', 'Convert and extract']
];

// simple line icons, 22px
const icons = {
  image: '<rect x="3" y="4" width="16" height="14" rx="2"/><circle cx="8" cy="9" r="1.6"/><path d="M4 16l5-5 4 4 2-2 3 3"/>',
  text: '<path d="M5 4h12M11 4v14M8 18h6"/>',
  merge: '<path d="M6 4v5a3 3 0 0 0 3 3h4a3 3 0 0 1 3 3v3M16 4v5a3 3 0 0 1-3 3"/><path d="M13 15l3 3 3-3"/>',
  split: '<path d="M11 4v6M11 10l-5 5v3M11 10l5 5v3"/>',
  pages: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="12" y="3" width="7" height="9" rx="1"/><path d="M3 16h16M3 19h10"/>',
  compress: '<path d="M7 3l4 4 4-4M7 19l4-4 4 4M4 11h14"/>',
  hash: '<path d="M8 3L6 19M16 3l-2 16M3 8h16M3 14h16"/>',
  stamp: '<path d="M8 3h6l-1 7h-4zM4 14h14v3H4zM6 20h10"/>',
  pen: '<path d="M14 4l4 4L8 18H4v-4z"/><path d="M3 21h16"/>',
  info: '<circle cx="11" cy="11" r="8"/><path d="M11 10v5M11 7v.5"/>',
  photo: '<rect x="3" y="3" width="16" height="16" rx="2"/><path d="M3 15l4-4 4 4 3-3 5 5"/>',
  file: '<path d="M6 3h7l4 4v12H6z"/><path d="M13 3v4h4M9 12h5M9 15h5"/>',
  scan: '<path d="M4 8V4h4M14 4h4v4M18 14v4h-4M8 18H4v-4M7 11h8"/>',
  swap: '<path d="M5 8h12l-3-3M17 14H5l3 3"/>'
};

export function icon(name) {
  return '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
}

const app = document.getElementById('app');

function home() {
  document.title = 'PocketDoc - free PDF and document tools';
  app.replaceChildren(
    h('section', { class: 'intro' },
      h('h1', {}, 'Free PDF and document tools that work right on your phone.'),
      h('p', {}, 'No uploads, no sign up, no watermarks on your files. Everything runs inside this page, so your documents never leave your device.')
    ),
    ...groups.map(([g, title]) => h('section', {},
      h('h2', { class: 'group-title' }, title),
      h('div', { class: 'grid' }, ...tools.filter(t => t.group === g).map(t =>
        h('a', { class: 'tool-card', href: '#/' + t.id },
          h('div', { class: 'ico', html: icon(t.icon) }),
          h('div', {}, h('h3', {}, t.title), h('p', {}, t.desc))
        )
      ))
    ))
  );
}

function open(tool) {
  document.title = tool.title + ' - PocketDoc';
  const body = h('div');
  app.replaceChildren(
    h('a', { class: 'back', href: '#/' }, '← All tools'),
    h('div', { class: 'tool-head' }, h('h1', {}, tool.title), h('p', {}, tool.desc)),
    body
  );
  tool.mount(body);
}

function route() {
  const id = location.hash.replace(/^#\/?/, '');
  const tool = tools.find(t => t.id === id);
  if (tool) open(tool);
  else home();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

// cache the app so it works offline after the first visit
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
