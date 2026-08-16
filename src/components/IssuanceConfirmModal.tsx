import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, Calendar, Building, User, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { RawDonationRecord, OrganizationInfo, IssuedReceiptRecord, ReceiptFormType } from '../types/donation';
import { formatKRW, numberToHangulAmount } from '../utils/hangulCurrency';

interface IssuanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  donorName: string;
  idNumber: string;
  address: string;
  taxYear: number;
  donations: RawDonationRecord[];
  orgInfo: OrganizationInfo;
  onConfirmIssuance: (
    formType: ReceiptFormType,
    issueDate: string,
    isReissue: boolean
  ) => Promise<{ success: boolean; error?: string } | void> | void;
  onViewExistingReceipt: (receipt: IssuedReceiptRecord) => void;
  onOpenOrgSettings: () => void;
  existingReceipts: IssuedReceiptRecord[];
}

export const IssuanceConfirmModal: React.FC<IssuanceConfirmModalProps> = ({
  isOpen,
  onClose,
  donorName,
  idNumber,
  address,
  taxYear,
  donations,
  orgInfo,
  onConfirmIssuance,
  onViewExistingReceipt,
  onOpenOrgSettings,
  existingReceipts,
}) => {
  const [formType, setFormType] = useState<ReceiptFormType>(
    donorName.includes('(주)') || donorName.includes('주식회사') || donorName.includes('법인') ? 'corporate' : 'individual'
  );
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [forceNewIssuance, setForceNewIssuance] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const koreanAmount = numberToHangulAmount(totalAmount);

  // Check for duplicate issuance in this tax year
  const existingReceipt =
    existingReceipts.find((r) => {
      if (r.status !== 'issued' || r.taxYear !== taxYear || r.donorName !== donorName) return false;
      if (idNumber && r.donorIdNumber && r.donorIdNumber === idNumber) return true;
      return !!address && !!r.donorAddress && r.donorAddress === address;
    }) || null;
  const isDuplicate = !!existingReceipt && !forceNewIssuance;

  // Check if organization statutory IDs are missing
  const isOrgIncomplete = !orgInfo.registrationNo && !orgInfo.bizNo;

  const handleConfirmClick = async () => {
    setLocalError(null);

    // 1. Check if organization statutory ID is missing
    if (isOrgIncomplete) {
      setLocalError('기부금영수증 발급에 필요한 단체 고유번호 또는 사업자등록번호가 등록되지 않았습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onConfirmIssuance(formType, issueDate, forceNewIssuance);
      if (result && typeof result === 'object' && !result.success && result.error) {
        setLocalError(result.error);
      }
    } catch (error) {
      console.error('영수증 발급 실패:', error);
      setLocalError('영수증 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-300" />
            <div>
              <h2 className="text-base font-bold">기부금영수증 발급 확인</h2>
              <p className="text-xs text-blue-200">후원금 내역을 확인하고 공식 법정 영수증을 작성합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Missing Org Statutory ID Warning / Error Banner */}
          {(isOrgIncomplete || localError) && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-4 text-xs text-rose-900 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm text-rose-950">
                    {localError || '기부금영수증 발급에 필요한 단체 고유번호 또는 사업자등록번호가 등록되지 않았습니다.'}
                  </div>
                  <p className="text-rose-800 leading-relaxed">
                    소득세법/법인세법 규정에 따라 영수증 발급자란에 고유번호 또는 사업자등록번호가 반드시 기재되어야 합니다.
                  </p>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onOpenOrgSettings}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md shadow-xs transition-colors cursor-pointer text-xs"
                >
                  <span>단체정보 입력으로 이동</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Duplicate Issuance Warning */}
          {isDuplicate && existingReceipt && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950">
                    이미 발급된 영수증이 존재합니다!
                  </h4>
                  <p className="mt-1 leading-relaxed">
                    <strong>{donorName}</strong>님의 <strong>{taxYear}년도</strong> 기부금영수증이 이미 발급되었습니다.
                  </p>
                  <div className="mt-1 font-mono text-[11px] text-amber-800">
                    기존 발급번호: <strong>{existingReceipt.receiptNo}</strong> (발급일: {existingReceipt.issueDate}, 금액: {formatKRW(existingReceipt.totalAmount)}원)
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onViewExistingReceipt(existingReceipt)}
                  className="px-3 py-1.5 bg-white border border-amber-400 rounded text-amber-900 font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  기존 영수증 확인
                </button>
                <button
                  type="button"
                  onClick={() => setForceNewIssuance(true)}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  새로 발급 (재발급)
                </button>
              </div>
            </div>
          )}

          {/* Form Selection (개인 vs 법인) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              적용 법정 서식 선택
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormType('individual')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  formType === 'individual'
                    ? 'border-blue-900 bg-blue-50/50 text-blue-950 font-bold ring-1 ring-blue-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <User className="w-4 h-4 text-blue-800" />
                  <span>개인 기부자 서식</span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                  소득세법 시행규칙 별지 제45호의2
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormType('corporate')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  formType === 'corporate'
                    ? 'border-blue-900 bg-blue-50/50 text-blue-950 font-bold ring-1 ring-blue-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Building className="w-4 h-4 text-blue-800" />
                  <span>법인/사업자 서식</span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                  법인세법 시행규칙 별지 제63호의3
                </div>
              </button>
            </div>
          </div>

          {/* Issuance Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">기부자 (성명/상호):</span>
              <span className="font-bold text-slate-900">{donorName}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">주민(사업자)번호:</span>
              <span className="font-mono text-slate-800">
                {idNumber ? `${idNumber.slice(0, 8)}******` : '-'}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">과세연도:</span>
              <span className="font-bold text-blue-900">{taxYear}년도</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">후원 건수:</span>
              <span className="font-semibold text-slate-800">{donations.length}건</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-200 bg-white px-2 rounded">
              <span className="text-slate-700 font-bold">총 기부금액:</span>
              <div className="text-right">
                <div className="text-sm font-extrabold text-blue-900 font-mono">
                  {formatKRW(totalAmount)}원
                </div>
                <div className="text-[11px] text-slate-500 font-serif">
                  ({koreanAmount})
                </div>
              </div>
            </div>

            {/* Issuance Date input */}
            <div className="flex justify-between items-center pt-1">
              <label className="text-slate-700 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>발급일자:</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-900"
              />
            </div>
          </div>

          <div className="text-center text-xs font-semibold text-slate-700 pt-1">
            "위 내용으로 기부금영수증을 발급하시겠습니까?"
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 cursor-pointer disabled:opacity-50"
            >
              취소
            </button>

            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>영수증 발급 및 미리보기</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
