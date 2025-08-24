const API_KEY = 'd2kqg1pr01qs23a3dh80d2kqg1pr01qs23a3dh8g'; // <-- Replace with your Finnhub API key
const PAGE_SIZE = 5;
let currentPage = 1;
let sortKey = null;
let sortAsc = true;
let allInvestments = [];
let filteredInvestments = [];

// Curated investment list with symbols and details
const investments = [
  { type: 'Stock', symbol: 'AAPL', name: 'Apple Inc.', invested: 5000, riskLevel: 'safe' },
  { type: 'Mutual Fund', symbol: 'VFIAX', name: 'Vanguard 500 Index Fund', invested: 3000, riskLevel: 'safe' },
  { type: 'Stock', symbol: 'TSLA', name: 'Tesla', invested: 4000, riskLevel: 'risky' },
  { type: 'Bond', symbol: null, name: 'US Treasury Bond', invested: 2000, riskLevel: 'safe' }, // No live data
  { type: 'Mutual Fund', symbol: 'FBIOX', name: 'Fidelity Blue Chip', invested: 2500, riskLevel: 'safe' },
  { type: 'Stock', symbol: 'F', name: 'Ford', invested: 1200, riskLevel: 'risky' },
  { type: 'Stock', symbol: 'INTC', name: 'Intel', invested: 1800, riskLevel: 'safe' },
  // add more as needed
];

