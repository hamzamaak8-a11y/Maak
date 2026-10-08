import { Platform, Share } from 'react-native';

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

const escapeCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  return [columns.join(','), ...rows.map(r => columns.map(c => escapeCell(r[c])).join(','))].join('\r\n');
}

/** Saves a text file on the web; on native opens the share sheet with the text. */
export async function saveTextFile(filename: string, text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  await Share.share({ message: text, title: filename });
}

export async function copyText(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(text); return; }
  await Share.share({ message: text });
}
