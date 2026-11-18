export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeCsvCell(value: string | number | undefined | null): string {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(headers: string[], rows: Array<Array<string | number | undefined | null>>): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

export function getSampleStudentCsvTemplate(): string {
  return buildCsvDocument(
    ['Class', 'Roll Number', 'Student Name', 'Gender', 'Notes'],
    [
      ['Class 5', '501', 'Aarav Sharma', 'male', 'Front row'],
      ['Class 5', '502', 'Diya Nair', 'female', ''],
      ['Class 6', '601', 'Bigyan Thapa', 'male', ''],
      ['Class 6', '602', 'Kritika Adhikari', 'female', ''],
      ['Class 7', '701', 'Riya Sen', 'female', ''],
    ]
  );
}
