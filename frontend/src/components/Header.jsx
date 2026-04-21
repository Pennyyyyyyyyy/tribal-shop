// src/components/Header.jsx
import React from 'react';
import AnnouncementMarquee from './AnnouncementMarquee';

function Header({ currentStep, totalSteps, cartCount, totalAmount }) {
  const progress = Math.round((currentStep / totalSteps) * 100);

  return (
    <header className="bg-green-700 text-white px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-3xl">🌲</span>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">飛鼠商店</h1>
            <p className="text-xs text-green-100">Flying Squirrel Shop</p>
          </div>
        </div>

        <AnnouncementMarquee />

        <div className="flex flex-col items-end text-sm gap-1 shrink-0">
          <span className="opacity-80 text-xs">步驟 {currentStep} / {totalSteps}</span>
          {cartCount > 0 && (
            <span className="text-xs bg-green-900/40 px-3 py-1 rounded-full">
              🛒 {cartCount} 項 · NT${totalAmount}
            </span>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 w-full bg-green-900/30 rounded-full h-1.5">
        <div
          className="bg-green-300 h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}

export default Header;
