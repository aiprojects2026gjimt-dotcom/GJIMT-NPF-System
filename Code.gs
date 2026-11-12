/** GJIMT NPF backend. Deploy as web app: Execute as Me, access Anyone. */
const SHEETS = {
 Users:['id','name','email','salt','hash','role','active','createdAt','lastLogin'],
 Leads:['id','name','phone','email','program','percentage','source','stage','assignedTo','score','nextFollowUp','lastContact','createdAt','notes','skillX','studentUserId'],
 Activities:['id','leadId','userId','type','detail','createdAt'],
 Materials:['id','category','title','description','url','active'],
 Sends:['id','leadId','materialId','userId','channel','status','providerId','error','createdAt'],
 Installments:['id','leadId','userId','total','count','scheduleJson','createdAt'],
 Sessions:['tokenHash','userId','expiresAt'],
 Settings:['key','value']
};
const STAGES=['New','Attempted','Contacted','Interested','Hot','Applied','Admitted','Not Interested','Unreachable'];
const TZ='Asia/Kolkata';
function props_(){return PropertiesService.getScriptProperties()}
function db_(){const id=props_().getProperty('SHEET_ID');if(!id)throw Error('Run setup() first.');return SpreadsheetApp.openById(id)}
function sheet_(name){return db_().getSheetByName(name)}
function rows_(name){const v=sheet_(name).getDataRange().getValues();const h=v.shift();return v.filter(r=>r.some(x=>x!=='' )).map((r,i)=>{let o={_row:i+2};h.forEach((k,j)=>o[k]=r[j] instanceof Date?r[j].toISOString():r[j]);return o})}
function append_(name,obj){sheet_(name).appendRow(SHEETS[name].map(k=>obj[k]===undefined?'':obj[k]))}
function patch_(name,row,changes){const s=sheet_(name),h=SHEETS[name];Object.keys(changes).forEach(k=>{const c=h.indexOf(k);if(c>=0)s.getRange(row,c+1).setValue(changes[k])})}
function id_(){return Utilities.getUuid()}
function now_(){return new Date().toISOString()}
function digest_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
function hash_(pass,salt){let x=salt+':'+pass;for(let i=0;i<1200;i++)x=digest_(x);return x}
function clean_(s,max=500){return String(s===undefined?'':s).trim().slice(0,max)}
function email_(s){return clean_(s,150).toLowerCase()}
function phone_(s){let x=String(s||'').replace(/\D/g,'');if(x.length===10)x='91'+x;return /^91[6-9]\d{9}$/.test(x)?x:''}
function safeUser_(u){return {id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,lastLogin:u.lastLogin}}
function setting_(k){const r=rows_('Settings').find(x=>x.key===k);return r?r.value:''}
function putSetting_(k,v){const r=rows_('Settings').find(x=>x.key===k);if(r)patch_('Settings',r._row,{value:v});else append_('Settings',{key:k,value:v})}
function setup(){
 const p=props_();let id=p.getProperty('SHEET_ID');let ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('GJIMT NPF Admission CRM');if(!id)p.setProperty('SHEET_ID',ss.getId());
 Object.keys(SHEETS).forEach(n=>{let s=ss.getSheetByName(n)||ss.insertSheet(n);if(s.getLastRow()===0)s.appendRow(SHEETS[n]);s.setFrozenRows(1);s.getRange(1,1,1,SHEETS[n].length).setBackground('#d8481b').setFontColor('#ffffff').setFontWeight('bold')});
 if(!p.getProperty('ADMIN_INITIALIZED')){
   const pass='ChangeMe-'+id_().slice(0,12)+'!';const salt=id_();append_('Users',{id:id_(),name:'GJIMT Administrator',email:'admin@gjimt.ac.in',salt,hash:hash_(pass,salt),role:'admin',active:true,createdAt:now_()});
   p.setProperty('ADMIN_INITIALIZED','1');Logger.log('FIRST ADMIN USER: admin@gjimt.ac.in');Logger.log('FIRST ADMIN PASSWORD: '+pass);
 }
 if(!rows_('Settings').length){putSetting_('ALLOWED_ORIGIN','https://YOUR-USERNAME.github.io');putSetting_('ULTRAMSG_INSTANCE','');putSetting_('ULTRAMSG_TOKEN','');putSetting_('SENDER_ENABLED','false')}
 if(!rows_('Materials').length){[
 ['AI','AI-integrated programs','AI learning, hands-on labs and industry applications'],['ACCA','ACCA pathway','Professional accounting pathway overview'],['Posters','GJIMT admissions poster','Admissions open – contact counsellor'],['Fee','Fee overview','UG first semester tuition ₹32,500; PG ₹49,700. Confirm full fee with admissions'],['Highlights','Why GJIMT','NAAC accredited • 25+ years of excellence'],['Placements','Placement highlights','Upload verified placement posters before sending'],['Programs','Program catalogue','BCA, BBA, B.Com, MBA, MCA and AI-integrated pathways'],['Scholarship','Scholarship concessions','First semester tuition only; eligibility and conditions apply'],['Skill X','Skill X workshop','Workshop information and registration details'],['Brochures','GJIMT brochure','Upload approved PDF URL from Drive or website']
 ].forEach(a=>append_('Materials',{id:id_(),category:a[0],title:a[1],description:a[2],url:'',active:true}))}
 Logger.log('SHEET URL: '+ss.getUrl());return ss.getUrl();
}
function api(req){
 try {if(!req||typeof req!=='object')throw Error('Invalid request');const a=clean_(req.action,60),p=req.payload||{};
  if(a==='login')return {ok:true,data:login_(p)};
  const u=auth_(req.token);let out;
  if(a==='me')out=safeUser_(u);
  else if(a==='logout'){const r=rows_('Sessions').find(x=>x.tokenHash===digest_(req.token));if(r)sheet_('Sessions').deleteRow(r._row);out=true}
  else if(a==='dashboard')out=dashboard_(u);
  else if(a==='leads')out=leads_(u);
  else if(a==='lead')out=lead_(u,p.id);
  else if(a==='saveLead')out=saveLead_(u,p);
   else if(a==='importLeads')out=importLeads_(u,p);
  else if(a==='activity')out=activity_(u,p);
  else if(a==='materials'){const allowed=u.role==='student'?new Set(rows_('Sends').filter(x=>x.status==='SENT'&&rows_('Leads').some(l=>l.studentUserId===u.id&&l.id===x.leadId)).map(x=>x.materialId)):null;out=rows_('Materials').filter(x=>(x.active===true||String(x.active)==='true')&&(!allowed||allowed.has(x.id))).map(x=>({id:x.id,category:x.category,title:x.title,description:x.description,url:x.url}));}
  else if(a==='send')out=send_(u,p);
  else if(a==='installment')out=installment_(u,p);
  else if(a==='users'){admin_(u);out=rows_('Users').map(safeUser_)}
  else if(a==='createUser')out=createUser_(u,p);
  else if(a==='setUser')out=setUser_(u,p);
  else if(a==='assign')out=assign_(u,p);
  else if(a==='saveMaterial')out=saveMaterial_(u,p);
  else if(a==='settings'){admin_(u);out={allowedOrigin:setting_('ALLOWED_ORIGIN'),senderEnabled:setting_('SENDER_ENABLED')==='true',instanceConfigured:!!setting_('ULTRAMSG_INSTANCE'),tokenConfigured:!!setting_('ULTRAMSG_TOKEN')}}
  else if(a==='changePassword')out=changePassword_(u,p);
  else throw Error('Unknown action');return {ok:true,data:out};
 }catch(e){return {ok:false,error:String(e.message||e)}}
}
function login_(p){const e=email_(p.email),pass=String(p.password||'');const u=rows_('Users').find(x=>x.email===e&&String(x.active)!=='false'&&x.active!==false);if(!u||hash_(pass,u.salt)!==u.hash)throw Error('Invalid credentials');const token=id_()+id_();append_('Sessions',{tokenHash:digest_(token),userId:u.id,expiresAt:new Date(Date.now()+12*3600000).toISOString()});patch_('Users',u._row,{lastLogin:now_()});return {token,user:safeUser_(u)}}
function auth_(token){if(!token)throw Error('Please log in');const s=rows_('Sessions').find(x=>x.tokenHash===digest_(String(token)));if(!s||new Date(s.expiresAt).getTime()<Date.now())throw Error('Session expired. Log in again');const u=rows_('Users').find(x=>x.id===s.userId&&String(x.active)!=='false');if(!u)throw Error('Account disabled');return u}
function admin_(u){if(u.role!=='admin')throw Error('Admin permission required')}
function access_(u,l){if(!l)throw Error('Lead not found');if(u.role==='admin'||u.role==='counsellor'&&l.assignedTo===u.id||u.role==='student'&&l.studentUserId===u.id)return;if(u.role==='counsellor')throw Error('This lead is not assigned to you');throw Error('Access denied')}
function leads_(u){return rows_('Leads').filter(l=>u.role==='admin'||u.role==='counsellor'&&l.assignedTo===u.id||u.role==='student'&&l.studentUserId===u.id).map(l=>u.role==='student'?{id:l.id,name:l.name,program:l.program,stage:l.stage,percentage:l.percentage,skillX:l.skillX}:l)}
function lead_(u,id){const l=rows_('Leads').find(x=>x.id===id);access_(u,l);let activities=rows_('Activities').filter(x=>x.leadId===id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));let sends=rows_('Sends').filter(x=>x.leadId===id);let installments=rows_('Installments').filter(x=>x.leadId===id);if(u.role==='student'){activities=[];sends=sends.filter(x=>x.status==='SENT').map(x=>({materialId:x.materialId,status:x.status,createdAt:x.createdAt}));return {lead:{id:l.id,name:l.name,program:l.program,percentage:l.percentage,skillX:l.skillX},activities,sends,installments}}
 return {lead:l,activities,sends,installments};}
