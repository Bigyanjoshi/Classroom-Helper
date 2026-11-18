import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarSignature,
  CLASSROOM_MASCOTS,
  detectStudentGenderFromName,
  FEMININE_HAIRSTYLES,
  generateAvatarConfig,
  MASCULINE_HAIRSTYLES,
  MONK_SKIN_TONES,
  pickUniqueAvatarConfig,
  randomizeStyleKeepingSkinTone,
  reconcileStudent3DCharacter,
  renderAvatarSvg,
  UNIFORM_CARTOON_TONE,
} from './avatarGenerator';
import {
  analyzeBackupConflicts,
  createEncryptedClasspack,
  createEncryptedClasspackV1Legacy,
  decryptClasspack,
} from './cryptoBackup';
import { guessStudentColumnMapping, parseCsvMatrix, validateStudentImportMatrix } from './csvParser';
import type { Student } from './types';

test('new avatars default to harmonious 3D Student Characters with automatic gender detection and support optional Mascots', () => {
  // Default avatar is a 3D Student Character with harmonious warm complexion
  const defaultHuman3D = pickUniqueAvatarConfig('random', [], undefined, {
    studentName: 'Aarav Sharma',
  });
  assert.equal(defaultHuman3D.avatarKind, 'human');
  assert.equal(defaultHuman3D.presentation, 'masculine');
  assert.equal(defaultHuman3D.skinTone, UNIFORM_CARTOON_TONE);
  assert.ok((MASCULINE_HAIRSTYLES as readonly string[]).includes(defaultHuman3D.hairStyle));
  const humanSvg = renderAvatarSvg(defaultHuman3D);
  assert.ok(humanSvg.startsWith('<svg'));

  // Female name auto-detection
  const femaleHuman3D = pickUniqueAvatarConfig('random', [], undefined, {
    studentName: 'Ananya Verma',
  });
  assert.equal(femaleHuman3D.avatarKind, 'human');
  assert.equal(femaleHuman3D.presentation, 'feminine');
  assert.equal(femaleHuman3D.skinTone, UNIFORM_CARTOON_TONE);
  assert.ok((FEMININE_HAIRSTYLES as readonly string[]).includes(femaleHuman3D.hairStyle));

  // Verify name-based gender detector for Nepali, South Asian, and international names
  assert.equal(detectStudentGenderFromName('Bigyan Thapa'), 'masculine');
  assert.equal(detectStudentGenderFromName('Siddharth Roy'), 'masculine');
  assert.equal(detectStudentGenderFromName('Sita Gurung'), 'feminine');
  assert.equal(detectStudentGenderFromName('Saanvi Rao'), 'feminine');
  assert.equal(detectStudentGenderFromName('Kritika Adhikari'), 'feminine');

  // Optional Mascot mode still works when explicitly selected
  const mascotCfg = pickUniqueAvatarConfig('random', [], undefined, { avatarKind: 'mascot' });
  assert.equal(mascotCfg.avatarKind, 'mascot');
  assert.ok(CLASSROOM_MASCOTS.some((m) => m.id === mascotCfg.mascotId));
  const mascotSvg = renderAvatarSvg(mascotCfg);
  assert.ok(mascotSvg.startsWith('<svg'));

  // Harmonious warm complexion tones stay within balanced classroom-safe range
  assert.equal(MONK_SKIN_TONES.length, 10);
  for (const mst of MONK_SKIN_TONES) {
    const humanCfg = generateAvatarConfig('masculine', undefined, {
      avatarKind: 'human',
      monkSkinTone: mst.scale,
    });
    assert.equal(humanCfg.avatarKind, 'human');
    assert.equal(humanCfg.monkSkinTone, mst.scale);
    assert.equal(humanCfg.skinTone, mst.hex);

    const restyled = randomizeStyleKeepingSkinTone(humanCfg, 'feminine');
    assert.equal(restyled.avatarKind, 'human');
    assert.equal(restyled.presentation, 'feminine');
    assert.equal(restyled.skinTone, mst.hex);
  }

  // Reconciling a starter/mascot student upgrades them to a gender-matched 3D Student Character
  const legacyMascotStudent: Student = {
    id: 'stu_test_1',
    classId: 'class_5',
    name: 'Saanvi Rao',
    rollNumber: '508',
    characterPresentation: 'neutral',
    avatarSource: 'generated',
    avatarConfig: mascotCfg,
    activeStatus: 'active',
    createdAt: 100,
    updatedAt: 100,
    isStarterSample: true,
  };
  const reconciled = reconcileStudent3DCharacter(legacyMascotStudent, []);
  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.student.characterPresentation, 'feminine');
  assert.equal(reconciled.student.avatarConfig.avatarKind, 'human');
  assert.equal(reconciled.student.avatarConfig.presentation, 'feminine');
  assert.equal(reconciled.student.avatarConfig.skinTone, UNIFORM_CARTOON_TONE);

  const uniqueCheck = [
    pickUniqueAvatarConfig('masculine', []),
    pickUniqueAvatarConfig('feminine', []),
  ];
  assert.ok(avatarSignature(uniqueCheck[0]).length > 0);
});

