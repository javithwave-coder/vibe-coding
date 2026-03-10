import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

import { Skeleton } from '../components/ui/Skeleton';
import {
    FolderKanban, CheckCircle2, Clock, CalendarDays,
    Loader2, ArrowRight, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { parseLocalDate } from '../lib/utils';
import type { ProjectTask, AttendanceLog } from '../types';
import { AdminDashboard } from './AdminDashboard';

interface TaskWithProject extends ProjectTask {
    projects?: { name: string };
}

export const Dashboard: React.FC = () => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin' || profile?.is_admin;

    if (!profile) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">
                    Welcome back, <span className="text-gradient">{profile.full_name.split(' ')[0]}</span>
                </h1>
                <p className="text-sm text-text-muted mt-1">
                    {format(new Date(), 'EEEE, MMMM do yyyy')}
                </p>
            </div>

            {isAdmin ? <AdminDashboard /> : <WorkerDashboard />}
        </div>
    );
};

// ═══════════════════════════════════════════════════
//  WORKER DASHBOARD
// ═══════════════════════════════════════════════════
const WorkerDashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<TaskWithProject[]>([]);
    const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
    const [pendingLeaves, setPendingLeaves] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const STAGES = ['Sorting', 'Selection', 'Cropping', 'Coloring', 'Pixieset'];

            // Assigned tasks
            const { data: taskData } = await supabase
                .from('project_tasks')
                .select('*, projects(name)')
                .contains('assigned_to', [user!.id])
                .eq('status', 'pending');

            // Filter out tasks already completed by THIS user
            const activeTasks = (taskData || []).filter(t =>
                !t.completed_by_workers?.includes(user!.id)
            );

            const sortedTasks = activeTasks.sort((a: any, b: any) => {
                const stageA = STAGES.indexOf(a.stage_name);
                const stageB = STAGES.indexOf(b.stage_name);
                if (stageA !== stageB) return stageA - stageB;
                return (a.day_number || 0) - (b.day_number || 0);
            });

            setTasks(sortedTasks);

            // Today's attendance
            const { data: attData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('user_id', user!.id)
                .eq('date', today)
                .eq('is_leave_request', false)
                .maybeSingle();
            setTodayLog(attData);

            // Pending leave requests
            const { data: leaveData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('user_id', user!.id)
                .eq('is_leave_request', true)
                .eq('leave_status', 'pending')
                .order('date', { ascending: true });
            setPendingLeaves(leaveData || []);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteTask = async (taskId: string) => {
        if (!user) return;
        if (!window.confirm("Are you sure you want to mark this task as done?")) return;

        // Optimistic update
        const taskToUpdate = tasks.find(t => t.id === taskId);
        if (!taskToUpdate) return;

        // 1. Calculate new state locally first
        const currentDone = taskToUpdate.completed_by_workers || [];
        const newDone = [...new Set([...currentDone, user.id])];

        const allAssigned = taskToUpdate.assigned_to || [];
        const isFullyDone = allAssigned.length > 0 && allAssigned.every(uid => newDone.includes(uid));

        // 2. Update DB
        const updates: Partial<ProjectTask> = {
            completed_by_workers: newDone,
            status: isFullyDone ? 'completed' : 'pending',
        };
        if (isFullyDone) updates.completed_at = new Date().toISOString();

        const { error } = await supabase
            .from('project_tasks')
            .update(updates)
            .eq('id', taskId);

        if (!error) {
            // Remove from local list as it's done for THIS user
            setTasks(prev => prev.filter(t => t.id !== taskId));
        }
    };

    if (loading) {
        return (
            <div className="grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
        );
    }

    const isFreelancer = profile?.role === 'freelancer';
    const activeTasks = tasks.filter(t => t.status === 'pending');
    const statusLabel = todayLog
        ? todayLog.status_type.replace('_', ' ')
        : 'Not marked';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<FolderKanban className="w-5 h-5 text-indigo-400" />}
                    value={activeTasks.length}
                    label="Active Tasks"
                />
                <StatCard
                    icon={<CalendarDays className="w-5 h-5 text-emerald-400" />}
                    value={statusLabel}
                    label="Today's Status"
                />
                <StatCard
                    icon={<Clock className="w-5 h-5 text-amber-400" />}
                    value={pendingLeaves.length}
                    label="Pending Leaves"
                />
                <StatCard
                    icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
                    value={isFreelancer ? 'Freelancer' : 'Full-Time'}
                    label="Role"
                />
            </div>

            {/* Active Tasks */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FolderKanban className="w-5 h-5 text-accent-primary" />
                            My Active Tasks
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
                            View All <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {activeTasks.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle2 className="w-10 h-10 text-text-muted/30 mx-auto mb-2" />
                            <p className="text-sm text-text-muted">No pending tasks. You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTasks.map((task, index) => (
                                <div
                                    key={task.id}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-hover/50 border border-border-default hover:border-border-hover transition-all duration-200 animate-fade-in"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-text-primary text-sm">
                                                {task.projects?.name || 'Unknown Project'}
                                            </span>
                                            <Badge variant="default">{task.stage_name}</Badge>
                                            {task.day_number && <Badge variant="secondary">Day {task.day_number}</Badge>}
                                        </div>
                                        {task.admin_note && (
                                            <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                                                <FileText className="w-3 h-3" />
                                                {task.admin_note}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCompleteTask(task.id)}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1" />
                                        Done
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Leave Requests */}
            {pendingLeaves.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-400" />
                            Pending Leave Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {pendingLeaves.map(leave => (
                                <div key={leave.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                    <div>
                                        <p className="text-sm font-medium text-text-primary">
                                            {format(parseLocalDate(leave.date), 'MMM do, yyyy')}
                                        </p>
                                        <p className="text-xs text-text-muted">{leave.leave_reason || 'No reason given'}</p>
                                    </div>
                                    <Badge variant="warning">Pending</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ─── Stat Card ───
const StatCard: React.FC<{
    icon: React.ReactNode;
    value: string | number;
    label: string;
}> = ({ icon, value, label }) => (
    <Card className="hover:glow-sm transition-all duration-300">
        <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface-hover">{icon}</div>
            <div>
                <div className="text-lg font-bold text-text-primary capitalize">{value}</div>
                <div className="text-xs text-text-muted">{label}</div>
            </div>
        </CardContent>
    </Card>
);
