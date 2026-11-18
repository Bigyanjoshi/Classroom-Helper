import React from 'react';
import { Layers, Palette, Users } from 'lucide-react';
import type { AvatarConfig, CardBackTheme, CharacterPresentation, ClassRecord, Student } from '../domain/types';
import { CardCollectionPage } from './CardCollectionPage';
import { CharacterStudioPage } from './CharacterStudioPage';
import { StudentsPage, type BulkStudentUpdateItem } from './StudentsPage';

export type RosterStudioTab = 'students' | 'studio' | 'cards';

interface RosterStudioHubPageProps {
  activeTab: RosterStudioTab;
  onChangeTab: (tab: RosterStudioTab) => void;
  classes: ClassRecord[];
  students: Student[];
  selectedClassId: string;
  cardBackTheme: CardBackTheme;
  onSelectClassFilter: (classId: string) => void;
  onAddStudent: () => void;
  onImportStudents: () => void;
  onEditStudent: (student: Student) => void;
  onUploadPhotoForStudent: (student?: Student) => void;
  onArchiveToggle: (student: Student) => Promise<void>;
  onDeleteStudent: (student: Student) => Promise<void>;
  onBulkDeleteStudents: (studentIds: string[]) => Promise<void>;
  onBulkUpdateStudents: (updates: BulkStudentUpdateItem[]) => Promise<void>;
  onUpdateStudentAvatar: (
    studentId: string,
    avatarConfig: AvatarConfig,
    presentation: CharacterPresentation,
    switchBackToGenerated?: boolean
  ) => Promise<void>;
  onDeleteOriginalPhoto: (student: Student) => Promise<void>;
  onChangeCardBackTheme: (theme: CardBackTheme) => Promise<void>;
}

export const RosterStudioHubPage: React.FC<RosterStudioHubPageProps> = ({
  activeTab,
  onChangeTab,
  classes,
  students,
  selectedClassId,
  cardBackTheme,
  onSelectClassFilter,
  onAddStudent,
  onImportStudents,
  onEditStudent,
  onUploadPhotoForStudent,
  onArchiveToggle,
  onDeleteStudent,
  onBulkDeleteStudents,
  onBulkUpdateStudents,
  onUpdateStudentAvatar,
  onDeleteOriginalPhoto,
  onChangeCardBackTheme,
}) => {
  const tabs: Array<{ id: RosterStudioTab; label: string; icon: React.ReactNode }> = [
    { id: 'students', label: 'Students', icon: <Users className="w-4 h-4" /> },
    { id: 'studio', label: '3D Avatar Studio', icon: <Palette className="w-4 h-4" /> },
    { id: 'cards', label: 'Card Collection', icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Roster and 3D Studio sections"
        className="inline-flex flex-wrap p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] gap-1"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChangeTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                selected
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <span className={selected ? 'text-[var(--accent)]' : ''}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'students' && (
        <StudentsPage
          classes={classes}
          students={students}
          selectedClassId={selectedClassId}
          onSelectClassFilter={onSelectClassFilter}
          onAddStudent={onAddStudent}
          onImportStudents={onImportStudents}
          onEditStudent={onEditStudent}
          onUploadPhotoForStudent={onUploadPhotoForStudent}
          onArchiveToggle={onArchiveToggle}
          onDeleteStudent={onDeleteStudent}
          onBulkDeleteStudents={onBulkDeleteStudents}
          onBulkUpdateStudents={onBulkUpdateStudents}
        />
      )}

      {activeTab === 'studio' && (
        <CharacterStudioPage
          classes={classes}
          students={students}
          selectedClassId={selectedClassId}
          onSelectClassFilter={onSelectClassFilter}
          onUpdateStudentAvatar={onUpdateStudentAvatar}
          onUploadPhotoForStudent={(stu) => onUploadPhotoForStudent(stu)}
          onDeleteOriginalPhoto={onDeleteOriginalPhoto}
        />
      )}

      {activeTab === 'cards' && (
        <CardCollectionPage
          classes={classes}
          students={students}
          selectedClassId={selectedClassId}
          cardBackTheme={cardBackTheme}
          onSelectClassFilter={onSelectClassFilter}
          onChangeCardBackTheme={onChangeCardBackTheme}
        />
      )}
    </div>
  );
};
