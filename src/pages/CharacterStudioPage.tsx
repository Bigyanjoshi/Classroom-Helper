import React, { useMemo, useState } from 'react';
import { Camera, RefreshCw, RotateCcw, Search, ShieldCheck, Sliders, Sparkles, Trash2, UserCheck } from 'lucide-react';
import {
  ACCESSORIES,
  applyCharacterArchetype,
  BG_COLORS,
  BG_PATTERNS,
  CHARACTER_ARCHETYPES,
  CLASSROOM_MASCOTS,
  detectStudentGenderFromName,
  EYE_STYLES,
  FACE_SHAPES,
  getClassroomMascotOption,
  getHairPoolForPresentation,
  HAIR_COLORS,
  MOUTH_STYLES,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  pickUniqueAvatarConfig,
  randomizeStyleKeepingSkinTone,
  UNIFORM_CARTOON_TONE,
  type CharacterArchetypeId,
} from '../domain/avatarGenerator';
import { sortStudentsNaturally } from '../domain/random';
import type {
  AvatarConfig,
  AvatarKind,
  CharacterPresentation,
  ClassRecord,
  MascotId,
  Student,
} from '../domain/types';
import { StudentAvatar } from '../components/StudentAvatar';

interface CharacterStudioPageProps {
  classes: ClassRecord[];
  students: Student[];
  selectedClassId: string;
  onSelectClassFilter: (classId: string) => void;
  onUpdateStudentAvatar: (
    studentId: string,
    avatarConfig: AvatarConfig,
    presentation: CharacterPresentation,
    switchBackToGenerated?: boolean
  ) => Promise<void>;
  onUploadPhotoForStudent: (student: Student) => void;
  onDeleteOriginalPhoto: (student: Student) => Promise<void>;
}