// Fetch live price for stock symbol
async function fetchPrice(symbol) {
  if (!symbol) return null;
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
    if (!response.ok) throw new Error(`Failed to get data for ${symbol}`);
    const data = await response.json();
    return data.c; // current price
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fetch historical data for price history chart
async function fetchHistory(symbol) {
  if (!symbol) return null;
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 30; // 30 days ago
  try {
    const response = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
    if (!response.ok) throw new Error(`Failed to get history for ${symbol}`);
    const data = await response.json();
    if (data.s !== 'ok') return null;
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Update allInvestments with price and current value, calculate shares held approx
async function fetchAllPrices() {
  const updated = [];
  for (const inv of investments) {
    const price = await fetchPrice(inv.symbol);
    if (price === null) {
      updated.push({ ...inv, pricePerShare: 0, current: inv.invested });
      continue;
    }
    const shares = inv.invested / price;
    updated.push({ ...inv, pricePerShare: price, current: shares * price });
  }
  return updated;
}

function calculateSummary(data) {
  const totalInvested = data.reduce((sum, i) => sum + i.invested, 0);
  const totalCurrent = data.reduce((sum, i) => sum + i.current, 0);
  const totalGain = totalCurrent - totalInvested;
  const returnPercent = totalInvested === 0 ? 0 : ((totalGain / totalInvested) * 100).toFixed(2);
  return { totalInvested, totalCurrent, totalGain, returnPercent };
}

function displaySummary(summary) {
  document.getElementById('totalValue').textContent = `$${summary.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const gainsElem = document.getElementById('totalGains');
  gainsElem.textContent = (summary.totalGain >= 0 ? '+' : '') + `$${summary.totalGain.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  gainsElem.className = summary.totalGain >= 0 ? 'gain' : 'loss';
  document.getElementById('returnPercent').textContent = `${summary.returnPercent}%`;
}

function renderPagination(totalItems) {
  const container = document.getElementById('paginationControls');
  container.innerHTML = '';
  const pageCount = Math.ceil(totalItems / PAGE_SIZE);
  for (let i = 1; i <= pageCount; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.classList.toggle('active', i === currentPage);
    btn.addEventListener('click', () => {
      currentPage = i;
      renderTablePage();
    });
    container.appendChild(btn);
  }
}

function renderTablePage() {
  const tbody = document.getElementById('investmentTableBody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredInvestments.slice(start, start + PAGE_SIZE);

  for (const inv of pageData) {
    const gainLoss = inv.current - inv.invested;
    const riskClass = inv.riskLevel === 'risky' ? 'risky' : 'safe';
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-pressed', 'false');
    tr.innerHTML = `
      <td>${inv.type}</td>
      <td><span class="risk-dot ${riskClass}"></span>${inv.name}</td>
      <td>$${inv.pricePerShare ? inv.pricePerShare.toFixed(2) : 'N/A'}</td>
      <td>$${inv.invested.toLocaleString()}</td>
      <td>$${inv.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
      <td class="${gainLoss >= 0 ? 'gain' : 'loss'}">${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
    `;
    tr.addEventListener('click', () => openModal(inv));
    tbody.appendChild(tr);
  }
  renderPagination(filteredInvestments.length);
}

// Sort investments by key
function sortByKey(key) {
  sortAsc = sortKey === key ? !sortAsc : true;
  sortKey = key;

  filteredInvestments.sort((a, b) => {
    let valA;
    if (key === 'gainLoss') {
      valA = a.current - a.invested;
      const valB = b.current - b.invested;
      return sortAsc ? valA - valB : valB - valA;
    }
    valA = a[key] || 0;
    const valB = b[key] || 0;
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      return sortAsc ? valA.localeCompare(valB.toLowerCase()) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  currentPage = 1;
  renderTablePage();
}

// Filter parser
function advancedFilter(query, data) {
  query = query.trim().toLowerCase();
  if (!query) return data;

  // Filter by type and risk keywords
  const types = ['stock', 'mutual fund', 'bond'];
  const risks = ['risky', 'safe'];
  let filtered = data;

  types.forEach(type => {
    if (query.includes(type)) {
      filtered = filtered.filter(i => i.type.toLowerCase() === type);
      query = query.replace(type, '');
    }
  });

  risks.forEach(r => {
    if (query.includes(r)) {
      filtered = filtered.filter(i => i.riskLevel === r);
      query = query.replace(r, '');
    }
  });

  // Numeric conditions (+developers can extend this)
  const conditionRe = /(gains|current|invested|price)\s*(>|<|>=|<=|=)\s*([\d\.]+)/g;
  let match;
  while ((match = conditionRe.exec(query)) !== null) {
    const [, field, op, numStr] = match;
    const value = parseFloat(numStr);

    filtered = filtered.filter(inv => {
      let compVal;
      switch (field) {
        case 'gains':
          compVal = inv.current - inv.invested;
          break;
        case 'current':
          compVal = inv.current;
          break;
        case 'invested':
          compVal = inv.invested;
          break;
        case 'price':
          compVal = inv.pricePerShare || 0;
          break;
        default:
          compVal = 0;
      }
      switch (op) {
        case '>':
          return compVal > value;
        case '<':
          return compVal < value;
        case '>=':
          return compVal >= value;
        case '<=':
          return compVal <= value;
        case '=':
          return compVal === value;
        default:
          return true;
      }
    });
  }
  return filtered;
}

// Filter input handler
document.getElementById('searchInput').addEventListener('input', e => {
  filteredInvestments = advancedFilter(e.target.value, allInvestments);
  currentPage = 1;
  renderTablePage();
  drawChart(filteredInvestments);
  displaySummary(calculateSummary(filteredInvestments));
});

// Chart setup
let allocationChart;
function drawChart(data) {
  const sums = {};
  data.forEach(i => (sums[i.type] = (sums[i.type] || 0) + i.current));
  const labels = Object.keys(sums);
  const values = Object.values(sums);

  if (allocationChart) {
    allocationChart.data.labels = labels;
    allocationChart.data.datasets[0].data = values;
    allocationChart.update();
  } else {
    const ctx = document.getElementById('allocationChart').getContext('2d');
    allocationChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            label: 'Allocation',
            data: values,
            backgroundColor: ['#0a3d62', '#3c6382', '#82ccdd', '#60a3bc', '#0fb9b1'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }
}

// Investment suggestions - basic static list for demo, can improve
function showSuggestions() {
  const container = document.getElementById('suggestionsContainer');
  container.innerHTML = '';
  const suggestions = [
    { name: 'Amazon (AMZN)', type: 'Stock', reason: 'Strong growth potential' },
    { name: 'S&P 500 ETF (SPY)', type: 'Mutual Fund', reason: 'Broad market exposure' },
    { name: 'Government Bond Fund', type: 'Bond', reason: 'Low risk and steady returns' },
  ];
  suggestions.forEach(s => {
    const div = document.createElement('div');
    div.classList.add('suggestion-card');
    div.textContent = `${s.name} (${s.type}): ${s.reason}`;
    container.appendChild(div);
  });
}

// Modal logic
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const closeModal = document.getElementById('modalClose');
let priceHistoryChart;

async function openModal(inv) {
  modalTitle.textContent = inv.name;
  modalDesc.textContent = `Type: ${inv.type} | Invested: $${inv.invested.toLocaleString()} | Current Value: $${inv.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const history = await fetchHistory(inv.symbol);
  if (!history) {
    modalDesc.textContent += ' | No price history available.';
    if (priceHistoryChart) {
      priceHistoryChart.destroy();
      priceHistoryChart = null;
    }
  } else {
    const labels = history.t.map(ts => new Date(ts * 1000).toLocaleDateString());
    if (priceHistoryChart) priceHistoryChart.destroy();
    const ctx = document.getElementById('priceHistoryChart').getContext('2d');
    priceHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Closing Price',
          data: history.c,
          borderColor: '#3949ab',
          backgroundColor: 'rgba(57,73,171,0.1)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Date' } },
          y: { title: { display: true, text: 'Price ($)' } }
        }
      }
    });
  }
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  modalClose.focus();
}

function closeModalFunc() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

closeModal.addEventListener('click', closeModalFunc);
modal.addEventListener('click', e => {
  if (e.target === modal) closeModalFunc();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('show')) {
    closeModalFunc();
  }
});

// Dark/Light mode toggle
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});

// Sorting column headers event
document.querySelectorAll('th[data-key]').forEach(th => {
  th.addEventListener('click', () => sortByKey(th.getAttribute('data-key')));
  th.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sortByKey(th.getAttribute('data-key'));
    }
  });
});

// Initialize dashboard
async function init() {
  allInvestments = await fetchAllPrices();
  filteredInvestments = [...allInvestments];
  displaySummary(calculateSummary(filteredInvestments));
  drawChart(filteredInvestments);
  renderTablePage();
  showSuggestions();
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
}
init();
