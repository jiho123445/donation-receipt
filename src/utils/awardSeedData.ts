import { AwardRecord } from '../types/donation';

/**
 * 첨부된 "2024년 사단법인 너브내행복나눔재단 표창명단" PDF를 그대로 옮겨 담은 샘플(초기) 수상내역입니다.
 * 연번/성명 + 연도(2019~2024)별 수상내역이 가로로 나열된 원본 표를,
 * 실제로 수상 기록이 채워져 있는 칸만 골라 AwardRecord(성명+연도+수상내역) 1건씩으로 정규화했습니다.
 *
 * 엑셀 관리 화면의 [수상내역(첨부 표창명단) 불러오기] 버튼을 누르면 이 목록이 화면(및 로그인 시 Firebase)에 반영됩니다.
 * 이후 연도가 추가되거나 명단이 바뀌면, 같은 형식(연번/성명 + 연도 컬럼)의 엑셀 파일을 올려 갱신할 수 있습니다.
 */
export const AWARD_SEED_SOURCE_LABEL = '2024년 사단법인 너브내행복나눔재단 표창명단';

export const INITIAL_SAMPLE_AWARDS: AwardRecord[] = [
  { memberNo: '4', recipientName: '이인철', year: 2023, awardName: '2023년 송년회 도의회의장상' },
  { memberNo: '11', recipientName: '송재용', year: 2022, awardName: '2022년 송년회 군수상' },
  { memberNo: '13', recipientName: '윤근철', year: 2023, awardName: '2023년 송년회 군수상' },
  { memberNo: '15', recipientName: '이영욱', year: 2022, awardName: '2022년 송년회 국회의원상' },
  { memberNo: '17', recipientName: '김남기', year: 2019, awardName: '18년 송년회 군수상' },
  { memberNo: '20', recipientName: '이승수', year: 2024, awardName: '2024년 송년의밤 군수상' },
  { memberNo: '22', recipientName: '박영록', year: 2022, awardName: '2022년 송년회 군수상' },
  { memberNo: '28', recipientName: '탁석걸', year: 2021, awardName: '제10회 한마음축제 국회의원상' },
  { memberNo: '30', recipientName: '김영대', year: 2024, awardName: '2024년 한마음축제 도의장상' },
  { memberNo: '33', recipientName: '김민영', year: 2019, awardName: '송년회 도지사상' },
  { memberNo: '37', recipientName: '이정길', year: 2023, awardName: '2023년 송년회 도의회의장상' },
  { memberNo: '41', recipientName: '신상욱', year: 2019, awardName: '19년 송년의밤 군수표창' },
  { memberNo: '43', recipientName: '이병일', year: 2023, awardName: '2023년 송년회 군의회의장상' },
  { memberNo: '44', recipientName: '길남진', year: 2019, awardName: '19년 송년의밤 군의장상' },
  { memberNo: '45', recipientName: '예부영', year: 2022, awardName: '2022년 13차 정기총회 국회의원상' },
  { memberNo: '46', recipientName: '황준구', year: 2024, awardName: '2024년 한마음축제 군수상' },
  { memberNo: '48', recipientName: '권오철', year: 2019, awardName: '18년 정기총회 군수상' },
  { memberNo: '51', recipientName: '김영일', year: 2023, awardName: '2023년 송년회 군수상' },
  { memberNo: '55', recipientName: '최도철', year: 2024, awardName: '2024년 한마음축제 국회의원상' },
  { memberNo: '57', recipientName: '허성건', year: 2022, awardName: '2022년 송년회 군의회상' },
  { memberNo: '59', recipientName: '지영희', year: 2023, awardName: '2023년 송년회 국회의원상' },
  { memberNo: '60', recipientName: '김인규', year: 2023, awardName: '제14회 정기총회 도지사상' },
  { memberNo: '63', recipientName: '김진환', year: 2024, awardName: '2024년 송년의밤 군수상' },
  { memberNo: '64', recipientName: '윤치중', year: 2022, awardName: '제11회 한마음축제 군수상' },
  { memberNo: '65', recipientName: '홍순용', year: 2022, awardName: '제11회 한마음축제 군수상' },
  { memberNo: '68', recipientName: '최종호', year: 2019, awardName: '19년 송년의밤 군수표창' },
  { memberNo: '71', recipientName: '신재영', year: 2024, awardName: '2024년 정기총회 군수상' },
  { memberNo: '73', recipientName: '남궁진영', year: 2024, awardName: '2024년 한마음축제 군의장상' },
  { memberNo: '77', recipientName: '용홍식', year: 2024, awardName: '2024년 한마음축제 군의장상' },
  { memberNo: '79', recipientName: '원민희', year: 2022, awardName: '2022년 송년회 도의회상' },
  { memberNo: '83', recipientName: '안만조', year: 2022, awardName: '2022년 13차 정기총회 군수상' },
  { memberNo: '88', recipientName: '정지수', year: 2023, awardName: '2023년 송년회 국회의원상' },
  { memberNo: '90', recipientName: '민병선', year: 2024, awardName: '2024년 정기총회 군의장상' },
  { memberNo: '91', recipientName: '정진철', year: 2024, awardName: '2024년 정기총회 군수상' },
  { memberNo: '94', recipientName: '황경화', year: 2022, awardName: '2022년 송년회 국회의원상' },
  { memberNo: '96', recipientName: '신동수', year: 2024, awardName: '2024년 한마음축제 도의장상' },
  { memberNo: '97', recipientName: '홍창호', year: 2024, awardName: '2024년 한마음축제 군수상' },
  { memberNo: '98', recipientName: '김상호', year: 2023, awardName: '2023년 송년회 국회의원상' },
  { memberNo: '99', recipientName: '정규훈', year: 2024, awardName: '2024년 정기총회 국회의원상' },
  { memberNo: '100', recipientName: '김남수', year: 2022, awardName: '2022년 송년회 군의회상' },
  { memberNo: '101', recipientName: '김건섭', year: 2022, awardName: '2022년 송년회 도의회상' },
  { memberNo: '102', recipientName: '김귀동', year: 2024, awardName: '2024년 정기총회 국회의원상' },
  { memberNo: '105', recipientName: '김영인', year: 2024, awardName: '2024년 송년의밤 군의장상' },
  { memberNo: '106', recipientName: '박성실', year: 2023, awardName: '2023년 송년회 군의회의장상' },
  { memberNo: '110', recipientName: '지승현', year: 2022, awardName: '제11회 한마음축제 국회의원상' },
  { memberNo: '111', recipientName: '엄영철', year: 2024, awardName: '2024년 정기총회 군의장상' },
  { memberNo: '112', recipientName: '황정연', year: 2022, awardName: '2022년 13차 정기총회 군의회상' },
  { memberNo: '116', recipientName: '고순명', year: 2024, awardName: '2024년 한마음축제 국회의원상' },
  { memberNo: '120', recipientName: '이종영', year: 2024, awardName: '2024년 송년의밤 군의장상' },
  { memberNo: '124', recipientName: '이승표', year: 2024, awardName: '2024년 송년의밤 도의장상' },
  { memberNo: '125', recipientName: '이홍우', year: 2024, awardName: '2024년 송년의밤 도의장상' },
  { memberNo: '126', recipientName: '서정석', year: 2024, awardName: '2024년 송년의밤 국회의원상' },
  { memberNo: '128', recipientName: '문진기', year: 2024, awardName: '2024년 송년의밤 국회의원상' },
].map((entry, index) => ({
  ...entry,
  id: `award-seed-${index + 1}`,
  sourceLabel: AWARD_SEED_SOURCE_LABEL,
}));