test('encrypted .classpack V2 chunked roundtrip verifies SHA-256, rejects tampering, and supports legacy V1 restore', async () => {
  const sampleData = {
    classes: [{ id: 'c5', name: 'Class 5', createdAt: 100, updatedAt: 100 }],
    students: [],
    blobs: [
      {
        id: 'blob_1',
        mimeType: 'image/webp',
        dataUrl: 'data:image/webp;base64,' + 'A'.repeat(280_000),
        createdAt: 100,
      },
    ],
    sessions: [],
    activities: [],
    selections: [],
    questions: [{ id: 'q1', subject: 'Math', text: 'What is 6 x 7?', createdAt: 10, updatedAt: 10 }],
    rewards: [],
  };

  // Multi-chunk V2 roundtrip (force smaller test chunk via 256KB minimum)
  let sawProgress = false;
  const packedV2 = await createEncryptedClasspack(sampleData, 'teacher-pass-2026', {
    chunkSizeBytes: 256 * 1024,
    onProgress: () => {
      sawProgress = true;
    },
  });
  assert.equal(sawProgress, true);

  const envelopeV2 = JSON.parse(packedV2);
  assert.equal(envelopeV2.magic, 'CLASSPACK_V2');
  assert.equal(envelopeV2.kdf, 'PBKDF2-SHA512');
  assert.equal(envelopeV2.iterations, 600_000);
  assert.ok(envelopeV2.chunks.length >= 2, 'Blob payload splits cleanly across >=2 V2 chunks');

  const restoredV2 = await decryptClasspack(packedV2, 'teacher-pass-2026');
  assert.equal(restoredV2.version, 2);
  assert.equal(restoredV2.data.classes[0].name, 'Class 5');
  assert.equal(restoredV2.data.questions[0].text, 'What is 6 x 7?');

  await assert.rejects(
    () => decryptClasspack(packedV2, 'wrong-password'),
    /Incorrect password/
  );

  // Tampering V2 chunk ciphertext
  const tamperedCipher = JSON.parse(packedV2);
  tamperedCipher.chunks[0].ciphertextB64 = 'AA' + tamperedCipher.chunks[0].ciphertextB64.slice(2);
  await assert.rejects(
    () => decryptClasspack(JSON.stringify(tamperedCipher), 'teacher-pass-2026'),
    /Incorrect password or tampered V2/
  );

  // Tampering V2 sequence / missing chunk
  const truncatedV2 = JSON.parse(packedV2);
  truncatedV2.chunks = truncatedV2.chunks.slice(0, 1);
  await assert.rejects(
    () => decryptClasspack(JSON.stringify(truncatedV2), 'teacher-pass-2026'),
    /truncated|chunk count mismatch/i
  );

  // Backward-compatible V1 restore
  const packedV1 = await createEncryptedClasspackV1Legacy(sampleData, 'legacy-pass-2026');
  const envelopeV1 = JSON.parse(packedV1);
  assert.equal(envelopeV1.magic, 'CLASSPACK_V1');
  const restoredV1 = await decryptClasspack(packedV1, 'legacy-pass-2026');
  assert.equal(restoredV1.data.classes[0].name, 'Class 5');
});

