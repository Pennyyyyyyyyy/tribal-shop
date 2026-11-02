// src/components/Header.jsx
import React from 'react';
import AnnouncementMarquee from './AnnouncementMarquee';
import BrandMark from './BrandMark';

function Header({ currentStep, totalSteps }) {
  const progress = Math.round((currentStep / totalSteps) * 100);

  return (
    <header className="flex items-center gap-7 bg-forest text-paper px-8 py-[18px] shrink-0">
      <BrandMark tone="light" />

      <AnnouncementMarquee />

      <div className="w-[180px] shrink-0 text-right">
        <div className="text-sm opacity-90 mb-2">步驟 {currentStep} / {totalSteps}</div>
        <div className="h-2.5 rounded-full bg-paper/25">
          <div
            className="h-full rounded-full bg-peach transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </header>
  );
}

export default Header;
