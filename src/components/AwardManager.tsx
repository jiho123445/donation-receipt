import React, { useMemo, useRef, useState } from 'react';
import { Award, Upload, Download, RefreshCw, Trash2, CheckCircle2, AlertCircle, ShieldCheck, Database } from 'lucide-react';
import { AwardRecord } from '../types/donation';
import { parseAwardExcel, downloadSampleAwardExcelTemplate, AwardParseResult } from '../utils/awardParser';
import { INITIAL_SAMPLE_AWARDS, AWARD_SEED_SOURCE_LABEL } from '../utils/awardSeedData';

interface AwardManagerProps {
  awards: AwardRecord[];
  onUpdateAwards: (records: AwardRecord[]) => Promise<{ total: number; added: number; duplicates: number }>;
  onClearAwards: () => Promise<{ deleted: number }>;
  onLoadSeedAwards: () => Promise<{ total: number; added: number; duplicates: number }>;
}

export const AwardManager: React.FC<AwardManagerProps> = ({
  awards,
  onUpdateAwards,
  onClearAwards,
  onLoadSeedAwards,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingSeed, setIsLoadingSeed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastParseResult, setLastParseResult] = useState<AwardParseResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uniqueRecipientCount = useMemo(
    () => new Set(awards.map((a) => a.recipientName.trim())).size,
    [awards]
  );
  const yearsPresent = useMemo(() => {
    const years: number[] = Array.from(new Set(awards.map((rec) => rec.year)));
    return years.sort((yearA, yearB) => yearB - yearA);
  }, [awards]);

  const handleFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files).filter((file) => /\.(xlsx|xls)$/i.test(file.name));
    if (selectedFiles.length === 0) {
      setErrorMessage('Excel 파일(.xlsx 또는 .xls)만 업로드할 수 있습니다.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastParseResult(null);

    try {
      const allRecords: AwardRecord[] = [];
      const errors: string[] = [];
      let lastResult: AwardParseResult | null = null;

      for (const file of selectedFiles) {
        try {
          const result = await parseAwardExcel(file);
          if (result.records.length === 0) {
            errors.push(`${file.name}: 실제 수상 기록이 있는 행이 없습니다.`);
            continue;
          }
          allRecords.push(...result.records);
          lastResult = result;
        } catch (fileError: any) {
          errors.push(`${file.name}: ${fileError?.message || '분석 실패'}`);
        }
      }

      if (allRecords.length === 0) {
        throw new Error(errors.length ? errors.join(' / ') : '유효한 수상내역이 발견되지 않았습니다.');
      }

      const saveResult = await onUpdateAwards(allRecords);
      setLastParseResult(lastResult ? { ...lastResult, records: allRecords, totalRows: allRecords.length } : null);

      const skippedText = errors.length > 0 ? ` / 확인 필요 ${errors.length}개 파일` : '';
      setSuccessMessage(
        `수상내역 ${allRecords.length.toLocaleString()}건 분석 → 신규 ${saveResult.added.toLocaleString()}건 추가 → 최종 누적 ${saveResult.total.toLocaleString()}건${skippedText}`
      );
      if (errors.length > 0) setErrorMessage(errors.join(' / '));
    } catch (err: any) {
      setErrorMessage(err.message || '수상내역 엑셀을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSeed = async () => {
    setIsLoadingSeed(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await onLoadSeedAwards();
      setSuccessMessage(
        `${AWARD_SEED_SOURCE_LABEL} 불러오기 완료: 신규 ${result.added.toLocaleString()}건 추가 → 최종 누적 ${result.total.toLocaleString()}건`
      );
    } catch (err: any) {
      setErrorMessage(err.message || '수상내역 샘플을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingSeed(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Privacy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-900" />
            <span>회원 표창(수상) 내역 관리 및 조회</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            "연번 / 성명 + 연도별 컬럼" 형식의 표창명단 엑셀을 올리면, 회원 검색 화면에서 이름으로 수상내역을 함께 조회할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>관리자 로그인 후 Firebase에 수상내역 누적 저장</span>
        </div>
      </div>

      {/* Quick load: attached 2024 award list */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-blue-900">{AWARD_SEED_SOURCE_LABEL} 불러오기</h3>
          <p className="text-xs text-blue-800 mt-0.5">
            첨부된 표창명단 PDF를 옮겨 담은 {INITIAL_SAMPLE_AWARDS.length.toLocaleString()}건의 수상내역을 한 번에 불러옵니다. (이미 등록된 항목은 중복 저장되지 않습니다)
          </p>
        </div>
        <button
          onClick={handleLoadSeed}
          disabled={isLoadingSeed}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-60 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSeed ? 'animate-spin' : ''}`} />
          <span>{isLoadingSeed ? '불러오는 중...' : '표창명단 불러오기'}</span>
        </button>
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
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
          }}
        />

        <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-900 flex items-center justify-center mb-3 shadow-xs">
          <Upload className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {isProcessing ? '표창명단 엑셀을 분석하는 중입니다...' : '표창명단 엑셀을 선택하거나 마우스로 끌어다 놓으세요'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          또는 클릭하여 .xlsx / .xls 파일을 선택할 수 있습니다. (연도가 늘어나면 오른쪽에 연도 열을 추가해서 올려주세요)
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <span className="bg-slate-100 px-2 py-0.5 rounded border">연번</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">성명</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">2024 / 2023 / 2022 ... (연도별 컬럼)</span>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">저장 완료</div>
            <div className="mt-0.5">{successMessage}</div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">수상내역 처리 오류</div>
            <div className="mt-0.5">{errorMessage}</div>
          </div>
        </div>
      )}

      {lastParseResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900">
          <div className="font-bold mb-1">엑셀 처리 결과</div>
          <div className="text-[11px] text-blue-700">
            인식된 서식: {lastParseResult.format === 'wide' ? '가로형 (연도별 컬럼)' : '세로형 (성명/연도/수상내역)'} · 인식된 연도: {lastParseResult.yearsDetected.join(', ') || '-'}
          </div>
        </div>
      )}

      {/* Current Data Overview */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span>누적 저장된 수상내역 현황</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              현재까지 누적 <strong className="text-blue-900">{awards.length.toLocaleString()}</strong>건의 수상내역 (수상자 <strong className="text-slate-900">{uniqueRecipientCount.toLocaleString()}</strong>명, 수상연도 <strong className="text-slate-900">{yearsPresent.join(', ') || '-'}</strong>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleAwardExcelTemplate}
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
              <span>수상내역 초기화</span>
            </button>
          </div>
        </div>

        {/* Preview of Loaded Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
              <tr>
                <th className="px-3 py-2 border-b border-r border-slate-200 w-14">연번</th>
                <th className="px-3 py-2 border-b border-r border-slate-200">성명</th>
                <th className="px-3 py-2 border-b border-r border-slate-200 w-20">연도</th>
                <th className="px-3 py-2 border-b border-slate-200">수상내역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {awards
                .slice()
                .sort((a, b) => b.year - a.year || a.recipientName.localeCompare(b.recipientName))
                .map((rec, idx) => (
                  <tr key={rec.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 font-mono border-r border-slate-200">{rec.memberNo || '-'}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-200">{rec.recipientName}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono border-r border-slate-200">{rec.year}</td>
                    <td className="px-3 py-2 text-slate-700">{rec.awardName}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {awards.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-6 border border-dashed border-slate-200 rounded-lg mt-2">
              아직 등록된 수상내역이 없습니다. 위의 [표창명단 불러오기] 버튼을 누르거나 엑셀 파일을 업로드해주세요.
            </div>
          )}
          {awards.length > 0 && (
            <div className="text-center text-xs text-slate-400 py-2">
              총 {awards.length.toLocaleString()}건의 누적 수상내역을 모두 표시하고 있습니다.
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
              Firebase의 수상내역까지 전체 초기화하시겠습니까?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <strong className="text-red-700">현재 Firebase의 awards 컬렉션에 저장된 모든 수상내역이 영구적으로 삭제됩니다.</strong>
              <br />
              후원내역(donations), 발급된 영수증(receipts) 등 다른 자료는 삭제하지 않습니다.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  setIsClearing(true);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  try {
                    const result = await onClearAwards();
                    setShowClearConfirm(false);
                    setLastParseResult(null);
                    setSuccessMessage(`수상내역 초기화 완료: ${result.deleted.toLocaleString()}건 삭제됨. 현재 누적 0건입니다.`);
                  } catch (err: any) {
                    setErrorMessage(`수상내역 초기화 실패: ${err?.message || String(err)}`);
                  } finally {
                    setIsClearing(false);
                  }
                }}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? '삭제 중...' : '수상내역 전체 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
