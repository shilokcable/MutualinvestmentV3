import { jsPDF } from 'jspdf';
import type { KycData, StatementData } from '../types';

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function moneyStr(n: number): string {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addContainedImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  maxW: number,
  maxH: number
) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return false;
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxW / props.width, maxH / props.height);
    const w = props.width * ratio;
    const h = props.height * ratio;
    const ox = x + (maxW - w) / 2;
    const oy = y + (maxH - h) / 2;
    const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(dataUrl, fmt, ox, oy, w, h, undefined, 'MEDIUM');
    return true;
  } catch {
    return false;
  }
}

function drawPhotoFrame(
  doc: jsPDF,
  img: string | undefined,
  caption: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 5, 5, 'FD');

  const drawn = addContainedImage(doc, img, x + 4, y + 4, w - 8, h - 20);
  if (!drawn) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No Photo', x + w / 2, y + (h - 14) / 2, { align: 'center' });
  }

  doc.setFillColor(238, 245, 255);
  doc.rect(x + 1, y + h - 16, w - 2, 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(11, 61, 145);
  doc.text(caption, x + w / 2, y + h - 5.5, { align: 'center' });
}

function drawFieldCell(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(23, 50, 75);
  const text = String(value || '-');
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines[0] || '-', x, y + 11);
}

