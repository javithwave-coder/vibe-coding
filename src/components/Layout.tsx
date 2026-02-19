import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
    LayoutDashboard,
    FolderKanban,
    CalendarDays,
    UserCircle,
    LogOut,
    Menu,
    X,
    CheckSquare
} from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';

export const Layout: React.FC = () => {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const isAdmin = profile?.role === 'admin' || profile?.is_admin;

    const navItems = isAdmin ? [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/profile', icon: UserCircle, label: 'Profile' },
    ] : [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/projects', icon: FolderKanban, label: 'Projects' },
        { to: '/tasks', icon: CheckSquare, label: 'My Tasks' },
        { to: '/calendar', icon: CalendarDays, label: 'Attendance' },
        { to: '/profile', icon: UserCircle, label: 'Profile' },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-30 w-64
                    bg-surface-elevated/80 backdrop-blur-xl
                    border-r border-border-default
                    transform transition-transform duration-300 ease-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <div className="h-full flex flex-col">
                    {/* Brand */}
                    <div className="h-16 flex items-center px-6 border-b border-border-default">
                        <span className="text-xl font-bold text-gradient">
                            WLM Manager
                        </span>
                        <button
                            className="ml-auto lg:hidden text-text-muted hover:text-text-primary transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-6 space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => `
                                    flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200
                                    ${isActive
                                        ? 'bg-gradient-brand-subtle text-accent-primary glow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}
                                `}
                            >
                                <item.icon className="w-5 h-5 mr-3 shrink-0" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User Card */}
                    <div className="p-4 border-t border-border-default">
                        <div className="flex items-center gap-3 mb-4 px-1">
                            <Avatar name={profile?.full_name || 'User'} size="md" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                    {profile?.full_name || 'User'}
                                </p>
                                <p className="text-xs text-text-muted truncate capitalize">
                                    {profile?.role || 'Guest'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={handleSignOut}
                            size="sm"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden h-14 bg-surface-elevated/60 backdrop-blur-xl border-b border-border-default flex items-center px-4 sticky top-0 z-10">
                    <button
                        className="text-text-muted hover:text-text-primary transition-colors"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="ml-4 text-lg font-bold text-gradient">
                        WLM Manager
                    </span>
                </header>

                <main className="flex-1 overflow-auto p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
