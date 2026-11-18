import type {
  ActivityRecord,
  ActivitySelection,
  AppSettings,
  ClassRecord,
  ClassSession,
  DailyAttendanceRecord,
  QuestionItem,
  RewardChallengeItem,
  StoredBlob,
  Student,
} from './types';

export const CLASSPACK_FORMAT = 'classroom-randomizer-classpack';
export const CLASSPACK_VERSION_V1 = 1;
export const CLASSPACK_VERSION_V2 = 2;

export const CLASSPACK_V2_ITERATIONS = 600_000;
export const MIN_CHUNK_BYTES = 256 * 1024;
export const MAX_CHUNK_BYTES = 1024 * 1024;
export const DEFAULT_CHUNK_BYTES = 512 * 1024;

export interface ClasspackPayload {
  format: typeof CLASSPACK_FORMAT;
  version: number;
  exportedAt: number;
  checksumSha256: string;
  data: {
    classes: ClassRecord[];
    students: Student[];
    blobs: StoredBlob[];
    sessions: ClassSession[];
    activities: ActivityRecord[];
    selections: ActivitySelection[];
    questions: QuestionItem[];
    rewards: RewardChallengeItem[];
    dailyAttendance?: DailyAttendanceRecord[];
    settings?: AppSettings;
  };
}

export interface EncryptedClasspackV1Envelope {
  magic: 'CLASSPACK_V1';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-GCM-256';
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}

export interface EncryptedClasspackV2Chunk {
  chunkIndex: number;
  ivB64: string;
  ciphertextB64: string;
  plaintextByteLength: number;
}

export interface EncryptedClasspackV2Envelope {
  magic: 'CLASSPACK_V2';
  version: 2;
  backupId: string;
  exportedAt: number;
  kdf: 'PBKDF2-SHA512';
  iterations: number;
  cipher: 'AES-GCM-256';
  saltB64: string;
  chunkSizeBytes: number;
  chunkCount: number;
  totalPlaintextBytes: number;
  checksumSha256: string;
  chunks: EncryptedClasspackV2Chunk[];
}

export type EncryptedClasspackEnvelope =
  | EncryptedClasspackV1Envelope
  | EncryptedClasspackV2Envelope;

export interface BackupProgressInfo {
  phase: 'deriving_key' | 'processing_chunks' | 'verifying';
  completedChunks: number;
  totalChunks: number;
}

export interface BackupCryptoOptions {
  chunkSizeBytes?: number;
  onProgress?: (info: BackupProgressInfo) => void;
  signal?: AbortSignal;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('Backup operation was cancelled.');
  }
}

