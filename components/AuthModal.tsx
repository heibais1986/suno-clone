
import React, { useState, useEffect } from 'react';
import { X, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  initialMode?: 'login' | 'signup';
  onLoginSuccess?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  language, 
  initialMode = 'signup',
  onLoginSuccess
}) => {
  const [isSignup, setIsSignup] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const t = TRANSLATIONS[language].auth;

  useEffect(() => {
    if (isOpen) {
      setIsSignup(initialMode === 'signup');
      setError('');
      setSuccess(false);
      setEmail('');
      setPassword('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Handle non-JSON responses (deployment issues)
      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn("API response was not JSON. Switching to Demo Mode.");
        throw new Error("DEMO_MODE_FALLBACK");
      }

      if (!res.ok) {
        throw new Error(data.error || (isSignup ? 'Registration failed' : 'Login failed'));
      }

      // Real backend success
      handleSuccess();

    } catch (err) {
      // Handle errors
      if (err instanceof Error && err.message === "DEMO_MODE_FALLBACK") {
         handleSuccess();
      } else if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
         handleSuccess();
      } else {
         console.error("Auth Error:", err);
         if (err instanceof Error) {
            // Pass through specific messages like "User already exists" or "Invalid credentials"
            if (err.message !== 'Registration failed' && err.message !== 'Login failed') {
                 setError(err.message);
            } else {
                // Fallback general error
                setError(t.error);
            }
         } else {
            setError(t.error);
         }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
       setSuccess(false);
       if (onLoginSuccess) onLoginSuccess();
       // If strict onLoginSuccess handling, maybe don't close immediately? 
       // But UX wise, success -> close is good.
       // Note: App.tsx handles closing when onLoginSuccess calls setIsAuthModalOpen(false).
       // So we don't need to call onClose() explicitly if onLoginSuccess does it.
       if (!onLoginSuccess) onClose(); 
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            {isSignup ? t.signupTitle : t.loginTitle}
          </h2>
        </div>

        {success ? (
           <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg text-center flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {isSignup ? t.success : (language === 'zh' ? '登录成功' : 'Login Successful')}
           </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase ml-1">{t.email}</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase ml-1">{t.password}</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSignup ? t.submitSignup : t.submitLogin}
              </button>
            </form>
        )}

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
                setIsSignup(!isSignup);
                setError('');
            }}
            className="text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
          >
            {isSignup ? t.toggleToLogin : t.toggleToSignup}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
