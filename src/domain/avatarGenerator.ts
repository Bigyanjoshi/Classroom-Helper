import { secureRandomInt, type RandomSource } from './random';
import type {
  AvatarConfig,
  AvatarKind,
  CharacterPresentation,
  MascotId,
  MonkSkinToneScale,
  ResolvedPresentation,
  Student,
} from './types';

/**
 * Harmonious, classroom-safe warm golden-amber 3D complexion.
 * Designed so no student character is starkly white or starkly dark,
 * preventing classroom teasing or colorism while keeping a rich 3D Pixar-style warmth.
 */
export const UNIFORM_CARTOON_TONE = '#E5B895';
export const HARMONIOUS_3D_BASE_TONE = '#E5B895';
export const SKIN_TONES = [UNIFORM_CARTOON_TONE] as const;

export interface MonkSkinToneOption {
  scale: MonkSkinToneScale;
  label: string;
  hex: string;
  highlightHex: string;
  shadowHex: string;
  deepShadowHex: string;
  cheekHex: string;
}

/**
 * Classroom-safe, harmonious warm 3D complexion scale (1..10).
 * Narrowed to balanced warm golden/peach/amber mid-tones so no student is ever
 * rendered starkly pale white or starkly dark black, preventing teasing while
 * preserving subtle warm 3D studio lighting variations.
 */
export const MONK_SKIN_TONES: readonly MonkSkinToneOption[] = [
  { scale: 1, label: 'Warm Ivory Glow', hex: '#ECC6A8', highlightHex: '#FBE3CE', shadowHex: '#C99874', deepShadowHex: '#A87451', cheekHex: '#E57D70' },
  { scale: 2, label: 'Sunlit Peach', hex: '#E9C1A0', highlightHex: '#F9DEC5', shadowHex: '#C5936E', deepShadowHex: '#A36F4C', cheekHex: '#E37A6C' },
  { scale: 3, label: 'Golden Honey', hex: '#E7BC99', highlightHex: '#F7D9BE', shadowHex: '#C28E68', deepShadowHex: '#9F6A47', cheekHex: '#E07668' },
  { scale: 4, label: 'Balanced Warm Amber', hex: '#E5B895', highlightHex: '#F6D6BA', shadowHex: '#BF8A64', deepShadowHex: '#9B6542', cheekHex: '#DE7365' },
  { scale: 5, label: 'Warm Caramel Glow', hex: '#E1B28E', highlightHex: '#F3D1B3', shadowHex: '#BA845E', deepShadowHex: '#965F3D', cheekHex: '#DA6F61' },
  { scale: 6, label: 'Radiant Cinnamon', hex: '#DCA984', highlightHex: '#EFC9A9', shadowHex: '#B47B55', deepShadowHex: '#8F5736', cheekHex: '#D56A5C' },
  { scale: 7, label: 'Warm Bronze Glow', hex: '#D7A37D', highlightHex: '#EBC3A2', shadowHex: '#AE754F', deepShadowHex: '#895130', cheekHex: '#D06558' },
  { scale: 8, label: 'Golden Sandalwood', hex: '#D39E77', highlightHex: '#E7BE9B', shadowHex: '#A9704A', deepShadowHex: '#844C2C', cheekHex: '#CB6153' },
  { scale: 9, label: 'Toasted Almond', hex: '#CF9972', highlightHex: '#E3B995', shadowHex: '#A46B45', deepShadowHex: '#7E4728', cheekHex: '#C65D4F' },
  { scale: 10, label: 'Warm Terracotta Silk', hex: '#CB946D', highlightHex: '#DFB48F', shadowHex: '#9F6640', deepShadowHex: '#794224', cheekHex: '#C1594B' },
] as const;

export interface ClassroomMascotOption {
  id: MascotId;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  highlightColor: string;
}

export const CLASSROOM_MASCOTS: readonly ClassroomMascotOption[] = [
  { id: 'owl', label: 'Scholar Owl', primaryColor: '#6D8EA0', secondaryColor: '#E7EDF3', highlightColor: '#98B7C7' },
  { id: 'fox', label: 'Clever Fox', primaryColor: '#D65A31', secondaryColor: '#FAF6EE', highlightColor: '#EE8661' },
  { id: 'panda', label: 'Cozy Panda', primaryColor: '#3A342F', secondaryColor: '#F6F2EA', highlightColor: '#675F58' },
  { id: 'bot', label: 'Spark Bot', primaryColor: '#2F7D5B', secondaryColor: '#DDECE4', highlightColor: '#58A883' },
  { id: 'astronaut', label: 'Star Explorer', primaryColor: '#41627A', secondaryColor: '#F3ECE1', highlightColor: '#7294AE' },
  { id: 'sprout', label: 'Sunny Sprout', primaryColor: '#5D8C48', secondaryColor: '#E8F2DF', highlightColor: '#87B570' },
] as const;

export function getMonkSkinToneOption(scale?: MonkSkinToneScale): MonkSkinToneOption {
  const index = Math.max(1, Math.min(10, scale ?? 4)) - 1;
  return MONK_SKIN_TONES[index];
}

export function getClassroomMascotOption(id?: MascotId): ClassroomMascotOption {
  return CLASSROOM_MASCOTS.find((m) => m.id === id) ?? CLASSROOM_MASCOTS[0];
}

export const HAIR_COLORS = [
  '#1E1916', // Deep Espresso Black
  '#35231A', // Rich Dark Chestnut
  '#523220', // Warm Chocolate Brown
  '#754427', // Cinnamon Auburn
  '#96562C', // Golden Copper
  '#263040', // Midnight Blue-Black
  '#4A2A22', // Mahogany Brown
  '#633B24', // Toasted Walnut
] as const;

export const OUTFIT_COLORS = [
  '#D96B27', // Terracotta Blaze
  '#2B7A67', // Emerald Academy
  '#35597A', // Royal Cobalt
  '#C24638', // Crimson Varsity
  '#6A4F8C', // Starlight Violet
  '#D18A1B', // Golden Marigold
  '#2E6F4E', // Forest Ranger
  '#3D4856', // Space Commander Slate
] as const;

export const BG_COLORS = [
  '#F9E5D8', // Warm Peach Studio
  '#E2F1EA', // Mint Lagoon
  '#E3ECF6', // Sky Horizon
  '#FBF0D4', // Sunbeam Gold
  '#F0E4EE', // Lavender Cloud
  '#EAE6DF', // Ivory Gallery
] as const;

export const MASCULINE_HAIR = [
  'shortCrop',
  'sidePart',
  'curlyTop',
  'spikyNeat',
  'wavySweep',
  'buzz',
] as const;

export const FEMININE_HAIR = [
  'longWave',
  'highPonytail',
  'twinPuffs',
  'braids',
  'bobCut',
  'shoulderLayers',
] as const;

export const NEUTRAL_HAIR = [
  'fluffyCurl',
  'classicMedium',
  'modernCrop',
  'curlyBob',
  'sideSweep',
  'beanieHair',
] as const;

export const FACE_SHAPES: AvatarConfig['faceShape'][] = ['oval', 'round', 'softSquare', 'heart'];
export const EYE_STYLES: AvatarConfig['eyeStyle'][] = ['bright', 'cheerful', 'calm', 'curious', 'wink', 'glassesReady'];
export const EYEBROW_STYLES: AvatarConfig['eyebrowStyle'][] = ['arch', 'soft', 'straight', 'raised'];
export const MOUTH_STYLES: AvatarConfig['mouthStyle'][] = ['warmSmile', 'bigGrin', 'gentle', 'openSmile', 'whistle'];
export const OUTFIT_STYLES: AvatarConfig['outfitStyle'][] = ['hoodie', 'collar', 'cardigan', 'overalls', 'crewneck', 'stripes'];
export const ACCESSORIES: AvatarConfig['accessory'][] = ['none', 'glasses', 'roundGlasses', 'headband', 'bowtie', 'starPin', 'beanie'];
export const BG_PATTERNS: AvatarConfig['bgPattern'][] = ['stars', 'sunburst', 'dots', 'waves', 'stripes', 'plain'];

export const MASCULINE_HAIRSTYLES = MASCULINE_HAIR;
export const FEMININE_HAIRSTYLES = FEMININE_HAIR;

export type CharacterArchetypeId =
  | 'star_captain'
  | 'honor_scholar'
  | 'music_prodigy'
  | 'science_explorer'
  | 'varsity_champ'
  | 'art_maestro';

export interface CharacterArchetypePreset {
  id: CharacterArchetypeId;
  label: string;
  badge: string;
  outfitStyle: AvatarConfig['outfitStyle'];
  outfitColor: string;
  accessory: AvatarConfig['accessory'];
  eyeStyle: AvatarConfig['eyeStyle'];
  mouthStyle: AvatarConfig['mouthStyle'];
  bgPattern: AvatarConfig['bgPattern'];
  bgColor: string;
}

