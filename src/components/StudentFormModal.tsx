import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, UserCheck, X } from 'lucide-react';
import {
  applyCharacterArchetype,
  CHARACTER_ARCHETYPES,
  CLASSROOM_MASCOTS,
  detectStudentGenderFromName,
  pickUniqueAvatarConfig,
  randomizeStyleKeepingSkinTone,
  type CharacterArchetypeId,
} from '../domain/avatarGenerator';
import type {
  AvatarConfig,
  AvatarKind,
  CharacterPresentation,
  ClassRecord,
  MascotId,
  Student,
} from '../domain/types';
import { StudentAvatar } from './StudentAvatar';

interface StudentFormModalProps {
  open: boolean;
  classes: ClassRecord[];
  defaultClassId: string;
  editingStudent: Student | null;
  existingStudents: Student[];
  onSave: (data: {
    id?: string;
    classId: string;
    name: string;
    rollNumber: string;
    characterPresentation: CharacterPresentation;
    avatarConfig: AvatarConfig;
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}

type GenderSelectMode = 'auto' | 'masculine' | 'feminine' | 'neutral';

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  open,
  classes,
  defaultClassId,
  editingStudent,
  existingStudents,
  onSave,
  onClose,
}) => {
  const [classId, setClassId] = useState(defaultClassId);
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [genderMode, setGenderMode] = useState<GenderSelectMode>('auto');
  const [presentation, setPresentation] = useState<CharacterPresentation>('masculine');
  const [selectedArchetype, setSelectedArchetype] = useState<CharacterArchetypeId | null>(null);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() =>
    pickUniqueAvatarConfig('masculine', [], undefined, { avatarKind: 'human' })
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedArchetype(null);
    if (editingStudent) {
      setClassId(editingStudent.classId);
      setName(editingStudent.name);
      setRollNumber(editingStudent.rollNumber);
      const resolvedPres =
        editingStudent.characterPresentation === 'random'
          ? detectStudentGenderFromName(editingStudent.name)
          : editingStudent.characterPresentation;
      setGenderMode(
        editingStudent.characterPresentation === 'random'
          ? 'auto'
          : (editingStudent.characterPresentation as GenderSelectMode)
      );
      setPresentation(resolvedPres);
      setAvatarConfig({
        ...editingStudent.avatarConfig,
        avatarKind: editingStudent.avatarConfig.avatarKind ?? 'human',
        presentation:
          resolvedPres === 'masculine' || resolvedPres === 'feminine' || resolvedPres === 'neutral'
            ? resolvedPres
            : editingStudent.avatarConfig.presentation,
      });
      setNotes(editingStudent.notes ?? '');
    } else {
      const targetClass = defaultClassId || classes[0]?.id || '';
      setClassId(targetClass);
      setName('');
      setRollNumber('');
      setGenderMode('auto');
      setPresentation('masculine');
      const classConfigs = existingStudents
        .filter((s) => s.classId === targetClass)
        .map((s) => s.avatarConfig);
      setAvatarConfig(
        pickUniqueAvatarConfig('masculine', classConfigs, undefined, {
          avatarKind: 'human',
        })
      );
      setNotes('');
    }
  }, [open, editingStudent, defaultClassId, classes, existingStudents]);

  if (!open) return null;

  const avatarKind: AvatarKind = avatarConfig.avatarKind ?? 'human';
  const autoDetectedGender = detectStudentGenderFromName(name);
  const effectivePresentation: CharacterPresentation =
    genderMode === 'auto' ? autoDetectedGender : genderMode;

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (genderMode === 'auto') {
      const detected = detectStudentGenderFromName(nextName);
      setPresentation(detected);
      if (detected !== avatarConfig.presentation) {
        setAvatarConfig((prev) =>
          randomizeStyleKeepingSkinTone(
            { ...prev, avatarKind: prev.avatarKind === 'mascot' ? 'mascot' : 'human' },
            detected,
            undefined,
            nextName
          )
        );
      }
    }
  };

  const handleSelectGenderMode = (nextMode: GenderSelectMode) => {
    setGenderMode(nextMode);
    const targetPres: CharacterPresentation =
      nextMode === 'auto' ? detectStudentGenderFromName(name) : nextMode;
    setPresentation(targetPres);
    setAvatarConfig((prev) =>
      randomizeStyleKeepingSkinTone(
        { ...prev, avatarKind: prev.avatarKind === 'mascot' ? 'mascot' : 'human' },
        targetPres,
        undefined,
        name
      )
    );
  };

  const handleSelectArchetype = (archetypeId: CharacterArchetypeId) => {
    setSelectedArchetype(archetypeId);
    setAvatarConfig((prev) =>
      applyCharacterArchetype(prev, archetypeId, effectivePresentation, name)
    );
  };

  const handleAvatarModeChange = (nextKind: AvatarKind) => {
    const classConfigs = existingStudents
      .filter((s) => s.classId === classId && s.id !== editingStudent?.id)
      .map((s) => s.avatarConfig);

    if (nextKind === 'mascot') {
      setAvatarConfig(
        pickUniqueAvatarConfig(effectivePresentation, classConfigs, undefined, {
          avatarKind: 'mascot',
          mascotId: avatarConfig.mascotId ?? 'owl',
          studentName: name,
        })
      );
    } else {
      setAvatarConfig(
        pickUniqueAvatarConfig(effectivePresentation, classConfigs, undefined, {
          avatarKind: 'human',
          studentName: name,
        })
      );
    }
  };

  const handleSelectMascot = (mascotId: MascotId) => {
    setAvatarConfig((prev) => ({
      ...prev,
      avatarKind: 'mascot',
      mascotId,
    }));
  };

  const handleRegenerateStyle = () => {
    setSelectedArchetype(null);
    setAvatarConfig((prev) =>
      randomizeStyleKeepingSkinTone(prev, effectivePresentation, undefined, name)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedRoll = rollNumber.trim();
    if (!trimmedName) {
      setError('Please enter the student name.');
      return;
    }
    if (!trimmedRoll) {
      setError('Please enter a roll number.');
      return;
    }
    if (!classId) {
      setError('Please select a class.');
      return;
    }

    const duplicateRoll = existingStudents.find(
      (s) =>
        s.classId === classId &&
        s.activeStatus === 'active' &&
        s.id !== editingStudent?.id &&
        s.rollNumber.trim().toLowerCase() === trimmedRoll.toLowerCase()
    );
    if (duplicateRoll) {
      setError(
        `Roll number "${trimmedRoll}" already belongs to ${duplicateRoll.name} in this class.`
      );
      return;
    }

    const finalPresentation: CharacterPresentation =
      genderMode === 'auto' ? detectStudentGenderFromName(trimmedName) : genderMode;
    const finalAvatarConfig: AvatarConfig =
      finalPresentation !== avatarConfig.presentation && avatarConfig.avatarKind !== 'mascot'
        ? randomizeStyleKeepingSkinTone(avatarConfig, finalPresentation, undefined, trimmedName)
        : avatarConfig;

    setSaving(true);
    try {
      await onSave({
        id: editingStudent?.id,
        classId,
        name: trimmedName,
        rollNumber: trimmedRoll,
        characterPresentation: finalPresentation,
        avatarConfig: finalAvatarConfig,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student.');
    } finally {
      setSaving(false);
    }
  };

  const previewStudent: Student = {
    id: editingStudent?.id ?? 'preview',
    classId,
    name: name || 'Preview Student',
    rollNumber: rollNumber || '00',
    characterPresentation: effectivePresentation,
    avatarSource: editingStudent?.avatarSource === 'photo' ? 'photo' : 'generated',
    avatarConfig,
    avatarBlobId: editingStudent?.avatarBlobId,
    thumbnailBlobId: editingStudent?.thumbnailBlobId,
    fullBlobId: editingStudent?.fullBlobId,
    activeStatus: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const genderLabel =
    effectivePresentation === 'masculine'
      ? 'Male (3D Boy Character)'
      : effectivePresentation === 'feminine'
      ? 'Female (3D Girl Character)'
      : 'Neutral 3D Character';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-form-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="student-form-title"
            className="text-xl font-display font-semibold text-[var(--ink)]"
          >
            {editingStudent ? 'Edit Student & 3D Character' : 'Add Student & 3D Character'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student form"
            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 3D Character Preview Banner */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
            <StudentAvatar
              student={previewStudent}
              sizeVariant="full"
              className="w-24 h-24 shrink-0 rounded-2xl shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">
                  3D Student Character Preview
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-semibold">
                  <UserCheck className="w-3 h-3" />
                  {genderMode === 'auto' ? `Auto: ${genderLabel}` : genderLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-1 leading-relaxed">
                Uses a harmonious, balanced warm 3D complexion for every student (never starkly white or dark) so classmates never tease each other—while giving each student an exciting, unique 3D look!
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateStyle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--canvas)] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Surprise Me! (New 3D Look)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="stu-class" className="block text-sm font-medium text-[var(--ink)] mb-1">
                Class
              </label>
              <select
                id="stu-class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
              >
                {classes
                  .filter((c) => !c.archivedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="stu-roll" className="block text-sm font-medium text-[var(--ink)] mb-1">
                Roll Number
              </label>
              <input
                id="stu-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 509"
                className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)] font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stu-name" className="block text-sm font-medium text-[var(--ink)] mb-1">
              Student Name
            </label>
            <input
              id="stu-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter student name (e.g. Aarav, Bigyan, Ananya, Sita...)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            />
          </div>

          {/* Gender & 3D Character Customizer */}
          <div className="p-3.5 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] space-y-3.5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  Student Gender &amp; 3D Character Type
                </span>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  Auto-detects from name or select manually
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    {
                      id: 'auto',
                      label: `Auto (${autoDetectedGender === 'feminine' ? 'Female' : 'Male'})`,
                    },
                    { id: 'masculine', label: 'Male (Boy 3D)' },
                    { id: 'feminine', label: 'Female (Girl 3D)' },
                    { id: 'neutral', label: 'Neutral 3D' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectGenderMode(opt.id)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      genderMode === opt.id
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {avatarKind !== 'mascot' && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Fun 3D Student Archetypes (Sparks Student Curiosity)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CHARACTER_ARCHETYPES.map((arch) => (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => handleSelectArchetype(arch.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left cursor-pointer transition-colors ${
                        selectedArchetype === arch.id
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
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
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <span className="text-xs font-medium text-[var(--ink-muted)]">Character Mode</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAvatarModeChange('human')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                    avatarKind !== 'mascot'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border-hairline)]'
                  }`}
                >
                  3D Student Character
                </button>
                <button
                  type="button"
                  onClick={() => handleAvatarModeChange('mascot')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                    avatarKind === 'mascot'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border-hairline)]'
                  }`}
                >
                  Classroom Mascot
                </button>
              </div>
            </div>

            {avatarKind === 'mascot' && (
              <div className="grid grid-cols-3 gap-2">
                {CLASSROOM_MASCOTS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMascot(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left cursor-pointer ${
                      (avatarConfig.mascotId ?? 'owl') === m.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="stu-notes" className="block text-sm font-medium text-[var(--ink)] mb-1">
              Teacher Notes (optional)
            </label>
            <input
              id="stu-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private teacher note (not shown on cards)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]"
            >
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingStudent ? 'Save Changes' : 'Save Student & 3D Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
