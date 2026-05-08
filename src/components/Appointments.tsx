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
  Filter
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
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface AppointmentsProps {
  userId: string;
}

export default function Appointments({ userId }: AppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'telehealth' | 'in-person'>('telehealth');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const appointmentDate = new Date(`${date}T${time}`);
      const appointmentRef = await addDoc(collection(db, 'appointments'), {
        patientId: userId,
        doctorId: 'doc-123', // Mock doctor ID for now
        doctorName,
        date: appointmentDate,
        type,
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
    setDate('');
    setTime('');
    setType('telehealth');
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
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search appointments..." 
                className="bg-transparent border-none outline-none text-sm w-full font-medium"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs">
              <Filter size={16} />
              Filter
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <CalendarIcon size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No appointments found</h3>
                <p className="text-slate-500 text-sm">Schedule your first consultation to get started.</p>
              </div>
            ) : (
              appointments.map((apt) => (
                <motion.div 
                  key={apt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      apt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {apt.type === 'telehealth' ? <Video size={28} /> : <MapPin size={28} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{apt.doctorName}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-500 font-medium capitalize">{apt.type} • {apt.status}</p>
                        {apt.reminderEnabled && (
                          <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                            <Clock size={10} />
                            Reminder Set
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Clock size={16} className="text-slate-400" />
                      {new Date(apt.date).toLocaleDateString()} at {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedAppointment(apt)}
                        className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1"
                      >
                        View Details
                        <ChevronRight size={14} />
                      </button>
                      {apt.status === 'scheduled' && (
                        <div className="flex items-center gap-4">
                          {apt.type === 'telehealth' && (
                            <button 
                              onClick={() => window.open(`/telehealth/${apt.id}`)}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                            >
                              Join Call
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setAppointmentToCancel(apt);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-red-500 font-bold text-xs hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Appointment Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                    <CalendarIcon size={20} />
                  </div>
                  <span className="font-bold text-slate-900">Total</span>
                </div>
                <span className="text-2xl font-black text-blue-600">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="font-bold text-slate-900">Completed</span>
                </div>
                <span className="text-2xl font-black text-emerald-600">
                  {appointments.filter(a => a.status === 'completed').length}
                </span>
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Doctor Name</label>
                  <input 
                    required
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Miller"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Appointment Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setType('telehealth')}
                      className={`py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border-2 ${
                        type === 'telehealth' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-400'
                      }`}
                    >
                      <Video size={18} />
                      Telehealth
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('in-person')}
                      className={`py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border-2 ${
                        type === 'in-person' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-400'
                      }`}
                    >
                      <MapPin size={18} />
                      In-Person
                    </button>
                  </div>
                </div>

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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest">
                    <CalendarIcon size={14} />
                    Consultation Details
                  </div>
                  <h3 className="text-3xl font-black text-slate-900">{selectedAppointment.doctorName}</h3>
                </div>
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                  <span className="font-bold text-slate-900">{new Date(selectedAppointment.date).toLocaleDateString()}</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</span>
                  <span className="font-bold text-slate-900">{new Date(selectedAppointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                  <span className="font-bold text-slate-900 capitalize">{selectedAppointment.type}</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                  <span className={`font-bold capitalize ${selectedAppointment.status === 'scheduled' ? 'text-blue-600' : 'text-slate-500'}`}>
                    {selectedAppointment.status}
                  </span>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div className="space-y-2 px-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Notes</p>
                  <p className="text-slate-600 font-medium leading-relaxed bg-blue-50/30 p-6 rounded-3xl border border-blue-100/30">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {selectedAppointment.status === 'scheduled' && selectedAppointment.type === 'telehealth' && (
                  <button 
                    onClick={() => window.open(`/telehealth/${selectedAppointment.id}`)}
                    className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    Join Virtual Room
                  </button>
                )}
                <button 
                  onClick={() => setSelectedAppointment(null)}
                   className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
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
