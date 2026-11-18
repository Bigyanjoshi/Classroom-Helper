import React, { useRef, useState } from 'react';
import { Download, Lock, Share2, ShieldAlert, Smartphone, Trash2, Upload, X } from 'lucide-react';
import {
  analyzeBackupConflicts,
  createEncryptedClasspack,
  decryptClasspack,
  type BackupProgressInfo,
  type ClasspackPayload,
  type RestoreConflictSummary,
} from '../domain/cryptoBackup';
import type { AppSettings, FairnessScope, RepeatPolicy, SelectionMode } from '../domain/types';
import { db } from '../services/db';
import { downloadTextFile } from '../services/exportService';
import { usePWAInstall } from '../services/pwaHook';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface SettingsBackupPageProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onRestoreBackup: (
    payload: ClasspackPayload,
    mode: 'replace' | 'merge_skip'
  ) => Promise<void>;
  onDestructiveResetAllData: () => Promise<void>;
}

function formatProgressLabel(info: BackupProgressInfo): string {
  if (info.phase === 'deriving_key') return 'Preparing backup...';
  if (info.phase === 'processing_chunks') {
    return `Processing part ${info.completedChunks} of ${info.totalChunks}...`;
  }
  return 'Verifying backup...';
}

export const SettingsBackupPage: React.FC<SettingsBackupPageProps> = ({
  settings,
  onUpdateSettings,
  onRestoreBackup,
  onDestructiveResetAllData,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Encrypted Export
  const [exportPass, setExportPass] = useState('');
  const [exportConfirmPass, setExportConfirmPass] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<BackupProgressInfo | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // Encrypted Import
  const [rawBackupText, setRawBackupText] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importPass, setImportPass] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState<BackupProgressInfo | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<ClasspackPayload | null>(null);
  const [conflictSummary, setConflictSummary] = useState<RestoreConflictSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge_skip' | 'replace'>('merge_skip');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const handleShareClassroomHelper = async () => {
    setShareFeedback(null);
    const shareUrl = window.location.origin;
    const shareTitle = 'Classroom Helper';
    const shareText =
      'Classroom Helper — 3D Student Randomizer, Bikram Sambat Daily Attendance Register, and 3D Character Studio.';

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          const response = await fetch('/pwa-512x512.png');
          const blob = await response.blob();
          const iconFile = new File([blob], 'classroom-helper-icon.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [iconFile] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl,
              files: [iconFile],
            });
            setShareFeedback('Shared Classroom Helper with its 3D application icon.');
            return;
          }
        } catch {
          // Fall back to standard URL share if file sharing is not supported by the target app
        }
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setShareFeedback('Shared Classroom Helper link.');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Classroom Helper app link copied to clipboard.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setShareFeedback('Could not open share sheet on this browser.');
    }
  };

  const handleDownloadAppIcon = () => {
    const a = document.createElement('a');
    a.href = '/pwa-512x512.png';
    a.download = 'classroom-helper-3d-icon-512x512.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareFeedback('Downloaded Classroom Helper 3D icon (512×512 PNG) to your device file manager.');
  };

  const handleExportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError(null);
    setExportStatus(null);
    if (exportPass.length < 4) {
      setExportError('Choose a password with at least 4 characters.');
      return;
    }
    if (exportPass !== exportConfirmPass) {
      setExportError('Passwords do not match.');
      return;
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportBusy(true);
    setExportProgress({ phase: 'deriving_key', completedChunks: 0, totalChunks: 1 });

    try {
      const [
        classes,
        students,
        blobs,
        sessions,
        activities,
        selections,
        questions,
        rewards,
        dailyAttendance,
      ] = await Promise.all([
        db.classes.toArray(),
        db.students.toArray(),
        db.blobs.toArray(),
        db.sessions.toArray(),
        db.activities.toArray(),
        db.selections.toArray(),
        db.questions.toArray(),
        db.rewards.toArray(),
        db.dailyAttendance.toArray(),
      ]);

      const encrypted = await createEncryptedClasspack(
        {
          classes,
          students,
          blobs,
          sessions,
          activities,
          selections,
          questions,
          rewards,
          dailyAttendance,
          settings,
        },
        exportPass,
        {
          signal: controller.signal,
          onProgress: (info) => setExportProgress(info),
        }
      );

      const now = Date.now();
      const dateStr = new Date(now).toISOString().slice(0, 10);
      downloadTextFile(`classroom-helper-backup-${dateStr}.classpack`, encrypted, 'application/json');
      await onUpdateSettings({ lastBackupAt: now, lastBackupV2At: now });
      setExportPass('');
      setExportConfirmPass('');
      setExportStatus('Encrypted V2 .classpack backup created and downloaded.');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to create backup.');
    } finally {
      setExportBusy(false);
      setExportProgress(null);
      exportAbortRef.current = null;
    }
  };

  const handleDecryptPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccess(null);
    if (!rawBackupText) return;

    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportBusy(true);
    setImportProgress({ phase: 'deriving_key', completedChunks: 0, totalChunks: 1 });

    try {
      const payload = await decryptClasspack(rawBackupText, importPass, {
        signal: controller.signal,
        onProgress: (info) => setImportProgress(info),
      });
      const [existingClasses, existingStudents] = await Promise.all([
        db.classes.toArray(),
        db.students.toArray(),
      ]);
      const conflicts = analyzeBackupConflicts(payload.data, existingClasses, existingStudents);
      setDecryptedPayload(payload);
      setConflictSummary(conflicts);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to decrypt backup.');
      setDecryptedPayload(null);
      setConflictSummary(null);
    } finally {
      setImportBusy(false);
      setImportProgress(null);
      importAbortRef.current = null;
    }
  };

  const handleConfirmRestore = async () => {
    if (!decryptedPayload) return;
    setImportError(null);
    try {
      await onRestoreBackup(decryptedPayload, restoreMode);
      setImportSuccess(
        restoreMode === 'replace'
          ? 'All local data restored from backup.'
          : 'Backup merged cleanly without overwriting existing records.'
      );
      setDecryptedPayload(null);
      setConflictSummary(null);
      setRawBackupText(null);
      setImportPass('');
      setImportFileName('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--ink)]">
          Settings &amp; Backup
        </h1>
      </div>

      {/* Classroom Helper 3D App Identity, Home Screen Install & File Manager Share */}
      <section
        data-testid="settings-app-identity-card"
        className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/pwa-512x512.png"
              alt="Classroom Helper"
              data-testid="settings-3d-app-icon"
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[var(--border-hairline)]"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
                <Smartphone className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>App Icon &amp; Install</span>
              </div>
              <h2 className="text-lg font-display font-bold text-[var(--ink)]">
                Classroom Helper
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install App
              </button>
            )}
            <button
              type="button"
              data-testid="settings-share-app-btn"
              onClick={handleShareClassroomHelper}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--border-hairline)]/50 border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              Share App
            </button>
            <button
              type="button"
              data-testid="settings-download-icon-btn"
              onClick={handleDownloadAppIcon}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              Save Icon
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="text-xs font-medium text-[var(--sage)] bg-[var(--sage-soft)] px-3 py-2 rounded-lg">
            {shareFeedback}
          </div>
        )}
      </section>

      {/* App Preferences */}
      <section className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 space-y-4">
        <h2 className="text-base font-display font-bold text-[var(--ink)]">
          Defaults
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="pref-mode" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
              Selection Mode
            </label>
            <select
              id="pref-mode"
              value={settings.defaultSelectionMode}
              onChange={(e) => onUpdateSettings({ defaultSelectionMode: e.target.value as SelectionMode })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            >
              <option value="pure_random">Pure Random</option>
              <option value="balanced">Balanced</option>
              <option value="least_recent">Least Recent</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-repeat" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
              Repeat Policy
            </label>
            <select
              id="pref-repeat"
              value={settings.defaultRepeatPolicy}
              onChange={(e) => onUpdateSettings({ defaultRepeatPolicy: e.target.value as RepeatPolicy })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            >
              <option value="no_repeat">No Repeat</option>
              <option value="allow_repeat">Allow Repeat</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-scope" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
              Fairness History
            </label>
            <select
              id="pref-scope"
              value={settings.fairnessScope}
              onChange={(e) => onUpdateSettings({ fairnessScope: e.target.value as FairnessScope })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            >
              <option value="current_session">Current Session</option>
              <option value="recent_sessions">Recent 5 Sessions</option>
              <option value="all_history">All History</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-sm text-[var(--ink)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Sound effects
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.hapticsEnabled ?? true}
              onChange={(e) => onUpdateSettings({ hapticsEnabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Haptic vibration
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.keyboardShortcutsEnabled ?? true}
              onChange={(e) => onUpdateSettings({ keyboardShortcutsEnabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Keyboard shortcuts
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => onUpdateSettings({ reduceMotion: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Reduce motion
          </label>
        </div>
      </section>

      {/* Manual Encrypted Backup & Restore */}
      <section className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-base font-display font-bold text-[var(--ink)]">
              Backup &amp; Restore
            </h2>
          </div>
          {(settings.lastBackupV2At || settings.lastBackupAt) && (
            <span className="text-xs text-[var(--ink-muted)]">
              Last backup:{' '}
              {new Date(settings.lastBackupV2At ?? settings.lastBackupAt!).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export */}
          <form onSubmit={handleExportBackup} className="p-4 rounded-xl bg-[var(--surface-subtle)] space-y-2.5">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Export Backup</h3>
            <input
              type="password"
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              disabled={exportBusy}
              placeholder="Password (min 4 chars)"
              aria-label="Backup export password"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            />
            <input
              type="password"
              value={exportConfirmPass}
              onChange={(e) => setExportConfirmPass(e.target.value)}
              disabled={exportBusy}
              placeholder="Confirm password"
              aria-label="Confirm backup export password"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
            />

            {exportBusy && exportProgress && (
              <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2 text-[var(--ink)]">
                  <span>{formatProgressLabel(exportProgress)}</span>
                  <button
                    type="button"
                    onClick={() => exportAbortRef.current?.abort()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--crimson-soft)] text-[var(--crimson)] font-semibold cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--canvas)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{
                      width: `${Math.max(
                        10,
                        Math.round(
                          (exportProgress.completedChunks / Math.max(1, exportProgress.totalChunks)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {exportError && <div role="alert" className="text-xs font-medium text-[var(--crimson)]">{exportError}</div>}
            {exportStatus && <div className="text-xs font-medium text-[var(--sage)]">{exportStatus}</div>}

            <button
              type="submit"
              disabled={exportBusy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {exportBusy ? 'Encrypting Backup...' : 'Download .classpack Backup'}
            </button>
          </form>

          {/* Import */}
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] space-y-2.5">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Restore Backup</h3>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{importFileName || 'Choose .classpack File'}</span>
              <input
                type="file"
                accept=".classpack,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportError(null);
                  setImportSuccess(null);
                  setDecryptedPayload(null);
                  setImportFileName(file.name);
                  setRawBackupText(await file.text());
                }}
              />
            </label>

            {rawBackupText && !decryptedPayload && (
              <form onSubmit={handleDecryptPreview} className="space-y-2.5 pt-1">
                <input
                  type="password"
                  value={importPass}
                  onChange={(e) => setImportPass(e.target.value)}
                  disabled={importBusy}
                  placeholder="Enter backup password"
                  aria-label="Backup import password"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                />

                {importBusy && importProgress && (
                  <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--ink)]">{formatProgressLabel(importProgress)}</span>
                    <button
                      type="button"
                      onClick={() => importAbortRef.current?.abort()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--crimson-soft)] text-[var(--crimson)] font-semibold cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={importBusy}
                  className="w-full py-2 px-4 rounded-xl bg-[var(--ink)] text-[var(--canvas)] text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {importBusy ? 'Verifying...' : 'Verify & Preview Backup'}
                </button>
              </form>
            )}

            {decryptedPayload && conflictSummary && (
              <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--ink)]">
                    Verified Preview ({new Date(decryptedPayload.exportedAt).toLocaleDateString()})
                  </span>
                  <span className="text-[11px] font-mono-tabular font-semibold text-[var(--sage)]">
                    {decryptedPayload.version === 2 ? 'Format V2' : 'Legacy V1'}
                  </span>
                </div>
                <div className="font-mono-tabular text-[var(--ink-muted)]">
                  {conflictSummary.incomingClasses} classes · {conflictSummary.incomingStudents} students · {conflictSummary.incomingSessions} sessions · {conflictSummary.incomingQuestions} questions
                </div>
                {(conflictSummary.conflictingClassIds.length > 0 ||
                  conflictSummary.conflictingStudentIds.length > 0 ||
                  conflictSummary.duplicateRollConflicts.length > 0) && (
                  <div className="text-[var(--gold)] font-medium">
                    Conflicts: {conflictSummary.conflictingClassIds.length} classes, {conflictSummary.conflictingStudentIds.length} student IDs, {conflictSummary.duplicateRollConflicts.length} matching roll numbers.
                  </div>
                )}

                <select
                  aria-label="Restore conflict strategy"
                  value={restoreMode}
                  onChange={(e) => setRestoreMode(e.target.value as 'merge_skip' | 'replace')}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)]"
                >
                  <option value="merge_skip">Safe Merge (Add new records, skip existing conflicts)</option>
                  <option value="replace">Full Replace (Overwrite all current local data)</option>
                </select>

                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="w-full py-2 rounded-lg bg-[var(--accent)] text-white font-semibold cursor-pointer"
                >
                  Apply Restore
                </button>
              </div>
            )}

            {importError && <div role="alert" className="text-xs font-medium text-[var(--crimson)]">{importError}</div>}
            {importSuccess && <div className="text-xs font-medium text-[var(--sage)]">{importSuccess}</div>}
          </div>
        </div>
      </section>

      {/* Destructive Reset (Isolated in Settings Only) */}
      <section className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--crimson)]">
          <ShieldAlert className="w-4 h-4" />
          <h2 className="text-sm font-bold">Reset All Data</h2>
        </div>
        <button
          type="button"
          onClick={() => setConfirmResetAll(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--crimson-soft)] hover:bg-[var(--crimson)] hover:text-white text-xs font-semibold text-[var(--crimson)] cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Erase Local Data
        </button>
      </section>

      <ConfirmDialog
        open={confirmResetAll}
        title="Erase All Local Classroom Data?"
        description="This will permanently delete all students, avatars, photos, sessions, questions, and history from this browser. Make sure you downloaded a .classpack backup first."
        confirmLabel="Yes, Erase Everything"
        destructive
        onCancel={() => setConfirmResetAll(false)}
        onConfirm={async () => {
          setConfirmResetAll(false);
          await onDestructiveResetAllData();
        }}
      />
    </div>
  );
};
