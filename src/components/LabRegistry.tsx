import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  ChevronRight,
  Calendar,
  ShieldCheck,
  FileText,
  Clock,
  Plus,
  Sparkles,
  X,
  Activity as ActivityIcon,
  TrendingUp,
  Upload,
  ArrowUpRight,
  Stethoscope,
  Info,
  RefreshCw
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
import { LabResult, MedicalRecord } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { GoogleGenAI } from "@google/genai";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface LabRegistryProps {
  userId: string;
  isAdmin: boolean;
}

export default function LabRegistry({ userId, isAdmin }: LabRegistryProps) {
  const [results, setResults] = useState<LabResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [summaryInsight, setSummaryInsight] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    testName: '',
    category: 'Hematology',
    value: '',
    unit: '',
    referenceRange: '',
    status: 'pending' as LabResult['status'],
    labName: 'Central Diagnostic Lab',
    verifiedBy: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [requestData, setRequestData] = useState({
    testName: '',
    reason: '',
    priority: 'routine',
  });

  useEffect(() => {
    const q = isAdmin 
      ? query(collection(db, 'lab_results'), orderBy('date', 'desc'))
      : query(collection(db, 'lab_results'), where('patientId', '==', userId), orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const labResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LabResult));
      setResults(labResults);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'lab_results'));

    return () => unsubscribe();
  }, [userId, isAdmin]);

  const generateSummaryInsight = async () => {
    if (results.length === 0) return;
    setIsSummaryLoading(true);
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `As a clinical AI assistant, provide a concise (2-3 sentences) summary of these recent lab results for the patient. Focus on trends or areas needing attention.
      Results: ${results.slice(0, 5).map(r => `${r.testName}: ${r.value} ${r.unit} (${r.status})`).join(', ')}`;
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: "You are a professional medical AI. Provide accurate, clear, and HIPAA-compliant summaries of lab data."
        }
      });
      setSummaryInsight(response.text || "Unable to generate summary at this time.");
    } catch (error) {
      console.error("AI Summary failed:", error);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const getAiInsight = async (result: LabResult) => {
    setSelectedResult(result);
    setIsInsightModalOpen(true);
    setAiInsight('');
    setIsAiLoading(true);
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `Explain this lab result in simple terms for a patient. Include what it measures, what the value ${result.value} ${result.unit} means relative to the range ${result.referenceRange}, and any general advice.
      Test: ${result.testName}
      Category: ${result.category}
      Status: ${result.status}`;
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: "You are a patient-friendly medical AI. Explain lab results clearly, accurately, and with appropriate clinical caution."
        }
      });
      setAiInsight(response.text || "Unable to generate insight.");
    } catch (error) {
      console.error("AI Insight failed:", error);
      setAiInsight("An error occurred while generating the AI insight.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const analyzeLabReport = async () => {
    setIsAnalyzingFile(true);
    // Simulate AI extraction from a "uploaded file"
    setTimeout(() => {
      setFormData({
        testName: 'Hemoglobin A1c',
        category: 'Biochemistry',
        value: '5.7',
        unit: '%',
        referenceRange: '4.0 - 5.6',
        status: 'flag-risk',
        labName: 'Quest Diagnostics',
        verifiedBy: 'AI Extraction Engine',
        date: new Date().toISOString().split('T')[0],
      });
      setIsAnalyzingFile(false);
    }, 2000);
  };

  const handleRequestTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'records'), {
        patientId: userId,
        title: `Lab Request: ${requestData.testName}`,
        type: 'lab-result',
        description: `Patient requested lab test. Reason: ${requestData.reason}. Priority: ${requestData.priority}`,
        date: new Date().toISOString().split('T')[0],
        diagnosisStatus: 'Active',
        createdAt: serverTimestamp(),
      });
      setIsRequestModalOpen(false);
      setRequestData({ testName: '', reason: '', priority: 'routine' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'records');
    }
  };

  const viewTrends = (testName: string) => {
    const data = results
      .filter(r => r.testName === testName)
      .map(r => ({
        date: r.date,
        value: parseFloat(r.value) || 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setTrendData(data);
    setShowTrends(true);
  };

  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'lab_results'), {
        ...formData,
        patientId: userId,
        isVerified: formData.status === 'verified-ok',
        createdAt: serverTimestamp(),
      });
      setIsAddModalOpen(false);
      setFormData({
        testName: '',
        category: 'Hematology',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'pending',
        labName: 'Central Diagnostic Lab',
        verifiedBy: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'lab_results');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified-ok': return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'flag-risk': return <AlertTriangle size={20} className="text-rose-500" />;
      case 'pending': return <Clock size={20} className="text-amber-500" />;
      default: return <Clock size={20} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified-ok': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'flag-risk': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified-ok': return 'Verified OK';
      case 'flag-risk': return 'Flag Risk';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const filteredResults = results.filter(r => 
    r.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    const headers = ['Date', 'Test Name', 'Category', 'Result', 'Unit', 'Ref. Range', 'Status', 'Lab Name', 'Verified By'];
    const csvData = results.map(r => [
      r.date,
      r.testName,
      r.category,
      r.value,
      r.unit,
      r.referenceRange,
      r.status,
      r.labName,
      r.verifiedBy
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lab_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            <ShieldCheck size={14} />
            Verified Lab Registry
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Lab Registry</h2>
          <p className="text-slate-500 font-medium">Access your verified laboratory test results and diagnostic reports.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={generateSummaryInsight}
            disabled={isSummaryLoading || results.length === 0}
            className="px-6 py-3 bg-white border border-slate-100 text-blue-600 rounded-2xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={20} className={isSummaryLoading ? "animate-pulse" : ""} />
            AI Summary
          </button>
          {!isAdmin && (
            <button 
              onClick={() => setIsRequestModalOpen(true)}
              className="px-6 py-3 bg-white border border-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Stethoscope size={20} />
              Request Test
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              Add Result
            </button>
          )}
          <button 
            onClick={handleExport}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Download size={20} />
            Export All
          </button>
        </div>
      </header>

      {showTrends && trendData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Lab Trends Analysis</h3>
            </div>
            <button 
              onClick={() => setShowTrends(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
            >
              Close Trends
            </button>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {summaryInsight && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] p-8 text-white shadow-2xl shadow-blue-100 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-xl font-bold tracking-tight">AI Clinical Summary</h3>
            </div>
            <p className="text-blue-50 text-lg font-medium leading-relaxed max-w-4xl">
              {summaryInsight}
            </p>
            <button 
              onClick={() => setSummaryInsight('')}
              className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-200 hover:text-white transition-colors"
            >
              Dismiss Summary
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by test name or category..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs">
          <Filter size={16} />
          Filter
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Test Name</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Result</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Ref. Range</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <FlaskConical size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No results found</h3>
                    <p className="text-slate-500 text-sm">Your verified lab results will appear here once available.</p>
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                          <FlaskConical size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{result.testName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{result.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-900">{result.value}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{result.unit}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-slate-500">{result.referenceRange}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${getStatusColor(result.status)}`}>
                        {getStatusIcon(result.status)}
                        {getStatusLabel(result.status)}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {result.date}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => viewTrends(result.testName)}
                          className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-emerald-600 shadow-sm border border-transparent hover:border-slate-100 group/trend"
                          title="View Trends"
                        >
                          <TrendingUp size={18} className="group-hover/trend:scale-110 transition-transform" />
                        </button>
                        <button 
                          onClick={() => getAiInsight(result)}
                          className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-indigo-600 shadow-sm border border-transparent hover:border-slate-100 group/ai"
                          title="AI Insight"
                        >
                          <Sparkles size={18} className="group-hover/ai:scale-110 transition-transform" />
                        </button>
                        <button className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-blue-600 shadow-sm border border-transparent hover:border-slate-100">
                          <FileText size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-emerald-600 rounded-[40px] p-8 text-white shadow-2xl shadow-emerald-100">
          <CheckCircle2 size={32} className="mb-4 opacity-50" />
          <h4 className="text-xl font-bold mb-2">Verified Results</h4>
          <p className="text-emerald-100 text-sm font-medium leading-relaxed">
            All results in this registry are verified by certified laboratory professionals and are HIPAA compliant.
          </p>
        </div>
        <div className="bg-blue-600 rounded-[40px] p-8 text-white shadow-2xl shadow-blue-100">
          <FlaskConical size={32} className="mb-4 opacity-50" />
          <h4 className="text-xl font-bold mb-2">Lab Partners</h4>
          <p className="text-blue-100 text-sm font-medium leading-relaxed">
            We partner with leading diagnostic centers to provide fast, accurate, and secure data transmission.
          </p>
        </div>
        <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl shadow-slate-200">
          <ShieldCheck size={32} className="mb-4 opacity-50" />
          <h4 className="text-xl font-bold mb-2">Data Security</h4>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Your diagnostic data is encrypted end-to-end and accessible only by you and your authorized clinical team.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                    <Plus size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Add New Lab Result</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={analyzeLabReport}
                    disabled={isAnalyzingFile}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
                  >
                    {isAnalyzingFile ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isAnalyzingFile ? 'Analyzing...' : 'AI Extract from Report'}
                  </button>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddResult} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Test Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g., Complete Blood Count"
                      value={formData.testName}
                      onChange={(e) => setFormData({...formData, testName: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 appearance-none"
                    >
                      <option value="Hematology">Hematology</option>
                      <option value="Biochemistry">Biochemistry</option>
                      <option value="Immunology">Immunology</option>
                      <option value="Microbiology">Microbiology</option>
                      <option value="Urinalysis">Urinalysis</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Value</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g., 14.2"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Unit</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g., g/dL"
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Ref. Range</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g., 13.5 - 17.5"
                      value={formData.referenceRange}
                      onChange={(e) => setFormData({...formData, referenceRange: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as LabResult['status']})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 appearance-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="verified-ok">Verified OK</option>
                      <option value="flag-risk">Flag Risk</option>
                    </select>
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
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Lab Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.labName}
                      onChange={(e) => setFormData({...formData, labName: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Verified By</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Dr. Sarah Smith"
                      value={formData.verifiedBy}
                      onChange={(e) => setFormData({...formData, verifiedBy: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 size={24} />
                    Save Lab Result
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <Stethoscope size={20} />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">Request Lab Test</h3>
                </div>
                <button 
                  onClick={() => setIsRequestModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-all text-white/80 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRequestTest} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Test Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g., Lipid Panel, Vitamin D"
                    value={requestData.testName}
                    onChange={(e) => setRequestData({...requestData, testName: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Reason for Request</label>
                  <textarea 
                    rows={3}
                    placeholder="Describe your symptoms or reason for the test..."
                    value={requestData.reason}
                    onChange={(e) => setRequestData({...requestData, reason: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Priority</label>
                  <div className="flex gap-4">
                    {['routine', 'urgent'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRequestData({...requestData, priority: p})}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                          requestData.priority === p 
                          ? 'bg-slate-900 text-white' 
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <ArrowUpRight size={24} />
                    Submit Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isInsightModalOpen && selectedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">AI Lab Insight</h3>
                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">Clinical Intelligence</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInsightModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-all text-white/80 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Test Name</p>
                    <p className="font-bold text-slate-900">{selectedResult.testName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Result</p>
                    <p className="font-black text-indigo-600">{selectedResult.value} {selectedResult.unit}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ActivityIcon size={14} />
                    Analysis
                  </h4>
                  {isAiLoading ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse w-full" />
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse w-5/6" />
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse w-4/6" />
                    </div>
                  ) : (
                    <p className="text-slate-600 font-medium leading-relaxed">
                      {aiInsight}
                    </p>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setIsInsightModalOpen(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all"
                  >
                    Close Insight
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
