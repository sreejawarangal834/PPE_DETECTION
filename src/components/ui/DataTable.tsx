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
  const [page, setPage]       = useState(1);

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
  const paged      = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) return <LoadingSkeleton variant="table" rows={pageSize > 10 ? 8 : pageSize} />;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Table container */}
      <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-panel-alt border-b border-border-soft text-left">
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`
                      px-5 py-3.5 text-xs font-semibold uppercase tracking-wider
                      text-text-muted whitespace-nowrap select-none
                      ${col.sortable ? 'cursor-pointer hover:text-text-secondary' : ''}
                      ${col.headerClassName ?? ''}
                    `}
                  >
                    <span className="flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && sortKey === col.key && (
                        <span className="text-accent text-sm">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState heading={emptyHeading} message={emptyMessage} />
                  </td>
                </tr>
              ) : paged.map((row, idx) => (
                <tr
                  key={keyExtractor(row, idx)}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={`
                    border-b border-border-soft last:border-0 transition-colors duration-150
                    ${onRowClick ? 'cursor-pointer hover:bg-panel-hover' : 'hover:bg-panel-hover/50'}
                    ${rowClassName?.(row) ?? ''}
                  `}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-5 py-3.5 text-sm text-text-primary ${col.className ?? ''}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted px-1">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <span className="px-3 py-1 text-text-secondary">
              Page {page} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      )}
    </div>
  );
}
