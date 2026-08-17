import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, Trash2, CheckCircle2, AlertCircle, ShieldCheck, Database, FileText } from 'lucide-react';
import { RawDonationRecord } from '../types/donation';
import { parseDonationExcel, downloadSampleExcelTemplate, ParseResult } from '../utils/excelParser';

interface ExcelManagerProps {
  donations: RawDonationRecord[];
  onUpdateDonations: (records: RawDonationRecord[]) => Promise<{ total: number; added: number; duplicates: number }>;
  onClearDonations: () => Promise<{ deleted: number }>;
  onLoadSample: () => void;
}

export const ExcelManager: React.FC<ExcelManagerProps> = ({
  donations,
  onUpdateDonations,
  onClearDonations,
  onLoadSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastParseResult, setLastParseResult] = useState<ParseResult | null>(null);
  const [lastSaveResult, setLastSaveResult] = useState<{ total: number; added: number; duplicates: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setLastSaveResult(null);

    try {
      const allRecords: RawDonationRecord[] = [];
      const allMappings: Record<string, string> = {};
      const errors: string[] = [];
      let totalRows = 0;

      for (const file of selectedFiles) {
        try {
          const result = await parseDonationExcel(file);
          if (result.missingRequired.length > 0) {
            errors.push(`${file.name}: 필수 열 ${result.missingRequired.join(', ')}`);
            continue;
          }
          if (result.records.length === 0) {
            errors.push(`${file.name}: 성명과 후원금액이 있는 유효한 행이 없습니다.`);
            continue;
          }
          allRecords.push(...result.records);
          totalRows += result.records.length;
          Object.entries(result.columnMapping).forEach(([k, v]) => {
            allMappings[`${file.name} - ${k}`] = v;
          });
        } catch (fileError: any) {
          errors.push(`${file.name}: ${fileError?.message || '분석 실패'}`);
        }
      }

      if (allRecords.length === 0) {
        throw new Error(errors.length ? errors.join(' / ') : '유효한 후원 데이터가 발견되지 않았습니다. 성명과 후원금액이 있는 행인지 확인해주세요.');
      }

      const saveResult = await onUpdateDonations(allRecords);
      setLastSaveResult(saveResult);
      setLastParseResult({
        records: allRecords,
        columnMapping: allMappings,
        missingRequired: [],
        totalRows,
      });

      const skippedText = errors.length > 0 ? ` / 확인 필요 ${errors.length}개 파일` : '';
      setSuccessMessage(
        `${selectedFiles.length}개 파일 분석 ${allRecords.length.toLocaleString()}건 → 신규 ${saveResult.added.toLocaleString()}건 추가 → 중복 ${saveResult.duplicates.toLocaleString()}건 제외 → 최종 누적 ${saveResult.total.toLocaleString()}건${skippedText}`
      );
      if (errors.length > 0) setErrorMessage(errors.join(' / '));
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = () => {
    onLoadSample();
    setLastParseResult(null);
    setLastSaveResult(null);
    setErrorMessage(null);
  };

  // Group unique donors for stats
  const uniqueDonorNames = Array.from(new Set(donations.map((d) => `${d.donorName}-${d.address || d.idNumber}`)));
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

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
            if (e.target.files && e.target.files.length > 0) {
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
          또는 클릭하여 .xlsx / .xls 파일을 여러 개 선택할 수 있습니다.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <span className="bg-slate-100 px-2 py-0.5 rounded border">성명 / 후원자명</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">주민(사업자)번호</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">주소</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">후원일자(선택)</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded border">후원금액</span>
          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">기부금유형·코드 선택</span>
        </div>
      </div>

      {/* Import Diagnostics */}
      {lastParseResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900">
          <div className="font-bold mb-2">엑셀 처리 결과</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-white rounded border p-2">
              <div className="text-slate-500">엑셀에서 읽음</div>
              <div className="font-bold text-base">{lastParseResult.records.length.toLocaleString()}건</div>
            </div>
            <div className="bg-white rounded border p-2">
              <div className="text-slate-500">신규 저장</div>
              <div className="font-bold text-base">{lastSaveResult?.added ?? '-'}건</div>
            </div>
            <div className="bg-white rounded border p-2">
              <div className="text-slate-500">중복 제외</div>
              <div className="font-bold text-base">{lastSaveResult?.duplicates ?? '-'}건</div>
            </div>
            <div className="bg-white rounded border p-2">
              <div className="text-slate-500">처리 후 누적</div>
              <div className="font-bold text-base">{donations.length.toLocaleString()}건</div>
            </div>
            <div className="bg-white rounded border p-2">
              <div className="text-slate-500">총 후원금</div>
              <div className="font-bold text-base">{donations.reduce((sum, d) => sum + Number(d.amount || 0), 0).toLocaleString()}원</div>
            </div>
          </div>
        </div>
      )}

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
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
              title="홍길동 3건, 김철수, 이영희, 동명이인 홍길동 등 테스트용 샘플 불러오기"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>샘플 데이터 불러오기</span>
            </button>

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
              {donations.map((rec, idx) => (
                <tr key={rec.id || idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-200">{rec.donorName}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono border-r border-slate-200">
                    {rec.idNumber ? `${rec.idNumber.slice(0, 8)}******` : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 border-r border-slate-200 truncate max-w-[180px]">{rec.address || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono border-r border-slate-200">{rec.date || rec.period || '-'}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-900 font-mono border-r border-slate-200">
                    {rec.amount.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-slate-600 border-r border-slate-200">{rec.paymentMethod}</td>
                  <td className="px-3 py-2 text-slate-600">{rec.content || '후원금'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center text-xs text-slate-400 py-2">
            총 {donations.length.toLocaleString()}건의 누적 후원자료를 모두 표시하고 있습니다.
          </div>
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
              Firebase의 후원내역까지 전체 초기화하시겠습니까?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <strong className="text-red-700">현재 Firebase의 donations 컬렉션에 저장된 모든 후원내역이 영구적으로 삭제됩니다.</strong>
              <br />
              삭제 대상은 <strong>후원내역(donations)만</strong>이며, 후원자 기본정보(donors), 발급된 영수증(receipts), 발급이력(issuedReceipts), 단체정보 및 일련번호는 삭제하지 않습니다.
              <br />
              삭제가 성공한 뒤 화면도 0건으로 초기화됩니다. 이후 Excel을 다시 올리면 깨끗한 상태에서 새로 저장됩니다.
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
                    const result = await onClearDonations();
                    setShowClearConfirm(false);
                    setLastParseResult(null);
                    setLastSaveResult(null);
                    setSuccessMessage(`Firebase 후원내역 초기화 완료: ${result.deleted.toLocaleString()}건 삭제됨. 현재 누적 0건입니다.`);
                  } catch (err: any) {
                    setErrorMessage(`Firebase 후원내역 초기화 실패: ${err?.message || String(err)}`);
                  } finally {
                    setIsClearing(false);
                  }
                }}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? 'Firebase 삭제 중...' : 'Firebase 후원내역 전체 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
