import React, { useMemo, useState } from 'react';
import { Users, Wallet, Award, Search, CalendarDays, BarChart3 } from 'lucide-react';
import type { RawDonationRecord, AwardRecord } from '../types/donation';
import { getAwardName, getAwardOrganization, getAwardRecipientName, getAwardYear } from '../utils/awardCompatibility';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const yearOf = (d: RawDonationRecord) => Number((d.date || d.period || '').slice(0, 4)) || 0;

export const ManagementDashboard: React.FC<{ donations: RawDonationRecord[]; awards: AwardRecord[] }> = ({ donations, awards }) => {
  const [q, setQ] = useState('');
  const [searchedName, setSearchedName] = useState('');
  const currentYear = new Date().getFullYear();

  const years = useMemo(
    () => Array.from(new Set([
      ...donations.map(yearOf),
      ...awards.map(a => getAwardYear(a)),
    ].filter(y => y > 0))).sort((a, b) => b - a),
    [donations, awards]
  );

  const [selectedYear, setSelectedYear] = useState<number | string>(currentYear);

  const yearDonations = useMemo(
    () => selectedYear === 'all' ? donations : donations.filter(d => yearOf(d) === selectedYear),
    [donations, selectedYear]
  );

  const yearAwards = useMemo(
    () => selectedYear === 'all' ? awards : awards.filter(a => getAwardYear(a) === selectedYear),
    [awards, selectedYear]
  );

  const donors = useMemo(() => {
    const names = new Set(
      yearDonations.map(d => normalize(d.donorName || '')).filter(Boolean)
    );
    return names.size;
  }, [yearDonations]);

  const total = yearDonations.reduce((s, d) => s + d.amount, 0);
  const awardPeople = useMemo(
    () => new Set(yearAwards.map(a => normalize(getAwardRecipientName(a))).filter(Boolean)).size,
    [yearAwards]
  );

  const selectedMember = useMemo(() => {
    const key = normalize(searchedName);
    if (!key) return null;

    const allNames = new Map<string, string>();
    donations.forEach(d => {
      const name = String(d.donorName || '').trim();
      if (name) allNames.set(normalize(name), name);
    });
    awards.forEach(a => {
      const name = getAwardRecipientName(a);
      if (name) allNames.set(normalize(name), name);
    });

    const exact = allNames.get(key);
    if (!exact) return null;

    const rows = yearDonations.filter(d => normalize(d.donorName || '') === key);
    return {
      name: exact,
      rows,
      total: rows.reduce((sum, d) => sum + d.amount, 0),
    };
  }, [searchedName, donations, awards, yearDonations]);

  // 요청사항: 비교표에는 2026년과 2025년만 고정 표시
  const compareYears = [2026, 2025].map(year => {
    const ds = donations.filter(d => yearOf(d) === year);
    const as = awards.filter(a => getAwardYear(a) === year);
    return {
      year,
      amount: ds.reduce((s, d) => s + d.amount, 0),
      people: new Set(ds.map(d => normalize(d.donorName || '')).filter(Boolean)).size,
      awards: as.length,
    };
  });

  const title = selectedYear === 'all' ? '전체기간' : `${selectedYear}년`;

  const doSearch = () => setSearchedName(q.trim());
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSearch();
  };

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">회원·회비·수상 통합현황</h2>
            <span className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">통합현황 v8</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">연도를 선택하여 해당 연도의 회비·후원 및 수상실적을 통합 조회합니다.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <CalendarDays className="w-5 h-5 text-blue-700" />
          <label className="text-sm font-medium">조회연도</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <option value="all">전체기간</option>
            {!years.includes(currentYear) && <option value={currentYear}>{currentYear}년</option>}
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card icon={<Users />} label={`${title} 납부 회원`} value={`${donors}명`} />
        <Card icon={<Wallet />} label={`${title} 회비/후원 합계`} value={`${total.toLocaleString()}원`} />
        <Card icon={<Award />} label={`${title} 수상 회원`} value={`${awardPeople}명`} />
        <Card icon={<CalendarDays />} label={`${title} 수상실적`} value={`${yearAwards.length}건`} />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-700" />
          <div>
            <h3 className="font-bold text-slate-900">연도별 비교 현황</h3>
            <p className="text-xs text-slate-500">2025년과 2026년 현황만 비교합니다.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">연도</th>
                <th className="text-right p-3">회비/후원금</th>
                <th className="text-center p-3">납부 회원</th>
                <th className="text-center p-3">수상실적</th>
              </tr>
            </thead>
            <tbody>
              {compareYears.map(r => (
                <tr key={r.year} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-bold">{r.year}년</td>
                  <td className="p-3 text-right">{r.amount.toLocaleString()}원</td>
                  <td className="p-3 text-center">{r.people}명</td>
                  <td className="p-3 text-center">{r.awards}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">회원 납부현황 및 수상실적 현황</h3>
            <p className="text-xs text-slate-500">회원명을 정확히 조회하면 해당 회원 1명의 선택 연도 납부현황과 전체 수상 경력을 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="조회할 회원명 입력"
                className="pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button onClick={doSearch} className="px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-medium hover:bg-blue-800">조회</button>
          </div>
        </div>

        {!searchedName ? (
          <div className="py-10 text-center text-slate-500">회원명을 입력하고 조회 버튼을 누르세요. 전체 회원 명단은 표시하지 않습니다.</div>
        ) : !selectedMember ? (
          <div className="py-10 text-center text-slate-500">일치하는 회원을 찾을 수 없습니다. 성명을 정확히 입력해 주세요.</div>
        ) : (() => {
          const recent = [...selectedMember.rows].sort((a, b) => (b.date || b.period || '').localeCompare(a.date || a.period || ''))[0];
          const career = awards
            .filter(a => normalize(getAwardRecipientName(a)) === normalize(selectedMember.name))
            .map(a => ({
              year: getAwardYear(a),
              name: getAwardName(a),
              org: getAwardOrganization(a),
              event: String(a.eventName || '').trim(),
            }))
            .sort((a, b) => b.year - a.year);

          return (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3">회원명</th>
                      <th className="text-right p-3">{title} 납부액</th>
                      <th className="text-center p-3">납부 건수</th>
                      <th className="text-left p-3">최근 납부일</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-3 font-semibold">{selectedMember.name}</td>
                      <td className="p-3 text-right">{selectedMember.total.toLocaleString()}원</td>
                      <td className="p-3 text-center">{selectedMember.rows.length}건</td>
                      <td className="p-3 text-slate-600">{recent?.date || recent?.period || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 font-semibold text-slate-800">전체 수상 경력</div>
                {career.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">등록된 수상실적이 없습니다.</div>
                ) : (
                  <ul className="divide-y">
                    {career.map((a, i) => (
                      <li key={i} className="p-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <span className="font-bold text-blue-800 min-w-16">{a.year ? `${a.year}년` : '연도 미확인'}</span>
                        <span className="font-medium">{a.name || '수상명 미확인'}</span>
                        {a.event && <span className="text-sm text-slate-500">행사: {a.event}</span>}
                        {a.org && <span className="text-sm text-slate-500">수여기관: {a.org}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })()}
      </section>
    </main>
  );
};

const Card = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <div className="text-blue-900 mb-3">{icon}</div>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-xl font-bold mt-1">{value}</div>
  </div>
);
