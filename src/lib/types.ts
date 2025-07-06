
export interface Material {
  id: string;
  classId: string;
  courseId: string;
  name: string;
  type: 'pdf' | 'video' | 'image' | 'other';
  size: string;
  uploadDate: string; // ISO string
  url: string;
}

export interface Course {
    id: string;
    courseId: string;
    name: string;
    description: string;
    program: string;
    branch: string;
    semester: number;
    credits: number;
}

export interface Placement {
  id: string;
  type: 'placement';
  company: string;
  role: string;
  ctc_stipend: string;
  location: string;
  description: string;
  skills: string[];
  eligibility: string;
  status: 'Open' | 'Closed';
  postedAt: string;
}

export interface Internship {
  id: string;
  type: 'internship';
  company: string;
  role: string;
  ctc_stipend: string;
  duration: string;
  description: string;
  skills: string[];
  eligibility: string;
  status: 'Open' | 'Closed';
  postedAt: string;
}

export interface Class {
  id: string;
  program: string;
  branch: string;
  year: number;
  semester: number;
  section: string;
  courseId: string;
  courseName: string;
  credits: number;
  teacherId: string;
  teacherName: string;
  studentCount: number;
}

export interface Student {
  id: string; 
  collegeId: string | null; 
  name: string | null;
  program: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  section: string | null;
  batch: string | null;
  status: string | null;
  type: string | null; 
  gender: 'Male' | 'Female' | 'Other' | null;
  avatarUrl?: string | null;
  initials?: string | null;
  email?: string | null;
  uid?: string | null; 
  staffId?: null; // Always null for students
  emergencyContact?: {
    name: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  dob?: string | null;
  phone?: string | null;
  address?: string | null;
  hostelId?: string | null;
  role?: 'student';
};

export interface Teacher {
    id: string; // The stable, internal Firestore document ID for the teacher's profile
    uid: string | null; // The Firebase Auth UID
    staffId: string | null; // The human-readable Staff ID
    name: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    initials?: string | null;
    status: string | null;
    dob?: string | null;
    program: string | null; // Program association
    department?: string | null;
    position?: string | null;
    designation?: string | null;
    role?: 'teacher' | 'admin' | null;
    joinDate?: string | null;
    qualifications?: string | null;
    specialization?: string | null;
    officeLocation?: string | null;
    phone?: string | null;
    // Fields that do not apply to teachers
    collegeId?: null;
    branch?: null;
    year?: null;
    semester?: null;
    batch?: null;
    section?: null;
    type?: null;
    emergencyContact?: null;
};

// --- Hostel Types ---

export interface StudentStub {
    studentId: string;
    studentName: string;
}

export interface Complaint {
    id: string;
    roomNumber: string;
    issue: string;
    studentId: string;
    studentName?: string;
    date: string;
    status: 'Pending' | 'In Progress' | 'Resolved';
}

export interface Room {
    roomNumber: string;
    capacity: number;
    residents: StudentStub[];
}

export interface Warden {
    name: string;
    contact: string;
    email: string;
    office: string;
}

export interface HostelDetails {
    id: string;
    name: string;
    type: 'Boys' | 'Girls';
    capacity: number;
    occupied: number;
    status: 'Operational' | 'Under Maintenance' | 'Closed';
    warden: Warden;
    amenities: string[];
    rulesHighlight: string[];
    rooms: Room[];
    complaints: Complaint[];
}

export interface Hostel {
  id: string;
  name: string;
  type: string;
  warden: Warden;
  status: 'Operational' | 'Under Maintenance' | 'Closed';
  capacity: number;
  occupied: number;
};

// --- Chat Types ---
export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  participantUids: string[];
  classId: string;
}

// --- Exam Types ---
export type ExamStatus = 'Scheduled' | 'Cancelled';

export type ExamSchedule = {
  id: string;
  program: string;
  branch: string;
  year: number;
  semester: number;
  courseCode: string;
  courseName: string;
  examSessionName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: ExamStatus;
  credits: number | null;
};

export interface HallTicketExam {
  id: string; 
  program: string;
  branch: string;
  year: number;
  semester: number;
  courseCode: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ExamStatus; 
  credits: number | null;
}

export interface HallTicketData {
    studentId: string;
    studentName: string;
    studentPhotoUrl?: string;
    studentCollegeId: string;
    program: string;
    branch: string;
    year: number;
    semester: number; 
    examSessionName: string;
    exams: HallTicketExam[];
    eligibility: {
      minAttendance: number;
      maxDues: number;
    },
    instructions: string;
    controllerSignaturePlaceholder: string;
    generatedDate: string;
}
