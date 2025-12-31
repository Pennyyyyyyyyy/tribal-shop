 // src/components/Header.jsx
import React from 'react';

function Header({ currentStep, totalSteps, cartCount, totalAmount }) {
  return (
    <header className="bg-green-700 text-white px-6 py-4 shadow-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🌲</span>
        <div>
          <h1 className="text-2xl font-bold tracking-wide">部落誠實商店</h1>
          <p className="text-xs text-green-100">Self Checkout Kiosk Prototype</p>
        </div>
      </div>
      <div className="flex flex-col items-end text-sm">
        <span className="opacity-80">Step {currentStep} / {totalSteps}</span>
        {cartCount > 0 && (
          <span className="mt-1 text-xs bg-green-900/40 px-3 py-1 rounded-full">
            🛒 購物車 {cartCount} 項 · ${totalAmount}
          </span>
        )}
      </div>
    </header>
  );
}

export default Header;

