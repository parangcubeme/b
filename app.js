const STORAGE_KEY = "soro-culture-cuesheet-v1";
let originalBook = {};
let book = {};
let activeSheet = "";
let selectedRow = null;
let currentFileName = "서로문화축제_Que_Sheet.xlsx";

const $ = (id) => document.getElementById(id);
const table = $("sheetTable");
const tabs = $("sheetTabs");
const toast = $("toast");

function clone(v){ return JSON.parse(JSON.stringify(v)); }

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1500);
}

function colName(n){
  let s="";
  while(n>=0){ s=String.fromCharCode(n%26+65)+s; n=Math.floor(n/26)-1; }
  return s;
}

function displayValue(v, c){
  if(typeof v !== "number") return v ?? "";
  if(v > 40000){
    const base = new Date(Date.UTC(1899,11,30));
    const d = new Date(base.getTime() + v * 86400000);
    const y=d.getUTCFullYear(), m=String(d.getUTCMonth()+1).padStart(2,"0"), day=String(d.getUTCDate()).padStart(2,"0");
    const hh=String(d.getUTCHours()).padStart(2,"0"), mm=String(d.getUTCMinutes()).padStart(2,"0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }
  if((c===2 || c===4) && v >= 0 && v < 1){
    const mins = Math.round(v * 24 * 60);
    return `${String(Math.floor(mins/60)%24).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
  }
  return v;
}

function normalizeRows(rows){
  const width = Math.max(1, ...rows.map(r => r.length));
  return rows.map(r => {
    const out = [...r];
    while(out.length < width) out.push("");
    return out;
  });
}

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(book)); }

function loadSaved(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved && Object.keys(saved).length) return saved;
  }catch(e){}
  return null;
}

function detectSpecialRows(rows){
  const title = new Set(), header = new Set();
  rows.forEach((r,i)=>{
    const text = r.map(v=>String(v??"")).join(" ");
    if(/Que Sheet/i.test(text)) title.add(i);
    if(r.some(v=>String(v??"").trim()==="순") && r.some(v=>String(v??"").includes("시 간"))) header.add(i);
  });
  return {title, header};
}

function renderTabs(){
  tabs.innerHTML="";
  Object.keys(book).forEach(name=>{
    const b=document.createElement("button");
    b.className="sheet-tab"+(name===activeSheet?" active":"");
    b.textContent=name;
    b.onclick=()=>{ activeSheet=name; selectedRow=null; render(); };
    tabs.appendChild(b);
  });
}

function render(){
  if(!book[activeSheet]) return;
  renderTabs();
  const rows = normalizeRows(book[activeSheet]);
  book[activeSheet] = rows;
  const cols = rows[0]?.length || 1;
  const special = detectSpecialRows(rows);

  table.innerHTML="";
  const thead=document.createElement("thead");
  const hr=document.createElement("tr");
  const corner=document.createElement("th");
  corner.className="row-num";
  corner.textContent="#";
  hr.appendChild(corner);
  for(let c=0;c<cols;c++){
    const th=document.createElement("th");
    th.textContent=colName(c);
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody=document.createElement("tbody");
  rows.forEach((row,r)=>{
    const tr=document.createElement("tr");
    if(special.title.has(r)) tr.classList.add("title-row");
    if(special.header.has(r)) tr.classList.add("header-row");
    if(selectedRow===r) tr.classList.add("selected-row");

    const rn=document.createElement("th");
    rn.className="row-num";
    rn.textContent=r+1;
    rn.onclick=()=>{ selectedRow=r; render(); };
    tr.appendChild(rn);

    for(let c=0;c<cols;c++){
      const td=document.createElement("td");
      td.className="cell";
      td.contentEditable="true";
      td.spellcheck=false;
      td.dataset.r=r;
      td.dataset.c=c;
      td.textContent=displayValue(row[c], c);
      td.addEventListener("focus",()=>{ selectedRow=r; });
      td.addEventListener("blur",()=>{
        book[activeSheet][r][c]=td.innerText.replace(/\r/g,"");
        save();
      });
      td.addEventListener("keydown",(e)=>{
        if(e.key==="Enter" && !e.shiftKey){
          e.preventDefault();
          td.blur();
          const next=table.querySelector(`td[data-r="${r+1}"][data-c="${c}"]`);
          if(next) next.focus();
        }
        if(e.key==="Tab") setTimeout(()=>save(),0);
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function addRow(){
  const rows=book[activeSheet];
  const width=Math.max(1,...rows.map(r=>r.length));
  const at=selectedRow===null?rows.length:selectedRow+1;
  rows.splice(at,0,Array(width).fill(""));
  selectedRow=at;
  save(); render(); showToast("행을 추가했습니다.");
}

function addCol(){
  book[activeSheet].forEach(r=>r.push(""));
  save(); render(); showToast("열을 추가했습니다.");
}

function deleteRow(){
  if(selectedRow===null){ showToast("왼쪽 행 번호를 먼저 선택하세요."); return; }
  if(book[activeSheet].length<=1) return;
  book[activeSheet].splice(selectedRow,1);
  selectedRow=null;
  save(); render(); showToast("행을 삭제했습니다.");
}

function resetBook(){
  if(!confirm("현재 수정 내용을 지우고 처음 받은 큐시트로 복원할까요?")) return;
  book=clone(originalBook);
  activeSheet=Object.keys(book)[0];
  selectedRow=null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY + "-filename");
  currentFileName="서로문화축제_Que_Sheet.xlsx";
  render(); showToast("원본으로 복원했습니다.");
}

function importExcel(file){
  const reader=new FileReader();
  reader.onload=(e)=>{
    const wb=XLSX.read(e.target.result,{type:"array",cellDates:false});
    const next={};
    wb.SheetNames.forEach(name=>{
      next[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:true});
    });
    book=next;
    originalBook=clone(next);
    currentFileName=file.name || "서로문화축제_Que_Sheet.xlsx";
    activeSheet=wb.SheetNames[0];
    selectedRow=null;
    localStorage.setItem(STORAGE_KEY + "-filename", currentFileName);
    save(); render(); showToast("업로드한 엑셀로 현재 화면을 덮어썼습니다.");
  };
  reader.readAsArrayBuffer(file);
}

function exportExcel(){
  const wb=XLSX.utils.book_new();
  Object.entries(book).forEach(([name,rows])=>{
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=rows[0]?.map((_,c)=>({wch: c>=6 ? 24 : 12})) || [];
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  });
  const safeName = (currentFileName || "서로문화축제_Que_Sheet.xlsx").replace(/\.xlsx?$/i,"");
  XLSX.writeFile(wb, safeName + "_현재파일.xlsx");
  showToast("현재 화면의 파일을 다운로드했습니다.");
}

async function boot(){
  const res=await fetch("./data.json",{cache:"no-store"});
  if(!res.ok) throw new Error("data.json load failed");
  originalBook=await res.json();
  book=loadSaved() || clone(originalBook);
  currentFileName=localStorage.getItem(STORAGE_KEY + "-filename") || "서로문화축제_Que_Sheet.xlsx";
  activeSheet=Object.keys(book)[0];
  render();

  $("backBtn").onclick=()=>{ if(history.length>1) history.back(); else location.href="/"; };
  $("saveBtn").onclick=()=>{ save(); showToast("현재 내용을 저장했습니다."); };
  $("addRowBtn").onclick=addRow;
  $("addColBtn").onclick=addCol;
  $("deleteRowBtn").onclick=deleteRow;
  $("resetBtn").onclick=resetBook;
  $("exportBtn").onclick=exportExcel;
  $("fileInput").onchange=(e)=>{ if(e.target.files[0]) importExcel(e.target.files[0]); };
}

boot().catch(err=>{
  console.error(err);
  document.body.innerHTML='<div style="padding:24px">큐시트 데이터를 불러오지 못했습니다.</div>';
});
