export type UserRole = 'admin' | 'fulltime' | 'freelancer';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    phone?: string;
    bio?: string;
    avatar_url?: string;
    is_admin?: boolean; // Rigid security check
    created_at: string;
}

export interface Project {
    id: string;
    name: string;
    date: string;
    end_date?: string;
    date_text?: string;
    status: 'pending' | 'in_progress' | 'completed';
    google_sheet_id?: string;
    created_at: string;
}

export type TaskStage = 'Sorting' | 'Selection' | 'Cropping' | 'Coloring' | 'Pixieset';

export interface ProjectTask {
    id: string;
    project_id: string;
    stage_name: TaskStage;
    day_number?: number;
    assigned_to: string[]; // Array of user IDs
    admin_note?: string;
    worker_notes?: Record<string, string>; // Per-worker instructions: { userId: "note" }
    status: 'pending' | 'completed';
    completed_at?: string;
    completed_by?: string;
    completed_by_workers?: string[]; // Array of user IDs who marked their portion done
}

export type AttendanceStatus = 'office' | 'weekend_work' | 'weekend_off' | 'holiday' | 'til' | 'working_day';

export interface AttendanceLog {
    id: string;
    user_id: string;
    date: string;
    status_type: AttendanceStatus;
    work_note?: string;
    is_leave_request: boolean;
    leave_status: 'pending' | 'approved' | 'rejected';
    leave_reason?: string;
    created_at: string;
}
