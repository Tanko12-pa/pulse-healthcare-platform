import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Heart, 
  Moon, 
  Weight, 
  TrendingUp, 
  Calendar, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  FileText,
  Plus,
  ChevronRight,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Appointment, WellnessMetric, MedicalRecord } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { calculateWellnessScore, getWellnessMessage } from '../lib/wellnessUtils';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [metrics, setMetrics] = useState<WellnessMetric[]>([]);
  const [recentRecords, setRecentRecords] = useState<MedicalRecord[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Fetch next 2 upcoming appointments
    const aptQuery = query(
      collection(db, 'appointments'),
      where('patientId', '==', user.uid),
      where('status', '==', 'scheduled'),
      orderBy('date', 'asc'),
      limit(2)
    );

    const unsubscribeApts = onSnapshot(aptQuery, (snapshot) => {
      const apts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      } as Appointment));
      setAppointments(apts);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'appointments'));

    // Fetch latest wellness metrics
    const wellnessQuery = query(
      collection(db, 'wellness'),
      where('patientId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeWellness = onSnapshot(wellnessQuery, (snapshot) => {
      const mets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WellnessMetric));
      setMetrics(mets);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'wellness'));

    // Fetch 3 most recent medical records
    const recordsQuery = query(
      collection(db, 'records'),
      where('patientId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(3)
    );

    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
      const recs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MedicalRecord));
      setRecentRecords(recs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'records'));

    return () => {
      unsubscribeApts();
      unsubscribeWellness();
      unsubscribeRecords();
    };
  }, [user]);

  const latestMetric = metrics[0] || null;

  const stats = [
    { label: 'Steps', value: latestMetric?.steps?.toLocaleString() || '0', unit: 'steps', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Heart Rate', value: latestMetric?.heartRate?.toString() || '--', unit: 'bpm', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Sleep', value: latestMetric?.sleepHours?.toString() || '--', unit: 'hours', icon: Moon, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Weight', value: latestMetric?.weight?.toString() || '--', unit: 'lbs', icon: Weight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            <ShieldCheck size={14} />
            Pulse Health Platform
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, <span className="text-slate-400">User</span>
          </h2>
          <p className="text-slate-500 font-medium">
            Your health metrics are looking stable today. You have {appointments.length} upcoming appointment{appointments.length !== 1 ? 's' : ''}.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => onNavigate('records')}
            className="px-6 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus size={18} />
            Upload Record
          </button>
          <button 
            onClick={() => onNavigate('appointments')}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            Book Appointment
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs">
                  <TrendingUp size={14} />
                  +12%
                </div>
              </div>
              <p className="text-slate-500 font-semibold text-sm mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.unit}</span>
              </div>
            </motion.div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-900">Upcoming Appointments</h3>
              <button 
                onClick={() => onNavigate('appointments')}
                className="text-blue-600 font-bold text-sm hover:underline"
              >
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <div className="bg-white p-12 rounded-[40px] border border-slate-50 shadow-sm text-center">
                  <p className="text-slate-400 font-medium">No upcoming appointments scheduled.</p>
                </div>
              ) : (
                appointments.map((apt) => (
                  <div key={apt.id} className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <Calendar size={28} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{apt.doctorName}</h4>
                        <p className="text-sm text-slate-500 font-medium">Specialist</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <Clock size={16} className="text-slate-400" />
                        {new Date(apt.date).toLocaleDateString()}, {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                        apt.type === 'telehealth' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {apt.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-900">Recent Medical Records</h3>
              <button 
                onClick={() => onNavigate('records')}
                className="text-blue-600 font-bold text-sm hover:underline"
              >
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {recentRecords.length === 0 ? (
                <div className="bg-white p-12 rounded-[40px] border border-slate-50 shadow-sm text-center">
                  <p className="text-slate-400 font-medium">No medical records uploaded yet.</p>
                </div>
              ) : (
                recentRecords.map((record) => (
                  <div key={record.id} className="bg-white p-5 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{record.title}</h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{record.date}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onNavigate('records')}
                      className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 group-hover:text-blue-600"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-xl font-bold text-slate-900 px-2">System Status</h3>
          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
                <ShieldCheck size={14} />
                Production Ready
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Online
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <ShieldCheck size={16} />
                  </div>
                  <span className="font-bold text-slate-700 text-sm">Firebase Core</span>
                </div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Connected</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <Zap size={16} />
                  </div>
                  <span className="font-bold text-slate-700 text-sm">AI Engine</span>
                </div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-900 px-2">Health Insights</h3>
          <div className="bg-blue-600 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Activity size={120} />
            </div>
            <div className="relative z-10">
              <h4 className="text-2xl font-bold mb-4">Wellness Score</h4>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-6xl font-black">{calculateWellnessScore(metrics)}</span>
                <span className="text-blue-200 font-bold uppercase tracking-widest">/ 100</span>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed mb-8 font-medium">
                {getWellnessMessage(calculateWellnessScore(metrics))}
              </p>
              <button 
                onClick={() => onNavigate('wellness')}
                className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                Improve Your Score
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