export const CHARACTER_ARCHETYPES: readonly CharacterArchetypePreset[] = [
  {
    id: 'star_captain',
    label: 'Star Captain',
    badge: 'Star Pin & Hoodie',
    outfitStyle: 'hoodie',
    outfitColor: '#D96B27',
    accessory: 'starPin',
    eyeStyle: 'bright',
    mouthStyle: 'bigGrin',
    bgPattern: 'stars',
    bgColor: '#FBF0D4',
  },
  {
    id: 'honor_scholar',
    label: 'Honor Scholar',
    badge: 'Academy Blazer & Glasses',
    outfitStyle: 'collar',
    outfitColor: '#35597A',
    accessory: 'roundGlasses',
    eyeStyle: 'curious',
    mouthStyle: 'warmSmile',
    bgPattern: 'sunburst',
    bgColor: '#E3ECF6',
  },
  {
    id: 'music_prodigy',
    label: 'Music Prodigy',
    badge: 'Studio Band & Sweater',
    outfitStyle: 'crewneck',
    outfitColor: '#6A4F8C',
    accessory: 'headband',
    eyeStyle: 'cheerful',
    mouthStyle: 'openSmile',
    bgPattern: 'waves',
    bgColor: '#F0E4EE',
  },
  {
    id: 'science_explorer',
    label: 'Science Explorer',
    badge: 'Explorer Gear & Specs',
    outfitStyle: 'overalls',
    outfitColor: '#2B7A67',
    accessory: 'glasses',
    eyeStyle: 'curious',
    mouthStyle: 'warmSmile',
    bgPattern: 'dots',
    bgColor: '#E2F1EA',
  },
  {
    id: 'varsity_champ',
    label: 'Varsity Champ',
    badge: 'Sport Stripes & Wink',
    outfitStyle: 'stripes',
    outfitColor: '#C24638',
    accessory: 'none',
    eyeStyle: 'wink',
    mouthStyle: 'bigGrin',
    bgPattern: 'stripes',
    bgColor: '#F9E5D8',
  },
  {
    id: 'art_maestro',
    label: 'Art Maestro',
    badge: 'Cozy Beanie & Cardigan',
    outfitStyle: 'cardigan',
    outfitColor: '#D18A1B',
    accessory: 'beanie',
    eyeStyle: 'bright',
    mouthStyle: 'gentle',
    bgPattern: 'stars',
    bgColor: '#EAE6DF',
  },
] as const;

const KNOWN_FEMALE_NAMES = new Set([
  'ananya', 'diya', 'meera', 'saanvi', 'ira', 'priya', 'tara', 'zoya', 'bhavya', 'kavya', 'riya', 'tanvi',
  'sita', 'gita', 'rita', 'nita', 'sunita', 'anita', 'binita', 'kabita', 'sabita', 'babita', 'lalita', 'sarita',
  'asmita', 'susmita', 'sushmita', 'namita', 'mamata', 'samiksha', 'pratiksha', 'diksha', 'shikha', 'rekha', 'lekha',
  'sneha', 'neha', 'megha', 'shraddha', 'aastha', 'astha', 'nistha', 'shristi', 'sristi', 'drishti', 'smriti', 'kriti',
  'priti', 'preeti', 'jyoti', 'arati', 'aarti', 'swati', 'pragati', 'unnati', 'khushi', 'mansi', 'tulsi', 'sakshi',
  'ayushi', 'aarushi', 'suhani', 'shivani', 'chandani', 'roshani', 'nandini', 'ragini', 'shalini', 'yamini', 'damini',
  'anjali', 'sonali', 'rupali', 'dipali', 'deepali', 'vaishali', 'monali', 'mitali', 'shefali', 'khushbu', 'bindu',
  'indu', 'madhu', 'ritu', 'nitu', 'neetu', 'renu', 'meenu', 'anu', 'tanu', 'sanu', 'puja', 'pooja', 'archana',
  'bandana', 'vandana', 'kalpana', 'sapana', 'sapna', 'rachana', 'sadhana', 'upasana', 'bipana', 'srijana', 'sirjana',
  'karuna', 'jamuna', 'yamuna', 'munna', 'mina', 'meena', 'tina', 'rina', 'reena', 'hina', 'heena', 'bina', 'beena',
  'sabina', 'rabina', 'nabina', 'pravina', 'rubina', 'alina', 'elina', 'melina', 'selina', 'karina', 'kareena',
  'katrina', 'marina', 'angelina', 'christina', 'regina', 'rosina', 'salina', 'sujana', 'sajana', 'nirjana',
  'kritika', 'ashima', 'garima', 'mahima', 'pratima', 'purnima', 'nilima', 'rewati', 'parbati', 'parvati', 'saraswati',
  'bhagwati', 'kalawati', 'lilawati', 'maya', 'chhaya', 'daya', 'jaya', 'bijaya', 'vijaya', 'shreya', 'divya', 'navya',
  'aditi', 'akriti', 'aakriti', 'prakriti', 'sanskriti', 'vibhuti', 'shruti', 'stuti', 'kranti', 'shanti', 'bhranti',
  'laxmi', 'lakshmi', 'rashmi', 'urmi', 'bhumi', 'bhoomi', 'mousumi', 'devi', 'kumari', 'radha', 'sudha', 'medha',
  'vasudha', 'anuradha', 'shobha', 'prabha', 'abha', 'vibha', 'subha', 'shubha', 'nisha', 'manisha', 'anisha',
  'tanisha', 'monisha', 'trisha', 'alisha', 'elisha', 'amisha', 'nimisha', 'bidisha', 'unnisha', 'bipasha', 'asha',
  'usha', 'varsha', 'barsha', 'harsha', 'raksha', 'preksha', 'apeksha', 'anushka', 'kanishka', 'tanishka', 'mala',
  'kala', 'komal', 'anchal', 'aanchal', 'payal', 'kajal', 'sejal', 'sujal', 'sonal', 'minal', 'bimala', 'kamala',
  'nirmala', 'sarala', 'urmila', 'sharmila', 'pramila', 'susila', 'sushila', 'mithila', 'kopila', 'shakuntala',
  'gayatri', 'savitri', 'maitri', 'gauri', 'manjari', 'bansari', 'kishori', 'madhuri', 'kasturi', 'mayuri',
  'supriya', 'soniya', 'sonia', 'monika', 'monica', 'veronica', 'jessica', 'rebecca', 'samantha', 'amanda', 'miranda',
  'olivia', 'sophia', 'emma', 'ava', 'mia', 'isabella', 'amelia', 'harper', 'evelyn', 'abigail', 'emily', 'elizabeth',
  'sofia', 'avery', 'ella', 'scarlett', 'grace', 'chloe', 'victoria', 'riley', 'aria', 'lily', 'aubrey', 'zoey',
  'penelope', 'lillian', 'addison', 'layla', 'natalie', 'camila', 'hannah', 'brooklyn', 'zoe', 'nora', 'leah',
  'savannah', 'audrey', 'claire', 'eleanor', 'skylar', 'ellie', 'samantha', 'stella', 'paisley', 'violet', 'mila',
  'allison', 'alexa', 'anna', 'hazel', 'aaliyah', 'ariana', 'lucy', 'caroline', 'sarah', 'genesis', 'kennedy',
  'sadie', 'gabriella', 'madelyn', 'adeline', 'maya', 'autumn', 'aurora', 'piper', 'hailey', 'arianna', 'kaylee',
  'ruby', 'serenity', 'eva', 'naomi', 'nevaeh', 'alice', 'luna', 'bella', 'clara', 'vivian', 'madeline', 'fatima',
  'aisha', 'ayesha', 'zainab', 'maryam', 'mariam', 'khadija', 'amina', 'yasmin', 'nadia', 'farah', 'sana', 'hira',
]);