function formatHairLabel(style: string): string {
  return style
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStudioBadge(stu: Student): string {
  if (stu.avatarSource === 'photo') return 'Local photo';
  const kind = stu.avatarConfig.avatarKind ?? 'human';
  if (kind === 'mascot') {
    return `Mascot · ${getClassroomMascotOption(stu.avatarConfig.mascotId).label}`;
  }
  const genderLabel =
    stu.avatarConfig.presentation === 'feminine' || stu.characterPresentation === 'feminine'
      ? '3D Girl'
      : stu.avatarConfig.presentation === 'masculine' || stu.characterPresentation === 'masculine'
      ? '3D Boy'
      : '3D Character';
  return `${genderLabel} · ${formatHairLabel(stu.avatarConfig.hairStyle)}`;
}

export const CharacterStudioPage: React.FC<CharacterStudioPageProps> = ({
  classes,
  students,
  selectedClassId,
  onSelectClassFilter,
  onUpdateStudentAvatar,
  onUploadPhotoForStudent,
  onDeleteOriginalPhoto,
}) => {
  const [search, setSearch] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<AvatarConfig | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<CharacterPresentation>('masculine');

  const activeClasses = classes.filter((c) => !c.archivedAt);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students
      .filter((s) => s.activeStatus === 'active')
      .filter((s) => (selectedClassId === 'all' ? true : s.classId === selectedClassId))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q));
    return sortStudentsNaturally(list);
  }, [students, selectedClassId, search]);

  const editingStudent = students.find((s) => s.id === editingStudentId) ?? null;

  const openCustomizer = (stu: Student) => {
    setEditingStudentId(stu.id);
    const resolvedPres =
      stu.characterPresentation === 'random'
        ? detectStudentGenderFromName(stu.name)
        : stu.characterPresentation;
    setDraftConfig({
      ...stu.avatarConfig,
      avatarKind: stu.avatarConfig.avatarKind ?? 'human',
    });
    setDraftPresentation(resolvedPres);
  };

  const handleModeSwitch = (nextKind: AvatarKind) => {
    if (!draftConfig || !editingStudent) return;
    if (nextKind === 'mascot') {
      const mascotId: MascotId = draftConfig.mascotId ?? 'owl';
      setDraftConfig({
        ...draftConfig,
        avatarKind: 'mascot',
        mascotId,
      });
    } else {
      setDraftConfig({
        ...draftConfig,
        avatarKind: 'human',
        skinTone: UNIFORM_CARTOON_TONE,
      });
    }
  };

  const handleSelectGender = (nextGender: 'masculine' | 'feminine' | 'neutral' | 'auto') => {
    if (!draftConfig || !editingStudent) return;
    const resolved: CharacterPresentation =
      nextGender === 'auto' ? detectStudentGenderFromName(editingStudent.name) : nextGender;
    setDraftPresentation(resolved);
    setDraftConfig(
      randomizeStyleKeepingSkinTone(
        { ...draftConfig, avatarKind: 'human' },
        resolved,
        undefined,
        editingStudent.name
      )
    );
  };

  const handleQuickGenderSwitch = async (stu: Student, nextGender: 'masculine' | 'feminine') => {
    const nextCfg = randomizeStyleKeepingSkinTone(
      { ...stu.avatarConfig, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
      nextGender,
      undefined,
      stu.name
    );
    await onUpdateStudentAvatar(stu.id, nextCfg, nextGender, true);
  };

  const handleApplyArchetype = (archetypeId: CharacterArchetypeId) => {
    if (!draftConfig || !editingStudent) return;
    setDraftConfig(
      applyCharacterArchetype(draftConfig, archetypeId, draftPresentation, editingStudent.name)
    );
  };

  const handleQuickRegenerate = async (stu: Student) => {
    const resolvedGender =
      stu.characterPresentation === 'random'
        ? detectStudentGenderFromName(stu.name)
        : stu.characterPresentation;
    const nextCfg = randomizeStyleKeepingSkinTone(
      { ...stu.avatarConfig, avatarKind: 'human', skinTone: UNIFORM_CARTOON_TONE },
      resolvedGender,
      undefined,
      stu.name
    );
    await onUpdateStudentAvatar(stu.id, nextCfg, resolvedGender, true);
  };

  const draftKind: AvatarKind = draftConfig?.avatarKind ?? 'human';

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)]">
            3D Student Character Studio
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Expressive 3D male &amp; female student characters with automatic gender detection and a harmonious warm classroom complexion so students never tease each other.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--emerald-soft)]/70 border border-[var(--emerald)]/25 text-xs font-medium text-[var(--ink)]">
          <ShieldCheck className="w-4 h-4 text-[var(--emerald)] shrink-0" />
          <span>Anti-Teasing Harmonious 3D Complexion Active</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)]">
        <select
          aria-label="Filter characters by class"
          value={selectedClassId}
          onChange={(e) => onSelectClassFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
        >
          <option value="all">All Classes</option>
          {activeClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            aria-label="Search students in studio"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
          />
        </div>
      </div>

      {/* Inline Customizer Drawer/Panel */}
      {editingStudent && draftConfig && (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--accent)]/45 shadow-[var(--shadow-card)] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <StudentAvatar
                student={{ ...editingStudent, avatarSource: 'generated', avatarConfig: draftConfig }}
                sizeVariant="full"
                className="w-24 h-24 shrink-0 rounded-2xl shadow-sm"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-display font-bold text-[var(--ink)]">
                    Customize {editingStudent.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold">
                    <UserCheck className="w-3.5 h-3.5" />
                    {draftPresentation === 'feminine'
                      ? 'Female (3D Girl)'
                      : draftPresentation === 'masculine'
                      ? 'Male (3D Boy)'
                      : 'Neutral 3D'}
                  </span>
                </div>
                <div className="text-xs text-[var(--ink-muted)] font-mono-tabular mt-0.5">
                  Roll {editingStudent.rollNumber} · {classMap.get(editingStudent.classId)}
                </div>
                {editingStudent.originalPhotoBlobId && (
                  <button
                    type="button"
                    onClick={() => onDeleteOriginalPhoto(editingStudent)}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--crimson-soft)] text-[var(--crimson)] text-xs font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Retained Original Photo
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftConfig(
                    randomizeStyleKeepingSkinTone(
                      draftConfig,
                      draftPresentation,
                      undefined,
                      editingStudent.name
                    )
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Surprise 3D Style
              </button>
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                className="px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateStudentAvatar(editingStudent.id, draftConfig, draftPresentation, true);
                  setEditingStudentId(null);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white cursor-pointer"
              >
                Save 3D Character to Card
              </button>
            </div>
          </div>

          {/* Gender & 3D Archetype Quick Controls */}
          <div className="space-y-4 p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--ink)]">
                  Student Gender &amp; 3D Character Selection
                </div>
                <div className="text-[11px] text-[var(--ink-muted)]">
                  Select Male or Female 3D character, or auto-detect from student name
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectGender('masculine')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                    draftPresentation === 'masculine' && draftKind !== 'mascot'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)]'
                  }`}
                >
                  Male (3D Boy)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGender('feminine')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                    draftPresentation === 'feminine' && draftKind !== 'mascot'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)]'
                  }`}
                >
                  Female (3D Girl)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGender('neutral')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                    draftPresentation === 'neutral' && draftKind !== 'mascot'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)]'
                  }`}
                >
                  Neutral 3D
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectGender('auto')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--canvas)]"
                >
                  Auto-Detect from Name ({detectStudentGenderFromName(editingStudent.name) === 'feminine' ? 'Female' : 'Male'})
                </button>
              </div>
            </div>

            {draftKind !== 'mascot' && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>1-Click 3D Student Archetypes</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {CHARACTER_ARCHETYPES.map((arch) => (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => handleApplyArchetype(arch.id)}
                      className="px-2.5 py-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 text-left cursor-pointer transition-colors"
                    >
                      <div className="text-xs font-semibold text-[var(--ink)]">{arch.label}</div>
                      <div className="text-[10px] text-[var(--ink-muted)] truncate">{arch.badge}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <div className="text-xs font-medium text-[var(--ink-muted)]">Character Mode</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('human')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    draftKind !== 'mascot'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)]'
                  }`}
                >
                  3D Student Character
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('mascot')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    draftKind === 'mascot'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)]'
                  }`}
                >
                  Classroom Mascot (3D)
                </button>
              </div>
            </div>

            {draftKind === 'mascot' && (
              <div className="pt-1">
                <div className="text-xs text-[var(--ink-muted)] mb-1.5">Choose Mascot</div>
                <div className="flex flex-wrap gap-2">
                  {CLASSROOM_MASCOTS.map((mascot) => (
                    <button
                      key={mascot.id}
                      type="button"
                      onClick={() =>
                        setDraftConfig({ ...draftConfig, avatarKind: 'mascot', mascotId: mascot.id })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border ${
                        (draftConfig.mascotId ?? 'owl') === mascot.id
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-semibold'
                          : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {mascot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {draftKind !== 'mascot' && (
              <>
                <div>
                  <label className="block text-[var(--ink-muted)] mb-1">Face Sculpture</label>
                  <select
                    value={draftConfig.faceShape}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, faceShape: e.target.value as AvatarConfig['faceShape'] })
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                  >
                    {FACE_SHAPES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--ink-muted)] mb-1">3D Hair Style</label>
                  <select
                    value={draftConfig.hairStyle}
                    onChange={(e) => setDraftConfig({ ...draftConfig, hairStyle: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                  >
                    {getHairPoolForPresentation(draftConfig.presentation).map((h) => (
                      <option key={h} value={h}>{formatHairLabel(h)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--ink-muted)] mb-1">3D Eyes</label>
                  <select
                    value={draftConfig.eyeStyle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, eyeStyle: e.target.value as AvatarConfig['eyeStyle'] })
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                  >
                    {EYE_STYLES.map((eye) => <option key={eye} value={eye}>{eye}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--ink-muted)] mb-1">Expression</label>
                  <select
                    value={draftConfig.mouthStyle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, mouthStyle: e.target.value as AvatarConfig['mouthStyle'] })
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                  >
                    {MOUTH_STYLES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--ink-muted)] mb-1">3D Outfit</label>
                  <select
                    value={draftConfig.outfitStyle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, outfitStyle: e.target.value as AvatarConfig['outfitStyle'] })
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                  >
                    {OUTFIT_STYLES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-[var(--ink-muted)] mb-1">Accessory</label>
              <select
                value={draftConfig.accessory}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, accessory: e.target.value as AvatarConfig['accessory'] })
                }
                className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
              >
                {Array.from(new Set(ACCESSORIES)).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[var(--ink-muted)] mb-1">Backdrop Pattern</label>
              <select
                value={draftConfig.bgPattern}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, bgPattern: e.target.value as AvatarConfig['bgPattern'] })
                }
                className="w-full px-2.5 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
              >
                {BG_PATTERNS.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-xs">
            {draftKind !== 'mascot' && (
              <div>
                <div className="text-[var(--ink-muted)] mb-1.5">Hair Color</div>
                <div className="flex gap-1.5">
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraftConfig({ ...draftConfig, hairColor: c })}
                      className={`w-6 h-6 rounded-full border cursor-pointer ${draftConfig.hairColor === c ? 'ring-2 ring-[var(--accent)]' : 'border-[var(--border-hairline)]'}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Hair color ${c}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[var(--ink-muted)] mb-1.5">Outfit Color</div>
              <div className="flex gap-1.5">
                {OUTFIT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftConfig({ ...draftConfig, outfitColor: c })}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${draftConfig.outfitColor === c ? 'ring-2 ring-[var(--accent)]' : 'border-[var(--border-hairline)]'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Outfit color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[var(--ink-muted)] mb-1.5">Card Backdrop</div>
              <div className="flex gap-1.5">
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftConfig({ ...draftConfig, bgColor: c })}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${draftConfig.bgColor === c ? 'ring-2 ring-[var(--accent)]' : 'border-[var(--border-hairline)]'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Backdrop color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStudents.map((stu) => {
          const isFemale =
            stu.avatarConfig.presentation === 'feminine' || stu.characterPresentation === 'feminine';
          const isMale =
            stu.avatarConfig.presentation === 'masculine' || stu.characterPresentation === 'masculine';
          return (
            <div
              key={stu.id}
              className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center gap-3.5">
                <StudentAvatar student={stu} sizeVariant="thumb" className="w-16 h-16 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-[var(--ink)] truncate">{stu.name}</div>
                  <div className="text-xs text-[var(--ink-muted)] font-mono-tabular">
                    Roll {stu.rollNumber} · {classMap.get(stu.classId)}
                  </div>
                  <div className="text-xs text-[var(--ink-muted)] mt-0.5 truncate">
                    {formatStudioBadge(stu)}
                  </div>
                </div>
              </div>

              {/* Quick Male / Female Toggle Row */}
              {stu.avatarSource !== 'photo' && (
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickGenderSwitch(stu, 'masculine')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                      isMale
                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                        : 'bg-[var(--canvas)] border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Male 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickGenderSwitch(stu, 'feminine')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                      isFemale
                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                        : 'bg-[var(--canvas)] border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Female 3D
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => openCustomizer(stu)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Customize 3D
                </button>
                <button
                  type="button"
                  onClick={() => onUploadPhotoForStudent(stu)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                  title="Upload / Replace with Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Photo
                </button>
                {stu.originalPhotoBlobId && (
                  <button
                    type="button"
                    onClick={() => onDeleteOriginalPhoto(stu)}
                    className="p-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--crimson)] hover:bg-[var(--crimson-soft)] cursor-pointer"
                    title="Delete retained original photo"
                    aria-label={`Delete retained original photo for ${stu.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {stu.avatarSource === 'photo' ? (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStudentAvatar(
                        stu.id,
                        stu.avatarConfig ?? pickUniqueAvatarConfig(stu.characterPresentation, []),
                        stu.characterPresentation,
                        true
                      )
                    }
                    className="p-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                    title="Restore generated 3D character"
                    aria-label={`Restore generated 3D character for ${stu.name}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickRegenerate(stu)}
                    className="p-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                    title="Surprise 3D style"
                    aria-label={`Randomize 3D style for ${stu.name}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
