import React, { useState, useEffect } from 'react';
import { X, Building2, ShieldAlert, Check, Save, Upload, Stamp, KeyRound } from 'lucide-react';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { OrganizationInfo } from '../types/donation';
import { OfficialSeal } from './OfficialSeal';

interface OrgSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgInfo: OrganizationInfo;
  onSave: (updated: OrganizationInfo) => void;
  user?: User | null;
}

export const OrgSettingsModal: React.FC<OrgSettingsModalProps> = ({
  isOpen,
  onClose,
  orgInfo,
  onSave,
  user,
}) => {
  const [formData, setFormData] = useState<OrganizationInfo>(orgInfo);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 비밀번호 변경 관련 상태
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isPwSaving, setIsPwSaving] = useState(false);

  useEffect(() => {
    setFormData(orgInfo);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError(null);
    setPwSuccess(false);
  }, [orgInfo, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof OrganizationInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({ ...prev, sealImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);

    if (!user || !user.email) {
      setPwError('로그인 정보가 없어 비밀번호를 변경할 수 없습니다. 다시 로그인한 후 시도해주세요.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('새 비밀번호와 확인이 서로 일치하지 않습니다.');
      return;
    }

    setIsPwSaving(true);
    try {
      // Firebase는 비밀번호 변경 전 최근 로그인(재인증)을 요구합니다.
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      const code: string = err?.code || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setPwError('현재 비밀번호가 올바르지 않습니다.');
      } else if (code.includes('weak-password')) {
        setPwError('비밀번호가 너무 약합니다. 6자 이상의 다른 비밀번호를 입력해주세요.');
      } else if (code.includes('requires-recent-login')) {
        setPwError('보안을 위해 다시 로그인한 후 비밀번호를 변경해주세요.');
      } else if (code.includes('too-many-requests')) {
        setPwError('시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setPwError(`비밀번호 변경 중 오류가 발생했습니다. (${code || err?.message || '알 수 없는 오류'})`);
      }
    } finally {
      setIsPwSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold">기부금단체 기본정보 및 법정 식별정보 설정</h2>
              <p className="text-xs text-slate-300">공식 기부금영수증 발급자란에 기재되는 기관 정보입니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner regarding statutory numbers */}
        <div className="bg-amber-50 border-b border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>[법정 식별번호 입력 안내]</strong> 고유번호, 사업자등록번호, 기부금단체 지정 관련 정보, 기부금 코드 등은 중요한 법정 식별정보입니다. 본 기관의 고유번호증 및 세무서 인가 문서를 확인하여 직접 입력해 주시기 바랍니다. (입력된 정보는 브라우저에 안전하게 저장됩니다.)
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 단체명 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                단체명 (법인명) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 font-medium"
              />
            </div>

            {/* 대표자 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                대표자 성명 (이사장) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.representative}
                onChange={(e) => handleChange('representative', e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 font-medium"
              />
            </div>

            {/* 주소 */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                소재지 (주소) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
              />
            </div>

            {/* 전화번호 & 사업내용 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                대표 전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.tel}
                onChange={(e) => handleChange('tel', e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                사업 내용
              </label>
              <input
                type="text"
                value={formData.businessContent}
                onChange={(e) => handleChange('businessContent', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
              />
            </div>

            {/* 법정 고유번호 / 사업자등록번호 */}
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>고유번호 (법인/단체)</span>
                <span className="text-[11px] font-normal text-slate-500">예: 221-82-00000</span>
              </label>
              <input
                type="text"
                placeholder="직접 입력하세요"
                value={formData.registrationNo}
                onChange={(e) => handleChange('registrationNo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>사업자등록번호</span>
                <span className="text-[11px] font-normal text-slate-500">예: 221-82-00000</span>
              </label>
              <input
                type="text"
                placeholder="직접 입력하세요"
                value={formData.bizNo}
                onChange={(e) => handleChange('bizNo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>

            {/* 기부금 유형 & 코드 */}
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>기부금 유형</span>
                <span className="text-[11px] font-normal text-slate-500">예: 지정기부금 / 공익법인기부금</span>
              </label>
              <input
                type="text"
                placeholder="예: 지정기부금 (또는 일반기부금)"
                value={formData.donationType}
                onChange={(e) => handleChange('donationType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>기부금 코드</span>
                <span className="text-[11px] font-normal text-slate-500">지정기부금/공익법인: 40</span>
              </label>
              <input
                type="text"
                placeholder="예: 40"
                value={formData.donationCode}
                onChange={(e) => handleChange('donationCode', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>

            {/* 기부금단체 지정 관련 정보 */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-blue-900 mb-1">
                기부금단체 지정 근거법령 / 지정 관련 정보
              </label>
              <input
                type="text"
                placeholder="예: 소득세법 시행령 제80조제1항제5호, 법인세법 시행령 제39조제1항제1호바목 공익법인"
                value={formData.designationInfo}
                onChange={(e) => handleChange('designationInfo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 기본 기부내용 적요 */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                기본 기부내용 (적요)
              </label>
              <input
                type="text"
                value={formData.defaultContent}
                onChange={(e) => handleChange('defaultContent', e.target.value)}
                placeholder="후원금"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Seal / Stamp setting */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Stamp className="w-4 h-4 text-red-600" />
              <span>영수증 날인 직인 (도장)</span>
            </label>
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-center">
                <OfficialSeal
                  name={`${formData.name}이사장인`}
                  customSealUrl={formData.sealImage}
                  size={56}
                />
              </div>
              <div className="text-xs text-slate-600 flex-1">
                <p className="font-semibold text-slate-800">
                  {formData.sealImage ? '사용자 등록 직인 이미지 사용 중' : '표준 디지털 전자직인 (기본 적용)'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  별도의 고화질 투명 PNG 직인 도장 파일이 있으신 경우 등록하실 수 있습니다.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>직인 이미지 업로드</span>
                    <input type="file" accept="image/*" onChange={handleSealUpload} className="hidden" />
                  </label>
                  {formData.sealImage && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, sealImage: undefined }))}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      기본 전자직인으로 복원
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Admin password management */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-700" />
              <span>관리자 비밀번호 변경</span>
            </label>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <p className="text-[11px] text-slate-500">
                로그인 계정({user?.email || '알 수 없음'})의 비밀번호를 변경합니다. 현재 비밀번호를 확인한 후 새 비밀번호로 변경됩니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (6자 이상)"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

              {pwError && (
                <p className="text-xs text-red-600 flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pwError}</span>
                </p>
              )}
              {pwSuccess && (
                <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>비밀번호가 변경되었습니다.</span>
                </p>
              )}

              <button
                type="button"
                onClick={handleChangePassword}
                disabled={isPwSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isPwSaving ? '변경 중...' : '비밀번호 변경하기'}</span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>저장 완료!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>설정 저장하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
