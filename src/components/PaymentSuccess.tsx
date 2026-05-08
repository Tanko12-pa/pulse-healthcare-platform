import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function PaymentSuccess() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      // If no user, we might be waiting for auth to initialize
      const unsubscribeAuth = auth.onAuthStateChanged((u) => {
        if (u) {
          startListening(u.uid);
        } else {
          // If still no user after auth check, redirect to home
          navigate('/');
        }
      });
      return () => unsubscribeAuth();
    } else {
      startListening(user.uid);
    }

    function startListening(uid: string) {
      // Listen to the user document for subscription status updates from our server
      const userRef = doc(db, 'users', uid);

      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        const data = snapshot.data();
        if (data && (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing')) {
          setStatus('success');
          // Redirect to the dashboard after 3 seconds
          setTimeout(() => navigate('/'), 3000);
        } else {
          // Still waiting for the Webhook to update Firestore
          setStatus('loading');
        }
      }, (error) => {
        console.log("Firestore error:", error);
        setStatus('error');
      });

      return unsubscribe;
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-2xl shadow-blue-100 border border-slate-50 text-center space-y-8"
      >
        {status === 'loading' && (
          <>
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[40px] flex items-center justify-center mx-auto shadow-lg relative">
              <Loader2 size={48} className="animate-spin" />
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-2 rounded-full shadow-lg">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verifying Plan</h2>
              <p className="text-slate-500 font-medium">We're confirming your Pulse Healthcare subscription. This will only take a moment.</p>
            </div>
            <div className="pt-4">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-1/2 bg-blue-600 h-full rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Please do not refresh the page</p>
            </div>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[40px] flex items-center justify-center mx-auto shadow-lg relative">
              <Check size={48} />
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-emerald-600 text-white p-2 rounded-full shadow-lg"
              >
                <Sparkles size={16} />
              </motion.div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome to Premium!</h2>
              <p className="text-slate-500 font-medium">Your subscription is active. Redirecting to your clinical dashboard...</p>
            </div>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="pt-4 flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm"
            >
              <Loader2 size={16} className="animate-spin" />
              Redirecting...
            </motion.div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[40px] flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verification Failed</h2>
              <p className="text-slate-500 font-medium">We couldn't verify your payment. Please contact Pulse Healthcare support for assistance.</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="w-full py-4 bg-slate-900 text-white rounded-3xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Return to Home
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
