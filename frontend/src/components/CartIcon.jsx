import React from "react";

export default function CartIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2F5D47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 4h2l2.5 11h11L21 8H6.5" />
      <circle cx="9" cy="19.5" r="1.5" />
      <circle cx="18" cy="19.5" r="1.5" />
    </svg>
  );
}
