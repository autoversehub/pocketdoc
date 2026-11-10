import { h, singlePdf, field, toast, download, loadPdfLib, baseName } from '../util.js';

export default {
  id: 'metadata',
  group: 'edit',
  icon: 'info',
  title: 'Edit PDF info',
  desc: 'Change the title, author and keywords, or wipe hidden info before sharing.',
  mount(root) {
    let pdf, name;
    const title = h('input', { type: 'text' });
    const author = h('input', { type: 'text' });
    const subject = h('input', { type: 'text' });
    const keywords = h('input', { type: 'text', placeholder: 'comma, separated' });
    const facts = h('p', { class: 'hint' });

    const panel = h('div', { class: 'panel', hidden: true },
      h('div', { class: 'row' },
        field('Title', title, 'wide'),
        field('Author', author),
        field('Subject', subject),
        field('Keywords', keywords, 'wide')
      ),
      facts,
      h('div', { class: 'actions' },
        h('button', { class: 'btn main', onclick: () => save(false) }, 'Save'),
        h('button', { class: 'btn', onclick: () => save(true) }, 'Remove all info')
      )
    );

    singlePdf(root, async (file, bytes) => {
      if (!file) { panel.hidden = true; return; }
      name = baseName(file.name);
      pdf = await loadPdfLib(bytes);
      title.value = pdf.getTitle() || '';
      author.value = pdf.getAuthor() || '';
      subject.value = pdf.getSubject() || '';
      keywords.value = pdf.getKeywords() || '';
      const made = pdf.getCreationDate();
      facts.textContent = [
        pdf.getPageCount() + ' pages',
        pdf.getProducer() && 'made with ' + pdf.getProducer(),
        made && 'created ' + made.toLocaleDateString()
      ].filter(Boolean).join(', ');
      panel.hidden = false;
    });

    async function save(wipe) {
      try {
        if (wipe) {
          for (const k of ['Title', 'Author', 'Subject', 'Creator', 'Producer']) pdf['set' + k]('');
          pdf.setKeywords([]);
          pdf.setCreationDate(new Date(0));
          pdf.setModificationDate(new Date(0));
          [title, author, subject, keywords].forEach(i => i.value = '');
        } else {
          pdf.setTitle(title.value);
          pdf.setAuthor(author.value);
          pdf.setSubject(subject.value);
          pdf.setKeywords(keywords.value.split(',').map(s => s.trim()).filter(Boolean));
          pdf.setModificationDate(new Date());
        }
        download(await pdf.save({ updateFieldAppearances: false }), name + (wipe ? '-clean' : '') + '.pdf');
        toast(wipe ? 'Info removed' : 'Saved');
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
    }

    root.append(panel);
  }
};
