import { supabase } from './supabase';
import { parseDateRange } from './dateParsing';

const SHEET_ID = '17jvpRRomAzUQjJiBZN-Li4hMiw0UP4p3nB6V1X6khrc';
const GID = '1971502591';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const STAGES = ['Sorting', 'Selection', 'Cropping', 'Coloring', 'Pixieset'] as const;

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(start, i).replace(/^"|"$/g, '').trim());
            start = i + 1;
        }
    }
    result.push(line.substring(start).replace(/^"|"$/g, '').trim());
    return result;
}

export const syncProjectsFromSheet = async () => {
    try {
        const response = await fetch(CSV_URL);
        const text = await response.text();

        // CSV columns: 0=Name, 1=Location, 2=Notes, 3=Dates, 4=People Needed, 5+=Staff
        const rows = text.split('\n').slice(1); // Skip header

        const projects = rows.map(row => {
            if (!row.trim()) return null;
            const cols = parseCSVLine(row);
            if (cols.length < 4) return null;

            const name = cols[0];
            const dateText = cols[3]; // 4th column = Dates (raw text)

            if (!name) return null;

            return { name, dateText, source_id: 'sheet' };
        }).filter((p): p is { name: string; dateText: string; source_id: string } => p !== null && !!p.name);

        if (projects.length === 0) return { count: 0 };

        let count = 0;
        for (const p of projects) {
            const parsed = parseDateRange(p.dateText);
            const today = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
            const startDate = parsed?.startDate || todayStr;
            const endDate = parsed?.endDate || null;
            const dayCount = parsed?.dayCount || 1;

            console.log(`[Sync] "${p.name}" | Raw: "${p.dateText}" | Days: ${dayCount} | Start: ${startDate} | End: ${endDate || 'n/a'}`);

            // Check if project already exists
            const { data: existing } = await supabase
                .from('projects')
                .select('id, date, end_date, date_text, status')
                .eq('name', p.name)
                .maybeSingle();

            // Skip completed projects — never re-create or update them
            if (existing?.status === 'completed') {
                console.log(`[Sync] Skipping completed project "${p.name}"`);
                continue;
            }

            if (!existing) {
                // INSERT new project
                const { data: inserted, error } = await supabase.from('projects').insert([{
                    name: p.name,
                    date: startDate,
                    end_date: endDate,
                    date_text: p.dateText,
                    status: 'pending',
                    google_sheet_id: SHEET_ID,
                }]).select('id').single();

                if (error) {
                    console.error(`[Sync] Insert error for "${p.name}":`, error);
                    continue;
                }

                // Auto-create task stubs for each day × each stage
                if (inserted && dayCount > 0) {
                    const taskStubs = [];
                    for (let day = 1; day <= dayCount; day++) {
                        for (const stage of STAGES) {
                            taskStubs.push({
                                project_id: inserted.id,
                                stage_name: stage,
                                day_number: dayCount > 1 ? day : null,
                                assigned_to: [],
                                status: 'pending',
                            });
                        }
                    }

                    const { error: taskErr } = await supabase.from('project_tasks').insert(taskStubs);
                    if (taskErr) {
                        console.error(`[Sync] Task creation error for "${p.name}":`, taskErr);
                    } else {
                        console.log(`[Sync] Created ${taskStubs.length} tasks for "${p.name}" (${dayCount} days × ${STAGES.length} stages)`);
                    }
                }

                count++;
            } else {
                // UPDATE if date info changed
                const needsUpdate =
                    existing.date_text !== p.dateText ||
                    existing.date?.split('T')[0] !== startDate.split('T')[0];

                if (needsUpdate) {
                    const { error } = await supabase
                        .from('projects')
                        .update({
                            date: startDate,
                            end_date: endDate,
                            date_text: p.dateText,
                        })
                        .eq('id', existing.id);

                    if (!error) count++;
                    else console.error(`[Sync] Update error for "${p.name}":`, error);
                }
            }
        }

        return { count };

    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
};
