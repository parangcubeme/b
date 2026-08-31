const STORE_URL="https://mantledb.sh/v2/soro-culture-260906-7f3c9a/cuesheet/shared-state";

export default async function handler(req,res){
  try{
    if(req.method==="GET"){
      const r=await fetch(STORE_URL,{method:"GET",headers:{"Accept":"application/json"}});
      if(r.status===404) return res.status(200).json({});
      const text=await r.text();
      let data={};
      try{ data=text ? JSON.parse(text) : {}; }catch(e){ data={}; }
      return res.status(200).json(data);
    }

    if(req.method==="POST"){
      const body=typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});
      const r=await fetch(STORE_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(!r.ok){
        const t=await r.text();
        return res.status(502).json({ok:false,error:t.slice(0,200)});
      }
      return res.status(200).json({ok:true});
    }

    res.setHeader("Allow","GET, POST");
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){
    return res.status(500).json({ok:false,error:String(e && e.message || e)});
  }
}
