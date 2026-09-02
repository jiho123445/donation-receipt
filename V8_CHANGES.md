# V8 수정사항

## 해결한 문제
1. 연도별 비교 현황은 코드에서 2026년, 2025년으로 고정했습니다.
2. 회원 조회 영역은 전체 회원 목록을 렌더링하지 않고, 조회 버튼을 눌러 정확히 일치하는 회원 1명만 표시합니다.
3. 수상실적은 기존 Firestore 문서의 다양한 필드명을 호환 처리합니다.

## 수상실적 호환 필드
- 연도: year, awardYear, awardDate, date, awardedAt, receivedAt
- 회원명: recipientName, memberName, name, recipient, personName, winnerName
- 수상명: awardName, title, awardTitle, award, prizeName
- 수여기관: awardOrganization, organization, issuer, awardingBody

## 중요한 수정
기존 코드처럼 year 값이 없다고 현재 연도로 강제 변경하지 않습니다.
따라서 잘못된 연도 집계가 발생하지 않도록 했습니다.

## 배포 확인 표시
통합현황 제목 옆에 `통합현황 v8` 배지가 표시됩니다.
이 배지가 보이지 않으면 새 소스가 Vercel에 배포되지 않은 것입니다.
