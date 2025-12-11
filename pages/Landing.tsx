import React from 'react';
import { Wifi, Clock, Droplets, Smartphone } from 'lucide-react';

interface LandingProps {
  onNavigate: (route: string) => void;
}

export const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32 pt-20 px-4 sm:px-6">
            <main className="mt-10 mx-auto max-w-7xl sm:mt-12 md:mt-16 lg:mt-20 xl:mt-28">
              <div className="sm:text-center lg:text-left opacity-0 animate-slide-up">
                <h1 className="text-4xl tracking-tight font-extrabold text-slate-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Perfect Rice,</span>{' '}
                  <span className="block text-brand-600 xl:inline">Every Single Time.</span>
                </h1>
                <p className="mt-3 text-base text-slate-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0 transition-all hover:text-slate-600">
                  Control your cooking from anywhere. The QuickRice AI automatically adjusts water ratios and cooking times for over 50 varieties of rice.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start gap-4">
                  <div className="rounded-md shadow group">
                    <button
                      onClick={() => onNavigate('SIGNUP')}
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 md:py-4 md:text-lg transition-all transform group-hover:scale-105 group-active:scale-95 shadow-lg group-hover:shadow-brand-200"
                    >
                      Start Cooking Smart
                    </button>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3 group">
                    <button
                      onClick={() => onNavigate('LOGIN')}
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-brand-700 bg-brand-100 hover:bg-brand-200 md:py-4 md:text-lg transition-all transform group-hover:scale-105 group-active:scale-95"
                    >
                      Log In
                    </button>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 overflow-hidden">
          <img
            className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full animate-float shadow-2xl transform scale-105"
            src="https://hips.hearstapps.com/hmg-prod/images/del019924-sushi-rice-web-481-jg-index-67a80a467f954.jpg?crop=0.8891607203533809xw:1xh;center,top&resize=1200:*"
            alt="Smart Rice Cooker in modern kitchen"
          />
          <div className="absolute inset-0 bg-brand-900 mix-blend-multiply opacity-20 lg:opacity-10 pointer-events-none"></div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center opacity-0 animate-slide-up-delayed">
            <h2 className="text-base text-brand-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              A better way to cook
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {[
                {
                  name: 'Smart Dispensing',
                  description: 'Automatically dispenses the precise amount of rice and water needed for your selection.',
                  icon: Droplets,
                },
                {
                  name: 'Remote Control',
                  description: 'Start, stop, and schedule cooking from your office or on your way home.',
                  icon: Smartphone,
                },
                {
                  name: 'AI Powered',
                  description: 'Gemini AI analyzes grain types and environmental factors to adjust cooking curves.',
                  icon: Wifi,
                },
                {
                  name: 'Keep Warm Logic',
                  description: 'Learns your meal times and keeps rice warm and fresh.',
                  icon: Clock,
                },
              ].map((feature, index) => (
                <div 
                  key={feature.name} 
                  className="relative p-6 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 group border border-transparent hover:border-brand-100"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-xl bg-brand-500 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md">
                      <feature.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{feature.name}</p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-slate-500">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};