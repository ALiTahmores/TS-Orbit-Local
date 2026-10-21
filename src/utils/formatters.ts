/**
 * Persian number and formatting utility functions
 */

export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const formatCurrency = (amount: number | string): string => {
  if (typeof amount === 'string' && amount.includes('تومان')) return amount;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9]/g, '')) || 0 : amount;
  const formatted = num.toLocaleString('fa-IR');
  return `${toPersianDigits(formatted)} تومان`;
};

export const formatPercent = (percent: number): string => {
  return `${toPersianDigits(Math.round(percent))}٪`;
};