export async function generateKycPdf(kyc: KycData): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 595.28
  const pageH = doc.internal.pageSize.getHeight(); // 841.89
  const margin = 36;
  const contentW = pageW - margin * 2; // 523.28
  const logo = await fetchLogoDataUrl();

  // ================= PAGE 1: KYC PROFILE WITH INLINE PHOTOS =================
  if (logo) {
    addContainedImage(doc, logo, margin, 22, 148, 42);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(11, 61, 145);
  doc.text('SHAREHOLDER & NOMINEE KYC PROFILE', pageW - margin, 36, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `MUTUAL INVESTMENT-2026  •  Member ID: ${kyc.memberId}  •  Status: ${kyc.status || 'Completed'}`,
    pageW - margin,
    52,
    { align: 'right' }
  );

  doc.setDrawColor(219, 229, 243);
  doc.line(margin, 72, pageW - margin, 72);

  // Summary strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 82, contentW, 38, 5, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 36, 68);
  doc.text(kyc.name || kyc.memberId, margin + 12, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `ID: ${kyc.memberId}   |   BD Phone: ${kyc.bdPhone || '-'}   |   Profession: ${
      kyc.profession || '-'
    }   |   Submitted: ${kyc.updated || '-'}`,
    margin + 12,
    113
  );

  // ---------- 1. SHAREHOLDER INFORMATION (with Shareholder Photo in same row) ----------
  let y = 134;
  doc.setFillColor(238, 245, 255);
  doc.rect(margin, y, contentW, 21, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 61, 145);
  doc.text('1. Shareholder Information', margin + 8, y + 14.5);

  y += 30;
  const photoW = 90;
  const photoH = 108;
  const photoX = pageW - margin - photoW;
  drawPhotoFrame(
    doc,
    kyc.memberPhoto || kyc.photoData,
    'Shareholder Photo',
    photoX,
    y - 2,
    photoW,
    photoH
  );

  const leftAreaW = contentW - photoW - 14;
  const topColW = leftAreaW / 2;

  const shareholderTopRows: Array<[string, string]> = [
    ['Shareholder Full Name', kyc.name],
    ['NID Number', kyc.nidNumber],
    ['Date of Birth', kyc.dob],
    ['Father Name', kyc.fatherName],
    ['Mother Name', kyc.motherName],
    ['Spouse Name', kyc.spouseName],
    ['Marital Status', kyc.maritalStatus],
    ['Profession', kyc.profession],
  ];

  for (let i = 0; i < shareholderTopRows.length; i += 2) {
    const [l1, v1] = shareholderTopRows[i];
    const [l2, v2] = shareholderTopRows[i + 1] || ['', ''];
    drawFieldCell(doc, l1, v1, margin + 4, y, topColW - 10);
    if (l2) {
      drawFieldCell(doc, l2, v2, margin + topColW + 4, y, topColW - 10);
    }
    y += 28;
  }

  // Remaining shareholder contact & address rows (full width)
  const fullColW = contentW / 2;
  const shareholderMoreRows: Array<[string, string]> = [
    ['Bangladesh Phone', kyc.bdPhone],
    ['WhatsApp', kyc.whatsapp],
    ['Overseas Phone', kyc.overseasPhone],
    ['Email Address', kyc.email],
    ['TIN Number', kyc.tinNumber],
    ['Passport Number', kyc.passportNumber],
  ];

  y = Math.max(y, 280);
  for (let i = 0; i < shareholderMoreRows.length; i += 2) {
    const [l1, v1] = shareholderMoreRows[i];
    const [l2, v2] = shareholderMoreRows[i + 1] || ['', ''];
    drawFieldCell(doc, l1, v1, margin + 4, y, fullColW - 12);
    if (l2) {
      drawFieldCell(doc, l2, v2, margin + fullColW + 4, y, fullColW - 12);
    }
    y += 27;
  }

  for (const [label, val] of [
    ['Present Address', kyc.presentAddress],
    ['Permanent Address', kyc.permanentAddress],
  ] as const) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(23, 50, 75);
    const wrapped = doc.splitTextToSize(val || '-', contentW - 10).slice(0, 2);
    doc.text(wrapped, margin + 4, y + 11);
    y += wrapped.length * 11 + 16;
  }

  // ---------- 2. NOMINEE INFORMATION (with Nominee Photo in same row) ----------
  y += 6;
  doc.setFillColor(238, 245, 255);
  doc.rect(margin, y, contentW, 21, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 61, 145);
  doc.text('2. Nominee Information', margin + 8, y + 14.5);

  y += 30;
  drawPhotoFrame(doc, kyc.nomineePhoto, 'Nominee Photo', photoX, y - 2, photoW, photoH);

  const nomineeGridRows: Array<[string, string]> = [
    ['Nominee Full Name', kyc.nomineeName],
    ['Nominee NID Number', kyc.nomineeNid],
    ['Nominee Date of Birth', kyc.nomineeDob],
    ['Relation with Shareholder', kyc.nomineeRelation],
    ['Nominee Phone', kyc.nomineePhone],
  ];

  let ny = y;
  for (let i = 0; i < nomineeGridRows.length; i += 2) {
    const [l1, v1] = nomineeGridRows[i];
    const [l2, v2] = nomineeGridRows[i + 1] || ['', ''];
    drawFieldCell(doc, l1, v1, margin + 4, ny, topColW - 10);
    if (l2) {
      drawFieldCell(doc, l2, v2, margin + topColW + 4, ny, topColW - 10);
    }
    ny += 28;
  }

  // Nominee Address next to photo lower edge or full width
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Nominee Address', margin + 4, ny);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(23, 50, 75);
  const nomAddrWrapped = doc.splitTextToSize(kyc.nomineeAddress || '-', leftAreaW - 8).slice(0, 2);
  doc.text(nomAddrWrapped, margin + 4, ny + 11);

  y = Math.max(ny + nomAddrWrapped.length * 11 + 18, y + photoH + 14);

  if (kyc.notes && y < pageH - 80) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Additional Notes', margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(23, 50, 75);
    doc.text(doc.splitTextToSize(kyc.notes, contentW - 8).slice(0, 2), margin + 4, y + 11);
  }

  // Signature Footer on Page 1
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageH - 54, margin + 170, pageH - 54);
  doc.line(pageW - margin - 170, pageH - 54, pageW - margin, pageH - 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Shareholder Signature', margin, pageH - 42);
  doc.text('Authorized Signature (MUTUAL INVESTMENT-2026)', pageW - margin, pageH - 42, {
    align: 'right',
  });

  // ================= PAGE 2: BOTH SHAREHOLDER & NOMINEE NID ON 1 A4 PAGE =================
  // Front Page on Top (upore), Back Page on Bottom (niche)
  // Left Column = Shareholder NID, Right Column = Nominee NID
  doc.addPage();
  const nidMargin = 34;
  const colGap = 16;
  const colW = (pageW - nidMargin * 2 - colGap) / 2; // ~255.6 pt
  const leftColX = nidMargin;
  const rightColX = nidMargin + colW + colGap;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(11, 61, 145);
  doc.text(`NID VERIFICATION SHEET — ${kyc.name || kyc.memberId} (${kyc.memberId})`, nidMargin, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Single A4 Document: Front Side on Top • Back Side on Bottom (Shareholder & Nominee)',
    nidMargin,
    51
  );

  // Column banners
  doc.setFillColor(238, 245, 255);
  doc.roundedRect(leftColX, 64, colW, 24, 4, 4, 'F');
  doc.roundedRect(rightColX, 64, colW, 24, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 61, 145);
  doc.text('Shareholder NID', leftColX + colW / 2, 79.5, { align: 'center' });
  doc.text('Nominee NID', rightColX + colW / 2, 79.5, { align: 'center' });

  const boxH = 332;
  const frontY = 98;
  const backY = frontY + boxH + 16; // 446 -> bottom 778

  const nidCards = [
    {
      title: 'FRONT SIDE (উপরের অংশ)',
      subtitle: 'Shareholder NID Front',
      img: kyc.shareholderNidFront,
      x: leftColX,
      y: frontY,
    },
    {
      title: 'FRONT SIDE (উপরের অংশ)',
      subtitle: 'Nominee NID Front',
      img: kyc.nomineeNidFront,
      x: rightColX,
      y: frontY,
    },
    {
      title: 'BACK SIDE (নিচের অংশ)',
      subtitle: 'Shareholder NID Back',
      img: kyc.shareholderNidBack,
      x: leftColX,
      y: backY,
    },
    {
      title: 'BACK SIDE (নিচের অংশ)',
      subtitle: 'Nominee NID Back',
      img: kyc.nomineeNidBack,
      x: rightColX,
      y: backY,
    },
  ];

  for (const card of nidCards) {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(card.x, card.y, colW, boxH, 7, 7, 'FD');

    doc.setFillColor(241, 245, 249);
    doc.rect(card.x + 1, card.y + 1, colW - 2, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 36, 68);
    doc.text(card.subtitle, card.x + 10, card.y + 16);

    const drawn = addContainedImage(doc, card.img, card.x + 10, card.y + 32, colW - 20, boxH - 42);
    if (!drawn) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('NID Image Not Uploaded', card.x + colW / 2, card.y + boxH / 2, {
        align: 'center',
      });
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'MUTUAL INVESTMENT-2026 • Shareholder & Nominee NID Verification Record (A4 Single Sheet)',
    pageW / 2,
    pageH - 28,
    { align: 'center' }
  );

  // ================= PAGE 3: PASSPORT COPY (IF AVAILABLE) =================
  if (kyc.passportCopy) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 61, 145);
    doc.text(`Passport Copy — ${kyc.name} (${kyc.memberId})`, margin, 42);
    doc.setDrawColor(219, 229, 243);
    doc.roundedRect(margin, 64, pageW - margin * 2, pageH - 110, 8, 8, 'S');
    addContainedImage(doc, kyc.passportCopy, margin + 12, 76, pageW - margin * 2 - 24, pageH - 134);
  }

  // ================= PAGE 4: TIN CERTIFICATE (IF AVAILABLE) =================
  if (kyc.tinCertificate) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 61, 145);
    doc.text(`TIN Certificate — ${kyc.name} (${kyc.memberId})`, margin, 42);
    doc.setDrawColor(219, 229, 243);
    doc.roundedRect(margin, 64, pageW - margin * 2, pageH - 110, 8, 8, 'S');
    addContainedImage(doc, kyc.tinCertificate, margin + 12, 76, pageW - margin * 2 - 24, pageH - 134);
  }

  doc.save(`${kyc.memberId || 'Member'}_KYC.pdf`);
}

