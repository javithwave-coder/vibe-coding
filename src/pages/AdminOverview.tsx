import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Legend
} from 'recharts';
import {
    Briefcase, Calendar, CheckCircle2,
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

                    return {
                        ...p, totalTasks: total, completedTasks: completed, progress,
                        assigneeIds: Array.from(assigneeIds),
                        currentStage: pTasks.find(t => t.status === 'pending')?.stage_name || 'Completed',
                        pendingByWorker
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

    // Color Palette for Workers
    const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#06b6d4', '#8b5cf6'];
    const getWorkerColor = (index: number) => COLORS[index % COLORS.length];

    // Prepare chart data: Y=Project, X=Tasks (Stack: Completed + Worker A Pending + Worker B Pending...)
    const projectChartData = chartProjects.map(p => {
        const item: any = {
            name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
            completed: p.completedTasks,
            isCompleted: p.status === 'completed' // Flag for potential styling if needed
        };
        // Add worker specific PENDING counts
        Object.entries(p.pendingByWorker || {}).forEach(([workerId, count]) => {
            if (workerId === 'unassigned') return;
            const worker = employees.find(e => e.id === workerId);
            const key = worker ? worker.full_name.split(' ')[0] : 'Unknown';
            item[key] = (item[key] || 0) + (count as number);
        });
        return item;
    });

    // Identify all unique workers occurring in the data for Legend and Bar generation
    // Exclude 'isCompleted' from keys
    const allWorkers = Array.from(new Set(
        projectChartData.flatMap(item => Object.keys(item).filter(k => k !== 'name' && k !== 'completed' && k !== 'unassigned' && k !== 'isCompleted'))
    ));

    const chartTooltipStyle = {
        contentStyle: {
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(18,18,26,0.95)',
            backdropFilter: 'blur(12px)',
            color: '#f1f5f9',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        },
        itemStyle: { color: '#94a3b8' },
        labelStyle: { color: '#f1f5f9', fontWeight: 600 },
    };

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
                        Active Assignments & Progress
                    </CardTitle>
                    <p className="text-xs text-text-muted">
                        Real-time view of projects assigned to workers.
                        <span className="inline-block w-2 h-2 rounded-full bg-surface-hover ml-2 mr-1" /> Completed
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-2 mr-1" /> Pending (Worker)
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full mt-2">
                        {projectChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={projectChartData} barSize={24} margin={{ left: 10, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 13, fill: '#cbd5e1', fontWeight: 500 }} />
                                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} {...chartTooltipStyle} />
                                    <Legend wrapperStyle={{ color: '#94a3b8', paddingTop: '20px' }} iconType="circle" />

                                    {/* Completed Tasks (Base Layer) */}
                                    <Bar dataKey="completed" stackId="a" fill="#3f3f46" name="Done" radius={[0, 0, 0, 0]} />

                                    {/* Pending Tasks by Worker (Active Layer) */}
                                    {allWorkers.map((workerName, index) => (
                                        <Bar
                                            key={workerName}
                                            dataKey={workerName}
                                            stackId="a"
                                            fill={getWorkerColor(index)}
                                            radius={[0, 2, 2, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted">
                                <Briefcase className="w-12 h-12 mb-3 opacity-10" />
                                <p>No active assignments.</p>
                                <p className="text-xs mt-1 opacity-50">Assign tasks to workers to see them here.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Active Project Cards Grid */}
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-4">Active Project Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {chartProjects.filter((p: any) => p.status !== 'completed').map((project: any, i) => (
                        <Card
                            key={project.id}
                            className="hover:glow-sm transition-all duration-300 cursor-pointer animate-fade-in"
                            style={{ animationDelay: `${i * 0.05}s` }}
                            onClick={() => navigate(`/projects/${project.id}`)}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-text-primary text-lg">{project.name}</h3>
                                        <p className="text-xs text-text-muted mt-0.5">{project.totalTasks} tasks • {project.assigneeIds.length} workers</p>
                                    </div>
                                    <Badge variant={project.progress === 100 ? 'success' : 'default'}>
                                        {project.progress}%
                                    </Badge>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-surface-ground rounded-full h-2.5 mb-4 overflow-hidden">
                                    <div
                                        className="bg-gradient-brand h-full transition-all duration-500"
                                        style={{ width: `${project.progress}%` }}
                                    />
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase font-semibold mb-1">Current Stage</p>
                                        <Badge variant="secondary" className="bg-surface-elevated border-border-default">{project.currentStage}</Badge>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {project.assigneeIds.slice(0, 3).map((uid: string) => {
                                            const user = employees.find(e => e.id === uid);
                                            return user ? (
                                                <Avatar key={uid} name={user.full_name} size="sm" className="border-2 border-surface-ground" />
                                            ) : null;
                                        })}
                                        {project.assigneeIds.length > 3 && (
                                            <div className="w-8 h-8 rounded-full bg-surface-hover border-2 border-surface-ground flex items-center justify-center text-xs text-text-muted font-medium">
                                                +{project.assigneeIds.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {chartProjects.filter((p: any) => p.status !== 'completed').length === 0 && (
                        <div className="col-span-full text-center py-12 text-text-muted border-2 border-dashed border-border-default rounded-2xl">
                            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No active assigned projects.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
