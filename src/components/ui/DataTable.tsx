import { useState, type ReactNode } from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import Button from './Button';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyHeading?: string;
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  keyExtractor: (row: T, index: number) => string;
  className?: string;
}

type SortDir = 'asc' | 'desc';

export default function DataTable<T>({
  columns, data, isLoading, emptyHeading = 'No data found', emptyMessage,
  pageSize = 25, onRowClick, rowClassName, keyExtractor, className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) return <LoadingSkeleton variant="table" rows={pageSize > 10 ? 8 : pageSize} />;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="overflow-x-auto rounded-lg border border-border-soft">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-panel-alt text-left text-xs text-text-muted tracking-wide">
              {columns.map(col => (
                <th key={col.key}
                  className={`px-4 py-3 font-medium whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:text-text-secondary' : ''} ${col.headerClassName ?? ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length}>
                <EmptyState heading={emptyHeading} message={emptyMessage} />
              </td></tr>
            ) : paged.map((row, idx) => (
              <tr key={keyExtractor(row, idx)}
                onClick={() => onRowClick?.(row)}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && onRowClick) { e.preventDefault(); onRowClick(row); } }}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                className={`border-t border-border-soft transition-colors
                  ${onRowClick ? 'cursor-pointer hover:bg-panel-alt' : ''}
                  ${rowClassName?.(row) ?? ''}`}>
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-text-secondary ${col.className ?? ''}`}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <span className="px-3 py-1 text-text-primary">Page {page} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      )}
    </div>
  );
}
