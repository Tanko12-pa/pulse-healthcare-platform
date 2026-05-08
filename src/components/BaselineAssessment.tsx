import React, { useState } from 'react';
import { 
  ClipboardList, 
  Activity, 
  FlaskConical, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Save,
  Sparkles,
  Heart,
  FileText,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface BaselineAssessmentProps {
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function BaselineAssessment({ userId, onComplete, onClose }: BaselineAssessmentProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Medical History
  const [medicalHistory, setMedicalHistory] = useState({
    title: 'Baseline Medical Assessment',
    type: 'diagnosis' as const,
    description: '',
    date: new Date().toISOString().split('T')[0],
    diagnosisStatus: 'Active' as const,
  });

  // Step 2: Wellness Metrics
  const [wellness, setWellness] = useState({
    steps: '8000',
    heartRate: '72',
    sleepHours: '7.5',
    weight: '165',
    date: new Date().toISOString().split('T')[0],
  });

  // Step 3: Lab Results
  const [labResult, setLabResult] = useState({
    testName: 'General Health Panel',
    category: 'Biochemistry',
    value: '95',
    unit: 'mg/dL',
    referenceRange: '70 - 100',
    status: 'verified-ok' as const,
    labName: 'Pulse Diagnostic Center',
    verifiedBy: 'Dr. AI Assistant',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Save Medical Record
      await addDoc(collection(db, 'records'), {
        ...medicalHistory,
        patientId: userId,
        createdAt: serverTimestamp(),
      });

      // 2. Save Wellness Metric
      await addDoc(collection(db, 'wellness'), {
        patientId: userId,
        date: wellness.date,
        steps: parseInt(wellness.steps),
        heartRate: parseInt(wellness.heartRate),
        sleepHours: parseFloat(wellness.sleepHours),
        weight: parseFloat(wellness.weight),
        createdAt: serverTimestamp(),
      });

      // 3. Save Lab Result
      await addDoc(collection(db, 'lab_results'), {
        ...labResult,
        patientId: userId,
        isVerified: true,
        createdAt: serverTimestamp(),
      });

      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'baseline_assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const generateSampleData = () => {
    setMedicalHistory({
      title: 'Initial Health Baseline',
      type: 'diagnosis',
      description: 'Patient reports general fatigue and occasional joint pain. History of mild hypertension managed by lifestyle. No known allergies. Seeking preventative health optimization.',
      date: new Date().toISOString().split('T')[0],
      diagnosisStatus: 'Active',
    });
    setWellness({
      steps: '10250',
      heartRate: '68',
      sleepHours: '7.2',
      weight: '172.5',
      date: new Date().toISOString().split('T')[0],
    });
    setLabResult({
      testName: 'Comprehensive Metabolic Panel',
      category: 'Biochemistry',
      value: '92',
      unit: 'mg/dL',
      referenceRange: '70 - 99',
      status: 'verified-ok',
      labName: 'Pulse Clinical Labs',
      verifiedBy: 'Dr. Sarah Chen',
      date: new Date().toISOString().split('T')[0],
    });
    setStep(3); // Move to final step to review
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">Baseline Assessment</h3>
              <p className="text-sm text-slate-500 font-medium">Step {step} of 3: {
                step === 1 ? 'Medical History' : 
                step === 2 ? 'Wellness Metrics' : 
                'Recent Lab Results'
              }</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={generateSampleData}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
            >
              <Sparkles size={14} />
              Sample Data
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100">
          <motion.div 
            className="h-full bg-blue-600"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4 mb-8">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Sparkles size={20} />
                  </div>
                  <p className="text-sm text-blue-800 font-medium leading-relaxed">
                    Start by providing a brief overview of your current health status. This helps our AI establish a clinical baseline for your personalized care plan.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Assessment Title</label>
                    <input 
                      type="text" 
                      value={medicalHistory.title}
                      onChange={(e) => setMedicalHistory({...medicalHistory, title: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Current Health Summary</label>
                    <textarea 
                      rows={4}
                      placeholder="Describe any current symptoms, chronic conditions, or general health concerns..."
                      value={medicalHistory.description}
                      onChange={(e) => setMedicalHistory({...medicalHistory, description: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Daily Steps (Average)</label>
                    <div className="relative">
                      <Activity className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="number" 
                        value={wellness.steps}
                        onChange={(e) => setWellness({...wellness, steps: e.target.value})}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Resting Heart Rate</label>
                    <div className="relative">
                      <Heart className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="number" 
                        value={wellness.heartRate}
                        onChange={(e) => setWellness({...wellness, heartRate: e.target.value})}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Avg. Sleep (Hours)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={wellness.sleepHours}
                      onChange={(e) => setWellness({...wellness, sleepHours: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Current Weight (lbs)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={wellness.weight}
                      onChange={(e) => setWellness({...wellness, weight: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Recent Lab Test Name</label>
                    <input 
                      type="text" 
                      value={labResult.testName}
                      onChange={(e) => setLabResult({...labResult, testName: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Result Value</label>
                      <input 
                        type="text" 
                        value={labResult.value}
                        onChange={(e) => setLabResult({...labResult, value: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Unit</label>
                      <input 
                        type="text" 
                        value={labResult.unit}
                        onChange={(e) => setLabResult({...labResult, unit: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
          <button 
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-900 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          {step < 3 ? (
            <button 
              onClick={nextStep}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Next Step
              <ChevronRight size={20} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Complete Assessment'}
              <CheckCircle2 size={20} />
            </button>
          ) }
        </div>
      </motion.div>
    </div>
  );
}

function XIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