const KNOWN_MALE_NAMES = new Set([
  'aarav', 'kabir', 'ishaan', 'ishan', 'rohan', 'devansh', 'nikhil', 'reyansh', 'vivaan', 'aditya', 'chirag', 'neel',
  'siddharth', 'bigyan', 'vigyan', 'ram', 'shyam', 'hari', 'krishna', 'shiva', 'bishnu', 'vishnu', 'ganesh', 'suresh',
  'ramesh', 'mahesh', 'dinesh', 'naresh', 'umesh', 'rajesh', 'mukesh', 'rakesh', 'dipesh', 'deepesh', 'sandesh',
  'pravesh', 'yogesh', 'lokesh', 'ritesh', 'nitesh', 'hitesh', 'mitesh', 'jitesh', 'rupesh', 'bhupesh', 'gopesh',
  'santosh', 'ashutosh', 'paritosh', 'bikash', 'vikas', 'prakash', 'subash', 'suwash', 'aakash', 'akash', 'bibash',
  'diwas', 'prayas', 'prayash', 'abhash', 'aavash', 'avash', 'bibek', 'vivek', 'abhishek', 'suman', 'sujan', 'suraj',
  'niraj', 'neeraj', 'pankaj', 'dheeraj', 'dhiraj', 'biraj', 'siraj', 'yuvraj', 'yuvaraj', 'manoj', 'saroj', 'anoj',
  'binoj', 'binod', 'vinod', 'pramod', 'subodh', 'nabin', 'navin', 'prabin', 'pravin', 'sabin', 'rabin', 'kabin',
  'ashwin', 'sachin', 'bipin', 'vipin', 'nitin', 'jatin', 'sudip', 'sudeep', 'pradip', 'pradeep', 'sandip', 'sandeep',
  'mandip', 'kuldeep', 'dilip', 'ashish', 'aashish', 'manish', 'anish', 'sanish', 'binish', 'girish', 'harish',
  'satish', 'nitish', 'kshitiz', 'kshitij', 'sujit', 'ajit', 'ranjit', 'sanjit', 'amit', 'sumit', 'ankit', 'pulkit',
  'rohit', 'mohit', 'sohit', 'lalit', 'amrit', 'arpit', 'samrat', 'birat', 'virat', 'bharat', 'sharad', 'angad',
  'prashant', 'sushant', 'nishant', 'hemant', 'basant', 'vasant', 'jayant', 'anant', 'siddhant', 'bishal', 'vishal',
  'kushal', 'safal', 'kamal', 'bimal', 'vimal', 'nirmal', 'ujjwal', 'prajwal', 'brijesh', 'dipendra', 'dependra',
  'mahendra', 'surendra', 'narendra', 'devendra', 'rajendra', 'jitendra', 'upendra', 'rabindra', 'kabindra',
  'yogendra', 'lokendra', 'shailendra', 'puskar', 'pushkar', 'shankar', 'bhaskar', 'diwakar', 'prabhakar', 'sudhakar',
  'sagar', 'samir', 'sameer', 'amir', 'bir', 'veer', 'mahabir', 'ranbir', 'balbir', 'gaurav', 'saurav', 'saurabh',
  'rishabh', 'utsav', 'pranav', 'raghav', 'madhav', 'keshav', 'abhinav', 'vaibhav', 'sulav', 'sourav', 'gaurab',
  'saurab', 'sulabh', 'rishav', 'manav', 'arnav', 'biplav', 'biplab', 'anurag', 'prayag', 'parag', 'narayan',
  'laxman', 'lakshman', 'arjun', 'bhim', 'nakul', 'sahadev', 'karan', 'karna', 'kiran', 'chetan', 'ketan', 'ratan',
  'madan', 'gagan', 'pawan', 'sawan', 'bhuvan', 'jeevan', 'jiban', 'roshan', 'bhushan', 'rajan', 'sajan', 'nirajan',
  'milan', 'kalyan', 'aryan', 'ayush', 'aayush', 'piyush', 'pratyush', 'ankush', 'dhanush', 'ayushman', 'arman',
  'rehan', 'farhan', 'imran', 'irfan', 'salman', 'rizwan', 'sunil', 'anil', 'kapil', 'akhil', 'sushil', 'sahil',
  'rahul', 'bipul', 'vipul', 'atul', 'gokul', 'suyog', 'sanjog', 'ayan', 'aayan', 'rayan', 'vihaan', 'kiaan',
  'ayaan', 'riyaan', 'shreyan', 'vardhan', 'harsh', 'adarsh', 'utkarsh', 'sparsh', 'parth', 'samarth', 'yatharth',
  'dev', 'om', 'jay', 'jai', 'raj', 'tej', 'prem', 'hem', 'som', 'kush', 'luv', 'lav', 'anshuman', 'hanuman',
  'liam', 'noah', 'oliver', 'elijah', 'william', 'james', 'benjamin', 'lucas', 'henry', 'alexander', 'mason',
  'michael', 'ethan', 'daniel', 'jacob', 'logan', 'jackson', 'levi', 'sebastian', 'mateo', 'jack', 'owen',
  'theodore', 'aiden', 'samuel', 'joseph', 'john', 'david', 'wyatt', 'matthew', 'luke', 'asher', 'carter',
  'julian', 'grayson', 'leo', 'jayden', 'gabriel', 'isaac', 'lincoln', 'anthoney', 'anthony', 'hudson', 'dylan',
  'ezra', 'thomas', 'charles', 'christopher', 'jaxon', 'maverick', 'josiah', 'isaiah', 'andrew', 'elias', 'joshua',
]);

/**
 * Automatically detects whether a student name corresponds to a Male ('masculine')
 * or Female ('feminine') 3D character so teachers don't have to configure every student manually.
 */
export function detectStudentGenderFromName(rawName: string): ResolvedPresentation {
  const cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim();

  if (!cleaned) {
    return 'masculine';
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const firstName = tokens[0];

  // 1. Exact first-name dictionary match
  if (KNOWN_FEMALE_NAMES.has(firstName)) return 'feminine';
  if (KNOWN_MALE_NAMES.has(firstName)) return 'masculine';

  // 2. Check middle/second token if present (e.g. "Kumari", "Devi", "Maya" vs "Bahadur", "Prasad", "Kumar", "Raj")
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (['kumari', 'devi', 'maya', 'shree', 'laxmi', 'lakshmi', 'kala', 'bati', 'wati'].includes(tok)) {
      return 'feminine';
    }
    if (['bahadur', 'prasad', 'kumar', 'raj', 'man', 'lal', 'nath', 'dev', 'kant', 'ram', 'jung', 'bikram', 'bir'].includes(tok)) {
      return 'masculine';
    }
  }

  // 3. Linguistic suffix heuristics for Nepali / South Asian / English first names
  if (
    firstName.endsWith('ika') ||
    firstName.endsWith('ita') ||
    firstName.endsWith('isha') ||
    firstName.endsWith('shree') ||
    firstName.endsWith('shri') ||
    firstName.endsWith('wati') ||
    firstName.endsWith('bati') ||
    firstName.endsWith('maya') ||
    firstName.endsWith('devi') ||
    firstName.endsWith('kumari') ||
    firstName.endsWith('laxmi') ||
    firstName.endsWith('priya') ||
    firstName.endsWith('anjali') ||
    firstName.endsWith('lina') ||
    firstName.endsWith('bina') ||
    firstName.endsWith('mina') ||
    firstName.endsWith('tina') ||
    firstName.endsWith('shi') ||
    firstName.endsWith('ti') ||
    firstName.endsWith('ni') ||
    firstName.endsWith('li') ||
    firstName.endsWith('ri') ||
    firstName.endsWith('vi') ||
    firstName.endsWith('ya') ||
    firstName.endsWith('na') ||
    firstName.endsWith('la') ||
    firstName.endsWith('sha') ||
    firstName.endsWith('kha') ||
    firstName.endsWith('bha') ||
    firstName.endsWith('dha') ||
    firstName.endsWith('ma') ||
    firstName.endsWith('ra') ||
    firstName.endsWith('ia') ||
    firstName.endsWith('a') ||
    firstName.endsWith('i')
  ) {
    // Exceptions: male names ending in 'a' or 'i' like 'shiva', 'krishna', 'aditya', 'ravi', 'hari', 'mani', 'rishi'
    if (
      firstName.endsWith('endra') ||
      firstName.endsWith('bhadra') ||
      firstName.endsWith('rudra') ||
      ['shiva', 'krishna', 'aditya', 'chandra', 'surya', 'indra', 'ravi', 'hari', 'mani', 'rishi', 'kavi', 'shashi', 'badri', 'murali'].includes(firstName)
    ) {
      return 'masculine';
    }
    return 'feminine';
  }

  return 'masculine';
}

function pickOne<T>(arr: readonly T[], rng?: RandomSource): T {
  return arr[secureRandomInt(arr.length, rng)];
}

export function resolvePresentation(
  pref: CharacterPresentation,
  rng?: RandomSource,
  studentName?: string
): ResolvedPresentation {
  if (pref === 'masculine' || pref === 'feminine') {
    return pref;
  }
  if (studentName && studentName.trim().length > 0) {
    return detectStudentGenderFromName(studentName);
  }
  if (pref === 'neutral') {
    return 'neutral';
  }
  const options: ResolvedPresentation[] = ['masculine', 'feminine'];
  return pickOne(options, rng);
}

export function getHairPoolForPresentation(presentation: ResolvedPresentation): readonly string[] {
  if (presentation === 'masculine') return [...MASCULINE_HAIR];
  if (presentation === 'feminine') return [...FEMININE_HAIR];
  return [...MASCULINE_HAIR.slice(0, 3), ...FEMININE_HAIR.slice(0, 3), ...NEUTRAL_HAIR];
}

export function avatarSignature(cfg: AvatarConfig): string {
  const kind = cfg.avatarKind ?? 'human';
  if (kind === 'mascot') {
    return ['mascot', cfg.mascotId ?? 'owl', cfg.outfitColor, cfg.bgColor, cfg.bgPattern, cfg.accessory].join('|');
  }
  return [
    kind,
    cfg.presentation,
    cfg.faceShape,
    cfg.hairStyle,
    cfg.hairColor,
    cfg.eyeStyle,
    cfg.mouthStyle,
    cfg.outfitStyle,
    cfg.outfitColor,
    cfg.accessory,
  ].join('|');
}

export interface GenerateAvatarOptions {
  avatarKind?: AvatarKind;
  monkSkinTone?: MonkSkinToneScale;
  mascotId?: MascotId;
  studentName?: string;
}

/**
 * Generates an expressive 3D Student Character configuration.
 * - Defaults to `avatarKind: 'human'` (3D Student Character) with a harmonious,
 *   anti-teasing warm complexion so no student is singled out by skin color.
 * - Automatically selects Male ('masculine') or Female ('feminine') 3D features
 *   when `presentationPref` or `options.studentName` is provided.
 */
