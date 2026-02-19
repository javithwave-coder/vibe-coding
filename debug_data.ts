
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
let envConfig: Record<string, string> = {};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim();
        }
    });
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDashboardData() {
    console.log('--- Debugging Dashboard Data ---');

    // 1. Check Projects
    const { data: projects, error: pError } = await supabase
        .from('projects')
        .select('id, name, status');

    if (pError) {
        console.error('Error fetching projects:', pError);
    } else {
        console.log(`Found ${projects?.length || 0} projects:`);
        projects?.forEach(p => console.log(` - [${p.status}] ${p.name}`));
    }

    // 2. Check Tasks
    const { data: tasks, error: tError } = await supabase
        .from('project_tasks')
        .select('id, stage_name, status, project_id');

    if (tError) {
        console.error('Error fetching tasks:', tError);
    } else {
        // Group tasks by project
        if (projects && tasks) {
            projects.forEach(p => {
                const pTasks = tasks.filter(t => t.project_id === p.id);
                const completed = pTasks.filter(t => t.status === 'completed').length;
                console.log(`   Project "${p.name}" has ${pTasks.length} tasks (${completed} completed).`);
            });
        }
    }

    // 3. specific check for 'in_progress'
    const { data: activeProjects } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'in_progress');

    console.log(`\nQuery .eq('status', 'in_progress') returned: ${activeProjects?.length} projects.`);
}

debugDashboardData();
