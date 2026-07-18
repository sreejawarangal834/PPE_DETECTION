/**
 * Shared low-level feed-rendering pieces used by both the single-camera
 * detail view (CameraDetailPanel) and the multi-session grid view — kept
 * here so the canvas bounding-box logic isn't duplicated between them.
 */
import { useEffect, useRef, memo } from 'react';
import type { Detection } from '../../hooks/useDetectionSocket';
import {
  detectionClassColor,
  detectionClassLabel,
} from '../../constants/detectionClasses';

function isViolationDetection(det: Detection): boolean {
  if (det.compliant === false) return true;
  if (det.compliant === true) return false;
  const lower = det.label.toLowerCase();
  return lower.startsWith('no_') || lower.startsWith('no-') || lower.includes('missing');
}

// ── BoundingBoxCanvas ───────────────────────────────────────────────────────
// Memoised — only redraws when detections or container size changes.
// Uses devicePixelRatio for crisp rendering on HiDPI/Retina displays.

interface BBCanvasProps {
  detections: Detection[];
  containerW: number;
  containerH: number;
}

export const BoundingBoxCanvas = memo(function BoundingBoxCanvas({
  detections, containerW, containerH,
}: BBCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerW === 0 || containerH === 0) return;

    // HiDPI: set logical canvas size to container size,
    // but internal pixel buffer at devicePixelRatio * container size
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width  = Math.round(containerW * dpr);
    canvas.height = Math.round(containerH * dpr);
    canvas.style.width  = `${containerW}px`;
    canvas.style.height = `${containerH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, containerH);

    const W = containerW;
    const H = containerH;

    ctx.font = 'bold 11px IBM Plex Mono, monospace';

    detections.forEach(det => {
      const [nx1, ny1, nx2, ny2] = det.box;

      // Scale normalised coords to pixel coords
      const bx = nx1 * W;
      const by = ny1 * H;
      const bw = (nx2 - nx1) * W;
      const bh = (ny2 - ny1) * H;

      const col = detectionClassColor(det.label);

      // Box outline with slight shadow for contrast over any background
      ctx.shadowColor   = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur    = 3;
      ctx.strokeStyle   = col;
      ctx.lineWidth     = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur    = 0;

      // Non-compliant detections get an extra dashed red "attention" ring,
      // offset outside the box — compliance signal layered on the class color
      if (isViolationDetection(det)) {
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#C25450';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
        ctx.restore();
      }

      // Label pill background
      const labelText = `${detectionClassLabel(det.label)}  ${(det.conf * 100).toFixed(0)}%`;
      const textMetrics = ctx.measureText(labelText);
      const pillW = textMetrics.width + 10;
      const pillH = 18;
      // Clamp label so it never goes off-screen at top
      const pillY = by >= pillH + 2 ? by - pillH - 2 : by + bh + 2;

      ctx.fillStyle = `${col}dd`;
      // Rounded pill
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx + r, pillY);
      ctx.lineTo(bx + pillW - r, pillY);
      ctx.quadraticCurveTo(bx + pillW, pillY, bx + pillW, pillY + r);
      ctx.lineTo(bx + pillW, pillY + pillH - r);
      ctx.quadraticCurveTo(bx + pillW, pillY + pillH, bx + pillW - r, pillY + pillH);
      ctx.lineTo(bx + r, pillY + pillH);
      ctx.quadraticCurveTo(bx, pillY + pillH, bx, pillY + pillH - r);
      ctx.lineTo(bx, pillY + r);
      ctx.quadraticCurveTo(bx, pillY, bx + r, pillY);
      ctx.closePath();
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, bx + 5, pillY + 13);
    });
  }, [detections, containerW, containerH]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      // Explicit 0-size until first ResizeObserver tick avoids initial layout paint
      style={{ width: containerW || 0, height: containerH || 0 }}
    />
  );
});

// ── VideoFeed ────────────────────────────────────────────────────────────────
// Renders a live browser-webcam MediaStream directly — no jpeg round-trip.
// Memoised on the stream reference, which is stable for the life of a session.

export const VideoFeed = memo(function VideoFeed({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
});

// ── FeedImage ────────────────────────────────────────────────────────────────
// Renders a base64 JPEG frame (uploaded-video playback path).

export const FeedImage = memo(function FeedImage({ jpeg }: { jpeg: string }) {
  return (
    <img
      src={`data:image/jpeg;base64,${jpeg}`}
      alt="Live YOLO26 detection frame"
      className="absolute inset-0 w-full h-full object-cover"
      draggable={false}
    />
  );
});

export { isViolationDetection };
