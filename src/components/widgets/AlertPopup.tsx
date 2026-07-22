import { useEffect, useState } from 'react';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { AlertTriangle, Shield, X } from 'lucide-react';
import type { Alert } from '../../types';

export default function AlertPopup() {
  const alerts = useAlertStore(s => s.alerts);
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Show new alerts as popups
    const newAlerts = alerts.filter(a => 
      !visibleAlerts.find(v => v.id === a.id) && 
      (a.status === 'open' || a.status === 'escalated')
    );
    
    if (newAlerts.length > 0) {
      setVisibleAlerts(prev => [...newAlerts, ...prev].slice(0, 5));
      
      // Auto-dismiss after 8 seconds
      newAlerts.forEach(alert => {
        setTimeout(() => {
          setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id));
        }, 8000);
      });
    }
  }, [alerts, visibleAlerts]);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {visibleAlerts.map(alert => (
        <div
          key={alert.id}
          className="pointer-events-auto bg-panel border border-border-soft rounded-2xl p-5 w-[380px] shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300"
          style={{
            animation: 'slideIn 0.3s ease-out',
            borderLeft: `4px solid ${alert.severity === 'high' ? '#C25450' : '#D9A441'}`
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${
                alert.severity === 'high' 
                  ? 'bg-[#C25450]/20 text-[#C25450]' 
                  : 'bg-[#D9A441]/20 text-[#D9A441]'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary capitalize">
                  {alert.severity} Alert
                </p>
                <p className="text-xs text-text-secondary font-mono">
                  {alert.cameraId} · {alert.zoneId}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id))}
              className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-panel-alt"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-3">
            <p className="text-sm text-text-primary font-medium mb-1">
              Missing PPE: {alert.missingPpe.join(', ')}
            </p>
            <p className="text-xs text-text-secondary">
              Worker: {alert.workerName}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                useAlertStore.getState().updateStatus(alert.id, 'acknowledged');
                setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id));
              }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-text-primary bg-accent hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Acknowledge
            </button>
            <button
              onClick={() => {
                useAlertStore.getState().updateStatus(alert.id, 'resolved');
                setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id));
              }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-text-primary bg-status-ok hover:bg-status-ok/90 transition-colors"
            >
              Resolve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
