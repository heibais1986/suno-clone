import React, { useState, useEffect } from 'react';
import { Music, Search, Menu, X, Globe } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface NavbarProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  onOpenAuth: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ language, setLanguage, onOpenAuth }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[language].navbar;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled || mobileMenuOpen ? 'bg-zinc-950/90 backdrop-blur-md border-b border-white/10 py-3' : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer group z-50">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Music className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight">{t.title}</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-zinc-400">
          <a href="#" className="hover:text-white transition-colors">{t.showcase}</a>
          <a href="#" className="hover:text-white transition-colors">{t.create}</a>
          <a href="#" className="hover:text-white transition-colors">{t.library}</a>
          <a href="#" className="hover:text-white transition-colors">{t.about}</a>
        </div>

        {/* Right Actions (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="relative group">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
             <input 
               type="text" 
               placeholder={t.searchPlaceholder} 
               className="bg-zinc-900 border border-white/10 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-white/30 w-48 transition-all focus:w-64"
             />
          </div>
          
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors font-medium text-sm px-2"
          >
            <Globe className="w-4 h-4" />
            {language === 'en' ? 'EN' : '中文'}
          </button>

          <button 
            onClick={onOpenAuth}
            className="font-semibold text-sm text-black bg-white hover:bg-zinc-200 px-5 py-2 rounded-full transition-colors"
          >
            {t.signup}
          </button>
        </div>

        {/* Mobile Actions (Visible on mobile) */}
        <div className="md:hidden flex items-center gap-3 z-50">
          <button 
            onClick={onOpenAuth}
            className="font-semibold text-xs text-black bg-white active:bg-zinc-200 px-3 py-1.5 rounded-full transition-colors"
          >
            {t.signup}
          </button>
          <button 
            className="text-white p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 bg-zinc-950 pt-24 px-6 transition-transform duration-300 ease-in-out md:hidden z-40 flex flex-col gap-6 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <a href="#" className="text-2xl font-medium hover:text-zinc-300 border-b border-white/5 pb-4">{t.showcase}</a>
        <a href="#" className="text-2xl font-medium hover:text-zinc-300 border-b border-white/5 pb-4">{t.create}</a>
        <a href="#" className="text-2xl font-medium hover:text-zinc-300 border-b border-white/5 pb-4">{t.library}</a>
        
        <div className="flex items-center justify-between py-2 mt-auto mb-8">
           <span className="text-zinc-500">Language / 语言</span>
           <button onClick={toggleLanguage} className="text-white font-bold flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-white/10">
              <Globe className="w-4 h-4" />
              {language === 'en' ? 'English' : '中文'}
           </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;