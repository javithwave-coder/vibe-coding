import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Project, ProjectTask, UserProfile, TaskStage } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { MultiSelect } from '../components/ui/MultiSelect';
import { format } from 'date-fns';
import {
    Loader2, CheckCircle2, Circle, Save, ArrowLeft,
    FileText, Calendar, Users, Clock, CheckCheck
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { parseDateRange } from '../lib/dateParsing';

const STAGES: TaskStage[] = ['Sorting', 'Selection', 'Cropping', 'Coloring', 'Pixieset'];

const stageIcons: Record<string, string> = {
    Sorting: '📂', Selection: '🔍', Cropping: '✂️', Coloring: '🎨', Pixieset: '☁️'
};

export const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin' || profile?.is_admin;

    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [activeDay, setActiveDay] = useState<number>(1);

    useEffect(() => {
        if (id) {
            fetchProjectData();
            if (isAdmin) fetchProfiles();
        }
    }, [id, isAdmin]);

    const fetchProjectData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            if (!id) return;
            const { data: projectData, error: projectError } = await supabase.from('projects').select('*').eq('id', id).single();
            if (projectError) throw projectError;
            setProject(projectData);

            const { data: taskData, error: taskError } = await supabase.from('project_tasks').select('*').eq('project_id', id);
            if (taskError) throw taskError;
            setTasks(taskData || []);
        } catch (error) {
            console.error('Error fetching project data:', error);
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*');
        setProfiles(data || []);
    };

    const handleTaskUpdate = async (stage: TaskStage, day: number, updates: Partial<ProjectTask>) => {
        if (!project) return;

        // Find specific task for this day and stage
        const existingTask = tasks.find(t => t.stage_name === stage && (t.day_number === day || (!t.day_number && day === 1)));

        try {
            if (existingTask) {
                const { error } = await supabase.from('project_tasks').update(updates).eq('id', existingTask.id);
                if (error) throw error;
                setTasks(prev => prev.map(t => t.id === existingTask.id ? { ...t, ...updates } : t));
            } else {
                const { data, error } = await supabase.from('project_tasks').insert([{
                    project_id: project.id,
                    stage_name: stage,
                    day_number: day,
                    assigned_to: updates.assigned_to || [],
                    admin_note: updates.admin_note || '',
                    worker_notes: updates.worker_notes || {},
                    status: updates.status || 'pending'
                }]).select();
                if (error) throw error;
                if (data) setTasks(prev => [...prev, ...data]);
            }
            fetchProjectData(false);
        } catch (err) {
            console.error("Failed to update task", err);
        }
    };

    // Admin: Mark entire project as done
    const handleMarkProjectDone = async () => {
        if (!project || !id) return;
        if (!confirm('Mark this entire project as done? All workflow stages will be completed.')) return;

        try {
            const now = new Date().toISOString();

            // 1. Update all existing tasks to completed
            if (tasks.length > 0) {
                const { error: tasksError } = await supabase
                    .from('project_tasks')
                    .update({ status: 'completed', completed_at: now })
                    .eq('project_id', id);
                if (tasksError) throw tasksError;
            }

            // 2. Create completed tasks for any missing stage/day combos
            const existingKeys = new Set(tasks.map(t => `${t.day_number || 1}-${t.stage_name}`));
            const missingTasks: any[] = [];
            for (let day = 1; day <= maxDays; day++) {
                for (const stage of STAGES) {
                    if (!existingKeys.has(`${day}-${stage}`)) {
                        missingTasks.push({
                            project_id: id,
                            stage_name: stage,
                            day_number: day,
                            assigned_to: [],
                            status: 'completed',
                            completed_at: now,
                        });
                    }
                }
            }
            if (missingTasks.length > 0) {
                const { error: insertError } = await supabase.from('project_tasks').insert(missingTasks);
                if (insertError) throw insertError;
            }

            // 3. Update project status to completed
            const { error: projError } = await supabase
                .from('projects')
                .update({ status: 'completed' })
                .eq('id', id);
            if (projError) throw projError;

            // Refresh
            fetchProjectData(false);
        } catch (err) {
            console.error('Failed to mark project done', err);
            alert('Failed to mark project as done.');
        }
    };

    // Admin: Undo mark project as done
    const handleUndoProjectDone = async () => {
        if (!project || !id) return;
        if (!confirm('Reopen this project? All stages will be set back to pending.')) return;

        try {
            const { error: tasksError } = await supabase
                .from('project_tasks')
                .update({ status: 'pending', completed_at: null })
                .eq('project_id', id);
            if (tasksError) throw tasksError;

            const { error: projError } = await supabase
                .from('projects')
                .update({ status: 'in_progress' })
                .eq('id', id);
            if (projError) throw projError;

            fetchProjectData(false);
        } catch (err) {
            console.error('Failed to undo project done', err);
        }
    };

    // Calculate max days from project date string OR tasks
    const maxDays = useMemo(() => {
        if (project?.date_text) {
            const parsed = parseDateRange(project.date_text);
            if (parsed?.dayCount) return parsed.dayCount;
        }

        // Fallback to task data
        if (tasks.length === 0) return 1;
        const days = tasks.map(t => t.day_number || 1);
        return Math.max(1, ...days);
    }, [tasks, project]);


    // Derived state for current view
    const currentDayTasks = useMemo(() => {
        return tasks.filter(t => (t.day_number || 1) === activeDay);
    }, [tasks, activeDay]);

    // Calculate progress for current day
    const dayProgress = useMemo(() => {
        if (STAGES.length === 0) return 0;
        const completedCount = currentDayTasks.filter(t => t.status === 'completed').length;
        return Math.round((completedCount / STAGES.length) * 100);
    }, [currentDayTasks]);

    // Calculate Total Project Progress
    const totalProgress = useMemo(() => {
        if (tasks.length === 0) return 0;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const totalExpected = STAGES.length * maxDays; // Approximation if sparse
        return totalExpected > 0 ? Math.round((completedCount / totalExpected) * 100) : 0;
    }, [tasks, maxDays]);


    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
            </div>
        );
    }

    if (!project) return (
        <div className="text-center py-16">
            <p className="text-text-muted">Project not found.</p>
            <Button variant="outline" onClick={() => navigate(isAdmin ? '/?tab=projects' : '/projects')} className="mt-4">Back to Projects</Button>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div>
                    <button
                        onClick={() => {
                            if (isAdmin) {
                                const target = project.status === 'completed'
                                    ? '/?tab=projects&filter=completed'
                                    : '/?tab=projects';
                                navigate(target);
                            } else {
                                navigate('/projects');
                            }
                        }}
                        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Projects
                    </button>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">{project.name}</h1>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                        <Badge variant={project.status === 'completed' ? 'success' : 'default'} className="capitalize">
                            {project.status.replace('_', ' ')}
                        </Badge>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover rounded-md">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                {project.date_text || format(new Date(project.date), 'MMM do, yyyy')}
                            </span>
                        </div>
                        {maxDays > 1 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover rounded-md">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{maxDays} Days Event</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover rounded-md">
                            <Users className="w-3.5 h-3.5" />
                            <span>{tasks.reduce((set, t) => { t.assigned_to?.forEach(u => set.add(u)); return set; }, new Set()).size} Workers</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Overall Progress Widget */}
                    <div className="bg-surface-elevated border border-border-default/50 rounded-2xl p-4 flex items-center gap-4 min-w-[200px]">
                        <div className="relative w-14 h-14 shrink-0">
                            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                                <circle
                                    cx="24" cy="24" r="20" fill="none"
                                    stroke="url(#progressGrad)" strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${totalProgress * 1.257} 125.7`}
                                    className="transition-all duration-700"
                                />
                                <defs>
                                    <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text-primary">
                                {totalProgress}%
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-text-primary">Overall Progress</p>
                            <p className="text-xs text-text-muted">{maxDays} Day{maxDays > 1 ? 's' : ''}</p>
                        </div>
                    </div>

                    {/* Admin: Mark Project Done Button */}
                    {isAdmin && (
                        project.status === 'completed' ? (
                            <button
                                onClick={handleUndoProjectDone}
                                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                title="Click to reopen this project"
                            >
                                <CheckCheck className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Done</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleMarkProjectDone}
                                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-surface-elevated border border-border-default/50 text-text-muted hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                                title="Mark entire project as done"
                            >
                                <CheckCheck className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Mark Done</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Day Tabs */}
            {maxDays > 1 && (
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                    {Array.from({ length: maxDays }, (_, i) => i + 1).map(day => (
                        <button
                            key={day}
                            onClick={() => setActiveDay(day)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                            ${activeDay === day
                                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                                    : 'bg-surface-hover text-text-muted hover:text-text-primary hover:bg-surface-elevated'}`}
                        >
                            <Calendar className="w-4 h-4" />
                            Day {day}
                        </button>
                    ))}
                </div>
            )}

            {/* Current Day Pipeline */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        {maxDays > 1 ? `Day ${activeDay} Workflow` : 'Project Workflow'}
                    </h2>
                    <span className="text-xs font-medium text-text-muted bg-surface-hover px-2 py-1 rounded-lg">
                        {dayProgress}% Complete
                    </span>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-4 pt-1 no-scrollbar">
                    {STAGES.map((stage, i) => {
                        const task = currentDayTasks.find(t => t.stage_name === stage);
                        const isDone = task?.status === 'completed';
                        const isPending = task && !isDone;
                        return (
                            <React.Fragment key={stage}>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all
                                    ${isDone ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : isPending ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            : 'bg-surface-hover text-text-muted border border-transparent'
                                    }`}>
                                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                    {stage}
                                </div>
                                {i < STAGES.length - 1 && (
                                    <div className="w-8 h-[2px] bg-surface-elevated shrink-0" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Stage Cards Grid */}
            <div className="grid gap-4">
                {STAGES.map((stage) => {
                    const task = currentDayTasks.find(t => t.stage_name === stage);
                    return (
                        <StageCard
                            key={`${activeDay}-${stage}`}
                            stage={stage}
                            task={task}
                            day={activeDay}
                            isAdmin={isAdmin || false}
                            profiles={profiles}
                            currentUserId={profile?.id}
                            onUpdate={(updates) => handleTaskUpdate(stage, activeDay, updates)}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════
//  STAGE CARD COMPONENT
// ═══════════════════════════════════════════════════
interface StageCardProps {
    stage: TaskStage;
    task?: ProjectTask;
    day: number;
    isAdmin: boolean;
    profiles: UserProfile[];
    currentUserId?: string;
    onUpdate: (updates: Partial<ProjectTask>) => void;
}

const StageCard: React.FC<StageCardProps> = ({ stage, task, day, isAdmin, profiles, currentUserId, onUpdate }) => {
    const isCompleted = task?.status === 'completed';
    // const isAssignedToMe = task?.assigned_to?.includes(currentUserId || ''); // Unused in new logic if not admin? No, used for view mode
    const iMarkedDone = task?.completed_by_workers?.includes(currentUserId || '') || false;

    // Local state for admin inputs
    const [note, setNote] = useState(task?.admin_note || '');
    const [assignedIds, setAssignedIds] = useState<string[]>(task?.assigned_to || []);
    const [workerNotes, setWorkerNotes] = useState<Record<string, string>>(task?.worker_notes || {});

    // Sync state when task changes (e.g. switching days)
    useEffect(() => {
        setNote(task?.admin_note || '');
        setAssignedIds(task?.assigned_to || []);
        setWorkerNotes(task?.worker_notes || {});
    }, [task]);

    const handleSaveAssignment = () => {
        onUpdate({
            assigned_to: assignedIds,
            admin_note: note,
            worker_notes: workerNotes,
            day_number: day
        });
    };

    const handleToggleComplete = () => {
        if (!currentUserId || !task) return;

        const currentDone = task.completed_by_workers || [];
        let newDone: string[];

        if (iMarkedDone) {
            // Unmark
            newDone = currentDone.filter(uid => uid !== currentUserId);
        } else {
            // Mark done
            newDone = [...new Set([...currentDone, currentUserId])];
        }

        const allAssigned = task.assigned_to || [];
        const isFullyDone = allAssigned.length > 0 && allAssigned.every(uid => newDone.includes(uid));

        const updates: Partial<ProjectTask> = {
            completed_by_workers: newDone,
            status: isFullyDone ? 'completed' : 'pending',
        };
        if (isFullyDone) updates.completed_at = new Date().toISOString();

        onUpdate(updates);
    };

    // Filter profiles for MultiSelect options
    const workerOptions = useMemo(() =>
        profiles.filter(p => p.role !== 'admin').map(p => ({
            value: p.id,
            label: p.full_name,
            avatar: p.avatar_url,
            subtitle: p.role
        })),
        [profiles]);

    // Sort profiles to put assigned ones first for display logic if needed, but MultiSelect handles that.

    // --- ADMIN VIEW ---
    if (isAdmin) {
        return (
            <Card className={`group transition-all duration-300 border-l-4 
                ${isCompleted ? 'border-l-emerald-500 bg-emerald-500/[0.02]' : 'border-l-accent-primary bg-surface-card'}`}>
                <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-default/40">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-ground flex items-center justify-center text-xl shadow-inner border border-white/5">
                                {stageIcons[stage]}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-text-primary">{stage}</h3>
                                <div className="flex items-center gap-2">
                                    {isCompleted ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            <CheckCircle2 className="w-3 h-3" /> Completed
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                            <Circle className="w-3 h-3" /> Pending
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button size="sm" onClick={handleSaveAssignment} className="shadow-lg shadow-accent-primary/20">
                            <Save className="w-4 h-4 mr-2" /> Save Changes
                        </Button>
                    </div>

                    {/* Admin Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* LEFT: Team & General Brief (5 cols) */}
                        <div className="md:col-span-5 space-y-4">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold uppercase text-text-muted mb-2">
                                    <Users className="w-3 h-3" /> Assign Team
                                </label>
                                <MultiSelect
                                    options={workerOptions}
                                    selected={assignedIds}
                                    onChange={setAssignedIds}
                                    placeholder="Select workers..."
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold uppercase text-text-muted mb-2">
                                    <FileText className="w-3 h-3" /> General Brief
                                </label>
                                <textarea
                                    className="w-full p-3 rounded-xl border border-border-default bg-surface-ground text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary/40 transition-all placeholder:text-text-muted/20 min-h-[80px]"
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Instructions for the whole team..."
                                />
                            </div>
                        </div>

                        {/* RIGHT: Individual Tasks (7 cols) */}
                        <div className="md:col-span-7 flex flex-col h-full">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase text-text-muted mb-2">
                                <CheckCircle2 className="w-3 h-3" /> Individual Tasks
                            </label>

                            <div className="flex-1 bg-surface-ground/50 rounded-xl border border-border-default/60 p-1">
                                {assignedIds.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-text-muted/40 py-8">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No workers assigned.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {assignedIds.map(uid => {
                                            const user = profiles.find(p => p.id === uid);
                                            if (!user) return null;
                                            const hasCompleted = task?.completed_by_workers?.includes(uid);

                                            return (
                                                <div key={uid} className="flex items-start gap-3 group animate-fade-in">
                                                    <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${hasCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    <Avatar name={user.full_name} size="sm" className="mt-0.5 border border-border-default" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-text-primary">{user.full_name}</span>
                                                            {hasCompleted && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">DONE</span>}
                                                        </div>
                                                        <textarea
                                                            className="w-full bg-surface-elevated border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-primary/50 placeholder:text-text-muted/30 resize-none"
                                                            rows={1}
                                                            placeholder={`Specific task for ${user.full_name.split(' ')[0]}...`}
                                                            value={workerNotes[uid] || ''}
                                                            onChange={(e) => setWorkerNotes(prev => ({ ...prev, [uid]: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // --- WORKER / VIEW ONLY ---
    // If not assigned to me and not admin, show minimal info
    // If assigned to me, show actions
    const isAssigned = task?.assigned_to?.includes(currentUserId || '');

    if (!isAssigned) {
        return (
            <Card className="opacity-60 border-l-4 border-l-transparent bg-surface-card/50">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl grayscale opacity-70">{stageIcons[stage]}</span>
                        <h3 className="text-base font-semibold text-text-muted">{stage}</h3>
                    </div>
                    <span className="text-xs italic text-text-muted">Not assigned to you</span>
                </CardContent>
            </Card>
        );
    }

    // WORKER VIEW
    const myNote = currentUserId ? task?.worker_notes?.[currentUserId] : null;

    return (
        <Card className={`border-l-4 transition-all duration-300 
            ${isCompleted ? 'border-l-emerald-500 bg-emerald-500/[0.02]' : 'border-l-accent-primary bg-surface-card'}`}>
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8">

                    {/* Left: Task Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-surface-ground flex items-center justify-center text-2xl shadow-inner border border-white/5">
                                {stageIcons[stage]}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-text-primary">{stage}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {isCompleted ? (
                                        <Badge variant="success">Completed</Badge>
                                    ) : (
                                        <Badge variant="default">Pending</Badge>
                                    )}
                                    {iMarkedDone && !isCompleted && (
                                        <span className="text-xs text-emerald-400 animate-pulse">• Waiting for others</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Instructions Section */}
                        <div className="space-y-3">
                            {/* Personal Note */}
                            {myNote && (
                                <div className="bg-accent-primary/10 border border-accent-primary/20 p-4 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-accent-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-accent-primary mb-1">
                                        <CheckCircle2 className="w-3 h-3" /> Your Instruction
                                    </h4>
                                    <p className="text-sm font-medium text-text-primary leading-relaxed">
                                        "{myNote}"
                                    </p>
                                </div>
                            )}

                            {/* General Note */}
                            {task?.admin_note && (
                                <div className="bg-surface-ground/50 border border-border-default/50 p-4 rounded-xl">
                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-text-muted mb-1">
                                        <FileText className="w-3 h-3" /> General Brief
                                    </h4>
                                    <p className="text-sm text-text-muted/80 leading-relaxed">
                                        {task.admin_note}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Teammates */}
                        {task?.assigned_to && task.assigned_to.length > 1 && (
                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-xs text-text-muted">Team:</span>
                                <div className="flex items-center -space-x-2 hover:space-x-1 transition-all">
                                    {task.assigned_to.map(uid => {
                                        if (uid === currentUserId) return null;
                                        const user = profiles.find(p => p.id === uid);
                                        const done = task.completed_by_workers?.includes(uid);
                                        return user ? (
                                            <div key={uid} className={`relative rounded-full border-2 border-surface-card transition-all ${done ? 'opacity-100 ring-2 ring-emerald-500/50' : 'opacity-70'}`} title={user.full_name}>
                                                <Avatar name={user.full_name} size="xs" />
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Action Button */}
                    <div className="w-full md:w-64 flex flex-col justify-center shrink-0 border-t md:border-t-0 md:border-l border-border-default/30 pt-4 md:pt-0 md:pl-8">
                        <Button
                            className={`w-full h-14 text-base font-bold shadow-xl transition-all duration-300
                                ${iMarkedDone
                                    ? 'bg-surface-elevated text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10'
                                    : 'bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-accent-primary/20 hover:scale-[1.02]'}`}
                            onClick={handleToggleComplete}
                        >
                            {iMarkedDone ? (
                                <>
                                    <CheckCircle2 className="w-6 h-6 mr-2" /> Completed
                                </>
                            ) : (
                                <>
                                    <Circle className="w-6 h-6 mr-2 opacity-50" /> Mark Done
                                </>
                            )}
                        </Button>
                        {iMarkedDone && (
                            <button onClick={handleToggleComplete} className="mt-3 text-xs text-text-muted hover:text-text-primary underline decoration-dotted transition-colors text-center">
                                Undo completion
                            </button>
                        )}
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};


