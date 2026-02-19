import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { syncProjectsFromSheet } from '../lib/googleSheets';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';

import {
    LayoutDashboard, FolderKanban, Users, CalendarDays, Trophy,
    RefreshCw, Trash2, CheckCircle2, RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import type { UserProfile, Project } from '../types';

// ═══════════════════════════════════════════════════
//  ADMIN DASHBOARD — Tabbed Command Center
// ═══════════════════════════════════════════════════
type Tab = 'overview' | 'projects' | 'employees' | 'leaves' | 'competitions';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { key: 'employees', label: 'Employees', icon: <Users className="w-4 h-4" /> },
    { key: 'leaves', label: 'Leave', icon: <CalendarDays className="w-4 h-4" /> },
    { key: 'competitions', label: 'Competitions', icon: <Trophy className="w-4 h-4" /> },
];

export const AdminDashboard: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as Tab) || 'overview';
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    // Sync tab with URL
    useEffect(() => {
        const tabList: Tab[] = ['overview', 'projects', 'employees', 'leaves', 'competitions'];
        const currentTab = searchParams.get('tab') as Tab;
        if (currentTab && tabList.includes(currentTab)) {
            setActiveTab(currentTab);
        }
    }, [searchParams]);

    const handleTabChange = (key: Tab) => {
        setActiveTab(key);
        setSearchParams({ tab: key });
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 rounded-2xl glass overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
                            ${activeTab === tab.key
                                ? 'bg-gradient-brand text-white shadow-lg shadow-indigo-500/20'
                                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in" key={activeTab}>
                {activeTab === 'overview' && <OverviewRedirect />}
                {activeTab === 'projects' && <ProjectManager />}
                {activeTab === 'employees' && <EmployeeTracker />}
                {activeTab === 'leaves' && <LeaveRequestsInbox />}
                {activeTab === 'competitions' && <UpcomingCompetitions />}
            </div>
        </div>
    );
};

// ─── Overview Redirect ───
import { AdminOverview } from './AdminOverview';
const OverviewRedirect: React.FC = () => <AdminOverview />;

