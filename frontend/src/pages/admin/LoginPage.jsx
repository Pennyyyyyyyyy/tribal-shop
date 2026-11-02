import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import BrandMark from "../../components/BrandMark";

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
        <div className="min-h-screen bg-cream text-ink flex items-center justify-center px-4 py-12">
            <form
                onSubmit={onSubmit}
                className="panel w-full max-w-[440px] rounded-[28px] shadow-press-lg px-9 py-10 flex flex-col gap-[18px]"
            >
                <BrandMark subtitle="店長後台" />
                <h1 className="mt-4 font-display text-4xl">店長登入</h1>

                <label htmlFor="admin-pw" className="font-bold text-base">密碼</label>
                <input
                    id="admin-pw"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="請輸入管理密碼"
                    className="field"
                />

                {error && (
                    <div role="alert" className="border-2 border-clay bg-peach rounded-[14px] px-3.5 py-2.5 text-[15px]">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!password || submitting}
                    className="btn-press mt-1.5 h-[60px] bg-forest text-paper text-2xl"
                >
                    {submitting ? "驗證中…" : "登入"}
                </button>
            </form>
        </div>
    );
}
