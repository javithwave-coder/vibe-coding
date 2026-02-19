import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

import { syncProjectsFromSheet } from '../lib/googleSheets';
import {
    RefreshCw, FolderKanban, ArrowRight, Trash2, CheckCircle2, RotateCcw
} from 'lucide-react';
import type { Project } from '../types';

export const Projects: React.FC = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const isAdmin = profile?.role === 'admin' || profile?.is_admin;

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('projects')
            .select('*')
            .order('date', { ascending: true });
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
            alert('Sync failed.');
        } finally { setSyncing(false); }
    };

    const handleDelete = async (id: string) => {
        await supabase.from('project_tasks').delete().eq('project_id', id);
        await supabase.from('projects').delete().eq('id', id);
        setDeleteConfirm(null);
        fetchProjects();
    };

    const handleToggleComplete = async (id: string, current: string) => {
        const newStatus = current === 'completed' ? 'in_progress' : 'completed';

        if (current === 'completed') {
            // Reset all tasks for this project
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

    if (loading) return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
                {isAdmin && (
                    <Button variant="outline" size="sm" onClick={handleSync} isLoading={syncing}>
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                        Sync Sheets
                    </Button>
                )}
            </div>

            {/* Active Projects */}
            {active.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Active ({active.length})</h2>
                    {active.map((project, i) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            index={i}
                            isAdmin={!!isAdmin}
                            deleteConfirm={deleteConfirm}
                            onNavigate={() => navigate(`/projects/${project.id}`)}
                            onToggle={() => handleToggleComplete(project.id, project.status)}
                            onDelete={() => handleDelete(project.id)}
                            onDeleteConfirm={() => setDeleteConfirm(project.id)}
                        />
                    ))}
                </div>
            )}

            {/* Completed Projects */}
            {completed.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Completed ({completed.length})</h2>
                    {completed.map((project, i) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            index={i}
                            isAdmin={!!isAdmin}
                            deleteConfirm={deleteConfirm}
                            onNavigate={() => navigate(`/projects/${project.id}`)}
                            onToggle={() => handleToggleComplete(project.id, project.status)}
                            onDelete={() => handleDelete(project.id)}
                            onDeleteConfirm={() => setDeleteConfirm(project.id)}
                        />
                    ))}
                </div>
            )}

            {projects.length === 0 && (
                <div className="text-center py-16 text-text-muted">
                    <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No projects yet. {isAdmin ? 'Sync from Google Sheets to get started.' : 'Check back soon.'}</p>
                </div>
            )}
        </div>
    );
};

// ─── Project Card ───
const ProjectCard: React.FC<{
    project: Project;
    index: number;
    isAdmin: boolean;
    deleteConfirm: string | null;
    onNavigate: () => void;
    onToggle: () => void;
    onDelete: () => void;
    onDeleteConfirm: () => void;
}> = ({ project, index, isAdmin, deleteConfirm, onNavigate, onToggle, onDelete, onDeleteConfirm }) => (
    <div
        className="flex items-center gap-4 p-4 rounded-xl glass hover:glass-hover transition-all duration-200 cursor-pointer animate-fade-in group"
        style={{ animationDelay: `${index * 0.03}s` }}
        onClick={onNavigate}
    >
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-text-primary">{project.name}</h3>
                <Badge variant={project.status === 'completed' ? 'success' : project.status === 'in_progress' ? 'default' : 'secondary'}>
                    {project.status}
                </Badge>
            </div>
            <p className="text-xs text-text-muted mt-1">{project.date_text || project.date}</p>
        </div>

        {isAdmin && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                <Button variant="outline" size="sm" onClick={onToggle}>
                    {project.status === 'completed' ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                </Button>
                {deleteConfirm === project.id ? (
                    <Button variant="danger" size="sm" onClick={onDelete}>Confirm</Button>
                ) : (
                    <Button variant="ghost" size="sm" onClick={onDeleteConfirm}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                )}
            </div>
        )}

        <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
    </div>
);
