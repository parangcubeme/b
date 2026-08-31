const STORE_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/shared-state";
const PRESENCE_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/presence";
const BACKUPS_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/backups";

export default async function handler(req,res){
  try{
    if(req.method==="GET"){
      if(req.query && req.query.presence){
        const pr=await fetch(PRESENCE_URL,{method:"GET",headers:{"Accept":"application/json"}});
        let presence=[];
        if(pr.ok){
          try{ presence=JSON.parse(await pr.text()) || []; }catch(e){}
        }
        const now=Date.now();
        presence=Array.isArray(presence) ? presence.filter(x=>x && x.active && now-Number(x.ts||0)<45000) : [];
        return res.status(200).json({presence});
      }
      const r=await fetch(STORE_URL,{method:"GET",headers:{"Accept":"application/json"}});
      if(r.status===404) return res.status(200).json({});
      const text=await r.text();
      let data={};
      try{ data=text ? JSON.parse(text) : {}; }catch(e){ data={}; }
      return res.status(200).json(data);
    }

    if(req.method==="PATCH"){
      const body=typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});
      let presence=[];
      const old=await fetch(PRESENCE_URL,{method:"GET",headers:{"Accept":"application/json"}});
      if(old.ok){ try{ presence=JSON.parse(await old.text()) || []; }catch(e){} }
      if(!Array.isArray(presence)) presence=[];
      const now=Date.now();
      presence=presence.filter(x=>x && x.sessionId!==body.sessionId && x.active && now-Number(x.ts||0)<45000);
      if(body.active && body.sessionId && body.name) presence.push({sessionId:body.sessionId,name:body.name,active:true,ts:now});
      const pr=await fetch(PRESENCE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(presence)});
      if(!pr.ok) return res.status(502).json({ok:false});
      return res.status(200).json({ok:true,presence});
    }

    if(req.method==="POST"){
      const body=typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});

      if(body.makeBackup){
        try{
          const currentRes=await fetch(STORE_URL,{method:"GET",headers:{"Accept":"application/json"}});
          if(currentRes.ok){
            const currentText=await currentRes.text();
            let current={};
            try{ current=currentText ? JSON.parse(currentText) : {}; }catch(e){}
            if(current && current.book){
              const listRes=await fetch(BACKUPS_URL,{method:"GET",headers:{"Accept":"application/json"}});
              let list=[];
              if(listRes.ok){ try{ list=JSON.parse(await listRes.text()) || []; }catch(e){} }
              if(!Array.isArray(list)) list=[];
              list.unshift({
                id:String(Date.now()),
                createdAt:Date.now(),
                updatedBy:current.updatedBy || "",
                fileName:(current.currentFileName || "서로문화축제_Que_Sheet.xlsx").replace(/\.xlsx?$/i,""),
                snapshot:current
              });
              list=list.slice(0,100);
              await fetch(BACKUPS_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(list)});
            }
          }
        }catch(e){}
      }

      const cleanBody={...body};
      delete cleanBody.makeBackup;
      const r=await fetch(STORE_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(cleanBody)
      });
      if(!r.ok){
        const t=await r.text();
        return res.status(502).json({ok:false,error:t.slice(0,200)});
      }
      return res.status(200).json({ok:true});
    }

    res.setHeader("Allow","GET, POST, PATCH");
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e && e.message || e)});
  }
}
