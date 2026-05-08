import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Stethoscope, 
  Pill, 
  Heart,
  Sparkles,
  Save,
  Check,
  User,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Facility, ClinicalStaff } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { GoogleGenAI } from "@google/genai";

interface ClinicStaffProfilesProps {
  isAdmin: boolean;
}

type StaffRole = 'physician' | 'pharmacist' | 'nurse';

export default function ClinicStaffProfiles({ isAdmin }: ClinicStaffProfilesProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [staff, setStaff] = useState<ClinicalStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clinic' | 'staff'>('clinic');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFacilities = facilities.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.services?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Clinic Form State
  const [clinicData, setClinicData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    logoURL: '',
    hours: '',
    services: ''
  });

  // Staff Form State
  const [staffData, setStaffData] = useState({
    name: '',
    role: 'physician' as StaffRole,
    specialty: '',
    email: '',
    phone: '',
    photoURL: '',
    availability: '',
    bio: ''
  });

  useEffect(() => {
    const unsubFacilities = onSnapshot(collection(db, 'facilities'), (snapshot) => {
      setFacilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Facility)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'facilities'));

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClinicalStaff)));
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'staff'));

    return () => {
      unsubFacilities();
      unsubStaff();
    };
  }, []);

  const handleClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...clinicData,
        services: clinicData.services.split(',').map(s => s.trim()).filter(s => s !== '')
      };

      if (editingItem) {
        await updateDoc(doc(db, 'facilities', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'facilities'), data);
      }
      
      setIsFormOpen(false);
      setEditingItem(null);
      resetClinicForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'facilities');
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'staff', editingItem.id), staffData);
      } else {
        await addDoc(collection(db, 'staff'), staffData);
      }
      
      setIsFormOpen(false);
      setEditingItem(null);
      resetStaffForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'staff');
    }
  };

  const resetClinicForm = () => {
    setClinicData({ 
      name: '', 
      address: '', 
      city: '', 
      country: '', 
      phone: '', 
      email: '', 
      logoURL: '', 
      hours: '', 
      services: '' 
    });
  };

  const resetStaffForm = () => {
    setStaffData({
      name: '',
      role: 'physician',
      specialty: '',
      email: '',
      phone: '',
      photoURL: '',
      availability: '',
      bio: ''
    });
  };

  const handleEditClinic = (facility: Facility) => {
    setEditingItem(facility);
    setClinicData({
      name: facility.name,
      address: facility.address,
      city: facility.city || '',
      country: facility.country || '',
      phone: facility.phone,
      email: facility.email || '',
      logoURL: facility.logoURL || '',
      hours: facility.hours || '',
      services: facility.services?.join(', ') || ''
    });
    setIsFormOpen(true);
  };

  const handleEditStaff = (member: ClinicalStaff) => {
    setEditingItem(member);
    setStaffData({
      name: member.name,
      role: member.role,
      specialty: member.specialty || '',
      email: member.email,
      phone: member.phone || '',
      photoURL: member.photoURL || '',
      availability: member.availability || '',
      bio: (member as any).bio || ''
    });
    setIsFormOpen(true);
  };

  const handleDeleteClinic = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this facility?')) {
      try {
        await deleteDoc(doc(db, 'facilities', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'facilities');
      }
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
      try {
        await deleteDoc(doc(db, 'staff', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'staff');
      }
    }
  };

  const generateAiBio = async () => {
    if (!staffData.name || !staffData.specialty) return;
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a professional, warm, and concise medical bio (max 100 words) for a ${staffData.role} named ${staffData.name} who specializes in ${staffData.specialty}. Focus on their dedication to patient care and clinical excellence.`,
      });
      setStaffData({ ...staffData, bio: response.text || '' });
    } catch (error) {
      console.error("AI Bio Generation failed:", error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const generateAiClinicDetails = async () => {
    if (!clinicData.name) return;
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate realistic healthcare provider details for a facility named "${clinicData.name}". 
        Return the data in JSON format with the following keys: 
        address, city, country, phone, email, logoURL (use a high-quality medical logo placeholder from picsum.photos), hours (brief description), services (comma-separated list).`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const details = JSON.parse(response.text || '{}');
      setClinicData({
        ...clinicData,
        address: details.address || '',
        city: details.city || '',
        country: details.country || '',
        phone: details.phone || '',
        email: details.email || '',
        logoURL: details.logoURL || '',
        hours: details.hours || '',
        services: details.services || ''
      });
    } catch (error) {
      console.error("AI Clinic Details Generation failed:", error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const generateAiClinicDescription = async () => {
    if (!clinicData.name || !clinicData.services) return;
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a professional and welcoming clinic description (max 120 words) for "${clinicData.name}". The clinic offers services like: ${clinicData.services}. Emphasize their commitment to community health and modern medical facilities.`,
      });
      setClinicData({ ...clinicData, hours: response.text || '' }); // Using hours field for description for now or could add a new field
    } catch (error) {
      console.error("AI Clinic Description failed:", error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const getRoleIcon = (role: StaffRole) => {
    switch (role) {
      case 'physician': return <Stethoscope size={24} />;
      case 'pharmacist': return <Pill size={24} />;
      case 'nurse': return <Heart size={24} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Clinic & Staff Profiles</h2>
          <p className="text-slate-500 font-medium">Manage your healthcare facility information and clinical team.</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingItem(null);
              if (activeTab === 'clinic') resetClinicForm();
              else resetStaffForm();
              setIsFormOpen(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus size={20} />
            {activeTab === 'clinic' ? 'Add Facility' : 'Add Staff Member'}
          </button>
        )}
      </header>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 flex items-center gap-4 w-full">
          <button
            onClick={() => setActiveTab('clinic')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'clinic' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
              : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Building2 size={18} />
            Clinic Profile
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'staff' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
              : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={18} />
            Staff Profile
          </button>
        </div>
        
        {activeTab === 'clinic' && (
          <div className="flex-1 w-full flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group focus-within:ring-2 focus-within:ring-blue-600/20 transition-all">
            <RefreshCw size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search marketplace (Name, City, Country, Service)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full font-semibold text-slate-700 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'clinic' ? (
          filteredFacilities.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
              <Building2 size={40} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">No facilities found</h3>
              <p className="text-slate-500 text-sm">Add a facility to display information here.</p>
            </div>
          ) : (
            filteredFacilities.map((facility) => (
              <motion.div 
                key={facility.id}
                layout
                className="bg-white p-6 rounded-[40px] border border-slate-50 shadow-sm space-y-6 group hover:border-blue-100 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden border-4 border-white shadow-lg">
                    {facility.logoURL ? (
                      <img src={facility.logoURL} alt={facility.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Building2 size={32} />
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClinic(facility)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                      <button onClick={() => handleDeleteClinic(facility.id)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 leading-tight">{facility.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-blue-600 font-bold text-[10px] uppercase tracking-widest">
                      <MapPin size={12} />
                      {facility.city}, {facility.country}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600"><MapPin size={16} className="text-slate-400" /><span className="text-sm">{facility.address}</span></div>
                    <div className="flex items-center gap-3 text-slate-600"><Phone size={16} className="text-slate-400" /><span className="text-sm">{facility.phone}</span></div>
                    <div className="flex items-center gap-3 text-slate-600"><Mail size={16} className="text-slate-400" /><span className="text-sm">{facility.email}</span></div>
                  </div>
                  {facility.services && facility.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {facility.services.map((service, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-100">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )
        ) : (
          staff.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
              <Users size={40} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">No staff members found</h3>
              <p className="text-slate-500 text-sm">Add clinical team members to display them here.</p>
            </div>
          ) : (
            staff.map((member) => (
              <motion.div 
                key={member.id}
                layout
                className="bg-white p-6 rounded-[40px] border border-slate-50 shadow-sm space-y-6 group hover:border-blue-100 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="relative">
                    {member.photoURL ? (
                      <img src={member.photoURL} alt={member.name} className="w-20 h-20 rounded-3xl object-cover border-4 border-white shadow-lg" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 border-4 border-white shadow-lg"><User size={40} /></div>
                    )}
                    <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-blue-50 text-blue-600`}>
                      {getRoleIcon(member.role)}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditStaff(member)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                      <button onClick={() => handleDeleteStaff(member.id)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                  <p className="text-sm text-blue-600 font-bold uppercase tracking-widest mt-1">{member.specialty || member.role}</p>
                  <p className="text-xs text-slate-500 mt-3 line-clamp-2">{(member as any).bio || 'No bio available.'}</p>
                </div>
              </motion.div>
            ))
          )
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">
                  {editingItem ? `Edit ${activeTab === 'clinic' ? 'Facility' : 'Staff'}` : `Add ${activeTab === 'clinic' ? 'Facility' : 'Staff'}`}
                </h3>
                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X size={24} /></button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                {activeTab === 'clinic' ? (
                  <form onSubmit={handleClinicSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Facility Name</label>
                          <button type="button" onClick={generateAiClinicDetails} disabled={isAiGenerating} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                            {isAiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            AI Generate Details
                          </button>
                        </div>
                        <input required type="text" value={clinicData.name} onChange={(e) => setClinicData({...clinicData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logo URL</label>
                        <input type="text" value={clinicData.logoURL} onChange={(e) => setClinicData({...clinicData, logoURL: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" placeholder="https://..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Address</label>
                      <input required type="text" value={clinicData.address} onChange={(e) => setClinicData({...clinicData, address: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">City</label>
                        <input required type="text" value={clinicData.city} onChange={(e) => setClinicData({...clinicData, city: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Country</label>
                        <input required type="text" value={clinicData.country} onChange={(e) => setClinicData({...clinicData, country: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                        <input required type="text" value={clinicData.phone} onChange={(e) => setClinicData({...clinicData, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
                        <input required type="email" value={clinicData.email} onChange={(e) => setClinicData({...clinicData, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Services (comma separated)</label>
                      <input type="text" value={clinicData.services} onChange={(e) => setClinicData({...clinicData, services: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description / Hours</label>
                        <button type="button" onClick={generateAiClinicDescription} disabled={isAiGenerating} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                          {isAiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          AI Generate Description
                        </button>
                      </div>
                      <textarea value={clinicData.hours} onChange={(e) => setClinicData({...clinicData, hours: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all min-h-[120px] resize-none" />
                    </div>
                    <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100">Save Facility Profile</button>
                  </form>
                ) : (
                  <form onSubmit={handleStaffSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                        <input required type="text" value={staffData.name} onChange={(e) => setStaffData({...staffData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Role</label>
                        <select value={staffData.role} onChange={(e) => setStaffData({...staffData, role: e.target.value as StaffRole})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all">
                          <option value="physician">Physician</option>
                          <option value="pharmacist">Pharmacist</option>
                          <option value="nurse">Nurse</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Specialty / Title</label>
                      <input required type="text" value={staffData.specialty} onChange={(e) => setStaffData({...staffData, specialty: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
                        <input required type="email" value={staffData.email} onChange={(e) => setStaffData({...staffData, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                        <input type="text" value={staffData.phone} onChange={(e) => setStaffData({...staffData, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Professional Bio</label>
                        <button type="button" onClick={generateAiBio} disabled={isAiGenerating} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                          {isAiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          AI Generate Bio
                        </button>
                      </div>
                      <textarea value={staffData.bio} onChange={(e) => setStaffData({...staffData, bio: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all min-h-[120px] resize-none" />
                    </div>
                    <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100">Save Staff Profile</button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
