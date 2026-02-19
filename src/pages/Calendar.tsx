import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    isSameDay, addMonths, subMonths, isToday
} from 'date-fns';
import {
    ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import { parseLocalDate } from '../lib/utils';
import type { AttendanceLog, AttendanceStatus } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Status color map
const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    office: { label: 'Office Work', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    weekend_work: { label: 'Weekend Work', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    weekend_off: { label: 'Weekend Off', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    holiday: { label: 'Holiday', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    til: { label: 'Time in Lieu', bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    working_day: { label: 'Working Day', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export const Calendar: React.FC = () => {
    const { user, profile } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectDates, setProjectDates] = useState<Record<string, string[]>>({});

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [statusType, setStatusType] = useState<AttendanceStatus>('office');
    const [note, setNote] = useState('');
    const [isLeave, setIsLeave] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [noteError, setNoteError] = useState('');

    const isFreelancer = profile?.role === 'freelancer';

    // ─── Fetch Data ───
    useEffect(() => {
        if (user) {
            fetchLogs();
            fetchProjectDates();
        }
    }, [user, currentMonth]);

    const fetchLogs = async () => {
        setLoading(true);
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

        const { data } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('user_id', user!.id)
            .gte('date', start)
            .lte('date', end);

        setLogs(data || []);
        setLoading(false);
    };

    const fetchProjectDates = async () => {
        const { data } = await supabase.from('projects').select('name, date, end_date');
        if (!data) return;

        const dateMap: Record<string, string[]> = {};
        data.forEach((p: any) => {
            if (!p.date) return;

            const addToDate = (dateStr: string) => {
                if (!dateMap[dateStr]) dateMap[dateStr] = [];
                dateMap[dateStr].push(p.name);
            };

            if (p.end_date && p.end_date !== p.date) {
                const sd = parseLocalDate(p.date);
                const ed = parseLocalDate(p.end_date);
                const days = eachDayOfInterval({ start: sd, end: ed });
                days.forEach(d => addToDate(format(d, 'yyyy-MM-dd')));
            } else {
                addToDate(p.date);
            }
        });
        setProjectDates(dateMap);
    };

    // ─── Calendar Grid ───
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const emptySlots = Array.from({ length: startDayOfWeek });

    // ─── Date Click ───
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setNoteError('');
        const existingLog = logs.find(log => isSameDay(parseLocalDate(log.date), date));

        if (existingLog) {
            setStatusType(existingLog.status_type);
            setNote(existingLog.work_note || '');
            setIsLeave(existingLog.is_leave_request);
        } else {
            setStatusType(isFreelancer ? 'working_day' : 'office');
            setNote('');
            setIsLeave(false);
        }
        setIsModalOpen(true);
    };

    // ─── Save ───
    const handleSave = async () => {
        if (!user || !selectedDate) return;

        // Freelancer mandatory note validation
        if (isFreelancer && !isLeave && !note.trim()) {
            setNoteError('Work note is required for freelancers. Please describe what work was done.');
            return;
        }

        setIsSaving(true);
        setNoteError('');
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const payload = {
            user_id: user.id,
            date: dateStr,
            status_type: isFreelancer ? 'working_day' : statusType,
            work_note: note,
            is_leave_request: isLeave,
            leave_status: isLeave ? 'pending' : 'pending',
            leave_reason: isLeave ? note : null,
        };

        const existing = logs.find(log => log.date === dateStr);

        if (existing) {
            await supabase.from('attendance_logs').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('attendance_logs').insert([payload]);
        }

        setIsModalOpen(false);
        setIsSaving(false);
        fetchLogs();
    };

    // ─── Get Status Display ───
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

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <CalendarDays className="w-6 h-6 text-accent-primary" />
                    Attendance
                </h1>
                <Badge variant={isFreelancer ? 'warning' : 'success'} className="capitalize">
                    {isFreelancer ? 'Freelancer' : 'Full-Time'}
                </Badge>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                {isFreelancer ? (
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
                <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded bg-red-500/30" />
                    <span className="text-text-muted">Leave</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-text-muted">Competition</span>
                </div>
            </div>

            {/* Calendar Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <CardTitle className="text-center">
                            {format(currentMonth, 'MMMM yyyy')}
                        </CardTitle>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                        </div>
                    ) : (
                        <>
                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {WEEKDAYS.map(d => (
                                    <div key={d} className="text-center text-xs font-semibold text-text-muted py-1">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Day Grid */}
                            <div className="grid grid-cols-7 gap-2">
                                {/* Empty slots */}
                                {emptySlots.map((_, i) => <div key={`e-${i}`} />)}

                                {/* Days */}
                                {days.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const log = logs.find(l => l.date === dateStr);
                                    const statusDisplay = getStatusDisplay(log);
                                    const projectsOnDay = projectDates[dateStr] || [];
                                    const hasCompetition = projectsOnDay.length > 0;
                                    const today = isToday(day);

                                    return (
                                        <button
                                            key={day.toISOString()}
                                            onClick={() => handleDateClick(day)}
                                            className={`
                                                aspect-square rounded-xl flex flex-col items-center justify-start p-1.5 sm:p-2 transition-all duration-200 border relative group
                                                ${statusDisplay
                                                    ? `${statusDisplay.bg} ${statusDisplay.border}`
                                                    : 'border-transparent hover:bg-surface-hover hover:border-border-hover'}
                                                ${today ? 'ring-1 ring-accent-primary/40' : ''}
                                                ${hasCompetition ? 'ring-1 ring-purple-500/30' : ''}
                                            `}
                                        >
                                            <div className="flex w-full justify-between items-start">
                                                <span className={`text-xs sm:text-sm font-medium ${today ? 'text-accent-primary' :
                                                    statusDisplay ? statusDisplay.text : 'text-text-secondary'
                                                    }`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {hasCompetition && (
                                                    <div className="flex gap-0.5" title={projectsOnDay.join(', ')}>
                                                        {projectsOnDay.map((_, i) => (
                                                            <span key={i} className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Status Label */}
                                            <div className="mt-0.5 w-full text-[10px] text-left truncate">
                                                {log?.is_leave_request && log.leave_status === 'approved' && (
                                                    <span className="text-amber-400 font-medium">Holiday</span>
                                                )}
                                                {log?.is_leave_request && log.leave_status === 'pending' && (
                                                    <span className="text-yellow-500/50 italic">Pending...</span>
                                                )}
                                                {log && !log.is_leave_request && (
                                                    <span className={`${statusDisplay?.text || ''} opacity-80`}>
                                                        {statusConfig[log.status_type]?.label || log.status_type.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ─── Attendance Modal ─── */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedDate ? format(selectedDate, 'EEEE, MMM do yyyy') : ''}
                size="sm"
            >
                {/* Competition Info */}
                {selectedDate && (() => {
                    const dateStr = format(selectedDate, 'yyyy-MM-dd');
                    const projects = projectDates[dateStr];
                    if (!projects || projects.length === 0) return null;
                    return (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4">
                            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">
                                Competitions
                            </p>
                            <ul className="space-y-0.5">
                                {projects.map((name, idx) => (
                                    <li key={idx} className="text-sm text-purple-300">{name}</li>
                                ))}
                            </ul>
                        </div>
                    );
                })()}

                {/* Status Selection */}
                {!isLeave && (
                    <div className="space-y-3 mb-4">
                        <label className="block text-sm font-medium text-text-secondary">Set Status</label>
                        {isFreelancer ? (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                                💼 Working Day (Freelancer)
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { val: 'office', label: 'Office Work', emoji: '🏢' },
                                    { val: 'weekend_work', label: 'Weekend Work', emoji: '🛠️' },
                                    { val: 'weekend_off', label: 'Weekend Off', emoji: '🏠' },
                                    { val: 'holiday', label: 'Holiday', emoji: '🎉' },
                                    { val: 'til', label: 'Time in Lieu', emoji: '⏲️' },
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setStatusType(opt.val as AttendanceStatus)}
                                        className={`
                                            p-2.5 rounded-xl border text-sm flex items-center gap-2 transition-all duration-200
                                            ${statusType === opt.val
                                                ? 'border-accent-primary/50 bg-gradient-brand-subtle glow-sm text-accent-primary font-medium'
                                                : 'border-border-default bg-transparent text-text-secondary hover:bg-surface-hover hover:border-border-hover'}
                                        `}
                                    >
                                        <span>{opt.emoji}</span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Leave Toggle */}
                <div className="flex items-center gap-3 py-3 border-t border-b border-border-default mb-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isLeave}
                            onChange={(e) => {
                                setIsLeave(e.target.checked);
                                setNoteError('');
                                if (e.target.checked && !isFreelancer) setStatusType('weekend_off');
                            }}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 peer-focus:ring-2 peer-focus:ring-accent-primary/40 rounded-full peer peer-checked:bg-accent-primary transition-all">
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isLeave ? 'translate-x-4' : ''}`} />
                        </div>
                    </label>
                    <span className="text-sm font-medium text-text-secondary select-none">
                        This is a Leave Request
                    </span>
                </div>

                {/* Notes / Reason */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        {isLeave ? 'Reason' : (isFreelancer ? 'Work Note (Required)' : 'Notes')}
                        {isFreelancer && !isLeave && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <textarea
                        className={`w-full p-3 rounded-xl border bg-white/[0.03] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 transition-all duration-200 min-h-[80px] resize-none ${noteError
                            ? 'border-red-500/50 focus:ring-red-500/40'
                            : 'border-border-default focus:ring-accent-primary/40 focus:border-accent-primary/50'
                            }`}
                        value={note}
                        onChange={(e) => { setNote(e.target.value); setNoteError(''); }}
                        placeholder={
                            isLeave
                                ? 'E.g. Sick leave, Personal...'
                                : isFreelancer
                                    ? 'Describe the work done today... (e.g. Edited 500 photos for Colombo Cup)'
                                    : 'Optional work notes...'
                        }
                    />
                    {noteError && (
                        <p className="mt-1.5 text-xs text-red-400 font-medium animate-slide-down">{noteError}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button className="flex-1" variant="outline" onClick={() => setIsModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSave} isLoading={isSaving}>
                        Save Status
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
