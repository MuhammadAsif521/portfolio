import type { ToolMeta } from '../tools.manifest.js';

/** images-pdf tools: manifest entries only (copy, SEO, FAQs). Keep the only import the type above: the backend keeps a verbatim copy. */
export const IMAGE_PDF_TOOLS: ToolMeta[] = [
  {
    slug: 'image-converter',
    name: 'Image Converter',
    h1: 'Image Converter: PNG, JPG and WebP, in Bulk',
    title: 'Image Converter: PNG, JPG and WebP, Free | Asif Dev',
    description:
      'Convert images between PNG, JPG and WebP with a quality slider and a background colour for transparency. Batch and ZIP. Runs in your browser.',
    keyword: 'convert png to jpg',
    category: 'images',
    related: ['image-compressor', 'image-resizer', 'svg-to-png', 'images-to-pdf'],
    example: {
      input: 'logo.png (2400 x 1600 px, transparent background) to JPEG, quality 85, background #ffffff',
      output: 'logo.jpg: 2400 x 1600 px, transparent areas filled with white. The new file size is shown next to the original.',
    },
    sections: [
      {
        heading: 'Pick the format for the job',
        paragraphs: [
          'PNG is lossless and keeps transparency, which makes it the right choice for screenshots, logos, icons and anything with sharp edges or text. JPEG is lossy and cannot be transparent, but it gives much smaller files for photographs. WebP can do both: lossy or lossless, with or without transparency, and in most cases produces a smaller file than JPEG or PNG at similar visual quality.',
          'AVIF compresses even better, but browsers can only write it if their canvas encoder supports it, and many do not yet. This tool tests your browser on load and shows AVIF in the list only when it can really produce it. The same check hides WebP in a browser that cannot write it, so you never get a file in a different format than the one you asked for.',
        ],
      },
      {
        heading: 'How the conversion works',
        paragraphs: [
          'Each image is decoded by your browser, drawn onto a canvas and written out again in the format you chose. Files are handled one after another, so memory use stays at one image at a time and a batch of fifty photos does not freeze the tab. The result list shows the size before and after for every file and in total, and you can download files individually or as one ZIP.',
          'Because the picture is redrawn, the new file does not carry the EXIF block of the original: camera model, capture date and GPS position are not copied, and embedded colour profiles are dropped too. Photo orientation is the exception that matters: if a JPEG is stored sideways with an orientation flag, the flag is applied to the pixels first, so the converted image is upright. That is a side effect of how the canvas writes files, not a privacy feature you should rely on for sensitive material.',
        ],
      },
      {
        heading: 'Transparency, quality and limits',
        paragraphs: [
          'JPEG has no alpha channel, so transparent pixels must become a colour. Choose the background colour that matches where the image will be used; white is the usual choice. For JPEG and WebP the quality slider trades size for detail: values from 75 to 90 are a good range for photographs, and going below 60 tends to show blocky areas. PNG ignores the slider because it is lossless.',
          'Animated GIF and WebP files convert their first frame only. The tool accepts PNG, JPEG, WebP, GIF, BMP and AVIF files up to 50 MB and 64 megapixels each, and up to 100 files per run; larger images are refused with a message instead of crashing the tab. HEIC photos from iPhones can only be opened in browsers that decode HEIC, which is mainly Safari. If a file will not open here it is usually damaged or in a format your browser cannot read.',
        ],
      },
    ],
    faq: [
      {
        q: 'Are my images uploaded to a server?',
        a: 'No. Decoding, converting and zipping all happen in your browser tab. Close the tab and nothing remains.',
      },
      {
        q: 'Does converting remove EXIF and GPS data?',
        a: 'The new file is written from the pixels, so EXIF, GPS and colour profiles are not copied into it. Orientation is applied to the pixels first. Treat this as a side effect, and check the output yourself if the metadata matters.',
      },
      {
        q: 'Why is there no AVIF option?',
        a: 'AVIF is listed only when your browser can encode it through the canvas. Many browsers can decode AVIF but not write it, so the option stays hidden rather than producing a different format.',
      },
      {
        q: 'Why did my transparent PNG get a white background in JPEG?',
        a: 'JPEG cannot store transparency. Transparent pixels are filled with the background colour you pick, white by default. Convert to WebP or keep PNG if you need transparency.',
      },
      {
        q: 'What happens to animated GIFs?',
        a: 'Only the first frame is converted. Animation is not preserved.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'image-compressor',
    name: 'Image Compressor',
    h1: 'Compress Images to a Target Size (JPG, WebP, PNG)',
    title: 'Compress Image to 200KB: JPG, WebP, PNG | Asif Dev',
    description:
      'Shrink JPG, WebP and PNG files with a quality slider, a live before and after preview, or a target size like 200 KB. Batch and ZIP in your browser.',
    keyword: 'compress image to 200kb',
    category: 'images',
    related: ['image-converter', 'image-resizer', 'images-to-pdf', 'base64-encoder'],
    example: {
      input: 'IMG_2041.jpg (4000 x 3000 px), target size 200 KB',
      output: 'IMG_2041-compressed.jpg at the highest quality that fits 200 KB, reduced in pixel size only if quality alone cannot reach it. Original and new size are shown.',
    },
    sections: [
      {
        heading: 'Three ways to set the size',
        paragraphs: [
          'The quality slider is the direct control: lower values give smaller files and more visible artefacts. The preview above the results re-encodes one of your images as you move the slider, so you see the real output and its exact size rather than a guess. Pick the image to preview from the list when you load several.',
          'Target size mode is for upload forms that demand a limit such as 200 KB. The tool encodes at the best quality first, then at a low one, and then searches between them for the highest quality that fits. If even the lowest quality is too big it shrinks the pixel dimensions in 15% steps and repeats. If the limit still cannot be reached, you get the smallest result and a note saying so. The third lever is the maximum size option: a 4000 pixel photo shown on a 1280 pixel wide page wastes most of its pixels.',
        ],
      },
      {
        heading: 'How PNG is handled honestly',
        paragraphs: [
          'A canvas can only write PNG losslessly, and re-encoding an already optimised PNG usually saves nothing. So PNG compression here works the way dedicated PNG optimisers do: the image is reduced to a palette of 256, 128 or 64 colours and written as an indexed PNG with transparency preserved. Flat graphics, screenshots and logos usually keep their look and shrink a lot. Photographs and smooth gradients can show banding, which is why you should compare the preview before downloading.',
          'If compressing a file would not make it smaller, for example a PNG that is already tiny, you get the original file back unchanged and the row says so. For photos, converting PNG to WebP or JPEG is normally a far bigger saving than any PNG setting, so try the output format option too.',
        ],
      },
      {
        heading: 'What happens to your files',
        paragraphs: [
          'Everything runs in your browser, one image at a time, with a ZIP download for batches and a total before and after size for the whole run. Images up to 50 MB and 64 megapixels are accepted, and up to 100 files per run. The browser decodes each file, applies its EXIF orientation, redraws it and writes a new file, so the output does not contain the original EXIF data, GPS position or colour profile. That is a consequence of re-encoding, so check the output if you rely on it.',
          'Repeated lossy compression degrades quality, so always compress from the original file, not from an already compressed copy. Colours can shift slightly for images with a wide-gamut profile because the result is plain sRGB. Animated GIFs are reduced to their first frame.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I compress an image to under 200 KB?',
        a: 'Turn on the target size option, enter 200 KB and press Compress. The tool finds the highest quality that fits and reduces the pixel size only if it must.',
      },
      {
        q: 'Is the compression lossy?',
        a: 'JPEG, WebP and the PNG colour-reduction mode are lossy. The preview shows the actual result before you download. The lossless PNG option rarely saves anything.',
      },
      {
        q: 'Why did I get my original file back?',
        a: 'When re-encoding would produce a larger or equal file at the same format and size, the original is returned unchanged rather than making things worse.',
      },
      {
        q: 'Is the EXIF data kept?',
        a: 'No. Files are redrawn and re-encoded, so EXIF, GPS and embedded colour profiles are not copied into the result.',
      },
      {
        q: 'Are my images uploaded?',
        a: 'No. All processing happens locally in your browser tab.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'image-resizer',
    name: 'Image Resizer',
    h1: 'Resize Images by Pixels, Percent or Social Preset',
    title: 'Resize Image Online: Pixels, Percent, Presets | Asif Dev',
    description:
      'Resize images by exact pixels, percent or social media preset with aspect ratio lock, contain, cover or stretch fit, batch and ZIP. Runs in your browser.',
    keyword: 'resize image online',
    category: 'images',
    related: ['image-compressor', 'image-converter', 'images-to-pdf', 'svg-to-png'],
    example: {
      input: 'photo.jpg (4032 x 3024 px), pixels mode, width 1200, aspect ratio locked',
      output: 'photo-1200x900.jpg: 1200 x 900 px. The height follows the original shape, so nothing is stretched.',
    },
    sections: [
      {
        heading: 'Pixels, percent or preset',
        paragraphs: [
          'In pixels mode you enter a width, a height or both. With "Keep aspect ratio" on, each image is scaled to fit inside that box without distortion, so a batch of photos with different shapes all end up no larger than the box. Typing a width fills in the height from the first image, and the line under the form tells you the exact result for it before you run anything. With the lock off you get exactly the width and height you entered, and the fit mode decides what happens when the shape differs.',
          'Percent mode scales every image by the same factor, from 5 to 400 percent. Presets cover common targets such as an Instagram square, a story, an Open Graph link image of 1200 x 630, an X header or a YouTube thumbnail. Platforms change their recommended sizes now and then, so confirm the numbers with the platform when exact dimensions matter.',
        ],
      },
      {
        heading: 'Contain, cover and stretch',
        paragraphs: [
          'When the target shape is different from the picture, there are three honest choices. Contain keeps the whole image and pads the empty space with a colour or with transparency. Cover fills the target completely and crops the edges that do not fit, which is what most social posts want. Stretch fills the target by distorting the image and is only useful when you know the proportions are close.',
          'Smoothing controls how pixels are blended while scaling. Best quality uses stepwise reduction for large size drops, which avoids the jagged look a single big reduction can give. Fast is quicker with less polish, and the no smoothing option keeps hard pixel edges, which suits pixel art and icons you scale up by whole numbers.',
        ],
      },
      {
        heading: 'Limits and what is written',
        paragraphs: [
          'Images are read and written by your browser, one at a time, so a batch will not freeze the page and you can download a ZIP at the end. The output can be at most 16,384 pixels on its longest side and 64 megapixels in total; the tool refuses larger requests with a message because a canvas that big can crash a tab, especially on phones. Inputs can be up to 50 MB each, in PNG, JPEG, WebP, GIF, BMP or AVIF, up to 100 files per run.',
          'The EXIF orientation of a photo is applied before resizing, so portrait photos from a phone keep the right way up. The result is written again from pixels, so EXIF data such as GPS is not copied into it. Enlarging a small image does not add detail, it only makes the same information bigger and softer, so resize down whenever you can.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I resize an image without stretching it?',
        a: 'Use pixels mode with Keep aspect ratio turned on. Enter a width or a height and the other side follows the picture, or use a preset with the cover or contain fit.',
      },
      {
        q: 'What is the difference between contain and cover?',
        a: 'Contain shows the whole image and pads the extra space. Cover fills the target size and crops the parts that do not fit.',
      },
      {
        q: 'Can I resize many images at once?',
        a: 'Yes, up to 100 at a time. They are processed one after another and can be downloaded as a ZIP.',
      },
      {
        q: 'Does resizing keep the EXIF location data?',
        a: 'No. The output is drawn from pixels, so EXIF and GPS data are not copied. The photo orientation is applied to the pixels.',
      },
      {
        q: 'Is there a maximum output size?',
        a: 'Yes: 16,384 pixels on a side and 64 megapixels in total, to keep browsers from running out of memory.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'svg-to-png',
    name: 'SVG to PNG',
    h1: 'SVG to PNG Converter with Safe Preview',
    title: 'SVG to PNG Converter: Any Size, Transparent | Asif Dev',
    description:
      'Render SVG to PNG at 1x to 8x or an exact width, with a transparent or coloured background. The SVG is cleaned first. Runs in your browser.',
    keyword: 'svg to png converter',
    category: 'images',
    related: ['image-converter', 'image-resizer', 'image-compressor', 'base64-encoder'],
    example: {
      input: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">...</svg>, scale 2x, transparent',
      output: 'image@2x.png: 240 x 160 px with a transparent background.',
    },
    sections: [
      {
        heading: 'How the SVG is rendered',
        paragraphs: [
          'SVG is a vector format described in XML, and a PNG is a grid of pixels, so converting means choosing the pixel size. You can scale the SVG by 0.5x up to 8x of its own size, or give an exact width in pixels and let the height follow the shape. Because the drawing is redrawn at the final size rather than enlarged afterwards, edges stay sharp even at 8x. The PNG can be transparent or have a white, black or custom colour behind it.',
          'Paste the SVG code or load a file. The preview you see is the cleaned version of your SVG as the browser draws it, so you can check the result before you render it.',
        ],
      },
      {
        heading: 'Why the SVG is cleaned first',
        paragraphs: [
          'An SVG file can contain scripts, event handlers, links to other files and even embedded HTML. This tool never puts your SVG into the page as markup. It parses the file in a detached document, removes scripts, foreignObject, animation elements and event attributes with DOMPurify, drops links that point outside the file and removes CSS that could fetch something, then draws the cleaned result through an image element, which cannot run scripts or load other resources. A short note tells you what was removed.',
          'This matters when you convert SVGs you did not write, such as downloads from icon sites or exports from unknown tools. It also means a few things are intentionally not rendered, so if a file relies on a script to draw itself you will see a plain or empty result.',
        ],
      },
      {
        heading: 'SVGs without a size, and other limits',
        paragraphs: [
          'Some SVGs have no width, height or viewBox. When there is a viewBox the shape is known and the tool uses it. When there is nothing at all, the browser default of 300 x 150 pixels is assumed and a notice says so, so set a width yourself if that is wrong. Sizes given in units such as mm or pt are converted at 96 pixels per inch, and percentages fall back to the viewBox.',
          'Fonts are the main limit. Text in an SVG is drawn with fonts installed on your device, and fonts or images the SVG links from the internet are not loaded. If a logo relies on a custom font, convert the text to outlines in your design tool first. The output can be at most 16,384 pixels on a side and 64 megapixels, and SVG text is limited to 5 MB.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is it safe to convert an SVG from an unknown source?',
        a: 'The SVG is cleaned with DOMPurify and extra rules, and is only drawn through an image element, never inserted into the page. That removes scripts and external references. As with any file from an unknown source, still review the result.',
      },
      {
        q: 'How do I get a transparent PNG?',
        a: 'Leave the background on Transparent. Any area the SVG does not paint stays transparent in the PNG.',
      },
      {
        q: 'What if my SVG has no width, height or viewBox?',
        a: 'A default of 300 x 150 pixels is used and the tool tells you. Enter a width to choose the size you want.',
      },
      {
        q: 'Why does the text look different?',
        a: 'SVG text uses fonts available on your device. Linked web fonts are not loaded. Convert text to outlines before exporting if the font must be exact.',
      },
      {
        q: 'Is the SVG uploaded?',
        a: 'No. Parsing, cleaning and drawing all happen in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'images-to-pdf',
    name: 'Images to PDF',
    h1: 'Combine Images into One PDF (JPG, PNG, WebP)',
    title: 'JPG to PDF Converter: Combine Images | Asif Dev',
    description:
      'Combine JPG, PNG and WebP images into one PDF. Reorder, remove pages, choose A4, Letter or fit-to-image, margins and fit. Runs in your browser.',
    keyword: 'jpg to pdf converter',
    category: 'images',
    related: ['merge-pdf', 'pdf-to-images', 'image-compressor', 'image-resizer'],
    example: {
      input: 'scan-1.jpg, scan-2.jpg, receipt.png in this order, A4, 10 mm margin, fit inside the page',
      output: 'scans.pdf: 3 pages, A4, each image centred and scaled to fit inside the margins.',
    },
    sections: [
      {
        heading: 'Make one page per image',
        paragraphs: [
          'Add images by choosing them or dropping them on the box, then put them in order. Drag the grip on each row, or use the up and down buttons, which also work from the keyboard. The remove button on a row deletes that page before you create the file. Each image becomes one page of the PDF, in list order.',
          'Page size can be A4, US Letter, or "fit to each image", where every page takes the size of its image at 96 pixels per inch. For A4 and Letter you choose portrait, landscape or automatic, which picks the orientation from each image shape. Margins run from none to 20 mm. Fit inside keeps the whole image visible, while fill the page scales it up to cover the page and crops what falls outside the margins.',
        ],
      },
      {
        heading: 'What goes into the file',
        paragraphs: [
          'The PDF is built in your browser with pdf-lib. JPEG and PNG files are embedded as they are, so there is no extra quality loss and the PDF is not much larger than the images. Other formats, such as WebP, GIF, BMP and AVIF, are redrawn on a canvas and embedded as PNG, which keeps transparency but can be bigger than the original.',
          'Photos from phones are often stored sideways with an EXIF orientation flag. A PDF viewer ignores that flag, so a JPEG with a rotation is redrawn upright first and written as JPEG at 92% quality. Metadata such as GPS location is not copied into the PDF. The document title is set to the file name you choose.',
        ],
      },
      {
        heading: 'Limits and tips',
        paragraphs: [
          'You can combine up to 100 images in one run, each up to 50 MB and 64 megapixels. Images are loaded one at a time while the PDF is built, but the finished file is held in memory, so very large batches of high resolution photos can exhaust the memory of a phone. If the PDF comes out too large for an email limit, reduce the images first with the image compressor or resizer, or use smaller photos.',
          'For scanned documents, A4 with a small margin and "fit inside the page" is a safe default. Choose "fit to each image" when pages have different shapes and you want no white borders added. If one image is damaged, the tool names it so you can remove it and try again.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I put images in a certain order?',
        a: 'Drag the grip on a row to a new position, or use the up and down buttons on the row. The numbers show the page order.',
      },
      {
        q: 'Are my images re-compressed?',
        a: 'JPEG and PNG files are embedded unchanged. Other formats and rotated JPEGs are redrawn first, as noted under the settings.',
      },
      {
        q: 'Can I make the pages the size of the images?',
        a: 'Yes. Choose "Fit to each image" as the page size. Each page then matches its image at 96 pixels per inch, plus your margin.',
      },
      {
        q: 'Is there a limit on the number of images?',
        a: 'Up to 100 images of 50 MB each per run. Very large sets can run out of memory on phones, so split them if needed.',
      },
      {
        q: 'Are the images uploaded anywhere?',
        a: 'No. The PDF is built entirely in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'pdf-to-images',
    name: 'PDF to Images',
    h1: 'Convert PDF Pages to JPG or PNG Images',
    title: 'PDF to JPG and PNG Converter, Any DPI | Asif Dev',
    description:
      'Convert PDF pages to PNG or JPG at 72 to 300 DPI, choose a page range and download a ZIP. Handles password-protected PDFs. Runs in your browser.',
    keyword: 'pdf to jpg converter',
    category: 'images',
    related: ['split-pdf', 'merge-pdf', 'images-to-pdf', 'image-compressor'],
    example: {
      input: 'report.pdf, pages 1-3, PNG, 150 DPI',
      output: 'report-page-1.png, report-page-2.png and report-page-3.png, each 1240 x 1754 px for an A4 page, plus a ZIP of all three.',
    },
    sections: [
      {
        heading: 'Choose resolution and range',
        paragraphs: [
          'A PDF page has a size in points, where 72 points make an inch, so the image size depends on the DPI you choose. For an A4 page, 72 DPI gives about 595 x 842 pixels, 150 DPI about 1240 x 1754, and 300 DPI about 2480 x 3508. Use 72 to 96 for thumbnails and web previews, 150 for comfortable reading, and 300 when the image will be printed or when small text must stay legible.',
          'The page range accepts numbers such as 1-3,5,8- and leaves all pages selected when empty. PNG keeps text and line art crisp and is lossless but larger, while JPEG is much smaller for scanned pages and photographs, with a quality slider. Pages are drawn on a white background.',
        ],
      },
      {
        heading: 'How the pages are rendered',
        paragraphs: [
          'The PDF is opened with pdf.js, the same rendering engine Firefox uses to display PDFs, in a web worker in your browser. Pages are rendered one at a time: each one is drawn on a canvas, written to a PNG or JPEG file and released before the next begins, so memory use stays low even for a long document. Each file shows its size, and you can download them separately or as a ZIP.',
          'If the PDF is protected with a password, the tool asks for it and passes it to the PDF engine in your browser. The password is not stored or sent anywhere. A wrong password shows a clear message and lets you try again.',
        ],
      },
      {
        heading: 'Limits and fidelity',
        paragraphs: [
          'Up to 300 pages are converted per run and the finished images are kept in memory, so the run stops with a notice if they pass about 600 MB; use a page range or a lower DPI to continue. A page that would need more than 16,384 pixels on a side or 64 megapixels at your chosen DPI is reported on its own row instead of crashing the tab, and you can lower the resolution for it.',
          'Rendering is faithful for most documents but not guaranteed to match every other viewer. Fonts that are not embedded in the PDF are replaced with similar system fonts, so spacing can differ slightly. Some interactive form fields, signatures and advanced transparency features may draw differently. The images contain the visible page only, not the text layer, so they cannot be searched.',
        ],
      },
    ],
    faq: [
      {
        q: 'What DPI should I choose?',
        a: '150 is a good default for reading on screen, 72 to 96 for small previews, and 300 for print or small text. Higher DPI makes bigger files.',
      },
      {
        q: 'Can I convert a password-protected PDF?',
        a: 'Yes, if you know the password. The tool asks for it and uses it only in your browser to render the pages.',
      },
      {
        q: 'PNG or JPEG?',
        a: 'PNG for text, diagrams and screenshots that must stay crisp. JPEG for scans and photos where smaller files matter more.',
      },
      {
        q: 'Is my PDF uploaded to a server?',
        a: 'No. The PDF is read and rendered in your browser tab and the images are created locally.',
      },
      {
        q: 'Can I convert only some pages?',
        a: 'Yes. Enter a range like 2-5,9 in the pages field. Leave it empty for every page.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    h1: 'Merge PDF Files, in Any Order',
    title: 'Merge PDF Files Online, Free and Private | Asif Dev',
    description:
      'Merge several PDFs into one in the order you choose, with optional page ranges per file and a page total. Runs in your browser, no upload.',
    keyword: 'merge pdf files',
    category: 'images',
    related: ['split-pdf', 'pdf-viewer', 'images-to-pdf', 'pdf-to-images'],
    example: {
      input: 'cover.pdf (1 page), report.pdf (12 pages, include 3-12), appendix.pdf (4 pages)',
      output: 'merged.pdf: 15 pages in that order, with the first two pages of report.pdf left out.',
    },
    sections: [
      {
        heading: 'Build the order, then merge',
        paragraphs: [
          'Add two or more PDFs, then drag them into the order you want or move them with the up and down buttons. Every row shows the page count of its file, and the summary shows the total number of pages the merged document will have. A text field on each row lets you take only some pages from that file, for example 1-3,7 or 5-, and the total updates as you type.',
          'The merged PDF is created in your browser with pdf-lib and offered for download under the file name you choose. Files are opened one at a time while merging, so memory use is closer to the size of the result than to the size of every input added together.',
        ],
      },
      {
        heading: 'Errors are shown per file',
        paragraphs: [
          'Each file is checked as soon as it is added. A file that is not really a PDF, is damaged or truncated, or is empty gets a message on its own row, and it is skipped when you merge. The other files are not affected. A page range that does not fit the file, such as 12 pages requested from a 10-page PDF, is flagged under the field, and merging waits until it is fixed.',
          'Encrypted PDFs are a limit of the library: files protected with a password or with certain permission settings cannot be edited here, and the row says so. Open the file in a viewer that can print to PDF, save an unprotected copy and add that instead.',
        ],
      },
      {
        heading: 'What is and is not preserved',
        paragraphs: [
          'Pages are copied with their content, fonts, images and rotation. What is not carried over is the document-level structure: bookmarks (outlines), interactive form fields, document title and author, and tagged-PDF accessibility structure are not copied into the merged file, and links that jump to other pages in the same original document may not work. If you need those, use a full PDF editor.',
          'You can merge up to 30 files, each up to 100 MB and 300 MB in total. Very large merges can exhaust the memory of phones, so merge in stages if needed. The tool never changes your original files. If the result is larger than you need, run it through a PDF optimiser afterwards, since merging does not recompress images.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I change the order of the PDFs?',
        a: 'Drag the grip on a row, or use the up and down buttons. The merged file follows the list from top to bottom.',
      },
      {
        q: 'Can I merge only some pages of a file?',
        a: 'Yes. Type a range such as 1-3,7 in the pages field of that file. Leave it empty to include all pages.',
      },
      {
        q: 'Why is my PDF rejected?',
        a: 'It may be password protected, damaged, or not a PDF. The row for that file explains which. Protected files must be unlocked elsewhere first.',
      },
      {
        q: 'Are bookmarks kept?',
        a: 'No. Pages are merged without the original bookmarks, form fields and document metadata.',
      },
      {
        q: 'Do my PDFs leave my device?',
        a: 'No. They are read and merged in your browser tab.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    h1: 'Split a PDF by Page Range, Every N Pages or Page by Page',
    title: 'Split PDF by Page Range or Every N Pages | Asif Dev',
    description:
      'Split a PDF by page ranges like 1-3,5,8-, every N pages, one file per page, or extract picked pages with thumbnails. ZIP download, no upload.',
    keyword: 'split pdf by page range',
    category: 'images',
    related: ['merge-pdf', 'pdf-viewer', 'pdf-to-images', 'images-to-pdf'],
    example: {
      input: 'contract.pdf (10 pages), ranges 1-3,5,8-',
      output: 'contract-pages-1-3.pdf, contract-page-5.pdf and contract-pages-8-10.pdf, plus a ZIP of the three.',
    },
    sections: [
      {
        heading: 'Four ways to split',
        paragraphs: [
          'Page ranges turn each comma-separated part into its own file: 1-3,5,8- gives pages 1 to 3, page 5, and page 8 through the last page. Every N pages cuts the document into equal chunks, with a shorter last file when the page count does not divide evenly. Every page as its own file creates one PDF per page, which is useful for splitting a scanned stack. A range that ends with a dash, like 8-, runs to the last page.',
          'Pick pages is for taking a selection into one new PDF. The page previews on the right are real thumbnails from the document, and clicking them selects or clears pages, while the text field shows the same selection as a range. You can also type the range and watch the thumbnails follow. Previews load only as they scroll into view, and are shown for the first 400 pages.',
        ],
      },
      {
        heading: 'How files are created',
        paragraphs: [
          'The PDF is opened once in your browser, and each output is built by copying the chosen pages into a new document with pdf-lib. Results appear in a list with their page counts and sizes. A single result downloads directly, and several can be downloaded one by one or as a ZIP. Up to 500 files are created per run, and the source can be up to 100 MB.',
          'Splitting does not recompress anything, so text stays text and images keep their quality. The total size of the pieces can be larger than the original, because resources shared by many pages, such as fonts and logos, are copied into every file that uses them.',
        ],
      },
      {
        heading: 'Limits and what is not kept',
        paragraphs: [
          'The new files contain the selected pages with their content and rotation, but not the document-level extras. Bookmarks, interactive form fields, the original title and author, and links that point to other pages are not carried over. If you depend on those, use a full PDF editor.',
          'PDFs protected with a password or with encryption cannot be edited by the underlying library, and the tool tells you so right after you choose the file instead of failing later. Save an unprotected copy from a PDF viewer and try again. A damaged file is reported the same way. If a preview is missing, the page itself is usually fine; splitting still works without previews.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I split a PDF into separate pages?',
        a: 'Choose "Every page as its own file" and press the button. You get one PDF per page and a ZIP of all of them.',
      },
      {
        q: 'What does 1-3,5,8- mean?',
        a: 'Pages 1 to 3, then page 5, then page 8 to the end of the document. In the ranges mode each of those becomes a separate file.',
      },
      {
        q: 'How do I extract a few pages into one PDF?',
        a: 'Use "Pick pages": click the thumbnails or type the range. All selected pages go into one new PDF in page order.',
      },
      {
        q: 'Why can\'t I open my PDF?',
        a: 'It may be password protected, encrypted, damaged or not a PDF. The tool shows which, right after you choose the file.',
      },
      {
        q: 'Is my PDF uploaded?',
        a: 'No. The PDF is read, previewed and split in your browser tab.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];
