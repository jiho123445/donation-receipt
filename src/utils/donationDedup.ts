import type { RawDonationRecord } from '../types/donation';

/**
 * v21 후원내역 병합 규칙 — "내용 추측형 중복판정"을 완전히 제거했습니다.
 *
 * ## 왜 바꿨는가
 * v13~v20에 걸쳐 이름+날짜+금액+방법+내용을 조합한 "지문(fingerprint)"으로
 * 두 후원 행이 "같은 실제 후원건"인지 추측해왔습니다. 그런데:
 *  - 실제로는 같은 후원자가 같은 날 같은 금액을 두 번 낼 수도 있고,
 *  - 파일명이 살짝만 바뀌어도(재다운로드, "(1)" 등) 재업로드 판정이 어긋나고,
 *  - 반대로 실제로 다른 두 건이 우연히 같은 지문을 가지면 하나가 조용히 사라졌습니다.
 * 이것이 v14~v19에서 반복적으로 "3건 중 2건만 표시" 문제가 재발한 근본 원인입니다.
 *
 * 국세청 홈택스 전자기부금영수증 시스템도, 다수의 비영리단체가 쓰는
 * 후원자관리 플랫폼(예: 도너스)도 "내용을 보고 같은 건인지 추측"하지 않습니다.
 * 홈택스는 아예 행 단위 중복검증을 하지 않고(제출자 책임), 도너스는 결제마다
 * 시스템이 부여한 고유 코드로만 "이미 영수증에 쓰였는지"를 판단합니다.
 *
 * ## v21 방식
 * - Excel의 유효한 각 행은 파싱 시점에 이미 고유 id를 부여받습니다(excelParser.ts).
 * - 이 함수는 그 id 기준으로만 "이미 화면(existing)에 있는 정확히 같은 레코드"를
 *   걸러내며, 내용이 비슷하다는 이유로 절대 새 행을 추측 삭제하지 않습니다.
 * - "같은 엑셀 파일을 실수로 두 번 올렸는지"는 이 함수가 아니라 파일 전체 해시
 *   기준으로 ExcelManager 단계에서 명시적으로 확인하고 사용자에게 물어봅니다.
 *   (내용 추측이 아니라 "그 파일, 이미 가져온 적 있어요" 같은 명확한 사실 확인)
 */
export function mergeDonationRecords(
  existing: RawDonationRecord[],
  incoming: RawDonationRecord[]
): {
  records: RawDonationRecord[];
  added: RawDonationRecord[];
  updated: RawDonationRecord[];
  duplicates: number;
} {
  const seenIds = new Set(existing.map((r) => r.id).filter(Boolean));
  const added: RawDonationRecord[] = [];
  let duplicates = 0;

  for (const raw of incoming) {
    // id가 완전히 동일한 레코드만 "이미 존재하는 바로 그 문서"로 취급해 건너뜁니다.
    // (같은 배열을 실수로 두 번 merge에 넘기는 경우 등에 대한 최소한의 안전장치이며,
    //  내용이 비슷한 다른 행을 추측으로 걸러내는 로직이 아닙니다.)
    if (raw.id && seenIds.has(raw.id)) {
      duplicates += 1;
      continue;
    }
    if (raw.id) seenIds.add(raw.id);
    added.push(raw);
  }

  return {
    records: [...existing, ...added],
    added,
    updated: [],
    duplicates,
  };
}

/**
 * "이미 가져온 파일이 있습니다 → 그래도 다시 가져오기"를 눌렀을 때 사용하는 병합 방식입니다.
 *
 * 문제: incoming 레코드의 id는 파싱할 때마다 새로 무작위 생성되므로(excelParser.ts),
 * 파싱 코드를 고쳐서 같은 파일을 다시 올려도 mergeDonationRecords()의 id 비교로는
 * "예전 레코드"를 알아볼 수 없어 항상 added로 취급됩니다. 그 결과 예전 레코드(예:
 * 날짜가 잘못 인식된 것)는 그대로 남고 새 레코드가 추가되어 같은 내역이 두 배로 쌓입니다.
 *
 * 해결: 각 레코드는 파싱 시점에 원본 파일의 SHA-256 해시(sourceFileHash)를 갖고 있습니다.
 * "다시 가져오기"는 정의상 내용이 완전히 동일한 파일에 대해서만 뜨는 확인창이므로,
 * 그 파일 해시를 가진 기존 레코드를 전부 제거하고 새로 파싱된 레코드로 교체하는 것이
 * 안전합니다(다른 파일에서 온 레코드는 sourceFileHash가 달라 영향받지 않습니다).
 */
export function replaceFileRecords(
  existing: RawDonationRecord[],
  incoming: RawDonationRecord[],
  fileHashes: string[]
): {
  records: RawDonationRecord[];
  removed: RawDonationRecord[];
  added: RawDonationRecord[];
} {
  const hashSet = new Set(fileHashes.filter(Boolean));
  const removed = existing.filter((r) => r.sourceFileHash && hashSet.has(r.sourceFileHash));
  const kept = existing.filter((r) => !(r.sourceFileHash && hashSet.has(r.sourceFileHash)));

  return {
    records: [...kept, ...incoming],
    removed,
    added: incoming,
  };
}