export function generateAvatarConfig(
  presentationPref: CharacterPresentation,
  rng?: RandomSource,
  options?: GenerateAvatarOptions
): AvatarConfig {
  const presentation = resolvePresentation(presentationPref, rng, options?.studentName);
  const hairPool = getHairPoolForPresentation(presentation);
  const seed = `${Date.now().toString(36)}-${secureRandomInt(1_000_000, rng).toString(36)}`;

  // Default all student avatars to 3D Student Characters ('human') unless explicitly requested otherwise
  const requestedKind: AvatarKind = options?.avatarKind ?? 'human';

  if (requestedKind === 'mascot') {
    const chosenMascot = options?.mascotId ?? pickOne(CLASSROOM_MASCOTS, rng).id;
    return {
      seed,
      presentation,
      avatarKind: 'mascot',
      mascotId: chosenMascot,
      skinTone: UNIFORM_CARTOON_TONE,
      faceShape: pickOne(FACE_SHAPES, rng),
      hairStyle: pickOne(hairPool, rng),
      hairColor: pickOne(HAIR_COLORS, rng),
      eyeStyle: pickOne(EYE_STYLES, rng),
      eyebrowStyle: pickOne(EYEBROW_STYLES, rng),
      mouthStyle: pickOne(MOUTH_STYLES, rng),
      outfitStyle: pickOne(OUTFIT_STYLES, rng),
      outfitColor: pickOne(OUTFIT_COLORS, rng),
      accessory: pickOne(['none', 'bowtie', 'starPin', 'glasses', 'roundGlasses'] as const, rng),
      bgPattern: pickOne(BG_PATTERNS, rng),
      bgColor: pickOne(BG_COLORS, rng),
    };
  }

  if (requestedKind === 'legacy') {
    return {
      seed,
      presentation,
      avatarKind: 'legacy',
      skinTone: UNIFORM_CARTOON_TONE,
      faceShape: pickOne(FACE_SHAPES, rng),
      hairStyle: pickOne(hairPool, rng),
      hairColor: pickOne(HAIR_COLORS, rng),
      eyeStyle: pickOne(EYE_STYLES, rng),
      eyebrowStyle: pickOne(EYEBROW_STYLES, rng),
      mouthStyle: pickOne(MOUTH_STYLES, rng),
      outfitStyle: pickOne(OUTFIT_STYLES, rng),
      outfitColor: pickOne(OUTFIT_COLORS, rng),
      accessory: pickOne(ACCESSORIES, rng),
      bgPattern: pickOne(BG_PATTERNS, rng),
      bgColor: pickOne(BG_COLORS, rng),
    };
  }

  // Harmonious warm 3D complexion (defaults to scale 4 balanced warm amber)
  const mst = getMonkSkinToneOption(options?.monkSkinTone ?? 4);
  const genderAccessories: readonly AvatarConfig['accessory'][] =
    presentation === 'feminine'
      ? ['none', 'starPin', 'roundGlasses', 'headband', 'glasses']
      : ['none', 'starPin', 'glasses', 'roundGlasses', 'headband', 'bowtie'];

  return {
    seed,
    presentation,
    avatarKind: 'human',
    monkSkinTone: mst.scale,
    skinTone: mst.hex,
    faceShape: pickOne(FACE_SHAPES, rng),
    hairStyle: pickOne(hairPool, rng),
    hairColor: pickOne(HAIR_COLORS, rng),
    eyeStyle: pickOne(EYE_STYLES, rng),
    eyebrowStyle: presentation === 'feminine' ? pickOne(['arch', 'soft', 'raised'] as const, rng) : pickOne(['straight', 'arch', 'raised'] as const, rng),
    mouthStyle: pickOne(['warmSmile', 'bigGrin', 'openSmile', 'gentle'] as const, rng),
    outfitStyle: pickOne(OUTFIT_STYLES, rng),
    outfitColor: pickOne(OUTFIT_COLORS, rng),
    accessory: pickOne(genderAccessories, rng),
    bgPattern: pickOne(BG_PATTERNS, rng),
    bgColor: pickOne(BG_COLORS, rng),
  };
}

/**
 * Generates an avatar configuration that avoids colliding with existing class avatars.
 */
export function pickUniqueAvatarConfig(
  presentationPref: CharacterPresentation,
  existingConfigs: readonly AvatarConfig[],
  rng?: RandomSource,
  options?: GenerateAvatarOptions
): AvatarConfig {
  const existingSignatures = new Set(existingConfigs.map(avatarSignature));
  for (let attempt = 0; attempt < 28; attempt++) {
    const candidate = generateAvatarConfig(presentationPref, rng, options);
    if (!existingSignatures.has(avatarSignature(candidate))) {
      return candidate;
    }
  }
  return generateAvatarConfig(presentationPref, rng, options);
}

/**
 * Randomizes style, hairstyle, outfit, backdrop, and expression traits while strictly
 * preserving the existing avatarKind, skinTone, monkSkinTone, and mascotId, and
 * ensuring the hairstyle matches the target gender/presentation.
 */
export function randomizeStyleKeepingSkinTone(
  current: AvatarConfig,
  presentationPref: CharacterPresentation,
  rng?: RandomSource,
  studentName?: string
): AvatarConfig {
  const kind: AvatarKind = current.avatarKind ?? 'human';
  const resolvedPres = resolvePresentation(presentationPref, rng, studentName);
  const fresh = generateAvatarConfig(resolvedPres, rng, {
    avatarKind: kind,
    monkSkinTone: current.monkSkinTone ?? 4,
    mascotId: current.mascotId,
    studentName,
  });

  return {
    ...fresh,
    presentation: resolvedPres,
    avatarKind: current.avatarKind ?? kind,
    skinTone: current.skinTone || HARMONIOUS_3D_BASE_TONE,
    monkSkinTone: current.monkSkinTone ?? (kind === 'human' ? 4 : undefined),
    mascotId: current.mascotId,
  };
}

/**
 * Applies a curiosity-sparking 3D student archetype preset while keeping gender-matched 3D hair
 * and harmonious warm complexion.
 */
export function applyCharacterArchetype(
  current: AvatarConfig,
  archetypeId: CharacterArchetypeId,
  presentationPref: CharacterPresentation,
  studentName?: string
): AvatarConfig {
  const preset =
    CHARACTER_ARCHETYPES.find((a) => a.id === archetypeId) ?? CHARACTER_ARCHETYPES[0];
  const resolvedPres = resolvePresentation(presentationPref, undefined, studentName);
  const hairPool = getHairPoolForPresentation(resolvedPres);
  const hairStyle = hairPool.includes(current.hairStyle)
    ? current.hairStyle
    : pickOne(hairPool);

  return {
    ...current,
    avatarKind: 'human',
    presentation: resolvedPres,
    skinTone: HARMONIOUS_3D_BASE_TONE,
    monkSkinTone: 4,
    hairStyle,
    outfitStyle: preset.outfitStyle,
    outfitColor: preset.outfitColor,
    accessory: preset.accessory,
    eyeStyle: preset.eyeStyle,
    mouthStyle: preset.mouthStyle,
    bgPattern: preset.bgPattern,
    bgColor: preset.bgColor,
  };
}

/**
 * Upgrades existing mascot/starter students or untyped 'random'/'neutral' students
 * to a gender-matched 3D Student Character with a harmonious warm complexion.
 */
export function reconcileStudent3DCharacter(
  student: Student,
  existingConfigs: readonly AvatarConfig[] = []
): { student: Student; changed: boolean } {
  const detectedGender = detectStudentGenderFromName(student.name);
  const effectivePresentation: CharacterPresentation =
    student.characterPresentation === 'masculine' || student.characterPresentation === 'feminine'
      ? student.characterPresentation
      : detectedGender;

  const resolvedTarget: ResolvedPresentation =
    effectivePresentation === 'feminine' ? 'feminine' : 'masculine';

  const currentCfg = student.avatarConfig;
  const isMascotDefault = currentCfg.avatarKind === 'mascot';
  const hairPool = getHairPoolForPresentation(resolvedTarget);
  const hairMatchesGender = hairPool.includes(currentCfg.hairStyle);
  const needsHarmoniousTone =
    currentCfg.avatarKind === 'human' &&
    currentCfg.monkSkinTone !== undefined &&
    (currentCfg.monkSkinTone <= 2 || currentCfg.monkSkinTone >= 7);

  if (
    !isMascotDefault &&
    currentCfg.avatarKind === 'human' &&
    student.characterPresentation === effectivePresentation &&
    currentCfg.presentation === resolvedTarget &&
    hairMatchesGender &&
    !needsHarmoniousTone
  ) {
    return { student, changed: false };
  }

  const nextConfig = pickUniqueAvatarConfig(resolvedTarget, existingConfigs, undefined, {
    avatarKind: 'human',
    monkSkinTone: 4,
    studentName: student.name,
  });

  return {
    changed: true,
    student: {
      ...student,
      characterPresentation: effectivePresentation,
      avatarConfig: nextConfig,
    },
  };
}

