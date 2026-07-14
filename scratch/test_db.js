const CONFIG = require('../js/config.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);

async function checkDatabase() {
    try {
        console.log('Connecting to Supabase URL:', CONFIG.SUPABASE.URL);
        
        // 1. Query grades count
        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        if (gradesError) {
            console.error('Grades fetch error:', gradesError);
        } else {
            console.log('Successfully connected! Grades found:', grades.length);
            grades.forEach(g => console.log(`- Grade ID ${g.id}: ${g.name}`));
        }

        // 2. Query users
        const { data: users, error: usersError } = await supabase.from('users').select('id, name, phone, division');
        if (usersError) {
            console.error('Users fetch error:', usersError);
        } else {
            console.log('Users found in DB:', users.length);
            users.forEach(u => console.log(`- User: ${u.name} | Phone: ${u.phone} | Division: ${u.division}`));
        }
    } catch (err) {
        console.error('Fatal diagnostic error:', err.message);
    }
}

checkDatabase();