function getSubtleCrypto(): SubtleCrypto {
  const c = globalThis.crypto?.subtle;
  if (!c) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return c;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function computeSha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSha256Hex(text: string): Promise<string> {
  return computeSha256HexFromBytes(new TextEncoder().encode(text));
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  hash: 'SHA-256' | 'SHA-512'
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function buildChunkAadBytes(params: {
  backupId: string;
  chunkIndex: number;
  chunkCount: number;
  exportedAt: number;
}): Uint8Array {
  const aadJson = JSON.stringify({
    magic: 'CLASSPACK_V2',
    version: CLASSPACK_VERSION_V2,
    backupId: params.backupId,
    chunkIndex: params.chunkIndex,
    chunkCount: params.chunkCount,
    exportedAt: params.exportedAt,
  });
  return new TextEncoder().encode(aadJson);
}

function normalizeChunkSize(requested?: number): number {
  if (requested === undefined) return DEFAULT_CHUNK_BYTES;
  return Math.max(MIN_CHUNK_BYTES, Math.min(MAX_CHUNK_BYTES, Math.floor(requested)));
}

function stripNonSerializableBlobHandles(data: ClasspackPayload['data']): ClasspackPayload['data'] {
  return {
    ...data,
    blobs: data.blobs.map((b) => ({
      id: b.id,
      mimeType: b.mimeType,
      dataUrl: b.dataUrl,
      byteSize: b.byteSize,
      createdAt: b.createdAt,
    })),
  };
}

/**
 * Exports a Spec v2.0 chunked encrypted `.classpack` backup using:
 * - PBKDF2-SHA512 (600,000 iterations)
 * - AES-256-GCM with unique random 12-byte IV per chunk
 * - Bounded 256KB-1MB sequential chunks with authenticated chunk metadata AAD
 * - Full SHA-256 integrity verification
 */
export async function createEncryptedClasspack(
  rawData: ClasspackPayload['data'],
  password: string,
  options?: BackupCryptoOptions
): Promise<string> {
  assertNotAborted(options?.signal);
  if (!password || password.length < 4) {
    throw new Error('Please choose a backup password of at least 4 characters.');
  }

  const data = stripNonSerializableBlobHandles(rawData);
  const exportedAt = Date.now();
  const backupId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `bak_${exportedAt.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

  const chunkSizeBytes = normalizeChunkSize(options?.chunkSizeBytes);

  // Serialize deterministically inside UTF-8 bytes and compute SHA-256 integrity digest
  const serializedDataText = JSON.stringify(data);
  const checksumSha256 = await computeSha256Hex(serializedDataText);

  const payload: ClasspackPayload = {
    format: CLASSPACK_FORMAT,
    version: CLASSPACK_VERSION_V2,
    exportedAt,
    checksumSha256,
    data,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const totalPlaintextBytes = payloadBytes.byteLength;
  const chunkCount = Math.max(1, Math.ceil(totalPlaintextBytes / chunkSizeBytes));

  assertNotAborted(options?.signal);
  options?.onProgress?.({ phase: 'deriving_key', completedChunks: 0, totalChunks: chunkCount });

  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const key = await deriveAesKey(password, salt, CLASSPACK_V2_ITERATIONS, 'SHA-512');

  const chunks: EncryptedClasspackV2Chunk[] = [];
  const subtle = getSubtleCrypto();

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    assertNotAborted(options?.signal);
    const start = chunkIndex * chunkSizeBytes;
    const end = Math.min(totalPlaintextBytes, start + chunkSizeBytes);
    const slice = payloadBytes.subarray(start, end);

    const iv = new Uint8Array(12);
    globalThis.crypto.getRandomValues(iv);

    const aad = buildChunkAadBytes({
      backupId,
      chunkIndex,
      chunkCount,
      exportedAt,
    });

    const encrypted = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        additionalData: aad as BufferSource,
      },
      key,
      slice as BufferSource
    );

    chunks.push({
      chunkIndex,
      ivB64: toBase64(iv),
      ciphertextB64: toBase64(new Uint8Array(encrypted)),
      plaintextByteLength: slice.byteLength,
    });

    options?.onProgress?.({
      phase: 'processing_chunks',
      completedChunks: chunkIndex + 1,
      totalChunks: chunkCount,
    });

    // Yield control between chunks so UI/abort stays responsive on mid-range mobile devices
    await Promise.resolve();
  }

  const envelope: EncryptedClasspackV2Envelope = {
    magic: 'CLASSPACK_V2',
    version: 2,
    backupId,
    exportedAt,
    kdf: 'PBKDF2-SHA512',
    iterations: CLASSPACK_V2_ITERATIONS,
    cipher: 'AES-GCM-256',
    saltB64: toBase64(salt),
    chunkSizeBytes,
    chunkCount,
    totalPlaintextBytes,
    checksumSha256,
    chunks,
  };

  return JSON.stringify(envelope);
}

/**
 * Legacy V1 export helper kept strictly for backward-compatibility unit tests.
 */
export async function createEncryptedClasspackV1Legacy(
  rawData: ClasspackPayload['data'],
  password: string
): Promise<string> {
  const data = stripNonSerializableBlobHandles(rawData);
  const checksumSha256 = await computeSha256Hex(JSON.stringify(data));
  const payload: ClasspackPayload = {
    format: CLASSPACK_FORMAT,
    version: CLASSPACK_VERSION_V1,
    exportedAt: Date.now(),
    checksumSha256,
    data,
  };

  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveAesKey(password, salt, 150_000, 'SHA-256');
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBuffer = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );

  const envelope: EncryptedClasspackV1Envelope = {
    magic: 'CLASSPACK_V1',
    kdf: 'PBKDF2-SHA256',
    iterations: 150_000,
    cipher: 'AES-GCM-256',
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(encryptedBuffer)),
  };

  return JSON.stringify(envelope, null, 2);
}

async function decryptClasspackV1(
  envelope: EncryptedClasspackV1Envelope,
  password: string,
  options?: BackupCryptoOptions
): Promise<ClasspackPayload> {
  assertNotAborted(options?.signal);
  options?.onProgress?.({ phase: 'deriving_key', completedChunks: 0, totalChunks: 1 });

  const salt = fromBase64(envelope.saltB64);
  const iv = fromBase64(envelope.ivB64);
  const ciphertext = fromBase64(envelope.ciphertextB64);

  let decryptedBuffer: ArrayBuffer;
  try {
    const key = await deriveAesKey(password, salt, envelope.iterations || 150_000, 'SHA-256');
    decryptedBuffer = await getSubtleCrypto().decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
  } catch {
    throw new Error('Incorrect password or corrupted V1 backup file.');
  }

  options?.onProgress?.({ phase: 'verifying', completedChunks: 1, totalChunks: 1 });

  let payload: ClasspackPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decryptedBuffer)) as ClasspackPayload;
  } catch {
    throw new Error('Decrypted backup data is malformed.');
  }

  if (payload.format !== CLASSPACK_FORMAT || !payload.data) {
    throw new Error('Backup payload does not belong to Classroom Helper.');
  }

  const recomputedChecksum = await computeSha256Hex(JSON.stringify(payload.data));
  if (recomputedChecksum !== payload.checksumSha256) {
    throw new Error('Backup integrity check failed (checksum mismatch).');
  }

  return payload;
}

async function decryptClasspackV2(
  envelope: EncryptedClasspackV2Envelope,
  password: string,
  options?: BackupCryptoOptions
): Promise<ClasspackPayload> {
  assertNotAborted(options?.signal);

  if (
    envelope.version !== 2 ||
    envelope.kdf !== 'PBKDF2-SHA512' ||
    envelope.cipher !== 'AES-GCM-256' ||
    !Array.isArray(envelope.chunks) ||
    envelope.chunkCount < 1 ||
    envelope.chunks.length !== envelope.chunkCount
  ) {
    throw new Error('Corrupted or truncated V2 backup envelope.');
  }

  const iterations = Math.max(100_000, envelope.iterations || CLASSPACK_V2_ITERATIONS);
  options?.onProgress?.({
    phase: 'deriving_key',
    completedChunks: 0,
    totalChunks: envelope.chunkCount,
  });

  const salt = fromBase64(envelope.saltB64);
  const key = await deriveAesKey(password, salt, iterations, 'SHA-512');
  const subtle = getSubtleCrypto();

  const assembled = new Uint8Array(envelope.totalPlaintextBytes);
  let writeOffset = 0;

  for (let i = 0; i < envelope.chunkCount; i++) {
    assertNotAborted(options?.signal);
    const chunk = envelope.chunks[i];
    if (!chunk || chunk.chunkIndex !== i) {
      throw new Error(`Backup chunk sequence mismatch at chunk ${i}.`);
    }

    const iv = fromBase64(chunk.ivB64);
    const ciphertext = fromBase64(chunk.ciphertextB64);
    if (iv.byteLength !== 12) {
      throw new Error('Invalid chunk initialization vector in backup.');
    }

    const aad = buildChunkAadBytes({
      backupId: envelope.backupId,
      chunkIndex: i,
      chunkCount: envelope.chunkCount,
      exportedAt: envelope.exportedAt,
    });

    let decryptedChunk: ArrayBuffer;
    try {
      decryptedChunk = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          additionalData: aad as BufferSource,
        },
        key,
        ciphertext as BufferSource
      );
    } catch {
      throw new Error('Incorrect password or tampered V2 backup chunk.');
    }

    const chunkBytes = new Uint8Array(decryptedChunk);
    if (
      chunkBytes.byteLength !== chunk.plaintextByteLength ||
      writeOffset + chunkBytes.byteLength > assembled.byteLength
    ) {
      throw new Error('Backup chunk length verification failed.');
    }

    assembled.set(chunkBytes, writeOffset);
    writeOffset += chunkBytes.byteLength;

    options?.onProgress?.({
      phase: 'processing_chunks',
      completedChunks: i + 1,
      totalChunks: envelope.chunkCount,
    });

    await Promise.resolve();
  }

  if (writeOffset !== envelope.totalPlaintextBytes) {
    throw new Error('Backup appears truncated (byte count mismatch).');
  }

  options?.onProgress?.({
    phase: 'verifying',
    completedChunks: envelope.chunkCount,
    totalChunks: envelope.chunkCount,
  });

  let payload: ClasspackPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(assembled)) as ClasspackPayload;
  } catch {
    throw new Error('Decrypted V2 backup payload is malformed.');
  }

  if (payload.format !== CLASSPACK_FORMAT || !payload.data) {
    throw new Error('Backup payload does not belong to Classroom Helper.');
  }

  const recomputedChecksum = await computeSha256Hex(JSON.stringify(payload.data));
  if (
    recomputedChecksum !== payload.checksumSha256 ||
    recomputedChecksum !== envelope.checksumSha256
  ) {
    throw new Error('Backup integrity check failed (SHA-256 mismatch).');
  }

  return payload;
}

/**
 * Auto-detects and decrypts both legacy V1 and chunked V2 `.classpack` backups.
 */
export async function decryptClasspack(
  rawFileText: string,
  password: string,
  options?: BackupCryptoOptions
): Promise<ClasspackPayload> {
  let envelope: EncryptedClasspackEnvelope;
  try {
    envelope = JSON.parse(rawFileText) as EncryptedClasspackEnvelope;
  } catch {
    throw new Error('Invalid .classpack file format (corrupted JSON).');
  }

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Unsupported backup file format.');
  }

  if (envelope.magic === 'CLASSPACK_V2') {
    return decryptClasspackV2(envelope, password, options);
  }
  if (envelope.magic === 'CLASSPACK_V1' && envelope.cipher === 'AES-GCM-256') {
    return decryptClasspackV1(envelope, password, options);
  }

  throw new Error('Unsupported backup file format or version.');
}

export interface RestoreConflictSummary {
  incomingClasses: number;
  incomingStudents: number;
  incomingSessions: number;
  incomingQuestions: number;
  conflictingClassIds: string[];
  conflictingStudentIds: string[];
  duplicateRollConflicts: Array<{
    className: string;
    rollNumber: string;
    incomingName: string;
    existingName: string;
  }>;
}

export function analyzeBackupConflicts(
  incoming: ClasspackPayload['data'],
  existingClasses: readonly ClassRecord[],
  existingStudents: readonly Student[]
): RestoreConflictSummary {
  const existingClassMap = new Map(existingClasses.map((c) => [c.id, c]));
  const existingStudentIdMap = new Map(existingStudents.map((s) => [s.id, s]));

  const conflictingClassIds = incoming.classes
    .filter((c) => existingClassMap.has(c.id))
    .map((c) => c.id);

  const conflictingStudentIds = incoming.students
    .filter((s) => existingStudentIdMap.has(s.id))
    .map((s) => s.id);

  const duplicateRollConflicts: RestoreConflictSummary['duplicateRollConflicts'] = [];
  for (const incStudent of incoming.students) {
    if (existingStudentIdMap.has(incStudent.id)) continue;
    const match = existingStudents.find(
      (ex) =>
        ex.classId === incStudent.classId &&
        ex.rollNumber.trim().toLowerCase() === incStudent.rollNumber.trim().toLowerCase()
    );
    if (match) {
      const clsName = existingClassMap.get(incStudent.classId)?.name ?? incStudent.classId;
      duplicateRollConflicts.push({
        className: clsName,
        rollNumber: incStudent.rollNumber,
        incomingName: incStudent.name,
        existingName: match.name,
      });
    }
  }

  return {
    incomingClasses: incoming.classes.length,
    incomingStudents: incoming.students.length,
    incomingSessions: incoming.sessions.length,
    incomingQuestions: incoming.questions.length,
    conflictingClassIds,
    conflictingStudentIds,
    duplicateRollConflicts,
  };
}
