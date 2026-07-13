/**
 * printReport
 * -----------
 * Injects HTML content into a hidden iframe and prints only that iframe.
 * This is the most reliable way to print a specific section from a React app
 * without the app's CSS or DOM interfering with the print preview.
 *
 * @param html  - Full HTML string to print (no <html>/<body> wrapper needed)
 * @param title - Document title shown in the print dialog header
 */
export function printReport(html: string, title = 'Report'): void {
  // Remove any existing print iframe
  const existing = document.getElementById('__print_frame__');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__print_frame__';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', Arial, sans-serif;
      font-size: 12pt;
      color: #111827;
      background: #fff;
      padding: 0;
    }
    @page { size: A4; margin: 12mm 10mm; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 7px 10px; border: 1px solid #E5E7EB; font-size: 11pt; }
    th { background: #F3F4F6; font-weight: 600; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.04em; color: #6B7280; }
    h1 { font-size: 20pt; font-weight: 700; }
    h2 { font-size: 13pt; font-weight: 700; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #E5E7EB; page-break-after: avoid; }
    p  { margin: 0 0 4px; }
    .page-break { page-break-before: always; }
    .alert-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .alert-card { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
    .alert-card-header { padding: 7px 12px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; }
    .alert-card-body { padding: 10px 12px; font-size: 10pt; }
    .snapshot { width: 100%; height: 140px; background: #1a1d23; border-radius: 5px; margin-bottom: 8px; overflow: hidden; }
    .status-pill { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin-top: 6px; font-size: 10pt; color: #374151; }
    .meta-grid span { color: #6B7280; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; font-size: 9pt; color: #9CA3AF; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-card { border: 1px solid #E5E7EB; border-radius: 7px; padding: 12px 14px; background: #F9FAFB; }
    .kpi-label { font-size: 9pt; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
    .kpi-value { font-size: 22pt; font-weight: 700; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #1B1F27; }
    .header-meta { font-size: 10pt; color: #6B7280; text-align: right; line-height: 1.6; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `);
  doc.close();

  // Wait for fonts to load before printing
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Cleanup after print dialog closes
      const cleanup = () => {
        setTimeout(() => iframe.remove(), 500);
        iframe.contentWindow?.removeEventListener('afterprint', cleanup);
      };
      iframe.contentWindow?.addEventListener('afterprint', cleanup);
    }, 250);
  };
}
