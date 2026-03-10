import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import {
    CheckSquare, FolderKanban, CheckCircle2,
    FileText
} from 'lucide-react';
import type { ProjectTask } from '../types';

interface TaskWithProject extends ProjectTask {
    projects?: { name: string };
}

export const Tasks: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<TaskWithProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');

    useEffect(() => { if (user) fetchTasks(); }, [user]);

    const fetchTasks = async () => {
        setLoading(true);
        const STAGES = ['Sorting', 'Selection', 'Cropping', 'Coloring', 'Pixieset'];

        const { data } = await supabase
            .from('project_tasks')
            .select('*, projects(name)')
            .contains('assigned_to', [user!.id]);

        const sortedTasks = (data || []).sort((a: any, b: any) => {
            // First sort by Project Name (optional, but good for grouping)
            if (a.projects?.name !== b.projects?.name) {
                return (a.projects?.name || '').localeCompare(b.projects?.name || '');
            }
            // Then by Stage
            const stageA = STAGES.indexOf(a.stage_name);
            const stageB = STAGES.indexOf(b.stage_name);
            if (stageA !== stageB) return stageA - stageB;
            // Then by Day
            return (a.day_number || 0) - (b.day_number || 0);
        });

        setTasks(sortedTasks);
        setLoading(false);
    };

    const handleComplete = async (taskId: string) => {
        if (!user) return;
        if (!window.confirm("Are you sure you want to mark this task as done?")) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const currentDone = task.completed_by_workers || [];
        const iMarkedDone = currentDone.includes(user.id);
        let newDone: string[];

        if (iMarkedDone) {
            newDone = currentDone.filter(uid => uid !== user.id);
        } else {
            newDone = [...new Set([...currentDone, user.id])];
        }

        const allAssigned = task.assigned_to || [];
        const allDone = allAssigned.length > 0 && allAssigned.every(uid => newDone.includes(uid));

        const updates: Partial<ProjectTask> = {
            completed_by_workers: newDone,
            status: allDone ? 'completed' : 'pending',
        };
        if (allDone) updates.completed_at = new Date().toISOString();

        await supabase.from('project_tasks').update(updates).eq('id', taskId);
        fetchTasks();
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'all') return true;
        return t.status === filter;
    });

    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-accent-primary" />
                    My Tasks
                </h1>
                <div className="flex gap-2">
                    <Button
                        variant={filter === 'pending' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('pending')}
                    >
                        Pending ({pendingCount})
                    </Button>
                    <Button
                        variant={filter === 'completed' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('completed')}
                    >
                        Completed ({completedCount})
                    </Button>
                    <Button
                        variant={filter === 'all' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                    >
                        All ({tasks.length})
                    </Button>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-16 text-text-muted">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>{filter === 'pending' ? 'No pending tasks. You\'re all caught up!' : 'No tasks found.'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map((task, i) => {
                        const iMarkedDone = task.completed_by_workers?.includes(user!.id) || false;
                        return (
                            <div
                                key={task.id}
                                className={`flex items-center gap-4 p-4 rounded-xl glass transition-all duration-200 animate-fade-in ${task.status === 'completed' ? 'opacity-60' : ''
                                    }`}
                                style={{ animationDelay: `${i * 0.03}s` }}
                            >
                                <div className={`p-2 rounded-xl ${task.status === 'completed' ? 'bg-emerald-500/15' : 'bg-surface-hover'}`}>
                                    <FolderKanban className={`w-5 h-5 ${task.status === 'completed' ? 'text-emerald-400' : 'text-accent-primary'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-text-primary text-sm">{task.projects?.name || 'Unknown'}</p>
                                        <Badge variant={task.status === 'completed' ? 'success' : 'default'}>{task.stage_name}</Badge>
                                        {task.day_number && <Badge variant="secondary">Day {task.day_number}</Badge>}
                                    </div>
                                    {task.admin_note && (
                                        <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {task.admin_note}
                                        </p>
                                    )}
                                </div>
                                {task.status !== 'completed' && (
                                    <Button
                                        variant={iMarkedDone ? 'outline' : 'primary'}
                                        size="sm"
                                        onClick={() => handleComplete(task.id)}
                                    >
                                        {iMarkedDone ? '✓ Done' : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                                Complete
                                            </>
                                        )}
                                    </Button>
                                )}
                                {task.status === 'completed' && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
