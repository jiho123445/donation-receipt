import React, { useState, useMemo } from 'react';
import { Search, UserCheck, Users, Calendar, FileText, CheckCircle2, AlertCircle, ArrowRight, Upload, Building2 } from 'lucide-react';
import { RawDonationRecord, DonorGroup, OrganizationInfo } from '../types/donation';
import { formatKRW, numberToHangulAmount, maskIdNumber } from '../utils/hangulCurrency';

interface DonorSearchProps {
  donations: RawDonationRecord[];
  orgInfo: OrganizationInfo;
  onStartIssuance: (donor: { donorName: string; idNumber: string; address: string; taxYear: number; donations: RawDonationRecord[] }) => void;
  onOpenExcel: () => void;
  onOpenHistory: () => void;
  onOpenOrgSettings: () => void;
  onOpenPrintSettings: () => void;
}

export const DonorSearch: React.FC<DonorSearchProps> = ({
  donations,
  orgInfo,
  onStartIssuance,
  onOpenExcel,
  onOpenHistory,
  onOpenOrgSettings,
  onOpenPrintSettings,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchedName, setSearchedName] = useState<string | null>(null);
  const [selectedDonorKey, setSelectedDonorKey] = useState<string | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(2026);

  // Group raw donations into unique donors (keyed by Name + (ID or Address))
  const donorGroups = useMemo(() => {
    const map = new Map<string, DonorGroup>();

    for (const rec of donations) {
      // Create a composite identifier
      const key = `${rec.donorName.trim()}__${rec.idNumber?.trim() || rec.address?.trim() || 'default'}`;
      const recYear = parseInt(rec.date.split('-')[0], 10) || 2026;

      if (!map.has(key)) {
        map.set(key, {
          donorKey: key,
          donorName: rec.donorName.trim(),
          idNumber: rec.idNumber?.trim() || '',
          address: rec.address?.trim() || '',
          isBusiness: rec.donorName.includes('(주)') || rec.donorName.includes('주식회사') || rec.donorName.includes('법인') || /^\d{3}-\d{2}-\d{5}$/.test(rec.idNumber || ''),
          donations: [rec],
          years: [recYear],
          totalAllTime: rec.amount,
        });
      } else {
        const group = map.get(key)!;
        group.donations.push(rec);
        if (!group.years.includes(recYear)) {
          group.years.push(recYear);
        }
        group.totalAllTime += rec.amount;
      }
    }

    return Array.from(map.values());
  }, [donations]);

  // Handle Search Submission
  const handleSearch = (nameToSearch?: string) => {
    const target = (nameToSearch !== undefined ? nameToSearch : searchInput).trim();
    if (!target) return;
    setSearchedName(target);
    setSelectedDonorKey(null);

    // If exact single match found across groups, auto-select
    const matched = donorGroups.filter((g) => g.donorName.toLowerCase() === target.toLowerCase());
    if (matched.length === 1) {
      setSelectedDonorKey(matched[0].donorKey);
      // Auto pick latest year from this donor's donations
      const latestYear = Math.max(...matched[0].years, 2026);
      setSelectedTaxYear(latestYear);
    }
  };

  // Find all matched donors for current search query
  const matchedDonors = useMemo(() => {
    if (!searchedName) return [];
    return donorGroups.filter((g) =>
      g.donorName.toLowerCase().includes(searchedName.toLowerCase())
    );
  }, [searchedName, donorGroups]);

  // Selected donor group object
  const activeDonor = useMemo(() => {
    if (!selectedDonorKey) return null;
    return donorGroups.find((g) => g.donorKey === selectedDonorKey) || null;
  }, [selectedDonorKey, donorGroups]);

  // Active donor donations filtered by selected tax year
  const yearDonations = useMemo(() => {
    if (!activeDonor) return [];
    return activeDonor.donations.filter((d) => {
      const y = parseInt(d.date.split('-')[0], 10);
      return y === selectedTaxYear;
    });
  }, [activeDonor, selectedTaxYear]);

  const yearTotalAmount = useMemo(() => {
    return yearDonations.reduce((sum, d) => sum + d.amount, 0);
  }, [yearDonations]);

  // Available tax years across this donor's history
  const donorYears = useMemo(() => {
    if (!activeDonor) return [2026];
    const yrs = Array.from(new Set(activeDonor.donations.map((d) => parseInt(d.date.split('-')[0], 10)))) as number[];
    if (!yrs.includes(2026)) yrs.push(2026);
    return yrs.sort((a, b) => b - a);
  }, [activeDonor]);

  const handleSelectHomonym = (donor: DonorGroup) => {
    setSelectedDonorKey(donor.donorKey);
    const latestYear = Math.max(...donor.years, 2026);
    setSelectedTaxYear(latestYear);
  };

  const handleTriggerIssuance = () => {
    if (!activeDonor || yearDonations.length === 0) return;
    onStartIssuance({
      donorName: activeDonor.donorName,
      idNumber: activeDonor.idNumber,
      address: activeDonor.address,
      taxYear: selectedTaxYear,
      donations: yearDonations,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Top Section - Foundation Title & Excel Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs text-center relative overflow-hidden">
        <div className="text-xs font-semibold tracking-wider text-blue-900 uppercase mb-1">
          사단법인 너브내행복나눔재단
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          기부금영수증 발급시스템
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
          후원자 이름을 입력하면 Excel 후원자료에서 후원내역을 자동 계산하여 법정 서식(A4)으로 발급합니다.
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs">
          <button
            onClick={onOpenExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-900 font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Excel 파일 불러오기</span>
          </button>
          <div className="text-slate-600">
            현재 후원건수: <strong className="text-blue-900 font-bold">{donations.length.toLocaleString()}건</strong>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-slate-600">
            현재 후원자 수: <strong className="text-slate-900 font-bold">{donorGroups.length.toLocaleString()}명</strong>
          </div>
        </div>
      </div>

      {/* 2. Main Search Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="text-center sm:text-left">
          <label htmlFor="donor-search-input" className="block text-sm font-bold text-slate-900 mb-1">
            후원자의 이름을 입력하세요
          </label>
          <p className="text-xs text-slate-500">
            성명을 입력하신 후 검색 버튼을 누르거나 Enter를 치세요.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="donor-search-input"
              type="text"
              placeholder="예: 홍길동, 김철수, 이영희, (주)홍천희망기업"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm border-2 border-slate-300 rounded-lg focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 font-medium placeholder:text-slate-400"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm rounded-lg shadow-sm transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>검색</span>
          </button>
        </form>
      </div>

      {/* 3. Search Results State */}

      {/* CASE A: No results found */}
      {searchedName && matchedDonors.length === 0 && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            '{searchedName}' 후원자를 찾을 수 없습니다.
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            성명이 정확한지 확인하시거나, [Excel 파일 불러오기] 메뉴에서 해당 후원자가 포함된 최신 엑셀 자료를 업로드해주세요.
          </p>
          <button
            onClick={onOpenExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer mt-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Excel 관리에서 자료 확인</span>
          </button>
        </div>
      )}

      {/* CASE B: Multiple Matches (동명이인 처리) */}
      {searchedName && matchedDonors.length > 1 && !activeDonor && (
        <div className="bg-white p-6 rounded-xl border-2 border-amber-300 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-amber-900 pb-2 border-b border-amber-200">
            <Users className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold">동명이인이 있습니다. 정확한 후원자를 선택하세요.</h3>
              <p className="text-xs text-amber-700">
                동일한 성명의 후원자가 {matchedDonors.length}명 검색되었습니다. 주소와 후원내역을 확인 후 선택해주세요.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12">선택</th>
                  <th className="px-4 py-2.5">성명</th>
                  <th className="px-4 py-2.5">주소 (소재지)</th>
                  <th className="px-4 py-2.5">주민(사업자)번호</th>
                  <th className="px-4 py-2.5">최근 후원일</th>
                  <th className="px-4 py-2.5 text-right">총 후원금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matchedDonors.map((donor) => {
                  const latestDate = donor.donations
                    .map((d) => d.date)
                    .sort()
                    .pop();

                  return (
                    <tr
                      key={donor.donorKey}
                      onClick={() => handleSelectHomonym(donor)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name="homonym-select"
                          checked={selectedDonorKey === donor.donorKey}
                          onChange={() => handleSelectHomonym(donor)}
                          className="accent-blue-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{donor.donorName}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{donor.address ? donor.address.split(" ").slice(0, 3).join(" ") + (donor.address.split(" ").length > 3 ? "…" : "") : "-"}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{maskIdNumber(donor.idNumber)}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{latestDate}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-900 font-mono">
                        {formatKRW(donor.totalAllTime)}원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CASE C: Single Active Donor Selected -> Full Information & Issuance View */}
      {activeDonor && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-200">
          {/* Homonym Re-selection notice if multiple exists */}
          {matchedDonors.length > 1 && (
            <div className="bg-amber-50 px-6 py-2.5 text-xs text-amber-900 flex items-center justify-between border-b border-amber-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>동명이인 {matchedDonors.length}명 중 선택된 후원자 정보입니다.</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedDonorKey(null)}
                className="font-bold underline hover:text-amber-950 cursor-pointer"
              >
                다른 동명이인 선택
              </button>
            </div>
          )}

          {/* Header summary */}
          <div className="p-6 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                  {activeDonor.isBusiness ? '법인/단체 기부자' : '개인 기부자'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  식별번호: {maskIdNumber(activeDonor.idNumber)}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-900" />
                <span>{activeDonor.donorName}</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                주소: {activeDonor.address || '미등록'}
              </p>
            </div>

            {/* Tax Year Picker & Big Total Badge */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                  기부금영수증 과세연도
                </label>
                <select
                  value={selectedTaxYear}
                  onChange={(e) => setSelectedTaxYear(parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-md bg-slate-50 text-blue-900 focus:ring-2 focus:ring-blue-900"
                >
                  {donorYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}년도
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-right pl-3 border-l border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">
                  {selectedTaxYear}년 후원금 합계
                </div>
                <div className="text-lg font-extrabold text-blue-900 font-mono">
                  {formatKRW(yearTotalAmount)}원
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span>{selectedTaxYear}년도 상세 후원내역 ({yearDonations.length}건)</span>
              </h4>
              <span className="text-xs text-slate-500 font-serif">
                {numberToHangulAmount(yearTotalAmount)}
              </span>
            </div>

            {yearDonations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                {selectedTaxYear}년도에는 납부된 후원내역이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">후원일자</th>
                      <th className="px-4 py-2.5">납부방법</th>
                      <th className="px-4 py-2.5">기부내용 (적요)</th>
                      <th className="px-4 py-2.5">기부금유형/코드</th>
                      <th className="px-4 py-2.5 text-right">후원금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {yearDonations.map((d, idx) => (
                      <tr key={d.id || idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-700">{d.date}</td>
                        <td className="px-4 py-2.5 text-slate-600">{d.paymentMethod}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-medium">{d.content || '후원금'}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {d.donationType || orgInfo.donationType || '-'} ({d.donationCode || orgInfo.donationCode || '-'})
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatKRW(d.amount)}원
                        </td>
                      </tr>
                    ))}
                    {/* Sum Footer */}
                    <tr className="bg-blue-50/50 font-bold border-t-2 border-slate-300">
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-700">
                        {selectedTaxYear}년 총 후원금액 합계 :
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-extrabold text-blue-900 font-mono">
                        {formatKRW(yearTotalAmount)}원
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchedName(null);
                  setSelectedDonorKey(null);
                  setSearchInput('');
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
              >
                다른 후원자 검색
              </button>

              <button
                type="button"
                onClick={handleTriggerIssuance}
                disabled={yearDonations.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg shadow-md transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>공식 기부금영수증 발급</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom Quick Action Bar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          빠른 행정 메뉴
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenHistory}
            className="p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-900">발급내역 관리</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">기존 발급대장 조회 및 재인쇄</div>
          </button>

          <button
            onClick={onOpenOrgSettings}
            className="p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-900">재단/단체정보</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">고유번호 및 직인 설정</div>
          </button>

          <button
            onClick={onOpenExcel}
            className="p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-900">Excel 관리</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">엑셀 업로드 및 샘플 서식</div>
          </button>

          <button
            onClick={onOpenPrintSettings}
            className="p-3 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-900">인쇄설정</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">A4 여백 및 출력 배율 조정</div>
          </button>
        </div>
      </div>
    </div>
  );
};
