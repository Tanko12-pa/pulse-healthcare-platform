import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Bell, 
  Search, 
  Menu, 
  X, 
  User, 
  Settings,
  LogOut,
  LogIn,
  LayoutDashboard,
  Calendar,
  FileText,
  Video,
  Pill,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { UserProfile } from './types';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Appointments from './components/Appointments';
import MedicalRecords from './components/MedicalRecords';
import Telehealth from './components/Telehealth';
import Prescriptions from './components/Prescriptions';
import Wellness from './components/Wellness';
import PatientFiles from './components/PatientFiles';
import LabRegistry from './components/LabRegistry';
import ClinicalIntelligenceHub from './components/ClinicalIntelligenceHub';
import SecureCommunications from './components/SecureCommunications';
import ClinicalConsultant from './components/ClinicalConsultant';
import ClinicStaffProfiles from './components/ClinicStaffProfiles';
import ClinicLocator from './components/ClinicLocator';
import Pharmacy from './components/Pharmacy';
import Billing from './components/Billing';
import SystemStatus from './components/SystemStatus';
import PaymentSuccess from './components/PaymentSuccess';
import { handleFirestoreError, OperationType } from './lib/firestoreErrorHandler';
import { products } from './lib/products';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [firestoreStatus, setFirestoreStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const navigate = useNavigate();
  const location = useLocation();

  // Backend & Firestore health checks
  useEffect(() => {
    const checkSystems = async () => {
      // Check Express backend
      try {
        const res = await fetch('/api/health');
        if (res.ok) setBackendStatus('online');
        else setBackendStatus('offline');
      } catch (e) {
        setBackendStatus('offline');
      }

      // Check Firestore connectivity
      const { getDocFromServer, doc } = await import('firebase/firestore');
      try {
        await getDocFromServer(doc(db, '_health_check_', 'pulse'));
        setFirestoreStatus('online');
      } catch (e: any) {
        // 'permission-denied' is actually a good sign (it means we reached the server)
        // 'unavailable' or 'deadline-exceeded' means network/connectivity issue
        if (e.code === 'unavailable' || e.code === 'deadline-exceeded') {
          setFirestoreStatus('offline');
        } else {
          setFirestoreStatus('online'); 
        }
      }
    };
    checkSystems();
  }, []);

  // Log products as requested by user
  useEffect(() => {
    console.log("Health Shop Products:", products);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            name: u.displayName || 'Anonymous User',
            email: u.email || '',
            role: 'patient',
            photoURL: u.photoURL || '',
            isPremium: false,
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-blue-600 rounded-[40px] flex items-center justify-center text-white shadow-2xl shadow-blue-200 mb-10">
          <Activity size={48} />
        </div>
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Pulse Health</h1>
        <p className="text-slate-500 max-w-md mb-10 font-medium text-lg leading-relaxed">
          Your personal command hub for health and wellness. Sleek, secure, and sophisticated.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button 
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-3xl font-bold flex items-center gap-3 transition-all shadow-2xl shadow-blue-100 text-lg"
          >
            <LogIn size={24} />
            Sign In with Google
          </button>
          <button 
            onClick={handleLogin}
            className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-10 py-5 rounded-3xl font-bold flex items-center gap-3 transition-all shadow-sm text-lg"
          >
            <User size={24} />
            Sign Up
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = userProfile?.role === 'admin' || user.email === 'akindewum@gmail.com';
  const isSubscribed = userProfile?.isPremium || isAdmin;

  const renderContent = () => {
    if (!isSubscribed && activeTab !== 'subscription') {
      return <Billing userId={user.uid} userProfile={userProfile} />;
    }
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'appointments':
        return <Appointments userId={user.uid} />;
      case 'records':
        return <MedicalRecords userId={user.uid} onNavigate={setActiveTab} />;
      case 'files':
        return <PatientFiles userId={user.uid} isAdmin={isAdmin} />;
      case 'labs':
        return <LabRegistry userId={user.uid} isAdmin={isAdmin} />;
      case 'intelligence':
        return <ClinicalIntelligenceHub userId={user.uid} />;
      case 'telehealth':
        return <Telehealth userId={user.uid} isAdmin={isAdmin} />;
      case 'prescriptions':
        return <Prescriptions userId={user.uid} />;
      case 'wellness':
        return <Wellness userId={user.uid} />;
      case 'clinic-staff':
        return <ClinicStaffProfiles isAdmin={isAdmin} />;
      case 'locator':
        return <ClinicLocator />;
      case 'pharmacy':
        return <Pharmacy />;
      case 'subscription':
        return <Billing userId={user.uid} userProfile={userProfile} />;
      case 'communications':
        return <SecureCommunications userId={user.uid} />;
      case 'system':
        return <SystemStatus />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <Routes>
      <Route path="/success" element={<PaymentSuccess />} />
      <Route path="/cancel" element={<div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[40px] flex items-center justify-center shadow-lg mb-8">
          <X size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Checkout Cancelled</h2>
        <p className="text-slate-500 mb-8 max-w-sm">Your payment process was cancelled. No charges were made to your account.</p>
        <button onClick={() => navigate('/')} className="px-8 py-4 bg-slate-900 text-white rounded-3xl font-bold">Return Home</button>
      </div>} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="*" element={
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
          {/* Sidebar - Command Hub */}
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed lg:relative z-50"
              >
                <Sidebar 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                  onLogout={handleLogout} 
                  onToggleConsultant={() => setIsConsultantOpen(!isConsultantOpen)}
                  backendStatus={backendStatus}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 lg:px-12 flex items-center justify-between sticky top-0 z-40">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-500"
                >
                  <Menu size={24} />
                </button>
                <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 group focus-within:ring-2 focus-within:ring-blue-600/20 transition-all">
                  <Search size={20} className="text-slate-400 group-focus-within:text-blue-600" />
                  <input 
                    type="text" 
                    placeholder="Search records, doctors, or labs..." 
                    className="bg-transparent border-none outline-none text-sm w-80 font-semibold text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setIsConsultantOpen(!isConsultantOpen)}
                  className={`p-3 rounded-2xl transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${
                    isConsultantOpen 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <ShieldCheck size={20} />
                  <span className="hidden xl:inline">Clinical AI</span>
                </button>

                <button className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-500 relative group">
                  <Bell size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                </button>

                <div className="hidden lg:flex items-center gap-4 px-6 border-l border-slate-100">
                  <button 
                    onClick={handleLogin}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Sign Up
                  </button>
                  <button 
                    onClick={handleLogin}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                  <button 
                    onClick={() => setActiveTab('subscription')}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Subscription
                  </button>
                </div>
                
                <div className="flex items-center gap-4 pl-6 border-l border-slate-100">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-900">User</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-lg shadow-slate-200 border-2 border-white">
                    <User size={24} />
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* Dynamic Viewport */}
              <div className="flex-1 overflow-y-auto p-8 lg:p-12">
                <div className="max-w-7xl mx-auto w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      {renderContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Clinical Consultant Column */}
              <AnimatePresence>
                {isConsultantOpen && (
                  <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-0 lg:relative lg:inset-auto lg:w-[400px] z-[60] lg:z-auto bg-white flex flex-col"
                  >
                    <div className="lg:hidden p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                      <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                        <Activity size={18} />
                        Pulse AI
                      </div>
                      <button 
                        onClick={() => setIsConsultantOpen(false)}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-500"
                      >
                        <X size={24} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <ClinicalConsultant userId={user.uid} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <footer className="py-12 px-12 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-white">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <ShieldCheck size={14} />
                Secure HIPAA Compliant Platform
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                © 2026 Pulse Health Platform. All rights reserved.
              </p>
            </footer>
          </main>
        </div>
      } />
    </Routes>
  );
}
