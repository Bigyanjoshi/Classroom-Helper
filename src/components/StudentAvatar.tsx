import React, { useEffect, useMemo, useState } from 'react';
import { avatarSvgToDataUrl } from '../domain/avatarGenerator';
import type { Student } from '../domain/types';
import { getBlobDataUrl } from '../services/db';

interface StudentAvatarProps {
  student: Student;
  className?: string;
  celebrate?: boolean;
  sizeVariant?: 'thumb' | 'full';
  alt?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  className = 'w-20 h-20',
  celebrate = false,
  sizeVariant = 'thumb',
  alt,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const targetBlobId =
    sizeVariant === 'full'
      ? student.fullBlobId ?? student.avatarBlobId
      : student.thumbnailBlobId ?? student.avatarBlobId;

  useEffect(() => {
    let cancelled = false;
    if (student.avatarSource === 'photo' && targetBlobId) {
      getBlobDataUrl(targetBlobId).then((url) => {
        if (!cancelled) setBlobUrl(url);
      });
    } else {
      setBlobUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [student.avatarSource, targetBlobId]);

  const fallbackSvgUrl = useMemo(() => avatarSvgToDataUrl(student.avatarConfig), [student.avatarConfig]);
  const src = student.avatarSource === 'photo' && blobUrl ? blobUrl : fallbackSvgUrl;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[var(--surface-subtle)] ${className} ${
        celebrate ? 'animate-celebrate' : ''
      }`}
    >
      <img
        src={src}
        alt={alt ?? `${student.name} avatar`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover select-none"
        draggable={false}
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== fallbackSvgUrl) {
            target.src = fallbackSvgUrl;
          }
        }}
      />
    </div>
  );
};
