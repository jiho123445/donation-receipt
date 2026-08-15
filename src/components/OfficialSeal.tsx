import React from 'react';

interface OfficialSealProps {
  name?: string;
  size?: number;
  customSealUrl?: string;
  className?: string;
}

export const OfficialSeal: React.FC<OfficialSealProps> = ({
  size = 64,
  customSealUrl,
  className = '',
}) => {
  if (!customSealUrl) {
    return null;
  }

  return (
    <img
      src={customSealUrl}
      alt="직인"
      className={`object-contain pointer-events-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};
