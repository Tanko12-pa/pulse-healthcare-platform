import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Video, 
  Pill, 
  ShoppingBag,
  Activity, 
  Settings, 
  LogOut,
  ChevronRight,
  Building2,
  FolderOpen,
  Users,
  FlaskConical,
  Brain,
  Heart,
  ShieldCheck,
  CreditCard,
  MapPin,
  Wallet
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  backendStatus: 'online' | 'offline' | 'checking';
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'records', label: 'Medical Records', icon: FileText },
  { id: 'files', label: "Patient's Files", icon: FolderOpen },
  { id: 'labs', label: 'Lab Registry', icon: FlaskConical },
  { id: 'intelligence', label: 'Intelligence Hub', icon: Brain },
  { id: 'telehealth', label: 'Telehealth', icon: Video },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'pharmacy', label: 'Health Shop', icon: ShoppingBag },
  { id: 'wellness', label: 'Wellness Tracking', icon: Heart },
  { id: 'locator', label: 'Clinic Locator', icon: MapPin },
  { id: 'clinic-staff', label: 'Clinic & Staff', icon: Building2 },
  { id: 'subscription', label: 'Billing & Plan', icon: Wallet },
  { id: 'communications', label: 'Secure Comms', icon: ShieldCheck },
  { id: 'system', label: 'System Status', icon: Settings },
];

export default function Sidebar({ activeTab, setActiveTab, onLogout, backendStatus }: SidebarProps) {
  return (
    <div className="w-72 h-screen bg-white border-r border-slate-100 flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
          <Activity size={24} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pulse Health</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                isActive 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
              {isActive && (
                <motion.div layoutId="active-pill">
                  <ChevronRight size={16} />
                </motion.div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-slate-50 space-y-2">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Backend Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 
              backendStatus === 'offline' ? 'bg-red-500' : 'bg-slate-300'
            }`} />
            <span className={`text-[10px] font-bold uppercase ${
              backendStatus === 'online' ? 'text-emerald-600' : 
              backendStatus === 'offline' ? 'text-red-600' : 'text-slate-400'
            }`}>
              {backendStatus}
            </span>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all font-semibold text-sm">
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-semibold text-sm"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
