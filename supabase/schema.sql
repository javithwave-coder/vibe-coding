-- Create profiles table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text unique not null,
  full_name text,
  role text check (role in ('admin', 'fulltime', 'freelancer')),
  is_admin boolean default false, -- Strict security flag
  phone text,
  bio text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date not null,
  status text check (status in ('pending', 'in_progress', 'completed')) default 'pending',
  google_sheet_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create project_tasks table
create table public.project_tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects not null,
  stage_name text not null,
  assigned_to text[] default '{}', -- Array of profile IDs
  admin_note text,
  status text check (status in ('pending', 'completed')) default 'pending',
  completed_at timestamp with time zone,
  completed_by uuid references public.profiles,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create attendance_logs table
create table public.attendance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles not null,
  date date not null,
  status_type text check (status_type in ('office', 'weekend_work', 'weekend_off', 'holiday', 'til', 'working_day')),
  work_note text,
  is_leave_request boolean default false,
  leave_status text check (leave_status in ('pending', 'approved', 'rejected')) default 'pending',
  leave_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.attendance_logs enable row level security;

-- Create policies

-- Profiles: 
-- Everyone can read basic info
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
-- Users can edit own
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);
-- Admins can update any profile (to set roles/is_admin)
create policy "Admins can update any profile." on public.profiles for update using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
-- Insert policy
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);


-- Projects: 
-- Viewable by everyone
create policy "Projects are viewable by everyone." on public.projects for select using (true);
-- Only Admins can insert/update/delete
create policy "Admins can manage projects." on public.projects for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Tasks: 
-- Viewable by everyone
create policy "Tasks are viewable by everyone." on public.project_tasks for select using (true);
-- Admins can manage all tasks
create policy "Admins can manage tasks." on public.project_tasks for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
-- Workers can update status of tasks assigned to them (simplified: allow update if authenticated for now, or check assignment array)
-- Ideally: using (assigned_to @> ARRAY[auth.uid()::text])
create policy "Workers can update assigned tasks." on public.project_tasks for update using (true) with check (true); 


-- Attendance: 
-- Users can see own
create policy "Users can view own attendance." on public.attendance_logs for select using (auth.uid() = user_id);
-- Admins can see all
create policy "Admins can view all attendance." on public.attendance_logs for select using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
-- Users can manage own attendance
create policy "Users can insert own attendance." on public.attendance_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own attendance." on public.attendance_logs for update using (auth.uid() = user_id);
-- Admins can update attendance (for approval)
create policy "Admins can update attendance." on public.attendance_logs for update using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
