/**
 * Modal for entering a live RTSP stream URL — typically a phone on the same
 * network running an RTSP-server app (e.g. "IP Webcam" on Android, "RTSP
 * Camera Server" on iOS). Submitting hands the URL back to MonitoringPage,
 * which then opens CameraSlotPicker exactly like the upload/webcam flows so
 * the session lands bound to a zone.
 */
import { useState, type FormEvent } from 'react';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';

interface RtspConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (url: string) => void;
}

export default function RtspConnectDialog({ open, onClose, onConnect }: RtspConnectDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  function handleClose() {
    setUrl('');
    setError('');
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed.startsWith('rtsp://')) {
      setError('URL must start with rtsp://');
      return;
    }
    onConnect(trimmed);
    setUrl('');
    setError('');
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Connect Phone Camera (RTSP)">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-text-muted">
          Install an RTSP-server app on the phone (e.g. "IP Webcam" on Android,
          "RTSP Camera Server" on iOS), start it, and enter the rtsp:// address
          it shows — the phone must be on the same network as this server.
        </p>
        <Input
          label="RTSP URL"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          placeholder="rtsp://192.168.1.42:8080/h264_ulaw.sdp"
          error={error}
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary hover:bg-panel-alt transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all duration-200"
          >
            Connect
          </button>
        </div>
      </form>
    </Dialog>
  );
}
