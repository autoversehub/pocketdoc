# PocketDoc

Free PDF and document tools that run in your browser. Nothing is uploaded, everything happens on your own phone or computer.

## Tools

**Make a PDF**
- Images to PDF (with camera scan, grayscale and black and white scan look)
- Text to PDF (works with Arabic and Kurdish too)

**Edit a PDF**
- Merge PDFs
- Split PDF (pick pages, ranges, or every page)
- Organize pages (rotate, delete, reorder)
- Compress PDF
- Add page numbers
- Add watermark
- Sign PDF (draw or type)
- Edit PDF info (title, author, or wipe it)

**Convert and extract**
- PDF to images (JPG or PNG)
- PDF to text
- Image to text (OCR, needs internet the first time to get the language data)
- Convert and resize images (JPG, PNG, WebP)

## Put it online with GitHub Pages

1. Make a new public repo on GitHub, for example `pocketdoc`.
2. Upload everything in this folder to the repo (keep the folders as they are).
3. Go to **Settings > Pages**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. After a minute the site is live at `https://YOUR-NAME.github.io/pocketdoc/`.

On a phone you can open the site and use "Add to Home Screen" so it works like an app, even offline.

## Updating

When you change files, bump `VERSION` in `sw.js` (like `pocketdoc-v2`) so phones pick up the new version.

## Run it on your computer

It needs a small local server because of the JS modules:

```
python -m http.server 8000
```

Then open http://localhost:8000

## Libraries

- [pdf-lib](https://pdf-lib.js.org) (MIT)
- [PDF.js](https://mozilla.github.io/pdf.js/) (Apache 2.0)
- [JSZip](https://stuk.github.io/jszip/) (MIT)
- [Tesseract.js](https://tesseract.projectnaptha.com) (Apache 2.0), loaded from a CDN only when OCR is used
