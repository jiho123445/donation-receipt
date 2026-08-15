import React from 'react';
import { IssuedReceiptRecord, PrintSettings } from '../types/donation';
import { formatKRW } from '../utils/hangulCurrency';
import { OfficialSeal } from './OfficialSeal';

interface OfficialReceiptA4Props {
  receipt: IssuedReceiptRecord;
  printSettings?: PrintSettings;
  isPreviewMode?: boolean;
}

const EMPTY_ROWS = 7;

export const OfficialReceiptA4 = React.forwardRef<HTMLDivElement, OfficialReceiptA4Props>(
  ({ receipt, printSettings = { offsetX: 0, offsetY: 0, scale: 100 }, isPreviewMode = false }, ref) => {
    const {
      receiptNo,
      issueDate,
      formType,
      donorName,
      donorIdNumber,
      donorAddress,
      donations,
      totalAmount,
      amountInKorean,
      orgSnapshot,
    } = receipt;

    const [year, month, day] = (issueDate || new Date().toISOString().slice(0, 10)).split('-');
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    const displayDonations = donations.slice(0, EMPTY_ROWS);
    const emptyRows = Math.max(0, EMPTY_ROWS - displayDonations.length);

    const commonPageStyle: React.CSSProperties = {
      width: '210mm',
      height: '297mm',
      minHeight: '297mm',
      padding: '10mm 11mm 9mm',
      boxSizing: 'border-box',
      transform: `translate(${printSettings.offsetX}mm, ${printSettings.offsetY}mm) scale(${printSettings.scale / 100})`,
      transformOrigin: 'top center',
    };

    const seal = orgSnapshot.sealImage ? (
      <OfficialSeal
        name={`${orgSnapshot.name}이사장인`}
        customSealUrl={orgSnapshot.sealImage}
        size={54}
      />
    ) : null;

    return (
      <div
        ref={ref}
        id="official-receipt-a4-document"
        className={`receipt-page bg-white text-black font-sans box-border relative mx-auto ${isPreviewMode ? 'shadow-2xl border border-slate-300' : ''}`}
        style={commonPageStyle}
      >
        {formType === 'individual' ? (
          <div className="receipt-form receipt-form-individual text-[10px] leading-tight select-none">
            <div className="flex justify-between items-end text-[8.5px] pb-1 border-b border-black">
              <span>■ 소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2026. 1. 2.&gt;</span>
              <span className="font-semibold">일련번호 {receiptNo}</span>
            </div>

            <div className="text-center pt-4 pb-3">
              <h1 className="text-[24px] font-bold tracking-[0.28em] font-serif">기 부 금 영 수 증</h1>
              <p className="text-[8.5px] mt-1">※ 뒤쪽의 작성방법을 읽고 작성하여 주시기 바랍니다.</p>
            </div>

            <div className="font-bold mb-1">❶ 기부자</div>
            <table className="official-table">
              <tbody>
                <tr>
                  <th>성명(법인명)</th>
                  <td>{donorName || '-'}</td>
                  <th>주민등록번호<br />(사업자등록번호)</th>
                  <td className="mono">{donorIdNumber || '-'}</td>
                </tr>
                <tr>
                  <th>주소(소재지)</th>
                  <td colSpan={3}>{donorAddress || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className="font-bold mt-3 mb-1">❷ 기부금 단체</div>
            <table className="official-table">
              <tbody>
                <tr>
                  <th>단 체 명<br />(지점명)</th>
                  <td>{orgSnapshot.name || '-'}</td>
                  <th>사업자등록번호(고유번호)<br />(지점 사업자등록번호 등)</th>
                  <td className="mono">{orgSnapshot.bizNo || orgSnapshot.registrationNo || '-'}</td>
                </tr>
                <tr>
                  <th>소 재 지<br />(지점 소재지)</th>
                  <td>{orgSnapshot.address || '-'}</td>
                  <th>기부금공제대상<br />기부금단체 근거법령</th>
                  <td>{orgSnapshot.designationInfo || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className="font-bold mt-3 mb-1">❸ 기부금 모집처(언론기관 등)</div>
            <table className="official-table">
              <tbody>
                <tr>
                  <th>단 체 명</th>
                  <td>&nbsp;</td>
                  <th>사업자등록번호</th>
                  <td>&nbsp;</td>
                </tr>
                <tr>
                  <th>소 재 지</th>
                  <td colSpan={3}>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-center justify-between font-bold mt-3 mb-1">
              <span>❹ 기부내용</span>
              <span className="font-normal text-[8px]">단위: 원</span>
            </div>
            <table className="official-table donation-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="w-[10%]">코드</th>
                  <th rowSpan={2} className="w-[12%]">구분<br />(금전 또는 현물)</th>
                  <th rowSpan={2} className="w-[15%]">연월일</th>
                  <th colSpan={3} className="w-[48%]">내용</th>
                  <th rowSpan={2} className="w-[15%]">금액</th>
                </tr>
                <tr>
                  <th>품명</th>
                  <th>수량</th>
                  <th>단가</th>
                </tr>
              </thead>
              <tbody>
                {displayDonations.map((item, idx) => (
                  <tr key={idx}>
                    <td className="mono">{item.donationCode || orgSnapshot.donationCode || ''}</td>
                    <td>{item.paymentMethod ? '금전' : '금전'}</td>
                    <td className="mono">{item.date || ''}</td>
                    <td className="text-left">{item.content || orgSnapshot.defaultContent || ''}</td>
                    <td>1</td>
                    <td className="text-right mono">{formatKRW(item.amount)}</td>
                    <td className="text-right mono">{formatKRW(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: emptyRows }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <th colSpan={3}>합 계</th>
                  <td colSpan={3} className="text-center font-serif">{amountInKorean}</td>
                  <td className="text-right mono">{formatKRW(totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 text-[9.5px] leading-relaxed">
              「소득세법」 제34조, 「조세특례제한법」 제58조ㆍ제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른
              기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.
            </div>

            <div className="signature-grid mt-4">
              <div className="text-center">
                <div>{year}년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일</div>
                <div className="mt-3">신청인&nbsp;&nbsp;&nbsp;&nbsp;____________________&nbsp;&nbsp;(서명 또는 인)</div>
              </div>
              <div className="text-center relative">
                <div>{year}년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일</div>
                <div className="mt-3">기부금 수령인&nbsp;&nbsp;&nbsp;&nbsp;{orgSnapshot.name || '-'}&nbsp;&nbsp;(서명 또는 인)</div>
                {seal && <div className="absolute right-2 bottom-[-8px]">{seal}</div>}
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-black text-[7.5px] leading-relaxed text-gray-700">
              ※ 본 서식은 국가법령정보센터의 현행 소득세법 시행규칙 별지 제45호의2서식(2026. 1. 2. 개정)을 기준으로 구성합니다.
              실제 발급 시 기부금단체의 적격 여부 및 법정 식별정보를 확인하십시오.
            </div>
          </div>
        ) : (
          <div className="receipt-form receipt-form-corporate text-[10px] leading-tight select-none">
            <div className="flex justify-between items-end text-[8.5px] pb-1 border-b border-black">
              <span>■ 법인세법 시행규칙 [별지 제63호의3서식]</span>
              <span className="font-semibold">일련번호 {receiptNo}</span>
            </div>

            <div className="text-center pt-4 pb-3">
              <h1 className="text-[24px] font-bold tracking-[0.28em] font-serif">기 부 금 영 수 증</h1>
              <p className="text-[8.5px] mt-1">※ 뒤쪽의 작성방법을 읽고 작성하여 주시기 바랍니다.</p>
            </div>

            <div className="font-bold mb-1">❶ 기부자</div>
            <table className="official-table">
              <tbody>
                <tr>
                  <th>성명(법인명)</th>
                  <td>{donorName || '-'}</td>
                  <th>주민등록번호<br />(사업자등록번호)</th>
                  <td className="mono">{donorIdNumber || '-'}</td>
                </tr>
                <tr><th>주소(소재지)</th><td colSpan={3}>{donorAddress || '-'}</td></tr>
              </tbody>
            </table>

            <div className="font-bold mt-3 mb-1">❷ 기부금 단체</div>
            <table className="official-table">
              <tbody>
                <tr>
                  <th>단 체 명</th><td>{orgSnapshot.name || '-'}</td>
                  <th>사업자등록번호(고유번호)</th><td className="mono">{orgSnapshot.bizNo || orgSnapshot.registrationNo || '-'}</td>
                </tr>
                <tr>
                  <th>소 재 지</th><td>{orgSnapshot.address || '-'}</td>
                  <th>기부금공제대상 기부금단체 근거법령</th><td>{orgSnapshot.designationInfo || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className="font-bold mt-3 mb-1">❸ 기부금 모집처(언론기관 등)</div>
            <table className="official-table">
              <tbody>
                <tr><th>단 체 명</th><td>&nbsp;</td><th>사업자등록번호</th><td>&nbsp;</td></tr>
                <tr><th>소 재 지</th><td colSpan={3}>&nbsp;</td></tr>
              </tbody>
            </table>

            <div className="flex items-center justify-between font-bold mt-3 mb-1"><span>❹ 기부내용</span><span className="font-normal text-[8px]">단위: 원</span></div>
            <table className="official-table donation-table">
              <thead>
                <tr>
                  <th rowSpan={2}>유형</th><th rowSpan={2}>코드</th><th rowSpan={2}>구분</th><th rowSpan={2}>연월일</th><th colSpan={3}>기부금품</th><th rowSpan={2}>금액</th>
                </tr>
                <tr><th>품명</th><th>수량</th><th>단가</th></tr>
              </thead>
              <tbody>
                {displayDonations.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.donationType || orgSnapshot.donationType || ''}</td><td className="mono">{item.donationCode || orgSnapshot.donationCode || ''}</td><td>금전</td><td className="mono">{item.date || ''}</td><td className="text-left">{item.content || orgSnapshot.defaultContent || ''}</td><td>1</td><td className="text-right mono">{formatKRW(item.amount)}</td><td className="text-right mono">{formatKRW(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: emptyRows }).map((_, idx) => <tr key={`empty-${idx}`}><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>)}
                <tr className="total-row"><th colSpan={4}>합 계</th><td colSpan={3} className="text-center font-serif">{amountInKorean}</td><td className="text-right mono">{formatKRW(totalAmount)}</td></tr>
              </tbody>
            </table>

            <div className="mt-4 text-[9.5px] leading-relaxed">「법인세법」 제24조에 따른 기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.</div>
            <div className="signature-grid mt-4">
              <div className="text-center"><div>{formattedDate}</div><div className="mt-3">신청인&nbsp;&nbsp;&nbsp;&nbsp;____________________&nbsp;&nbsp;(서명 또는 인)</div></div>
              <div className="text-center relative"><div>{formattedDate}</div><div className="mt-3">기부금 수령인&nbsp;&nbsp;&nbsp;&nbsp;{orgSnapshot.name || '-'}&nbsp;&nbsp;(서명 또는 인)</div>{seal && <div className="absolute right-2 bottom-[-8px]">{seal}</div>}</div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

OfficialReceiptA4.displayName = 'OfficialReceiptA4';
