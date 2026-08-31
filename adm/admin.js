const $=id=>document.getElementById(id);
function fmt(ts){return ts?new Date(Number(ts)).toLocaleString("ko-KR"):"-";}

function backupToXlsx(item){
  const snap=item.snapshot||{};
  const wb=XLSX.utils.book_new();
  Object.entries(snap.book||{}).forEach(([name,rows])=>{
    const ws=XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb,ws,String(name).slice(0,31));
  });
  const base=(item.fileName||"서로문화축제_Que_Sheet").replace(/\.xlsx?$/i,"");
  const stamp=new Date(Number(item.createdAt||Date.now())).toISOString().replace(/[:.]/g,"-");
  XLSX.writeFile(wb,base+"_백업_"+stamp+".xlsx");
}

async function login(){
  $("msg").textContent="확인 중...";
  try{
    const res=await fetch("/api/admin",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"dashboard",id:$("adminId").value.trim(),pw:$("adminPw").value})
    });
    const data=await res.json();
    if(!res.ok||!data.ok){$("msg").textContent="아이디 또는 패스워드가 맞지 않습니다.";return;}
    $("loginView").hidden=true;$("dashboard").hidden=false;

    const stats=Object.entries(data.stats||{}).sort((a,b)=>Number(b[1].lastAt||0)-Number(a[1].lastAt||0));
    $("stats").innerHTML=stats.length?stats.map(([name,v])=>`
      <div class="row"><div><b>${name}</b><div class="sub">최근 접속 ${fmt(v.lastAt)}</div></div><div class="count">${v.count||0}회</div></div>`
    ).join(""):'<div class="empty">접속 기록이 없습니다.</div>';

    const backups=data.backups||[];
    $("backups").innerHTML=backups.length?backups.map((b,i)=>`
      <div class="row"><div><b>${b.fileName||"큐시트 백업"}</b><div class="sub">${fmt(b.createdAt)} · ${b.updatedBy||"수정자 없음"}</div></div>
      <button class="mini" data-i="${i}">다운로드</button></div>`
    ).join(""):'<div class="empty">백업 파일이 없습니다.</div>';
    $("backups").querySelectorAll("[data-i]").forEach(btn=>btn.onclick=()=>backupToXlsx(backups[Number(btn.dataset.i)]));
  }catch(e){$("msg").textContent="관리자 정보를 불러오지 못했습니다.";}
}
$("loginBtn").onclick=login;
$("adminPw").addEventListener("keydown",e=>{if(e.key==="Enter")login();});

async function uploadCueSheet(){
  const file=$("cueUpload").files[0];
  if(!file){$("uploadMsg").textContent="엑셀 파일을 선택하세요.";return;}
  if(!confirm("현재 공용 큐시트를 업로드한 파일로 덮어쓸까요? 기존 공용본은 백업됩니다.")) return;
  $("uploadMsg").textContent="업로드 중...";
  try{
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:"array",cellDates:false});
    const book={};
    wb.SheetNames.forEach(name=>{
      if(name==="연습") return;
      book[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:true});
    });
    if(!Object.keys(book).length) throw new Error("sheet missing");
    const res=await fetch("/api/admin",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"upload",
        id:$("adminId").value.trim(),
        pw:$("adminPw").value,
        book,
        currentFileName:file.name
      })
    });
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||"upload failed");
    $("uploadMsg").style.color="#047857";
    $("uploadMsg").textContent="공용 큐시트를 새 파일로 덮어썼습니다.";
    $("cueUpload").value="";
  }catch(e){
    $("uploadMsg").style.color="#b91c1c";
    $("uploadMsg").textContent="업로드하지 못했습니다.";
  }
}
$("uploadBtn").onclick=uploadCueSheet;
