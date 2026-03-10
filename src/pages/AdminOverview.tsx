import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';
import {
    Briefcase, Calendar, CheckCircle2, Clock, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { UserProfile, ProjectTask, AttendanceLog } from '../types';

export const AdminOverview: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [todayAttendance, setTodayAttendance] = useState<AttendanceLog[]>([]);
    const [chartProjects, setChartProjects] = useState<any[]>([]);
    const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

    useEffect(() => { fetchDashboardData(); }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');

            const { data: users } = await supabase.from('profiles').select('*');
            setEmployees(users || []);

            const { data: attendance } = await supabase
                .from('attendance_logs')
                .select('*, profiles(full_name, avatar_url, role)')
                .eq('date', todayStr);
            setTodayAttendance(attendance || []);

            const { data: leaves } = await supabase
                .from('attendance_logs')
                .select('*, profiles(full_name)')
                .eq('is_leave_request', true)
                .eq('leave_status', 'pending');
            setPendingLeaves(leaves || []);

            // 1. Fetch Active (non-completed)
            const { data: activeProjs } = await supabase
                .from('projects')
                .select('*')
                .neq('status', 'completed')
                .order('date', { ascending: true });

            // 2. Fetch Last 4 Completed
            const { data: completedProjs } = await supabase
                .from('projects')
                .select('*')
                .eq('status', 'completed')
                .order('date', { ascending: false }) // Newest first
                .limit(4);

            const allProjects = [...(activeProjs || []), ...(completedProjs || [])]; // Show Active first (top), then Completed (bottom)

            if (allProjects.length > 0) {
                const projectIds = allProjects.map(p => p.id);
                const { data: tasks } = await supabase
                    .from('project_tasks')
                    .select('*')
                    .in('project_id', projectIds);

                const projectStats = allProjects.map(p => {
                    const pTasks = (tasks || []).filter(t => t.project_id === p.id);
                    const total = pTasks.length;
                    const completedTasksArr = pTasks.filter(t => t.status === 'completed');
                    const completed = completedTasksArr.length;
                    const pendingTasksArr = pTasks.filter(t => t.status !== 'completed');
                    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                    const assigneeIds = new Set<string>();
                    pTasks.forEach((t: ProjectTask) => t.assigned_to?.forEach(id => assigneeIds.add(id)));

                    // Breakdown PENDING work by worker (Active Workload)
                    const pendingByWorker: Record<string, number> = {};
                    pendingTasksArr.forEach(t => {
                        const workers = t.assigned_to || [];
                        if (workers.length > 0) {
                            const workerId = workers[0];
                            pendingByWorker[workerId] = (pendingByWorker[workerId] || 0) + 1;
                        } else {
                            pendingByWorker['unassigned'] = (pendingByWorker['unassigned'] || 0) + 1;
                        }
                    });

                    const STAGES = ['Sorting', 'Selection', 'Cropping', 'Coloring', 'Pixieset'];

                    // All assigned tasks for this project
                    const assignedTasks = pTasks.filter(t => t.assigned_to && t.assigned_to.length > 0);
                    const sortedAssignedTasks = [...assignedTasks].sort((a, b) => {
                        const stageA = STAGES.indexOf(a.stage_name);
                        const stageB = STAGES.indexOf(b.stage_name);
                        if (stageA !== stageB) return stageA - stageB;
                        return (a.day_number || 0) - (b.day_number || 0);
                    });

                    const sortedPending = [...pendingTasksArr].sort((a, b) => {
                        const stageA = STAGES.indexOf(a.stage_name);
                        const stageB = STAGES.indexOf(b.stage_name);
                        if (stageA !== stageB) return stageA - stageB;
                        return (a.day_number || 0) - (b.day_number || 0);
                    });

                    return {
                        ...p, totalTasks: total, completedTasks: completed, progress,
                        assigneeIds: Array.from(assigneeIds),
                        currentStage: sortedPending.length > 0 ? sortedPending[0].stage_name : 'Completed',
                        pendingByWorker,
                        activeTasksList: sortedAssignedTasks
                    };
                });

                // Active = Assigned non-completed tasks. Keep only assigned active + the 4 completed ones.
                // Or just show all? The prompt said "show last 4 completed... and active".
                // I'll filter active ones to check for assignment, but KEEP the completed ones regardless.
                const finalStats = projectStats.filter(p => {
                    if (p.status === 'completed') return true;
                    // For active, check assignment
                    const pTasks = (tasks || []).filter(t => t.project_id === p.id);
                    return pTasks.some(t => t.assigned_to && t.assigned_to.length > 0);
                });

                setChartProjects(finalStats);
            } else {
                setChartProjects([]);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
                </div>
            </div>
        );
    }

    const officeStaff = todayAttendance.filter(a => a.status_type === 'office' || a.status_type === 'weekend_work' || a.status_type === 'working_day');
    const onLeave = todayAttendance.filter(a => a.is_leave_request && a.leave_status === 'approved');

    // Filter to only show active projects in the heavy details widget
    const activeDetailedProjects = chartProjects.filter((p: any) => p.status !== 'completed');

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold text-text-primary">Operations Overview</h2>
                <p className="text-text-muted text-sm mt-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(), 'EEEE, MMMM do, yyyy')}
                </p>
            </div>

            {/* Daily Operations Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* In Office */}
                <Card className="border-l-2 border-l-emerald-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                            In Office Today
                            <Badge variant="success">{officeStaff.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {officeStaff.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {officeStaff.map((log: any) => (
                                    <div key={log.id} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                                        <span className="text-xs font-medium text-emerald-300">
                                            {log.profiles?.full_name?.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-text-muted py-2">No one checked in yet.</p>
                        )}
                    </CardContent>
                </Card>

                {/* On Leave */}
                <Card className="border-l-2 border-l-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                            On Leave
                            <Badge variant="warning">{onLeave.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {onLeave.length > 0 ? (
                            <div className="space-y-2 mt-2">
                                {onLeave.map((log: any) => (
                                    <div key={log.id} className="flex items-center justify-between text-sm">
                                        <span className="text-text-primary">{log.profiles?.full_name}</span>
                                        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                            {log.leave_reason || 'Leave'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-text-muted py-2">No active leaves today.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Pending Requests */}
                <Card className="border-l-2 border-l-indigo-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                            Pending Requests
                            {pendingLeaves.length > 0 && <Badge variant="default">{pendingLeaves.length}</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pendingLeaves.length > 0 ? (
                            <div className="space-y-2 mt-2">
                                {pendingLeaves.slice(0, 3).map((req: any) => (
                                    <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover">
                                        <Avatar name={req.profiles?.full_name || 'U'} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-text-primary truncate">{req.profiles?.full_name}</p>
                                            <p className="text-xs text-text-muted">{format(new Date(req.date + 'T12:00:00'), 'MMM do')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-4 text-text-muted">
                                <CheckCircle2 className="w-8 h-8 mb-1 opacity-20" />
                                <p className="text-xs">All caught up!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Combined Active Operations Widget */}
            <Card className="border border-border-default/50 shadow-2xl shadow-indigo-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-accent-primary" />
                        Live Operations Breakdown
                    </CardTitle>
                    <p className="text-xs text-text-muted">
                        Real-time detailed view of active projects, assigned stages, and worker progress.
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                        {activeDetailedProjects.length > 0 ? (
                            activeDetailedProjects.map((project: any) => (
                                <div key={project.id} className="p-4 rounded-xl border border-border-default bg-surface-hover/30 hover:bg-surface-hover/50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-border-default/50 pb-3">
                                        <div>
                                            <h3 className="font-bold text-text-primary text-base cursor-pointer hover:text-accent-primary transition-colors" onClick={() => navigate(`/projects/${project.id}`)}>
                                                {project.name}
                                            </h3>
                                            <p className="text-xs text-text-muted mt-1">
                                                {project.totalTasks} Total Tasks • {new Date(project.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-1/3">
                                            <div className="w-full bg-surface-ground rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-gradient-brand h-full transition-all duration-500"
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-text-primary">{project.progress}%</span>
                                        </div>
                                    </div>

                                    {project.activeTasksList && project.activeTasksList.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {project.activeTasksList.map((task: any) => (
                                                <div key={task.id} className="flex flex-col p-3 rounded-lg bg-surface-card border border-border-default/40">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={task.status === 'completed' ? 'success' : 'default'} className="uppercase text-[10px] tracking-wider">
                                                                {task.stage_name}
                                                            </Badge>
                                                            {task.day_number && <span className="text-[10px] text-text-muted font-medium bg-surface-elevated px-1.5 py-0.5 rounded">Day {task.day_number}</span>}
                                                        </div>
                                                        {task.status === 'completed' ? (
                                                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                        ) : (
                                                            <Clock className="w-4 h-4 text-amber-500/80 animate-pulse-soft" />
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-1.5 mt-1">
                                                        {task.assigned_to.map((uid: string) => {
                                                            const emp = employees.find(e => e.id === uid);
                                                            if (!emp) return null;
                                                            const isDone = task.completed_by_workers?.includes(uid);
                                                            return (
                                                                <div key={uid} className="flex items-center justify-between bg-surface-ground/50 px-2 py-1.5 rounded-md">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar name={emp.full_name} src={emp.avatar_url} size="sm" className="w-5 h-5" />
                                                                        <span className="text-xs font-medium text-text-secondary">{emp.full_name.split(' ')[0]}</span>
                                                                    </div>
                                                                    {isDone ? (
                                                                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                                                            <CheckCircle2 className="w-3 h-3" /> Done
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-medium text-amber-500/70">
                                                                            Pending
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-text-muted italic py-2">No stages currently assigned to workers.</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-text-muted border-2 border-dashed border-border-default rounded-xl">
                                <Briefcase className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-sm">No active assignments.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Recently Completed Projects Grid */}
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-4">Recently Completed Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {chartProjects.filter((p: any) => p.status === 'completed').map((project: any, i) => (
                        <Card
                            key={project.id}
                            className="hover:glow-sm transition-all duration-300 cursor-pointer animate-fade-in opacity-80"
                            style={{ animationDelay: `${i * 0.05}s` }}
                            onClick={() => navigate(`/projects/${project.id}`)}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-text-primary text-lg">{project.name}</h3>
                                        <p className="text-xs text-text-muted mt-0.5">{project.totalTasks} tasks • {new Date(project.date).toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant="success">Done</Badge>
                                </div>

                                {/* Progress Bar is 100% */}
                                <div className="w-full bg-surface-ground rounded-full h-2.5 mb-4 overflow-hidden">
                                    <div className="bg-emerald-500 h-full w-full" />
                                </div>

                                <div className="flex justify-between items-end">
                                    <div className="flex -space-x-2">
                                        {project.assigneeIds.slice(0, 5).map((uid: string) => {
                                            const user = employees.find(e => e.id === uid);
                                            return user ? (
                                                <Avatar key={uid} name={user.full_name} src={user.avatar_url} size="sm" className="border-2 border-surface-ground" />
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {chartProjects.filter((p: any) => p.status === 'completed').length === 0 && (
                        <div className="col-span-full text-center py-12 text-text-muted border-2 border-dashed border-border-default rounded-2xl">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No completed projects yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
