import React, { useMemo, useState } from 'react';
import { Users, Wallet, Award, AlertTriangle, Search, CalendarDays } from 'lucide-react';
import type { RawDonationRecord, AwardRecord } from '../types/donation';

const normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
const yearOf=(d:RawDonationRecord)=>Number((d.date||d.period||'').slice(0,4))||0;

export const ManagementDashboard:React.FC<{donations:RawDonationRecord[];awards:AwardRecord[]}> = ({donations,awards})=>{
 const [q,setQ]=useState(''); const year=new Date().getFullYear();
 const donors=useMemo(()=>{const m=new Map<string,RawDonationRecord[]>(); donations.forEach(d=>{const k=`${normalize(d.donorName)}|${d.idNumber||d.address}`; m.set(k,[...(m.get(k)||[]),d])}); return [...m.entries()].map(([k,rows])=>({k,name:rows[0].donorName,rows,total:rows.reduce((s,x)=>s+x.amount,0)})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));},[donations]);
 const thisYear=donations.filter(d=>yearOf(d)===year);
 const total=thisYear.reduce((s,d)=>s+d.amount,0);
 const awardPeople=new Set(awards.map(a=>normalize(a.recipientName))).size;
 const filtered=donors.filter(x=>normalize(x.name).includes(normalize(q))).slice(0,20);
 return <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
  <div><h2 className="text-2xl font-bold text-slate-900">회원·회비·수상 통합현황</h2><p className="text-sm text-slate-500 mt-1">기존 데이터는 유지하면서 회원별 회비 및 수상실적을 한 화면에서 관리합니다.</p></div>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
   <Card icon={<Users/>} label="등록 회원(추정)" value={`${donors.length}명`} />
   <Card icon={<Wallet/>} label={`${year}년 회비/후원 합계`} value={`${total.toLocaleString()}원`} />
   <Card icon={<Award/>} label="수상 회원" value={`${awardPeople}명`} />
   <Card icon={<CalendarDays/>} label="전체 수상실적" value={`${awards.length}건`} />
  </div>
  <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"><div><h3 className="font-bold text-slate-900">회원 통합 검색</h3><p className="text-xs text-slate-500">이름을 검색하면 회비/후원 누계와 수상실적을 함께 확인합니다.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="회원명 검색" className="pl-9 pr-3 py-2 border rounded-lg text-sm"/></div></div>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-3">회원명</th><th className="text-right p-3">전체 납부액</th><th className="text-center p-3">납부 건수</th><th className="text-center p-3">수상실적</th><th className="text-left p-3">최근 납부일</th></tr></thead><tbody>{filtered.map(x=>{const name=normalize(x.name);const ac=awards.filter(a=>normalize(a.recipientName)===name).length;const recent=[...x.rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];return <tr key={x.k} className="border-t"><td className="p-3 font-medium">{x.name}</td><td className="p-3 text-right">{x.total.toLocaleString()}원</td><td className="p-3 text-center">{x.rows.length}건</td><td className="p-3 text-center">{ac}건</td><td className="p-3 text-slate-600">{recent?.date||recent?.period||'-'}</td></tr>})}</tbody></table></div>
   {q && filtered.length===0 && <div className="py-8 text-center text-slate-500">검색 결과가 없습니다.</div>}
  </section>
  <section className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0"/><div className="text-sm text-amber-900"><b>데이터 관리 안내:</b> 현재 기존 자료의 수상내역은 성명 기반으로 표시됩니다. 동명이인 문제를 완전히 제거하려면 향후 회원 마스터의 고유 memberId를 수상 자료에 연결해야 합니다.</div></section>
 </main>
}
const Card=({icon,label,value}:{icon:React.ReactNode;label:string;value:string})=><div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"><div className="text-blue-900 mb-3">{icon}</div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold mt-1">{value}</div></div>;
