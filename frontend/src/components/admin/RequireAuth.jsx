import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";

// 保護 /admin/* 內頁：無 token 一律導回 /admin/login。
export default function RequireAuth({ children }) {
    const { isAuthenticated } = useAdminAuth();
    const location = useLocation();
    if (!isAuthenticated) {
        return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
    }
    return children;
}
