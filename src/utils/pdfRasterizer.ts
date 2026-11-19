import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function pdfFirstPageToImage(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1.65, 1400 / Math.max(base.width, base.height));
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
  return c.toDataURL('image/jpeg', 0.82);
}