function renderBackdropDecor(bgPattern: AvatarConfig['bgPattern']): string {
  if (bgPattern === 'dots') {
    return `
      <circle cx="34" cy="38" r="7" fill="#FFFFFF" fill-opacity="0.55"/>
      <circle cx="204" cy="44" r="9" fill="#FFFFFF" fill-opacity="0.5"/>
      <circle cx="38" cy="168" r="8" fill="#FFFFFF" fill-opacity="0.45"/>
      <circle cx="202" cy="154" r="6" fill="#FFFFFF" fill-opacity="0.5"/>
    `;
  }
  if (bgPattern === 'sunburst') {
    return `
      <circle cx="120" cy="112" r="92" fill="#FFFFFF" fill-opacity="0.38"/>
      <circle cx="120" cy="112" r="68" fill="#FFFFFF" fill-opacity="0.45"/>
    `;
  }
  if (bgPattern === 'stripes') {
    return `<path d="M-10 42L250 12M-10 96L250 66M-10 150L250 120" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="11"/>`;
  }
  if (bgPattern === 'waves') {
    return `<path d="M0 162 Q60 144 120 162 T240 162 L240 240 L0 240 Z" fill="#FFFFFF" fill-opacity="0.4"/>`;
  }
  if (bgPattern === 'stars') {
    return `
      <path d="M36 40l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#FFFFFF" fill-opacity="0.75"/>
      <path d="M200 52l3.5 7.5 7.5 1-5.5 5 1.5 7.5-7-4-7 4 1.5-7.5-5.5-5 7.5-1z" fill="#FFFFFF" fill-opacity="0.75"/>
      <circle cx="48" cy="148" r="4" fill="#FFFFFF" fill-opacity="0.65"/>
      <circle cx="196" cy="138" r="4.5" fill="#FFFFFF" fill-opacity="0.65"/>
    `;
  }
  return '';
}

