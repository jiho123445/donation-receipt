# Firebase 작업 안내 (V8)

## 이번 V8 수정에서 반드시 필요한 작업
### 1. Firestore 데이터 구조를 새로 만들 필요 없음
이번 수정은 기존 `awards` 데이터를 읽는 호환 코드를 보완한 것입니다.
따라서 기존 수상실적 문서를 삭제하거나 다시 입력할 필요가 없습니다.

### 2. Firestore Rules
현재 프로젝트에 포함된 `firestore.rules`에는 이미 다음 규칙이 있습니다.

```
match /awards/{awardId} {
  allow read: if signedIn();
  allow create, update: if isAdmin();
  allow delete: if isSuperAdmin();
}
```

수상실적 조회만 목적이라면 Rules 변경은 필요하지 않습니다.

### 3. 실제 Firebase 콘솔에서 확인할 것
Firebase Console → Firestore Database → Data → `awards` 컬렉션을 열어
문서 1~2개의 실제 필드명을 확인하세요.

정상적인 신규 권장 구조:
```
recipientName: "홍길동"
year: 2024
awardName: "홍천군수상"
awardOrganization: "홍천군"
awardDate: "2024-12-20"
```

기존 자료가 `name`, `awardYear`, `title`, `date`처럼 저장되어 있어도 V8은 읽도록 보완했습니다.

### 4. 2026년 수상실적이 계속 0건일 때
이는 Firebase에 실제 2026년 자료가 없거나, 수상 문서의 연도 값이 예상하지 못한 형식일 수 있습니다.
이 경우 awards 문서 1~2개의 필드명과 값만 확인하면 원인을 정확히 잡을 수 있습니다.

### 5. 관리자 권한 관련
현재 Rules는 Custom Claim 기반입니다.
`admin: true` 또는 `super_admin: true` Custom Claim이 없는 계정은 Firestore 쓰기 권한이 거부될 수 있습니다.
이번 V8의 '조회 화면 수정' 자체에는 Custom Claim 변경이 필요 없습니다.

### 6. Rules 배포
Rules를 수정하지 않았다면 Firebase 콘솔에서 다시 Publish할 필요가 없습니다.
다만 GitHub 프로젝트의 firestore.rules와 Firebase 콘솔의 실제 배포 Rules가 다를 수 있으므로,
기존 쓰기 기능이 정상 작동 중이면 이번 V8 때문에 Rules를 변경하지 마세요.
