import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Database Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-rose-50 rounded-[40px] flex items-center justify-center text-rose-600 shadow-2xl shadow-rose-100 mb-10">
            <AlertCircle size={48} />
          </div>
          
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            {isFirestoreError ? 'Security or Data Error' : 'Something went wrong'}
          </h1>
          
          <p className="text-slate-500 max-w-md mb-10 font-medium text-lg leading-relaxed">
            {errorMessage}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-blue-100"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
            <button 
              onClick={this.handleReset}
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-sm"
            >
              <Home size={20} />
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
