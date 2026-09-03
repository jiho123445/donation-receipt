import React from 'react';
import { Building2, FileText, Settings, Printer, AlertTriangle, Wallet, Award, LayoutDashboard, WalletCards, UserCog, LogOut } from 'lucide-react';
import { OrganizationInfo } from '../types/donation';

interface HeaderProps {
  activeTab: 'dashboard' | 'feeStatus' | 'search' | 'membership' | 'history' | 'awards' | 'members' | 'settings' | 'print';
  setActiveTab: (tab: 'dashboard' | 'feeStatus' | 'search' | 'membership' | 'history' | 'awards' | 'members' | 'settings' | 'print') => void;
  orgInfo: OrganizationInfo;
  donorCount?: number;
  recordCount?: number;
  issuedCount?: number;
  openSettingsModal: () => void;
  onResetSearch?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  orgInfo,
  openSettingsModal,
  onResetSearch,
  onLogout,
}) => {
  const isMissingStatutory = !orgInfo.registrationNo && !orgInfo.bizNo;

  const handleLogoClick = () => {
    setActiveTab('search');
    onResetSearch?.();
  };

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top institution bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title - Clicking '사단법인' or Title resets to clean search home screen */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none group hover:opacity-90 transition-opacity"
            onClick={handleLogoClick}
            title="클릭 시 기부금영수증 초기 검색화면으로 이동합니다"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:bg-blue-800 transition-colors">
              <Building2 className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-blue-50 text-blue-800 border border-blue-200 group-hover:bg-blue-100 transition-colors">
                  사단법인
                </span>
                <span className="text-xs text-slate-500 font-medium">사회복지법인 행정전산</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-blue-950">
                {orgInfo.name} <span className="text-blue-900 font-extrabold">행정관리시스템</span>
              </h1>
            </div>
          </div>

          {/* Statutory warning badge if applicable */}
          <div className="flex items-center gap-3 text-xs">
            {isMissingStatutory && (
              <button
                onClick={openSettingsModal}
                className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-md hover:bg-amber-100 transition-colors animate-pulse cursor-pointer"
                title="고유번호/사업자등록번호 등 법정 정보를 입력해주세요"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-semibold">고유번호 미입력</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-y-1 border-t border-slate-100">
          <nav className="flex flex-wrap items-center gap-1 py-1.5" aria-label="메인 메뉴">
            <button onClick={() => setActiveTab('dashboard')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><LayoutDashboard className="w-4 h-4"/><span>통합현황</span></button>
            <button onClick={() => setActiveTab('feeStatus')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${activeTab === 'feeStatus' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><WalletCards className="w-4 h-4"/><span>회비 현황 요약</span></button>

            <button
              onClick={() => setActiveTab('membership')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'membership'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>회비 조회·발급</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('search');
                onResetSearch?.();
              }}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>기부금영수증 발급</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>발급내역 관리</span>
            </button>

            <button
              onClick={() => setActiveTab('awards')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'awards'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>수상내역 관리</span>
            </button>

            <button onClick={() => setActiveTab('members')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${activeTab === 'members' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><UserCog className="w-4 h-4"/><span>회원관리</span></button>
          </nav>

          {/* Quick utility action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('print')}
              className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>인쇄설정</span>
            </button>

            <button
              onClick={openSettingsModal}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                isMissingStatutory
                  ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>재단/단체정보</span>
            </button>

            {onLogout && (
              <button
                onClick={() => {
                  if (window.confirm('로그아웃 하시겠습니까?')) {
                    onLogout();
                  }
                }}
                className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-red-600" />
                <span>로그아웃</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
