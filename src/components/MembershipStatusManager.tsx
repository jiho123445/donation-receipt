import React,{useMemo,useState} from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Search, Users, WalletCards } from 'lucide-react';
import type {RawDonationRecord} from '../types/donation';
const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
const yOf=(d:RawDonationRecord)=>Number((d.date||d.period||'').slice(0,4))||0;
const mOf=(d:RawDonationRecord)=>{const s=d.date||d.period||''; const m=Number(s.slice(5,7)); return m>=1&&m<=12?m:0};
export const MembershipStatusManager:React.FC<{donations:RawDonationRecord[]}>=({donations})=>{
 const years=useMemo(()=>Array.from(new Set(donations.map(yOf).filter(Boolean))).sort((a:number,b:number)=>b-a),[donations]);
 const [year,setYear]=useState<number>(years[0]||new Date().getFullYear()); const [q,setQ]=useState('');
 // 납부상태 필터: all(전체) / 납부완료 / 일부납부 / 미납 / missing(미확인월이 있는 회원 = 일부납부+미납)
 const [statusFilter,setStatusFilter]=useState<'all'|'납부완료'|'일부납부'|'미납'|'missing'>('all');
 const rows=useMemo(()=>{const map=new Map<string,RawDonationRecord[]>(); donations.forEach(d=>{if(yOf(d)!==year)return; const k=`${norm(d.donorName)}|${d.idNumber||d.address}`; map.set(k,[...(map.get(k)||[]),d])}); return [...map.entries()].map(([k,rs])=>{const months=new Set(rs.map(mOf).filter(Boolean)); const total=rs.reduce((s,x)=>s+x.amount,0); return {k,name:rs[0].donorName,total,count:rs.length,months:[...months].sort((a,b)=>a-b),last:[...rs].sort((a,b)=>(b.date||b.period||'').localeCompare(a.date||a.period||''))[0]};}).sort((a,b)=>a.name.localeCompare(b.name,'ko'));},[donations,year]);
 const maxMonth=year===new Date().getFullYear()?new Date().getMonth()+1:12;

 // 연납/일시납 인식: "여러 달치 회비를 한 번에 낸" 회원은 특정 월에만 기록이 몰려 있어도
 // 실제로는 그만큼 미납이 아닙니다. 연회비는 120만원(월 10만원) 고정 기준으로 계산합니다.
 // 한 번에 낸 금액이 있으면 120만원 - 낸 금액을 10만원으로 나눈 만큼을 미확인월로 남깁니다.
 // 예: 한 번에 60만원을 냈다면 (120만원-60만원)÷10만원 = 6개월이 미확인월로 남습니다.
 const ANNUAL_FEE = 1200000;
 const MONTHLY_FEE = ANNUAL_FEE / 12;
 // 총액 ÷ 월회비(10만원)를 개월수로 환산합니다. 정수에 아주 가까우면(반올림 오차) 반올림하고,
 // 그 외에는 실제 낸 돈보다 더 많은 개월을 낸 것으로 쳐주지 않도록 내림합니다.
 const monthsFromAmount = (total: number): number => {
   const raw = total / MONTHLY_FEE;
   const rounded = Math.round(raw);
   return Math.abs(raw - rounded) < 0.05 ? rounded : Math.floor(raw);
 };

 const classified = rows.map(r => {
   const amountMonths = Math.min(12, monthsFromAmount(r.total));
   const isLumpSum = amountMonths > r.months.length;
   if (isLumpSum) {
     // 일시납: 항상 120만원(12개월) 기준으로 남은 개월을 계산합니다(연도 진행 상황과 무관).
     const missing = Math.max(0, 12 - amountMonths);
     const status = amountMonths >= 12 ? '납부완료' : amountMonths === 0 ? '미납' : '일부납부';
     return { ...r, status, missing, effectiveMonths: amountMonths, isLumpSum };
   }
   // 매월 낸 기록이 그대로 있는 경우: 올해 지금까지 지난 달(maxMonth) 기준으로 계산합니다.
   const status = r.months.length >= maxMonth ? '납부완료' : r.months.length === 0 ? '미납' : '일부납부';
   const missing = Math.max(0, maxMonth - r.months.length);
   return { ...r, status, missing, effectiveMonths: r.months.length, isLumpSum };
 });
 const filtered=classified.filter(r=>{
   if(!norm(r.name).includes(norm(q))) return false;
   if(statusFilter==='all') return true;
   if(statusFilter==='missing') return r.missing>0; // 미확인월(미납월)이 있는 회원 = 일부납부 + 미납
   return r.status===statusFilter;
 });
 const counts={paid:classified.filter(r=>r.status==='납부완료').length,partial:classified.filter(r=>r.status==='일부납부').length,unpaid:classified.filter(r=>r.status==='미납').length};
 const missingCount=counts.partial+counts.unpaid;
 const filterLabel=statusFilter==='all'?'전체':statusFilter==='missing'?'미확인월 있는 회원':statusFilter;
 return <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">회비 현황 요약 (납부·미납)</h2><p className="text-sm text-slate-500 mt-1">연도별 실제 납부 기록을 기준으로 납부 상태를 자동 분류합니다. 아래 카드를 클릭하면 해당 상태의 명단만 볼 수 있습니다.</p></div><select value={year} onChange={e=>setYear(Number(e.target.value))} className="border rounded-lg px-4 py-2 font-semibold">{years.map(y=><option key={y} value={y}>{y}년</option>)}</select></div>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
   <Stat icon={<Users/>} label="조회 회원 (전체보기)" value={`${classified.length}명`} active={statusFilter==='all'} onClick={()=>setStatusFilter('all')}/>
   <Stat icon={<CheckCircle2/>} label="납부완료" value={`${counts.paid}명`} active={statusFilter==='납부완료'} onClick={()=>setStatusFilter('납부완료')}/>
   <Stat icon={<Clock3/>} label="일부납부" value={`${counts.partial}명`} active={statusFilter==='일부납부'} onClick={()=>setStatusFilter('일부납부')}/>
   <Stat icon={<AlertTriangle/>} label="납부기록 없음(미납)" value={`${counts.unpaid}명`} active={statusFilter==='미납'} onClick={()=>setStatusFilter('미납')}/>
  </div>
  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-900"><b>분류 기준:</b> 선택 연도의 납부 기록에서 월 정보가 확인되는 경우 월별 납부 여부를 계산합니다. 연납·일시납처럼 한 번에 낸 경우에는 연회비를 <b>{ANNUAL_FEE.toLocaleString()}원</b>(월 {MONTHLY_FEE.toLocaleString()}원)으로 고정해서, 낸 금액만큼 개월수로 환산하고 나머지({ANNUAL_FEE.toLocaleString()}원 - 낸 금액을 {MONTHLY_FEE.toLocaleString()}원으로 나눈 값)를 미확인월로 남깁니다. 예를 들어 한 번에 60만원을 냈다면 6개월분으로 인정되고 나머지 6개월이 미확인월로 표시됩니다. 실제 회비 규정이 월 {MONTHLY_FEE.toLocaleString()}원과 다르면 결과가 부정확할 수 있으니 확인해 주세요.</div>
  <section className="bg-white border rounded-xl shadow-sm p-5">
   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
    <div><h3 className="font-bold">{year}년 회원별 납부 상태</h3><p className="text-xs text-slate-500">현재 필터: <span className="font-semibold text-slate-700">{filterLabel}</span> · {filtered.length}명 표시 중</p></div>
    <div className="flex flex-wrap items-center gap-2">
     <button type="button" onClick={()=>setStatusFilter(statusFilter==='missing'?'all':'missing')} className={`shrink-0 whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${statusFilter==='missing'?'bg-amber-100 border-amber-400 text-amber-900':'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>미확인월 있는 회원만 ({missingCount}명)</button>
     {statusFilter!=='all' && <button type="button" onClick={()=>setStatusFilter('all')} className="shrink-0 whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">필터 해제</button>}
     <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="회원명 검색" className="pl-9 pr-3 py-2 border rounded-lg text-sm"/></div>
    </div>
   </div>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">회원명</th><th className="p-3 text-center">납부상태</th><th className="p-3 text-center">납부월</th><th className="p-3 text-center">미확인월</th><th className="p-3 text-right">납부액</th><th className="p-3 text-left">최근 납부일</th></tr></thead><tbody>{filtered.map(r=><tr key={r.k} className="border-t"><td className="p-3 font-medium">{r.name}</td><td className="p-3 text-center"><span className={r.status==='납부완료'?'text-emerald-700':r.status==='일부납부'?'text-amber-700':'text-red-700'}>{r.status}</span></td><td className="p-3 text-center">{r.isLumpSum?<span className="text-blue-700">일시납 {r.effectiveMonths}개월</span>:r.months.length?`${r.months.join(', ')}월`:'-'}</td><td className="p-3 text-center">{r.missing}개월</td><td className="p-3 text-right">{r.total.toLocaleString()}원</td><td className="p-3">{r.last?.date||r.last?.period||'-'}</td></tr>)}</tbody></table></div>{!filtered.length&&<div className="py-10 text-center text-slate-500">조회할 납부 자료가 없습니다.</div>}
  </section>
 </main>
}
const Stat=({icon,label,value,active,onClick}:{icon:React.ReactNode,label:string,value:string,active?:boolean,onClick?:()=>void})=><button type="button" onClick={onClick} className={`text-left w-full bg-white border rounded-xl p-5 shadow-sm transition-colors cursor-pointer hover:border-blue-300 ${active?'border-blue-500 ring-2 ring-blue-200':'border-slate-200'}`}><div className="text-blue-900 mb-2">{icon}</div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold mt-1">{value}</div></button>;
