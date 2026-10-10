import footerUrl from './assets/bill-footer.jpg';
import headerUrl from './assets/bill-header.jpg';
import { formatNumber, formatRupees } from './flock.js';

// A sale's bill as a one-page PDF, made in the browser. The page is drawn on a
// canvas between the letterhead and the footer picture, so it carries the app's
// own font and the rupee sign, and the picture of it is then wrapped in a PDF.

// Width of the drawing in pixels: an A4 page at about 150 dots per inch
const WIDTH = 1240;
const A4_HEIGHT = 1754;
const MARGIN = 80;
// Width of an A4 page in PDF points
const PAGE_WIDTH = 595.28;

// The paper colour of the letterhead and of the top of the footer picture
const PAPER = '#f9f8f0';
const PAPER_FOOT = '#fcfaf5';
const ORANGE = '#ee6620';
const INK = '#414042';
const SOFT = '#5f5c5e';
const LINE = '#ecdcca';
const CREAM = '#f6ecdd';
const ORANGE_SOFT = '#fbe4d4';

const font = (size, weight = 400) => `${weight} ${size}px Poppins, 'Segoe UI', Roboto, Arial, sans-serif`;

// Left edges of the columns read from the left, right edges of those read from the right
const COLUMNS = { item: MARGIN + 16, qty: 720, price: 860, unit: 885, total: WIDTH - MARGIN - 16 };

