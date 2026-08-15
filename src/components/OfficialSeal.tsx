import React from 'react';

interface OfficialSealProps {
  name?: string;
  size?: number;
  customSealUrl?: string;
  className?: string;
}

export const OfficialSeal: React.FC<OfficialSealProps> = ({
  name = '사단법인너브내행복나눔재단이사장인',
  size = 68,
  customSealUrl,
  className = '',
}) => {
  if (customSealUrl) {
    return (
      <img
        src={customSealUrl}
        alt="재단 직인"
        className={`object-contain ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded border border-dashed border-slate-400 text-[10px] text-slate-500 bg-white ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      title="실제 직인 이미지를 등록해 주세요"
    >
      직인 미등록
    </div>
  );
};
