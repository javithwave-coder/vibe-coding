import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    addMonths, subMonths
} from 'date-fns';
import { parseLocalDate } from '../lib/utils';
import {
    ArrowLeft, Mail, Phone, FileText, CalendarDays,
    ChevronLeft, ChevronRight,
    Briefcase, Clock, CheckCircle2
} from 'lucide-react';
import type { UserProfile, AttendanceLog } from '../types';

// Status color map for attendance heatmap (Matched with Calendar.tsx)
const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    office: { label: 'Office Work', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    weekend_work: { label: 'Weekend Work', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    weekend_off: { label: 'Weekend Off', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    holiday: { label: 'Holiday', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    til: { label: 'Time in Lieu', bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    working_day: { label: 'Working Day', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export const EmployeeProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [emp, setEmp] = useState<UserProfile | null>(null);
    const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [completedTasks, setCompletedTasks] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Fetch profile, tasks, leaves once when employee id changes
    useEffect(() => { if (id) fetchEmployee(); }, [id]);

    // Fetch attendance separately whenever month changes
    useEffect(() => { if (id) fetchAttendance(); }, [id, currentMonth]);

    const fetchAttendance = async () => {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const { data: attData } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('user_id', id)
            .gte('date', start)
            .lte('date', end);
        setAttendance(attData || []);
    };

    const fetchEmployee = async () => {
        setLoading(true);
        try {
            // Profile
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', id).single();
            setEmp(profileData);

            // Attendance for selected month
            await fetchAttendance();

            // Active tasks
            const { data: taskData } = await supabase
                .from('project_tasks')
                .select('*, projects(name)')
                .contains('assigned_to', [id!])
                .eq('status', 'pending');
            setTasks(taskData || []);

            // Completed tasks
            const { data: completedData } = await supabase
                .from('project_tasks')
                .select('*, projects(name)')
                .contains('assigned_to', [id!])
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(10);
            setCompletedTasks(completedData || []);

            // Leave requests
            const { data: leaveData } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('user_id', id)
                .eq('is_leave_request', true)
                .order('date', { ascending: false })
                .limit(10);
            setLeaves(leaveData || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusDisplay = (log: AttendanceLog | undefined) => {
        if (!log) return null;

        if (log.is_leave_request) {
            if (log.leave_status === 'approved') {
                return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Holiday' };
            }
            if (log.leave_status === 'pending') {
                return { bg: 'bg-yellow-500/10', text: 'text-yellow-500/60', border: 'border-yellow-500/20', label: 'Pending' };
            }
            return null;
        }

        return statusConfig[log.status_type] || null;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (!emp) return (
        <div className="text-center py-16 text-text-muted">
            <p>Employee not found.</p>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
    );

    // Heatmap calendar
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Back Button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {/* Profile Header */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <Avatar name={emp.full_name} size="xl" src={emp.avatar_url} />
                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-2xl font-bold text-text-primary">{emp.full_name}</h1>
                            <Badge
                                variant={emp.role === 'fulltime' ? 'success' : 'warning'}
                                className="mt-2 capitalize"
                            >
                                {emp.role}
                            </Badge>
                            <div className="mt-4 space-y-1.5">
                                <p className="flex items-center gap-2 text-sm text-text-secondary justify-center sm:justify-start">
                                    <Mail className="w-4 h-4 text-text-muted" />
                                    {emp.email}
                                </p>
                                {emp.phone && (
                                    <p className="flex items-center gap-2 text-sm text-text-secondary justify-center sm:justify-start">
                                        <Phone className="w-4 h-4 text-text-muted" />
                                        {emp.phone}
                                    </p>
                                )}
                                {emp.bio && (
                                    <p className="flex items-center gap-2 text-sm text-text-muted justify-center sm:justify-start mt-2">
                                        <FileText className="w-4 h-4" />
                                        {emp.bio}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 flex-wrap justify-center">
                            <div className="p-4 rounded-xl glass text-center">
                                <p className="text-2xl font-bold text-accent-primary">{tasks.length}</p>
                                <p className="text-xs text-text-muted">Active Tasks</p>
                            </div>
                            <div className="p-4 rounded-xl glass text-center">
                                <p className="text-2xl font-bold text-emerald-400">{completedTasks.length}</p>
                                <p className="text-xs text-text-muted">Completed</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance Heatmap */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-accent-primary" />
                                Attendance — {format(currentMonth, 'MMMM yyyy')}
                            </CardTitle>
                            <button
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-3">
                            {emp?.role === 'freelancer' ? (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <div className="w-3 h-3 rounded bg-emerald-500/40" />
                                    <span className="text-text-muted">Working Day</span>
                                </div>
                            ) : (
                                Object.entries(statusConfig).filter(([k]) => k !== 'working_day').map(([key, cfg]) => (
                                    <div key={key} className="flex items-center gap-1.5 text-xs">
                                        <div className={`w-3 h-3 rounded ${cfg.bg}`} />
                                        <span className="text-text-muted">{cfg.label}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-xs font-semibold text-text-muted py-1">{d}</div>
                        ))}
                        {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const log = attendance.find(l => l.date === dateStr);
                            const statusDisplay = getStatusDisplay(log);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`
                                        aspect-square rounded-xl flex flex-col items-center justify-start p-1.5 transition-all duration-200 border relative group overflow-hidden cursor-default
                                        ${statusDisplay
                                            ? `${statusDisplay.bg} ${statusDisplay.border}`
                                            : 'border-transparent bg-white/[0.02]'}
                                    `}
                                    title={`${format(day, 'MMM d')}${log ? ` — ${log.status_type.replace('_', ' ')}` : ''}${log?.work_note ? `\n📝 ${log.work_note}` : ''}`}
                                >
                                    <span className={`text-xs font-medium w-full text-right ${statusDisplay ? statusDisplay.text : 'text-text-muted'}`}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Status Label in Cell */}
                                    <div className="mt-0.5 w-full text-[10px] text-left truncate leading-tight flex-1 flex items-center">
                                        {log?.is_leave_request && log.leave_status === 'approved' && (
                                            <span className="text-amber-400 font-medium block truncate w-full">Holiday</span>
                                        )}
                                        {log?.is_leave_request && log.leave_status === 'pending' && (
                                            <span className="text-yellow-500/50 italic block truncate w-full">Pending...</span>
                                        )}
                                        {log && !log.is_leave_request && emp.role === 'freelancer' && log.work_note ? (
                                            <span className={`${statusDisplay?.text || ''} opacity-90 block truncate w-full`}>
                                                {log.work_note}
                                            </span>
                                        ) : log && !log.is_leave_request && (
                                            <span className={`${statusDisplay?.text || ''} opacity-90 block truncate w-full`}>
                                                {statusConfig[log.status_type]?.label.split(' ')[0]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Tasks */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-accent-primary" />
                            Active Tasks ({tasks.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tasks.length === 0 ? (
                            <p className="text-sm text-text-muted text-center py-4">No active tasks.</p>
                        ) : (
                            <div className="space-y-2">
                                {tasks.map((task: any) => (
                                    <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50 border border-border-default">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                {task.projects?.name}
                                            </p>
                                            <Badge variant="default" className="mt-1">{task.stage_name}</Badge>
                                        </div>
                                        <Clock className="w-4 h-4 text-text-muted shrink-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Leave History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-amber-400" />
                            Leave History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {leaves.length === 0 ? (
                            <p className="text-sm text-text-muted text-center py-4">No leave requests.</p>
                        ) : (
                            <div className="space-y-2">
                                {leaves.map(leave => (
                                    <div key={leave.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50 border border-border-default">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-text-primary">
                                                {format(parseLocalDate(leave.date), 'MMM do, yyyy')}
                                            </p>
                                            <p className="text-xs text-text-muted truncate">{leave.leave_reason || 'No reason'}</p>
                                        </div>
                                        <Badge variant={
                                            leave.leave_status === 'approved' ? 'success' :
                                                leave.leave_status === 'rejected' ? 'danger' : 'warning'
                                        } className="capitalize shrink-0">
                                            {leave.leave_status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Work History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Completed Work History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {completedTasks.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-4">No completed tasks yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {completedTasks.map((task: any) => (
                                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50 border border-border-default">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                {task.projects?.name}
                                            </p>
                                            <Badge variant="success">{task.stage_name}</Badge>
                                        </div>
                                        {task.completed_at && (
                                            <p className="text-xs text-text-muted mt-0.5">
                                                {format(new Date(task.completed_at), 'MMM do, yyyy')}
                                            </p>
                                        )}
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
