import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  MapPin, 
  Plus, 
  X, 
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  Users,
  Bell,
  CalendarCheck,
  History,
  Info,
  MapPinned
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, Doctor } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface AppointmentsProps {
  userId: string;
}

export default function Appointments({ userId }: AppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'telehealth' | 'in-person'>('telehealth');
  const [location, setLocation] = useState('Pulse Wellness Center - Main Branch');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState(60); // 60 minutes default

  useEffect(() => {
    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      } as Appointment));
      setAppointments(apts);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'appointments'));

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    // Fetch doctors
    const doctorsQuery = query(collection(db, 'doctors'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(doctorsQuery, (snapshot) => {
      setDoctors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'doctors'));

    return () => unsubscribe();
  }, []);

  // Seed doctors if none exist
  useEffect(() => {
    const seedDoctors = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'doctors'));
        if (snapshot.empty) {
          const seedData = [
            {
              name: 'Dr. Sarah Miller',
              specialty: 'Cardiology',
              email: 's.miller@pulse.com',
              photoURL: 'https://images.unsplash.com/photo-1559839734-2b71f153678f?auto=format&fit=crop&q=80&w=200&h=200',
              bio: 'Board-certified cardiologist with over 15 years of experience in cardiovascular health.',
              createdAt: serverTimestamp()
            },
            {
              name: 'Dr. James Wilson',
              specialty: 'Neurology',
              email: 'j.wilson@pulse.com',
              photoURL: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200&h=200',
              bio: 'Specialist in neurological disorders and cognitive health.',
              createdAt: serverTimestamp()
            },
            {
              name: 'Dr. Elena Rodriguez',
              specialty: 'Pediatrics',
              email: 'e.rodriguez@pulse.com',
              photoURL: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200&h=200',
              bio: 'Compassionate pediatrician dedicated to child development and preventive care.',
              createdAt: serverTimestamp()
            }
          ];
          
          for (const doctor of seedData) {
            await addDoc(collection(db, 'doctors'), doctor);
          }
        }
      } catch (error) {
        // Only report if it's not a permission error during initial load (if they aren't admin)
        console.warn('Doctor seeding skipped or failed:', error);
      }
    };
    seedDoctors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) return;

    try {
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      const appointmentDate = new Date(`${date}T${time}`);
      const appointmentRef = await addDoc(collection(db, 'appointments'), {
        patientId: userId,
        doctorId: selectedDoctorId,
        doctorName,
        doctorPhoto: selectedDoctor?.photoURL || '',
        doctorSpecialty: selectedDoctor?.specialty || '',
        date: appointmentDate,
        type,
        location: type === 'in-person' ? location : 'Virtual Consult',
        duration,
        status: 'scheduled',
        notes,
        reminderEnabled,
        reminderTime,
        createdAt: serverTimestamp()
      });

      if (reminderEnabled) {
        // Create a reminder document
        const scheduledTime = new Date(appointmentDate.getTime() - (reminderTime * 60 * 1000));
        await addDoc(collection(db, 'reminders'), {
          appointmentId: appointmentRef.id,
          patientId: userId,
          type: 'email', // Default to email for now
          scheduledTime,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments');
    }
  };

  const resetForm = () => {
    setDoctorName('');
    setSelectedDoctorId('');
    setDate('');
    setTime('');
    setType('telehealth');
    setLocation('Pulse Wellness Center - Main Branch');
    setDuration(30);
    setNotes('');
    setReminderEnabled(true);
    setReminderTime(60);
  };

  const handleCancel = async () => {
    if (!appointmentToCancel) return;
    try {
      const appointmentRef = doc(db, 'appointments', appointmentToCancel.id);
      await updateDoc(appointmentRef, {
        status: 'cancelled'
      });
      setIsCancelModalOpen(false);
      setAppointmentToCancel(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const isPast = new Date(apt.date) < new Date() && apt.status !== 'scheduled';
    const matchesSearch = apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          apt.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (apt.doctorSpecialty?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return (activeTab === 'upcoming' ? !isPast : isPast) && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Appointments</h2>
          <p className="text-slate-500 font-medium">Manage your upcoming and past medical consultations.</p>
        </div>
        
        <button 
          onClick={() => setIsFormOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus size={20} />
          Book New Appointment
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50 w-fit">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'upcoming' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CalendarCheck size={18} />
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'history' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <History size={18} />
                History
              </button>
            </div>

            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex-1 max-w-md">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Search by doctor or specialty..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full font-medium"
              />
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm animate-pulse flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-1/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  {activeTab === 'upcoming' ? <CalendarIcon size={40} /> : <History size={40} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {activeTab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  {activeTab === 'upcoming' 
                    ? 'Your scheduled visits will appear here.' 
                    : 'Your completed and cancelled appointments history.'}
                </p>
                {activeTab === 'upcoming' && (
                  <button 
                    onClick={() => setIsFormOpen(true)}
                    className="mt-6 px-6 py-2 border-2 border-blue-100 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
                  >
                    Schedule a visit
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAppointments.map((apt) => (
                  <motion.div 
                    key={apt.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex flex-col md:flex-row md:items-center justify-between group hover:border-blue-100 transition-all gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-sm transition-transform group-hover:scale-105">
                          {apt.doctorPhoto ? (
                            <img src={apt.doctorPhoto} alt={apt.doctorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Users size={24} />
                            </div>
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center shadow-lg border-2 border-white text-xs ${
                          apt.type === 'telehealth' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {apt.type === 'telehealth' ? <Video size={14} /> : <MapPin size={14} />}
                        </div>
                      </div>
                      
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{apt.doctorName}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <p className="text-[10px] text-blue-600 font-extrabold uppercase tracking-widest">{apt.doctorSpecialty || 'Physician'}</p>
                          <span className="text-slate-300 hidden md:inline">•</span>
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            apt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                            apt.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {apt.status}
                          </div>
                          {apt.reminderEnabled && apt.status === 'scheduled' && (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                              <Bell size={12} className="fill-emerald-100" />
                              <span className="hidden sm:inline">Reminding {apt.reminderTime}m before</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-3 md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-slate-50">
                      <div className="space-y-1">
                        <div className="flex items-center md:justify-end gap-2 text-slate-900 font-bold text-sm">
                          <Clock size={16} className="text-blue-500" />
                          {new Date(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          <span className="text-slate-300">at</span>
                          {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {apt.duration && (
                          <p className="text-xs text-slate-400 font-medium">Duration: {apt.duration} minutes</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedAppointment(apt)}
                          className="px-4 py-2 hover:bg-slate-50 rounded-xl text-slate-600 font-bold text-xs transition-all flex items-center gap-2"
                        >
                          Details
                          <ChevronRight size={14} />
                        </button>
                        
                        {apt.status === 'scheduled' && (
                          <div className="flex items-center gap-2">
                            {apt.type === 'telehealth' && (
                              <button 
                                onClick={() => window.open(`/telehealth/${apt.id}`)}
                                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center gap-2"
                              >
                                <Video size={14} />
                                Start
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setAppointmentToCancel(apt);
                                setIsCancelModalOpen(true);
                              }}
                              className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Cancel Appointment"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Summary</h3>
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <CalendarIcon size={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-slate-50 rounded-[32px] space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Upcoming</p>
                <div className="text-3xl font-black text-slate-900 text-center">
                  {appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).length}
                </div>
              </div>
              <div className="p-5 bg-slate-50 rounded-[32px] space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Completed</p>
                <div className="text-3xl font-black text-slate-900 text-center">
                  {appointments.filter(a => a.status === 'completed').length}
                </div>
              </div>
            </div>

            <div className="bg-blue-600 rounded-[32px] p-6 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Info size={100} />
              </div>
              <div className="relative z-10 space-y-4">
                <h4 className="font-bold text-lg">Next Visit</h4>
                {appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
                        {new Date(appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date).getDate()}
                      </div>
                      <div>
                        <p className="font-black text-sm">
                          {appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].doctorName}
                        </p>
                        <p className="text-[10px] font-bold text-blue-100">
                          {new Date(appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedAppointment(appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0])}
                      className="w-full py-2.5 bg-white text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
                    >
                      View Details
                    </button>
                  </div>
                ) : (
                  <p className="text-blue-100 text-sm font-medium">No upcoming visits scheduled.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Book Appointment</h3>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Doctor</label>
                  <div className="grid grid-cols-1 gap-3">
                    {doctors.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl text-slate-500 text-xs font-medium text-center">
                        No doctors available at this time.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {doctors.map((doctor) => (
                          <button
                            key={doctor.id}
                            type="button"
                            onClick={() => {
                              setSelectedDoctorId(doctor.id);
                              setDoctorName(doctor.name);
                            }}
                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                              selectedDoctorId === doctor.id 
                                ? 'bg-blue-50 border-blue-600' 
                                : 'bg-white border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                              {doctor.photoURL ? (
                                <img src={doctor.photoURL} alt={doctor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <Users size={20} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">{doctor.name}</p>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest truncate">
                                {doctor.specialty}
                              </p>
                            </div>
                            {selectedDoctorId === doctor.id && (
                              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                                <CheckCircle2 size={12} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</label>
                    <input 
                      required
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time</label>
                    <input 
                      required
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Duration (min)</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    >
                      <option value={15}>15 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setType('telehealth')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                          type === 'telehealth' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        <Video size={14} />
                        Tele
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('in-person')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                          type === 'in-person' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        <MapPin size={14} />
                        Live
                      </button>
                    </div>
                  </div>
                </div>

                {type === 'in-person' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location</label>
                    <input 
                      required
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Enter clinic address"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Briefly describe the reason for your visit..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all min-h-[100px] resize-none"
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">Appointment Reminder</h4>
                      <p className="text-xs text-slate-500 font-medium">Get notified before your visit</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReminderEnabled(!reminderEnabled)}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        reminderEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        reminderEnabled ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  {reminderEnabled && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Remind me</label>
                      <select
                        value={reminderTime}
                        onChange={(e) => setReminderTime(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-none rounded-xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all text-sm"
                      >
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                        <option value={1440}>1 day before</option>
                      </select>
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 mt-4"
                >
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                <X size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Cancel Appointment?</h3>
              <p className="text-slate-500 font-medium mb-8">
                Are you sure you want to cancel your appointment with <span className="text-slate-900 font-bold">{appointmentToCancel?.doctorName}</span>? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleCancel}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Yes, Cancel Appointment
                </button>
                <button 
                  onClick={() => setIsCancelModalOpen(false)}
                  className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Keep Appointment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Appointment Details</h3>
                    <p className="text-xs text-slate-500 font-medium">Session ID: {selectedAppointment.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-48 shrink-0 space-y-4">
                    <div className="aspect-square rounded-3xl overflow-hidden bg-slate-50 border-4 border-white shadow-xl">
                      {selectedAppointment.doctorPhoto ? (
                        <img 
                          src={selectedAppointment.doctorPhoto} 
                          alt={selectedAppointment.doctorName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <Users size={64} />
                        </div>
                      )}
                    </div>
                    <div className="text-center md:text-left">
                      <h4 className="text-lg font-black text-slate-900 leading-tight">{selectedAppointment.doctorName}</h4>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">
                        {selectedAppointment.doctorSpecialty || 'Specialist'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled For</p>
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <Clock size={16} className="text-blue-500" />
                          {new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          <span className="text-slate-300">@</span>
                          {new Date(selectedAppointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <Info size={16} className="text-blue-500" />
                          {selectedAppointment.duration || 30} Minutes
                        </div>
                      </div>
                      {selectedAppointment.type === 'in-person' && (
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-1 col-span-full">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <MapPinned size={16} className="text-blue-500" />
                            {selectedAppointment.location || 'Pulse Wellness Center'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appointment Notes</p>
                      <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 text-slate-700 text-sm font-medium leading-relaxed">
                        {selectedAppointment.notes || 'No notes provided for this consultation.'}
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${selectedAppointment.reminderEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Bell size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Reminders</p>
                          <p className="text-xs text-slate-500">
                            {selectedAppointment.reminderEnabled 
                              ? `Active: ${selectedAppointment.reminderTime}m before session` 
                              : 'Reminders are disabled for this session'}
                          </p>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedAppointment.reminderEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedAppointment.reminderEnabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 flex gap-4 shrink-0">
                {selectedAppointment.status === 'scheduled' && (
                  <>
                    {selectedAppointment.type === 'telehealth' && (
                      <button 
                        onClick={() => window.open(`/telehealth/${selectedAppointment.id}`)}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                      >
                        <Video size={18} />
                        Join Virtual Room
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setAppointmentToCancel(selectedAppointment);
                        setIsCancelModalOpen(true);
                      }}
                      className="px-6 py-4 border-2 border-red-100 text-red-500 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedAppointment(null)}
                   className="px-8 py-4 bg-slate-100 text-slate-600 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
