import React, { useState, useMemo } from 'react';
import { Search, UserCheck, Users, Calendar, FileText, CheckCircle2, AlertCircle, ArrowRight, Upload, Building2, Download } from 'lucide-react';
import { RawDonationRecord, DonorGroup, OrganizationInfo } from '../types/donation';
import { formatKRW, numberToHangulAmount } from '../utils/hangulCurrency';
import { downloadSampleExcelTemplate } from '../utils/excelParser';

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

  // Group raw donations into unique donors.
  // 이름이 같더라도 주민/사업자번호가 서로 다르면 실제 동명이인으로 분리합니다.
  // 반대로 한쪽 자료에만 식별번호/주소가 있고 다른 자료가 비어 있으면
  // 동일인 후보로 묶어 누락된 프로필 정보를 보강합니다.
  const donorGroups = useMemo(() => {
    const norm = (v?: string) => (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normId = (v?: string) => norm(v).replace(/[-\s]/g, '');
    const isMissing = (v?: string) => {
      const value = norm(v);
      return !value || value === '-' || value === '—' || value === '미등록' || value === '없음' || value === '미기재' || value === '미입력';
    };
    const cleanId = (v?: string) => isMissing(v) ? '' : (v || '').trim();
    const cleanAddress = (v?: string) => isMissing(v) ? '' : (v || '').trim();
    const isBusinessId = (v?: string) => /^\d{10}$/.test(normId(v));
    const isBusinessName = (name?: string) => /\(주\)|주식회사|법인|유한회사|사단법인|재단법인|학교법인|협동조합/.test(name || '');

    const yearsOf = (rec: RawDonationRecord) => {
      const y = parseInt((rec.date || rec.period || '').slice(0, 4), 10);
      return Number.isFinite(y) ? y : 2026;
    };

    const makeGroup = (rec: RawDonationRecord, index: number): DonorGroup => ({
      donorKey: `${rec.donorName.trim()}__${normId(rec.idNumber) || norm(rec.address) || `group-${index}`}`,
      donorName: rec.donorName.trim(),
      idNumber: cleanId(rec.idNumber),
      address: cleanAddress(rec.address),
      isBusiness: isBusinessId(cleanId(rec.idNumber)) || isBusinessName(rec.donorName),
      donations: [],
      years: [],
      totalAllTime: 0,
    });

    const addToGroup = (group: DonorGroup, rec: RawDonationRecord) => {
      group.donations.push(rec);
      const incomingId = cleanId(rec.idNumber);
      const incomingAddress = cleanAddress(rec.address);
      if (!group.idNumber && incomingId) group.idNumber = incomingId;
      if (!group.address && incomingAddress) group.address = incomingAddress;
      if (incomingId) {
        group.isBusiness = isBusinessId(incomingId) || isBusinessName(group.donorName);
      }
      const year = yearsOf(rec);
      if (!group.years.includes(year)) group.years.push(year);
      group.totalAllTime += Number(rec.amount || 0);
    };

    // 1차: 성명별로 실제 식별번호가 있는 사람을 분리합니다.
    const byName = new Map<string, RawDonationRecord[]>();
    donations.forEach((rec) => {
      const key = norm(rec.donorName);
      if (!key) return;
      const arr = byName.get(key) || [];
      arr.push(rec);
      byName.set(key, arr);
    });

    const groups: DonorGroup[] = [];
    let groupIndex = 0;

    for (const [, recordsByName] of byName) {
      const identified = new Map<string, RawDonationRecord[]>();
      const blankId: RawDonationRecord[] = [];

      for (const rec of recordsByName) {
        const id = normId(rec.idNumber);
        if (id) {
          const arr = identified.get(id) || [];
          arr.push(rec);
          identified.set(id, arr);
        } else {
          blankId.push(rec);
        }
      }

      // 식별번호가 전혀 없는 이름은 주소 기준으로 그룹화합니다.
      // 주소가 하나뿐이면 주소 없는 자료도 그 그룹으로 편입합니다.
      if (identified.size === 0) {
        const addressGroups = new Map<string, DonorGroup>();
        const noAddress: RawDonationRecord[] = [];
        for (const rec of blankId) {
          const a = norm(rec.address);
          if (a) {
            let group = addressGroups.get(a);
            if (!group) {
              group = makeGroup(rec, groupIndex++);
              addressGroups.set(a, group);
              groups.push(group);
            }
            addToGroup(group, rec);
          } else {
            noAddress.push(rec);
          }
        }
        const onlyAddressGroup = addressGroups.size === 1 ? Array.from(addressGroups.values())[0] : null;
        if (onlyAddressGroup) {
          noAddress.forEach((r) => addToGroup(onlyAddressGroup, r));
        } else {
          noAddress.forEach((r) => {
            const group = makeGroup(r, groupIndex++);
            addToGroup(group, r);
            groups.push(group);
          });
        }
        continue;
      }

      // 식별번호가 정확히 하나라면, 번호가 없는 같은 이름 자료는
      // 기존에 누락된 동일인의 자료로 보고 그 그룹에 편입합니다.
      if (identified.size === 1) {
        const onlyRecords = Array.from(identified.values())[0];
        const group = makeGroup(onlyRecords[0], groupIndex++);
        onlyRecords.forEach((r) => addToGroup(group, r));
        blankId.forEach((r) => addToGroup(group, r));
        groups.push(group);
        continue;
      }

      // 식별번호가 2개 이상이면 실제 동명이인일 수 있으므로 각각 분리합니다.
      // 번호 없는 자료는 주소가 정확히 일치하는 그룹이 하나일 때만 해당 그룹에 편입합니다.
      const idGroups = new Map<string, DonorGroup>();
      for (const [id, recs] of identified) {
        const group = makeGroup(recs[0], groupIndex++);
        recs.forEach((r) => addToGroup(group, r));
        idGroups.set(id, group);
        groups.push(group);
      }

      for (const rec of blankId) {
        const ra = norm(cleanAddress(rec.address));
        const addressMatches = ra
          ? Array.from(idGroups.values()).filter((g) => norm(g.address) === ra)
          : [];
        if (addressMatches.length === 1) {
          addToGroup(addressMatches[0], rec);
          continue;
        }

        const group = makeGroup(rec, groupIndex++);
        addToGroup(group, rec);
        groups.push(group);
      }
    }

    return groups;
  }, [donations]);

  const getIdLabel = (donor: DonorGroup) => {
    const raw = (donor.idNumber || '').trim();
    if (!raw || raw === '-' || raw === '미등록') return '식별번호: 미등록';
    const compact = raw.replace(/[-\s]/g, '');
    const business = /^\d{10}$/.test(compact) || donor.isBusiness;
    const formatted = business && /^\d{10}$/.test(compact)
      ? `${compact.slice(0, 3)}-${compact.slice(3, 5)}-${compact.slice(5)}`
      : /^\d{13}$/.test(compact)
        ? `${compact.slice(0, 6)}-${compact.slice(6)}`
        : raw;
    return business ? `사업자등록번호: ${formatted}` : `주민등록번호: ${formatted}`;
  };

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
      return;
    }

    // (v13 수정) 완전일치가 없더라도, 이름 일부 검색(부분일치) 결과가 정확히 1명뿐이면
    // 화면에 아무것도 표시되지 않던 문제(빈 화면)를 막기 위해 그 1명도 바로 선택합니다.
    if (matched.length === 0) {
      const partial = donorGroups.filter((g) => g.donorName.toLowerCase().includes(target.toLowerCase()));
      if (partial.length === 1) {
        setSelectedDonorKey(partial[0].donorKey);
        const latestYear = Math.max(...partial[0].years, 2026);
        setSelectedTaxYear(latestYear);
      }
    }
  };

  // Find all matched donors for current search query (이름 일부만 포함해도 검색됨)
  const matchedDonors = useMemo(() => {
    if (!searchedName) return [];
    return donorGroups.filter((g) =>
      g.donorName.toLowerCase().includes(searchedName.toLowerCase())
    );
  }, [searchedName, donorGroups]);

  // (v13 수정) '동명이인'은 이름이 정확히 같은 경우에만 의미가 있으므로 별도로 구분합니다.
  // matchedDonors(부분일치)를 그대로 '동명이인'으로 표기하면, 예를 들어 '철수'로 검색했을 때
  // 이름이 전혀 다른 '김철수'와 '박철수민'까지 동명이인처럼 묶여 보이는 문제가 있었습니다.
  const exactMatches = useMemo(() => {
    if (!searchedName) return [];
    return donorGroups.filter((g) => g.donorName.toLowerCase() === searchedName.toLowerCase());
  }, [searchedName, donorGroups]);

  // 실제로 이름이 완전히 같은 후원자가 2명 이상일 때만 '동명이인' 케이스로 취급합니다.
  const isHomonymCase = exactMatches.length > 1;
  // 동명이인이 아니면서(=이름이 다른 사람들의 부분일치 검색이거나, 정확일치 1명 이하) 여러 결과가 있는 경우.
  const searchResultDonors = isHomonymCase ? exactMatches : matchedDonors;

  // Selected donor group object
  const activeDonor = useMemo(() => {
    if (!selectedDonorKey) return null;
    return donorGroups.find((g) => g.donorKey === selectedDonorKey) || null;
  }, [selectedDonorKey, donorGroups]);

  // Active donor donations filtered by selected tax year
  const yearDonations = useMemo(() => {
    if (!activeDonor) return [];
    return activeDonor.donations.filter((d) => {
      const y = parseInt((d.date || d.period || '').split('-')[0], 10);
      return y === selectedTaxYear;
    });
  }, [activeDonor, selectedTaxYear]);

  const yearTotalAmount = useMemo(() => {
    return yearDonations.reduce((sum, d) => sum + d.amount, 0);
  }, [yearDonations]);

  // Available tax years across this donor's history (supporting years up to 2050, sorted ascending)
  const donorYears = useMemo(() => {
    const defaultRange = Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i);
    if (!activeDonor) return defaultRange;
    const donorDonationYears = activeDonor.donations
      .map((d) => parseInt((d.date || d.period || '').split('-')[0], 10))
      .filter((y) => !isNaN(y));
    const merged = new Set([...defaultRange, ...donorDonationYears]);
    return Array.from(merged).sort((a, b) => a - b);
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
          회원명을 입력하면 회원 명단 자료에서 후원내역을 자동 계산하여 법정 서식(A4)으로 발급합니다.
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3 text-xs">
          <button
            onClick={onOpenExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-900 font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>회원 자료 명단</span>
          </button>
          <button
            onClick={() => downloadSampleExcelTemplate()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            title="회원 명단 작성 가이드 및 샘플 엑셀 서식을 다운로드합니다."
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>샘플 파일 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. Main Search Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="text-center sm:text-left">
          <label htmlFor="donor-search-input" className="block text-sm font-bold text-slate-900 mb-1">
            회원의 성명 또는 회사명을 입력하세요
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

      {/* CASE B: Multiple Matches (동명이인 처리 또는 부분일치 검색결과) */}
      {searchedName && searchResultDonors.length > 1 && !activeDonor && (
        <div className={`bg-white p-6 rounded-xl border-2 shadow-xs space-y-4 ${isHomonymCase ? 'border-amber-300' : 'border-slate-200'}`}>
          <div className={`flex items-center gap-2 pb-2 border-b ${isHomonymCase ? 'text-amber-900 border-amber-200' : 'text-slate-800 border-slate-200'}`}>
            <Users className={`w-5 h-5 ${isHomonymCase ? 'text-amber-600' : 'text-slate-500'}`} />
            <div>
              <h3 className="text-sm font-bold">
                {isHomonymCase
                  ? '동명이인이 있습니다. 정확한 후원자를 선택하세요.'
                  : `'${searchedName}'이(가) 포함된 후원자가 여러 명 검색되었습니다.`}
              </h3>
              <p className={`text-xs ${isHomonymCase ? 'text-amber-700' : 'text-slate-500'}`}>
                {isHomonymCase
                  ? `동일한 성명의 후원자가 ${searchResultDonors.length}명 검색되었습니다. 주소와 후원내역을 확인 후 선택해주세요.`
                  : `이름이 정확히 같지는 않지만 검색어를 포함하는 후원자 ${searchResultDonors.length}명입니다. 원하는 후원자를 선택해주세요.`}
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
                {searchResultDonors.map((donor) => {
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
                      <td className="px-4 py-3 text-slate-500 font-mono">{getIdLabel(donor).replace(/^.*?:\s*/, '')}</td>
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
          {/* Re-selection notice if multiple candidates existed */}
          {searchResultDonors.length > 1 && (
            <div className="bg-amber-50 px-6 py-2.5 text-xs text-amber-900 flex items-center justify-between border-b border-amber-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {isHomonymCase
                    ? `동명이인 ${searchResultDonors.length}명 중 선택된 후원자 정보입니다.`
                    : `검색결과 ${searchResultDonors.length}명 중 선택된 후원자 정보입니다.`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedDonorKey(null)}
                className="font-bold underline hover:text-amber-950 cursor-pointer"
              >
                {isHomonymCase ? '다른 동명이인 선택' : '다른 후원자 선택'}
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
                <span className="text-xs text-slate-600 font-mono font-semibold">
                  {getIdLabel(activeDonor)}
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
                        <td className="px-4 py-2.5 font-mono text-slate-700">{d.date || `${d.period || ''}`}</td>
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
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="text-sm font-bold text-slate-800 mb-3">
          빠른 행정 메뉴
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenHistory}
            className="p-3.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-sm font-bold text-slate-900">발급내역 관리</div>
            <div className="text-xs text-slate-600 mt-1">기존 발급대장 조회 및 재인쇄</div>
          </button>

          <button
            onClick={onOpenOrgSettings}
            className="p-3.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-sm font-bold text-slate-900">재단/단체정보</div>
            <div className="text-xs text-slate-600 mt-1">고유번호 및 직인 설정</div>
          </button>

          <button
            onClick={onOpenExcel}
            className="p-3.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-sm font-bold text-slate-900">엑셀 회원 명단 관리</div>
            <div className="text-xs text-slate-600 mt-1">엑셀 업로드 및 샘플 서식</div>
          </button>

          <button
            onClick={onOpenPrintSettings}
            className="p-3.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors cursor-pointer"
          >
            <div className="text-sm font-bold text-slate-900">인쇄설정</div>
            <div className="text-xs text-slate-600 mt-1">A4 여백 및 출력 배율 조정</div>
          </button>
        </div>
      </div>
    </div>
  );
};
