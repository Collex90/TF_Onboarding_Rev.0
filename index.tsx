import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error Boundary Component
interface ErrorBoundaryProps extends React.PropsWithChildren<{}> {}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full border border-red-100">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <h1 className="text-xl font-bold">Si è verificato un errore</h1>
                </div>
                <p className="text-gray-600 mb-6 text-sm">L'applicazione ha riscontrato un problema imprevisto. Prova a ricaricare la pagina.</p>
                
                {this.state.error && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 overflow-auto max-h-40">
                        <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{this.state.error.toString()}</p>
                    </div>
                )}
                
                <button 
                    onClick={() => window.location.reload()} 
                    className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                >
                    Ricarica Applicazione
                </button>
            </div>
        </div>
      );
    }

    // Explicit cast to avoid "Property 'props' does not exist" error in some strict environments
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);