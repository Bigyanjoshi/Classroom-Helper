import { pickUniqueAvatarConfig } from '../domain/avatarGenerator';
import type {
  AvatarConfig,
  CharacterPresentation,
  ClassRecord,
  QuestionItem,
  RewardChallengeItem,
  Student,
} from '../domain/types';
import { createId, db, getAppSettings, saveAppSettings } from './db';

interface StarterStudentSpec {
  roll: string;
  name: string;
  presentation: CharacterPresentation;
}

const STARTER_ROSTERS: Record<string, StarterStudentSpec[]> = {
  'Class 5': [
    { roll: '501', name: 'Aarav Patel', presentation: 'masculine' },
    { roll: '502', name: 'Ananya Verma', presentation: 'feminine' },
    { roll: '503', name: 'Kabir Mehta', presentation: 'masculine' },
    { roll: '504', name: 'Diya Nair', presentation: 'feminine' },
    { roll: '505', name: 'Ishaan Kulkarni', presentation: 'masculine' },
    { roll: '506', name: 'Meera Joshi', presentation: 'feminine' },
    { roll: '507', name: 'Rohan Das', presentation: 'masculine' },
    { roll: '508', name: 'Saanvi Rao', presentation: 'feminine' },
  ],
  'Class 6': [
    { roll: '601', name: 'Devansh Kapoor', presentation: 'masculine' },
    { roll: '602', name: 'Ira Deshmukh', presentation: 'feminine' },
    { roll: '603', name: 'Nikhil Menon', presentation: 'masculine' },
    { roll: '604', name: 'Priya Iyer', presentation: 'feminine' },
    { roll: '605', name: 'Reyansh Sen', presentation: 'masculine' },
    { roll: '606', name: 'Tara Chatterjee', presentation: 'feminine' },
    { roll: '607', name: 'Vivaan Gupta', presentation: 'masculine' },
    { roll: '608', name: 'Zoya Khan', presentation: 'feminine' },
  ],
  'Class 7': [
    { roll: '701', name: 'Aditya Singh', presentation: 'masculine' },
    { roll: '702', name: 'Bhavya Malhotra', presentation: 'feminine' },
    { roll: '703', name: 'Chirag Bose', presentation: 'masculine' },
    { roll: '704', name: 'Kavya Krishnan', presentation: 'feminine' },
    { roll: '705', name: 'Neel Mukherjee', presentation: 'masculine' },
    { roll: '706', name: 'Riya Bansal', presentation: 'feminine' },
    { roll: '707', name: 'Siddharth Roy', presentation: 'masculine' },
    { roll: '708', name: 'Tanvi Saxena', presentation: 'feminine' },
  ],
};

const STARTER_QUESTIONS: Array<{ subject: string; text: string }> = [
  { subject: 'Science', text: 'Name two ways plants disperse their seeds in nature.' },
  { subject: 'Science', text: 'What is the difference between a conductor and an insulator?' },
  { subject: 'Science', text: 'Explain how evaporation helps cool down water in a clay pot.' },
  { subject: 'Mathematics', text: 'If a rectangle has perimeter 24 cm and width 5 cm, what is its length?' },
  { subject: 'Mathematics', text: 'Convert 3/4 into a percentage and explain your step.' },
  { subject: 'Mathematics', text: 'What is the sum of interior angles inside any triangle?' },
  { subject: 'English', text: 'Use the word "curious" in a vivid descriptive sentence.' },
  { subject: 'English', text: 'Give an example of a metaphor and explain what it compares.' },
  { subject: 'Social Studies', text: 'Why are river valleys historically important for early settlements?' },
  { subject: 'Social Studies', text: 'Name one renewable energy source and how it helps our community.' },
];

const STARTER_REWARDS: Array<{ kind: 'reward' | 'challenge' | 'duty'; text: string }> = [
  { kind: 'duty', text: 'Board Helper & Eraser Captain' },
  { kind: 'duty', text: 'Notebook & Worksheet Distributor' },
  { kind: 'duty', text: 'Line Leader & Attendance Helper' },
  { kind: 'duty', text: 'Classroom Library Organizer' },
  { kind: 'reward', text: 'Choose today’s 2-minute stretch break activity' },
  { kind: 'reward', text: 'Pick the team name for the next group round' },
  { kind: 'challenge', text: 'Explain today’s main idea in 15 words or fewer' },
  { kind: 'challenge', text: 'Ask a follow-up question to a classmate of your choice' },
];

/**
 * Initializes Class 5, Class 6, Class 7 and starter rosters/questions on first launch.
 * Uses expressive 3D Student Characters with a harmonious warm complexion and gender-matched traits.
 */
export async function ensureInitialDatabaseSeeded(): Promise<void> {
  const settings = await getAppSettings();
  const classCount = await db.classes.count();

  if (classCount > 0 || settings.seededSampleData) {
    return;
  }

  const now = Date.now();
  const classEntries: Array<{ id: string; name: string }> = [
    { id: 'class_5', name: 'Class 5' },
    { id: 'class_6', name: 'Class 6' },
    { id: 'class_7', name: 'Class 7' },
  ];

  const classesToInsert: ClassRecord[] = classEntries.map((c, idx) => ({
    id: c.id,
    name: c.name,
    createdAt: now + idx,
    updatedAt: now + idx,
    isStarterSample: true,
  }));

  const studentsToInsert: Student[] = [];
  for (const cls of classesToInsert) {
    const specs = STARTER_ROSTERS[cls.name] ?? [];
    const existingConfigs: AvatarConfig[] = [];
    specs.forEach((spec, idx) => {
      const avatarConfig = pickUniqueAvatarConfig(spec.presentation, existingConfigs, undefined, {
        avatarKind: 'human',
        studentName: spec.name,
      });
      existingConfigs.push(avatarConfig);
      studentsToInsert.push({
        id: createId('stu'),
        classId: cls.id,
        name: spec.name,
        rollNumber: spec.roll,
        characterPresentation: spec.presentation,
        avatarSource: 'generated',
        avatarConfig,
        activeStatus: 'active',
        createdAt: now + idx,
        updatedAt: now + idx,
        isStarterSample: true,
      });
    });
  }

  const questionsToInsert: QuestionItem[] = STARTER_QUESTIONS.map((q, idx) => ({
    id: createId('q'),
    subject: q.subject,
    text: q.text,
    createdAt: now + idx,
    updatedAt: now + idx,
    isStarterSample: true,
  }));

  const rewardsToInsert: RewardChallengeItem[] = STARTER_REWARDS.map((r, idx) => ({
    id: createId('rew'),
    kind: r.kind,
    text: r.text,
    createdAt: now + idx,
    isStarterSample: true,
  }));

  await db.transaction(
    'rw',
    [db.classes, db.students, db.questions, db.rewards, db.settings],
    async () => {
      await db.classes.bulkPut(classesToInsert);
      await db.students.bulkPut(studentsToInsert);
      await db.questions.bulkPut(questionsToInsert);
      await db.rewards.bulkPut(rewardsToInsert);
      await saveAppSettings({ seededSampleData: true });
    }
  );
}
