import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { MONTHS_SHORT_FR, getPeriodShortLabels } from '../constants/app';
import type { DashboardStats, Apartment, Contribution, Expense, ResidenceWithRole } from '../types';

export async function generateDashboardPDF(
  allContribs: any[],
  allApts: Apartment[],
  allExpenses: Expense[],
  stats: DashboardStats,
  activeResidence: ResidenceWithRole | null
) {
  try {
    const frequency = activeResidence?.contribution_frequency ?? 'monthly';
    const periodShortLabels = getPeriodShortLabels(frequency);
    const maxPeriods = periodShortLabels.length;

    const ops: any[] = [];
    const groupedContribs = new Map<string, any>();
    allContribs.filter(c => c.paid).forEach(c => {
      const dateStr = new Date(c.paid_at || c.created_at).toISOString().split('T')[0];
      const key = `${c.apartment_id}_${dateStr}`;
      const monthLabel = (periodShortLabels[c.period_number - 1] || '').toUpperCase();

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
      let periodUnitLabel = `${periodsCount} mois`;
      if (frequency === 'quarterly') {
        periodUnitLabel = `${periodsCount} trim.`;
      } else if (frequency === 'yearly') {
        periodUnitLabel = `${periodsCount} an.`;
      }

      ops.push({
        date: group.date,
        created_at: group.created_at,
        desc: `Cotisation App. ${aptNumber} (${periodUnitLabel} ${group.year})`,
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

    const renderLedgerItems = (list: any[]) => {
      if (list.length === 0) return '<div style="text-align: center; padding: 10px;">-</div>';
      return list.map(op => {
        const color = op.sign === '+' ? '#388E3C' : '#D32F2F';
        return `
        <div class="ledger-item" style="color: ${color};">
          <div class="col-date">${new Date(op.date).toLocaleDateString('fr-FR')}</div>
          <div class="col-desc">${op.desc}</div>
          <div class="col-sign">${op.sign}</div>
          <div class="col-amt">${op.amount}</div>
          <div class="col-bal">${op.balance}</div>
        </div>
        `;
      }).join('');
    };

    const totalExp = stats.totalExpenses ?? 0;
    const currentBal = stats.balance ?? 0;
    const totalContribs = currentBal + totalExp;

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #0D1B2A; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
            
            .summary-cards { display: flex; gap: 15px; margin-bottom: 25px; }
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
            
            .ledger-container { margin-top: 30px; }
            .ledger-title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px; color: #0D1B2A; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
            .legend { font-size: 10px; margin-top: 15px; color: #64748B; font-style: italic; text-align: center; }

            /* Styles pour le journal en colonnes */
            .ledger-list { column-count: 1; }
            .ledger-list.two-cols { column-count: 2; column-gap: 20px; column-fill: auto; }
            .ledger-item {
              display: flex;
              border-bottom: 1px solid #E2E8F0;
              padding: 4px 0;
              break-inside: avoid;
              page-break-inside: avoid;
              font-size: 9px;
            }
            .col-date { flex: 1.5; text-align: center; border-right: 1px solid #F1F5F9; padding-right: 2px; }
            .col-desc { flex: 3; text-align: left; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 4px; }
            .col-sign { flex: 0.5; text-align: center; font-weight: bold; }
            .col-amt { flex: 1.2; text-align: center; font-weight: bold; }
            .col-bal { flex: 1.5; text-align: center; }
            
            .fake-header {
              display: flex;
              background-color: #1B263B;
              color: #FFF;
              font-weight: bold;
              padding: 6px 0;
              font-size: 9px;
            }
            .fake-header > div { border-right: 1px solid rgba(255,255,255,0.2); }
            .fake-header > div:last-child { border-right: none; }
          </style>
        </head>
        <body>
          <h1>SUIVI DES CONTRIBUTIONS ET DÉPENSES - ${(activeResidence?.name || "SYNDIC DE L'IMMEUBLE").toUpperCase()}</h1>
          
          <div class="summary-cards">
            <div class="card card-green">
              <div class="card-title">Total Contributions</div>
              <div class="card-value">${totalContribs.toLocaleString('fr-MA')} DH</div>
            </div>
            <div class="card card-danger">
              <div class="card-title">Total Dépenses</div>
              <div class="card-value">${totalExp.toLocaleString('fr-MA')} DH</div>
            </div>
            <div class="card card-navy">
              <div class="card-title">Reste à la Caisse</div>
              <div class="card-value">${currentBal.toLocaleString('fr-MA')} DH</div>
            </div>
          </div>

          <table class="grid-table">
            <thead>
              <tr>
                <th>APPARTEMENT</th>
                ${periodShortLabels.map(label => `<th>${label.toUpperCase()}</th>`).join('')}
                <th>TOTAL ANNUEL</th>
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
                <th style="text-align: left;">
                  ${frequency === 'quarterly' ? 'TOTAL PAR TRIM.' : (frequency === 'yearly' ? 'TOTAL ANNUEL' : 'TOTAL PAR MOIS')}
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
            <div class="ledger-title">Journal Chronologique des Opérations</div>
            
            <div style="display: flex; gap: 20px; margin-bottom: 5px;">
              <div class="fake-header" style="flex: 1;">
                <div class="col-date">DATE</div>
                <div class="col-desc" style="padding-left: 4px;">DESCRIPTION</div>
                <div class="col-sign">MVT</div>
                <div class="col-amt">MONTANT</div>
                <div class="col-bal">SOLDE</div>
              </div>
              ${ops.length > 20 ? `
              <div class="fake-header" style="flex: 1;">
                <div class="col-date">DATE</div>
                <div class="col-desc" style="padding-left: 4px;">DESCRIPTION</div>
                <div class="col-sign">MVT</div>
                <div class="col-amt">MONTANT</div>
                <div class="col-bal">SOLDE</div>
              </div>
              ` : ''}
            </div>

            <div class="ledger-list ${ops.length > 20 ? 'two-cols' : ''}">
              ${renderLedgerItems(ops)}
            </div>
          </div>

          <div class="legend">
            + = CRÉDIT (AUGMENTE LE SOLDE) | - = DÉBIT (DIMINUE LE SOLDE)
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
      dialogTitle: 'Partager le rapport complet',
      UTI: 'com.adobe.pdf'
    });

  } catch (error: any) {
    Alert.alert('Erreur', 'Impossible de générer le PDF');
  }
}
