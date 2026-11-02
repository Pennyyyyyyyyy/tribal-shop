// 後台共用的小元件（電腦版與手機版都用）
import React from "react";

export function ErrorBox({ message }) {
    return (
        <div role="alert" className="border-2 border-clay bg-peach rounded-2xl p-4">
            <div className="font-bold">無法載入資料</div>
            <div className="text-sm mt-1">{message}</div>
        </div>
    );
}

// 彈窗外框。手機上高度超過畫面時可在框內捲動。
export function ModalShell({ onClose, children, maxWidth = "max-w-sm" }) {
    return (
        <div className="fixed inset-0 bg-cocoa/50 flex items-center justify-center z-50 px-4 sm:px-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className={`panel shadow-press-lg w-full ${maxWidth} max-h-[90dvh] overflow-y-auto p-6 sm:p-7 text-ink`}
                onClick={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

export function ErrorLine({ children }) {
    return (
        <div role="alert" className="mt-3 text-[15px] border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5">
            {children}
        </div>
    );
}

export function FooterButtons({ onCancel, submitLabel, submitDisabled }) {
    return (
        <div className="mt-6 flex justify-end gap-2">
            <button
                type="button"
                onClick={onCancel}
                className="btn-ghost h-12 px-5 text-base"
            >
                取消
            </button>
            <button
                type="submit"
                disabled={submitDisabled}
                className="btn-press h-12 px-6 rounded-2xl shadow-press-sm bg-forest text-paper text-lg"
            >
                {submitLabel}
            </button>
        </div>
    );
}
