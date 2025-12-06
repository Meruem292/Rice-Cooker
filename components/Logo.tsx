import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Ring */}
    <circle cx="100" cy="100" r="95" stroke="#F5C857" strokeWidth="4" />
    <circle cx="100" cy="100" r="90" stroke="#3FA7BB" strokeWidth="2" />
    
    {/* Pot Handle Left */}
    <rect x="20" y="70" width="20" height="15" rx="5" fill="#E2852E" />
    {/* Pot Handle Right */}
    <rect x="160" y="70" width="20" height="15" rx="5" fill="#E2852E" />
    
    {/* Pot Body */}
    <path d="M40 70 L40 130 C40 160 60 175 100 175 C140 175 160 160 160 130 L160 70 Z" fill="#E2852E" />
    {/* Pot Shine */}
    <path d="M50 80 Q55 120 70 150" stroke="rgba(255,255,255,0.3)" strokeWidth="5" strokeLinecap="round" />
    
    {/* Lid */}
    <path d="M45 65 L155 65 C155 45 130 35 100 35 C70 35 45 45 45 65 Z" fill="#FFB74D" />
    <path d="M45 65 L155 65" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.5"/>
    {/* Lid Handle */}
    <rect x="85" y="25" width="30" height="10" rx="3" fill="#E2852E" />

    {/* Wifi Icon (Blue) */}
    <path d="M70 100 Q100 70 130 100" stroke="#328595" strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M80 110 Q100 90 120 110" stroke="#328595" strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M90 120 Q100 110 110 120" stroke="#328595" strokeWidth="6" strokeLinecap="round" fill="none" />
    
    {/* Water Drop (Yellow/White) */}
    <path d="M100 130 C100 130 85 145 85 155 C85 163 92 170 100 170 C108 170 115 163 115 155 C115 145 100 130 100 130 Z" fill="#FBBF24" stroke="white" strokeWidth="2" />
  </svg>
);
