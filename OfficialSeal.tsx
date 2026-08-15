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

  // Authentic Korean traditional red official foundation seal (붉은색 법인 인장)
  return (
    <div
      className={`relative select-none flex items-center justify-center font-serif text-red-600 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      title="사단법인 너브내행복나눔재단 공식 직인"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-xs"
        style={{ color: '#dc2626' }}
      >
        {/* Double border circle */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        <circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />

        {/* Traditional Korean Seal Text Arrangement (너브내행복나눔재단 인장) */}
        <g
          fill="currentColor"
          fontFamily="'Noto Serif KR', serif"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {/* Top arch or 3x3 seal script layout */}
          <text x="50" y="24" fontSize="13" letterSpacing="1">
            사단법인
          </text>
          <text x="50" y="40" fontSize="13" letterSpacing="1">
            너브내행복
          </text>
          <text x="50" y="56" fontSize="13" letterSpacing="1">
            나눔재단
          </text>
          <text x="50" y="74" fontSize="14" letterSpacing="2" fontWeight="900">
            이사장인
          </text>
        </g>
      </svg>
    </div>
  );
};
