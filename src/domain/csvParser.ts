import { detectStudentGenderFromName } from './avatarGenerator';
import type { CharacterPresentation, ClassRecord, Student } from './types';

export interface ParsedStudentRow {
  rowNumber: number;
  name: string;
  rollNumber: string;
  className?: string;
  resolvedClassId?: string;
  characterPresentation: CharacterPresentation;
  notes?: string;
  status: 'valid' | 'duplicate_in_file' | 'duplicate_in_class' | 'invalid';
  error?: string;
}

export interface StudentImportPreview {
  rows: ParsedStudentRow[];
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  detectedClasses: string[];
  hasMultipleClasses: boolean;
}

/**
 * RFC-4180 compliant CSV parser for local student & question imports.
 * Also supports semicolon or tab-delimited text files if commas are not used.
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const delimiter =
    commaCount === 0 && tabCount > 0
      ? '\t'
      : commaCount === 0 && semiCount > 0
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++;
        row.push(cell.trim());
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\n') {
        row.push(cell.trim());
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  row.push(cell.trim());
  if (row.some((v) => v.length > 0)) rows.push(row);

  return rows;
}

export function normalizePresentationInput(
  raw?: string,
  fallbackStudentName?: string
): CharacterPresentation {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'masculine' || v === 'boy' || v === 'male' || v === 'm' || v === 'man') {
    return 'masculine';
  }
  if (v === 'feminine' || v === 'girl' || v === 'female' || v === 'f' || v === 'woman') {
    return 'feminine';
  }
  if (v === 'neutral' || v === 'n') return 'neutral';
  if (fallbackStudentName && fallbackStudentName.trim().length > 0) {
    return detectStudentGenderFromName(fallbackStudentName);
  }
  return 'random';
}

export interface ColumnMapping {
  rollCol: number;
  nameCol: number;
  classCol?: number;
  presentationCol: number;
  notesCol: number;
  isMultiColumnClassTable?: boolean;
}

const CLASS_HEADER_VALUE_RE =
  /^(?:class|grade|std|standard|section|form|year|level)\s*[-:#]?\s*([0-9]{1,2}[a-zA-Z]?|[ivxIVX]{1,4}[a-zA-Z]?|[a-zA-Z])$/i;

export function looksLikeClassLabel(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return CLASS_HEADER_VALUE_RE.test(trimmed);
}

/**
 * Normalizes a raw class label from CSV (e.g. "5", "Grade 5", "class 5", "Class 6")
 * into a clean display name (e.g. "Class 5") and matches against existing classes if possible.
 */
