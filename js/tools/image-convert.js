import { h, dropZone, fileList, field, select, toast, download, size, imageToCanvas, canvasBlob, baseName, progress, wait } from '../util.js';

export default {
  id: 'image-convert',
  group: 'convert',
  icon: 'swap',
  title: 'Convert and resize images',
  desc: 'Change images to JPG, PNG or WebP, make them smaller, or resize them.',
  mount(root) {
    const items = [];
    const list = fileList(items, update, it => [
      h('img', { src: it.url, alt: '' }),
      h('div', { class: 'name' }, it.file.name, h('div', { class: 'meta' }, size(it.file.size)))
    ]);

    const format = select([['image/jpeg', 'JPG'], ['image/png', 'PNG'], ['image/webp', 'WebP']], 'image/jpeg');
    const maxSide = select([['0', 'Keep size'], ['3000', 'Max 3000 px'], ['2000', 'Max 2000 px'], ['1280', 'Max 1280 px'], ['800', 'Max 800 px']], '0');
    const quality = h('input', { type: 'range', min: '30', max: '100', value: '85' });
    const qLabel = h('span', {}, '85');
    quality.oninput = () => { qLabel.textContent = quality.value; };

    const bar = progress();
    const go = h('button', { class: 'btn main', onclick: run }, 'Convert');
    const status = h('span', { class: 'status' });

    const panel = h('div', { class: 'panel', hidden: true },
      list.el,
      h('div', { class: 'row', style: 'margin-top:16px' },
        field('Save as', format),
        field('Size', maxSide),
        field(h('span', {}, 'Quality ', qLabel), quality)
      ),
      h('div', { class: 'actions' }, go, status),
      bar.el
    );

    function update() { panel.hidden = !items.length; }

    async function run() {
      go.disabled = true;
      try {
        const type = format.value;
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
        const outs = [];
        let before = 0, after = 0;
        for (let i = 0; i < items.length; i++) {
          bar.set(i / items.length);
          await wait();
          const c = await imageToCanvas(items[i].file, +maxSide.value);
          const blob = await canvasBlob(c, type, +quality.value / 100);
          before += items[i].file.size;
          after += blob.size;
          outs.push([baseName(items[i].file.name) + '.' + ext, blob]);
        }
        bar.set(1);
        if (outs.length === 1) {
          download(outs[0][1], outs[0][0], type);
        } else {
          const zip = new JSZip();
          outs.forEach(([n, b]) => zip.file(n, b));
          download(await zip.generateAsync({ type: 'blob' }), 'images.zip', 'application/zip');
        }
        status.textContent = size(before) + ' to ' + size(after);
        toast('Done');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
      bar.done();
      go.disabled = false;
    }

    root.append(
      h('div', { class: 'panel' }, dropZone({ accept: 'image/*', multiple: true, title: 'Add images', onFiles: fs => {
        for (const f of fs) items.push({ file: f, url: URL.createObjectURL(f) });
        list.draw();
        update();
      } })),
      panel
    );
  }
};
