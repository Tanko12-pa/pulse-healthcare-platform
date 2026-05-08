import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Heart, 
  Moon, 
  Weight, 
  TrendingUp, 
  Calendar, 
  Plus, 
  ChevronRight, 
  Download, 
  Filter, 
  Search, 
  ArrowRight,
  ShieldCheck,
  X,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
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
import { WellnessMetric } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { calculateWellnessScore, getWellnessMessage } from '../lib/wellnessUtils';

interface WellnessProps {
  userId: string;
}

export default function Wellness({ userId }: WellnessProps) {
  const [metrics, setMetrics] = useState<WellnessMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<WellnessMetric | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'steps' | 'heartRate'>('date');
  const [formData, setFormData] = useState({
    steps: '',
    heartRate: '',
    sleepHours: '',
    weight: '',
    date: new Date().toISOString().split('T')[0],
  });

  const latestMetric = metrics[0] || null;

  const handleExport = () => {
    const headers = ['Date', 'Steps', 'Heart Rate (bpm)', 'Sleep (hrs)', 'Weight (lbs)'];
    const csvData = metrics.map(m => [
      m.date,
      m.steps || '--',
      m.heartRate || '--',
      m.sleepHours || '--',
      m.weight || '--'
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `wellness_metrics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMetrics = metrics
    .filter(m => 
      m.date.includes(searchQuery) || 
      m.steps?.toString().includes(searchQuery) ||
      m.heartRate?.toString().includes(searchQuery)
    )
    .sort((a, b) => {
      if (sortBy === 'steps') return (b.steps || 0) - (a.steps || 0);
      if (sortBy === 'heartRate') return (b.heartRate || 0) - (a.heartRate || 0);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const calculateTrend = (current: number | null | undefined, previous: number | null | undefined) => {
    if (!current || !previous) return '+0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
  };

  const stats = [
    { 
      label: 'Steps', 
      value: latestMetric?.steps?.toLocaleString() || '0', 
      unit: 'steps', 
      icon: Activity, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      trend: metrics.length > 1 ? calculateTrend(metrics[0].steps, metrics[1].steps) : '+0%'
    },
    { 
      label: 'Heart Rate', 
      value: latestMetric?.heartRate?.toString() || '--', 
      unit: 'bpm', 
      icon: Heart, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50',
      trend: metrics.length > 1 ? calculateTrend(metrics[0].heartRate, metrics[1].heartRate) : '+0%'
    },
    { 
      label: 'Sleep', 
      value: latestMetric?.sleepHours?.toString() || '--', 
      unit: 'hours', 
      icon: Moon, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50',
      trend: metrics.length > 1 ? calculateTrend(metrics[0].sleepHours, metrics[1].sleepHours) : '+0%'
    },
    { 
      label: 'Weight', 
      value: latestMetric?.weight?.toString() || '--', 
      unit: 'lbs', 
      icon: Weight, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: metrics.length > 1 ? calculateTrend(metrics[1].weight, metrics[0].weight) : '+0%' // Weight trend is usually inverse for health goals
    },
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'wellness'),
      where('patientId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WellnessMetric));
      setMetrics(mets);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'wellness'));

    return () => unsubscribe();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'wellness'), {
        patientId: userId,
        date: formData.date,
        steps: formData.steps ? parseInt(formData.steps) : null,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : null,
        sleepHours: formData.sleepHours ? parseFloat(formData.sleepHours) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setFormData({
        steps: '',
        heartRate: '',
        sleepHours: '',
        weight: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wellness');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Wellness Tracking</h2>
          <p className="text-slate-500 font-medium">Monitor your daily health metrics and track your progress over time.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus size={20} />
          Log New Metric
        </button>
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
                  {stat.trend}
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
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search history..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const options: ('date' | 'steps' | 'heartRate')[] = ['date', 'steps', 'heartRate'];
                  const next = options[(options.indexOf(sortBy) + 1) % options.length];
                  setSortBy(next);
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs"
                title={`Sorting by ${sortBy}`}
              >
                <Filter size={16} />
                Filter: {sortBy}
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : metrics.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Activity size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No metrics logged</h3>
                <p className="text-slate-500 text-sm">Start tracking your health by logging your first metric.</p>
              </div>
            ) : (
              filteredMetrics.map((metric, idx) => (
                <motion.div 
                  key={metric.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                      <Calendar size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{metric.date}</h4>
                      <p className="text-sm text-slate-500 font-medium">
                        {metric.steps && `${metric.steps} steps • `}
                        {metric.heartRate && `${metric.heartRate} bpm • `}
                        {metric.sleepHours && `${metric.sleepHours} hrs sleep`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedMetric(metric)}
                    className="p-3 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
                  >
                    <ChevronRight size={20} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
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
                onClick={async () => {
                  setIsAiLoading(true);
                  try {
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                    const score = calculateWellnessScore(metrics);
                    const prompt = `My current wellness score is ${score}/100. Based on these recent metrics: ${JSON.stringify(metrics.slice(0, 3))}, provide 3 short, actionable, bulleted points to improve my score. Keep it professional and clinical.`;
                    const res = await ai.models.generateContent({
                      model: "gemini-3-flash-preview",
                      contents: prompt,
                    });
                    setAiAdvice(res.text || 'Continue maintaining your current activity and sleep levels.');
                  } catch (e) {
                    console.error(e);
                    setAiAdvice('Maintain consistent sleep patterns and aim for 10,000 steps daily.');
                  } finally {
                    setIsAiLoading(false);
                  }
                }}
                disabled={isAiLoading}
                className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {isAiLoading ? 'Analyzing...' : 'Improve Your Score'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {aiAdvice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">AI Wellness Advisory</h3>
                </div>
                <button onClick={() => setAiAdvice('')} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                  {aiAdvice}
                </p>
              </div>
              <button 
                onClick={() => setAiAdvice('')}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
              >
                Got it, thanks!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMetric && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest">
                    <Activity size={14} />
                    Metric Snapshot
                  </div>
                  <h3 className="text-3xl font-black text-slate-900">{selectedMetric.date}</h3>
                </div>
                <button 
                  onClick={() => setSelectedMetric(null)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    <Activity size={14} />
                    Steps
                  </div>
                  <p className="text-2xl font-black text-slate-900">{selectedMetric.steps?.toLocaleString() || '--'}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest">
                    <Heart size={14} />
                    Heart Rate
                  </div>
                  <p className="text-2xl font-black text-slate-900">{selectedMetric.heartRate || '--'} <span className="text-xs font-bold text-slate-400">bpm</span></p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    <Moon size={14} />
                    Sleep
                  </div>
                  <p className="text-2xl font-black text-slate-900">{selectedMetric.sleepHours || '--'} <span className="text-xs font-bold text-slate-400">hrs</span></p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    <Weight size={14} />
                    Weight
                  </div>
                  <p className="text-2xl font-black text-slate-900">{selectedMetric.weight || '--'} <span className="text-xs font-bold text-slate-400">lbs</span></p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedMetric(null)}
                className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-black transition-all"
              >
                Close View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <PlusCircle size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Log New Metric</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Steps</label>
                    <input 
                      type="number" 
                      placeholder="e.g., 10000"
                      value={formData.steps}
                      onChange={(e) => setFormData({...formData, steps: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Heart Rate (bpm)</label>
                    <input 
                      type="number" 
                      placeholder="e.g., 72"
                      value={formData.heartRate}
                      onChange={(e) => setFormData({...formData, heartRate: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Sleep (hours)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="e.g., 7.5"
                      value={formData.sleepHours}
                      onChange={(e) => setFormData({...formData, sleepHours: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Weight (lbs)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="e.g., 165.4"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                  <input 
                    required
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <Activity size={24} />
                    Save Metric
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
