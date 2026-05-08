import React, { useState, useRef, useEffect } from 'react';
import { 
  Brain, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  MessageSquare, 
  X, 
  Info,
  AlertCircle,
  BookOpen,
  History,
  Loader2,
  FileUp,
  BarChart3,
  Paperclip,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  setDoc,
  getDocs,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line
} from 'recharts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: any; // Can be Date or Firestore Timestamp
  chartData?: any[];
  chartType?: 'bar' | 'line';
}

interface ClinicalConsultantProps {
  userId: string;
}

export default function ClinicalConsultant({ userId }: ClinicalConsultantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load or create consultation
  useEffect(() => {
    const q = query(
      collection(db, 'consultations'),
      where('patientId', '==', userId),
      orderBy('lastUpdated', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setConsultationId(snapshot.docs[0].id);
        setMessages(docData.messages.map((m: any) => ({
          ...m,
          timestamp: m.timestamp?.toDate() || new Date(m.timestamp)
        })));
      } else {
        // Initial welcome message if no history
        setMessages([
          {
            role: 'assistant',
            content: "Hello. I am your AI Clinical Consultant. I am powered by specialized medical LLMs to provide evidence-based insights and clinical reasoning. You can now upload medical documents (lab reports, scans) for analysis. How can I assist you today?",
            timestamp: new Date()
          }
        ]);
      }
      setIsInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'consultations');
      setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setSelectedFile({
        data: base64Data,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input || (selectedFile ? `Analyzed document: ${selectedFile.name}` : ''),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    // Optimistically update Firestore if consultation exists
    if (consultationId) {
      updateDoc(doc(db, 'consultations', consultationId), {
        messages: newMessages,
        lastUpdated: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'consultations'));
    } else {
      addDoc(collection(db, 'consultations'), {
        patientId: userId,
        messages: newMessages,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      }).then(docRef => setConsultationId(docRef.id))
        .catch(err => handleFirestoreError(err, OperationType.WRITE, 'consultations'));
    }

    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const parts: any[] = [{ text: currentInput || "Please analyze this medical document and provide clinical insights." }];
      
      if (currentFile) {
        parts.push({
          inlineData: {
            data: currentFile.data,
            mimeType: currentFile.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: { parts },
        config: {
          systemInstruction: `You are a highly specialized AI Clinical Consultant. 
          Your primary goals are:
          1. Clinical Accuracy: Provide information based on medical guidelines.
          2. Evidence-Based Reasoning: Cite studies where applicable. Use Google Search to find the latest clinical trials and medical research.
          3. HIPAA Compliance: Never ask for PII.
          4. Document Analysis: If an image/document is provided, extract key values (e.g., lab results, vital signs).
          5. Data Visualization: If you find numerical trends or multiple data points (like blood pressure over time, or multiple lab values), include a JSON block at the end of your response in the following format:
             \`\`\`json
             {
               "chartType": "bar" | "line",
               "data": [
                 { "name": "Label", "value": 123 },
                 ...
               ]
             }
             \`\`\`
          
          Structure your responses with clear headings. Always include a medical disclaimer.`,
          temperature: 0.1,
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "";
      let chartData: any[] | undefined;
      let chartType: 'bar' | 'line' | undefined;
      let cleanContent = text;

      // Extract JSON chart data
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          chartData = parsed.data;
          chartType = parsed.chartType;
          cleanContent = text.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error("Failed to parse chart JSON", e);
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: cleanContent || "I apologize, but I encountered an error processing your inquiry.",
        timestamp: new Date(),
        chartData,
        chartType
      };

      const finalMessages = [...messages, userMessage, assistantMessage];
      setMessages(finalMessages);

      if (consultationId) {
        await updateDoc(doc(db, 'consultations', consultationId), {
          messages: finalMessages,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Clinical AI Error:", error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "An error occurred while accessing the specialized medical LLM. Please ensure your connection is secure and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      if (consultationId) {
        updateDoc(doc(db, 'consultations', consultationId), {
          messages: [...messages, userMessage, errorMessage],
          lastUpdated: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!consultationId) return;
    try {
      await updateDoc(doc(db, 'consultations', consultationId), {
        messages: [
          {
            role: 'assistant',
            content: "Chat history cleared. How can I assist you today?",
            timestamp: new Date()
          }
        ],
        lastUpdated: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'consultations');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-100 shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <Brain size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Clinical Consultant</h3>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                <ShieldCheck size={12} />
                Multimodal Analysis Enabled
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClearHistory}
              className="p-2 hover:bg-white rounded-lg text-slate-400 transition-all hover:text-red-500"
              title="Clear History"
            >
              <Trash2 size={18} />
            </button>
            <button className="p-2 hover:bg-white rounded-lg text-slate-400 transition-all">
              <History size={18} />
            </button>
            <button className="p-2 hover:bg-white rounded-lg text-slate-400 transition-all">
              <Info size={18} />
            </button>
          </div>
        </div>
        
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex items-start gap-3">
          <Sparkles className="text-blue-600 shrink-0 mt-0.5" size={16} />
          <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
            Upload lab reports or scan results for AI-powered clinical analysis and data visualization.
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="text-blue-600 animate-spin" size={32} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Clinical History...</p>
          </div>
        ) : messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[90%] space-y-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="space-y-4">
                    <div className="markdown-body prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    
                    {msg.chartData && (
                      <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <BarChart3 size={14} />
                          Clinical Data Visualization
                        </div>
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {msg.chartType === 'line' ? (
                              <LineChart data={msg.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            ) : (
                              <BarChart data={msg.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                />
                                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
              <Loader2 className="text-blue-600 animate-spin" size={18} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analyzing Clinical Data...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-slate-50 bg-white">
        {selectedFile && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-blue-50 rounded-2xl flex items-center justify-between border border-blue-100"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
                <Paperclip size={14} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-blue-900 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">{selectedFile.mimeType}</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedFile(null)}
              className="p-2 hover:bg-blue-100 rounded-xl text-blue-600 transition-all"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        )}

        <div className="relative group">
          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question or upload a document..."
            className="w-full pl-5 pr-24 py-4 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-600 transition-all font-medium text-slate-900 resize-none placeholder:text-slate-400 text-sm"
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,application/pdf"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 bg-white text-slate-400 rounded-2xl flex items-center justify-center hover:text-blue-600 transition-all border border-slate-100 shadow-sm"
            >
              <FileUp size={18} />
            </button>
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || isLoading}
              className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          <div className="flex items-center gap-1">
            <BookOpen size={10} />
            Evidence-Based
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle size={10} />
            Clinical Accuracy
          </div>
        </div>
      </div>
    </div>
  );
}
