# 상업용 회원·회비·수상실적 관리 고도화 안내

## 이번 통합본에서 반영한 기반 구조
- `members` 회원 마스터 모델 추가
- `awards.memberId` 추가: 이름 기반 매칭의 동명이인 위험 감소
- 수상기관/수상일/행사명/분류 확장 필드 추가
- `auditLogs` 모델 및 저장 함수 추가
- Firestore 권한을 Custom Claims 기반 Admin / Super Admin 구조로 강화
- `membershipPayments` 독립 컬렉션 규칙 추가

## 기존 데이터와 호환성
기존 `donations`, `awards`, `donors`, `receipts` 데이터는 삭제하거나 구조를 강제로 변경하지 않습니다.
기존 수상자료는 `recipientName`으로 계속 조회됩니다. 이후 회원을 연결할 때 `memberId`를 채우면 고유 식별 방식으로 전환할 수 있습니다.

## GitHub 업로드 전 필수 설정
새 Firestore Rules는 `admin` 또는 `super_admin` Custom Claim이 있어야 쓰기가 가능합니다.
따라서 Rules를 즉시 배포하면 현재 로그인 계정이 쓰기 불가 상태가 될 수 있습니다.
반드시 Firebase Admin SDK 또는 Cloud Functions로 현재 관리자 계정에 Claim을 먼저 설정하십시오.

예: `{ admin: true }`, 최고관리자: `{ admin: true, super_admin: true }`

## 권장 다음 단계
1. members 컬렉션 생성 및 기존 donors와 연결
2. 수상관리 화면에 회원 검색/선택 UI 추가
3. 회비 전용 입력 시 membershipPayments에 저장하도록 분리
4. 회원 상세 화면에 회비·수상·발급 이력 통합
5. Cloud Functions로 auditLogs 기록
6. 백업 및 복구 절차 추가
