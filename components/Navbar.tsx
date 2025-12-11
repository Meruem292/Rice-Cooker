import React from 'react';
import { LogOut, Menu } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Logo } from './Logo';

interface NavbarProps {
  user: any;
  onNavigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onNavigate }) => {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onNavigate('LANDING');
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div 
            className="flex items-center cursor-pointer group" 
            onClick={() => onNavigate(user ? 'DASHBOARD' : 'LANDING')}
          >
            <div className="flex-shrink-0 flex items-center gap-2">
              <Logo className="h-10 w-10 transform group-hover:rotate-12 transition-transform duration-300" />
              <span className="font-bold text-xl text-slate-800 tracking-tight group-hover:text-brand-600 transition-colors">QuickRice</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!user ? (
              <>
                <button 
                  onClick={() => onNavigate('LOGIN')}
                  className="text-slate-600 hover:text-brand-600 font-medium px-3 py-2 text-sm transition-all hover:scale-105"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => onNavigate('SIGNUP')}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                >
                  Get Started
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 animate-fade-in">
                <span className="hidden md:block text-sm text-slate-500 font-medium">
                  {user.email}
                </span>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-all hover:scale-110 p-2 rounded-full hover:bg-slate-50"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};