import React from 'react';
import { IssuedReceiptRecord, PrintSettings } from '../types/donation';
import { formatKRW } from '../utils/hangulCurrency';
import { OfficialSeal } from './OfficialSeal';

interface OfficialReceiptA4Props {
  receipt: IssuedReceiptRecord;
  printSettings?: PrintSettings;
  isPreviewMode?: boolean;
}

export const OfficialReceiptA4 = React.forwardRef<HTMLDivElement, OfficialReceiptA4Props>(
  (
    {
      receipt,
      printSettings = { offsetX: 0, offsetY: 0, scale: 100 },
      isPreviewMode = false,
    },
    ref
  ) => {
    const {
      receiptNo,
      issueDate,
      taxYear,
      formType,
      donorName,
      donorIdNumber,
      donorAddress,
      donations,
      totalAmount,
      amountInKorean,
      orgSnapshot,
    } = receipt;

    // Format date to Korean notation YYYY년 MM월 DD일
    const [year, month, day] = (issueDate || '2026-08-15').split('-');
    const formattedDate = `${year}년 ${month}월 ${day}일`;

    // Maximum items to display directly in the table
    const maxTableRows = 5;
    const displayDonations = donations.slice(0, maxTableRows);
    const remainingRowsCount = Math.max(0, maxTableRows - displayDonations.length);

    const isIndividual = formType === 'individual';

    return (
      <div
        ref={ref}
        id="official-receipt-a4-document"
        className={`receipt-page bg-white text-black font-sans box-border relative mx-auto ${
          isPreviewMode ? 'shadow-2xl border border-slate-300' : ''
        }`}
        style={{
          width: '210mm',
          height: '297mm',
          maxHeight: '297mm',
          padding: '12mm 14mm',
          boxSizing: 'border-box',
          transform: `translate(${printSettings.offsetX}mm, ${printSettings.offsetY}mm) scale(${printSettings.scale / 100})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="w-full h-full flex flex-col justify-between text-[10.5px] leading-tight select-none">
          {/* Header Metadata */}
          <div>
            <div className="flex justify-between items-end text-[10px] text-gray-800 pb-1 border-b border-black">
              <span>
                {isIndividual
                  ? '■ 소득세법 시행규칙 [별지 제45호의2서식] <개정 2026. 1. 2.>'
                  : '■ 법인세법 시행규칙 [별지 제63호의3서식] <개정 2026. 1. 2.>'}
              </span>
              <span className="font-semibold text-[9.5px]">(앞 쪽)</span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-900 mt-1 mb-2 px-0.5">
              <div className="font-medium">
                발급번호 : <span className="font-mono font-bold text-[11px]">{receiptNo}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  [ <span className="font-mono font-bold">{taxYear}</span> ] 년도
                </span>
                <span>( [✔] 연간 합계표, &nbsp; [ &nbsp; ] 월분 )</span>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-2">
              <h1 className="text-2xl font-extrabold tracking-widest font-serif text-black">
                기 부 금 영 수 증
              </h1>
              <p className="text-[9.5px] text-gray-600 mt-0.5">
                {isIndividual
                  ? '(「소득세법 시행령」 제113조제1항 및 「소득세법 시행규칙」 제58조제1항 관련)'
                  : '(「법인세법 시행령」 제39조 및 「법인세법 시행규칙」 제82조제1항 관련)'}
              </p>
            </div>

            {/* ❶ 기부자 */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 text-black">
                ❶ 기부자
              </div>
              <table className="w-full border-collapse border border-black text-[10px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%] text-center">
                      성명(법인명)
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[28%] font-medium">
                      {donorName}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[24%] text-center">
                      주민등록번호<br />(사업자등록번호)
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[26%] font-mono">
                      {donorIdNumber || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 text-center">
                      주소(소재지)
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-2.5 text-left">
                      {donorAddress || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ❷ 기부금 단체 */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 text-black">
                ❷ 기부금 단체
              </div>
              <table className="w-full border-collapse border border-black text-[10px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%] text-center">
                      단체명(지점명)
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[28%] font-semibold">
                      {orgSnapshot.name}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[24%] text-center">
                      사업자등록번호<br />(고유번호)
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[26%] font-mono font-bold">
                      {orgSnapshot.bizNo || orgSnapshot.registrationNo || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 text-center">
                      소재지(지점 소재지)
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left">
                      {orgSnapshot.address}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 text-center">
                      지점 사업자등록번호 등
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left font-mono">
                      -
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 text-center">
                      기부금공제대상<br />기부금단체 근거법령
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-2.5 text-left leading-tight">
                      {orgSnapshot.designationInfo || '소득세법 시행령 제80조제1항제5호, 법인세법 시행령 제39조제1항제1호바목 공익법인'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ❸ 기부금 모집처(언론기관 등) */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 text-black">
                ❸ 기부금 모집처(언론기관 등)
              </div>
              <table className="w-full border-collapse border border-black text-[10px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%] text-center">
                      단체명
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[28%] text-gray-500">
                      -
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[24%] text-center">
                      사업자등록번호
                    </th>
                    <td className="border border-black py-1.5 px-2.5 text-left w-[26%] text-gray-500 font-mono">
                      -
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 text-center">
                      소재지
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-2.5 text-left text-gray-500">
                      - (재단 직접 기부)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ❹ 기부내용 */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 flex justify-between items-center text-black">
                <span>❹ 기부내용</span>
                <span className="text-[9px] font-normal text-gray-500">단위: 원</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[9.5px]">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th rowSpan={2} className="border border-black py-1 px-1 w-[8%]">코드</th>
                    <th rowSpan={2} className="border border-black py-1 px-1 w-[12%]">구분<br />(금전·현물)</th>
                    <th rowSpan={2} className="border border-black py-1 px-1 w-[16%]">연월일</th>
                    <th colSpan={3} className="border border-black py-0.5 px-1">내 용</th>
                    <th rowSpan={2} className="border border-black py-1 px-1 w-[18%]">금액</th>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="border border-black py-0.5 px-1 w-[20%]">품명</th>
                    <th className="border border-black py-0.5 px-1 w-[8%]">수량</th>
                    <th className="border border-black py-0.5 px-1 w-[18%]">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDonations.map((item, idx) => (
                    <tr key={idx} className="h-[21px]">
                      <td className="border border-black py-0.5 px-1 font-mono font-semibold">
                        {item.donationCode || orgSnapshot.donationCode || '40'}
                      </td>
                      <td className="border border-black py-0.5 px-1">
                        금전
                      </td>
                      <td className="border border-black py-0.5 px-1 font-mono">
                        {item.date}
                      </td>
                      <td className="border border-black py-0.5 px-1 text-left truncate max-w-[110px]">
                        {item.content || orgSnapshot.defaultContent || '후원금'}
                      </td>
                      <td className="border border-black py-0.5 px-1 font-mono">1</td>
                      <td className="border border-black py-0.5 px-1 text-right font-mono">
                        {formatKRW(item.amount)}
                      </td>
                      <td className="border border-black py-0.5 px-1 text-right font-mono font-semibold">
                        {formatKRW(item.amount)}
                      </td>
                    </tr>
                  ))}

                  {/* Empty rows to fill standard height */}
                  {Array.from({ length: remainingRowsCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-[21px]">
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                      <td className="border border-black py-0.5">&nbsp;</td>
                    </tr>
                  ))}

                  {/* Total row */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-black">
                    <td colSpan={2} className="border border-black py-1.5 px-1 text-center bg-gray-100">
                      합 계
                    </td>
                    <td colSpan={3} className="border border-black py-1.5 px-2 text-left font-serif text-[10.5px]">
                      {amountInKorean}
                    </td>
                    <td colSpan={2} className="border border-black py-1.5 px-2 text-right font-mono text-[11.5px] font-extrabold text-black">
                      ₩ {formatKRW(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Certification / Issuance Statement */}
            <div className="mt-2.5 px-3 py-2 border border-black bg-white text-center">
              <p className="text-[10.5px] font-medium leading-relaxed">
                {isIndividual ? (
                  <>
                    「소득세법」 제34조, 「조세특례제한법」 제76조, 제88조의4 및 「지방세특례제한법」 제57조의4에 따라<br />
                    기부금을 위와 같이 기부(수령)하였음을 증명합니다.
                  </>
                ) : (
                  <>
                    「법인세법」 제24조 및 「조세특례제한법」 제76조·제88조의4에 따라<br />
                    기부금을 위와 같이 기부(수령)하였음을 증명합니다.
                  </>
                )}
              </p>

              <div className="mt-1.5 text-[11px] font-semibold tracking-wider font-serif">
                {formattedDate}
              </div>

              <div className="mt-2 flex items-center justify-end pr-6 relative">
                <div className="text-right text-[11px] font-serif leading-tight">
                  <div className="font-bold flex items-center justify-end gap-1.5">
                    <span>기부금 수령인 :</span>
                    <span>{orgSnapshot.name}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span>대표자 :</span>
                    <span className="font-bold tracking-wider text-[12px]">{orgSnapshot.representative}</span>
                    <span className="text-gray-700 font-sans text-[10px]">(서명 또는 인)</span>
                  </div>
                </div>

                {/* Seal Stamp ONLY if uploaded by admin */}
                {orgSnapshot.sealImage && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                    <OfficialSeal
                      customSealUrl={orgSnapshot.sealImage}
                      size={64}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statutory instructions at bottom */}
          <div className="mt-2 pt-1.5 border-t border-black text-[8px] text-gray-800 leading-normal">
            <div className="font-bold text-[8.5px] text-black mb-0.5">■ 작성방법 및 유의사항</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>기부자의 성명(법인명), 주민등록번호(사업자등록번호), 주소(소재지)를 정확하게 적습니다.</li>
              <li>
                기부금 단체 및 기부내용란에는 관련 세법상의 코드(법정기부금 10, 지정기부금/공익법인 40, 우리사주조합 42, 종교단체 41 등), 구분(금전 또는 현물), 금액 등을 빠짐없이 기재합니다.
              </li>
              <li>금전 외의 현물기부인 경우에는 품명, 수량, 단가 및 가액을 정확히 기재합니다.</li>
              <li>
                기부금영수증을 발급하는 자는 기부자별 기부금영수증 발급명세서를 작성하여 5년간 보관하여야 하며, 관할 세무서장의 제출 요구가 있는 때에는 이를 제출하여야 합니다.
              </li>
              <li>
                사실과 다르게 발급하거나 기부자별 발급명세서를 작성·보관하지 아니한 경우에는 관련 세법에 따라 가산세가 부과됩니다.
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }
);

OfficialReceiptA4.displayName = 'OfficialReceiptA4';
