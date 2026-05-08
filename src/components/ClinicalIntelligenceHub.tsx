import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  ShieldCheck, 
  Zap, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  FileText,
  Heart,
  Stethoscope,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from '../lib/firebase';
import { ClinicalInsight, MedicalRecord, WellnessMetric, LabResult } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import BaselineAssessment from './BaselineAssessment';

interface ClinicalIntelligenceHubProps {
  userId: string;
}

export default function ClinicalIntelligenceHub({ userId }: ClinicalIntelligenceHubProps) {
  const [insights, setInsights] = useState<ClinicalInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isServerAnalyzing, setIsServerAnalyzing] = useState(false);
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  
  // Data for analysis
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [metrics, setMetrics] = useState<WellnessMetric[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);

  useEffect(() => {
    // Fetch insights
    const q = query(
      collection(db, 'insights'),
      where('patientId', '==', userId),
      orderBy('generatedAt', 'desc'),
      limit(5)
    );

    const unsubscribeInsights = onSnapshot(q, (snapshot) => {
      const ins = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClinicalInsight));
      setInsights(ins);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'insights'));

    // Fetch data for analysis (limited for context)
    const recordsQuery = query(collection(db, 'records'), where('patientId', '==', userId), limit(5));
    const metricsQuery = query(collection(db, 'wellness'), where('patientId', '==', userId), orderBy('date', 'desc'), limit(7));
    const labsQuery = query(collection(db, 'lab_results'), where('patientId', '==', userId), orderBy('date', 'desc'), limit(5));

    const unsubscribeRecords = onSnapshot(recordsQuery, (s) => setRecords(s.docs.map(d => d.data() as MedicalRecord)));
    const unsubscribeMetrics = onSnapshot(metricsQuery, (s) => setMetrics(s.docs.map(d => d.data() as WellnessMetric)));
    const unsubscribeLabs = onSnapshot(labsQuery, (s) => setLabResults(s.docs.map(d => d.data() as LabResult)));

    return () => {
      unsubscribeInsights();
      unsubscribeRecords();
      unsubscribeMetrics();
      unsubscribeLabs();
    };
  }, [userId]);

  const runAnalysis = async () => {
    if (records.length === 0 && metrics.length === 0 && labResults.length === 0) {
      setShowBaselineAssessment(true);
      return;
    }
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const prompt = `
        Analyze the following patient data and provide a clinical intelligence report including predictive triage and wellness recommendations.
        
        Medical Records: ${JSON.stringify(records)}
        Wellness Metrics (Last 7 days): ${JSON.stringify(metrics)}
        Lab Results: ${JSON.stringify(labResults)}

        Return the analysis in JSON format with the following structure:
        {
          "type": "triage" | "risk-assessment" | "wellness-plan",
          "summary": "A brief summary of the findings",
          "details": "Detailed clinical analysis",
          "riskLevel": "low" | "moderate" | "high" | "urgent",
          "recommendations": ["list", "of", "actions"]
        }
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const analysis = JSON.parse(response.text);

      await addDoc(collection(db, 'insights'), {
        patientId: userId,
        ...analysis,
        generatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runServerAnalysis = async () => {
    if (records.length === 0 && metrics.length === 0 && labResults.length === 0) {
      setShowBaselineAssessment(true);
      return;
    }
    setIsServerAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";

      const prompt = `
        You are a specialized Clinical AI assistant. Analyze the following patient data and provide a detailed clinical report.
        
        Medical Records: ${JSON.stringify(records.slice(0, 5))}
        Wellness Metrics: ${JSON.stringify(metrics.slice(0, 10))}
        Lab Results: ${JSON.stringify(labResults.slice(0, 5))}

        Return the analysis in JSON format with the following structure:
        {
          "type": "triage" | "risk-assessment" | "wellness-plan",
          "summary": "A brief summary of the findings",
          "details": "Detailed clinical analysis",
          "riskLevel": "low" | "moderate" | "high" | "urgent",
          "recommendations": ["list", "of", "actions"]
        }
        
        Provide a professional, evidence-based analysis.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }]
        }
      });

      const analysis = JSON.parse(response.text);
      
      await addDoc(collection(db, 'insights'), {
        patientId: userId,
        ...analysis,
        generatedAt: serverTimestamp(),
        isDeepAnalysis: true
      });
    } catch (error) {
      console.error("Deep AI Analysis failed:", error);
    } finally {
      setIsServerAnalyzing(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'moderate': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'high': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'urgent': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AnimatePresence>
        {showBaselineAssessment && (
          <BaselineAssessment 
            userId={userId} 
            onClose={() => setShowBaselineAssessment(false)}
            onComplete={() => {
              setShowBaselineAssessment(false);
              // Data will refresh via onSnapshot
            }}
          />
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            <Sparkles size={14} />
            Clinical Intelligence Hub
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Intelligence Hub</h2>
          <p className="text-slate-500 font-medium">AI-powered EHR processing and predictive triage for personalized healthcare.</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={runServerAnalysis}
            disabled={isServerAnalyzing}
            className="px-6 py-3 bg-white border border-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isServerAnalyzing ? <RefreshCw size={20} className="animate-spin" /> : <Zap size={20} />}
            {isServerAnalyzing ? 'Processing...' : 'Deep AI Analysis'}
          </button>
          <button 
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? <RefreshCw size={20} className="animate-spin" /> : <Brain size={20} />}
            {isAnalyzing ? 'Analyzing Data...' : 'Standard Analysis'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {(records.length === 0 || metrics.length === 0 || labResults.length === 0) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-50 border border-amber-100 p-8 rounded-[40px] flex flex-col md:flex-row items-center gap-6"
            >
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                <AlertCircle size={32} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-bold text-amber-900 mb-1">Insufficient Patient Data</h4>
                <p className="text-sm text-amber-700 font-medium leading-relaxed">
                  The Intelligence Hub requires baseline medical data to generate accurate clinical insights. Complete your baseline assessment to unlock AI-powered health analysis.
                </p>
              </div>
              <button 
                onClick={() => setShowBaselineAssessment(true)}
                className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 whitespace-nowrap"
              >
                Start Baseline Assessment
              </button>
            </motion.div>
          )}

          <h3 className="text-xl font-bold text-slate-900 px-2">Recent Clinical Insights</h3>
          
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : insights.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Brain size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No insights generated yet</h3>
                <p className="text-slate-500 text-sm">Run a clinical analysis to get AI-powered health insights.</p>
              </div>
            ) : (
              insights.map((insight, idx) => (
                <motion.div 
                  key={insight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6 group hover:border-blue-100 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getRiskColor(insight.riskLevel)}`}>
                        {insight.type === 'triage' ? <Stethoscope size={28} /> : <Activity size={28} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${getRiskColor(insight.riskLevel)}`}>
                            {insight.riskLevel} Risk
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {insight.type.replace('-', ' ')}
                          </span>
                          {insight.isDeepAnalysis && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-widest">
                              <Zap size={10} />
                              Deep Analysis
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl font-bold text-slate-900">{insight.summary}</h4>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {insight.generatedAt?.toDate ? insight.generatedAt.toDate().toLocaleDateString() : 'Just now'}
                    </span>
                  </div>

                  <p className="text-slate-600 font-medium leading-relaxed">
                    {insight.details}
                  </p>

                  <div className="pt-6 border-t border-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Recommendations</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {insight.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl group/item hover:bg-blue-50 transition-all">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm group-hover/item:scale-110 transition-transform">
                            <CheckCircle2 size={14} />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap size={120} />
            </div>
            <div className="relative z-10">
              <h4 className="text-2xl font-bold mb-4">Predictive Triage</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
                Our AI engine processes your EHR data, wellness metrics, and lab results to identify potential health risks before they become critical.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">
                    <Activity size={16} />
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Real-time Monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Trend Analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-rose-400">
                    <AlertCircle size={16} />
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Risk Mitigation</span>
                </div>
              </div>
              <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                Learn How It Works
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Data Sources</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-blue-600" />
                  <span className="font-bold text-slate-700 text-sm">Medical Records</span>
                </div>
                <span className="text-xs font-black text-slate-400">{records.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-rose-600" />
                  <span className="font-bold text-slate-700 text-sm">Wellness Metrics</span>
                </div>
                <span className="text-xs font-black text-slate-400">{metrics.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <FlaskConical size={20} className="text-emerald-600" />
                  <span className="font-bold text-slate-700 text-sm">Lab Results</span>
                </div>
                <span className="text-xs font-black text-slate-400">{labResults.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlaskConical(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v7.5" />
      <path d="M14 2v7.5" />
      <path d="M8.5 2h7" />
      <path d="M14 11.5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1Z" />
      <path d="M9 11c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1Z" />
      <path d="M20 20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2c0-1.1.4-2.2 1.1-3l4.5-6.1C10.1 10.3 10.5 10 11 10h2c.5 0 .9.3 1.4.9l4.5 6.1c.7.8 1.1 1.9 1.1 3Z" />
    </svg>
  );
}
