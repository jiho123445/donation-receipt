import React, { useState, useMemo } from 'react';
import { FileText, Search, Printer, Download, Ban, Eye, CheckCircle, AlertCircle, Calendar, RotateCcw } from 'lucide-react';
import { IssuedReceiptRecord } from '../types/donation';
import { formatKRW } from '../utils/hangulCurrency';
import { exportIssuedReceiptsToExcel } from '../utils/excelParser';

interface IssuanceHistoryProps {
  receipts: IssuedReceiptRecord[];
  onSelectReceipt: (receipt: IssuedReceiptRecord) => void;
  onCancelReceipt: (receiptNo: string) => void;
}

export const IssuanceHistory: React.FC<IssuanceHistoryProps> = ({
  receipts,
  onSelectReceipt,
  onCancelReceipt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [cancelTargetNo, setCancelTargetNo] = useState<string | null>(null);
  // '초기화'는 실제 발급 데이터를 삭제하지 않고, 화면 표시만 초기화합니다.
  // 탭을 이동했다가 다시 돌아와도 초기화 상태가 유지되도록 sessionStorage에 보관합니다.
  const [isViewCleared, setIsViewCleared] = useState(() => {
    try {
      return sessionStorage.getItem('neobne_issuance_history_cleared') === '1';
    } catch {
      return false;
    }
  });

  // Available tax years in range up to 2050 (sorted ascending)
  const availableYears = useMemo(() => {
    const defaultRange = Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i);
    const receiptYears = receipts.map((r) => r.taxYear).filter((y) => !isNaN(y));
    const merged = new Set([...defaultRange, ...receiptYears]);
    return Array.from(merged).sort((a, b) => a - b);
  }, [receipts]);

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    if (isViewCleared) return [];
    return receipts.filter((r) => {
      if (selectedYear !== 'all' && r.taxYear !== parseInt(selectedYear, 10)) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      return (
        r.donorName.toLowerCase().includes(term) ||
        r.receiptNo.toLowerCase().includes(term) ||
        r.issueDate.includes(term) ||
        String(r.taxYear).includes(term)
      );
    });
  }, [receipts, selectedYear, searchTerm, isViewCleared]);

  // 상단 통계도 현재 선택한 연도와 화면 초기화 상태를 동일하게 적용합니다.
  const totalActiveIssued = useMemo(() => {
    if (isViewCleared) return [];
    return receipts.filter((r) => {
      if (r.status !== 'issued') return false;
      if (selectedYear !== 'all' && r.taxYear !== parseInt(selectedYear, 10)) return false;
      return true;
    });
  }, [receipts, selectedYear, isViewCleared]);

  const displayedCount = totalActiveIssued.length;
  const displayedAmount = totalActiveIssued.reduce((sum, r) => sum + r.totalAmount, 0);

  const handleResetView = () => {
    setIsViewCleared(true);
    setSelectedYear('all');
    setSearchTerm('');
    try {
      sessionStorage.setItem('neobne_issuance_history_cleared', '1');
    } catch {
      // sessionStorage가 차단된 환경에서도 화면 초기화는 정상 동작합니다.
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // 초기화 후 '전체 연도'가 아니라 실제 연도를 선택했을 때만 내역을 다시 표시합니다.
    if (year !== 'all') {
      setIsViewCleared(false);
      try {
        sessionStorage.removeItem('neobne_issuance_history_cleared');
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleRestoreAll = () => {
    setIsViewCleared(false);
    setSelectedYear('all');
    try {
      sessionStorage.removeItem('neobne_issuance_history_cleared');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">총 발급 건수</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {displayedCount.toLocaleString()} <span className="text-xs font-normal text-slate-500">건</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">총 발급 금액</div>
            <div className="text-xl font-extrabold text-emerald-900 font-mono mt-0.5">
              {formatKRW(displayedAmount)} <span className="text-xs font-normal text-slate-500">원</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">발급대장 엑셀 백업</div>
            <div className="text-xs text-slate-600 mt-0.5">국세청 보관용 대장 출력</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportIssuedReceiptsToExcel(receipts)}
              disabled={receipts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="발급된 영수증 전체 내역을 엑셀로 다운로드합니다."
            >
              <Download className="w-4 h-4" />
              <span>대장 다운로드</span>
            </button>
            <button
              onClick={isViewCleared ? handleRestoreAll : handleResetView}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                isViewCleared
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
              title={
                isViewCleared
                  ? '전체 발급 내역을 다시 화면에 표시합니다. (실제 발급 데이터는 삭제되지 않았습니다.)'
                  : '화면 표시만 초기화합니다. 실제 발급 데이터는 삭제하지 않습니다. 초기화 후 연도를 선택하면 해당 연도 내역이 다시 표시됩니다.'
              }
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isViewCleared ? '내역 다시 불러오기' : '초기화'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="기부자 성명, 발급번호(2026-00001), 발급일자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>과세연도:</span>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-900"
          >
            <option value="all">전체 연도</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}년도
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">발급번호</th>
                <th className="px-4 py-3">발급일자</th>
                <th className="px-4 py-3">기부자 (성명/상호)</th>
                <th className="px-4 py-3">과세연도</th>
                <th className="px-4 py-3">서식구분</th>
                <th className="px-4 py-3 text-right">총 기부금액</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {isViewCleared ? (
                      <div className="space-y-2">
                        <RotateCcw className="w-8 h-8 mx-auto text-slate-400" />
                        <div className="text-sm font-bold text-slate-700">화면 발급내역이 초기화되었습니다.</div>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          화면 표시만 초기화되었으며, 실제 발급 데이터는 Firebase에 안전하게 보관되어 있습니다. 연도를 선택하면 해당 연도 내역을 다시 표시합니다.
                        </p>
                        <button
                          onClick={handleRestoreAll}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                        >
                          <span>전체 내역 다시 불러오기</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span>발급된 기부금영수증 내역이 없습니다.</span>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr key={r.receiptNo} className={`hover:bg-slate-50 ${r.status === 'cancelled' ? 'bg-slate-50/70 opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-blue-900">{r.receiptNo}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{r.issueDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{r.donorName}</div>
                      <div className="text-[10.5px] text-slate-400 font-mono">
                        {r.donorIdNumber ? `${r.donorIdNumber.slice(0, 8)}******` : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.taxYear}년</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10.5px] font-medium ${r.formType === 'corporate' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {r.formType === 'corporate' ? '법인세법' : '소득세법'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatKRW(r.totalAmount)}원
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.status === 'issued' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          <span>정상발급</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          <Ban className="w-3 h-3" />
                          <span>발급취소</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors cursor-pointer"
                          title="영수증 A4 미리보기 및 재인쇄"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>보기/재인쇄</span>
                        </button>
                        {r.status === 'issued' && (
                          <button
                            onClick={() => setCancelTargetNo(r.receiptNo)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            title="발급 취소 처리"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTargetNo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              영수증 발급을 취소(무효화)하시겠습니까?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              발급번호 <strong>{cancelTargetNo}</strong> 기부금영수증의 상태가 '발급취소'로 변경됩니다. (이력은 삭제되지 않고 안전하게 보존됩니다.)
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCancelTargetNo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onCancelReceipt(cancelTargetNo);
                  setCancelTargetNo(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs cursor-pointer"
              >
                발급취소 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
