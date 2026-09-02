import React,{useMemo,useState} from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Search, Users, WalletCards } from 'lucide-react';
import type {RawDonationRecord} from '../types/donation';
const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
const yOf=(d:RawDonationRecord)=>Number((d.date||d.period||'').slice(0,4))||0;
const mOf=(d:RawDonationRecord)=>{const s=d.date||d.period||''; const m=Number(s.slice(5,7)); return m>=1&&m<=12?m:0};
export const MembershipStatusManager:React.FC<{donations:RawDonationRecord[]}>=({donations})=>{
const years = useMemo(
  () =>
    Array.from(new Set(donations.map(yOf).filter(Boolean)))
      .map(Number)
      .sort((a, b) => b - a),
  [donations]
);
 const [year,setYear]=useState<number>(years[0]||new Date().getFullYear()); const [q,setQ]=useState('');
 const rows=useMemo(()=>{const map=new Map<string,RawDonationRecord[]>(); donations.forEach(d=>{if(yOf(d)!==year)return; const k=`${norm(d.donorName)}|${d.idNumber||d.address}`; map.set(k,[...(map.get(k)||[]),d])}); return [...map.entries()].map(([k,rs])=>{const months=new Set(rs.map(mOf).filter(Boolean)); const total=rs.reduce((s,x)=>s+x.amount,0); return {k,name:rs[0].donorName,total,count:rs.length,months:[...months].sort((a,b)=>a-b),last:[...rs].sort((a,b)=>(b.date||b.period||'').localeCompare(a.date||a.period||''))[0]};}).sort((a,b)=>a.name.localeCompare(b.name,'ko'));},[donations,year]);
 const maxMonth=year===new Date().getFullYear()?new Date().getMonth()+1:12;
 const classified=rows.map(r=>({...r,status:r.months.length>=maxMonth?'정상납부':r.months.length===0?'미납':'일부납부',missing:Math.max(0,maxMonth-r.months.length)}));
 const filtered=classified.filter(r=>norm(r.name).includes(norm(q)));
 const counts={paid:classified.filter(r=>r.status==='정상납부').length,partial:classified.filter(r=>r.status==='일부납부').length,unpaid:classified.filter(r=>r.status==='미납').length};
 return <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">회비 납부·미납 관리</h2><p className="text-sm text-slate-500 mt-1">연도별 실제 납부 기록을 기준으로 납부 상태를 자동 분류합니다.</p></div><select value={year} onChange={e=>setYear(Number(e.target.value))} className="border rounded-lg px-4 py-2 font-semibold">{years.map(y=><option key={y} value={y}>{y}년</option>)}</select></div>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Stat icon={<Users/>} label="조회 회원" value={`${classified.length}명`}/><Stat icon={<CheckCircle2/>} label="정상납부" value={`${counts.paid}명`}/><Stat icon={<Clock3/>} label="일부납부" value={`${counts.partial}명`}/><Stat icon={<AlertTriangle/>} label="납부기록 없음" value={`${counts.unpaid}명`}/></div>
  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-900"><b>분류 기준:</b> 선택 연도의 납부 기록에서 월 정보가 확인되는 경우 월별 납부 여부를 계산합니다. 연납·일시납처럼 한 번에 납부한 자료는 실제 회비 규정과 다를 수 있으므로 최종 미납 판단 전 회원별 회비 기준을 확인해야 합니다.</div>
  <section className="bg-white border rounded-xl shadow-sm p-5"><div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><div><h3 className="font-bold">{year}년 회원별 납부 상태</h3><p className="text-xs text-slate-500">정상납부 · 일부납부 · 납부기록 없음으로 확인</p></div><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="회원명 검색" className="pl-9 pr-3 py-2 border rounded-lg text-sm"/></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">회원명</th><th className="p-3 text-center">납부상태</th><th className="p-3 text-center">납부월</th><th className="p-3 text-center">미확인월</th><th className="p-3 text-right">납부액</th><th className="p-3 text-left">최근 납부일</th></tr></thead><tbody>{filtered.map(r=><tr key={r.k} className="border-t"><td className="p-3 font-medium">{r.name}</td><td className="p-3 text-center"><span className={r.status==='정상납부'?'text-emerald-700':r.status==='일부납부'?'text-amber-700':'text-red-700'}>{r.status}</span></td><td className="p-3 text-center">{r.months.length?`${r.months.join(', ')}월`:'-'}</td><td className="p-3 text-center">{r.missing}개월</td><td className="p-3 text-right">{r.total.toLocaleString()}원</td><td className="p-3">{r.last?.date||r.last?.period||'-'}</td></tr>)}</tbody></table></div>{!filtered.length&&<div className="py-10 text-center text-slate-500">조회할 납부 자료가 없습니다.</div>}</section>
 </main>
}
const Stat=({icon,label,value}:{icon:React.ReactNode,label:string,value:string})=><div className="bg-white border rounded-xl p-5 shadow-sm"><div className="text-blue-900 mb-2">{icon}</div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold mt-1">{value}</div></div>;
