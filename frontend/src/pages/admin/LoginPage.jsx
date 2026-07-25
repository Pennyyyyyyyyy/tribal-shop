import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";

export default function LoginPage() {
    const { isAuthenticated, login } = useAdminAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from || "/admin";

    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    if (isAuthenticated) {
        navigate(redirectTo, { replace: true });
        return null;
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!password || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await login(password);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            setError(err.message || "登入失敗");
            setSubmitting(false);
        }
    }

    return (
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
            <header className="bg-green-700 text-white px-6 py-3 shadow-md">
                <div>
                    <div className="text-base font-semibold tracking-wide">飛鼠商店 · 店長後台</div>
                    <div className="text-[11px] text-green-100 tracking-wider uppercase mt-0.5">
                        Flying Squirrel Shop · Admin
                    </div>
                </div>
            </header>

            <main className="flex-1 flex justify-center px-4 py-6 min-h-0">
                <div className="w-full max-w-md bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-6">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-slate-800">店長登入</h2>
                        <p className="text-sm text-slate-500 mt-1">請輸入管理密碼</p>
                    </div>

                    <form onSubmit={onSubmit} className="w-full space-y-4">
                        <input
                            type="password"
                            autoFocus
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="密碼"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-green-500 focus:outline-none text-base tracking-widest bg-white"
                        />

                        {error && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!password || submitting}
                            className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold tracking-wider shadow-md transition-colors"
                        >
                            {submitting ? "驗證中…" : "登入"}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
