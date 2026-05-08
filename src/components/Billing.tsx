import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Check, 
  Sparkles, 
  CreditCard, 
  Clock, 
  Zap, 
  Star, 
  Lock, 
  RefreshCw, 
  X,
  ArrowUpRight,
  TrendingDown,
  Activity,
  Calendar,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  updateDoc, 
  serverTimestamp,
  collection,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { GoogleGenAI } from "@google/genai";
import { getSubscriptions, SubscriptionPlan } from '../lib/subscriptionService';

interface BillingProps {
  userId: string;
  userProfile: UserProfile | null;
}

export default function Billing({ userId, userProfile }: BillingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancel' | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<'monthly' | 'yearly'>('yearly');

  useEffect(() => {
    generateAiAnalysis();
    fetchPlans();
    
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') setCheckoutStatus('success');
    if (status === 'cancel') setCheckoutStatus('cancel');
  }, []);

  const fetchPlans = async () => {
    try {
      const plans = await getSubscriptions();
      setAvailablePlans(plans);
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  };

  const generateAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Based on a healthcare management app with "Pulse Premium" tiers ($9.99/mo or $99.99/year), generate a professional but encouraging 2-sentence value proposition for a 7-day free trial. Focus on how the automatic transition after 7 days ensures uninterrupted clinical data insights.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiAnalysis(response.text || 'Experience the future of healthcare management with our 7-day trial. Seamlessly transition to a full plan for continuous, AI-driven wellness insights.');
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startFreeTrial = async () => {
    await handleCheckout(selectedPlanId, true);
  };

  const startSubscription = async (plan: string) => {
    await handleCheckout(plan === 'price_9999_yearly' ? 'yearly' : 'monthly', false);
  };

  const handleSubscribe = async (plan: string) => {
    if (plan === 'trial') {
      await startFreeTrial();
    } else if (plan === 'monthly') {
      await startSubscription('price_monthly');
    } else if (plan === 'yearly') {
      await startSubscription('price_yearly');
    }
  };

  const handleCheckout = async (plan: 'monthly' | 'yearly', isTrial: boolean = false) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to proceed.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/createCheckoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          plan,
          userId: user.uid,
          userEmail: user.email,
          isTrial
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = userProfile?.isPremium;
  const isTrial = userProfile?.subscriptionStatus === 'trialing';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            <Wallet size={14} />
            Billing & Subscription
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Your Health Plan</h2>
          <p className="text-slate-500 font-medium">Manage your Pulse Premium subscription and clinical access tiers.</p>
        </div>
      </header>

      {/* Subscription Status Card */}
      {isPremium ? (
        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-2xl shadow-blue-100 flex flex-col md:flex-row gap-10 items-center">
          <div className={`w-32 h-32 ${isTrial ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} rounded-[40px] flex items-center justify-center shrink-0 shadow-lg`}>
            {isTrial ? <Clock size={64} /> : <Check size={64} />}
          </div>
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-3xl font-black text-slate-900">
                  {isTrial ? '7-Day Free Trial Active' : `${userProfile.planType} Plan Active`}
                </h3>
                <span className={`px-4 py-1.5 ${isTrial ? 'bg-blue-600' : 'bg-emerald-600'} text-white rounded-full text-[10px] font-black uppercase tracking-widest`}>
                  {userProfile.subscriptionStatus}
                </span>
              </div>
              <p className="text-slate-500 font-medium text-lg leading-relaxed">
                {isTrial 
                  ? `Your trial period is currently running. You will automatically transition to the full ${userProfile.planType} experience on completion.`
                  : `Your clinical data insights are fully unlocked. Thank you for your commitment to premium health management.`
                }
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-[200px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Frequency</p>
                <p className="font-bold text-slate-900 capitalize flex items-center gap-2">
                   <Calendar size={14} className="text-blue-600" />
                   {userProfile.planType}
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-[200px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pulse Member Since</p>
                <p className="font-bold text-slate-900 capitalize flex items-center gap-2">
                   <Activity size={14} className="text-rose-600" />
                   {userProfile.createdAt ? new Date(userProfile.createdAt as any).toLocaleDateString() : 'Active Member'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Prominent Trial Banner for Non-Subscribers */
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[50px] p-10 md:p-16 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Zap size={240} />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest border border-white/20">
                <Star size={14} />
                Try Before You Buy
              </div>
              <h3 className="text-5xl md:text-6xl font-black leading-tight">7 Days of Unlimited Health Intelligence</h3>
              <p className="text-blue-100 text-xl font-medium opacity-90 leading-relaxed">
                Unlock full access to clinical lab tracking, AI diagnostic simulation, and secure PHI storage. Zero cost for the first week.
              </p>
              
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="space-y-4 w-full md:w-auto">
                   <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl w-fit">
                    <button 
                      onClick={() => setSelectedPlanId('monthly')}
                      className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${selectedPlanId === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                    >
                      Monthly
                    </button>
                    <button 
                      onClick={() => setSelectedPlanId('yearly')}
                      className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${selectedPlanId === 'yearly' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                    >
                      Yearly
                    </button>
                  </div>
                  <button 
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe('trial');
                    }}
                    className="w-full md:w-auto px-12 py-6 bg-white text-blue-600 rounded-3xl font-black text-xl shadow-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" /> : <Zap size={24} />}
                    Start 7-Day Free Trial
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Check size={18} className="text-emerald-400" />
                    Automatic transition to selected plan
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Check size={18} className="text-emerald-400" />
                    Cancel anytime during first 7 days
                  </div>
                </div>
              </div>
            </div>
            
            {/* AI Analysis Component */}
            <div className="bg-white/10 backdrop-blur-2xl rounded-[40px] p-8 border border-white/20 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Sparkles size={24} className="text-amber-300" />
                </div>
                <h4 className="font-black text-xl">Pulse AI Billing Insight</h4>
              </div>
              <div className="space-y-4">
                <p className="text-blue-100 font-medium italic leading-relaxed text-lg">
                  "{isAnalyzing ? 'Analyzing optimal health pathways...' : aiAnalysis}"
                </p>
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                  <span>Generative Cost Analysis</span>
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse [animation-delay:200ms]" />
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse [animation-delay:400ms]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details Grid */}
      {!isPremium && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Monthly Plan */}
          <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all space-y-8 relative group">
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">Monthly Pulse</h3>
              <p className="text-slate-500 font-medium leading-relaxed">Perfect for exploratory clinical data management and short-term tracking.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black text-slate-900">$9.99</span>
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">/ month</span>
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <PlanFeature label="Full AI Clinical Insights" />
              <PlanFeature label="Secure PHI Vault Storage" />
              <PlanFeature label="Unlimited Lab Result Registry" />
              <PlanFeature label="Direct Pharmacist Messaging" />
            </div>
            <button 
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('monthly');
              }}
              className="w-full py-5 bg-slate-900 text-white rounded-3xl font-bold text-lg hover:bg-black transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-3"
            >
              {isLoading ? <RefreshCw className="animate-spin" /> : <CreditCard size={20} />}
              $9.99 / Month
            </button>
          </div>

          {/* Yearly Plan */}
          <div className="bg-white rounded-[40px] p-10 border-2 border-emerald-500 shadow-2xl shadow-emerald-50 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 pt-6 pr-6">
              <div className="px-4 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Best Value - 20% OFF
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">Annual Wellness</h3>
              <p className="text-slate-500 font-medium leading-relaxed">Commit to long-term health success with our most comprehensive plan.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black text-slate-900">$99.99</span>
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">/ year</span>
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <PlanFeature label="Everything in Monthly" />
              <PlanFeature label="Priority AI Diagnostics" />
              <PlanFeature label="Advanced Trend Visualization" />
              <PlanFeature label="Family Profile Linking" />
            </div>
            <button 
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('yearly');
              }}
              className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-100 flex items-center justify-center gap-3"
            >
              {isLoading ? <RefreshCw className="animate-spin" /> : <TrendingDown size={20} />}
              $99.99 / Year
            </button>
          </div>
        </div>
      )}

      {/* Security Footer */}
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="flex items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all">
          <ShieldCheck size={48} />
          <Lock size={40} />
          <CreditCard size={44} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">HIPAA Compliant • 256-bit Encryption • Stripe Secure Payments</p>
          <p className="text-slate-500 text-sm font-medium">All clinical data is handled with the highest level of security and privacy protocol.</p>
        </div>
      </div>
    </div>
  );
}

function PlanFeature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-sm">
      <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
        <Check size={14} />
      </div>
      {label}
    </div>
  );
}
