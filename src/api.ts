import {imageStore} from './images.mjs';
import {validateBackup} from './backup.mjs';
import { env } from 'cloudflare:workers';


import { mutate } from './inventory.mjs';
import {isOwnerSetup,random,hash,passwordHash,same,credentials,emptyState,ownsImage,accountInfo,rateLimit,sessionAccount,newSession} from './accounts.mjs';

const json=(x:any,status=200,headers:any={})=>Response.json(x,{status,headers:{'Cache-Control':'no-store',...headers}});
const db=()=> (env as any).DB;
const clearCookie='merch_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export async function GET(req:Request){try{let path=new URL(req.url).pathname.slice(5),a=await sessionAccount(db(),req);
 if(path==='auth/status'){let owner=await db().prepare("SELECT value FROM settings WHERE key='owner'").first();return json({account:a?accountInfo(a):null,canSetup:!owner,ownerReady:!!owner})}
 if(!a)return json({error:'请登录后使用'},401);
 if(path==='account')return json(accountInfo(a));
 if(path==='accounts'){if(a.role!=='owner')return json({error:'仅管理员可操作'},403);let rows=await db().prepare('SELECT id,username,display_name,role,status,created_at,last_seen FROM accounts ORDER BY created_at').all();let inv=await db().prepare('SELECT hash,label,created_at,expires,used_by,revoked FROM invites ORDER BY created_at DESC').all();return json({accounts:rows.results.map(accountInfo),invites:inv.results})}
 let state=JSON.parse(a.payload);
 if(path.startsWith('media/')){if(!ownsImage(state,'/api/'+path))return json({error:'未找到图片'},404);let obj=await imageStore(db()).get(path.slice(6));if(!obj)return json({error:'未找到图片'},404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'no-store'}})}
 if(path==='state'||path==='backup')return json(state);return json({error:'未找到'},404)
 }catch{return json({error:'读取失败，请稍后重试'},500)}}
