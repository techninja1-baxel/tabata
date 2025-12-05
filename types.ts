
export enum PlanFocus {
  // Performance
  STRENGTH = 'Strength & Hypertrophy',
  ENDURANCE = 'Cardiovascular Endurance',
  MOBILITY = 'Mobility & Flexibility',
  WEIGHT_LOSS = 'Weight Loss',
  HIIT = 'HIIT',
  
  // Rehab Specifics
  REHAB_LBP = 'Rehab: Lower Back',
  REHAB_SHOULDER = 'Rehab: Shoulder',
  REHAB_KNEE = 'Rehab: Knee',
  REHAB_HIP = 'Rehab: Hip',
  REHAB_ANKLE = 'Rehab: Ankle & Foot',
  REHAB_ELBOW = 'Rehab: Elbow & Wrist',
  REHAB_NECK = 'Rehab: Neck & Cervical',
  REHAB_POSTURE = 'Rehab: Posture Correction',
  REHAB_CORE = 'Rehab: Core Stability'
}

export enum WorkoutType {
  WARMUP = 'Warm Up',
  MAIN = 'Main Workout',
  COOLDOWN = 'Cool Down'
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  remarks?: string;
  type: WorkoutType;
}

export interface PlanSession {
  id: string;
  dayLabel: string; // e.g. "Day 1" or "Monday"
  targetFocus: string; // e.g. "Legs & Core"
  exercises: WorkoutExercise[]; // Structured list of exercises
  completed?: boolean; // New field to track if this specific session is done
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  focus: string[];
  duration: string;
  sessions: PlanSession[];
  title: string;
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface ClientSession {
  id: string;
  date: string; // ISO Date
  status: SessionStatus;
  notes?: string;
}

// New Interface for Upcoming Schedules
export interface ScheduledSession {
  id: string;
  datetime: string; 
  clientId: string;
  status: SessionStatus;
  planId?: string; 
  planSessionId?: string; 
  title: string; 
  exercises?: WorkoutExercise[]; 
  targetFocus?: string;
}

export interface NoteEntry {
  id: string;
  date: string;
  content: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  sessionsTotal: number;
  sessionsUsed: number;
  notes: string; // General/Medical Context notes
  progressNotes: NoteEntry[]; // Timestamped progress log
  plans: TrainingPlan[];
  history: ClientSession[];
  schedule: ScheduledSession[]; // List of upcoming/planned sessions
  joinedAt: string;
  
  // Biometrics & Lifestyle
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  bodyType?: string;
  activityLevel?: string;
  sleepDuration?: string;
  dietType?: string;
  trainingDays?: string; // Number of days they plan to train per week
}

export interface UserProfile {
  name: string;
  email: string;
  photoUrl?: string;
  isSubscribed: boolean;
  promoCode?: string;
}

export interface AppState {
  clients: Client[];
  user: UserProfile | null;
}