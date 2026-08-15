/**
 * Converts a numeric amount to formal Korean Hangul currency text.
 * Example:
 * 400000 -> "금 사십만원정"
 * 1250000 -> "금 일백이십오만원정" or "금 백이십오만원정"
 */

const HANGUL_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조', '경'];

export function numberToHangulAmount(num: number, prefix: boolean = true, suffix: boolean = true): string {
  if (num === 0) return prefix ? '금 영원정' : '영원';
  if (isNaN(num) || num < 0) return '';

  const rounded = Math.floor(num);
  let strNum = rounded.toString();
  let result = '';

  // Process 4 digits at a time from right to left
  const chunks: string[] = [];
  while (strNum.length > 0) {
    const chunk = strNum.slice(-4);
    chunks.push(chunk);
    strNum = strNum.slice(0, -4);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let chunkResult = '';
    const len = chunk.length;

    for (let j = 0; j < len; j++) {
      const digit = parseInt(chunk[len - 1 - j], 10);
      if (digit > 0) {
        // For digits, '일' is typically kept in formal legal documents (e.g., 일십만, 일백만)
        // In Korean legal forms, '일' is explicitly written: 일십, 일백, 일천
        const digitChar = HANGUL_DIGITS[digit];
        const unitChar = SMALL_UNITS[j];
        chunkResult = digitChar + unitChar + chunkResult;
      }
    }

    if (chunkResult.length > 0) {
      const bigUnit = BIG_UNITS[i];
      result = chunkResult + bigUnit + result;
    }
  }

  let finalStr = result;
  if (prefix) {
    finalStr = '금 ' + finalStr;
  }
  if (suffix) {
    finalStr = finalStr + '원정';
  }

  return finalStr;
}

/**
 * Format number with comma: 400000 -> 400,000
 */
export function formatKRW(amount: number): string {
  if (isNaN(amount)) return '0';
  return amount.toLocaleString('ko-KR');
}

/**
 * Mask resident registration number or business registration number
 * Example:
 * 700101-1234567 -> 700101-1******
 * 7001011234567 -> 700101-1******
 * 123-45-67890 -> 123-45-6****
 */
export function maskIdNumber(idStr: string): string {
  if (!idStr) return '-';
  const clean = idStr.trim();

  // Resident registration format: 6 digits - 7 digits
  if (/^\d{6}-?\d{7}$/.test(clean.replace(/-/g, ''))) {
    const digits = clean.replace(/-/g, '');
    const front = digits.slice(0, 6);
    const seventh = digits.slice(6, 7);
    return `${front}-${seventh}******`;
  }

  // Business registration format: 10 digits
  if (/^\d{3}-?\d{2}-?\d{5}$/.test(clean)) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${parts[2].slice(0, 1)}****`;
    }
  }

  // General fallback masking
  if (clean.length > 8) {
    return clean.slice(0, 7) + '******';
  }
  return clean;
}
