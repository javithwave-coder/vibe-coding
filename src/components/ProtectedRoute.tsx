import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-border-default border-t-accent-primary animate-spin" />
                </div>
                <p className="text-sm text-text-muted animate-pulse-soft">Loading...</p>
            </div>
        );
    }

    return user ? <Outlet /> : <Navigate to="/login" replace />;
};
