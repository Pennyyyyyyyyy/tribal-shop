// 後台共用的小元件（電腦版與手機版都用）
import React, { useState } from "react";
import * as api from "../../service/adminApi";

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

// 總覽頁低庫存：點品項直接改庫存數量（電腦版與手機版共用）
// 送出的是「新的庫存總數」，不是增減量
export function StockModal({ product, onClose, onSaved }) {
    const [value, setValue] = useState(String(product.stock ?? 0));
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const num = Number(value);
    const valid = value.trim() !== "" && Number.isInteger(num) && num >= 0;
    const step = delta => setValue(v => String(Math.max(0, (Number(v) || 0) + delta)));

    async function submit(e) {
        e.preventDefault();
        if (!valid) return;
        if (num === product.stock) { onClose(); return; }
        setBusy(true);
        setError(null);
        try {
            await api.products.update(product.id, { stock: num });
            onSaved();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    const stepBtn = "btn-ghost w-14 h-14 shrink-0 text-2xl font-display";

    return (
        <ModalShell onClose={onClose}>
            <form onSubmit={submit}>
                <h3 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">修改庫存</h3>
                <div className="flex items-center gap-3 mt-5">
                    {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-12 h-12 object-cover rounded-[10px] bg-cream" />
                    ) : (
                        <div className="w-12 h-12 rounded-[10px] bg-sand" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                        <div className="font-bold text-lg truncate">{product.name}</div>
                        <div className="text-sm tabular-nums">目前庫存 {product.stock}</div>
                    </div>
                </div>

                <label htmlFor="stock-input" className="block mt-5 mb-1.5 text-[15px] font-bold">新的庫存數量</label>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => step(-1)} aria-label="減 1" className={stepBtn}>−</button>
                    <input
                        id="stock-input"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onFocus={e => e.target.select()}
                        autoFocus
                        className="field h-14 flex-1 min-w-0 text-center text-2xl font-display tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button type="button" onClick={() => step(1)} aria-label="加 1" className={stepBtn}>+</button>
                </div>
                <div className="flex gap-2 mt-3">
                    {[3, 5, 10].map(n => (
                        <button key={n} type="button" onClick={() => step(n)} className="btn-ghost h-11 flex-1 text-base tabular-nums">
                            +{n}
                        </button>
                    ))}
                </div>

                {!valid && <ErrorLine>請輸入 0 以上的整數</ErrorLine>}
                {error && <ErrorLine>{error}</ErrorLine>}
                <FooterButtons onCancel={onClose} submitLabel={busy ? "儲存中…" : "儲存"} submitDisabled={busy || !valid} />
            </form>
        </ModalShell>
    );
}
