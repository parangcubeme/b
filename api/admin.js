import crypto from "crypto";

const STATS_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/stats";
const BACKUPS_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/backups";
const STORE_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/shared-state";
const ADMIN_ID="mimi";
const ADMIN_PW_SHA256="1301d819b713cc1277e66fb6ecc8ddd4106529ea0eda84b4a1891edc3838e976";

function adminOk(id,pw){
  if(id!==ADMIN_ID || typeof pw!=="string") return false;
  const hash=crypto.createHash("sha256").update(pw).digest("hex");
  try{
    return crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(ADMIN_PW_SHA256));
  }catch(e){ return false; }
}

async function readJson(url,fallback){
  try{
    const r=await fetch(url,{method:"GET",headers:{"Accept":"application/json"}});
    if(!r.ok) return fallback;
    const text=await r.text();
    return text ? JSON.parse(text) : fallback;
  }catch(e){ return fallback; }
}

async function writeJson(url,value){
  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(value)
  });
  return r.ok;
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST"){
      res.setHeader("Allow","POST");
      return res.status(405).json({ok:false});
    }

    const body=typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});

    if(body.action==="visit"){
      const name=String(body.name||"").trim();
      const sessionId=String(body.sessionId||"");
      if(!name) return res.status(200).json({ok:true});

      let stats=await readJson(STATS_URL,{});
      if(!stats || Array.isArray(stats)) stats={};
      const now=Date.now();
      const item=stats[name] || {count:0,lastAt:0,sessions:{}};
      item.sessions=item.sessions || {};
      if(!sessionId || !item.sessions[sessionId]){
        item.count=Number(item.count||0)+1;
        if(sessionId) item.sessions[sessionId]=now;
      }
      item.lastAt=now;
      stats[name]=item;
      await writeJson(STATS_URL,stats);
      return res.status(200).json({ok:true});
    }

    if(body.action==="upload"){
      if(!adminOk(body.id,body.pw)) return res.status(401).json({ok:false,error:"unauthorized"});
      if(!body.book || typeof body.book!=="object") return res.status(400).json({ok:false,error:"invalid book"});

      const now=Date.now();
      const current=await readJson(STORE_URL,{});
      if(current && current.book){
        let backups=await readJson(BACKUPS_URL,[]);
        if(!Array.isArray(backups)) backups=[];
        backups.unshift({
          id:String(now),
          createdAt:now,
          updatedBy:current.updatedBy || "관리자 업로드 전",
          fileName:(current.currentFileName || "서로문화축제_Que_Sheet.xlsx").replace(/\.xlsx?$/i,""),
          snapshot:current
        });
        await writeJson(BACKUPS_URL,backups.slice(0,100));
      }

      const next={
        book:body.book,
        editMeta:{},
        currentFileName:body.currentFileName || "서로문화축제_Que_Sheet.xlsx",
        updatedAt:now,
        updatedBy:"관리자"
      };
      const ok=await writeJson(STORE_URL,next);
      return res.status(ok?200:502).json({ok});
    }

    if(body.action==="dashboard"){
      if(!adminOk(body.id,body.pw)){
        return res.status(401).json({ok:false,error:"unauthorized"});
      }
      const stats=await readJson(STATS_URL,{});
      const backups=await readJson(BACKUPS_URL,[]);
      const cleanStats={};
      Object.entries(stats||{}).forEach(([name,v])=>{
        cleanStats[name]={count:Number(v.count||0),lastAt:Number(v.lastAt||0)};
      });
      return res.status(200).json({
        ok:true,
        stats:cleanStats,
        backups:Array.isArray(backups)?backups:[]
      });
    }

    return res.status(400).json({ok:false,error:"bad action"});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e&&e.message||e)});
  }
}
