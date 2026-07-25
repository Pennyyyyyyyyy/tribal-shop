// 登入狀態小 hook — 只暴露 token 存在與否、login()、logout()。
// 401 過期由 adminApi.js 內部處理（清 token），這裡的元件會在下次 render 察覺。
import { useCallback, useEffect, useState } from "react";
import * as api from "../service/adminApi";

export function useAdminAuth() {
    const [token, setToken] = useState(() => api.getToken());

    useEffect(() => {
        // 跨頁籤同步：另一分頁登出時，本分頁也跟著更新
        function onStorage(e) {
            if (e.key === "tribal_admin_token") setToken(e.newValue);
        }
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const login = useCallback(async (password) => {
        await api.login(password);
        setToken(api.getToken());
    }, []);

    const logout = useCallback(() => {
        api.logout();
        setToken(null);
    }, []);

    return { token, isAuthenticated: !!token, login, logout };
}
