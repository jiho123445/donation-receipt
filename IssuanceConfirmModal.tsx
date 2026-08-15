import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, Calendar, Building, User, Info, ArrowRight } from 'lucide-react';
import { RawDonationRecord, OrganizationInfo, IssuedReceiptRecord, ReceiptFormType } from '../types/donation';
import { formatKRW, numberToHangulAmount } from '../utils/hangulCurrency';
import { findExistingReceipt } from '../utils/storage';

interface IssuanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  donorName: string;
  idNumber: string;
  address: string;
  taxYear: number;
  donations: RawDonationRecord[];
  orgInfo: OrganizationInfo;
  onConfirmIssuance: (formType: ReceiptFormType, issueDate: string, isReissue: boolean) => void;
  onViewExistingReceipt: (receipt: IssuedReceiptRecord) => void;
  onOpenOrgSettings: () => void;
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
}) => {
  const [formType, setFormType] = useState<ReceiptFormType>(
    donorName.includes('(주)') || donorName.includes('주식회사') || donorName.includes('법인') ? 'corporate' : 'individual'
  );
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [forceNewIssuance, setForceNewIssuance] = useState(false);

  if (!isOpen) return null;

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const koreanAmount = numberToHangulAmount(totalAmount);

  // Check for duplicate issuance in this tax year
  const existingReceipt = findExistingReceipt(donorName, idNumber, address, taxYear);
  const isDuplicate = !!existingReceipt && !forceNewIssuance;

  // Check if organization statutory IDs are missing
  const isOrgIncomplete = !orgInfo.registrationNo && !orgInfo.bizNo;

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

          {/* Missing Org Statutory ID Warning */}
          {isOrgIncomplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">재단 고유번호/사업자번호 미등록:</span> 영수증에 표기될 법정 식별번호가 아직 입력되지 않았습니다.
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenOrgSettings}
                className="shrink-0 text-xs font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
              >
                단체정보 입력
              </button>
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
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 cursor-pointer"
            >
              취소
            </button>

            <button
              type="button"
              onClick={() => onConfirmIssuance(formType, issueDate, forceNewIssuance)}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>영수증 발급 및 미리보기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