// `text` cut short with an ellipsis so it is no wider than `width`
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// The bill drawn on a canvas. `bill` is
// { date, customer: { name, phone, address, business, gstin }, rows: [{ item,
// qty, price, unit, total }], subtotal, discount, discountNote,
// amount, paid, balance }
function drawBill(bill, header, footer) {
  const { customer, rows } = bill;
  const party = [
    customer.phone,
    customer.address,
    customer.business,
    customer.gstin && `GST No: ${customer.gstin}`,
  ].filter(Boolean);
  const sums = [
    ['Subtotal', formatRupees(bill.subtotal)],
    bill.discount > 0 && [
      bill.discountNote ? `Discount (${bill.discountNote})` : 'Discount',
      `− ${formatRupees(bill.discount)}`,
    ],
  ].filter(Boolean);
  const paidLines = [
    ['Paid', formatRupees(bill.paid)],
    bill.balance > 0 && ['To Pay', formatRupees(bill.balance)],
  ].filter(Boolean);

  // Both pictures run the full width of the page
  const headHeight = Math.round((header.height * WIDTH) / header.width);
  const footHeight = Math.round((footer.height * WIDTH) / footer.width);

  const ROW = 62;
  const tableTop = headHeight + 150 + party.length * 38;
  const sumsTop = tableTop + ROW * (rows.length + 1) + 30;
  const bottom = sumsTop + (sums.length + paidLines.length) * 50 + 130 + footHeight;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.max(A4_HEIGHT, bottom);
  const ctx = canvas.getContext('2d');
  const right = WIDTH - MARGIN;
  const write = (text, x, y, align = 'left') => {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  // The paper shades from the letterhead's colour into the footer's, so neither shows an edge
  const paper = ctx.createLinearGradient(0, headHeight, 0, canvas.height - footHeight);
  paper.addColorStop(0, PAPER);
  paper.addColorStop(1, PAPER_FOOT);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(header, 0, 0, WIDTH, headHeight);
  ctx.drawImage(footer, 0, canvas.height - footHeight, WIDTH, footHeight);
  ctx.textBaseline = 'alphabetic';

  // Who it is for, and the day
  ctx.fillStyle = ORANGE;
  ctx.font = font(20, 700);
  write('BILL TO', MARGIN, headHeight + 65);
  write('DATE', right, headHeight + 65, 'right');
  ctx.fillStyle = INK;
  ctx.font = font(34, 700);
  write(fit(ctx, customer.name, 700), MARGIN, headHeight + 110);
  ctx.font = font(28, 600);
  write(
    new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    right,
    headHeight + 110,
    'right',
  );
  ctx.fillStyle = SOFT;
  ctx.font = font(26);
  party.forEach((line, i) =>
    write(fit(ctx, line, right - MARGIN), MARGIN, headHeight + 152 + i * 38),
  );

  // The lines of the bill
  ctx.fillStyle = CREAM;
  ctx.fillRect(MARGIN, tableTop, right - MARGIN, ROW);
  ctx.fillStyle = SOFT;
  ctx.font = font(20, 700);
  const headY = tableTop + 39;
  write('ITEM', COLUMNS.item, headY);
  write('KG / QTY', COLUMNS.qty, headY, 'right');
  write('PRICE', COLUMNS.price, headY, 'right');
  write('UNIT', COLUMNS.unit, headY);
  write('TOTAL', COLUMNS.total, headY, 'right');

  rows.forEach((row, i) => {
    const top = tableTop + ROW * (i + 1);
    const y = top + 40;
    ctx.fillStyle = INK;
    ctx.font = font(26, 600);
    write(fit(ctx, row.item, 460), COLUMNS.item, y);
    ctx.font = font(24);
    write(formatNumber(row.qty), COLUMNS.qty, y, 'right');
    write(formatRupees(row.price), COLUMNS.price, y, 'right');
    write(fit(ctx, row.unit || '', 80), COLUMNS.unit, y);
    ctx.font = font(26, 600);
    write(formatRupees(row.total), COLUMNS.total, y, 'right');
    ctx.fillStyle = LINE;
    ctx.fillRect(MARGIN, top + ROW - 2, right - MARGIN, 2);
  });

  // What it comes to
  const labelX = 760;
  let y = sumsTop + 30;
  ctx.font = font(26);
  sums.forEach(([label, value]) => {
    ctx.fillStyle = SOFT;
    write(label, labelX, y);
    ctx.fillStyle = INK;
    write(value, COLUMNS.total, y, 'right');
    y += 50;
  });
  ctx.fillStyle = ORANGE_SOFT;
  ctx.fillRect(labelX - 24, y - 38, right - labelX + 24, 70);
  ctx.fillStyle = INK;
  ctx.font = font(32, 700);
  write('Final Total', labelX, y + 10);
  write(formatRupees(bill.amount), COLUMNS.total, y + 10, 'right');
  y += 90;
  ctx.font = font(26);
  paidLines.forEach(([label, value], i) => {
    const owed = i === 1;
    ctx.fillStyle = owed ? '#b3261e' : SOFT;
    ctx.font = font(26, owed ? 700 : 400);
    write(label, labelX, y);
    write(value, COLUMNS.total, y, 'right');
    y += 50;
  });

  return canvas;
}

// A one-page PDF holding a JPEG picture that fills the page. `jpeg` is the bytes
// of the picture, `width` and `height` its size in pixels.
export function pdfFromJpeg(jpeg, width, height) {
  const pageHeight = Number(((PAGE_WIDTH * height) / width).toFixed(2));
  const draw = `q ${PAGE_WIDTH} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const add = (part) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  // Each object is found again by where it starts in the file
  const object = (number, ...body) => {
    offsets[number] = length;
    add(`${number} 0 obj\n`);
    body.forEach(add);
    add('\nendobj\n');
  };

  add('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${pageHeight}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
  );
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  );
  object(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);

  const xref = length;
  add('xref\n0 6\n0000000000 65535 f \n');
  for (let number = 1; number <= 5; number += 1) {
    add(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  }
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load a picture of the bill'));
    image.src = url;
  });

// The bill drawn out, once the pictures and the font it needs are there
export async function billCanvas(bill) {
  // Text drawn before the app's font has loaded comes out in another one
  await document.fonts?.ready;
  const [header, footer] = await Promise.all([loadImage(headerUrl), loadImage(footerUrl)]);
  return drawBill(bill, header, footer);
}

// The bill as a PDF file, named after the customer and the day
export async function billPdf(bill) {
  const canvas = await billCanvas(bill);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const name = bill.customer.name.trim().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'customer';
  return new File([pdfFromJpeg(jpeg, canvas.width, canvas.height)], `bill-${name}-${bill.date}.pdf`, {
    type: 'application/pdf',
  });
}
