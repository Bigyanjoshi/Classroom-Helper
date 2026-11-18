import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Camera,
  CheckSquare,
  Edit2,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  applyCharacterArchetype,
  CHARACTER_ARCHETYPES,
  detectStudentGenderFromName,
  getClassroomMascotOption,
  randomizeStyleKeepingSkinTone,
  UNIFORM_CARTOON_TONE,
  type CharacterArchetypeId,
} from '../domain/avatarGenerator';
import { sortStudentsNaturally } from '../domain/random';
import type {
  AvatarConfig,
  CharacterPresentation,
  ClassRecord,
  Student,
} from '../domain/types';
import { StudentAvatar } from '../components/StudentAvatar';
import { ConfirmDialog } from '../components/ConfirmDialog';

export interface BulkStudentUpdateItem {
  id: string;
  name: string;
  rollNumber: string;
  classId: string;
  characterPresentation: CharacterPresentation;
  avatarConfig: AvatarConfig;
  notes?: string;
  activeStatus?: 'active' | 'archived';
}

interface StudentsPageProps {
  classes: ClassRecord[];
  students: Student[];
  selectedClassId: string;
  onSelectClassFilter: (classId: string) => void;
  onAddStudent: () => void;
  onImportStudents: () => void;
  onEditStudent: (student: Student) => void;
  onUploadPhotoForStudent: (student?: Student) => void;
  onArchiveToggle: (student: Student) => Promise<void>;
  onDeleteStudent: (student: Student) => Promise<void>;
  onBulkDeleteStudents: (studentIds: string[]) => Promise<void>;
  onBulkUpdateStudents: (updates: BulkStudentUpdateItem[]) => Promise<void>;
}