// ═══════════════════════════════════════════════════
//  TAB 1: PROJECT MANAGER
// ═══════════════════════════════════════════════════
const ProjectManager: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Derive state from URL
    const showCompleted = searchParams.get('filter') === 'completed';

    const setShowCompleted = (show: boolean) => {
        const newParams = new URLSearchParams(searchParams);
        if (show) newParams.set('filter', 'completed');
        else newParams.delete('filter');
        setSearchParams(newParams);
    };

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        setLoading(true);
        const { data } = await supabase.from('projects').select('*').order('date', { ascending: true });
        setProjects(data || []);
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { count } = await syncProjectsFromSheet();
            alert(`Synced! Added ${count} new competitions.`);
            fetchProjects();
        } catch (e) {
            console.error(e);
            alert('Sync failed. Check console.');
        } finally { setSyncing(false); }
    };

    const handleDelete = async (id: string) => {
        await supabase.from('project_tasks').delete().eq('project_id', id);
        await supabase.from('projects').delete().eq('id', id);
        setDeleteConfirm(null);
        fetchProjects();
    };

    const handleToggleStatus = async (id: string, newStatus: string) => {
        if (newStatus === 'in_progress') {
            // Reset all tasks for this project when undoing completion
            await supabase.from('project_tasks').update({
                status: 'pending',
                completed_at: null,
                completed_by_workers: []
            }).eq('project_id', id);
        }

        await supabase.from('projects').update({ status: newStatus }).eq('id', id);
        fetchProjects();
    };

    const active = projects.filter(p => p.status !== 'completed');
    const completed = projects.filter(p => p.status === 'completed');
    const displayProjects = showCompleted ? completed : active;

    if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                    <Button
                        variant={!showCompleted ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setShowCompleted(false)}
                    >
                        Active ({active.length})
                    </Button>
                    <Button
                        variant={showCompleted ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setShowCompleted(true)}
                    >
                        Completed ({completed.length})
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleSync} isLoading={syncing}>
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Sheets
                </Button>
            </div>

            {displayProjects.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    <FolderKanban className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{showCompleted ? 'No completed projects yet.' : 'No active projects.'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayProjects.map((project, i) => (
                        <div
                            key={project.id}
                            className="flex items-center gap-4 p-4 rounded-xl glass hover:glass-hover transition-all duration-200 cursor-pointer animate-fade-in group"
                            style={{ animationDelay: `${i * 0.03}s` }}
                            onClick={() => navigate(`/projects/${project.id}`)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-text-primary">{project.name}</h4>
                                    <Badge variant={project.status === 'completed' ? 'success' : project.status === 'in_progress' ? 'default' : 'secondary'}>
                                        {project.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-text-muted mt-1">
                                    {project.date_text || project.date}
                                </p>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {project.status === 'completed' ? (
                                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(project.id, 'in_progress')}>
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(project.id, 'completed')}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                                {deleteConfirm === project.id ? (
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(project.id)}>
                                        Confirm
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(project.id)}>
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════
//  TAB 2: EMPLOYEE TRACKER — Card Grid
// ═══════════════════════════════════════════════════
const EmployeeTracker: React.FC = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchEmployees = async () => {
        const { data } = await supabase.from('profiles').select('*').neq('role', 'admin').order('full_name');
        setEmployees(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchEmployees(); }, []);

    const handleDeleteEmployee = async (id: string) => {
        try {
            const { error: attError } = await supabase.from('attendance_logs').delete().eq('user_id', id);
            if (attError) console.error('Attendance delete error:', attError);

            const { error: profileError } = await supabase.from('profiles').delete().eq('id', id);
            if (profileError) {
                console.error('Profile delete error:', profileError);
                alert(`Delete failed: ${profileError.message}`);
                return;
            }

            setDeleteConfirm(null);
            fetchEmployees();
        } catch (err: any) {
            console.error('Delete error:', err);
            alert(`Delete failed: ${err.message}`);
        }
    };

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
    );

    return (
        <div className="space-y-4">
            {employees.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No employees registered yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((emp, i) => (
                        <div
                            key={emp.id}
                            className="flex flex-col items-center p-6 rounded-2xl glass hover:glass-hover transition-all duration-200 cursor-pointer animate-fade-in group relative overflow-hidden"
                            style={{ animationDelay: `${i * 0.05}s` }}
                            onClick={() => navigate(`/employee/${emp.id}`)}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Delete button — top-right corner */}
                            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {deleteConfirm === emp.id ? (
                                    <div className="flex gap-1.5">
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteEmployee(emp.id)}>
                                            Delete
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(emp.id)}>
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </Button>
                                )}
                            </div>

                            <Avatar src={emp.avatar_url} name={emp.full_name} size="xl" className="mb-4 ring-4 ring-surface-elevated group-hover:scale-105 transition-transform duration-300" />

                            <h3 className="font-bold text-text-primary text-lg mb-1">{emp.full_name}</h3>
                            <p className="text-sm text-text-muted mb-3">{emp.email}</p>

                            <Badge variant={emp.role === 'fulltime' ? 'success' : 'warning'} className="capitalize px-3 py-1">
                                {emp.role}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════
//  TAB 3: LEAVE REQUESTS INBOX
// ═══════════════════════════════════════════════════
const LeaveRequestsInbox: React.FC = () => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchRequests(); }, []);

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('attendance_logs')
            .select('*, profiles(full_name, role)')
            .eq('is_leave_request', true)
            .eq('leave_status', 'pending')
            .order('date', { ascending: true });
        setRequests(data || []);
        setLoading(false);
    };

    const handleAction = async (id: string, action: 'approved' | 'rejected') => {
        await supabase.from('attendance_logs').update({ leave_status: action }).eq('id', id);
        fetchRequests();
    };

    if (loading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>;

    return (
        <div className="space-y-3">
            {requests.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">All caught up! No pending leave requests.</p>
                </div>
            ) : (
                requests.map((req, i) => (
                    <div
                        key={req.id}
                        className="flex items-center gap-4 p-4 rounded-xl glass animate-fade-in"
                        style={{ animationDelay: `${i * 0.03}s` }}
                    >
                        <Avatar name={req.profiles?.full_name || 'User'} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-text-primary text-sm">{req.profiles?.full_name}</p>
                                <Badge variant="secondary" className="capitalize">{req.profiles?.role}</Badge>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                                {format(new Date(req.date + 'T12:00:00'), 'MMM do, yyyy')}
                                {req.leave_reason && ` — ${req.leave_reason}`}
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                                onClick={() => handleAction(req.id, 'approved')}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleAction(req.id, 'rejected')}
                            >
                                Reject
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════
//  TAB 4: UPCOMING COMPETITIONS
// ═══════════════════════════════════════════════════
const UpcomingCompetitions: React.FC = () => {
    const [syncing, setSyncing] = useState(false);
    const [upcomingProjects, setUpcomingProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchUpcoming(); }, []);

    const fetchUpcoming = async () => {
        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('status', 'pending')
            .order('date', { ascending: true });
        setUpcomingProjects(data || []);
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { count } = await syncProjectsFromSheet();
            alert(`Sync Complete! Added ${count} new competitions.`);
            fetchUpcoming();
        } catch (e) {
            console.error(e);
            alert('Sync Failed. Check console.');
        } finally { setSyncing(false); }
    };

    if (loading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                    Synced from Google Sheet. Pending projects waiting to start.
                </p>
                <Button onClick={handleSync} isLoading={syncing} variant="outline" size="sm">
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                </Button>
            </div>

            {upcomingProjects.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                    <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No upcoming competitions found. Try syncing.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {upcomingProjects.map((p, i) => (
                        <div
                            key={p.id}
                            className="flex items-center justify-between p-4 rounded-xl glass hover:glass-hover transition-all duration-200 animate-fade-in"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <div>
                                <h4 className="font-semibold text-text-primary">{p.name}</h4>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {p.date_text || p.date}
                                </p>
                            </div>
                            <Badge variant="secondary">Pending</Badge>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
