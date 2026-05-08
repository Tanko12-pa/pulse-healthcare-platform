import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Download,
  X,
  Building2,
  Phone,
  MapPin,
  Mail,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prescription, MedicationRefill, ClinicProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface PrescriptionsProps {
  userId: string;
}

export default function Prescriptions({ userId }: PrescriptionsProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [refills, setRefills] = useState<MedicationRefill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestingRefill, setRequestingRefill] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('all');

  // Form State
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refillsRemaining, setRefillsRemaining] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');

  // Clinic Profile State
  const [clinicProfile, setClinicProfile] = useState<ClinicProfile | null>(null);
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [clinicFormData, setClinicFormData] = useState({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    clinicEmail: '',
    preferredPharmacist: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'prescriptions'),
      where('patientId', '==', userId),
      orderBy('startDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prescs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Prescription));
      setPrescriptions(prescs);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'prescriptions'));

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const q = query(
      collection(db, 'refills'),
      where('patientId', '==', userId),
      orderBy('requestDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const refillData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MedicationRefill));
      setRefills(refillData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'refills'));

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const fetchClinicProfile = async () => {
      try {
        const docRef = doc(db, 'clinicProfiles', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ClinicProfile;
          setClinicProfile(data);
          setClinicFormData({
            clinicName: data.clinicName,
            clinicAddress: data.clinicAddress,
            clinicPhone: data.clinicPhone,
            clinicEmail: data.clinicEmail || '',
            preferredPharmacist: data.preferredPharmacist || ''
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'clinicProfiles');
      }
    };

    fetchClinicProfile();
  }, [userId]);

  const handleRefillRequest = async (prescriptionId: string) => {
    setRequestingRefill(prescriptionId);
    try {
      await addDoc(collection(db, 'refills'), {
        prescriptionId,
        patientId: userId,
        requestDate: serverTimestamp(),
        status: 'pending',
        notes: 'Refill requested via patient portal',
        createdAt: serverTimestamp()
      });
      // Optional: Show success toast
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'refills');
    } finally {
      setRequestingRefill(null);
    }
  };

  const getRefillStatus = (prescriptionId: string) => {
    return refills.find(r => r.prescriptionId === prescriptionId && r.status === 'pending');
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'prescriptions'), {
        patientId: userId,
        medication,
        dosage,
        frequency,
        startDate,
        endDate: endDate || null,
        status: 'active',
        refillsRemaining: Number(refillsRemaining),
        notes,
        createdAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'prescriptions');
    }
  };

  const handleUpdateNotes = async () => {
    if (!selectedPrescription) return;
    try {
      const prescRef = doc(db, 'prescriptions', selectedPrescription.id);
      await updateDoc(prescRef, {
        notes: editingNotes
      });
      setIsNotesModalOpen(false);
      setSelectedPrescription(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'prescriptions');
    }
  };

  const handleSaveClinicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...clinicFormData,
        patientId: userId,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'clinicProfiles', userId), data);
      setClinicProfile({ id: userId, ...data } as ClinicProfile);
      setIsClinicModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clinicProfiles');
    }
  };

  const resetForm = () => {
    setMedication('');
    setDosage('');
    setFrequency('');
    setStartDate('');
    setEndDate('');
    setRefillsRemaining(0);
    setNotes('');
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    const matchesSearch = p.medication.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    const headers = ['Medication', 'Dosage', 'Frequency', 'Start Date', 'End Date', 'Status', 'Refills Remaining'];
    const csvContent = [
      headers.join(','),
      ...filteredPrescriptions.map(p => [
        p.medication,
        p.dosage,
        p.frequency,
        p.startDate,
        p.endDate || 'N/A',
        p.status,
        p.refillsRemaining
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `prescriptions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Prescriptions</h2>
          <p className="text-slate-500 font-medium">Manage your medications, dosages, and refill schedules.</p>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus size={20} />
          Add Prescription
        </button>
      </header>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by medication name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-transparent border-none outline-none text-xs font-bold text-slate-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs"
          >
            <Download size={16} />
            Export List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Pill size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No prescriptions found</h3>
            <p className="text-slate-500 text-sm">
              {searchQuery ? "No medications match your search." : "Your active medications will appear here once added."}
            </p>
          </div>
        ) : (
          filteredPrescriptions.map((presc, idx) => (
            <motion.div 
              key={presc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all"
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  presc.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  <Pill size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-900">{presc.medication}</h4>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      presc.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {presc.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{presc.dosage} • {presc.frequency}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <Calendar size={12} />
                      Started: {presc.startDate}
                    </div>
                    {presc.endDate && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        <Clock size={12} />
                        Ends: {presc.endDate}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getRefillStatus(presc.id) ? (
                  <span className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-bold text-xs flex items-center gap-2">
                    <Clock size={14} />
                    Refill Pending
                  </span>
                ) : (
                  <button 
                    onClick={() => handleRefillRequest(presc.id)}
                    disabled={requestingRefill === presc.id}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    {requestingRefill === presc.id ? 'Requesting...' : 'Refill Now'}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedPrescription(presc);
                    setIsHistoryModalOpen(true);
                  }}
                  className="p-3 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Prescription History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedPrescription && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{selectedPrescription.medication}</h3>
                  <p className="text-sm text-slate-500 font-medium">Medication History & Details</p>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-3xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Dosage</p>
                    <p className="text-lg font-bold text-slate-900">{selectedPrescription.dosage}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Frequency</p>
                    <p className="text-lg font-bold text-slate-900">{selectedPrescription.frequency}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-slate-900">Clinical Notes</h4>
                    <button 
                      onClick={() => {
                        setEditingNotes(selectedPrescription.notes || '');
                        setIsNotesModalOpen(true);
                      }}
                      className="text-blue-600 font-bold text-sm hover:underline"
                    >
                      Edit Notes
                    </button>
                  </div>
                  <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {selectedPrescription.notes || "No notes added for this prescription."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-slate-900">Refill History</h4>
                  <div className="space-y-3">
                    {refills.filter(r => r.prescriptionId === selectedPrescription.id).length === 0 ? (
                      <p className="text-slate-400 text-sm font-medium italic">No refill history available.</p>
                    ) : (
                      refills.filter(r => r.prescriptionId === selectedPrescription.id).map((refill) => (
                        <div key={refill.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              refill.status === 'ready' ? 'bg-emerald-100 text-emerald-600' : 
                              refill.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Refill Request</p>
                              <p className="text-xs text-slate-500 font-medium">
                                {refill.requestDate?.toDate ? refill.requestDate.toDate().toLocaleDateString() : 'Date pending'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                            refill.status === 'ready' ? 'bg-emerald-50 text-emerald-600' : 
                            refill.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {refill.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Notes Modal */}
      <AnimatePresence>
        {isNotesModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotesModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Edit Prescription Notes</h3>
              <textarea 
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Add clinical notes, side effects, or instructions..."
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all min-h-[200px] resize-none mb-6"
              />
              <div className="flex gap-3">
                <button 
                  onClick={handleUpdateNotes}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Save Notes
                </button>
                <button 
                  onClick={() => setIsNotesModalOpen(false)}
                  className="px-6 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Clinic Profile</h3>
                <p className="text-sm text-slate-500 font-medium">Your preferred pharmacy/clinic</p>
              </div>
            </div>
            <button 
              onClick={() => setIsClinicModalOpen(true)}
              className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all"
            >
              {clinicProfile ? 'Edit Profile' : 'Setup Profile'}
            </button>
          </div>

          {clinicProfile ? (
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-slate-600 font-medium">
                  <Building2 size={16} className="text-slate-400" />
                  <span className="text-sm">{clinicProfile.clinicName}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 font-medium">
                  <Phone size={16} className="text-slate-400" />
                  <span className="text-sm">{clinicProfile.clinicPhone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 font-medium col-span-full">
                  <MapPin size={16} className="text-slate-400" />
                  <span className="text-sm">{clinicProfile.clinicAddress}</span>
                </div>
                {clinicProfile.clinicEmail && (
                  <div className="flex items-center gap-3 text-slate-600 font-medium">
                    <Mail size={16} className="text-slate-400" />
                    <span className="text-sm">{clinicProfile.clinicEmail}</span>
                  </div>
                )}
                {clinicProfile.preferredPharmacist && (
                  <div className="flex items-center gap-3 text-slate-600 font-medium">
                    <User size={16} className="text-slate-400" />
                    <span className="text-sm">Pharmacist: {clinicProfile.preferredPharmacist}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm font-medium italic">No clinic profile setup yet.</p>
            </div>
          )}
        </div>

        <div className="bg-amber-50 rounded-[40px] p-8 border border-amber-100 flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-500 shadow-sm">
            <AlertCircle size={32} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-amber-900 mb-1">Medication Reminder</h4>
            <p className="text-amber-700/80 text-sm font-medium leading-relaxed">
              {refills.filter(r => r.status === 'pending').length > 0 
                ? `You have ${refills.filter(r => r.status === 'pending').length} pending refill requests. We'll notify you once they are approved.`
                : "You have 2 medications due for refill in the next 7 days. Please contact your pharmacy or request a refill through the platform."}
            </p>
          </div>
        </div>
      </div>

      {/* Clinic Profile Modal */}
      <AnimatePresence>
        {isClinicModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClinicModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Clinic Profile</h3>
                <button 
                  onClick={() => setIsClinicModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveClinicProfile} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pharmacy/Clinic Name</label>
                  <input 
                    required
                    type="text"
                    value={clinicFormData.clinicName}
                    onChange={(e) => setClinicFormData({...clinicFormData, clinicName: e.target.value})}
                    placeholder="e.g. CVS Pharmacy #1234"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Address</label>
                  <input 
                    required
                    type="text"
                    value={clinicFormData.clinicAddress}
                    onChange={(e) => setClinicFormData({...clinicFormData, clinicAddress: e.target.value})}
                    placeholder="123 Pharma Way, Medical City"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                    <input 
                      required
                      type="text"
                      value={clinicFormData.clinicPhone}
                      onChange={(e) => setClinicFormData({...clinicFormData, clinicPhone: e.target.value})}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email (Optional)</label>
                    <input 
                      type="email"
                      value={clinicFormData.clinicEmail}
                      onChange={(e) => setClinicFormData({...clinicFormData, clinicEmail: e.target.value})}
                      placeholder="pharmacy@example.com"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preferred Pharmacist (Optional)</label>
                  <input 
                    type="text"
                    value={clinicFormData.preferredPharmacist}
                    onChange={(e) => setClinicFormData({...clinicFormData, preferredPharmacist: e.target.value})}
                    placeholder="e.g. Dr. Jane Smith"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 mt-4"
                >
                  Save Clinic Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Prescription Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Add New Prescription</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddPrescription} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medication Name</label>
                  <input 
                    required
                    type="text"
                    value={medication}
                    onChange={(e) => setMedication(e.target.value)}
                    placeholder="e.g. Lisinopril"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dosage</label>
                    <input 
                      required
                      type="text"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="e.g. 10mg"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Frequency</label>
                    <input 
                      required
                      type="text"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      placeholder="e.g. Once daily"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input 
                      required
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">End Date (Optional)</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Refills Remaining</label>
                  <input 
                    type="number"
                    value={refillsRemaining}
                    onChange={(e) => setRefillsRemaining(Number(e.target.value))}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any specific instructions or notes..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all min-h-[100px] resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 mt-4"
                >
                  Add Medication
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
