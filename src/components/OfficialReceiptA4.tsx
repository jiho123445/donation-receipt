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
    const maxTableRows = 6;
    const displayDonations = donations.slice(0, maxTableRows);
    const remainingRowsCount = Math.max(0, maxTableRows - displayDonations.length);

    return (
      <div
        ref={ref}
        id="official-receipt-a4-document"
        className={`receipt-page bg-white text-black font-sans box-border relative mx-auto ${
          isPreviewMode ? 'shadow-2xl border border-slate-300' : ''
        }`}
        style={{
          width: '210mm',
          minHeight: '296mm',
          padding: '12mm 14mm',
          transform: `translate(${printSettings.offsetX}mm, ${printSettings.offsetY}mm) scale(${printSettings.scale / 100})`,
          transformOrigin: 'top center',
        }}
      >
      {/* ============================================================== */}
      {/* 1. INDIVIDUAL FORM (소득세법 시행규칙 별지 제45호의2서식) */}
      {/* ============================================================== */}
      {formType === 'individual' && (
        <div className="w-full flex flex-col justify-between text-[11px] leading-tight select-none">
          {/* Header */}
          <div>
            <div className="flex justify-between items-end text-[10px] text-gray-700 pb-1 border-b border-black">
              <span>■ 소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2021. 3. 16.&gt;</span>
              <span className="font-semibold">발급번호 : {receiptNo}</span>
            </div>

            <div className="text-center my-3">
              <h1 className="text-2xl font-extrabold tracking-widest font-serif text-black underline underline-offset-4 decoration-1">
                기 부 금 영 수 증
              </h1>
              <p className="text-[10px] text-gray-600 mt-1">
                (「소득세법 시행령」 제113조제1항 및 「소득세법 시행규칙」 제58조제1항 관련)
              </p>
            </div>

            {/* Section 1: 기부자 */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 flex justify-between items-center">
                <span>1. 기부자</span>
                <span className="text-[9.5px] font-normal text-gray-600">(과세연도: {taxYear}년도)</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[10.5px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      성 명
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-medium">
                      {donorName}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      주민등록번호
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-mono">
                      {donorIdNumber || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      주 소 (소재지)
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-3 text-left">
                      {donorAddress || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: 기부금영수증 발급자 */}
            <div className="mt-2.5">
              <div className="font-bold text-[11px] mb-0.5">2. 기부금영수증 발급자</div>
              <table className="w-full border-collapse border border-black text-center text-[10.5px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      법인명(단체명)
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-semibold">
                      {orgSnapshot.name}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      주민(법인)등록번호
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-mono">
                      {orgSnapshot.registrationNo || '(미입력)'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      대표자 성명
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left">
                      {orgSnapshot.representative}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      사업자(고유)번호
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left font-mono">
                      {orgSnapshot.bizNo || orgSnapshot.registrationNo || '(미입력)'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      소재지(주소)
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-3 text-left">
                      {orgSnapshot.address} {orgSnapshot.tel ? `(전화: ${orgSnapshot.tel})` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: 기부금 내용 */}
            <div className="mt-2.5">
              <div className="font-bold text-[11px] mb-0.5 flex justify-between">
                <span>3. 기부금 내용</span>
                <span className="text-[9.5px] font-normal text-gray-500">단위: 원</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[10px]">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="border border-black py-1.5 px-1 w-[16%]">구 분(유형)</th>
                    <th className="border border-black py-1.5 px-1 w-[10%]">코드</th>
                    <th className="border border-black py-1.5 px-1 w-[16%]">연월일</th>
                    <th className="border border-black py-1.5 px-1 w-[20%]">적요 (내용)</th>
                    <th className="border border-black py-1.5 px-1 w-[10%]">수량</th>
                    <th className="border border-black py-1.5 px-1 w-[13%]">단가</th>
                    <th className="border border-black py-1.5 px-1 w-[15%]">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDonations.map((item, idx) => (
                    <tr key={idx} className="h-6.5">
                      <td className="border border-black py-1 px-1">
                        {item.donationType || orgSnapshot.donationType || '-'}
                      </td>
                      <td className="border border-black py-1 px-1 font-mono">
                        {item.donationCode || orgSnapshot.donationCode || '-'}
                      </td>
                      <td className="border border-black py-1 px-1 font-mono">
                        {item.date}
                      </td>
                      <td className="border border-black py-1 px-1 text-left truncate max-w-[120px]">
                        {item.content || orgSnapshot.defaultContent || '-'} ({item.paymentMethod})
                      </td>
                      <td className="border border-black py-1 px-1 font-mono">1</td>
                      <td className="border border-black py-1 px-1 text-right font-mono">
                        {formatKRW(item.amount)}
                      </td>
                      <td className="border border-black py-1 px-1 text-right font-mono font-semibold">
                        {formatKRW(item.amount)}
                      </td>
                    </tr>
                  ))}

                  {/* Extra rows if donations count is small to keep table structure stable */}
                  {Array.from({ length: remainingRowsCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-6">
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                    </tr>
                  ))}

                  {/* Total Summary Row */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-black">
                    <td colSpan={2} className="border border-black py-2 px-2 text-center bg-gray-100">
                      합 계
                    </td>
                    <td colSpan={3} className="border border-black py-2 px-3 text-left font-serif text-[11px]">
                      {amountInKorean}
                    </td>
                    <td colSpan={2} className="border border-black py-2 px-3 text-right font-mono text-[12px] font-extrabold text-black">
                      ₩ {formatKRW(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Statutory certification text */}
            <div className="mt-4 px-3 py-2.5 border border-black bg-slate-50/50 text-center">
              <p className="text-[11px] font-medium leading-relaxed">
                「소득세법」 제34조, 「조세특례제한법」 제76조·제88조의4 및 「지방세특례제한법」 제57조의4에 따라
                위와 같이 기부금을 영수하였음을 증명합니다.
              </p>

              <div className="mt-3 text-[12px] font-semibold tracking-wider font-serif">
                {formattedDate}
              </div>

              {/* Issuer Signature & Official Seal Stamp */}
              <div className="mt-3 flex items-center justify-end pr-8 relative">
                <div className="text-right text-[12px] font-serif leading-snug">
                  <div className="font-bold">{orgSnapshot.name}</div>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    <span>대표자 : </span>
                    <span className="font-bold tracking-widest text-[13px]">{orgSnapshot.representative}</span>
                    <span className="text-gray-600 font-sans text-[10.5px]">(서명 또는 인)</span>
                  </div>
                </div>

                {/* Digital Stamp Seal overlapping the name area */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <OfficialSeal
                    name={`${orgSnapshot.name}이사장인`}
                    customSealUrl={orgSnapshot.sealImage}
                    size={66}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Statutory instructions at bottom */}
          <div className="mt-4 pt-2 border-t border-black text-[9px] text-gray-700 leading-normal">
            <div className="font-bold text-[9.5px] text-black mb-1">■ 작성방법 및 유의사항</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>기부자의 성명, 주민등록번호 및 주소를 정확하게 적습니다.</li>
              <li>
                기부금 구분란에는 법정기부금(10), 지정기부금/공익법인기부금(40), 우리사주조합기부금(42), 종교단체기부금(41) 등 관련 세법상의 기부금 구분 및 코드를 기재합니다.
              </li>
              <li>금전 외의 현물기부인 경우에는 수량, 단가 및 가액을 정확히 기재합니다.</li>
              <li>
                기부금영수증을 발급하는 자는 기부자별 기부금영수증 발급명세서를 작성하여 5년간 보관하여야 하며, 관할 세무서장의 제출 요구가 있는 때에는 이를 제출하여야 합니다.
              </li>
              <li>
                사실과 다르게 발급하거나 기부자별 발급명세서를 작성·보관하지 아니한 경우에는 「소득세법」 제81조의7에 따라 가산세가 부과됩니다.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CORPORATE FORM (법인세법 시행규칙 별지 제63호의3서식) */}
      {/* ============================================================== */}
      {formType === 'corporate' && (
        <div className="w-full flex flex-col justify-between text-[11px] leading-tight select-none">
          {/* Header */}
          <div>
            <div className="flex justify-between items-end text-[10px] text-gray-700 pb-1 border-b border-black">
              <span>■ 법인세법 시행규칙 [별지 제63호의3서식] &lt;개정 2021. 3. 16.&gt;</span>
              <span className="font-semibold">발급번호 : {receiptNo}</span>
            </div>

            <div className="text-center my-3">
              <h1 className="text-2xl font-extrabold tracking-widest font-serif text-black underline underline-offset-4 decoration-1">
                기 부 금 영 수 증 (법인용)
              </h1>
              <p className="text-[10px] text-gray-600 mt-1">
                (「법인세법 시행령」 제39조 등 관련)
              </p>
            </div>

            {/* Section 1: 기부법인 */}
            <div className="mt-2">
              <div className="font-bold text-[11px] mb-0.5 flex justify-between items-center">
                <span>1. 기부법인</span>
                <span className="text-[9.5px] font-normal text-gray-600">(사업연도: {taxYear}년도)</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[10.5px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      법인명 (상호)
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-semibold">
                      {donorName}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      사업자등록번호
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-mono">
                      {donorIdNumber || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      대표자 성명
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left">
                      -
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      본점 (사업장) 소재지
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left">
                      {donorAddress || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: 기부금영수증 발급자 */}
            <div className="mt-2.5">
              <div className="font-bold text-[11px] mb-0.5">2. 기부금영수증 발급자</div>
              <table className="w-full border-collapse border border-black text-center text-[10.5px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      법인명(단체명)
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-semibold">
                      {orgSnapshot.name}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2 w-[22%]">
                      사업자(고유)번호
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left w-[28%] font-mono">
                      {orgSnapshot.bizNo || orgSnapshot.registrationNo || '(미입력)'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      대표자 성명
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left">
                      {orgSnapshot.representative}
                    </td>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      기부금단체 지정근거
                    </th>
                    <td className="border border-black py-1.5 px-3 text-left">
                      {orgSnapshot.designationInfo || '공익법인(사회복지사업)'}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 font-semibold py-1.5 px-2">
                      본점 소재지
                    </th>
                    <td colSpan={3} className="border border-black py-1.5 px-3 text-left">
                      {orgSnapshot.address} {orgSnapshot.tel ? `(전화: ${orgSnapshot.tel})` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: 기부내용 */}
            <div className="mt-2.5">
              <div className="font-bold text-[11px] mb-0.5 flex justify-between">
                <span>3. 기부내용</span>
                <span className="text-[9.5px] font-normal text-gray-500">단위: 원</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[10px]">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="border border-black py-1.5 px-1 w-[18%]">구 분</th>
                    <th className="border border-black py-1.5 px-1 w-[12%]">기부코드</th>
                    <th className="border border-black py-1.5 px-1 w-[18%]">연월일</th>
                    <th className="border border-black py-1.5 px-1 w-[32%]">내 용</th>
                    <th className="border border-black py-1.5 px-1 w-[20%]">금 액</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDonations.map((item, idx) => (
                    <tr key={idx} className="h-6.5">
                      <td className="border border-black py-1 px-1">
                        {item.donationType || orgSnapshot.donationType || '-'}
                      </td>
                      <td className="border border-black py-1 px-1 font-mono">
                        {item.donationCode || orgSnapshot.donationCode || '-'}
                      </td>
                      <td className="border border-black py-1 px-1 font-mono">
                        {item.date}
                      </td>
                      <td className="border border-black py-1 px-1 text-left truncate max-w-[180px]">
                        {item.content || orgSnapshot.defaultContent || '-'} ({item.paymentMethod})
                      </td>
                      <td className="border border-black py-1 px-1 text-right font-mono font-semibold">
                        {formatKRW(item.amount)}
                      </td>
                    </tr>
                  ))}

                  {Array.from({ length: remainingRowsCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-6">
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                      <td className="border border-black py-1">&nbsp;</td>
                    </tr>
                  ))}

                  {/* Total Summary Row */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-black">
                    <td colSpan={2} className="border border-black py-2 px-2 text-center bg-gray-100">
                      합 계
                    </td>
                    <td colSpan={2} className="border border-black py-2 px-3 text-left font-serif text-[11px]">
                      {amountInKorean}
                    </td>
                    <td className="border border-black py-2 px-3 text-right font-mono text-[12px] font-extrabold text-black">
                      ₩ {formatKRW(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Statutory certification text */}
            <div className="mt-4 px-3 py-2.5 border border-black bg-slate-50/50 text-center">
              <p className="text-[11px] font-medium leading-relaxed">
                「법인세법」 제24조 및 같은 법 시행령 제39조에 따라 위와 같이 기부금을 영수하였음을 증명합니다.
              </p>

              <div className="mt-3 text-[12px] font-semibold tracking-wider font-serif">
                {formattedDate}
              </div>

              {/* Issuer Signature & Official Seal Stamp */}
              <div className="mt-3 flex items-center justify-end pr-8 relative">
                <div className="text-right text-[12px] font-serif leading-snug">
                  <div className="font-bold">{orgSnapshot.name}</div>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    <span>대표자 : </span>
                    <span className="font-bold tracking-widest text-[13px]">{orgSnapshot.representative}</span>
                    <span className="text-gray-600 font-sans text-[10.5px]">(서명 또는 인)</span>
                  </div>
                </div>

                {/* Digital Stamp Seal overlapping the name area */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <OfficialSeal
                    name={`${orgSnapshot.name}이사장인`}
                    customSealUrl={orgSnapshot.sealImage}
                    size={66}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Statutory instructions at bottom */}
          <div className="mt-4 pt-2 border-t border-black text-[9px] text-gray-700 leading-normal">
            <div className="font-bold text-[9.5px] text-black mb-1">■ 작성방법</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>기부법인의 법인명(상호), 사업자등록번호 및 본점소재지를 정확하게 적습니다.</li>
              <li>기부내용의 구분란에는 특례기부금(10), 일반기부금(40) 등 법인세법에 따른 구분을 적고 코드를 기재합니다.</li>
              <li>기부금영수증을 발급하는 법인은 기부자별 기부금영수증 발급명세서를 작성하여 5년간 보관하여야 합니다.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
});

OfficialReceiptA4.displayName = 'OfficialReceiptA4';