export async function POST(req:Request){let url=new URL(req.url),path=url.pathname.slice(5);if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return json({error:'不允许跨站请求'},403);if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'需要JSON'},415);
 try{let raw=await req.text();if(raw.length>12000000)throw Error('请求过大');let body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('无效请求');let d=db();
 if(path==='auth/logout'){let token=req.headers.get('cookie')?.match(/merch_session=([a-f0-9]{64})/)?.[1];if(token)await d.prepare('DELETE FROM sessions WHERE hash=?').bind(await hash(token)).run();return json({ok:true},200,{'Set-Cookie':clearCookie})}
 if(['auth/login','auth/register','auth/setup'].includes(path)){
 let {username,password}=credentials(body);await rateLimit(d,req,username);
 if(path==='auth/login'){let a=await d.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first();let actual=await passwordHash(password,a?.salt||'dummy-salt-for-constant-work');if(!a||!same(actual,a.password_hash)||a.status!=='active')throw Error('用户名、密码不正确，或账号已停用');await d.prepare('UPDATE accounts SET last_seen=? WHERE id=?').bind(Date.now(),a.id).run();return json({ok:true},200,{'Set-Cookie':await newSession(d,a.id)})}
 let setup=path==='auth/setup';if(setup&&!await isOwnerSetup(body.setupToken,(env as any).ADMIN_SETUP_HASH))return json({error:'管理员初始化密钥不正确'},403);
 let salt=random(),ph=await passwordHash(password,salt),id=crypto.randomUUID(),now=Date.now(),name=String(body.displayName||username).trim().slice(0,60)||username;
 let state=emptyState();
 let params=[id,username,name,ph,salt,setup?'owner':'member','active',now,now,0,JSON.stringify(state)],insert='INSERT INTO accounts(id,username,display_name,password_hash,salt,role,status,created_at,last_seen,revision,payload) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ';
 let results;if(setup){results=await d.batch([d.prepare(insert+"NOT EXISTS(SELECT 1 FROM settings WHERE key='owner')").bind(...params),d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'owner',id FROM accounts WHERE id=?").bind(id)])}
 else{let code=String(body.invite||'').trim();if(!/^[a-f0-9]{64}$/.test(code))throw Error('邀请码无效');let ih=await hash(code);results=await d.batch([d.prepare(insert+'EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by IS NULL AND revoked=0 AND expires>?)').bind(...params,ih,now),d.prepare('UPDATE invites SET used_by=? WHERE hash=? AND used_by IS NULL AND EXISTS(SELECT 1 FROM accounts WHERE id=?)').bind(id,ih,id)])}
 if(!results[0].meta.changes)throw Error(setup?'管理员已设置，请登录':'邀请码无效、已使用或已过期');return json({ok:true},200,{'Set-Cookie':await newSession(d,id)})}
 let a=await sessionAccount(d,req);if(!a)return json({error:'请登录后使用'},401);
 if(path==='account/profile'){let name=String(body.displayName||'').trim();if(!name||name.length>60)throw Error('昵称须为1–60个字符');await d.prepare('UPDATE accounts SET display_name=? WHERE id=?').bind(name,a.id).run();return json({ok:true})}
 if(path==='account/password'){await rateLimit(d,req,a.username);if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!same(await passwordHash(body.currentPassword,a.salt),a.password_hash))throw Error('当前密码不正确');let {password}=credentials({username:a.username,password:body.password}),salt=random(),ph=await passwordHash(password,salt);await d.batch([d.prepare('UPDATE accounts SET password_hash=?,salt=? WHERE id=?').bind(ph,salt,a.id),d.prepare('DELETE FROM sessions WHERE account_id=?').bind(a.id)]);return json({ok:true},200,{'Set-Cookie':await newSession(d,a.id)})}
 if(path.startsWith('accounts/')){if(a.role!=='owner')return json({error:'仅管理员可操作'},403);
 if(path==='accounts/invite'){let code=random();await d.prepare('INSERT INTO invites(hash,label,created_at,expires,revoked) VALUES(?,?,?,?,0)').bind(await hash(code),String(body.label||'测试邀请').slice(0,60),Date.now(),Date.now()+604800000).run();return json({code,expires:Date.now()+604800000})}
 if(path==='accounts/revoke'){await d.prepare('UPDATE invites SET revoked=1 WHERE hash=? AND used_by IS NULL').bind(String(body.hash)).run();return json({ok:true})}
 if(path==='accounts/status'){let target=await d.prepare('SELECT role FROM accounts WHERE id=?').bind(String(body.id)).first();if(!target||target.role==='owner'||!['active','disabled'].includes(body.status))throw Error('不能更改该账号');await d.batch([d.prepare('UPDATE accounts SET status=? WHERE id=?').bind(body.status,body.id),d.prepare('DELETE FROM sessions WHERE account_id=?').bind(body.id)]);return json({ok:true})}
 return json({error:'未知操作'},404)}

 if(path==='account/import'){let state=validateBackup(body),existing=JSON.parse(a.payload);if(existing.items.length||existing.sales.length||existing.batches.length)throw Error('仅空仓库可以导入备份，避免覆盖现有记录');const cache=new Map();async function upload(data){if(!data)return '';if(cache.has(data))return cache.get(data);let [header,b64]=data.split(','),key=a.id+'/'+crypto.randomUUID();await imageStore(db()).put(key,Uint8Array.from(atob(b64),(c:any)=>c.charCodeAt(0)),{httpMetadata:{contentType:header.slice(5).split(';')[0]}});let url='/api/media/'+key;cache.set(data,url);return url}for(let item of state.items){item.image=await upload(item.image);let images=JSON.parse(item.member_images||'{}');for(let key of Object.keys(images))images[key]=await upload(images[key]);item.member_images=JSON.stringify(images)}let result=await d.prepare("UPDATE accounts SET payload=?,revision=revision+1 WHERE id=? AND revision=? AND status='active'").bind(JSON.stringify(state),a.id,a.revision).run();if(!result.meta.changes)throw Error('仓库刚刚有更新，请刷新后再导入');return json({ok:true})}
 for(let row of body.rows||[]){if(row.image){if(!/^data:image\/(jpeg|png|webp);base64,/.test(row.image)||row.image.length>3000000)throw Error('图片格式无效或过大');let [header,data]=row.image.split(','),bytes=Uint8Array.from(atob(data),(c:any)=>c.charCodeAt(0)),key=a.id+'/'+crypto.randomUUID();await imageStore(db()).put(key,bytes,{httpMetadata:{contentType:header.slice(5).split(';')[0]}});row.image='/api/media/'+key}}
 for(let attempt=0;attempt<4;attempt++){let row=await d.prepare("SELECT revision,payload FROM accounts WHERE id=? AND status='active'").bind(a.id).first();if(!row)return json({error:'账号已停用'},403);let state=JSON.parse(row.payload);mutate(state,path,body);let result=await d.prepare("UPDATE accounts SET payload=?,revision=revision+1 WHERE id=? AND revision=? AND status='active'").bind(JSON.stringify(state),a.id,row.revision).run();if(result.meta.changes)return json({ok:true})}return json({error:'其他设备刚更新了库存，请重试'},409)
 }catch(e:any){let message=e.message||'保存失败';if(/UNIQUE constraint/.test(message))message='用户名已被使用，请换一个';else if(/D1_|SQLITE|database/i.test(message))message='保存失败，请稍后重试';return json({error:message},400)}}
