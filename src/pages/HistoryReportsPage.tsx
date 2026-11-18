import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { computeDutyTitleCounts, getActivityDisplayLabel } from '../domain/eligibility';
import { sortStudentsNaturally } from '../domain/random';
import type {
  ActivityRecord,
  ActivitySelection,
  ClassRecord,
  ClassSession,
  RewardChallengeItem,
  Student,
} from '../domain/types';
import { buildCsvDocument, downloadTextFile } from '../services/exportService';

interface HistoryReportsPageProps {
  classes: ClassRecord[];
  students: Student[];
  sessions: ClassSession[];
  activities: ActivityRecord[];
  selections: ActivitySelection[];
  rewards?: RewardChallengeItem[];
}

export const HistoryReportsPage: React.FC<HistoryReportsPageProps> = ({
  classes,
  students,
  sessions,
  activities,
  selections,
  rewards = [],
}) => {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const activityMap = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  const validSelections = useMemo(
    () =>
      selections
        .filter((s) => !s.undoneAt)
        .filter((s) => (classFilter === 'all' ? true : s.classId === classFilter))
        .filter((s) => {
          if (activityFilter === 'all') return true;
          const act = activityMap.get(s.activityId);
          return act?.type === activityFilter;
        }),
    [selections, classFilter, activityFilter, activityMap]
  );

  // Real participation totals per student (only from local selection records)
  const participationRows = useMemo(() => {
    const filteredStudents = sortStudentsNaturally(
      students.filter((s) => (classFilter === 'all' ? true : s.classId === classFilter))
    );

    return filteredStudents.map((stu) => {
      const stuSels = validSelections.filter((sel) => sel.studentId === stu.id);
      const last = stuSels.reduce((max, sel) => Math.max(max, sel.selectedAt), 0);
      return {
        student: stu,
        className: classMap.get(stu.classId) ?? '',
        count: stuSels.length,
        lastSelectedAt: last > 0 ? last : null,
      };
    });
  }, [students, classFilter, validSelections, classMap]);

  const dutyCounts = useMemo(
    () => computeDutyTitleCounts(validSelections, classFilter === 'all' ? undefined : classFilter),
    [validSelections, classFilter]
  );

  const filteredSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => (classFilter === 'all' ? true : s.classId === classFilter))
        .sort((a, b) => b.startedAt - a.startedAt),
    [sessions, classFilter]
  );

  const handleExportParticipationCsv = () => {
    const csv = buildCsvDocument(
      ['Roll Number', 'Student Name', 'Class', 'Status', 'Total Selections', 'Last Selected'],
      participationRows.map((r) => [
        r.student.rollNumber,
        r.student.name,
        r.className,
        r.student.activeStatus,
        r.count,
        r.lastSelectedAt ? new Date(r.lastSelectedAt).toLocaleString() : 'Never',
      ])
    );
    downloadTextFile('classroom-participation-report.csv', csv, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)]">
            Participation & Session Logs
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Teacher-only report computed strictly from real local attendance and activity records.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportParticipationCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)]">
        <select
          aria-label="Filter history by class"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
        >
          <option value="all">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          aria-label="Filter history by activity"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
        >
          <option value="all">All Activities</option>
          <option value="single_pick">{getActivityDisplayLabel('single_pick')}</option>
          <option value="two_toss">{getActivityDisplayLabel('two_toss')}</option>
          <option value="groups">{getActivityDisplayLabel('groups')}</option>
          <option value="student_question">{getActivityDisplayLabel('student_question')}</option>
          <option value="lucky_picker">{getActivityDisplayLabel('lucky_picker')}</option>
          <option value="mystery_reward">{getActivityDisplayLabel('mystery_reward')}</option>
        </select>
      </div>

      {/* Duty Assignment Summary */}
      {dutyCounts.size > 0 && (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5 space-y-3">
          <h2 className="text-base font-display font-bold text-[var(--ink)]">
            Classroom Duty Totals
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from(dutyCounts.entries()).map(([dutyName, total]) => (
              <div key={dutyName} className="p-3 rounded-xl bg-[var(--surface-subtle)]">
                <div className="text-xs font-medium text-[var(--ink-muted)] truncate">{dutyName}</div>
                <div className="text-lg font-mono-tabular font-bold text-[var(--ink)] mt-0.5">
                  {total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Selection Totals */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-[var(--ink)]">
            Participation Overview ({participationRows.length} students)
          </h2>
          <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
            {validSelections.length} total recorded selections
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--ink-muted)]">
              <tr>
                <th className="py-2.5 px-4">Roll</th>
                <th className="py-2.5 px-4">Student</th>
                <th className="py-2.5 px-4">Class</th>
                <th className="py-2.5 px-4">Selections</th>
                <th className="py-2.5 px-4">Last Selected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {participationRows.map((row) => (
                <tr key={row.student.id}>
                  <td className="py-2.5 px-4 font-mono-tabular">{row.student.rollNumber}</td>
                  <td className="py-2.5 px-4 font-medium text-[var(--ink)]">{row.student.name}</td>
                  <td className="py-2.5 px-4 text-[var(--ink-muted)]">{row.className}</td>
                  <td className="py-2.5 px-4 font-mono-tabular font-semibold">{row.count}</td>
                  <td className="py-2.5 px-4 text-xs font-mono-tabular text-[var(--ink-muted)]">
                    {row.lastSelectedAt ? new Date(row.lastSelectedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Timeline & Attendance Audit Log */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5 space-y-4">
        <h2 className="text-base font-display font-bold text-[var(--ink)]">
          Recorded Sessions & Attendance Log ({filteredSessions.length})
        </h2>
        {filteredSessions.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            No sessions recorded for this filter yet.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((sess) => {
              const sessSels = validSelections
                .filter((s) => s.sessionId === sess.id)
                .sort((a, b) => a.selectedAt - b.selectedAt);
              const absentNames = sess.absentStudentIds
                .map((id) => studentMap.get(id)?.name)
                .filter(Boolean);
              const lateNames = (sess.lateArrivalsIds ?? [])
                .map((id) => studentMap.get(id)?.name)
                .filter(Boolean);
              const earlyNames = (sess.earlyDeparturesIds ?? [])
                .map((id) => studentMap.get(id)?.name)
                .filter(Boolean);
              const logEntries = sess.attendanceLog ?? [];

              return (
                <div key={sess.id} className="p-4 rounded-xl bg-[var(--surface-subtle)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[var(--ink)]">
                      {classMap.get(sess.classId) ?? 'Class'} · {sess.status === 'active' ? 'Session Active' : 'Completed'}
                    </div>
                    <div className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                      {new Date(sess.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">
                    Absent ({absentNames.length}): {absentNames.length > 0 ? absentNames.join(', ') : 'None'}
                    {lateNames.length > 0 && ` · Late arrivals: ${lateNames.join(', ')}`}
                    {earlyNames.length > 0 && ` · Left early: ${earlyNames.join(', ')}`}
                  </div>
                  {logEntries.length > 0 && (
                    <div className="text-[11px] text-[var(--ink-muted)] pt-1 border-t border-[var(--border-hairline)]/60">
                      Mid-session updates:{' '}
                      {logEntries
                        .map((entry) => {
                          const sName = studentMap.get(entry.studentId)?.name ?? 'Student';
                          const kindLabel =
                            entry.type === 'late_arrival'
                              ? 'arrived late'
                              : entry.type === 'left_early'
                                ? 'left early'
                                : entry.type.replace('_', ' ');
                          return `${sName} (${kindLabel} at ${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                        })
                        .join(' · ')}
                    </div>
                  )}
                  <div className="text-xs text-[var(--ink)]">
                    Selected ({sessSels.length}):{' '}
                    {sessSels.length > 0
                      ? sessSels
                          .map((sel, i) => `${i + 1}. ${studentMap.get(sel.studentId)?.name ?? 'Student'}`)
                          .join(' · ')
                      : 'No selections in this session'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