function dashboard_(u){const all=rows_('Leads'),visible=leads_(u),act=rows_('Activities'),users=rows_('Users').filter(x=>x.role==='counsellor');const today=new Date().toISOString().slice(0,10);const pending=visible.filter(x=>x.nextFollowUp&&String(x.nextFollowUp).slice(0,10)<=today&&!['Admitted','Not Interested'].includes(x.stage));let data={total:visible.length,allocated:visible.filter(x=>x.assignedTo).length,unallocated:visible.filter(x=>!x.assignedTo).length,followups:pending.length,hot:visible.filter(x=>Number(x.score)>=75).length,warm:visible.filter(x=>Number(x.score)>=40&&Number(x.score)<75).length,cold:visible.filter(x=>Number(x.score)<40).length,stageCounts:STAGES.map(stage=>({stage,count:visible.filter(x=>x.stage===stage).length})),recent:act.filter(x=>visible.some(l=>l.id===x.leadId)).slice(-25).reverse()};
 if(u.role==='admin')data.counsellors=users.map(c=>{const ls=all.filter(x=>x.assignedTo===c.id);return {id:c.id,name:c.name,lastLogin:c.lastLogin,leads:ls.length,calls:act.filter(x=>x.userId===c.id&&x.type==='CALL').length,followups:ls.filter(x=>x.nextFollowUp&&String(x.nextFollowUp).slice(0,10)<=today&&!['Admitted','Not Interested'].includes(x.stage)).length,sent:rows_('Sends').filter(x=>x.userId===c.id&&x.status==='SENT').length,hot:ls.filter(x=>Number(x.score)>=75).length}});
 if(u.role==='student')data={total:visible.length};return data}
