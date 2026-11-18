import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Layers, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  guessStudentColumnMapping,
  looksLikeClassLabel,
  parseCsvMatrix,
  validateStudentImportMatrix,
  type ColumnMapping,
  type ParsedStudentRow,
} from '../domain/csvParser';
import type { ClassRecord, Student } from '../domain/types';
import { downloadTextFile, getSampleStudentCsvTemplate } from '../services/exportService';

export type ImportDuplicateAction = 'update' | 'replace_class' | 'skip';

interface ImportStudentsModalProps {
  open: boolean;
  classes: ClassRecord[];
  defaultClassId: string;
  existingStudents: Student[];
  onImportConfirm: (
    targetClassId: string,
    rowsToImport: ParsedStudentRow[],
    duplicateAction: ImportDuplicateAction,
    useFileClasses: boolean
  ) => Promise<{ imported: number; updated: number; skipped: number; createdClasses: number }>;
  onClose: () => void;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  open,
  classes,
  defaultClassId,
  existingStudents,
  onImportConfirm,
  onClose,
}) => {
  const activeClasses = useMemo(
    () => classes.filter((c) => !c.archivedAt),
    [classes]
  );
  const [targetClassId, setTargetClassId] = useState(
    defaultClassId || activeClasses[0]?.id || classes[0]?.id || ''
  );
  const [useFileClasses, setUseFileClasses] = useState(true);
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({
    rollCol: 0,
    nameCol: 1,
    classCol: -1,
    presentationCol: 2,
    notesCol: 3,
    isMultiColumnClassTable: false,
  });
  const [duplicateAction, setDuplicateAction] =
    useState<ImportDuplicateAction>('update');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const selectedClassRecord = useMemo(
    () => classes.find((c) => c.id === targetClassId) ?? activeClasses[0] ?? classes[0],
    [classes, activeClasses, targetClassId]
  );

  const classStudents = useMemo(
    () => existingStudents.filter((s) => s.classId === (selectedClassRecord?.id ?? targetClassId)),
    [existingStudents, selectedClassRecord, targetClassId]
  );

  const effectiveMapping = useMemo<ColumnMapping>(() => {
    if (!useFileClasses) {
      return {
        ...mapping,
        classCol: -1,
        isMultiColumnClassTable: false,
      };
    }
    return mapping;
  }, [mapping, useFileClasses]);

  const preview = useMemo(() => {
    if (matrix.length === 0) return null;
    return validateStudentImportMatrix(matrix, hasHeader, effectiveMapping, classStudents, {
      allClasses: classes,
      allStudents: existingStudents,
    });
  }, [matrix, hasHeader, effectiveMapping, classStudents, classes, existingStudents]);

  const actionableCount = useMemo(() => {
    if (!preview) return 0;
    if (duplicateAction === 'skip') {
      return preview.validCount;
    }
    return preview.validCount + preview.duplicateCount;
  }, [preview, duplicateAction]);

  if (!open) return null;

  const handleFileUpload = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let parsed: string[][] = [];

      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseCsvMatrix(text);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        if (workbook.SheetNames.length === 0) {
          throw new Error('The spreadsheet contains no sheets.');
        }

        if (workbook.SheetNames.length === 1) {
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: '',
          });
          parsed = rawRows
            .map((r) => r.map((cell) => String(cell ?? '').trim()))
            .filter((r) => r.some((c) => c.length > 0));
          // If the single sheet name looks like a class label (e.g. "Class 6"), prepend it as a section header if no class column exists
          if (looksLikeClassLabel(firstSheet) && parsed.length > 0) {
            const guessed = guessStudentColumnMapping(parsed[0], parsed.slice(1, 5));
            if ((guessed.classCol ?? -1) < 0 && !guessed.isMultiColumnClassTable) {
              parsed = [parsed[0], [firstSheet], ...parsed.slice(1)];
            }
          }
        } else {
          // Multi-sheet workbook: combine sheets and tag each section with the sheet name as the class name
          const combined: string[][] = [];
          let addedHeader = false;
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
              header: 1,
              defval: '',
            });
            const cleaned = rawRows
              .map((r) => r.map((cell) => String(cell ?? '').trim()))
              .filter((r) => r.some((c) => c.length > 0));
            if (cleaned.length === 0) continue;

            if (!addedHeader) {
              combined.push(cleaned[0]);
              addedHeader = true;
            }
            combined.push([sheetName.trim()]);
            combined.push(...cleaned.slice(1));
          }
          parsed = combined;
        }
      } else {
        throw new Error('Please choose a .csv, .xlsx, or .xls file.');
      }

      if (parsed.length === 0) {
        throw new Error('No rows found in the selected file.');
      }

      const guessed = guessStudentColumnMapping(parsed[0], parsed.slice(1, 6));
      setMatrix(parsed);
      setMapping(guessed);
      setUseFileClasses(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse spreadsheet.');
      setMatrix([]);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const effectiveTargetClassId =
        selectedClassRecord?.id || targetClassId || classes[0]?.id || '';
      await onImportConfirm(
        effectiveTargetClassId,
        preview.rows,
        duplicateAction,
        useFileClasses
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const colCount = matrix[0]?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="import-modal-title"
            className="text-xl font-display font-semibold text-[var(--ink)]"
          >
            Import Students (Single Class or All-Classes CSV / Excel)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Upload a single-class roster or an all-students CSV/Excel file with multiple classes. Classes, roll numbers, and 3D Male/Female characters are detected automatically.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="imp-class"
              className="block text-xs font-semibold text-[var(--ink)] mb-1"
            >
              Default / Fallback Class (when row has no Class column)
            </label>
            <select
              id="imp-class"
              value={selectedClassRecord?.id ?? targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            >
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                'classroom-all-students-template.csv',
                getSampleStudentCsvTemplate(),
                'text/csv;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Multi-Class CSV Template
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{fileName ? 'Change File' : 'Choose CSV / Excel'}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </label>
        </div>

        {fileName && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
            <div>
              Selected file:{' '}
              <span className="font-semibold text-[var(--ink)]">{fileName}</span>
            </div>
            {preview && preview.detectedClasses.length > 0 && useFileClasses && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] font-semibold">
                <Layers className="w-3.5 h-3.5" />
                <span>
                  Detected {preview.detectedClasses.length} Class
                  {preview.detectedClasses.length === 1 ? '' : 'es'}:{' '}
                  {preview.detectedClasses.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {matrix.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--ink)]">
                  Column &amp; Class Mapping
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useFileClasses}
                      onChange={(e) => setUseFileClasses(e.target.checked)}
                      className="rounded"
                    />
                    Auto-assign students to classes from file
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        mapping.isMultiColumnClassTable ?? false
                      }
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          isMultiColumnClassTable: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    Each column is a Class (Side-by-Side)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                      className="rounded"
                    />
                    First row is header
                  </label>
                </div>
              </div>

              {!mapping.isMultiColumnClassTable && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">
                      Class / Grade
                    </label>
                    <select
                      value={useFileClasses ? (mapping.classCol ?? -1) : -1}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setUseFileClasses(val >= 0 || useFileClasses);
                        setMapping({ ...mapping, classCol: val });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
                    >
                      <option value={-1}>
                        Use Default ({selectedClassRecord?.name ?? 'Selected Class'})
                      </option>
                      {Array.from({ length: colCount }, (_, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {matrix[0][idx] || '(empty)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">
                      Roll Number
                    </label>
                    <select
                      value={mapping.rollCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, rollCol: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
                    >
                      <option value={-1}>Auto-Generate (1, 2, 3...)</option>
                      {Array.from({ length: colCount }, (_, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {matrix[0][idx] || '(empty)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">
                      Student Name
                    </label>
                    <select
                      value={mapping.nameCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, nameCol: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
                    >
                      {Array.from({ length: colCount }, (_, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {matrix[0][idx] || '(empty)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">
                      Gender / 3D Style
                    </label>
                    <select
                      value={mapping.presentationCol}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          presentationCol: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
                    >
                      <option value={-1}>Auto-Detect from Name</option>
                      {Array.from({ length: colCount }, (_, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {matrix[0][idx] || '(empty)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">
                      Notes
                    </label>
                    <select
                      value={mapping.notesCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, notesCol: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
                    >
                      <option value={-1}>None</option>
                      {Array.from({ length: colCount }, (_, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {matrix[0][idx] || '(empty)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {preview && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular">
                    <span className="text-[var(--sage)] font-semibold">
                      New / Ready: {preview.validCount}
                    </span>
                    <span className="text-[var(--ink-muted)]">·</span>
                    <span className="text-[var(--gold)] font-semibold">
                      Existing / Same Roll: {preview.duplicateCount}
                    </span>
                    <span className="text-[var(--ink-muted)]">·</span>
                    <span className="text-[var(--crimson)] font-semibold">
                      Invalid: {preview.invalidCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--ink-muted)] font-medium">
                      When roll/class already exists:
                    </span>
                    <select
                      value={duplicateAction}
                      onChange={(e) =>
                        setDuplicateAction(e.target.value as ImportDuplicateAction)
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)]"
                    >
                      <option value="update">
                        Update existing &amp; auto-number duplicate rolls (Import All)
                      </option>
                      <option value="replace_class">
                        Replace existing roster in matched classes with this file
                      </option>
                      <option value="skip">Skip duplicate roll numbers</option>
                    </select>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--surface-subtle)] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Class</th>
                        <th className="py-2 px-3">Roll</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3">3D Character</th>
                        <th className="py-2 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {preview.rows.map((r, idx) => {
                        const displayClass =
                          (useFileClasses && r.className) ||
                          selectedClassRecord?.name ||
                          'Class';
                        const genderText =
                          r.characterPresentation === 'feminine'
                            ? 'Female (3D Girl)'
                            : r.characterPresentation === 'masculine'
                            ? 'Male (3D Boy)'
                            : r.characterPresentation;
                        return (
                          <tr key={`${r.rowNumber}_${idx}`}>
                            <td className="py-2 px-3 font-mono-tabular">
                              {r.rowNumber}
                            </td>
                            <td className="py-2 px-3 font-medium text-[var(--ink)]">
                              {displayClass}
                            </td>
                            <td className="py-2 px-3 font-mono-tabular">
                              {r.rollNumber || 'Auto'}
                            </td>
                            <td className="py-2 px-3 font-medium text-[var(--ink)]">
                              {r.name || '—'}
                            </td>
                            <td className="py-2 px-3">{genderText}</td>
                            <td className="py-2 px-3">
                              {r.status === 'valid' ? (
                                <span className="inline-flex items-center gap-1 text-[var(--sage)] font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Ready to Import
                                </span>
                              ) : r.status === 'invalid' ? (
                                <span className="text-[var(--crimson)]">
                                  {r.error}
                                </span>
                              ) : duplicateAction === 'skip' ? (
                                <span className="text-[var(--gold)]">
                                  Skipped ({r.error})
                                </span>
                              ) : duplicateAction === 'replace_class' ? (
                                <span className="text-[var(--sage)] font-semibold">
                                  Will Replace in {displayClass}
                                </span>
                              ) : r.status === 'duplicate_in_class' ? (
                                <span className="text-[var(--accent)] font-semibold">
                                  Will Update in {displayClass}
                                </span>
                              ) : (
                                <span className="text-[var(--accent)] font-semibold">
                                  Will Auto-Assign Roll in {displayClass}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importing || !preview || actionableCount === 0}
            onClick={handleImport}
            className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {importing
              ? 'Importing...'
              : `Import ${actionableCount} Student${actionableCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
