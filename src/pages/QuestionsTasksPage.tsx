import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { parseCsvMatrix } from '../domain/csvParser';
import { computeDutyTitleCounts } from '../domain/eligibility';
import type { ActivitySelection, QuestionItem, RewardChallengeItem } from '../domain/types';

interface QuestionsTasksPageProps {
  questions: QuestionItem[];
  rewards: RewardChallengeItem[];
  selections?: ActivitySelection[];
  onAddQuestion: (subject: string, text: string) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onBulkImportQuestions: (items: Array<{ subject: string; text: string }>) => Promise<number>;
  onAddRewardItem: (kind: RewardChallengeItem['kind'], text: string) => Promise<void>;
  onDeleteRewardItem: (id: string) => Promise<void>;
}

export const QuestionsTasksPage: React.FC<QuestionsTasksPageProps> = ({
  questions,
  rewards,
  selections = [],
  onAddQuestion,
  onDeleteQuestion,
  onBulkImportQuestions,
  onAddRewardItem,
  onDeleteRewardItem,
}) => {
  const [tab, setTab] = useState<'questions' | 'tasks'>('questions');
  const [subject, setSubject] = useState('Science');
  const [questionText, setQuestionText] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  const [itemKind, setItemKind] = useState<RewardChallengeItem['kind']>('duty');
  const [itemText, setItemText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const subjects = Array.from(new Set(questions.map((q) => q.subject)));
  const visibleQuestions =
    filterSubject === 'all' ? questions : questions.filter((q) => q.subject === filterSubject);

  const dutyCounts = useMemo(
    () => computeDutyTitleCounts(selections),
    [selections]
  );

  const handleAddQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !subject.trim()) return;
    await onAddQuestion(subject.trim(), questionText.trim());
    setQuestionText('');
  };

  const handleCsvUpload = async (file: File) => {
    setImportMsg(null);
    const text = await file.text();
    const matrix = parseCsvMatrix(text);
    const items: Array<{ subject: string; text: string }> = [];
    for (let i = 0; i < matrix.length; i++) {
      const [col1, col2] = matrix[i];
      if (i === 0 && col1?.toLowerCase().includes('subject')) continue;
      if (col1 && col2) items.push({ subject: col1, text: col2 });
    }
    const count = await onBulkImportQuestions(items);
    setImportMsg(`Imported ${count} question(s) into your local deck.`);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemText.trim()) return;
    await onAddRewardItem(itemKind, itemText.trim());
    setItemText('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)]">
            Question Decks & Duties
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Maintain local subject question decks, classroom duties, and mystery prompt cards.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[var(--surface-subtle)] self-start">
          <button
            type="button"
            onClick={() => setTab('questions')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'questions' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--ink-muted)]'
            }`}
          >
            Questions ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'tasks' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--ink-muted)]'
            }`}
          >
            Duties & Prompts ({rewards.length})
          </button>
        </div>
      </div>

      {tab === 'questions' ? (
        <div className="space-y-5">
          <form
            onSubmit={handleAddQ}
            className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="q-subject" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                  Subject
                </label>
                <input
                  id="q-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="q-text" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                  Question Text
                </label>
                <div className="flex gap-2">
                  <input
                    id="q-text"
                    type="text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Enter question..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--ink-muted)]">Filter:</span>
                <select
                  aria-label="Filter questions by subject"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink)]"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import CSV (Subject, Question)
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvUpload(f);
                  }}
                />
              </label>
            </div>
            {importMsg && <div className="text-xs font-medium text-[var(--sage)]">{importMsg}</div>}
          </form>

          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] divide-y divide-[var(--border-hairline)]">
            {visibleQuestions.map((q) => (
              <div key={q.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-[var(--accent)]">{q.subject}</div>
                  <div className="text-sm text-[var(--ink)] mt-0.5">{q.text}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteQuestion(q.id)}
                  aria-label={`Delete question: ${q.text}`}
                  className="p-2 rounded-lg text-[var(--crimson)] hover:bg-[var(--crimson-soft)] cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <form
            onSubmit={handleAddTask}
            className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5 flex flex-col sm:flex-row gap-3"
          >
            <select
              aria-label="Prompt category"
              value={itemKind}
              onChange={(e) => setItemKind(e.target.value as RewardChallengeItem['kind'])}
              className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            >
              <option value="duty">Classroom Duty</option>
              <option value="reward">Mystery Reward</option>
              <option value="challenge">Challenge Prompt</option>
            </select>
            <input
              type="text"
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              placeholder="Enter classroom responsibility, reward, or prompt..."
              aria-label="Responsibility or prompt text"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </form>

          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] divide-y divide-[var(--border-hairline)]">
            {rewards.map((item) => {
              const assignedCount = dutyCounts.get(item.text) ?? 0;
              return (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--accent)] capitalize">
                        {item.kind}
                      </span>
                      {item.kind === 'duty' && (
                        <span className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                          · Assigned {assignedCount}x
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--ink)] mt-0.5">{item.text}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRewardItem(item.id)}
                    aria-label={`Delete ${item.text}`}
                    className="p-2 rounded-lg text-[var(--crimson)] hover:bg-[var(--crimson-soft)] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
