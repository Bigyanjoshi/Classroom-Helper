import React, { useEffect, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, RotateCw, ShieldCheck, Upload, X } from 'lucide-react';
import type { ClassRecord, Student } from '../domain/types';
import {
  loadImageFromFile,
  processStudentPhotoLocally,
  type SkinToneValidationResult,
} from '../services/photoProcessor';
import { StudentAvatar } from './StudentAvatar';

interface PhotoUploadModalProps {
  open: boolean;
  classes: ClassRecord[];
  students: Student[];
  initialClassId: string;
  initialStudent?: Student | null;
  onConfirmPhotoReplace: (params: {
    matchedStudentId?: string;
    classId: string;
    rollNumber: string;
    name: string;
    avatarDataUrl: string;
    thumbnailDataUrl: string;
    originalCroppedDataUrl?: string;
    keepOriginal: boolean;
    useOriginalDirectly: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

const BACKDROP_CHOICES = [
  { label: 'Warm Cream', value: '#FDECE1' },
  { label: 'Soft Sage', value: '#EAF3EE' },
  { label: 'Soft Slate', value: '#EEF2F6' },
  { label: 'Gentle Gold', value: '#FBF1D9' },
  { label: 'Transparent', value: 'transparent' },
];

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  open,
  classes,
  students,
  initialClassId,
  initialStudent,
  onConfirmPhotoReplace,
  onClose,
}) => {
  const [step, setStep] = useState<'identify' | 'process'>('identify');
  const [classId, setClassId] = useState(initialClassId || classes[0]?.id || '');
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [confirmedMatch, setConfirmedMatch] = useState(false);

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [zoom, setZoom] = useState(1);
  const [cartoonIntensity, setCartoonIntensity] = useState(3);
  const [backdropColor, setBackdropColor] = useState<string>('#FDECE1');
  const [useOriginalFallback, setUseOriginalFallback] = useState(false);
  const [keepOriginalPhoto, setKeepOriginalPhoto] = useState(false);

  const [cartoonPreviewUrl, setCartoonPreviewUrl] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [validation, setValidation] = useState<SkinToneValidationResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProcessingError(null);
    setLoadedImg(null);
    setCartoonPreviewUrl(null);
    setThumbnailPreviewUrl(null);
    setOriginalPreviewUrl(null);
    setValidation(null);
    setRotationDeg(0);
    setZoom(1);
    setCartoonIntensity(3);
    setUseOriginalFallback(false);
    setKeepOriginalPhoto(false);

    if (initialStudent) {
      setClassId(initialStudent.classId);
      setRollNumber(initialStudent.rollNumber);
      setStudentName(initialStudent.name);
      setMatchedStudent(initialStudent);
      setConfirmedMatch(true);
      setStep('process');
    } else {
      setClassId(initialClassId || classes[0]?.id || '');
      setRollNumber('');
      setStudentName('');
      setMatchedStudent(null);
      setConfirmedMatch(false);
      setStep('identify');
    }
  }, [open, initialStudent, initialClassId, classes]);

  useEffect(() => {
    if (!loadedImg) return;
    try {
      const res = processStudentPhotoLocally(loadedImg, {
        rotationDeg,
        zoom,
        offsetX: 0,
        offsetY: 0,
        cartoonIntensity,
        backdropColor,
      });
      setCartoonPreviewUrl(res.fullDataUrl);
      setThumbnailPreviewUrl(res.thumbnailDataUrl);
      setOriginalPreviewUrl(res.originalCroppedDataUrl);
      setValidation(res.validation);
      setProcessingError(null);
    } catch (err) {
      setValidation(null);
      setProcessingError(
        err instanceof Error
          ? `${err.message} You can still use the original photo or keep a classroom mascot/avatar.`
          : 'Local photo processing failed. You can use the original photo or classroom avatar fallback.'
      );
    }
  }, [loadedImg, rotationDeg, zoom, cartoonIntensity, backdropColor]);

  if (!open) return null;

  const handleFindOrContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingError(null);
    const trimmedRoll = rollNumber.trim();
    const trimmedName = studentName.trim();

    if (!classId || !trimmedRoll || !trimmedName) {
      setProcessingError('Please enter Class, Roll Number, and Student Name.');
      return;
    }

    const match = students.find(
      (s) =>
        s.classId === classId &&
        s.activeStatus === 'active' &&
        s.rollNumber.trim().toLowerCase() === trimmedRoll.toLowerCase()
    );

    if (match && !confirmedMatch) {
      setMatchedStudent(match);
      return;
    }

    setStep('process');
  };

  const handleFileSelected = async (file: File) => {
    setProcessingError(null);
    try {
      const img = await loadImageFromFile(file);
      setLoadedImg(img);
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Unable to load photo.');
    }
  };

  const handleConfirmSave = async () => {
    const finalAvatar = useOriginalFallback ? originalPreviewUrl : cartoonPreviewUrl;
    const finalThumb = useOriginalFallback
      ? originalPreviewUrl
      : thumbnailPreviewUrl ?? cartoonPreviewUrl;
    if (!finalAvatar || !finalThumb) return;

    setSaving(true);
    setProcessingError(null);
    try {
      await onConfirmPhotoReplace({
        matchedStudentId: matchedStudent?.id,
        classId,
        rollNumber: rollNumber.trim(),
        name: matchedStudent ? matchedStudent.name : studentName.trim(),
        avatarDataUrl: finalAvatar,
        thumbnailDataUrl: finalThumb,
        originalCroppedDataUrl: originalPreviewUrl ?? undefined,
        keepOriginal: keepOriginalPhoto,
        useOriginalDirectly: useOriginalFallback,
      });
      onClose();
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Could not update student avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[var(--accent)]" />
            <h2 id="photo-modal-title" className="text-xl font-display font-semibold text-[var(--ink)]">
              Upload Student Photo (On-Device Only)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo upload"
            className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-[var(--surface-subtle)] flex items-start gap-2.5 text-xs text-[var(--ink-muted)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            100% local CIELAB processing. Photos never leave this device or upload to any server. Confirm school or guardian permission before saving a student photograph.
          </span>
        </div>

        {step === 'identify' ? (
          <form onSubmit={handleFindOrContinue} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ph-class" className="block text-sm font-medium text-[var(--ink)] mb-1">
                  Class
                </label>
                <select
                  id="ph-class"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setMatchedStudent(null);
                    setConfirmedMatch(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm"
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
                <label htmlFor="ph-roll" className="block text-sm font-medium text-[var(--ink)] mb-1">
                  Roll Number
                </label>
                <input
                  id="ph-roll"
                  type="text"
                  value={rollNumber}
                  onChange={(e) => {
                    setRollNumber(e.target.value);
                    setMatchedStudent(null);
                    setConfirmedMatch(false);
                  }}
                  placeholder="e.g. 501"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ph-name" className="block text-sm font-medium text-[var(--ink)] mb-1">
                Student Name
              </label>
              <input
                id="ph-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
                className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm"
              />
            </div>

            {matchedStudent && !confirmedMatch && (
              <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <StudentAvatar student={matchedStudent} className="w-14 h-14 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">
                      Existing student matched: {matchedStudent.name} (Roll {matchedStudent.rollNumber})
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Confirming replaces their card portrait without creating a duplicate student.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedMatch(true);
                    setStep('process');
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirm &amp; Continue
                </button>
              </div>
            )}

            {processingError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]"
              >
                {processingError}
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
              {!matchedStudent && (
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer"
                >
                  Continue to Photo
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-[var(--ink-muted)]">Target student: </span>
                <span className="font-semibold text-[var(--ink)]">
                  {matchedStudent
                    ? `${matchedStudent.name} (Roll ${matchedStudent.rollNumber})`
                    : `${studentName} (New · Roll ${rollNumber})`}
                </span>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{loadedImg ? 'Choose Another Photo' : 'Select / Capture Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelected(f);
                  }}
                />
              </label>
            </div>

            {loadedImg ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] flex flex-col items-center">
                    <span className="text-xs font-medium text-[var(--ink-muted)] mb-2">Original Cropped</span>
                    {originalPreviewUrl && (
                      <img
                        src={originalPreviewUrl}
                        alt="Cropped original preview"
                        className="w-40 h-40 rounded-2xl object-cover border border-[var(--border-hairline)]"
                      />
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] flex flex-col items-center">
                    <span className="text-xs font-medium text-[var(--ink-muted)] mb-2">
                      {useOriginalFallback ? 'Using Original Photo' : 'CIELAB Illustrated Portrait'}
                    </span>
                    {(useOriginalFallback ? originalPreviewUrl : cartoonPreviewUrl) && (
                      <img
                        src={(useOriginalFallback ? originalPreviewUrl : cartoonPreviewUrl) ?? ''}
                        alt="Processed avatar preview"
                        className="w-40 h-40 rounded-2xl object-cover border border-[var(--border-hairline)]"
                      />
                    )}
                  </div>
                </div>

                {validation && !useOriginalFallback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      validation.checked && validation.preserved
                        ? 'bg-[var(--sage-soft)] border-[var(--sage)]/30 text-[var(--sage)]'
                        : 'bg-[var(--gold-soft)] border-[var(--gold)]/35 text-[var(--ink)]'
                    }`}
                  >
                    {validation.checked && validation.preserved ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--sage)]" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--gold)]" />
                    )}
                    <span>{validation.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cartoon-intensity"
                      className="flex items-center justify-between text-xs font-medium text-[var(--ink)] mb-1"
                    >
                      <span>Illustration Intensity</span>
                      <span className="font-mono-tabular">{cartoonIntensity} / 5</span>
                    </label>
                    <input
                      id="cartoon-intensity"
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={cartoonIntensity}
                      disabled={useOriginalFallback}
                      onChange={(e) => setCartoonIntensity(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="photo-zoom"
                      className="flex items-center justify-between text-xs font-medium text-[var(--ink)] mb-1"
                    >
                      <span>Crop Zoom</span>
                      <span className="font-mono-tabular">{zoom.toFixed(1)}x</span>
                    </label>
                    <input
                      id="photo-zoom"
                      type="range"
                      min={1}
                      max={2.2}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--ink-muted)]">Backdrop:</span>
                    {BACKDROP_CHOICES.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBackdropColor(b.value)}
                        title={b.label}
                        className={`w-7 h-7 rounded-lg border cursor-pointer ${
                          backdropColor === b.value
                            ? 'ring-2 ring-[var(--accent)] border-[var(--ink)]'
                            : 'border-[var(--border-hairline)]'
                        }`}
                        style={{ backgroundColor: b.value === 'transparent' ? '#ffffff' : b.value }}
                        aria-label={`Backdrop ${b.label}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setRotationDeg((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate 90°
                  </button>
                </div>

                <div className="space-y-2 pt-1 text-xs text-[var(--ink)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useOriginalFallback}
                      onChange={(e) => setUseOriginalFallback(e.target.checked)}
                    />
                    Use original cropped photo directly (fallback without stylization filter)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepOriginalPhoto}
                      onChange={(e) => setKeepOriginalPhoto(e.target.checked)}
                    />
                    Retain original cropped photo locally on device (uncheck to discard original after saving)
                  </label>
                </div>
              </>
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-[var(--border-hairline)] text-center text-sm text-[var(--ink-muted)]">
                Choose a photograph from your device or camera to preview the local CIELAB portrait (saves a fast 256px card thumbnail and 512px studio portrait).
              </div>
            )}

            {processingError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]"
              >
                {processingError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('identify')}
                className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!loadedImg || saving}
                  onClick={handleConfirmSave}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : matchedStudent ? 'Replace Student Avatar' : 'Create Student & Card'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
