import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Plus, 
  FileCheck, 
  Activity, 
  Microscope, 
  Stethoscope,
  X,
  Upload,
  Calendar as CalendarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MedicalRecord } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface MedicalRecordsProps {
  userId: string;
  onNavigate?: (tab: string) => void;
}

const typeIcons = {
  diagnosis: Stethoscope,
  'lab-result': Microscope,
  immunization: FileCheck,
  surgery: Activity,
};

export default function MedicalRecords({ userId, onNavigate }: MedicalRecordsProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [filterType, setFilterType] = useState<MedicalRecord['type'] | 'all'>('all');
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'diagnosis' as MedicalRecord['type'],
    description: '',
    date: new Date().toISOString().split('T')[0],
    diagnosisStatus: 'Active' as MedicalRecord['diagnosisStatus'],
  });

  useEffect(() => {
    const q = query(
      collection(db, 'records'),
      where('patientId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MedicalRecord));
      setRecords(recs);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'records'));

    return () => unsubscribe();
  }, [userId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'records'), {
        ...formData,
        patientId: userId,
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setFormData({
        title: '',
        type: 'diagnosis',
        description: '',
        date: new Date().toISOString().split('T')[0],
        diagnosisStatus: 'Active',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'records');
    }
  };

  const handleExport = () => {
    const headers = ['Date', 'Title', 'Type', 'Status', 'Description'];
    const csvData = records.map(r => [
      r.date,
      r.title,
      r.type,
      r.diagnosisStatus || 'N/A',
      r.description.replace(/,/g, ';')
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `medical_records_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (record: MedicalRecord) => {
    const content = `Date: ${record.date}\nTitle: ${record.title}\nType: ${record.type}\nStatus: ${record.diagnosisStatus}\nDescription: ${record.description}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.title.replace(/\s+/g, '_')}_record.txt`;
    link.click();
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || r.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Medical Records</h2>
          <p className="text-slate-500 font-medium">Your complete medical history, securely stored and accessible.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate?.('labs')}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Microscope size={20} />
            Lab Registry
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus size={20} />
            Upload New Record
          </button>
        </div>
      </header>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by title, type, or description..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-transparent border-none outline-none text-xs font-bold text-slate-500 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="diagnosis">Diagnosis</option>
            <option value="lab-result">Lab Result</option>
            <option value="immunization">Immunization</option>
            <option value="surgery">Surgery</option>
          </select>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs"
          >
            <Download size={16} />
            Export All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <FileText size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No records found</h3>
            <p className="text-slate-500 text-sm">Your medical history will appear here once uploaded.</p>
          </div>
        ) : (
          filteredRecords.map((record, idx) => {
            const Icon = typeIcons[record.type as keyof typeof typeIcons] || FileText;
            return (
              <motion.div 
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <Icon size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900">{record.title}</h4>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-widest">
                        {record.type}
                      </span>
                      {record.diagnosisStatus && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                          record.diagnosisStatus === 'Active' ? 'bg-red-50 text-red-600' :
                          record.diagnosisStatus === 'Resolved' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {record.diagnosisStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{record.description}</p>
                    <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">{record.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedRecord(record)}
                    className="p-3 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
                  >
                    <Eye size={20} />
                  </button>
                  <button 
                    onClick={() => handleDownload(record)}
                    className="p-3 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <Upload size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Upload New Record</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Record Title</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g., Annual Physical Exam"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Record Type</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as MedicalRecord['type']})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 appearance-none"
                    >
                      <option value="diagnosis">Diagnosis</option>
                      <option value="lab-result">Lab Result</option>
                      <option value="immunization">Immunization</option>
                      <option value="surgery">Surgery</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Diagnosis Status</label>
                    <select 
                      value={formData.diagnosisStatus}
                      onChange={(e) => setFormData({...formData, diagnosisStatus: e.target.value as MedicalRecord['diagnosisStatus']})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 appearance-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Chronic">Chronic</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                  <div className="relative">
                    <input 
                      required
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Description / Notes</label>
                  <textarea 
                    rows={3}
                    placeholder="Provide details about the medical record..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <FileText size={24} />
                    Save Medical Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                    <FileText size={14} />
                    Record Details
                  </div>
                  <h3 className="text-3xl font-black text-slate-900">{selectedRecord.title}</h3>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</p>
                  <p className="font-bold text-slate-700">{selectedRecord.type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                  <p className="font-bold text-slate-700">{selectedRecord.date}</p>
                </div>
                {selectedRecord.diagnosisStatus && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                    <p className="font-bold text-slate-700">{selectedRecord.diagnosisStatus}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Record ID</p>
                  <p className="font-mono text-[10px] text-slate-400">{selectedRecord.id}</p>
                </div>
              </div>

              <div className="space-y-2 px-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description & Analysis</p>
                <p className="text-slate-600 font-medium leading-relaxed bg-blue-50/30 p-6 rounded-3xl border border-blue-100/30">
                  {selectedRecord.description}
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handleDownload(selectedRecord)}
                  className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download File
                </button>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
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
