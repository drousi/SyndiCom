import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { getPeriodShortLabels } from '../constants/app';
import { useLanguageStore } from '../store/language.store';
import type { DashboardStats, Apartment, ContributionWithApartment, Expense, ResidenceWithRole } from '../types';

interface LedgerOperation {
  date: string;
  created_at: string;
  desc: string;
  sign: '+' | '-';
  amount: number;
  balance?: number;
}

interface GroupedContribution {
  date: string;
  created_at: string;
  apartment_id: string;
  year: number;
  amount: number;
  months: string[];
}

export async function generateDashboardPDF(
  allContribs: ContributionWithApartment[],
  allApts: Apartment[],
  allExpenses: Expense[],
  stats: DashboardStats,
  activeResidence: ResidenceWithRole | null
) {
  const { t, locale } = useLanguageStore.getState();
  const isRTL = locale === 'ar';
  const dateLocaleStr = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const currency = activeResidence?.currency ?? 'DH';

  try {
    const frequency = activeResidence?.contribution_frequency ?? 'monthly';
    const periodShortLabels = getPeriodShortLabels(frequency);
    const maxPeriods = periodShortLabels.length;

    const ops: LedgerOperation[] = [];
    const groupedContribs = new Map<string, GroupedContribution>();
    allContribs.filter(c => c.paid).forEach(c => {
      const dateStr = new Date(c.paid_at || c.created_at).toISOString().split('T')[0];
      const key = `${c.apartment_id}_${dateStr}`;
      const monthLabel = (periodShortLabels[c.month - 1] || '').toUpperCase();

      if (groupedContribs.has(key)) {
        const group = groupedContribs.get(key);
        group.amount += c.amount;
        group.months.push(monthLabel);
      } else {
        groupedContribs.set(key, {
          date: c.paid_at || c.created_at,
          created_at: c.created_at,
          apartment_id: c.apartment_id,
          year: c.year,
          amount: c.amount,
          months: [monthLabel],
        });
      }
    });

    groupedContribs.forEach(group => {
      const aptNumber = allApts.find(a => a.id === group.apartment_id)?.number || '';
      const periodsCount = group.months.length;
      const unit = frequency === 'quarterly'
        ? t('pdf.period_unit_quarter')
        : frequency === 'yearly'
          ? t('pdf.period_unit_year')
          : t('pdf.period_unit_month');

      ops.push({
        date: group.date,
        created_at: group.created_at,
        desc: t('pdf.contribution_desc', { number: aptNumber, count: periodsCount, unit, year: group.year }),
        sign: '+',
        amount: group.amount
      });
    });
    allExpenses.forEach(e => {
      ops.push({
        date: e.date,
        created_at: e.created_at,
        desc: e.description || e.type,
        sign: '-',
        amount: e.amount
      });
    });

    // Trier par ordre de date (sans l'heure), puis par date de création
    ops.sort((a, b) => {
      const dateStrA = new Date(a.date).toISOString().split('T')[0];
      const dateStrB = new Date(b.date).toISOString().split('T')[0];

      if (dateStrA === dateStrB) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(dateStrA).getTime() - new Date(dateStrB).getTime();
    });

    let currentBalance = 0;
    ops.forEach(op => {
      currentBalance += op.sign === '+' ? op.amount : -op.amount;
      op.balance = currentBalance;
    });

    const renderLedgerRows = (list: LedgerOperation[]) => {
      if (list.length === 0) return `<tr><td colspan="5" style="text-align: center; padding: 10px;">-</td></tr>`;
      return list.map(op => {
        const rowColor = op.sign === '+' ? '#388E3C' : '#D32F2F';
        const bal = op.balance ?? 0;
        const balColor = bal >= 0 ? '#388E3C' : '#D32F2F';
        return `
        <tr style="color: ${rowColor};">
          <td class="lcol-date">${new Date(op.date).toLocaleDateString(dateLocaleStr)}</td>
          <td class="lcol-desc">${op.desc}</td>
          <td class="lcol-sign">${op.sign}</td>
          <td class="lcol-amt">${op.amount}</td>
          <td class="lcol-bal" style="color: ${balColor};"><span dir="ltr">${bal}</span></td>
        </tr>
        `;
      }).join('');
    };

    const totalExp = stats.totalExpenses ?? 0;
    const currentBal = stats.balance ?? 0;
    const totalContribs = currentBal + totalExp;

    const html = `
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          ${isRTL
            ? '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">'
            : '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">'}
          <style>
            body { font-family: ${isRTL ? "'Cairo', 'Tahoma'" : "'Inter', 'Arial', 'Helvetica Neue'"}, sans-serif; padding: 20px; color: #333; direction: ${isRTL ? 'rtl' : 'ltr'}; }
            h1 { text-align: center; color: #0D1B2A; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
            
            .summary-cards { display: flex; gap: 15px; margin-bottom: 15px; }
            .card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0; }
            .card-green { background-color: rgba(76, 175, 80, 0.1); border-color: #4CAF50; color: #388E3C; }
            .card-danger { background-color: rgba(239, 68, 68, 0.1); border-color: #EF4444; color: #B91C1C; }
            .card-navy { background-color: rgba(13, 27, 42, 0.1); border-color: #0D1B2A; color: #0D1B2A; }
            .card-title { font-size: 10px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
            .card-value { font-size: 16px; font-weight: bold; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            th, td { border: 1px solid #E2E8F0; padding: 6px; text-align: center; }
            thead th { background-color: #1B263B; color: #FFF; border-color: #1B263B; }
            
            /* Zebra lines for all tables */
            tbody tr:nth-child(even) { background-color: #F8FAFC; }
            tbody tr:nth-child(even) th { background-color: #F8FAFC; }
            
            tfoot th { background-color: #F1F5F9; color: #0D1B2A; font-weight: bold; }
            
            .ledger-container { margin-top: 20px; }
            .ledger-title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px; color: #0D1B2A; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
            .legend { font-size: 10px; margin-top: 10px; color: #64748B; font-style: italic; text-align: center; break-before: avoid; page-break-before: avoid; }

            /* Tableau du journal des opérations */
            .ledger-table { width: 100%; border-collapse: collapse; font-size: ${isRTL ? '8px' : '9px'}; margin-top: 0; }
            .ledger-table thead { display: table-header-group; }
            .ledger-table thead th { background-color: #1B263B; color: #FFF; border-color: #1B263B; font-weight: bold; padding: ${isRTL ? '4px 3px' : '5px 4px'}; text-align: center; }
            .ledger-table tbody tr { page-break-inside: avoid; }
            .ledger-table tbody tr:nth-child(even) { background-color: #F8FAFC; }
            .ledger-table td { border: 1px solid #E2E8F0; padding: ${isRTL ? '2px 3px' : '3px 4px'}; }
            .lcol-date { width: 20%; text-align: center; }
            .lcol-desc { width: 39%; text-align: ${isRTL ? 'right' : 'left'}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
            .lcol-sign { width: 6%; text-align: center; font-weight: bold; }
            .lcol-amt { width: 16%; text-align: center; font-weight: bold; }
            .lcol-bal { width: 19%; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${t('pdf.title')} - ${(activeResidence?.name || '').toUpperCase()}</h1>

          <div class="summary-cards">
            <div class="card card-green">
              <div class="card-title">${t('pdf.total_contributions')}</div>
              <div class="card-value"><span dir="ltr">${totalContribs.toLocaleString(dateLocaleStr)} ${currency}</span></div>
            </div>
            <div class="card card-danger">
              <div class="card-title">${t('pdf.total_expenses')}</div>
              <div class="card-value"><span dir="ltr">${totalExp.toLocaleString(dateLocaleStr)} ${currency}</span></div>
            </div>
            <div class="card card-navy">
              <div class="card-title">${t('pdf.balance')}</div>
              <div class="card-value"><span dir="ltr">${currentBal.toLocaleString(dateLocaleStr)} ${currency}</span></div>
            </div>
          </div>

          <table class="grid-table">
            <thead>
              <tr>
                <th>${t('pdf.col_apartment')}</th>
                ${periodShortLabels.map(label => `<th>${label.toUpperCase()}</th>`).join('')}
                <th>${t('pdf.col_annual_total')}</th>
              </tr>
            </thead>
            <tbody>
              ${allApts.map(apt => {
      const aptTotal = allContribs.filter(c => c.apartment_id === apt.id).reduce((sum, c) => sum + c.amount, 0);
      const residentName = apt.owner_name ? ` (${apt.owner_name})` : '';
      return `
                <tr>
                  <th>${apt.number}${residentName}</th>
                  ${Array.from({ length: maxPeriods }, (_, i) => {
        const contrib = allContribs.find(c => c.apartment_id === apt.id && c.month === i + 1);
        if (contrib && contrib.amount > 0) return `<td style="padding: 2px;"><span style="background-color: #E8F5E9; color: #2E7D32; border-radius: 4px; padding: 3px 5px; font-weight: bold; display: inline-block;">${contrib.amount}</span></td>`;
        return `<td></td>`;
      }).join('')}
                  <th style="background-color: transparent;">${aptTotal > 0 ? aptTotal : ''}</th>
                </tr>
                `;
    }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th style="text-align: ${isRTL ? 'right' : 'left'};">
                  ${frequency === 'quarterly' ? t('pdf.footer_quarterly') : (frequency === 'yearly' ? t('pdf.footer_yearly') : t('pdf.footer_monthly'))}
                </th>
                ${Array.from({ length: maxPeriods }, (_, i) => {
      const monthTotal = allContribs.filter(c => c.month === i + 1).reduce((sum, c) => sum + c.amount, 0);
      return `<th>${monthTotal > 0 ? monthTotal : ''}</th>`;
    }).join('')}
                <th>${allContribs.reduce((sum, c) => sum + c.amount, 0)}</th>
              </tr>
            </tfoot>
          </table>

          <div class="ledger-container">
            <div class="ledger-title">${t('pdf.ledger_title')}</div>

            ${ops.length > 20 ? (() => {
              const half = Math.ceil(ops.length / 2);
              const col1 = ops.slice(0, half);
              const col2 = ops.slice(half);
              const thead = `<thead><tr>
                <th class="lcol-date">${t('pdf.col_date')}</th>
                <th class="lcol-desc">${t('pdf.col_desc')}</th>
                <th class="lcol-sign">${t('pdf.col_sign')}</th>
                <th class="lcol-amt">${t('pdf.col_amount')}</th>
                <th class="lcol-bal">${t('pdf.col_balance')}</th>
              </tr></thead>`;
              return `<div style="display: flex; gap: 8px;">
                <table class="ledger-table" style="flex: 1;">${thead}<tbody>${renderLedgerRows(col1)}</tbody></table>
                <table class="ledger-table" style="flex: 1;">${thead}<tbody>${renderLedgerRows(col2)}</tbody></table>
              </div>`;
            })() : `
            <table class="ledger-table">
              <thead>
                <tr>
                  <th class="lcol-date">${t('pdf.col_date')}</th>
                  <th class="lcol-desc">${t('pdf.col_desc')}</th>
                  <th class="lcol-sign">${t('pdf.col_sign')}</th>
                  <th class="lcol-amt">${t('pdf.col_amount')}</th>
                  <th class="lcol-bal">${t('pdf.col_balance')}</th>
                </tr>
              </thead>
              <tbody>
                ${renderLedgerRows(ops)}
              </tbody>
            </table>`}

            <div class="legend">
              ${t('pdf.legend')}
            </div>
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const dateStr = new Date().toISOString().split('T')[0];
    const safeResidenceName = (activeResidence?.name || 'SYNDICOM').replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const newUri = `${FileSystem.cacheDirectory}${safeResidenceName}_${dateStr}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: newUri });

    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: t('pdf.share_title'),
      UTI: 'com.adobe.pdf'
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    Alert.alert(t('pdf.error_title'), `${t('pdf.error_message')}\n${msg}`);
  }
}