test('CSV import parser and backup conflict analyzer detect duplicates accurately', () => {
  const csv = `Roll Number,Student Name,Presentation\n101,Aarav Sharma,masculine\n102,Diya Nair,feminine\n102,Duplicate In File,neutral\n103,,random\n104,Existing Student,neutral`;
  const matrix = parseCsvMatrix(csv);
  const mapping = guessStudentColumnMapping(matrix[0]);

  const existing: Student[] = [
    {
      id: 'ex-1',
      classId: 'c5',
      name: 'Rohan',
      rollNumber: '104',
      characterPresentation: 'masculine',
      avatarSource: 'generated',
      avatarConfig: pickUniqueAvatarConfig('masculine', []),
      activeStatus: 'active',
      createdAt: 10,
      updatedAt: 10,
    },
  ];

  const preview = validateStudentImportMatrix(matrix, true, mapping, existing);
  assert.equal(preview.validCount, 2);
  assert.equal(preview.duplicateCount, 2);
  assert.equal(preview.invalidCount, 1);

  const conflicts = analyzeBackupConflicts(
    {
      classes: [{ id: 'c5', name: 'Class 5', createdAt: 1, updatedAt: 1 }],
      students: [
        {
          ...existing[0],
          id: 'different-id',
          name: 'Incoming Kid',
          rollNumber: '104',
        },
      ],
      blobs: [],
      sessions: [],
      activities: [],
      selections: [],
      questions: [],
      rewards: [],
    },
    [{ id: 'c5', name: 'Class 5', createdAt: 1, updatedAt: 1 }],
    existing
  );
  assert.equal(conflicts.conflictingClassIds.length, 1);
  assert.equal(conflicts.duplicateRollConflicts.length, 1);
});

test('all-students multi-class CSV import recognizes Class column, side-by-side class tables, and validates roll numbers per class without cross-class duplicate errors', () => {
  const classes = [
    { id: 'c5', name: 'Class 5', createdAt: 1, updatedAt: 1 },
    { id: 'c6', name: 'Class 6', createdAt: 1, updatedAt: 1 },
  ];

  // 1. Standard multi-class CSV with same roll numbers (1, 2) across Class 5, Class 6, and new Class 8
  const multiClassCsv = [
    'Class,Roll No,Student Name,Gender',
    'Class 5,1,Aarav Sharma,male',
    'Class 5,2,Ananya Verma,female',
    'Class 6,1,Bigyan Thapa,male',
    'Class 6,2,Kritika Adhikari,female',
    '8,1,Siddharth Roy,',
  ].join('\n');

  const matrix1 = parseCsvMatrix(multiClassCsv);
  const mapping1 = guessStudentColumnMapping(matrix1[0], matrix1.slice(1));
  assert.equal(mapping1.classCol, 0);
  assert.equal(mapping1.rollCol, 1);
  assert.equal(mapping1.nameCol, 2);

  const preview1 = validateStudentImportMatrix(matrix1, true, mapping1, [], {
    allClasses: classes,
    allStudents: [],
  });
  assert.equal(preview1.validCount, 5);
  assert.equal(preview1.duplicateCount, 0);
  assert.equal(preview1.invalidCount, 0);
  assert.deepEqual(preview1.detectedClasses, ['Class 5', 'Class 6', 'Class 8']);
  assert.equal(preview1.rows[0].resolvedClassId, 'c5');
  assert.equal(preview1.rows[2].resolvedClassId, 'c6');
  assert.equal(preview1.rows[4].className, 'Class 8');

  // 2. Side-by-side multi-column class table (each column header is a Class name)
  const sideBySideCsv = [
    'Class 5,Class 6,Class 7',
    'Aarav Patel,Devansh Kapoor,Aditya Singh',
    'Ananya Verma,Ira Deshmukh,Bhavya Malhotra',
  ].join('\n');

  const matrix2 = parseCsvMatrix(sideBySideCsv);
  const mapping2 = guessStudentColumnMapping(matrix2[0], matrix2.slice(1));
  assert.equal(mapping2.isMultiColumnClassTable, true);

  const preview2 = validateStudentImportMatrix(matrix2, true, mapping2, [], {
    allClasses: classes,
    allStudents: [],
  });
  assert.equal(preview2.validCount, 6);
  assert.equal(preview2.invalidCount, 0);
  assert.deepEqual(preview2.detectedClasses, ['Class 5', 'Class 6', 'Class 7']);
});

