import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n')
    .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]})
);
const NEW_PASSWORD = process.env.NEW_PW;
const USER_ID = 'a1dca7f4-7e46-44e2-9e5b-273c06c182a2';

const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${USER_ID}`,
  {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: '!aPC/SkR-!9Th!%' }),
  }
);
const j = await res.json();
console.log(res.status, j.email || j);
