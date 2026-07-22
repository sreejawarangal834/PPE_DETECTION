import { lazy, Suspense, useState } from 'react';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import PageShell from '../../components/ui/PageShell';

const DailyReport   = lazy(() => import('./DailyReport'));
const WeeklyReport  = lazy(() => import('./WeeklyReport'));
const MonthlyReport = lazy(() => import('./MonthlyReport'));
const WorkerReport  = lazy(() => import('./WorkerComplianceReport'));
const AdHoc         = lazy(() => import('./AdHocAnalytics'));

const TABS = [
  { id: 'daily',   label: 'Daily'     },
  { id: 'weekly',  label: 'Weekly'    },
  { id: 'monthly', label: 'Monthly'   },
  { id: 'workers', label: 'By Worker' },
  { id: 'adhoc',   label: 'Ad-Hoc'   },
];

export default function ReportsPage() {
  const [tab, setTab] = useState('daily');

  return (
    <PageShell><div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Reports &amp; Analytics</h1>
        <p className="text-sm text-text-muted mt-1">Compliance reports, trends and data exports</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border-soft gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px
              ${tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<LoadingSkeleton variant="chart" />}>
        {tab === 'daily'   && <DailyReport />}
        {tab === 'weekly'  && <WeeklyReport />}
        {tab === 'monthly' && <MonthlyReport />}
        {tab === 'workers' && <WorkerReport />}
        {tab === 'adhoc'   && <AdHoc />}
      </Suspense>
    </div>
    </PageShell>
  );
}
