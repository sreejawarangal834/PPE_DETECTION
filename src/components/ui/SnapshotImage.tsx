import { useEffect, useState } from 'react';
import { fetchSnapshotBlobUrl } from '../../lib/http';
import { Camera } from 'lucide-react';

interface Props {
  snapshotUrl?: string | null;
  alt: string;
  className?: string;
  height?: number;
}

/**
 * Real violation snapshot, fetched from the authenticated GET /api/snapshots/{id} endpoint
 * (a plain <img src> can't attach the Authorization header the endpoint requires — see
 * src/lib/http.ts::fetchSnapshotBlobUrl). Renders an honest "No snapshot captured" state when
 * `snapshotUrl` is absent (every legacy-imported alert, and any violation from before this
 * feature existed) rather than a broken-image icon or a fabricated placeholder graphic.
 */
export default function SnapshotImage({ snapshotUrl, alt, className = '', height = 160 }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!snapshotUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    setFailed(false);
    setBlobUrl(null);
    if (!snapshotUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSnapshotBlobUrl(snapshotUrl).then(url => {
      if (url) {
        currentUrl = url;
        setBlobUrl(url);
      } else {
        setFailed(true);
      }
      setLoading(false);
    });
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [snapshotUrl]);

  const boxStyle = { height };

  if (loading) {
    return (
      <div
        className={`bg-panel-alt border border-border-soft rounded-lg flex items-center justify-center text-text-muted text-sm animate-pulse ${className}`}
        style={boxStyle}
      >
        Loading snapshot…
      </div>
    );
  }

  if (!snapshotUrl || failed || !blobUrl) {
    return (
      <div
        className={`bg-panel-alt border border-border-soft rounded-lg flex flex-col items-center justify-center gap-1.5 text-text-muted text-sm ${className}`}
        style={boxStyle}
      >
        <Camera className="w-5 h-5 opacity-50" aria-hidden="true" />
        <span>No snapshot captured</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={`rounded-lg border border-border-soft object-cover w-full ${className}`}
      style={{ ...boxStyle, objectFit: 'contain', background: '#1a1d23' }}
    />
  );
}