function describeAvatarSource(stu: Student): string {
  if (stu.avatarSource === 'photo') {
    return stu.originalPhotoBlobId ? 'Local photo (original kept)' : 'Local photo avatar';
  }
  const kind = stu.avatarConfig.avatarKind ?? 'human';
  if (kind === 'mascot') {
    return `Mascot · ${getClassroomMascotOption(stu.avatarConfig.mascotId).label}`;
  }
  const isFemale =
    stu.avatarConfig.presentation === 'feminine' || stu.characterPresentation === 'feminine';
  const isMale =
    stu.avatarConfig.presentation === 'masculine' || stu.characterPresentation === 'masculine';
  if (isFemale) return '3D Girl Character';
  if (isMale) return '3D Boy Character';
  return '3D Student Character';
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  classes,
  students,
  selectedClassId,
  onSelectClassFilter,
  onAddStudent,
  onImportStudents,
  onEditStudent,
  onUploadPhotoForStudent,
  onArchiveToggle,
  onDeleteStudent,
  onBulkDeleteStudents,
  onBulkUpdateStudents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  // Multi-student editor modal state
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditTab, setBulkEditTab] = useState<'table' | 'batch'>('table');
  const [draftRows, setDraftRows] = useState<BulkStudentUpdateItem[]>([]);
  const [batchClassId, setBatchClassId] = useState<string>('');
  const [batchGender, setBatchGender] = useState<
    'keep' | 'auto' | 'masculine' | 'feminine' | 'neutral'
  >('keep');
  const [batchArchetype, setBatchArchetype] = useState<CharacterArchetypeId | ''>('');
  const [batchNotesMode, setBatchNotesMode] = useState<'keep' | 'set' | 'clear'>('keep');
  const [batchNotesText, setBatchNotesText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const activeClasses = useMemo(
    () => classes.filter((c) => !c.archivedAt),
    [classes]
  );
  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c.name])),
    [classes]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = students
      .filter((s) => (selectedClassId === 'all' ? true : s.classId === selectedClassId))
      .filter((s) =>
        showArchived ? s.activeStatus === 'archived' : s.activeStatus === 'active'
      )
      .filter((s) => {
        if (!q) return true;
        const clsName = (classMap.get(s.classId) ?? '').toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q) ||
          clsName.includes(q)
        );
      });
    return sortStudentsNaturally(list);
  }, [students, selectedClassId, showArchived, searchQuery, classMap]);

  // Prune selectedIds if students are deleted or no longer exist
  useEffect(() => {
    const validIds = new Set(students.map((s) => s.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [students]);

  const visibleIds = useMemo(
    () => filteredStudents.map((s) => s.id),
    [filteredStudents]
  );
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds]
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const toggleSelectOne = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const selectedStudentsList = useMemo(
    () => sortStudentsNaturally(students.filter((s) => selectedIds.has(s.id))),
    [students, selectedIds]
  );

  const openBulkEditor = (targetStudents?: Student[]) => {
    const listToEdit =
      targetStudents && targetStudents.length > 0
        ? targetStudents
        : selectedStudentsList.length > 0
        ? selectedStudentsList
        : filteredStudents;

    if (listToEdit.length === 0) return;

    if (selectedIds.size === 0) {
      setSelectedIds(new Set(listToEdit.map((s) => s.id)));
    }

    setBulkError(null);
    setBulkEditTab('table');
    setBatchClassId('');
    setBatchGender('keep');
    setBatchArchetype('');
    setBatchNotesMode('keep');
    setBatchNotesText('');
    setDraftRows(
      listToEdit.map((s) => ({
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        classId: s.classId,
        characterPresentation:
          s.characterPresentation === 'random'
            ? detectStudentGenderFromName(s.name)
            : s.characterPresentation,
        avatarConfig: {
          ...s.avatarConfig,
          avatarKind: s.avatarConfig.avatarKind ?? 'human',
        },
        notes: s.notes ?? '',
        activeStatus: s.activeStatus,
      }))
    );
    setBulkEditOpen(true);
  };

  const handleDraftRowChange = (
    index: number,
    patch: Partial<BulkStudentUpdateItem>
  ) => {
    setDraftRows((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      const updated = { ...current, ...patch };

      // If name changed and presentation wasn't manually locked, or if characterPresentation changed, keep 3D character synced
      if (patch.characterPresentation && patch.characterPresentation !== current.characterPresentation) {
        const resolved =
          patch.characterPresentation === 'random'
            ? detectStudentGenderFromName(updated.name)
            : patch.characterPresentation;
        updated.characterPresentation = resolved;
        updated.avatarConfig = randomizeStyleKeepingSkinTone(
          { ...updated.avatarConfig, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
          resolved,
          undefined,
          updated.name
        );
      }

      next[index] = updated;
      return next;
    });
  };

  const handleAutoNumberDraftRolls = () => {
    setDraftRows((prev) => {
      const countersByClass = new Map<string, number>();
      return prev.map((row) => {
        const nextNum = (countersByClass.get(row.classId) ?? 0) + 1;
        countersByClass.set(row.classId, nextNum);
        return {
          ...row,
          rollNumber: String(nextNum),
        };
      });
    });
  };

  const handleAutoDetectAllDraftGenders = () => {
    setDraftRows((prev) =>
      prev.map((row) => {
        const detected = detectStudentGenderFromName(row.name);
        return {
          ...row,
          characterPresentation: detected,
          avatarConfig: randomizeStyleKeepingSkinTone(
            { ...row.avatarConfig, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
            detected,
            undefined,
            row.name
          ),
        };
      })
    );
  };

  const handleSurpriseAllDraft3D = () => {
    setDraftRows((prev) =>
      prev.map((row) => ({
        ...row,
        avatarConfig: randomizeStyleKeepingSkinTone(
          { ...row.avatarConfig, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
          row.characterPresentation,
          undefined,
          row.name
        ),
      }))
    );
  };

  const handleSaveBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);

    let finalRows = [...draftRows];

    if (bulkEditTab === 'batch') {
      finalRows = finalRows.map((row) => {
        const nextClassId = batchClassId || row.classId;
        let nextPres = row.characterPresentation;
        let nextAvatar = row.avatarConfig;

        if (batchGender !== 'keep') {
          nextPres =
            batchGender === 'auto'
              ? detectStudentGenderFromName(row.name)
              : batchGender;
          nextAvatar = randomizeStyleKeepingSkinTone(
            { ...nextAvatar, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
            nextPres,
            undefined,
            row.name
          );
        }

        if (batchArchetype) {
          nextAvatar = applyCharacterArchetype(
            nextAvatar,
            batchArchetype,
            nextPres,
            row.name
          );
        }

        const nextNotes =
          batchNotesMode === 'keep'
            ? row.notes
            : batchNotesMode === 'clear'
            ? ''
            : batchNotesText.trim();

        return {
          ...row,
          classId: nextClassId,
          characterPresentation: nextPres,
          avatarConfig: nextAvatar,
          notes: nextNotes,
        };
      });
    }

    // Validate that no row has an empty name or roll number
    for (let i = 0; i < finalRows.length; i++) {
      const r = finalRows[i];
      if (!r.name.trim()) {
        setBulkError(`Row ${i + 1}: Student name cannot be empty.`);
        return;
      }
      if (!r.rollNumber.trim()) {
        setBulkError(`Row ${i + 1} (${r.name}): Roll number cannot be empty.`);
        return;
      }
    }

    setBulkSaving(true);
    try {
      await onBulkUpdateStudents(
        finalRows.map((r) => ({
          ...r,
          name: r.name.trim(),
          rollNumber: r.rollNumber.trim(),
          notes: r.notes?.trim() || undefined,
        }))
      );
      setBulkEditOpen(false);
    } catch (err) {
      setBulkError(
        err instanceof Error ? err.message : 'Could not save bulk student updates.'
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkArchiveOrRestore = async (targetStatus: 'active' | 'archived') => {
    if (selectedStudentsList.length === 0) return;
    await onBulkUpdateStudents(
      selectedStudentsList.map((s) => ({
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        classId: s.classId,
        characterPresentation: s.characterPresentation,
        avatarConfig: s.avatarConfig,
        notes: s.notes,
        activeStatus: targetStatus,
      }))
    );
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--ink)]">
          Students
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddStudent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs sm:text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </button>
          <button
            type="button"
            onClick={onImportStudents}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          {filteredStudents.length > 0 && (
            <button
              type="button"
              onClick={() => openBulkEditor()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap"
            >
              <Edit2 className="w-4 h-4" />
              {selectedIds.size > 0
                ? `Edit (${selectedIds.size})`
                : `Bulk Edit (${filteredStudents.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => onUploadPhotoForStudent()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            Photo
          </button>
        </div>
      </div>

      {/* Filters & Quick Select Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter roster by class"
            value={selectedClassId}
            onChange={(e) => onSelectClassFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
          >
            <option value="all">All Classes ({students.filter((s) => s.activeStatus === 'active').length})</option>
            {activeClasses.map((c) => {
              const cnt = students.filter(
                (s) => s.classId === c.id && s.activeStatus === 'active'
              ).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({cnt})
                </option>
              );
            })}
          </select>

          {filteredStudents.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                allVisibleSelected
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                  : 'border-[var(--border-hairline)] bg-[var(--canvas)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              {allVisibleSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              )}
              <span>
                {allVisibleSelected
                  ? `Deselect Visible (${visibleIds.length})`
                  : `Select All (${visibleIds.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
              showArchived
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                : 'border-[var(--border-hairline)] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]'
            }`}
          >
            {showArchived ? 'Viewing Archived' : 'Show Archived'}
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, roll, or class..."
            aria-label="Search students"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
          />
        </div>
      </div>

      {/* Multi-Select Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions for selected students"
          className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--accent-soft)]/85 border border-[var(--accent)]/40 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold">
              <Users className="w-3.5 h-3.5" />
              {selectedIds.size} Student{selectedIds.size === 1 ? '' : 's'} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] underline cursor-pointer"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openBulkEditor(selectedStudentsList)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] hover:bg-[var(--canvas)] text-xs font-semibold text-[var(--ink)] cursor-pointer shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              Edit Selected ({selectedIds.size})
            </button>

            <button
              type="button"
              onClick={() =>
                handleBulkArchiveOrRestore(showArchived ? 'active' : 'archived')
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] hover:bg-[var(--canvas)] text-xs font-semibold text-[var(--ink)] cursor-pointer shadow-2xs"
            >
              {showArchived ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore Selected ({selectedIds.size})
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  Archive Selected ({selectedIds.size})
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setConfirmBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--crimson)] hover:opacity-95 text-xs font-semibold text-white cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] text-center text-sm text-[var(--ink-muted)]">
          No students match the current filter.
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--ink-muted)]">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all visible students"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Student</th>
                  <th className="py-3 px-4 font-semibold">Roll</th>
                  <th className="py-3 px-4 font-semibold">Class</th>
                  <th className="py-3 px-4 font-semibold">3D Character</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredStudents.map((stu) => {
                  const isSelected = selectedIds.has(stu.id);
                  return (
                    <tr
                      key={stu.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-soft)]/35 hover:bg-[var(--accent-soft)]/50'
                          : 'hover:bg-[var(--surface-subtle)]/45'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${stu.name}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(stu.id)}
                          className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            student={stu}
                            sizeVariant="thumb"
                            className="w-10 h-10 shrink-0 rounded-xl"
                          />
                          <div>
                            <div className="font-semibold text-[var(--ink)]">
                              {stu.name}
                            </div>
                            {stu.notes && (
                              <div className="text-xs text-[var(--ink-muted)]">
                                {stu.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular font-medium text-[var(--ink)]">
                        {stu.rollNumber}
                      </td>
                      <td className="py-3 px-4 text-[var(--ink-muted)]">
                        {classMap.get(stu.classId) ?? 'Class'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--ink-muted)]">
                        {describeAvatarSource(stu)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onUploadPhotoForStudent(stu)}
                            aria-label={`Replace photo for ${stu.name}`}
                            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] cursor-pointer"
                            title="Upload / Replace Photo"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditStudent(stu)}
                            aria-label={`Edit ${stu.name}`}
                            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] cursor-pointer"
                            title="Edit or Transfer Class"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveToggle(stu)}
                            aria-label={
                              stu.activeStatus === 'archived'
                                ? `Restore ${stu.name}`
                                : `Archive ${stu.name}`
                            }
                            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] cursor-pointer"
                            title={
                              stu.activeStatus === 'archived'
                                ? 'Restore to Active'
                                : 'Archive Student'
                            }
                          >
                            {stu.activeStatus === 'archived' ? (
                              <RotateCcw className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(stu)}
                            aria-label={`Delete ${stu.name}`}
                            className="p-2 rounded-lg text-[var(--crimson)] hover:bg-[var(--crimson-soft)] cursor-pointer"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-Student Bulk Edit Modal (Spreadsheet Multi-Row + Batch Apply) */}
      {bulkEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-edit-modal-title"
        >
          <div className="w-full max-w-5xl rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="bulk-edit-modal-title"
                  className="text-xl font-display font-semibold text-[var(--ink)]"
                >
                  Bulk Edit {draftRows.length} Student{draftRows.length === 1 ? '' : 's'} at Once
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Edit multiple students side-by-side in one table or apply batch changes (Class, Male/Female 3D Character, Notes) to all selected students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkEditOpen(false)}
                aria-label="Close bulk editor"
                className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
              <div className="inline-flex p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] gap-1">
                <button
                  type="button"
                  onClick={() => setBulkEditTab('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    bulkEditTab === 'table'
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Multi-Row Table Editor ({draftRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkEditTab('batch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    bulkEditTab === 'batch'
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Batch Apply to All ({draftRows.length})
                </button>
              </div>

              {bulkEditTab === 'table' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoNumberDraftRolls}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--canvas)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Auto-Number Rolls (1..N)
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoDetectAllDraftGenders}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--canvas)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Auto-Detect All Male/Female from Names
                  </button>
                  <button
                    type="button"
                    onClick={handleSurpriseAllDraft3D}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--canvas)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Refresh All 3D Styles
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveBulkEdit} className="mt-4 space-y-4">
              {bulkEditTab === 'table' ? (
                <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--surface-subtle)] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-14">3D</th>
                        <th className="py-2.5 px-3 w-28">Roll No.</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Student Name</th>
                        <th className="py-2.5 px-3 w-40">Class</th>
                        <th className="py-2.5 px-3 w-44">Gender / 3D Character</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Teacher Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {draftRows.map((row, idx) => {
                        const previewStu: Student = {
                          id: row.id,
                          classId: row.classId,
                          name: row.name,
                          rollNumber: row.rollNumber,
                          characterPresentation: row.characterPresentation,
                          avatarSource: 'generated',
                          avatarConfig: row.avatarConfig,
                          activeStatus: row.activeStatus ?? 'active',
                          createdAt: 0,
                          updatedAt: 0,
                        };
                        return (
                          <tr key={row.id} className="hover:bg-[var(--surface-subtle)]/35">
                            <td className="py-2 px-3">
                              <StudentAvatar
                                student={previewStu}
                                sizeVariant="thumb"
                                className="w-9 h-9 rounded-lg"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.rollNumber}
                                aria-label={`Roll number for row ${idx + 1}`}
                                onChange={(e) =>
                                  handleDraftRowChange(idx, {
                                    rollNumber: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] font-mono-tabular text-xs text-[var(--ink)]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.name}
                                aria-label={`Student name for row ${idx + 1}`}
                                onChange={(e) =>
                                  handleDraftRowChange(idx, {
                                    name: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={row.classId}
                                aria-label={`Class for ${row.name}`}
                                onChange={(e) =>
                                  handleDraftRowChange(idx, {
                                    classId: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink)]"
                              >
                                {activeClasses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={row.characterPresentation}
                                aria-label={`Gender for ${row.name}`}
                                onChange={(e) =>
                                  handleDraftRowChange(idx, {
                                    characterPresentation: e.target
                                      .value as CharacterPresentation,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink)]"
                              >
                                <option value="masculine">Male (3D Boy)</option>
                                <option value="feminine">Female (3D Girl)</option>
                                <option value="neutral">Neutral 3D</option>
                                <option value="random">Auto from Name</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.notes ?? ''}
                                aria-label={`Notes for ${row.name}`}
                                placeholder="Optional note..."
                                onChange={(e) =>
                                  handleDraftRowChange(idx, {
                                    notes: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink)]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Transfer / Move All {draftRows.length} Selected Students to Class
                      </label>
                      <select
                        value={batchClassId}
                        onChange={(e) => setBatchClassId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                      >
                        <option value="">Keep each student’s current class</option>
                        {activeClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            Move all to {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Set Gender &amp; 3D Character Type for All Selected
                      </label>
                      <select
                        value={batchGender}
                        onChange={(e) =>
                          setBatchGender(
                            e.target.value as
                              | 'keep'
                              | 'auto'
                              | 'masculine'
                              | 'feminine'
                              | 'neutral'
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                      >
                        <option value="keep">Keep current 3D characters</option>
                        <option value="auto">
                          Auto-Detect Male/Female from each student’s name
                        </option>
                        <option value="masculine">Set all selected to Male (3D Boy)</option>
                        <option value="feminine">Set all selected to Female (3D Girl)</option>
                        <option value="neutral">Set all selected to Neutral 3D</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Apply 3D Student Archetype Theme to All Selected (Optional)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setBatchArchetype('')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          batchArchetype === ''
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                            : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink-muted)]'
                        }`}
                      >
                        Keep Varied Styles
                      </button>
                      {CHARACTER_ARCHETYPES.map((arch) => (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => setBatchArchetype(arch.id)}
                          className={`px-3 py-2 rounded-lg border text-left cursor-pointer ${
                            batchArchetype === arch.id
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                              : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink)]'
                          }`}
                        >
                          <div className="text-xs font-semibold">{arch.label}</div>
                          <div className="text-[10px] text-[var(--ink-muted)] truncate">
                            {arch.badge}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-hairline)]">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Teacher Notes Action
                      </label>
                      <select
                        value={batchNotesMode}
                        onChange={(e) =>
                          setBatchNotesMode(
                            e.target.value as 'keep' | 'set' | 'clear'
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                      >
                        <option value="keep">Keep existing notes</option>
                        <option value="set">Set note for all selected students</option>
                        <option value="clear">Clear notes for all selected students</option>
                      </select>
                    </div>

                    {batchNotesMode === 'set' && (
                      <div>
                        <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                          Note Text
                        </label>
                        <input
                          type="text"
                          value={batchNotesText}
                          onChange={(e) => setBatchNotesText(e.target.value)}
                          placeholder="Enter note for selected students..."
                          className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bulkError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]"
                >
                  {bulkError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                >
                  {bulkSaving
                    ? 'Saving Changes...'
                    : `Save All ${draftRows.length} Student${
                        draftRows.length === 1 ? '' : 's'
                      }`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Student Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ''}
        description="Deleting this student removes their student record, saved avatar, and any retained local photograph. Consider Archiving instead if you want to keep historical participation records."
        confirmLabel="Delete Permanently"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDeleteStudent(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Bulk Delete Selected Confirmation */}
      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        title={`Delete ${selectedIds.size} Selected Student${
          selectedIds.size === 1 ? '' : 's'
        }?`}
        description={`This will permanently delete all ${selectedIds.size} selected student records and any associated local photographs. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Student${
          selectedIds.size === 1 ? '' : 's'
        }`}
        destructive
        onCancel={() => setConfirmBulkDeleteOpen(false)}
        onConfirm={async () => {
          const ids = Array.from(selectedIds);
          setConfirmBulkDeleteOpen(false);
          setSelectedIds(new Set());
          await onBulkDeleteStudents(ids);
        }}
      />
    </div>
  );
};
