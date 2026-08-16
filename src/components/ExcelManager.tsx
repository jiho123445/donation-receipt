import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, Trash2, CheckCircle2, AlertCircle, ShieldCheck, Database, FileText } from 'lucide-react';
import { RawDonationRecord } from '../types/donation';
import { parseDonationExcel, downloadSampleExcelTemplate, ParseResult } from '../utils/excelParser';

interface ExcelManagerProps {
  donations: RawDonationRecord[];
  onUpdateDonations: (records: RawDonationRecord[]) => Promise<{ total: number; added: number; duplicates: number }>;
  onClearDonations: () => void;
  onDeleteDonationsByMonth: (year: number, month: number) => Promise<number>;
}

export const ExcelManager: React.FC<ExcelManagerProps> = ({
  donations,
  onUpdateDonations,
  onClearDonations,
  onDeleteDonationsByMonth,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastParseResult, setLastParseResult] = useState<ParseResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);
  const [showDeleteMonthConfirm, setShowDeleteMonthConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files || []);
    const excelFiles = fileArray.filter((file) => /\.(xlsx|xls)$/i.test(file.name));

    if (excelFiles.length === 0) {
      setErrorMessage('Excel 파일(.xlsx 또는 .xls)을 하나 이상 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastParseResult(null);

    let totalAdded = 0;
    let totalDuplicates = 0;
    let totalRecords = 0;
    let failedFiles: string[] = [];

    try {
      for (const file of excelFiles) {
        try {
          const result = await parseDonationExcel(file);
          if (result.missingRequired.length > 0) {
            failedFiles.push(`${file.name}: 필수 열 ${result.missingRequired.join(', ')}`);
            continue;
          }
          if (result.records.length === 0) {
            failedFiles.push(`${file.name}: 유효한 후원 데이터가 없습니다.`);
            continue;
          }

          const saveResult = await onUpdateDonations(result.records);
          totalAdded += saveResult.added;
          totalDuplicates += saveResult.duplicates;
          totalRecords += result.records.length;
          setLastParseResult(result);
        } catch (fileError: any) {
          failedFiles.push(`${file.name}: ${fileError?.message || '파일 처리 오류'}`);
        }
      }

      if (totalRecords === 0 && failedFiles.length > 0) {
        throw new Error(failedFiles.join(' / '));
      }

      const suffix = failedFiles.length > 0
        ? ` 실패/제외 ${failedFiles.length}개 파일: ${failedFiles.join(' / ')}`
        : '';
      setSuccessMessage(
        `${excelFiles.length}개 파일 처리 완료: 신규 ${totalAdded.toLocaleString()}건을 누적했습니다. ` +
        `중복 ${totalDuplicates.toLocaleString()}건은 합산하지 않았습니다.${suffix}`
      );
    } catch (err: any) {
      setErrorMessage(err.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteSelectedMonth = async () => {
    if (selectedMonth === 'all') return;
    const [year, month] = selectedMonth.split('-').map(Number);
    setIsDeletingMonth(true);
    setErrorMessage(null);
    try {
      const deleted = await onDeleteDonationsByMonth(year, month);
      setSuccessMessage(`${year}년 ${month}월 자료 ${deleted.toLocaleString()}건을 삭제했습니다. 다른 월의 자료는 유지됩니다.`);
      setSelectedMonth('all');
    } catch (err: any) {
      setErrorMessage(err?.message || '월별 자료 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingMonth(false);
      setShowDeleteMonthConfirm(false);
    }
  };

  // Group unique donors for stats
  const availableMonths = Array.from(new Set(donations
    .map((d) => String(d.date || '').slice(0, 7))
    .filter((m) => /^\d{4}-\d{2}$/.test(m))))
    .sort((a, b) => b.localeCompare(a));
  const visibleDonations = selectedMonth === 'all'
    ? donations
    : donations.filter((d) => String(d.date || '').startsWith(`${selectedMonth}-`));
  const uniqueDonorNames = Array.from(new Set(visibleDonations.map((d) => `${d.donorName}-${d.address || d.idNumber}`)));
  const totalAmount = visibleDonations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Privacy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-900" />
            <span>엑셀 회원 명단 관리 및 연동</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            회원 명단 및 후원금 엑셀 파일을 브라우저에서 직접 읽어 안전하게 처리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>관리자 로그인 후 Firebase에 납부내역 누적 저장</span>
        </div>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all bg-white cursor-pointer ${
          isDragging
            ? 'border-blue-700 bg-blue-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-blue-800 hover:bg-slate-50/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx, .xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length) {
              handleFiles(e.target.files);
            }
          }}
        />

        <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-900 flex items-center justify-center mb-3 shadow-xs">
          <Upload className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {isProcessing ? '엑셀 파일을 분석하는 중입니다...' : '엑셀 파일을 여러 개 선택하거나 마우스로 끌어다 놓으세요'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          또는 클릭하여 여러 개의 .xlsx / .xls 파일을 한꺼번에 선택할 수 있습니다.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <span className="bg-slate-100 px-2 py-0.5 rounded border">성명 / 후원자명</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">주민(사업자)번호</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">주소</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">후원일자</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">후원금액</span>
          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">기부금유형·코드 선택</span>
        </div>
      </div>

      {/* Error Message */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">누적 저장 완료</div>
            <div className="mt-0.5">{successMessage}</div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">엑셀 파일 분석 오류</div>
            <div className="mt-0.5">{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Parse Result Summary */}
      {lastParseResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-900">
          <div className="flex items-center gap-2 font-bold text-emerald-800 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>엑셀 회원 명단 분석 완료 ({lastParseResult.totalRows}건 등록됨)</span>
          </div>
          <div className="text-[11px] text-emerald-700">
            인식된 열 항목: {Object.keys(lastParseResult.columnMapping).join(', ')}
          </div>
        </div>
      )}

      {/* Monthly management */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span>월별 납부자료 관리</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              이미 7월까지 저장되어 있다면 8월 파일만 올려도 7월 자료는 그대로 유지되고 8월 자료가 추가 누적됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="all">전체 월 보기</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month.slice(0, 4)}년 {Number(month.slice(5, 7))}월
                </option>
              ))}
            </select>
            {selectedMonth !== 'all' && (
              <button
                type="button"
                onClick={() => setShowDeleteMonthConfirm(true)}
                disabled={isDeletingMonth}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingMonth ? '삭제 중...' : '선택 월 자료 삭제'}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[11px] text-slate-500">선택 범위</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {selectedMonth === 'all' ? '전체 누적자료' : `${selectedMonth.slice(0, 4)}년 ${Number(selectedMonth.slice(5, 7))}월`}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[11px] text-slate-500">납부 건수</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{visibleDonations.length.toLocaleString()}건</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[11px] text-slate-500">납부 합계</div>
            <div className="text-sm font-bold text-blue-900 mt-1">{totalAmount.toLocaleString()}원</div>
          </div>
        </div>
      </div>

      {/* Current Data Overview & Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span>누적 저장된 회원 납부내역 현황</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              현재까지 누적 <strong className="text-blue-900">{donations.length.toLocaleString()}</strong>건의 후원내역 (후원자 <strong className="text-slate-900">{uniqueDonorNames.length.toLocaleString()}</strong>명, 총액 <strong className="text-slate-900">{totalAmount.toLocaleString()}</strong>원)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>표준 서식 다운로드 (.xlsx)</span>
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>회원 명단 초기화</span>
            </button>
          </div>
        </div>

        {/* Preview of Loaded Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
              <tr>
                <th className="px-3 py-2 border-b border-r border-slate-200">성명</th>
                <th className="px-3 py-2 border-b border-r border-slate-200">주민(사업자)번호</th>
                <th className="px-3 py-2 border-b border-r border-slate-200">주소</th>
                <th className="px-3 py-2 border-b border-r border-slate-200">후원일자</th>
                <th className="px-3 py-2 border-b border-r border-slate-200 text-right">후원금액</th>
                <th className="px-3 py-2 border-b border-r border-slate-200">후원방법</th>
                <th className="px-3 py-2 border-b border-slate-200">기부내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleDonations.slice(0, 8).map((rec, idx) => (
                <tr key={rec.id || idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-200">{rec.donorName}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono border-r border-slate-200">
                    {rec.idNumber ? `${rec.idNumber.slice(0, 8)}******` : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 border-r border-slate-200 truncate max-w-[180px]">{rec.address || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono border-r border-slate-200">{rec.date}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-900 font-mono border-r border-slate-200">
                    {rec.amount.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-slate-600 border-r border-slate-200">{rec.paymentMethod}</td>
                  <td className="px-3 py-2 text-slate-600">{rec.content || '후원금'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleDonations.length > 8 && (
            <div className="text-center text-xs text-slate-400 py-2">
              ... 외 {visibleDonations.length - 8}건의 후원자료가 더 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              후원자료를 메모리에서 완전히 삭제하시겠습니까?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              현재 불러온 후원자 및 후원내역이 브라우저 메모리에서 모두 삭제됩니다. (기존에 발급된 영수증 발급대장 내역은 보존됩니다.)
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onClearDonations();
                  setShowClearConfirm(false);
                  setLastParseResult(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs cursor-pointer"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteMonthConfirm && selectedMonth !== 'all' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">월별 자료 삭제</h3>
            <p className="text-sm text-slate-600 mt-2">
              {selectedMonth.slice(0, 4)}년 {Number(selectedMonth.slice(5, 7))}월의 납부자료만 삭제합니다.
              다른 월의 자료와 영수증 발급대장은 삭제되지 않습니다.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowDeleteMonthConfirm(false)} className="px-3 py-2 text-xs border rounded-md">취소</button>
              <button type="button" onClick={handleDeleteSelectedMonth} className="px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-md">삭제</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
