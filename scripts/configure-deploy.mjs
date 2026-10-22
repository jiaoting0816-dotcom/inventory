import fs from 'node:fs';
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_DATABASE_ID','CLOUDFLARE_API_TOKEN','ADMIN_SETUP_TOKEN'])if(!process.env[key])throw Error('Missing '+key);
if(process.env.ADMIN_SETUP_TOKEN.length<32)throw Error('ADMIN_SETUP_TOKEN must contain at least 32 random characters');
if(!/^[0-9a-f-]{36}$/i.test(process.env.CLOUDFLARE_DATABASE_ID))throw Error('Invalid database ID');
let c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));c.d1_databases[0].database_id=process.env.CLOUDFLARE_DATABASE_ID;fs.writeFileSync('wrangler.generated.json',JSON.stringify(c,null,2));
