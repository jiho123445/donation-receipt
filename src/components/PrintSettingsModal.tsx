import React, { useState } from 'react';
import { X, Printer, RotateCcw, Save, Check, Sliders, Info } from 'lucide-react';
import { PrintSettings } from '../types/donation';
import { DEFAULT_PRINT_SETTINGS } from '../utils/storage';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintSettings;
  onSave: (updated: PrintSettings) => void;
}

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [current, setCurrent] = useState<PrintSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setCurrent(DEFAULT_PRINT_SETTINGS);
  };

  const handleSave = () => {
    onSave(current);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold">A4 인쇄 출력 위치 및 배율 미세조정</h2>
              <p className="text-xs text-slate-300">사용하시는 프린터 기종에 맞춰 영수증 위치를 조정합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              기본값(0mm, 0mm, 100%)으로도 일반 A4 프린터에서 완벽하게 1장으로 출력됩니다. 종이 여백이 맞지 않는 경우에만 1mm 단위로 미세조정하세요.
            </div>
          </div>

          {/* Slider 1: X offset */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                <span>가로 (X축) 위치 이동</span>
              </span>
              <span className="font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs font-bold">
                {current.offsetX > 0 ? `+${current.offsetX}` : current.offsetX} mm
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-12 text-left">좌 -10mm</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                value={current.offsetX}
                onChange={(e) => setCurrent((prev) => ({ ...prev, offsetX: parseInt(e.target.value, 10) }))}
                className="w-full accent-blue-900 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <span className="text-xs text-slate-500 w-12 text-right">우 +10mm</span>
            </div>
          </div>

          {/* Slider 2: Y offset */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                <span>세로 (Y축) 위치 이동</span>
              </span>
              <span className="font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs font-bold">
                {current.offsetY > 0 ? `+${current.offsetY}` : current.offsetY} mm
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-12 text-left">상 -10mm</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                value={current.offsetY}
                onChange={(e) => setCurrent((prev) => ({ ...prev, offsetY: parseInt(e.target.value, 10) }))}
                className="w-full accent-blue-900 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <span className="text-xs text-slate-500 w-12 text-right">하 +10mm</span>
            </div>
          </div>

          {/* Slider 3: Scale */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                <span>전체 인쇄 배율 (크기)</span>
              </span>
              <span className="font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs font-bold">
                {current.scale} %
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-12 text-left">95%</span>
              <input
                type="range"
                min="95"
                max="105"
                step="1"
                value={current.scale}
                onChange={(e) => setCurrent((prev) => ({ ...prev, scale: parseInt(e.target.value, 10) }))}
                className="w-full accent-blue-900 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <span className="text-xs text-slate-500 w-12 text-right">105%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded border border-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본값(0,0,100%) 복원</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>적용됨!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>설정 저장</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
