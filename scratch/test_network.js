const https = require('https');
const CONFIG = require('../js/config.js');

function queryUsers() {
    const url = `${CONFIG.SUPABASE.URL}/rest/v1/users?select=*`;
    console.log('Querying Supabase users endpoint:', url);

    const options = {
        headers: {
            'apikey': CONFIG.SUPABASE.ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
        }
    };

    https.get(url, options, (res) => {
        console.log('HTTP Status Code:', res.statusCode);
        console.log('Headers:', res.headers);

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Response Body:', data.substring(0, 500));
        });
    }).on('error', (err) => {
        console.error('Network Error:', err.message);
    });
}

queryUsers();
