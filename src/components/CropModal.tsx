import { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';

interface CropModalProps {
  file: File | null;
  onCancel: () => void;
  onCropComplete: (dataUrl: string) => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropState {
  img: HTMLImageElement;
  scale: number;
  ox: number;
  oy: number;
  dw: number;
  dh: number;
  rect: CropRect;
  mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;
  start: { p: { x: number; y: number }; rect: CropRect } | null;
}

export function CropModal({ file, onCancel, onCropComplete }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CropState | null>(null);
  const [ready, setReady] = useState(false);

  const drawCrop = () => {
    const c = canvasRef.current;
    const q = stateRef.current;
    if (!c || !q) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#081224';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(q.img, q.ox, q.oy, q.dw, q.dh);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, c.width, c.height);

    const r = q.rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.drawImage(q.img, q.ox, q.oy, q.dw, q.dh);
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#10a85a';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const corners: Array<[number, number]> = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ];
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (!file) {
      stateRef.current = null;
      setReady(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        if (!c) return;
        c.width = Math.min(720, Math.max(300, window.innerWidth - 36));
        c.height = Math.min(500, Math.max(260, window.innerHeight - 230));

        const scale = Math.min(c.width / img.width, c.height / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const ox = (c.width - dw) / 2;
        const oy = (c.height - dh) / 2;
        const w = dw * 0.8;
        const h = dh * 0.8;

        stateRef.current = {
          img,
          scale,
          ox,
          oy,
          dw,
          dh,
          rect: { x: ox + (dw - w) / 2, y: oy + (dh - h) / 2, w, h },
          mode: null,
          start: null,
        };
        setReady(true);
        drawCrop();
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }, [file]);

  if (!file) return null;

  const getPoint = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const b = c.getBoundingClientRect();
    return {
      x: ((clientX - b.left) * c.width) / b.width,
      y: ((clientY - b.top) * c.height) / b.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const q = stateRef.current;
    if (!q) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getPoint(e.clientX, e.clientY);
    const r = q.rect;
    const near = (x: number, y: number) => Math.hypot(p.x - x, p.y - y) < 26;

    if (near(r.x + r.w, r.y + r.h)) q.mode = 'se';
    else if (near(r.x, r.y)) q.mode = 'nw';
    else if (near(r.x + r.w, r.y)) q.mode = 'ne';
    else if (near(r.x, r.y + r.h)) q.mode = 'sw';
    else if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) q.mode = 'move';
    else q.mode = null;

    if (q.mode) {
      q.start = { p: { ...p }, rect: { ...r } };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const q = stateRef.current;
    if (!q || !q.mode || !q.start) return;
    const p = getPoint(e.clientX, e.clientY);
    const s = q.start;
    const r = s.rect;
    const dx = p.x - s.p.x;
    const dy = p.y - s.p.y;

    let nr: CropRect = { ...r };
    if (q.mode === 'move') {
      nr.x = Math.max(q.ox, Math.min(q.ox + q.dw - r.w, r.x + dx));
      nr.y = Math.max(q.oy, Math.min(q.oy + q.dh - r.h, r.y + dy));
    } else {
      let { x, y, w, h } = r;
      if (q.mode.includes('e')) w = r.w + dx;
      if (q.mode.includes('s')) h = r.h + dy;
      if (q.mode.includes('w')) {
        x = r.x + dx;
        w = r.w - dx;
      }
      if (q.mode.includes('n')) {
        y = r.y + dy;
        h = r.h - dy;
      }
      w = Math.max(30, w);
      h = Math.max(30, h);
      if (x < q.ox) {
        w -= q.ox - x;
        x = q.ox;
      }
      if (y < q.oy) {
        h -= q.oy - y;
        y = q.oy;
      }
      if (x + w > q.ox + q.dw) w = q.ox + q.dw - x;
      if (y + h > q.oy + q.dh) h = q.oy + q.dh - y;
      nr = { x, y, w, h };
    }
    q.rect = nr;
    drawCrop();
  };

  const handlePointerUp = () => {
    if (stateRef.current) {
      stateRef.current.mode = null;
    }
  };

  const handleUseCrop = () => {
    const q = stateRef.current;
    if (!q) return;
    const r = q.rect;
    const sx = (r.x - q.ox) / q.scale;
    const sy = (r.y - q.oy) / q.scale;
    const sw = r.w / q.scale;
    const sh = r.h / q.scale;

    const out = document.createElement('canvas');
    const maxDim = 1800;
    const sc = Math.min(1, maxDim / Math.max(sw, sh));
    out.width = Math.max(1, Math.round(sw * sc));
    out.height = Math.max(1, Math.round(sh * sc));
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(q.img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/jpeg', 0.92);
    onCropComplete(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#08162c]/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="w-full max-w-3xl bg-[#0e1b33] text-white rounded-2xl border border-white/15 shadow-2xl p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base md:text-lg font-extrabold text-white">Crop Photo</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Box-এর ভিতরের অংশটি রাখা হবে। Box টেনে সরান বা কোণা ধরে resize করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
            aria-label="Cancel crop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center touch-none">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="max-w-full cursor-move touch-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={handleUseCrop}
            className="min-h-[44px] px-5 rounded-xl bg-[#10a85a] hover:bg-[#0d8f4c] disabled:opacity-50 text-white font-bold text-sm inline-flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Crop & Use
          </button>
        </div>
      </div>
    </div>
  );
}
