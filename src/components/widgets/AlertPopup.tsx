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
          className="pointer-events-auto bg-[#1B1F27] border border-[#21252D] rounded-2xl p-5 w-[380px] shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300"
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
                <p className="text-sm font-bold text-[#E8EAF0] capitalize">
                  {alert.severity} Alert
                </p>
                <p className="text-xs text-[#9BA3B8] font-mono">
                  {alert.cameraId} · {alert.zoneId}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id))}
              className="text-[#5C6480] hover:text-[#E8EAF0] transition-colors p-1 rounded-lg hover:bg-[#20242D]"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-3">
            <p className="text-sm text-[#E8EAF0] font-medium mb-1">
              Missing PPE: {alert.missingPpe.join(', ')}
            </p>
            <p className="text-xs text-[#9BA3B8]">
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
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-[#E8EAF0] bg-[#4A8FA3] hover:bg-[#4A8FA3]/90 transition-colors flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Acknowledge
            </button>
            <button
              onClick={() => {
                useAlertStore.getState().updateStatus(alert.id, 'resolved');
                setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id));
              }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-[#E8EAF0] bg-[#4F9E7C] hover:bg-[#4F9E7C]/90 transition-colors"
            >
              Resolve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
