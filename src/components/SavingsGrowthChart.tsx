import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { TransactionItem } from '../types';
import { money } from '../utils/format';

interface SavingsGrowthChartProps {
  transactions: TransactionItem[];
  currentBalance: number;
}

interface MonthlyPoint {
  monthKey: string;
  label: string;
  fullLabel: string;
  balance: number | null;
  deposits: number;
  withdrawals: number;
  netChange: number;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatCompactAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}৳${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}৳${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}৳${abs}`;
}

export function SavingsGrowthChart({ transactions, currentBalance }: SavingsGrowthChartProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    for (const tx of transactions) {
      const y = Number((tx.date || '').slice(0, 4));
      if (!Number.isNaN(y) && y >= 2000 && y <= 2100) {
        years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(() => availableYears[0] || new Date().getFullYear());

  const activeYear = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  const { chartData, yearDepositTotal, yearWithdrawalTotal, yearNetGrowth } = useMemo(() => {
    let priorBalance = 0;
    const monthDeposits = Array<number>(12).fill(0);
    const monthWithdrawals = Array<number>(12).fill(0);
    let lastTxMonthInYear = -1;

    for (const tx of transactions) {
      const dateStr = (tx.date || '').trim();
      const y = Number(dateStr.slice(0, 4));
      const m = Number(dateStr.slice(5, 7)) - 1;
      const amt = Number(tx.amount || 0);
      const isWd = tx.type === 'Withdrawal';
      const signed = isWd ? -amt : amt;

      if (Number.isNaN(y) || y < activeYear) {
        if (!Number.isNaN(y) && y < activeYear) {
          priorBalance += signed;
        }
        continue;
      }

      if (y === activeYear && m >= 0 && m <= 11) {
        if (isWd) {
          monthWithdrawals[m] += amt;
        } else {
          monthDeposits[m] += amt;
        }
        if (m > lastTxMonthInYear) {
          lastTxMonthInYear = m;
        }
      }
    }

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const cutoffMonth =
      activeYear < nowYear
        ? 11
        : activeYear === nowYear
        ? Math.max(nowMonth, lastTxMonthInYear)
        : lastTxMonthInYear;

    let running = priorBalance;
    let depSum = 0;
    let wdSum = 0;

    const points: MonthlyPoint[] = MONTH_LABELS.map((label, idx) => {
      const dep = monthDeposits[idx];
      const wd = monthWithdrawals[idx];
      const net = dep - wd;
      depSum += dep;
      wdSum += wd;
      running += net;

      const withinRange = idx <= cutoffMonth;
      return {
        monthKey: `${activeYear}-${String(idx + 1).padStart(2, '0')}`,
        label,
        fullLabel: `${FULL_MONTH_NAMES[idx]} ${activeYear}`,
        balance: withinRange ? running : null,
        deposits: dep,
        withdrawals: wd,
        netChange: net,
      };
    });

    return {
      chartData: points,
      yearDepositTotal: depSum,
      yearWithdrawalTotal: wdSum,
      yearNetGrowth: depSum - wdSum,
    };
  }, [transactions, activeYear]);

  return (
    <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#edf2f8]">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0f2444] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0f9f59]" />
            বার্ষিক সঞ্চয় বৃদ্ধির গ্রাফ (Monthly Savings Growth)
          </h2>
          <div className="text-xs text-[#64748b] mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono-num">
            <span>
              {activeYear} Net Growth:{' '}
              <strong className={yearNetGrowth >= 0 ? 'text-[#0f9f59]' : 'text-red-600'}>
                {yearNetGrowth >= 0 ? '+' : '−'}৳ {money(Math.abs(yearNetGrowth))}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>Deposits: +৳ {money(yearDepositTotal)}</span>
            {yearWithdrawalTotal > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Withdrawals: −৳ {money(yearWithdrawalTotal)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Current: ৳ {money(currentBalance)}</span>
          </div>
        </div>

        {availableYears.length > 1 ? (
          <div className="flex items-center gap-1 p-1 bg-[#f1f5fb] rounded-xl self-start sm:self-auto no-print">
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 text-xs font-mono-num font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  yr === activeYear
                    ? 'bg-white text-[#0b3d91] shadow-xs'
                    : 'text-[#64748b] hover:text-[#13294b]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-mono-num font-semibold text-[#0b3d91] shrink-0">
            FY {activeYear}
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#64748b]">
          এখনও কোনো সঞ্চয় লেনদেন যুক্ত হয়নি। লেনদেন এন্ট্রি হলে এখানে সারা বছরের মাসিক সঞ্চয় বৃদ্ধির গ্রাফ দেখা যাবে।
        </div>
      ) : (
        <div className="mt-4 w-full min-w-0 h-[270px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#edf2f8" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={{ stroke: '#dce4f0' }}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={formatCompactAxis}
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={66}
              />
              <Tooltip
                cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0].payload as MonthlyPoint;
                  if (pt.balance === null) return null;
                  return (
                    <div className="bg-white border border-[#dce4f0] rounded-xl px-3.5 py-2.5 shadow-md text-xs">
                      <div className="font-semibold text-[#0f2444] mb-1.5">{pt.fullLabel}</div>
                      <div className="space-y-1 font-mono-num">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#64748b]">Savings Balance</span>
                          <span className="font-bold text-[#0f9f59]">৳ {money(pt.balance)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#64748b]">Monthly Deposit</span>
                          <span className="font-semibold text-[#0b3d91]">+৳ {money(pt.deposits)}</span>
                        </div>
                        {pt.withdrawals > 0 && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[#64748b]">Withdrawal</span>
                            <span className="font-semibold text-red-600">−৳ {money(pt.withdrawals)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="Savings Balance"
                stroke="#0f9f59"
                strokeWidth={2.75}
                dot={{ r: 3.5, fill: '#0f9f59', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#0b3d91', stroke: '#ffffff', strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