function renderMascotSvg(config: AvatarConfig, size: number): string {
  const mascot = getClassroomMascotOption(config.mascotId);
  const uid = config.seed.replace(/[^a-zA-Z0-9_-]/g, '');
  const bgMarkup = renderBackdropDecor(config.bgPattern);
  const outfitColor = config.outfitColor || mascot.primaryColor;

  let headMarkup = '';
  if (mascot.id === 'owl') {
    headMarkup = `
      <path d="M72 78 L58 50 L92 66 Z" fill="${mascot.primaryColor}"/>
      <path d="M168 78 L182 50 L148 66 Z" fill="${mascot.primaryColor}"/>
      <ellipse cx="120" cy="116" rx="56" ry="52" fill="url(#mascotMain-${uid})"/>
      <circle cx="96" cy="112" r="22" fill="#FFFFFF"/>
      <circle cx="144" cy="112" r="22" fill="#FFFFFF"/>
      <circle cx="97" cy="112" r="11" fill="#231C16"/>
      <circle cx="143" cy="112" r="11" fill="#231C16"/>
      <circle cx="93" cy="108" r="4.2" fill="#FFFFFF"/>
      <circle cx="139" cy="108" r="4.2" fill="#FFFFFF"/>
      <path d="M111 124 L129 124 L120 139 Z" fill="#E6A23C"/>
      <ellipse cx="120" cy="198" rx="40" ry="30" fill="#FAF6EE" fill-opacity="0.88"/>
    `;
  } else if (mascot.id === 'fox') {
    headMarkup = `
      <path d="M68 92 L58 40 L102 68 Z" fill="url(#mascotMain-${uid})"/>
      <path d="M172 92 L182 40 L138 68 Z" fill="url(#mascotMain-${uid})"/>
      <path d="M72 84 L66 52 L94 70 Z" fill="#FAF6EE"/>
      <path d="M168 84 L174 52 L146 70 Z" fill="#FAF6EE"/>
      <path d="M66 112 C66 72 92 60 120 60 C148 60 174 72 174 112 C174 148 148 168 120 168 C92 168 66 148 66 112 Z" fill="url(#mascotMain-${uid})"/>
      <path d="M70 122 C86 118 104 126 120 140 C136 126 154 118 170 122 C164 152 144 168 120 168 C96 168 76 152 70 122 Z" fill="#FAF6EE"/>
      <circle cx="97" cy="108" r="9.5" fill="#231C16"/>
      <circle cx="143" cy="108" r="9.5" fill="#231C16"/>
      <circle cx="94" cy="105" r="3.4" fill="#FFFFFF"/>
      <circle cx="140" cy="105" r="3.4" fill="#FFFFFF"/>
      <ellipse cx="120" cy="133" rx="9" ry="6.5" fill="#231C16"/>
      <path d="M111 143 Q120 150 129 143" stroke="#6B5E52" stroke-width="3" stroke-linecap="round" fill="none"/>
    `;
  } else if (mascot.id === 'panda') {
    headMarkup = `
      <circle cx="74" cy="68" r="20" fill="#2A2420"/>
      <circle cx="166" cy="68" r="20" fill="#2A2420"/>
      <ellipse cx="120" cy="116" rx="55" ry="51" fill="#FFFFFF"/>
      <ellipse cx="95" cy="112" rx="16" ry="20" transform="rotate(-14 95 112)" fill="#2A2420"/>
      <ellipse cx="145" cy="112" rx="16" ry="20" transform="rotate(14 145 112)" fill="#2A2420"/>
      <circle cx="96" cy="112" r="7" fill="#FFFFFF"/>
      <circle cx="144" cy="112" r="7" fill="#FFFFFF"/>
      <circle cx="97" cy="112" r="4" fill="#231C16"/>
      <circle cx="143" cy="112" r="4" fill="#231C16"/>
      <circle cx="94.5" cy="109.5" r="2" fill="#FFFFFF"/>
      <circle cx="140.5" cy="109.5" r="2" fill="#FFFFFF"/>
      <ellipse cx="120" cy="130" rx="9" ry="6" fill="#2A2420"/>
      <path d="M110 140 Q120 149 130 140" stroke="#2A2420" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <ellipse cx="82" cy="131" rx="8" ry="4.5" fill="#E68A7E" fill-opacity="0.45"/>
      <ellipse cx="158" cy="131" rx="8" ry="4.5" fill="#E68A7E" fill-opacity="0.45"/>
    `;
  } else if (mascot.id === 'bot') {
    headMarkup = `
      <line x1="120" y1="42" x2="120" y2="62" stroke="#544D47" stroke-width="5" stroke-linecap="round"/>
      <circle cx="120" cy="36" r="9" fill="#E6A23C"/>
      <rect x="64" y="62" width="112" height="98" rx="28" fill="url(#mascotMain-${uid})"/>
      <rect x="78" y="80" width="84" height="54" rx="18" fill="#231C16"/>
      <circle cx="101" cy="106" r="9" fill="#63E6BE"/>
      <circle cx="139" cy="106" r="9" fill="#63E6BE"/>
      <circle cx="98" cy="103" r="3" fill="#FFFFFF"/>
      <circle cx="136" cy="103" r="3" fill="#FFFFFF"/>
      <path d="M107 143 Q120 152 133 143" stroke="#FAF6EE" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    `;
  } else if (mascot.id === 'astronaut') {
    headMarkup = `
      <circle cx="120" cy="112" r="56" fill="#FFFFFF" stroke="#D8CFC1" stroke-width="4"/>
      <ellipse cx="120" cy="113" rx="42" ry="36" fill="#2A3E4F"/>
      <path d="M90 92 Q115 80 144 92" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round" fill="none"/>
      <circle cx="102" cy="112" r="7.5" fill="#E6A23C"/>
      <circle cx="138" cy="112" r="7.5" fill="#E6A23C"/>
      <circle cx="100" cy="110" r="2.8" fill="#FFFFFF"/>
      <circle cx="136" cy="110" r="2.8" fill="#FFFFFF"/>
      <path d="M111 128 Q120 135 129 128" stroke="#FAF6EE" stroke-width="3" stroke-linecap="round" fill="none"/>
    `;
  } else {
    headMarkup = `
      <path d="M120 66 C120 44 138 34 152 40 C148 56 134 64 120 66 Z" fill="#2F7D5B"/>
      <path d="M120 66 C120 46 102 36 88 42 C92 58 106 64 120 66 Z" fill="#4FA37B"/>
      <ellipse cx="120" cy="116" rx="52" ry="49" fill="url(#mascotMain-${uid})"/>
      <ellipse cx="106" cy="84" rx="15" ry="6" fill="#FFFFFF" fill-opacity="0.25"/>
      <circle cx="99" cy="114" r="7.5" fill="#231C16"/>
      <circle cx="141" cy="114" r="7.5" fill="#231C16"/>
      <circle cx="96.5" cy="111.5" r="2.8" fill="#FFFFFF"/>
      <circle cx="138.5" cy="111.5" r="2.8" fill="#FFFFFF"/>
      <ellipse cx="86" cy="127" rx="8" ry="4.5" fill="#E67A6B" fill-opacity="0.32"/>
      <ellipse cx="154" cy="127" rx="8" ry="4.5" fill="#E67A6B" fill-opacity="0.32"/>
      <path d="M108 131 Q120 142 132 131" stroke="#231C16" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}" role="img" aria-label="Classroom 3D mascot avatar">
  <defs>
    <clipPath id="avatarClip-${uid}">
      <rect x="0" y="0" width="240" height="240" rx="28"/>
    </clipPath>
    <radialGradient id="bg3d-${uid}" cx="40%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${config.bgColor}" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="mascotMain-${uid}" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="${mascot.highlightColor}"/>
      <stop offset="65%" stop-color="${mascot.primaryColor}"/>
      <stop offset="100%" stop-color="#1E1B18" stop-opacity="0.88"/>
    </radialGradient>
    <linearGradient id="outfit3d-${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="${outfitColor}"/>
      <stop offset="100%" stop-color="#1E1B18" stop-opacity="0.24"/>
    </linearGradient>
    <filter id="drop3d-${uid}" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1E1B18" flood-opacity="0.16"/>
    </filter>
  </defs>
  <g clip-path="url(#avatarClip-${uid})">
    <rect width="240" height="240" fill="${config.bgColor}"/>
    <rect width="240" height="240" fill="url(#bg3d-${uid})"/>
    ${bgMarkup}
    <g filter="url(#drop3d-${uid})">
      <path d="M46 240 C48 190 78 174 120 174 C162 174 192 190 194 240 Z" fill="${outfitColor}"/>
      <path d="M46 240 C48 190 78 174 120 174 C162 174 192 190 194 240 Z" fill="url(#outfit3d-${uid})"/>
      ${headMarkup}
    </g>
  </g>
</svg>`;
}

/**
 * Renders a high-craft 3D Pixar / Vinyl-Toy inspired Student Character portrait in SVG.
 * Uses multi-stop radial 3D subsurface scattering gradients, ambient occlusion shadows,
 * sculpted 3D hair volumes with specular highlights, glossy 3D irises, and gender-distinct
 * facial & hair styling.
 */
export function renderAvatarSvg(config: AvatarConfig, size = 240): string {
  if (config.avatarKind === 'mascot') {
    return renderMascotSvg(config, size);
  }

  const {
    presentation,
    faceShape,
    hairStyle,
    hairColor,
    eyeStyle,
    eyebrowStyle,
    mouthStyle,
    outfitStyle,
    outfitColor,
    accessory,
    bgPattern,
    bgColor,
  } = config;

  const isFeminine = presentation === 'feminine';

  // Use harmonious warm 3D complexion
  const mstPalette = getMonkSkinToneOption(config.monkSkinTone ?? 4);
  const skinHighlight = mstPalette.highlightHex;
  const skinBase = config.avatarKind === 'legacy' ? (config.skinTone || UNIFORM_CARTOON_TONE) : mstPalette.hex;
  const skinShadow = mstPalette.shadowHex;
  const skinDeepShadow = mstPalette.deepShadowHex;
  const cheekColor = mstPalette.cheekHex;

  const uid = config.seed.replace(/[^a-zA-Z0-9_-]/g, '');
  const bgMarkup = renderBackdropDecor(bgPattern);

  // Choose warm 3D iris color deterministically from seed
  const irisPalette = ['#4E3222', '#3B5249', '#5A3A27', '#2E4960', '#63412C'];
  const seedSum = config.seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const irisColor = irisPalette[seedSum % irisPalette.length];

  // 1. Sculpted 3D Back Hair (rendered behind head & shoulders)
  let backHair = '';
  if (hairStyle === 'longWave') {
    backHair = `
      <path d="M50 96 C40 146 44 198 60 228 L180 228 C196 198 200 146 190 96 C182 40 58 40 50 96Z" fill="url(#hairDark-${uid})"/>
      <path d="M54 98 C46 144 50 192 64 222 C74 198 76 156 72 118 Z" fill="url(#hair3d-${uid})"/>
      <path d="M186 98 C194 144 190 192 176 222 C166 198 164 156 168 118 Z" fill="url(#hair3d-${uid})"/>
    `;
  } else if (hairStyle === 'bobCut' || hairStyle === 'curlyBob') {
    backHair = `
      <path d="M52 96 C46 138 54 174 74 182 L166 182 C186 174 194 138 188 96 C180 42 60 42 52 96Z" fill="url(#hairDark-${uid})"/>
      <path d="M56 102 C52 136 58 166 74 176 C78 148 76 122 72 102 Z" fill="url(#hair3d-${uid})"/>
      <path d="M184 102 C188 136 182 166 166 176 C162 148 164 122 168 102 Z" fill="url(#hair3d-${uid})"/>
    `;
  } else if (hairStyle === 'shoulderLayers') {
    backHair = `
      <path d="M48 100 C42 150 50 194 68 208 L172 208 C190 194 198 150 192 100 C184 44 56 44 48 100Z" fill="url(#hairDark-${uid})"/>
      <ellipse cx="60" cy="166" rx="16" ry="28" fill="url(#hair3d-${uid})"/>
      <ellipse cx="180" cy="166" rx="16" ry="28" fill="url(#hair3d-${uid})"/>
    `;
  } else if (hairStyle === 'twinPuffs') {
    backHair = `
      <circle cx="52" cy="70" r="28" fill="url(#hair3d-${uid})"/>
      <circle cx="188" cy="70" r="28" fill="url(#hair3d-${uid})"/>
      <ellipse cx="45" cy="58" rx="11" ry="6.5" transform="rotate(-20 45 58)" fill="#FFFFFF" fill-opacity="0.22"/>
      <ellipse cx="181" cy="58" rx="11" ry="6.5" transform="rotate(-20 181 58)" fill="#FFFFFF" fill-opacity="0.22"/>
      <circle cx="66" cy="82" r="7" fill="${outfitColor}"/>
      <circle cx="174" cy="82" r="7" fill="${outfitColor}"/>
    `;
  } else if (hairStyle === 'highPonytail') {
    backHair = `
      <path d="M138 38 C178 24 206 58 196 112 C190 138 176 150 166 140 C174 110 166 74 140 58Z" fill="url(#hair3d-${uid})"/>
      <ellipse cx="148" cy="50" rx="12" ry="8" transform="rotate(28 148 50)" fill="${outfitColor}"/>
    `;
  } else if (hairStyle === 'braids') {
    backHair = `
      <ellipse cx="58" cy="126" rx="13" ry="16" fill="url(#hair3d-${uid})"/>
      <ellipse cx="58" cy="150" rx="12" ry="15" fill="url(#hair3d-${uid})"/>
      <ellipse cx="58" cy="172" rx="10.5" ry="13" fill="url(#hair3d-${uid})"/>
      <ellipse cx="182" cy="126" rx="13" ry="16" fill="url(#hair3d-${uid})"/>
      <ellipse cx="182" cy="150" rx="12" ry="15" fill="url(#hair3d-${uid})"/>
      <ellipse cx="182" cy="172" rx="10.5" ry="13" fill="url(#hair3d-${uid})"/>
      <circle cx="58" cy="184" r="6.5" fill="${outfitColor}"/>
      <circle cx="182" cy="184" r="6.5" fill="${outfitColor}"/>
    `;
  }

  // 2. Sculpted 3D Outfit Details
  let outfitExtra = '';
  if (outfitStyle === 'collar') {
    outfitExtra = `
      <path d="M90 175 L120 212 L150 175 Z" fill="#FAF8F5"/>
      <path d="M88 174 L110 202 L94 206 Z" fill="#E8E1D7"/>
      <path d="M152 174 L130 202 L146 206 Z" fill="#E8E1D7"/>
      <path d="M115 196 L125 196 L128 236 L120 240 L112 236 Z" fill="#C24638"/>
      <circle cx="152" cy="212" r="8" fill="#F2C14E" stroke="#FFFFFF" stroke-width="1.5"/>
    `;
  } else if (outfitStyle === 'hoodie') {
    outfitExtra = `
      <path d="M74 178 C86 164 154 164 166 178 C154 198 86 198 74 178 Z" fill="url(#outfit3d-${uid})" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="2"/>
      <path d="M84 180 Q120 206 156 180" stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <line x1="105" y1="194" x2="105" y2="225" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="3.6" stroke-linecap="round"/>
      <line x1="135" y1="194" x2="135" y2="225" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="105" cy="226" r="3.2" fill="#FFFFFF"/>
      <circle cx="135" cy="226" r="3.2" fill="#FFFFFF"/>
    `;
  } else if (outfitStyle === 'stripes') {
    outfitExtra = `
      <path d="M92 175 Q120 194 148 175" stroke="#FFFFFF" stroke-width="5" fill="none"/>
      <rect x="56" y="198" width="128" height="9" fill="#FFFFFF" fill-opacity="0.38"/>
      <rect x="48" y="216" width="144" height="9" fill="#FFFFFF" fill-opacity="0.38"/>
    `;
  } else if (outfitStyle === 'cardigan') {
    outfitExtra = `
      <path d="M96 175 L120 238 L144 175 Z" fill="#FAF8F5"/>
      <path d="M96 175 L120 238" stroke="#1E1B18" stroke-opacity="0.2" stroke-width="2.5"/>
      <path d="M144 175 L120 238" stroke="#1E1B18" stroke-opacity="0.2" stroke-width="2.5"/>
      <circle cx="120" cy="206" r="3.2" fill="#3A2E26"/>
      <circle cx="120" cy="222" r="3.2" fill="#3A2E26"/>
    `;
  } else if (outfitStyle === 'overalls') {
    outfitExtra = `
      <rect x="84" y="178" width="15" height="62" rx="4" fill="#2A4050"/>
      <rect x="141" y="178" width="15" height="62" rx="4" fill="#2A4050"/>
      <rect x="82" y="204" width="76" height="36" rx="6" fill="#2A4050"/>
      <circle cx="91.5" cy="211" r="3.2" fill="#F2C14E"/>
      <circle cx="148.5" cy="211" r="3.2" fill="#F2C14E"/>
    `;
  } else {
    // crewneck with 3D ribbed collar
    outfitExtra = `
      <path d="M90 175 Q120 195 150 175" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    `;
  }

  // 3. Sculpted 3D Head / Face Volume
  let facePath = '';
  if (faceShape === 'round') {
    facePath = `<rect x="68" y="60" width="104" height="110" rx="52" fill="url(#face3d-${uid})"/>`;
  } else if (faceShape === 'softSquare') {
    facePath = `<rect x="70" y="60" width="100" height="110" rx="40" fill="url(#face3d-${uid})"/>`;
  } else if (faceShape === 'heart') {
    facePath = `<path d="M69 96 C69 64 92 56 120 56 C148 56 171 64 171 96 C171 138 148 171 120 171 C92 171 69 138 69 96Z" fill="url(#face3d-${uid})"/>`;
  } else {
    facePath = `<rect x="71" y="59" width="98" height="111" rx="49" fill="url(#face3d-${uid})"/>`;
  }

  // 4. Expressive 3D Glossy Eyes + Gender-appropriate Eyelashes
  const lashesLeft = isFeminine
    ? `<path d="M84 107 Q80 103 79 99 M88 103 Q86 98 85 95 M108 105 Q111 101 113 98" stroke="#1E1916" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    : '';
  const lashesRight = isFeminine
    ? `<path d="M156 107 Q160 103 161 99 M152 103 Q154 98 155 95 M132 105 Q129 101 127 98" stroke="#1E1916" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    : '';

  const render3DOpenEye = (cx: number, cy: number, rx = 10.5, ry = 11) => `
    <ellipse cx="${cx}" cy="${cy + 1.5}" rx="${rx + 1}" ry="${ry}" fill="${skinDeepShadow}" fill-opacity="0.22"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#FFFFFF"/>
    <circle cx="${cx + 0.5}" cy="${cy}" r="${rx * 0.66}" fill="${irisColor}"/>
    <circle cx="${cx + 0.5}" cy="${cy}" r="${rx * 0.38}" fill="#181512"/>
    <circle cx="${cx - 2.4}" cy="${cy - 3}" r="2.8" fill="#FFFFFF"/>
    <circle cx="${cx + 3}" cy="${cy + 2.8}" r="1.3" fill="#FFFFFF" fill-opacity="0.8"/>
    <path d="M${cx - rx} ${cy - 1} Q${cx} ${cy - ry - 2} ${cx + rx} ${cy - 1}" stroke="#1E1916" stroke-width="${isFeminine ? '3.4' : '2.8'}" stroke-linecap="round" fill="none"/>
  `;

  let eyesMarkup = '';
  if (eyeStyle === 'cheerful') {
    eyesMarkup = `
      <path d="M87 112 Q97 100 107 112" stroke="#1E1916" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      <path d="M133 112 Q143 100 153 112" stroke="#1E1916" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      ${lashesLeft}
      ${lashesRight}
    `;
  } else if (eyeStyle === 'wink') {
    eyesMarkup = `
      ${render3DOpenEye(97, 111)}
      ${lashesLeft}
      <path d="M133 112 Q143 101 153 112" stroke="#1E1916" stroke-width="4" stroke-linecap="round" fill="none"/>
    `;
  } else if (eyeStyle === 'curious') {
    eyesMarkup = `
      ${render3DOpenEye(97, 111, 11, 11.5)}
      ${render3DOpenEye(143, 111, 11, 11.5)}
      ${lashesLeft}
      ${lashesRight}
    `;
  } else if (eyeStyle === 'calm') {
    eyesMarkup = `
      ${render3DOpenEye(97, 112, 10, 9.5)}
      ${render3DOpenEye(143, 112, 10, 9.5)}
      ${lashesLeft}
      ${lashesRight}
    `;
  } else {
    eyesMarkup = `
      ${render3DOpenEye(97, 111, 10.5, 11)}
      ${render3DOpenEye(143, 111, 10.5, 11)}
      ${lashesLeft}
      ${lashesRight}
    `;
  }

  // 5. Expressive 3D Eyebrows
  const browStroke = isFeminine ? '3.6' : '4.4';
  let browsMarkup = '';
  if (eyebrowStyle === 'arch') {
    browsMarkup = `
      <path d="M85 95 Q97 87 109 94" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
      <path d="M131 94 Q143 87 155 95" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
    `;
  } else if (eyebrowStyle === 'raised') {
    browsMarkup = `
      <path d="M85 95 Q97 90 109 94" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
      <path d="M131 91 Q143 84 155 92" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
    `;
  } else if (eyebrowStyle === 'straight') {
    browsMarkup = `
      <path d="M86 94 Q97 92 109 94" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
      <path d="M131 94 Q143 92 154 94" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
    `;
  } else {
    browsMarkup = `
      <path d="M86 95 Q97 90 108 95" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
      <path d="M132 95 Q143 90 154 95" stroke="${hairColor}" stroke-width="${browStroke}" stroke-linecap="round" fill="none"/>
    `;
  }

  // 6. 3D Sculpted Mouth & Smile
  const lipTint = isFeminine ? '#C95B52' : '#7A3B2E';
  let mouthMarkup = '';
  if (mouthStyle === 'bigGrin') {
    mouthMarkup = `
      <path d="M101 138 Q120 158 139 138 Z" fill="#FFFFFF" stroke="${lipTint}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M106 140 Q120 146 134 140" stroke="#E8DFD5" stroke-width="1.2" fill="none"/>
    `;
  } else if (mouthStyle === 'openSmile') {
    mouthMarkup = `
      <path d="M103 137 Q120 157 137 137 Z" fill="#7D2923" stroke="${lipTint}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M106 138 Q120 143 134 138 Z" fill="#FFFFFF"/>
      <path d="M111 146 Q120 152 129 146" stroke="#EE7E73" stroke-width="4" stroke-linecap="round" fill="none"/>
    `;
  } else if (mouthStyle === 'gentle') {
    mouthMarkup = `
      <path d="M107 140 Q120 148 133 140" stroke="${lipTint}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
      <path d="M113 145 Q120 148 127 145" stroke="${skinShadow}" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round" fill="none"/>
    `;
  } else if (mouthStyle === 'whistle') {
    mouthMarkup = `<circle cx="122" cy="142" r="4.6" fill="#7D2923" stroke="${lipTint}" stroke-width="2"/>`;
  } else {
    mouthMarkup = `
      <path d="M104 138 Q120 152 136 138" stroke="${lipTint}" stroke-width="3.8" stroke-linecap="round" fill="none"/>
      <path d="M112 147 Q120 151 128 147" stroke="${skinShadow}" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round" fill="none"/>
    `;
  }

  // 7. Sculpted 3D Front Hair with Specular Rim Highlights
  let frontHair = '';
  switch (hairStyle) {
    case 'shortCrop':
      // 3D Textured Boy Quiff
      frontHair = `
        <path d="M67 98 C65 50 92 36 122 36 C152 36 175 52 173 98 C164 74 146 66 120 68 C94 66 76 74 67 98Z" fill="url(#hair3d-${uid})"/>
        <path d="M88 52 Q122 38 152 54" stroke="#FFFFFF" stroke-opacity="0.26" stroke-width="6" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'sidePart':
      // 3D Boy Side-Swept Taper
      frontHair = `
        <path d="M66 102 C63 48 92 36 124 36 C156 36 177 54 173 102 C163 76 140 62 106 74 C88 80 76 86 66 102Z" fill="url(#hair3d-${uid})"/>
        <path d="M92 50 Q128 40 156 58" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'curlyTop':
      // 3D Fluffy Curly Boy Crown
      frontHair = `
        <circle cx="84" cy="62" r="20" fill="url(#hair3d-${uid})"/>
        <circle cx="106" cy="50" r="22" fill="url(#hair3d-${uid})"/>
        <circle cx="134" cy="50" r="22" fill="url(#hair3d-${uid})"/>
        <circle cx="156" cy="62" r="20" fill="url(#hair3d-${uid})"/>
        <circle cx="72" cy="80" r="15" fill="url(#hair3d-${uid})"/>
        <circle cx="168" cy="80" r="15" fill="url(#hair3d-${uid})"/>
        <path d="M96 44 Q108 38 118 44 M126 44 Q138 38 148 44" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'spikyNeat':
      // 3D Hero Spiky Sweep
      frontHair = `
        <path d="M68 98 L69 62 L88 42 L104 56 L122 32 L138 54 L156 38 L171 62 L172 98 C160 72 140 66 120 66 C100 66 80 72 68 98Z" fill="url(#hair3d-${uid})"/>
        <path d="M92 56 L120 38 L146 54" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'buzz':
      // 3D Sporty Fade
      frontHair = `
        <path d="M70 92 C70 50 94 42 120 42 C146 42 170 50 170 92 C160 70 142 64 120 64 C98 64 80 70 70 92Z" fill="url(#hair3d-${uid})"/>
        <path d="M92 52 Q120 44 148 52" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="5" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'wavySweep':
      // 3D Wavy Flow Undercut
      frontHair = `
        <path d="M66 102 C64 48 94 36 128 36 C158 36 177 56 174 100 C158 72 136 62 114 72 C92 82 78 86 66 102Z" fill="url(#hair3d-${uid})"/>
        <path d="M88 52 Q124 38 156 54" stroke="#FFFFFF" stroke-opacity="0.26" stroke-width="6" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'longWave':
    case 'bobCut':
    case 'braids':
    case 'shoulderLayers':
    case 'highPonytail':
    case 'twinPuffs':
      // 3D Girl Curtain Bangs & Silky Crown Volume with Hair Barrette
      frontHair = `
        <path d="M64 106 C64 48 90 36 120 36 C150 36 176 48 176 106 C160 76 142 66 120 72 C98 66 80 76 64 106Z" fill="url(#hair3d-${uid})"/>
        <path d="M86 52 Q120 40 154 52" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="6" stroke-linecap="round" fill="none"/>
        <rect x="148" y="68" width="16" height="6" rx="3" transform="rotate(18 148 68)" fill="#F2C14E"/>
      `;
      break;
    case 'fluffyCurl':
    case 'curlyBob':
      frontHair = `
        <circle cx="80" cy="66" r="19" fill="url(#hair3d-${uid})"/>
        <circle cx="102" cy="52" r="21" fill="url(#hair3d-${uid})"/>
        <circle cx="130" cy="52" r="21" fill="url(#hair3d-${uid})"/>
        <circle cx="154" cy="64" r="19" fill="url(#hair3d-${uid})"/>
        <circle cx="168" cy="84" r="14" fill="url(#hair3d-${uid})"/>
        <circle cx="72" cy="84" r="14" fill="url(#hair3d-${uid})"/>
      `;
      break;
    default:
      frontHair = `
        <path d="M66 100 C66 50 92 38 120 38 C148 38 174 50 174 100 C160 74 142 66 120 66 C98 66 80 74 66 100Z" fill="url(#hair3d-${uid})"/>
        <path d="M90 52 Q120 42 150 52" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      `;
      break;
  }

  // 8. 3D Accessories (Sleek Glasses, Gold Round Specs, Headband/Headphones, Star Badge, Beanie)
  let accessoryMarkup = '';
  if (accessory === 'glasses') {
    accessoryMarkup = `
      <rect x="79" y="99" width="36" height="24" rx="7.5" fill="#FFFFFF" fill-opacity="0.18" stroke="#1E1916" stroke-width="3.4"/>
      <rect x="125" y="99" width="36" height="24" rx="7.5" fill="#FFFFFF" fill-opacity="0.18" stroke="#1E1916" stroke-width="3.4"/>
      <path d="M84 103 L92 118 M130 103 L138 118" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="115" y1="110" x2="125" y2="110" stroke="#1E1916" stroke-width="3.4"/>
    `;
  } else if (accessory === 'roundGlasses') {
    accessoryMarkup = `
      <circle cx="97" cy="111" r="16" fill="#FFFFFF" fill-opacity="0.18" stroke="#B87D28" stroke-width="3.2"/>
      <circle cx="143" cy="111" r="16" fill="#FFFFFF" fill-opacity="0.18" stroke="#B87D28" stroke-width="3.2"/>
      <line x1="113" y1="111" x2="127" y2="111" stroke="#B87D28" stroke-width="3.2"/>
    `;
  } else if (accessory === 'headband') {
    accessoryMarkup = `
      <path d="M68 86 Q120 52 172 86" stroke="${outfitColor}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M74 82 Q120 52 166 82" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    `;
  } else if (accessory === 'bowtie') {
    accessoryMarkup = `
      <path d="M102 176 L120 186 L102 196 Z" fill="#C44D3B"/>
      <path d="M138 176 L120 186 L138 196 Z" fill="#B03E2E"/>
      <circle cx="120" cy="186" r="5" fill="#8C2F22"/>
    `;
  } else if (accessory === 'starPin') {
    accessoryMarkup = `
      <path d="M150 192l3.5 7 7.5 1-5.5 5 1.5 7.5-7-3.8-7 3.8 1.5-7.5-5.5-5 7.5-1z" fill="#F2C14E" stroke="#8F6310" stroke-width="1.3"/>
    `;
  } else if (accessory === 'beanie') {
    accessoryMarkup = `
      <path d="M65 82 C67 38 94 28 120 28 C146 28 173 38 175 82 Z" fill="url(#outfit3d-${uid})"/>
      <rect x="62" y="72" width="116" height="18" rx="9" fill="#FAF8F5" fill-opacity="0.32" stroke="${outfitColor}" stroke-width="3"/>
      <circle cx="120" cy="24" r="10" fill="${outfitColor}"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}" role="img" aria-label="Student 3D character avatar">
  <defs>
    <clipPath id="avatarClip-${uid}">
      <rect x="0" y="0" width="240" height="240" rx="28"/>
    </clipPath>
    <radialGradient id="bg3d-${uid}" cx="38%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.72"/>
      <stop offset="65%" stop-color="${bgColor}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${bgColor}" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="face3d-${uid}" cx="38%" cy="30%" r="68%">
      <stop offset="0%" stop-color="${skinHighlight}"/>
      <stop offset="52%" stop-color="${skinBase}"/>
      <stop offset="88%" stop-color="${skinShadow}"/>
      <stop offset="100%" stop-color="${skinDeepShadow}"/>
    </radialGradient>
    <linearGradient id="neck3d-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skinDeepShadow}"/>
      <stop offset="45%" stop-color="${skinShadow}"/>
      <stop offset="100%" stop-color="${skinBase}"/>
    </linearGradient>
    <radialGradient id="hair3d-${uid}" cx="35%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="22%" stop-color="${hairColor}" stop-opacity="1"/>
      <stop offset="85%" stop-color="${hairColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0E0B09" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="hairDark-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${hairColor}"/>
      <stop offset="100%" stop-color="#0E0B09"/>
    </linearGradient>
    <linearGradient id="outfit3d-${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="${outfitColor}"/>
      <stop offset="100%" stop-color="#1E1B18" stop-opacity="0.32"/>
    </linearGradient>
    <filter id="drop3d-${uid}" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="5" stdDeviation="4.5" flood-color="#1E1B18" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g clip-path="url(#avatarClip-${uid})">
    <rect width="240" height="240" fill="${bgColor}"/>
    <rect width="240" height="240" fill="url(#bg3d-${uid})"/>
    ${bgMarkup}
    <g filter="url(#drop3d-${uid})">
      ${backHair}
      <path d="M42 240 C44 188 76 172 120 172 C164 172 196 188 198 240 Z" fill="${outfitColor}"/>
      <path d="M42 240 C44 188 76 172 120 172 C164 172 196 188 198 240 Z" fill="url(#outfit3d-${uid})"/>
      ${outfitExtra}
      <rect x="104" y="150" width="32" height="34" rx="14" fill="url(#neck3d-${uid})"/>
      <!-- 3D Sculpted Ears -->
      <circle cx="69" cy="115" r="11.5" fill="${skinShadow}"/>
      <circle cx="69" cy="115" r="6" fill="${skinDeepShadow}" fill-opacity="0.45"/>
      <circle cx="171" cy="115" r="11.5" fill="${skinShadow}"/>
      <circle cx="171" cy="115" r="6" fill="${skinDeepShadow}" fill-opacity="0.45"/>
      ${facePath}
      <!-- 3D Subsurface Warm Cheek Glow -->
      <ellipse cx="85" cy="127" rx="10.5" ry="5.8" fill="${cheekColor}" fill-opacity="0.32"/>
      <ellipse cx="155" cy="127" rx="10.5" ry="5.8" fill="${cheekColor}" fill-opacity="0.32"/>
      <!-- 3D Sculpted Nose Bridge & Highlight -->
      <path d="M120 108 L117 123 Q120 127 124 123" stroke="${skinDeepShadow}" stroke-opacity="0.45" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <ellipse cx="120" cy="124" rx="6.2" ry="4.2" fill="${skinShadow}" fill-opacity="0.55"/>
      <ellipse cx="118.5" cy="122.5" rx="2.6" ry="1.5" fill="#FFFFFF" fill-opacity="0.52"/>
      <!-- Forehead 3D Specular Rim -->
      <ellipse cx="106" cy="80" rx="16" ry="6.5" fill="#FFFFFF" fill-opacity="0.24"/>
      ${eyesMarkup}
      ${browsMarkup}
      ${mouthMarkup}
      ${frontHair}
      ${accessoryMarkup}
    </g>
  </g>
</svg>`;
}

export function avatarSvgToDataUrl(config: AvatarConfig): string {
  const svg = renderAvatarSvg(config, 240);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
