import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  Loader2,
  Search,
  Users,
  WalletCards,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DonationRecord {
  id: string;
  donorName?: string;
  amount?: number | string;
  content?: string;
  paymentMethod?: string;
  date?: string;
  period?: string;
}

interface AwardRecord {
  id: string;
  recipientName?: string;
  awardName?: string;
  year?: number | string;
  memberNo?: string;
}

interface MembershipStatusManagerProps {
  /** 기존 App.tsx 호환용. 실제 화면은 Firestore에서 직접 최신 데이터를 읽습니다. */
  donations?: unknown[];
}

const DISPLAY_YEARS = [2026, 2025];

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getDonationYear = (record: DonationRecord): number => {
  const raw = String(record.date || record.period || '');
  const match = raw.match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
};

const formatKRW = (amount: number) =>
  `${new Intl.NumberFormat('ko-KR').format(amount)}원`;

export const MembershipStatusManager: React.FC<MembershipStatusManagerProps> = () => {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [searchInput, setSearchInput] = useState('');
  const [searchedName, setSearchedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        if (!db) {
          throw new Error('Firebase Firestore가 설정되지 않았습니다.');
        }

        const [donationSnap, awardSnap] = await Promise.all([
          getDocs(collection(db, 'donations')),
          getDocs(collection(db, 'awards')),
        ]);

        if (cancelled) return;

        setDonations(
          donationSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<DonationRecord, 'id'>),
          }))
        );

        setAwards(
          awardSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<AwardRecord, 'id'>),
          }))
        );
      } catch (error) {
        console.error('통합현황 데이터 로딩 실패:', error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Firebase 데이터를 불러오지 못했습니다.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const membershipDonations = useMemo(
    () =>
      donations.filter((record) => {
        const content = String(record.content || '').trim();
        const paymentMethod = String(record.paymentMethod || '').trim();
        return content === '회비' || paymentMethod === '회비';
      }),
    [donations]
  );

  const yearlyStats = useMemo(
    () =>
      DISPLAY_YEARS.map((year) => {
        const yearDonations = membershipDonations.filter(
          (record) => getDonationYear(record) === year
        );

        const totalAmount = yearDonations.reduce(
          (sum, record) => sum + toNumber(record.amount),
          0
        );

        const memberCount = new Set(
          yearDonations
            .map((record) => String(record.donorName || '').trim())
            .filter(Boolean)
        ).size;

        const awardCount = awards.filter(
          (record) => toNumber(record.year) === year
        ).length;

        return {
          year,
          totalAmount,
          memberCount,
          awardCount,
        };
      }),
    [membershipDonations, awards]
  );

  const selectedYearDonations = useMemo(
    () =>
      membershipDonations.filter(
        (record) => getDonationYear(record) === selectedYear
      ),
    [membershipDonations, selectedYear]
  );

  const selectedYearMemberCount = useMemo(
    () =>
      new Set(
        selectedYearDonations
          .map((record) => String(record.donorName || '').trim())
          .filter(Boolean)
      ).size,
    [selectedYearDonations]
  );

  const selectedYearTotal = useMemo(
    () =>
      selectedYearDonations.reduce(
        (sum, record) => sum + toNumber(record.amount),
        0
      ),
    [selectedYearDonations]
  );

  const selectedYearAwardMembers = useMemo(
    () =>
      new Set(
        awards
          .filter((record) => toNumber(record.year) === selectedYear)
          .map((record) => String(record.recipientName || '').trim())
          .filter(Boolean)
      ).size,
    [awards, selectedYear]
  );

  const selectedYearAwardCount = useMemo(
    () =>
      awards.filter((record) => toNumber(record.year) === selectedYear)
        .length,
    [awards, selectedYear]
  );

  const normalizedSearch = searchedName.trim().toLowerCase();

  const searchedMemberDonations = useMemo(() => {
    if (!normalizedSearch) return [];

    return selectedYearDonations
      .filter(
        (record) =>
          String(record.donorName || '').trim().toLowerCase() ===
          normalizedSearch
      )
      .sort((a, b) =>
        String(a.date || a.period || '').localeCompare(
          String(b.date || b.period || '')
        )
      );
  }, [normalizedSearch, selectedYearDonations]);

  const searchedMemberAwards = useMemo(() => {
    if (!normalizedSearch) return [];

    return awards
      .filter(
        (record) =>
          String(record.recipientName || '').trim().toLowerCase() ===
          normalizedSearch
      )
      .sort((a, b) => toNumber(b.year) - toNumber(a.year));
  }, [normalizedSearch, awards]);

  const searchedDonationTotal = searchedMemberDonations.reduce(
    (sum, record) => sum + toNumber(record.amount),
    0
  );

  const latestPaymentDate =
    searchedMemberDonations.length > 0
      ? searchedMemberDonations[searchedMemberDonations.length - 1].date ||
        searchedMemberDonations[searchedMemberDonations.length - 1].period ||
        '-'
      : '-';

  const handleSearch = () => {
    setSearchedName(searchInput.trim());
  };

  return (
    <main className="w-full min-h-full bg-slate-100/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                회원·회비·수상 통합현황
              </h1>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                통합현황 v9
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              연도별 회비 납부현황과 회원별 수상실적을 통합 조회합니다.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <CalendarDays className="h-5 w-5 text-blue-700" />
            <span className="text-sm font-semibold text-slate-700">조회연도</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
            >
              {DISPLAY_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </div>
        </section>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Firebase 데이터 연결 오류: {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Firebase 데이터를 불러오는 중입니다.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Users className="h-6 w-6" />}
                label={`${selectedYear}년 납부 회원`}
                value={`${selectedYearMemberCount}명`}
              />
              <StatCard
                icon={<WalletCards className="h-6 w-6" />}
                label={`${selectedYear}년 회비 합계`}
                value={formatKRW(selectedYearTotal)}
              />
              <StatCard
                icon={<Award className="h-6 w-6" />}
                label={`${selectedYear}년 수상 회원`}
                value={`${selectedYearAwardMembers}명`}
              />
              <StatCard
                icon={<CalendarDays className="h-6 w-6" />}
                label={`${selectedYear}년 수상실적`}
                value={`${selectedYearAwardCount}건`}
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-900">연도별 비교 현황</h2>
                <p className="mt-1 text-xs text-slate-500">
                  2025년과 2026년 현황만 비교합니다.
                </p>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">연도</th>
                      <th className="px-4 py-3 text-right font-semibold">회비 합계</th>
                      <th className="px-4 py-3 text-center font-semibold">납부 회원</th>
                      <th className="px-4 py-3 text-center font-semibold">수상실적</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyStats.map((stat) => (
                      <tr key={stat.year} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {stat.year}년
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {formatKRW(stat.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {stat.memberCount}명
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {stat.awardCount}건
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    회원 납부현황 및 수상실적 현황
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    회원명을 입력하면 해당 회원의 {selectedYear}년 납부현황과 전체 수상 경력을 조회합니다.
                  </p>
                </div>

                <div className="flex w-full gap-2 lg:w-auto">
                  <div className="relative flex-1 lg:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSearch();
                      }}
                      placeholder="조회할 회원명 입력"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900"
                  >
                    조회
                  </button>
                </div>
              </div>

              {!searchedName ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  회원명을 입력하고 조회 버튼을 누르세요. 전체 회원 명단은 표시하지 않습니다.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                    <span className="text-sm text-slate-600">조회 회원</span>
                    <strong className="ml-2 text-lg text-slate-900">{searchedName}</strong>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <WalletCards className="h-5 w-5 text-blue-700" />
                      <h3 className="font-bold text-slate-900">
                        {selectedYear}년 납부현황
                      </h3>
                    </div>

                    {searchedMemberDonations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        {selectedYear}년 회비 납부 기록이 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <SummaryBox label="납부금액" value={formatKRW(searchedDonationTotal)} />
                          <SummaryBox label="납부횟수" value={`${searchedMemberDonations.length}회`} />
                          <SummaryBox label="최근 납부일" value={String(latestPaymentDate)} />
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[520px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                                <th className="px-3 py-2.5 font-semibold">납부일</th>
                                <th className="px-3 py-2.5 font-semibold">납부기간</th>
                                <th className="px-3 py-2.5 text-right font-semibold">금액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchedMemberDonations.map((record) => (
                                <tr key={record.id} className="border-b border-slate-100">
                                  <td className="px-3 py-2.5">{record.date || '-'}</td>
                                  <td className="px-3 py-2.5">{record.period || '-'}</td>
                                  <td className="px-3 py-2.5 text-right font-medium">
                                    {formatKRW(toNumber(record.amount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-600" />
                      <h3 className="font-bold text-slate-900">전체 수상 경력</h3>
                    </div>

                    {searchedMemberAwards.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        등록된 수상 경력이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchedMemberAwards.map((record) => (
                          <div
                            key={record.id}
                            className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {record.awardName || '수상명 미입력'}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                회원번호: {record.memberNo || '-'}
                              </div>
                            </div>
                            <div className="shrink-0 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                              {toNumber(record.year)}년 수상
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 text-blue-800">{icon}</div>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
  </div>
);

const SummaryBox: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-base font-bold text-slate-900">{value}</div>
  </div>
);

export default MembershipStatusManager;