function saveLead_(u,p){if(u.role==='student')throw Error('Not permitted');const id=clean_(p.id,80);const old=id?rows_('Leads').find(x=>x.id===id):null;if(old)access_(u,old);if(!old&&u.role!=='admin')throw Error('Only admin can import or create leads');const name=clean_(p.name,120),phone=phone_(p.phone);if(!name||!phone)throw Error('Student name and valid Indian phone required');const patch={name,phone,email:email_(p.email),program:clean_(p.program,100),percentage:Number(p.percentage)||0,source:clean_(p.source,100),notes:clean_(p.notes,3000)};
 if(u.role==='admin')patch.assignedTo=clean_(p.assignedTo,80);if(old){patch_('Leads',old._row,patch);return old.id}const lid=id_();append_('Leads',Object.assign({id:lid,stage:'New',score:10,createdAt:now_(),skillX:false},patch));return lid}
function importLeads_(u,p){
 admin_(u);const items=p.leads;if(!Array.isArray(items)||items.length>40)throw Error('Import maximum 40 leads per batch');
 const existing=new Set(rows_('Leads').map(x=>phone_(x.phone)).filter(Boolean));let added=0,skipped=0;
 items.forEach(item=>{const name=clean_(item.name,120),phone=phone_(item.phone);if(!name||!phone||existing.has(phone)){skipped++;return}
 const percentage=Number(item.percentage);append_('Leads',{id:id_(),name,phone,email:email_(item.email),program:clean_(item.program,100),percentage:Number.isFinite(percentage)?Math.min(100,Math.max(0,percentage)):0,source:clean_(item.source,100)||'CSV Import',stage:'New',assignedTo:'',score:10,createdAt:now_(),notes:clean_(item.notes,3000),skillX:false});existing.add(phone);added++});return {added,skipped}
}
function activity_(u,p){if(u.role==='student')throw Error('Not permitted');const l=rows_('Leads').find(x=>x.id===p.leadId);access_(u,l);const type=clean_(p.type,30),detail=clean_(p.detail,3000);if(!['CALL','NOTE','STAGE','FOLLOWUP','SKILLX','SCORE'].includes(type))throw Error('Invalid activity type');const changes={lastContact:now_()};if(type==='STAGE'){if(!STAGES.includes(p.stage))throw Error('Invalid stage');changes.stage=p.stage;changes.score=({New:10,Attempted:20,Contacted:35,Interested:65,Hot:90,Applied:95,Admitted:100,'Not Interested':0,Unreachable:5})[p.stage]}
 if(type==='FOLLOWUP'){const d=clean_(p.followUp,30);if(d&&!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Invalid date');changes.nextFollowUp=d}
 if(type==='SKILLX')changes.skillX=!!p.skillX;
 if(type==='SCORE'){const score=Number(p.score);if(p.score===''||!Number.isFinite(score)||score<0||score>100)throw Error('Score must be between 0 and 100');changes.score=score;}
 patch_('Leads',l._row,changes);append_('Activities',{id:id_(),leadId:l.id,userId:u.id,type,detail:detail||(type==='STAGE'?p.stage:type==='FOLLOWUP'?p.followUp:type==='SKILLX'?String(!!p.skillX):type==='SCORE'?'Score updated to '+changes.score:''),createdAt:now_()});return true}
function createUser_(u,p){admin_(u);const role=clean_(p.role);if(!['admin','counsellor','student'].includes(role))throw Error('Invalid role');const e=email_(p.email),password=String(p.password||'');if(!/^\S+@\S+\.\S+$/.test(e)||password.length<12)throw Error('Valid email and password of at least 12 characters required');if(rows_('Users').some(x=>x.email===e))throw Error('Email already registered');if(role==='student'&&!rows_('Leads').some(x=>x.id===p.leadId))throw Error('Student lead not found');const salt=id_(),uid=id_();append_('Users',{id:uid,name:clean_(p.name,120),email:e,salt,hash:hash_(password,salt),role,active:true,createdAt:now_()});if(role==='student'){const l=rows_('Leads').find(x=>x.id===p.leadId);if(!l)throw Error('Student lead not found');patch_('Leads',l._row,{studentUserId:uid})}return uid}
function setUser_(u,p){admin_(u);const target=rows_('Users').find(x=>x.id===p.id);if(!target)throw Error('User not found');if(target.id===u.id&&p.active===false)throw Error('Cannot disable own account');patch_('Users',target._row,{active:!!p.active});return true}
function assign_(u,p){admin_(u);const l=rows_('Leads').find(x=>x.id===p.leadId);if(!l)throw Error('Lead not found');if(p.userId&&!rows_('Users').some(x=>x.id===p.userId&&x.role==='counsellor'&&String(x.active)!=='false'))throw Error('Counsellor not found');patch_('Leads',l._row,{assignedTo:p.userId||''});append_('Activities',{id:id_(),leadId:l.id,userId:u.id,type:'ASSIGN',detail:p.userId||'Unassigned',createdAt:now_()});return true}
function saveMaterial_(u,p){admin_(u);const old=rows_('Materials').find(x=>x.id===p.id);const v={category:clean_(p.category,80),title:clean_(p.title,150),description:clean_(p.description,1500),url:clean_(p.url,1000),active:true};if(v.url&&!/^https:\/\//.test(v.url))throw Error('Only HTTPS material URLs allowed');if(old)patch_('Materials',old._row,v);else append_('Materials',Object.assign({id:id_()},v));return true}
function installment_(u,p){if(u.role==='student')throw Error('Not permitted');const l=rows_('Leads').find(x=>x.id===p.leadId);access_(u,l);const count=Number(p.count),total=Number(p.total);if(![2,3].includes(count)||!Number.isFinite(total)||total<=0)throw Error('Select 2 or 3 installments and positive total');const start=new Date();start.setHours(12,0,0,0);const amounts=Array(count).fill(Math.floor(total*100/count)/100);amounts[count-1]=Math.round((total-amounts.slice(0,-1).reduce((a,b)=>a+b,0))*100)/100;const schedule=amounts.map((amount,i)=>{const d=new Date(start);d.setDate(d.getDate()+i*15);return {number:i+1,amount,date:Utilities.formatDate(d,TZ,'yyyy-MM-dd')}});append_('Installments',{id:id_(),leadId:l.id,userId:u.id,total,count,scheduleJson:JSON.stringify(schedule),createdAt:now_()});append_('Activities',{id:id_(),leadId:l.id,userId:u.id,type:'INSTALLMENT',detail:JSON.stringify(schedule),createdAt:now_()});return schedule}
function send_(u,p){if(u.role==='student')throw Error('Not permitted');const l=rows_('Leads').find(x=>x.id===p.leadId);access_(u,l);const m=rows_('Materials').find(x=>x.id===p.materialId);if(!m)throw Error('Material not found');if(l.source==='Demo only')throw Error('Sending to demo leads is prohibited');const phone=phone_(l.phone);if(!phone)throw Error('Student has invalid phone');const msg=clean_(p.message||m.title+'\n'+m.description+(m.url?'\n'+m.url:''),3500);if(!msg)throw Error('Message is empty');const inst=setting_('ULTRAMSG_INSTANCE'),token=setting_('ULTRAMSG_TOKEN');if(String(setting_('SENDER_ENABLED')).trim().toLowerCase()!=='true')throw Error('WhatsApp sending is disabled. Set SENDER_ENABLED to TRUE in Settings sheet');if(!String(inst).trim())throw Error('ULTRAMSG_INSTANCE is missing in Settings sheet');if(!String(token).trim())throw Error('ULTRAMSG_TOKEN is missing in Settings sheet');
 const endpoint='https://api.ultramsg.com/'+encodeURIComponent(inst)+'/messages/chat';let status='FAILED',providerId='',error='';try{const r=UrlFetchApp.fetch(endpoint,{method:'post',payload:{token,to:phone,body:msg},muteHttpExceptions:true});const body=r.getContentText(),json=JSON.parse(body);if(r.getResponseCode()>=200&&r.getResponseCode()<300&&(json.sent===true||json.sent==='true'||json.id||json.message)){status='SENT';providerId=String(json.id||json.message||'')}else error=body.slice(0,500)}catch(e){error=String(e).slice(0,500)}append_('Sends',{id:id_(),leadId:l.id,materialId:m.id,userId:u.id,channel:'UltraMsg',status,providerId,error,createdAt:now_()});append_('Activities',{id:id_(),leadId:l.id,userId:u.id,type:'WHATSAPP',detail:m.title+' - '+status,createdAt:now_()});if(status!=='SENT')throw Error('WhatsApp failed: '+error);return {status,providerId}}
function changePassword_(u,p){const pass=String(p.newPassword||'');if(pass.length<12)throw Error('New password must be at least 12 characters');if(hash_(String(p.oldPassword||''),u.salt)!==u.hash)throw Error('Current password incorrect');const salt=id_();patch_('Users',u._row,{salt,hash:hash_(pass,salt)});return true}
function seedDemo(){const a=rows_('Users').find(x=>x.role==='admin');if(!a)throw Error('Run setup first');if(rows_('Leads').length)return 'Leads already exist; demo not added';const names=['Aman Sharma','Simran Kaur','Harpreet Singh','Priya Verma','Rohan Mehta','Navjot Kaur','Arjun Gupta','Mehak Gill','Karan Bedi','Ananya Sood','Rahul Kumar','Jasleen Kaur'];names.forEach((name,i)=>append_('Leads',{id:id_(),name,phone:'91'+String(9000000000+i),email:'demo'+(i+1)+'@example.com',program:['BCA with AI','MBA with AI','MCA','BBA','B.Com'][i%5],percentage:[95,83,76,69,91,88,74,63,82,97,78,86][i],source:'Demo only',stage:STAGES[i%STAGES.length],assignedTo:'',score:[90,65,35,20][i%4],nextFollowUp:Utilities.formatDate(new Date(Date.now()+((i%4)-1)*86400000),TZ,'yyyy-MM-dd'),createdAt:now_(),notes:'SAMPLE RECORD — do not send messages',skillX:i%3===0}));return 'Created 12 sample leads. All numbers are fictional. Do not send to demo leads.'}

/** Netlify server-to-server JSON endpoint. Keep BRIDGE_SHARED_SECRET private. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true,service:'GJIMT NPF backend'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw Error('Missing JSON request body');
    if (e.postData.contents.length > 100000) throw Error('Request too large');
    var body = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty('BRIDGE_SHARED_SECRET');
    if (!expected || expected.length < 32) throw Error('BRIDGE_SHARED_SECRET is not configured');
    if (typeof body.bridgeSecret !== 'string' || body.bridgeSecret !== expected)
      throw Error('Backend authorization failed');
    return jsonResponse_(api({action:body.action, payload:body.payload || {}, token:body.token || ''}));
  } catch (err) {
    return jsonResponse_({ok:false,error:String(err.message || err)});
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