export async function generateStatementPdf(stmt: StatementData): Promise<void> {
  // Strictly ONE single A4 page with standard banking statement typography
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 595.28
  const pageH = doc.internal.pageSize.getHeight(); // 841.89
  const margin = 36;
  const contentW = pageW - margin * 2; // 523.28
  const logo = await fetchLogoDataUrl();

  if (logo) {
    addContainedImage(doc, logo, margin, 24, 150, 44);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(11, 61, 145);
  doc.text('ACCOUNT STATEMENT', pageW - margin, 40, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('MUTUAL INVESTMENT-2026  •  Together We Grow', pageW - margin, 55, { align: 'right' });

  doc.setDrawColor(219, 229, 243);
  doc.line(margin, 76, pageW - margin, 76);

  // Member Metadata Box
  let y = 92;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 36, 68);
  doc.text(`Member Name: ${stmt.name}`, margin, y);
  doc.text(`Member ID: ${stmt.memberId}`, margin + 290, y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Mobile: ${stmt.mobile || '-'}`, margin, y);
  doc.text(`Account Status: ${stmt.accountStatus}`, margin + 290, y);

  // Balance & Institutional Summary Card
  y += 16;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, contentW, 48, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text('NET DEPOSIT BALANCE (SHAREHOLDER CAPITAL)', margin + 12, y + 17);
  doc.setFontSize(15);
  doc.text(`BDT ${moneyStr(stmt.total)}`, margin + 12, y + 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Main Bank: BDT ${moneyStr(stmt.mainBank)}`, pageW - margin - 12, y + 15, { align: 'right' });
  doc.text(`Active FDR: BDT ${moneyStr(stmt.fdrBalance)}`, pageW - margin - 12, y + 28, { align: 'right' });
  doc.text(`Total Institutional: BDT ${moneyStr(stmt.totalInstitutional)}`, pageW - margin - 12, y + 41, {
    align: 'right',
  });

  // Table Header
  y += 64;
  const headerH = 22;
  doc.setFillColor(238, 245, 255);
  doc.rect(margin, y, contentW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 61, 145);
  doc.text('Date', margin + 8, y + 14.5);
  doc.text('Transaction Type', margin + 88, y + 14.5);
  doc.text('Amount (BDT)', margin + 290, y + 14.5, { align: 'right' });
  doc.text('Note / Reference', margin + 308, y + 14.5);
  y += headerH;

  // Strictly fit inside single A4 page (reserve bottom 76pt for Totals + Footer)
  const tableBottomLimit = pageH - 82; // 759.89
  const availableH = tableBottomLimit - y; // ~519 pt

  const totalDeposits = stmt.transactions
    .filter((t) => t.type !== 'Withdrawal')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalWithdrawals = stmt.transactions
    .filter((t) => t.type === 'Withdrawal')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  if (!stmt.transactions.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No transactions recorded yet.', margin + 8, y + 24);
  } else {
    const minRowH = 14.5;
    const maxDisplayRows = Math.floor(availableH / minRowH);
    const needsSummaryCarry = stmt.transactions.length > maxDisplayRows;

    const rowsToRender = needsSummaryCarry
      ? stmt.transactions.slice(0, maxDisplayRows - 1)
      : stmt.transactions;
    const omittedRows = needsSummaryCarry
      ? stmt.transactions.slice(maxDisplayRows - 1)
      : [];

    const totalSlots = rowsToRender.length + (omittedRows.length > 0 ? 1 : 0);
    const rowH = Math.min(20, Math.max(minRowH, Math.floor(availableH / totalSlots)));
    const rowFont = rowH >= 18 ? 9 : 8.5;
    const baselineOffset = rowH * 0.68;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(rowFont);

    for (let i = 0; i < rowsToRender.length; i++) {
      const tx = rowsToRender[i];
      if (i % 2 === 1) {
        doc.setFillColor(250, 252, 255);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      doc.setDrawColor(237, 242, 250);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);

      const isWd = tx.type === 'Withdrawal';
      doc.setTextColor(51, 65, 85);
      doc.text(String(tx.date || ''), margin + 8, y + baselineOffset);

      doc.setTextColor(15, 36, 68);
      doc.text(String(tx.type || ''), margin + 88, y + baselineOffset);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isWd ? 185 : 15, isWd ? 28 : 135, isWd ? 28 : 75);
      doc.text(`${isWd ? '-' : '+'}${moneyStr(tx.amount)}`, margin + 290, y + baselineOffset, {
        align: 'right',
      });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(tx.note || '-').slice(0, 38), margin + 308, y + baselineOffset);

      y += rowH;
    }

    if (omittedRows.length > 0) {
      const broughtForward = omittedRows.reduce(
        (s, x) => s + (x.type === 'Withdrawal' ? -Number(x.amount || 0) : Number(x.amount || 0)),
        0
      );
      doc.setFillColor(244, 247, 252);
      doc.rect(margin, y, contentW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(rowFont);
      doc.setTextColor(71, 85, 105);
      doc.text('Earlier', margin + 8, y + baselineOffset);
      doc.text(
        `Brought Forward (${omittedRows.length} earlier entries)`,
        margin + 88,
        y + baselineOffset
      );
      doc.text(`${broughtForward >= 0 ? '+' : ''}${moneyStr(broughtForward)}`, margin + 290, y + baselineOffset, {
        align: 'right',
      });
      doc.text('Included in Net Balance', margin + 308, y + baselineOffset);
      y += rowH;
    }
  }

  // Bottom Totals Summary Strip (always fits on Page 1)
  const footerSummaryY = pageH - 70;
  doc.setFillColor(246, 249, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, footerSummaryY, contentW, 28, 5, 5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 36, 68);
  doc.text(`Total Deposits: BDT ${moneyStr(totalDeposits)}`, margin + 12, footerSummaryY + 17.5);
  doc.text(`Withdrawals: BDT ${moneyStr(totalWithdrawals)}`, margin + 210, footerSummaryY + 17.5);
  doc.setTextColor(11, 61, 145);
  doc.text(`Closing Balance: BDT ${moneyStr(stmt.total)}`, pageW - margin - 12, footerSummaryY + 17.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB')}  •  MUTUAL INVESTMENT-2026 Single-Page A4 Statement`,
    pageW / 2,
    pageH - 24,
    { align: 'center' }
  );

  doc.save(`${stmt.memberId}_Statement.pdf`);
}