export function normalizeClassLabel(
  rawClass: string,
  existingClasses?: readonly ClassRecord[]
): { className: string; matchedClassId?: string } {
  const trimmed = rawClass.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { className: '' };

  let canonical = trimmed;
  if (/^\d{1,2}[a-zA-Z]?$/.test(trimmed)) {
    canonical = `Class ${trimmed.toUpperCase()}`;
  } else {
    const match = trimmed.match(
      /^(?:class|grade|std|standard)\s*[-:#]?\s*(.+)$/i
    );
    if (match?.[1]) {
      canonical = `Class ${match[1].trim()}`;
    }
  }

  if (existingClasses && existingClasses.length > 0) {
    const activeOrAll = existingClasses.filter((c) => !c.archivedAt);
    const pool = activeOrAll.length > 0 ? activeOrAll : existingClasses;
    const exact = pool.find(
      (c) =>
        c.name.trim().toLowerCase() === trimmed.toLowerCase() ||
        c.name.trim().toLowerCase() === canonical.toLowerCase()
    );
    if (exact) {
      return { className: exact.name, matchedClassId: exact.id };
    }
  }

  return { className: canonical };
}

export function guessStudentColumnMapping(
  headers: string[],
  sampleRows?: string[][]
): ColumnMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());

  // 1. Check if the CSV is a multi-column class table where each column header is a class name
  //    e.g. ["Class 5", "Class 6", "Class 7"] with student names listed underneath each column.
  const classHeaderMatches = headers.filter((h) => looksLikeClassLabel(h.trim()));
  const hasExplicitNameOrRollHeader = norm.some((h) =>
    ['name', 'student', 'roll', 'gender', 'sex'].some((kw) => h.includes(kw))
  );
  if (
    headers.length >= 2 &&
    classHeaderMatches.length >= Math.ceil(headers.length * 0.6) &&
    !hasExplicitNameOrRollHeader
  ) {
    return {
      rollCol: -1,
      nameCol: 0,
      classCol: -1,
      presentationCol: -1,
      notesCol: -1,
      isMultiColumnClassTable: true,
    };
  }

  const findIdx = (patterns: string[], excludeIndices: number[] = []): number => {
    return norm.findIndex(
      (h, idx) =>
        !excludeIndices.includes(idx) &&
        patterns.some((p) => {
          if (p === 'no' || p === 'id' || p === 'sn') {
            return (
              h === p ||
              h.startsWith(`${p} `) ||
              h.endsWith(` ${p}`) ||
              h.includes(`${p}.`)
            );
          }
          return h.includes(p);
        })
    );
  };

  let classCol = findIdx([
    'class',
    'grade',
    'standard',
    'std',
    'section',
    'classroom',
    'batch',
  ]);
  const usedCols: number[] = classCol >= 0 ? [classCol] : [];

  let nameCol = findIdx(
    ['student name', 'full name', 'pupil', 'learner', 'name', 'student'],
    usedCols
  );
  if (nameCol >= 0) usedCols.push(nameCol);

  let rollCol = findIdx(
    ['roll', 'r.no', 'rno', 's.n', 'sn', 'serial', 'admission', 'reg', 'number', 'id', 'no'],
    usedCols
  );
  if (rollCol >= 0) usedCols.push(rollCol);

  const presentationCol = findIdx(
    ['gender', 'sex', 'boy', 'girl', 'character', 'presentation', 'avatar', 'style'],
    usedCols
  );
  if (presentationCol >= 0) usedCols.push(presentationCol);

  const notesCol = findIdx(['note', 'remark', 'comment'], usedCols);

  // Content-based fallback when headers are missing or ambiguous
  if (nameCol < 0 || (rollCol < 0 && headers.length >= 2)) {
    const inspectRow =
      sampleRows && sampleRows.length > 0 ? sampleRows[0] : headers;

    if (headers.length === 1) {
      nameCol = 0;
      rollCol = -1;
    } else if (headers.length >= 2) {
      // Check if any column looks like a class label ("Class 5")
      if (classCol < 0) {
        const detectedClassCol = inspectRow.findIndex((cell) =>
          looksLikeClassLabel(cell)
        );
        if (detectedClassCol >= 0 && detectedClassCol !== nameCol && detectedClassCol !== rollCol) {
          classCol = detectedClassCol;
          usedCols.push(classCol);
        }
      }

      if (nameCol < 0) {
        // Pick the first unused column that looks like a person's name (contains letters, not purely numeric)
        const candidateNameCol = inspectRow.findIndex(
          (cell, idx) =>
            !usedCols.includes(idx) &&
            /[a-zA-Z]{2,}/.test(cell) &&
            !looksLikeClassLabel(cell)
        );
        nameCol =
          candidateNameCol >= 0
            ? candidateNameCol
            : [0, 1, 2].find((idx) => !usedCols.includes(idx)) ?? 0;
        usedCols.push(nameCol);
      }

      if (rollCol < 0) {
        // Pick an unused column that looks like a roll number, or fallback to remaining column if 2-col without classCol
        const candidateRollCol = inspectRow.findIndex(
          (cell, idx) =>
            !usedCols.includes(idx) &&
            /^(?:roll\s*[-#:]?\s*)?[a-zA-Z0-9_-]{1,12}$/i.test(cell.trim()) &&
            /\d/.test(cell)
        );
        if (candidateRollCol >= 0) {
          rollCol = candidateRollCol;
        } else if (classCol < 0 && headers.length >= 2) {
          rollCol = nameCol === 0 ? 1 : 0;
        } else {
          rollCol = -1;
        }
      }
    }
  }

  return {
    rollCol,
    nameCol: nameCol >= 0 ? nameCol : 0,
    classCol,
    presentationCol,
    notesCol,
    isMultiColumnClassTable: false,
  };
}

function cleanRollAndName(
  rawRoll: string,
  rawName: string
): { roll: string; name: string } {
  let roll = rawRoll
    .trim()
    .replace(/^(?:roll\s*(?:no\.?|number|#)?|s\.?n\.?|id)\s*[-:#.]?\s*/i, '')
    .replace(/[.)]+$/, '')
    .trim();
  let name = rawName.trim();

  // If roll is empty and the name starts with a numbered prefix like "101. Aarav Sharma" or "1 - Aarav"
  if (!roll && name) {
    const prefixed = name.match(/^(\d{1,6})\s*[.):-]\s+(.+)$/);
    if (prefixed) {
      roll = prefixed[1];
      name = prefixed[2].trim();
    }
  }

  return { roll, name };
}

export function validateStudentImportMatrix(
  matrix: string[][],
  hasHeader: boolean,
  mapping: ColumnMapping,
  existingClassStudents: readonly Student[],
  options?: {
    allClasses?: readonly ClassRecord[];
    allStudents?: readonly Student[];
    defaultClassName?: string;
  }
): StudentImportPreview {
  const allClasses = options?.allClasses ?? [];
  const allStudents = options?.allStudents ?? existingClassStudents;
  const rows: ParsedStudentRow[] = [];
  const detectedClassSet = new Set<string>();

  // Build per-class sets of existing roll numbers
  const existingRollsByClassKey = new Map<string, Set<string>>();
  const maxNumericRollByClassKey = new Map<string, number>();

  const defaultKey = '__target_class__';
  existingRollsByClassKey.set(
    defaultKey,
    new Set(
      existingClassStudents
        .filter((s) => s.activeStatus === 'active')
        .map((s) => s.rollNumber.trim().toLowerCase())
    )
  );
  for (const s of existingClassStudents) {
    if (s.activeStatus !== 'active') continue;
    const n = parseInt(s.rollNumber.trim(), 10);
    if (!Number.isNaN(n)) {
      maxNumericRollByClassKey.set(
        defaultKey,
        Math.max(maxNumericRollByClassKey.get(defaultKey) ?? 0, n)
      );
    }
  }

  if (allClasses.length > 0) {
    for (const cls of allClasses) {
      const clsKey = cls.name.trim().toLowerCase();
      const clsStudents = allStudents.filter(
        (s) => s.classId === cls.id && s.activeStatus === 'active'
      );
      existingRollsByClassKey.set(
        clsKey,
        new Set(clsStudents.map((s) => s.rollNumber.trim().toLowerCase()))
      );
      for (const s of clsStudents) {
        const n = parseInt(s.rollNumber.trim(), 10);
        if (!Number.isNaN(n)) {
          maxNumericRollByClassKey.set(
            clsKey,
            Math.max(maxNumericRollByClassKey.get(clsKey) ?? 0, n)
          );
        }
      }
    }
  }

  const seenInFileByClassKey = new Map<string, Set<string>>();
  const nextAutoRollByClassKey = new Map<string, number>();

  const allocateAutoRoll = (classKey: string): string => {
    const seen = seenInFileByClassKey.get(classKey) ?? new Set<string>();
    const existing = existingRollsByClassKey.get(classKey) ?? new Set<string>();
    let candidate =
      nextAutoRollByClassKey.get(classKey) ??
      (maxNumericRollByClassKey.get(classKey) ?? 0) + 1;
    while (
      seen.has(String(candidate).toLowerCase()) ||
      existing.has(String(candidate).toLowerCase())
    ) {
      candidate++;
    }
    nextAutoRollByClassKey.set(classKey, candidate + 1);
    return String(candidate);
  };

  // Case 1: Multi-column class table (each column header is a class name, cells below are student names)
  if (mapping.isMultiColumnClassTable && matrix.length >= 2) {
    const headerRow = matrix[0];
    let logicalRowNum = 2;
    for (let r = 1; r < matrix.length; r++) {
      const rowCells = matrix[r];
      for (let c = 0; c < headerRow.length; c++) {
        const rawHeaderClass = (headerRow[c] ?? '').trim();
        const rawCell = (rowCells[c] ?? '').trim();
        if (!rawCell || !rawHeaderClass) continue;

        const { className, matchedClassId } = normalizeClassLabel(
          rawHeaderClass,
          allClasses
        );
        const classKey = className ? className.toLowerCase() : defaultKey;
        if (className) detectedClassSet.add(className);

        const { roll: extractedRoll, name } = cleanRollAndName('', rawCell);
        const rollNumber = extractedRoll || allocateAutoRoll(classKey);
        const characterPresentation = normalizePresentationInput('', name);

        const seenSet = seenInFileByClassKey.get(classKey) ?? new Set<string>();
        seenInFileByClassKey.set(classKey, seenSet);
        const existingSet =
          existingRollsByClassKey.get(classKey) ??
          existingRollsByClassKey.get(defaultKey) ??
          new Set<string>();

        const normRoll = rollNumber.toLowerCase();
        let status: ParsedStudentRow['status'] = 'valid';
        let error: string | undefined;

        if (!name) {
          status = 'invalid';
          error = 'Missing student name';
        } else if (seenSet.has(normRoll)) {
          status = 'duplicate_in_file';
          error = `Duplicate roll ${rollNumber} in ${className || 'import file'}`;
        } else {
          seenSet.add(normRoll);
          if (existingSet.has(normRoll)) {
            status = 'duplicate_in_class';
            error = `Roll ${rollNumber} already exists in ${className || 'this class'}`;
          }
        }

        rows.push({
          rowNumber: logicalRowNum++,
          name,
          rollNumber,
          className: className || undefined,
          resolvedClassId: matchedClassId,
          characterPresentation,
          status,
          error,
        });
      }
    }

    return {
      rows,
      validCount: rows.filter((r) => r.status === 'valid').length,
      duplicateCount: rows.filter(
        (r) => r.status === 'duplicate_in_class' || r.status === 'duplicate_in_file'
      ).length,
      invalidCount: rows.filter((r) => r.status === 'invalid').length,
      detectedClasses: Array.from(detectedClassSet),
      hasMultipleClasses: detectedClassSet.size > 0,
    };
  }

  // Case 2: Standard row-based CSV / Excel table
  const startIdx = hasHeader ? 1 : 0;
  let currentSectionClass = options?.defaultClassName ?? '';

  for (let i = startIdx; i < matrix.length; i++) {
    const cells = matrix[i];
    const nonEmptyCells = cells.filter((c) => c.trim().length > 0);
    if (nonEmptyCells.length === 0) continue;

    // Detect single-cell section header row like "Class 6" or "Grade 7"
    if (nonEmptyCells.length === 1 && looksLikeClassLabel(nonEmptyCells[0])) {
      currentSectionClass = nonEmptyCells[0].trim();
      continue;
    }

    // Also skip repeated header rows embedded inside multi-section CSVs
    const rawNameCell = (cells[mapping.nameCol] ?? '').trim();
    const rawRollCell =
      mapping.rollCol >= 0 ? (cells[mapping.rollCol] ?? '').trim() : '';
    if (
      i > startIdx &&
      /^(?:student\s*name|full\s*name|name|student)$/i.test(rawNameCell) &&
      (!rawRollCell || /^(?:roll|roll\s*no|roll\s*number|s\.?n\.?|id)$/i.test(rawRollCell))
    ) {
      continue;
    }

    const rawClassCell =
      mapping.classCol !== undefined && mapping.classCol >= 0
        ? (cells[mapping.classCol] ?? '').trim()
        : currentSectionClass;

    const { className, matchedClassId } = rawClassCell
      ? normalizeClassLabel(rawClassCell, allClasses)
      : { className: '', matchedClassId: undefined };

    const classKey = className ? className.toLowerCase() : defaultKey;
    if (className) detectedClassSet.add(className);

    let { roll: rollNumber, name } = cleanRollAndName(rawRollCell, rawNameCell);

    // If rollCol and nameCol were accidentally mapped to columns where roll has the name and name has the roll
    if (
      rollNumber &&
      name &&
      !/\d/.test(rollNumber) &&
      /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(rollNumber) &&
      /^\d{1,6}$/.test(name)
    ) {
      const temp = rollNumber;
      rollNumber = name;
      name = temp;
    }

    const presentationRaw =
      mapping.presentationCol >= 0 ? cells[mapping.presentationCol] : '';
    const notes =
      mapping.notesCol >= 0 ? (cells[mapping.notesCol] ?? '').trim() : undefined;
    const characterPresentation = normalizePresentationInput(presentationRaw, name);
    const rowNumber = i + 1;

    if (!name && !rollNumber) continue;

    if (!name) {
      rows.push({
        rowNumber,
        name: '',
        rollNumber,
        className: className || undefined,
        resolvedClassId: matchedClassId,
        characterPresentation,
        notes,
        status: 'invalid',
        error: 'Missing student name',
      });
      continue;
    }

    // Auto-generate roll number if no roll column is mapped or if the roll cell is blank
    if (!rollNumber) {
      rollNumber = allocateAutoRoll(classKey);
    }

    if (!rollNumber || !/^[a-zA-Z0-9_./\s-]{1,30}$/.test(rollNumber)) {
      rows.push({
        rowNumber,
        name,
        rollNumber,
        className: className || undefined,
        resolvedClassId: matchedClassId,
        characterPresentation,
        notes,
        status: 'invalid',
        error: 'Invalid or missing roll number',
      });
      continue;
    }

    const seenSet = seenInFileByClassKey.get(classKey) ?? new Set<string>();
    seenInFileByClassKey.set(classKey, seenSet);
    const existingSet =
      existingRollsByClassKey.get(classKey) ??
      (className ? new Set<string>() : existingRollsByClassKey.get(defaultKey)) ??
      new Set<string>();

    const normRoll = rollNumber.toLowerCase();
    if (seenSet.has(normRoll)) {
      rows.push({
        rowNumber,
        name,
        rollNumber,
        className: className || undefined,
        resolvedClassId: matchedClassId,
        characterPresentation,
        notes,
        status: 'duplicate_in_file',
        error: className
          ? `Duplicate roll ${rollNumber} in ${className} within file`
          : `Duplicate roll ${rollNumber} in import file`,
      });
      continue;
    }
    seenSet.add(normRoll);

    if (existingSet.has(normRoll)) {
      rows.push({
        rowNumber,
        name,
        rollNumber,
        className: className || undefined,
        resolvedClassId: matchedClassId,
        characterPresentation,
        notes,
        status: 'duplicate_in_class',
        error: className
          ? `Roll ${rollNumber} already exists in ${className}`
          : `Roll ${rollNumber} already exists in this class`,
      });
      continue;
    }

    rows.push({
      rowNumber,
      name,
      rollNumber,
      className: className || undefined,
      resolvedClassId: matchedClassId,
      characterPresentation,
      notes,
      status: 'valid',
    });
  }

  return {
    rows,
    validCount: rows.filter((r) => r.status === 'valid').length,
    duplicateCount: rows.filter(
      (r) => r.status === 'duplicate_in_class' || r.status === 'duplicate_in_file'
    ).length,
    invalidCount: rows.filter((r) => r.status === 'invalid').length,
    detectedClasses: Array.from(detectedClassSet),
    hasMultipleClasses: detectedClassSet.size > 0,
  };
}
