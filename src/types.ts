export type UserRole = 'patient' | 'doctor' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: any;
  trialStartDate?: any;
  subscriptionStatus?: 'trialing' | 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid' | 'expired' | 'none';
  planType?: 'monthly' | 'yearly';
  isPremium?: boolean;
  stripeCustomerId?: string;
  lastPaymentDate?: any;
  updatedAt?: any;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: any;
  type: 'telehealth' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  reminderEnabled?: boolean;
  reminderTime?: number;
}

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  type: 'email' | 'push' | 'sms';
  scheduledTime: any;
  status: 'pending' | 'sent' | 'failed';
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  type: 'diagnosis' | 'lab-result' | 'immunization' | 'surgery';
  title: string;
  description: string;
  date: string;
  diagnosisStatus?: 'Active' | 'Resolved' | 'Chronic';
  attachments?: string[];
}

export interface Prescription {
  id: string;
  patientId: string;
  medication: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'discontinued';
  refillsRemaining?: number;
  lastRefillDate?: string;
  notes?: string;
}

export interface MedicationRefill {
  id: string;
  prescriptionId: string;
  patientId: string;
  requestDate: any;
  status: 'pending' | 'approved' | 'denied' | 'ready';
  notes?: string;
}

export interface WellnessMetric {
  id: string;
  patientId: string;
  date: string;
  steps?: number;
  heartRate?: number;
  sleepHours?: number;
  weight?: number;
}

export interface Facility {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  phone: string;
  email?: string;
  logoURL?: string;
  hours?: string;
  services?: string[];
}

export interface ClinicalStaff {
  id: string;
  name: string;
  role: 'physician' | 'pharmacist' | 'nurse';
  specialty?: string;
  email: string;
  phone?: string;
  photoURL?: string;
  availability?: string;
  bio?: string;
}

export interface PatientFile {
  id: string;
  patientId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: any;
}

export interface LabResult {
  id: string;
  patientId: string;
  testName: string;
  category: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'pending' | 'flag-risk' | 'verified-ok';
  labName: string;
  verifiedBy: string;
  date: string;
  isVerified: boolean;
}

export interface ClinicalInsight {
  id: string;
  patientId: string;
  type: 'triage' | 'risk-assessment' | 'wellness-plan';
  summary: string;
  details: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'urgent';
  recommendations: string[];
  generatedAt: any;
  isDeepAnalysis?: boolean;
}

export interface ClinicProfile {
  id: string;
  patientId: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail?: string;
  preferredPharmacist?: string;
  updatedAt: any;
}
