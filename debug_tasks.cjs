const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hggpxswixytozhqgrdsm.supabase.co';
const supabaseKey = 'sb_publishable__qdacM4VzxAYY_te0YMj7g_NQFY3eD4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("--- Inspecting Database ---");

    // 1. Fetch Profiles
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id, full_name, email');
    if (pError) console.error("Profile Error:", pError);
    else {
        console.log(`Found ${profiles.length} profiles:`);
        profiles.forEach(p => console.log(`  [${p.id}] ${p.full_name} (${p.email})`));
    }

    // 2. Fetch Projects
    const { data: projects, error: prError } = await supabase.from('projects').select('id, name');
    if (prError) console.error("Project Error:", prError);
    else {
        console.log(`Found ${projects.length} projects:`);
        projects.forEach(p => console.log(`  [${p.id}] ${p.name}`));
    }

    // 3. Fetch Tasks
    const { data: tasks, error: tError } = await supabase.from('project_tasks').select('id, project_id, stage_name, assigned_to');
    if (tError) console.error("Task Error:", tError);
    else {
        console.log(`Found ${tasks.length} tasks:`);
        tasks.forEach(t => {
            console.log(`  Task [${t.id}] Stage: ${t.stage_name}`);
            console.log(`    Project ID: ${t.project_id}`);
            console.log(`    Assigned To (${Array.isArray(t.assigned_to) ? 'Array' : typeof t.assigned_to}):`, JSON.stringify(t.assigned_to));

            // Validation
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach(uid => {
                    const user = profiles.find(p => p.id === uid);
                    console.log(`      -> Assigned User: ${user ? user.full_name : 'UNKNOWN USER ID'}`);
                });
            }
        });
    }
}

inspect();
