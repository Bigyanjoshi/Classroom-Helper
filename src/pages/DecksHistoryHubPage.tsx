import React from 'react';
import { BarChart3, HelpCircle } from 'lucide-react';
import type {
  ActivityRecord,
  ActivitySelection,
  ClassRecord,
  ClassSession,
  QuestionItem,
  RewardChallengeItem,
  Student,
} from '../domain/types';
import { HistoryReportsPage } from './HistoryReportsPage';
import { QuestionsTasksPage } from './QuestionsTasksPage';

export type DecksHistoryTab = 'questions' | 'history';

interface DecksHistoryHubPageProps {
  activeTab: DecksHistoryTab;
  onChangeTab: (tab: DecksHistoryTab) => void;
  classes: ClassRecord[];
  students: Student[];
  sessions: ClassSession[];
  activities: ActivityRecord[];
  selections: ActivitySelection[];
  questions: QuestionItem[];
  rewards: RewardChallengeItem[];
  onAddQuestion: (subject: string, text: string) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onBulkImportQuestions: (items: Array<{ subject: string; text: string }>) => Promise<number>;
  onAddRewardItem: (kind: RewardChallengeItem['kind'], text: string) => Promise<void>;
  onDeleteRewardItem: (id: string) => Promise<void>;
}

export const DecksHistoryHubPage: React.FC<DecksHistoryHubPageProps> = ({
  activeTab,
  onChangeTab,
  classes,
  students,
  sessions,
  activities,
  selections,
  questions,
  rewards,
  onAddQuestion,
  onDeleteQuestion,
  onBulkImportQuestions,
  onAddRewardItem,
  onDeleteRewardItem,
}) => {
  const tabs: Array<{ id: DecksHistoryTab; label: string; icon: React.ReactNode }> = [
    { id: 'questions', label: 'Question Decks & Duties', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'history', label: 'Participation & Sessions', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Decks and History sections"
        className="no-print inline-flex flex-wrap p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] gap-1"
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

      {activeTab === 'questions' ? (
        <QuestionsTasksPage
          questions={questions}
          rewards={rewards}
          selections={selections}
          onAddQuestion={onAddQuestion}
          onDeleteQuestion={onDeleteQuestion}
          onBulkImportQuestions={onBulkImportQuestions}
          onAddRewardItem={onAddRewardItem}
          onDeleteRewardItem={onDeleteRewardItem}
        />
      ) : (
        <HistoryReportsPage
          classes={classes}
          students={students}
          sessions={sessions}
          activities={activities}
          selections={selections}
          rewards={rewards}
        />
      )}
    </div>
  );
};
