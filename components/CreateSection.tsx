
import React, { useState } from 'react';
import { Sparkles, Loader2, Music4 } from 'lucide-react';
import { generateSongConcept } from '../services/geminiService';
import { Song, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface CreateSectionProps {
  onSongGenerated: (song: Song) => void;
  language: Language;
  isLoggedIn: boolean;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const CreateSection: React.FC<CreateSectionProps> = ({ onSongGenerated, language, isLoggedIn, onOpenAuth }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const t = TRANSLATIONS[language].create;

  const handleGenerate = async () => {
    // Authentication Check
    if (!isLoggedIn) {
       onOpenAuth('login');
       return;
    }

    if (!prompt.trim()) return;
    
    setIsLoading(true);
    try {
      const song = await generateSongConcept(prompt, language);
      onSongGenerated(song);
      setPrompt('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 relative z-20 -mt-8">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl ring-1 ring-white/5">
        <div className="relative">
           <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => !prompt && setIsExpanded(false)}
            placeholder={t.placeholder}
            className={`w-full bg-transparent text-lg text-white placeholder:text-zinc-500 px-6 py-4 focus:outline-none resize-none transition-all duration-300 ${isExpanded ? 'h-32' : 'h-16'}`}
           />
           
           <div className={`flex items-center justify-between px-4 pb-3 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'} transition-all duration-300`}>
              <div className="flex gap-2">
                 <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.mode}: <span className="text-white">{t.custom}</span></span>
                 <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-4">{t.model}: <span className="text-white">Gemini 2.5</span></span>
              </div>
              <button 
                onClick={handleGenerate}
                disabled={isLoading || !prompt}
                className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isLoading ? t.creating : t.button}
              </button>
           </div>

           {/* Collapsed State Button */}
           {!isExpanded && (
             <div className="absolute right-2 top-2 bottom-2">
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading || (!prompt && isLoggedIn)} // Allow clicking if not logged in even if empty, to show auth
                  className="h-full bg-white text-black px-6 rounded-xl font-bold hover:bg-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.button}
                </button>
             </div>
           )}
        </div>
      </div>
      
      {/* Decorative elements behind */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-rose-600/20 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
};

export default CreateSection;
