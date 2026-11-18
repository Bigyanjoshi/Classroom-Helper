import React, { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { sortStudentsNaturally } from '../domain/random';
import type { CardBackTheme, ClassRecord, Student } from '../domain/types';
import { CardBackArtwork } from '../components/CardBackArtwork';
import { StudentCardFront } from '../components/StudentCard';

interface CardCollectionPageProps {
  classes: ClassRecord[];
  students: Student[];
  selectedClassId: string;
  cardBackTheme: CardBackTheme;
  onSelectClassFilter: (classId: string) => void;
  onChangeCardBackTheme: (theme: CardBackTheme) => Promise<void>;
}

const THEMES: Array<{ id: CardBackTheme; label: string }> = [
  { id: 'terracotta', label: 'Terracotta Craft' },
  { id: 'botanical', label: 'Sage Botanical' },
  { id: 'geometric', label: 'Slate Geometric' },
  { id: 'constellation', label: 'Plum Constellation' },
];

export const CardCollectionPage: React.FC<CardCollectionPageProps> = ({
  classes,
  students,
  selectedClassId,
  cardBackTheme,
  onSelectClassFilter,
  onChangeCardBackTheme,
}) => {
  const [showAllBacks, setShowAllBacks] = useState(false);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});

  const activeClasses = classes.filter((c) => !c.archivedAt);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const activeStudents = useMemo(() => {
    const filtered = students
      .filter((s) => s.activeStatus === 'active')
      .filter((s) => (selectedClassId === 'all' ? true : s.classId === selectedClassId));
    return sortStudentsNaturally(filtered);
  }, [students, selectedClassId]);

  const toggleCard = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)]">
            Student Card Collection
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Preview every student’s front card and uniform mystery card backs (which hide all names, roll numbers, and avatars).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAllBacks((v) => !v);
            setFlippedIds({});
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer self-start"
        >
          <RotateCw className="w-4 h-4" />
          {showAllBacks ? 'Show All Card Fronts' : 'Preview All Card Backs'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)]">
        <select
          aria-label="Filter cards by class"
          value={selectedClassId}
          onChange={(e) => onSelectClassFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
        >
          <option value="all">All Classes ({students.filter((s) => s.activeStatus === 'active').length})</option>
          {activeClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--ink-muted)] mr-1">Card Back Design:</span>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeCardBackTheme(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                cardBackTheme === t.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {activeStudents.map((stu, idx) => {
          const isBackShown = showAllBacks ? !flippedIds[stu.id] : !!flippedIds[stu.id];
          return (
            <div key={stu.id} className="aspect-[3/4] card-perspective">
              <button
                type="button"
                onClick={() => toggleCard(stu.id)}
                aria-label={`Flip card for ${stu.name}`}
                className="w-full h-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent)] cursor-pointer"
              >
                <div className={`card-inner ${isBackShown ? '' : 'is-flipped'}`}>
                  <div className="card-face">
                    <CardBackArtwork theme={cardBackTheme} variant={idx % 6} />
                  </div>
                  <div className="card-face card-face-front">
                    <StudentCardFront
                      student={stu}
                      classNameLabel={classMap.get(stu.classId) ?? ''}
                    />
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
