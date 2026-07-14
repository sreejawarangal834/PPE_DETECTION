import type { ReactNode } from 'react';
import { SITE_NAME } from '../constants/app';
import { formatDate } from '../lib/utils';

interface PrintLayoutProps {
  children: ReactNode;
  reportTitle: string;
  generatedBy?: string;
  filterSummary?: string;
}

export default function PrintLayout({ children, reportTitle, generatedBy, filterSummary }: PrintLayoutProps) {
  return (
    <div className="print-only p-8 bg-white text-black font-sans text-sm">
      <div className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{SITE_NAME}</p>
        <h1 className="text-xl font-bold text-gray-900">{reportTitle}</h1>
        <div className="mt-2 flex gap-6 text-xs text-gray-600">
          <span>Generated: {formatDate(Date.now())}</span>
          {generatedBy && <span>By: {generatedBy}</span>}
          {filterSummary && <span>Filters: {filterSummary}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}
