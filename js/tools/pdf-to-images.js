import { h, singlePdf, field, select, toast, download, openPdf, renderPage, canvasBlob, baseName, parseRanges, progress, wait } from '../util.js';

export default {
  id: 'pdf-to-images',
  group: 'convert',
  icon: 'photo',
  title: 'PDF to images',
  desc: 'Save each page as a JPG or PNG picture.',
  mount(root) {
    let doc, name;
    const format = select([['jpg', 'JPG'], ['png', 'PNG']], 'jpg');
    const quality = select([['1', 'Normal'], ['2', 'Sharp'], ['3', 'Very sharp']], '2');
    const which = h('input', { type: 'text', placeholder: 'All pages' });
    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: run }, 'Convert');

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Format', format),
        field('Sharpness', quality),
        field('Pages (optional)', which)
      ),
      h('p', { class: 'hint' }, 'More than one page comes as a zip file.'),
      h('div', { class: 'actions' }, go),
      bar.el
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      doc = await openPdf(bytes);
      name = baseName(file.name);
      panel.hidden = false;
    });

    async function run() {
      go.disabled = true;
      try {
        const nums = which.value.trim() ? parseRanges(which.value, doc.numPages).flat().map(i => i + 1) : Array.from({ length: doc.numPages }, (_, i) => i + 1);
        const type = format.value === 'png' ? 'image/png' : 'image/jpeg';
        const ext = format.value;
        const scale = +quality.value * 1.4;

        if (nums.length === 1) {
          const c = await renderPage(doc, nums[0], scale);
          download(await canvasBlob(c, type, 0.92), name + '-' + nums[0] + '.' + ext, type);
        } else {
          const zip = new JSZip();
          for (let k = 0; k < nums.length; k++) {
            bar.set(k / nums.length);
            await wait();
            const c = await renderPage(doc, nums[k], scale);
            zip.file(name + '-' + nums[k] + '.' + ext, await canvasBlob(c, type, 0.92));
          }
          bar.set(1);
          download(await zip.generateAsync({ type: 'blob' }), name + '-images.zip', 'application/zip');
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
