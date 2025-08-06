// 定数定義
const CACHE_NAME = 'kakeibo-app-cache-v2';
const DB_NAME = 'kakeiboDB';
const DB_VERSION = 1;
const STORE_NAMES = {
    ENTRIES: 'entries',
    RECURRING_ENTRIES: 'recurringEntries',
    BUDGETS: 'budgets'
};
const CATEGORY_OPTIONS = {
  "支出": [
    "食費", "日用品", "住居", "光熱費", "通信費", "保険", "医療費",
    "被服・美容", "交通", "教育・書籍", "娯楽・交際", "サブスク",
    "税金・年金", "その他"
  ],
  "収入": [
    "給与", "副業", "お小遣い", "配当・投資", "賞与", "その他"
  ]
};

// DOM要素の取得
const form = document.getElementById("expense-form");
const historyList = document.getElementById("history");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const amountInput = document.getElementById("amount");
const noteInput = document.getElementById("note");
const tagsInput = document.getElementById("tags");
const currentMonthDisplay = document.getElementById("currentMonthDisplay");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const totalIncomeSpan = document.getElementById("totalIncome");
const totalExpenseSpan = document.getElementById("totalExpense");
const balanceSpan = document.getElementById("balance");
const pieChartTab = document.getElementById("pieChartTab");
const monthlyBarChartTab = document.getElementById("monthlyBarChartTab");
const yearlyBarChartTab = document.getElementById("yearlyBarChartTab");
const myChartCanvas = document.getElementById("myChart");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const importCsvBtn = document.getElementById("importCsvBtn");
const monthPicker = document.getElementById("monthPicker");
const recurringTypeSelect = document.getElementById("recurringType");
const recurringCategorySelect = document.getElementById("recurringCategory");
const recurringAmountInput = document.getElementById("recurringAmount");
const recurringNoteInput = document.getElementById("recurringNote");
const recurringDayInput = document.getElementById("recurringDay");
const addRecurringEntryBtn = document.getElementById("addRecurringEntryBtn");
const recurringEntryList = document.getElementById("recurringEntryList");
const addMonthlyRecurringEntriesBtn = document.getElementById("addMonthlyRecurringEntriesBtn");
const budgetCategorySelect = document.getElementById("budgetCategorySelect");
const budgetAmountInput = document.getElementById("budgetAmountInput");
const setBudgetBtn = document.getElementById("setBudgetBtn");
const budgetList = document.getElementById("budgetList");
const budgetStatusDiv = document.getElementById("budgetStatus");
const noBudgetSetMessage = document.getElementById("noBudgetSetMessage");
const filterKeywordInput = document.getElementById("filterKeyword");
const filterTypeSelect = document.getElementById("filterType");
const filterCategorySelect = document.getElementById("filterCategory");
const filterAmountMinInput = document.getElementById("filterAmountMin");
const filterAmountMaxInput = document.getElementById("filterAmountMax");
const searchBtn = document.getElementById("searchBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const memoSuggestionsDatalist = document.getElementById("memo-suggestions");
const dateInput = document.getElementById("date");

// 新しいDOM要素
const submitBtn = document.querySelector("#expense-form button[type='submit']");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// グローバル変数
let customCategories = new Set();
let pastNotes = new Set();
let currentMonth = new Date();
let myChartInstance;
let db;
let allEntries = [];
let editingEntryId = null; // 編集中の項目IDを保持する変数

// --- IndexedDB関連関数 ---
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAMES.ENTRIES)) {
                const entriesStore = db.createObjectStore(STORE_NAMES.ENTRIES, { keyPath: 'id', autoIncrement: true });
                entriesStore.createIndex('date', 'date', { unique: false });
                entriesStore.createIndex('type', 'type', { unique: false });
                entriesStore.createIndex('category', 'category', { unique: false });
                entriesStore.createIndex('note', 'note', { unique: false });
                entriesStore.createIndex('tags', 'tags', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.RECURRING_ENTRIES)) {
                const recurringStore = db.createObjectStore(STORE_NAMES.RECURRING_ENTRIES, { keyPath: 'id', autoIncrement: true });
                recurringStore.createIndex('type', 'type', { unique: false });
                recurringStore.createIndex('category', 'category', { unique: false });
                recurringStore.createIndex('day', 'day', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.BUDGETS)) {
                db.createObjectStore(STORE_NAMES.BUDGETS, { keyPath: 'category' });
            }
            console.log('IndexedDB upgraded or created successfully.');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function saveData(storeName, data) {
    if (!db) await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.put(data);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error(`Error saving data to IndexedDB (${storeName}):`, event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function loadAllDataFromStore(storeName) {
    if (!db) await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error(`Error loading data from IndexedDB (${storeName}):`, event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function deleteDataFromStore(storeName, id) {
    if (!db) await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`Data deleted from IndexedDB (${storeName}):`, id);
            resolve();
        };

        request.onerror = (event) => {
            console.error(`Error deleting data from IndexedDB (${storeName}):`, event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

// --- メインアプリロジック ---
document.getElementById("date").valueAsDate = new Date();
typeSelect.addEventListener("change", updateCategoryOptions);
recurringTypeSelect.addEventListener("change", updateRecurringCategoryOptions);
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    type: typeSelect.value,
    date: dateInput.value,
    category: categorySelect.value,
    amount: parseInt(amountInput.value, 10),
    note: noteInput.value,
    tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
  };

  if (!data.type || !data.date || !data.category || isNaN(data.amount) || data.amount <= 0) {
    alert("種別、日付、カテゴリ、金額は必須入力です。金額は正の数値を入力してください。");
    return;
  }
  
  if (editingEntryId !== null) {
      // 編集モード
      data.id = editingEntryId;
      await saveData(STORE_NAMES.ENTRIES, data);
      alert("履歴が更新されました。");
      editingEntryId = null;
  } else {
      // 新規追加モード
      await saveData(STORE_NAMES.ENTRIES, data);
      alert("履歴が追加されました。");
  }

  // フォームをリセット
  form.reset();
  dateInput.valueAsDate = new Date();
  submitBtn.textContent = '追加';
  cancelEditBtn.style.display = 'none';

  await loadAllDataForSuggestions();
  await loadAndDisplayData();
});

// キャンセルボタン
cancelEditBtn.addEventListener('click', (e) => {
  e.preventDefault();
  editingEntryId = null;
  form.reset();
  dateInput.valueAsDate = new Date();
  submitBtn.textContent = '追加';
  cancelEditBtn.style.display = 'none';
  updateCategoryOptions();
});


function updateCategoryOptions() {
  const type = typeSelect.value;
  categorySelect.innerHTML = '<option value="">選択してください</option>';
  if (CATEGORY_OPTIONS[type]) {
    CATEGORY_OPTIONS[type].forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  } else {
    categorySelect.innerHTML = '<option value="">まず種別を選んでください</option>';
  }
  Array.from(customCategories).sort().forEach(cat => {
    if (!CATEGORY_OPTIONS["支出"].includes(cat) && !CATEGORY_OPTIONS["収入"].includes(cat)) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${cat} (その他)`;
      categorySelect.appendChild(opt);
    }
  });
}

function updateRecurringCategoryOptions() {
  const type = recurringTypeSelect.value;
  recurringCategorySelect.innerHTML = '<option value="">選択してください</option>';
  if (CATEGORY_OPTIONS[type]) {
    CATEGORY_OPTIONS[type].forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      recurringCategorySelect.appendChild(opt);
    });
  }
  Array.from(customCategories).sort().forEach(cat => {
    if (type === '支出' && !CATEGORY_OPTIONS["支出"].includes(cat)) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${cat} (その他)`;
      recurringCategorySelect.appendChild(opt);
    } else if (type === '収入' && !CATEGORY_OPTIONS["収入"].includes(cat)) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${cat} (その他)`;
      recurringCategorySelect.appendChild(opt);
    }
  });
}

function updateMemoSuggestions() {
  memoSuggestionsDatalist.innerHTML = '';
  pastNotes.forEach(note => {
    const option = document.createElement('option');
    option.value = note;
    memoSuggestionsDatalist.appendChild(option);
  });
}

async function loadAllDataForSuggestions() {
  allEntries = await loadAllDataFromStore(STORE_NAMES.ENTRIES) || [];
  customCategories.clear();
  pastNotes.clear();
  allEntries.forEach(item => {
    if (item.category === "その他" && item.note) {
      customCategories.add(item.note);
    } else if (!CATEGORY_OPTIONS["支出"].includes(item.category) && !CATEGORY_OPTIONS["収入"].includes(item.category)) {
      customCategories.add(item.category);
    }
    if (item.note) {
      pastNotes.add(item.note);
    }
  });
  updateCategoryOptions();
  updateRecurringCategoryOptions();
  updateMemoSuggestions();
}

async function loadAndDisplayData() {
  allEntries = await loadAllDataFromStore(STORE_NAMES.ENTRIES) || [];
  historyList.innerHTML = "";
  const filterKeyword = filterKeywordInput.value.toLowerCase();
  const filterType = filterTypeSelect.value;
  const filterCategory = filterCategorySelect.value;
  const filterAmountMin = parseInt(filterAmountMinInput.value, 10);
  const filterAmountMax = parseInt(filterAmountMaxInput.value, 10);
  const filteredData = allEntries.filter(item => {
    const keywordMatch = !filterKeyword || (item.note && item.note.toLowerCase().includes(filterKeyword)) || (item.tags && item.tags.some(tag => tag.toLowerCase().includes(filterKeyword)));
    const typeMatch = !filterType || item.type === filterType;
    const categoryMatch = !filterCategory || item.category === filterCategory;
    const amountMatch = (isNaN(filterAmountMin) || item.amount >= filterAmountMin) && (isNaN(filterAmountMax) || item.amount <= filterAmountMax);
    return keywordMatch && typeMatch && categoryMatch && amountMatch;
  });
  const currentMonthYear = currentMonth.getFullYear();
  const currentMonthMonth = currentMonth.getMonth();
  const monthlyData = filteredData.filter(item => {
    const [year, month, day] = item.date.split('-').map(Number);
    const itemParsedDate = new Date(year, month - 1, day);
    return itemParsedDate.getFullYear() === currentMonthYear && itemParsedDate.getMonth() === currentMonthMonth;
  });
  monthlyData.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() === dateB.getTime()) {
      if (a.type === "支出" && b.type === "収入") return -1;
      if (a.type === "収入" && b.type === "支出") return 1;
      return b.amount - a.amount;
    }
    return dateB - dateA;
  });
  const groupedData = {};
  monthlyData.forEach(item => {
    if (!groupedData[item.date]) {
      groupedData[item.date] = [];
    }
    groupedData[item.date].push(item);
  });
  if (Object.keys(groupedData).length === 0) {
    historyList.innerHTML = '<p style="text-align: center; color: #777; margin-top: 2em;">この月には履歴がありません。</p>';
    if (filterKeyword || filterType || filterCategory || !isNaN(filterAmountMin) || !isNaN(filterAmountMax)) {
      historyList.innerHTML += '<p style="text-align: center; color: #777; font-size: 0.9em;">（検索条件に合う項目が見つかりませんでした）</p>';
    }
  } else {
    for (const date in groupedData) {
      if (groupedData.hasOwnProperty(date)) {
        const dailyItems = groupedData[date];
        const dateHeader = document.createElement("div");
        dateHeader.className = "date-header";
        const [year, month, day] = date.split('-');
        const dayOfWeek = new Date(year, month - 1, day).toLocaleDateString('ja-JP', { weekday: 'short' });
        const formattedDate = `${year}年${parseInt(month)}月${parseInt(day)}日 (${dayOfWeek})`;
        dateHeader.textContent = formattedDate;
        historyList.appendChild(dateHeader);
        const ul = document.createElement("ul");
        ul.className = "daily-list";
        dailyItems.forEach((item) => {
          const li = document.createElement("li");
          li.className = item.type === "支出" ? "expense-item" : "income-item";
          li.dataset.id = item.id;
          li.innerHTML = `
            <span class="item-details">
              <span class="item-type">${item.type}</span>
              <span class="item-category">${item.category}</span>
              <span class="item-amount">¥${item.amount.toLocaleString()}</span>
              ${item.note ? `<span class="item-note">${item.note}</span>` : ''}
              ${item.tags && item.tags.length > 0 ? `<span class="item-tags">${item.tags.map(tag => `#${tag}`).join(' ')}</span>` : ''}
            </span>
            <button class="delete-btn" data-id="${item.id}" data-store="${STORE_NAMES.ENTRIES}">削除</button>
          `;
          // 項目全体をクリック可能にする
          li.addEventListener('click', (e) => {
              if (e.target.classList.contains('delete-btn')) {
                  e.stopPropagation();
                  return;
              }
              editEntry(item);
          });
          ul.appendChild(li);
        });
        historyList.appendChild(ul);
      }
    }
  }
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation(); // liへのイベント伝播を停止
      const idToDelete = parseInt(e.target.dataset.id, 10);
      const storeName = e.target.dataset.store;
      if (confirm("この項目を削除してもよろしいですか？")) {
        await deleteDataFromStore(storeName, idToDelete);
        await loadAndDisplayData();
        await loadAllDataForSuggestions();
      }
    });
  });
  updateMonthDisplay();
  updateSummary(monthlyData);
  await updateCharts();
  updateBudgetStatus(monthlyData);
}

function editEntry(entry) {
    editingEntryId = entry.id;
    typeSelect.value = entry.type;
    updateCategoryOptions();
    categorySelect.value = entry.category;
    dateInput.value = entry.date;
    amountInput.value = entry.amount;
    noteInput.value = entry.note;
    tagsInput.value = entry.tags.join(', ');

    submitBtn.textContent = '更新';
    cancelEditBtn.style.display = 'inline-block';
    document.getElementById("top").scrollIntoView({ behavior: 'smooth' });
}


function updateMonthDisplay() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  currentMonthDisplay.textContent = `${year}年${month}月`;
  monthPicker.value = `${year}-${month.toString().padStart(2, '0')}`;
}

currentMonthDisplay.addEventListener('click', () => {
  monthPicker.click();
});

monthPicker.addEventListener('change', async () => {
  const [year, month] = monthPicker.value.split('-').map(Number);
  currentMonth.setFullYear(year, month - 1, 1);
  await loadAndDisplayData();
});

prevMonthBtn.addEventListener("click", async () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  await loadAndDisplayData();
});

nextMonthBtn.addEventListener("click", async () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  await loadAndDisplayData();
});

function updateSummary(data) {
  let totalIncome = 0;
  let totalExpense = 0;
  data.forEach(item => {
    if (item.type === "収入") {
      totalIncome += item.amount;
    } else if (item.type === "支出") {
      totalExpense += item.amount;
    }
  });
  totalIncomeSpan.textContent = `¥${totalIncome.toLocaleString()}`;
  totalExpenseSpan.textContent = `¥${totalExpense.toLocaleString()}`;
  balanceSpan.textContent = `¥${(totalIncome - totalExpense).toLocaleString()}`;
}

// --- グラフ関連 ---
async function updateCharts() {
  if (myChartInstance) {
    myChartInstance.destroy();
  }
  const activeTab = document.querySelector('.chart-tabs button.active').id;
  const monthlyData = allEntries.filter(item => {
    const [year, month] = item.date.split('-').map(Number);
    return year === currentMonth.getFullYear() && (month - 1) === currentMonth.getMonth();
  });

  if (activeTab === 'pieChartTab') {
    renderPieChart(monthlyData);
  } else if (activeTab === 'monthlyBarChartTab') {
    renderMonthlyBarChart(allEntries);
  } else if (activeTab === 'yearlyBarChartTab') {
    renderYearlyBarChart(allEntries);
  }
}

function renderPieChart(monthlyData) {
  const expenseByCategory = {};
  monthlyData.filter(item => item.type === "支出").forEach(item => {
    const actualCategory = (item.category === "その他" && item.note && customCategories.has(item.note)) ? item.note : item.category;
    expenseByCategory[actualCategory] = (expenseByCategory[actualCategory] || 0) + item.amount;
  });
  const labels = Object.keys(expenseByCategory);
  const dataValues = Object.values(expenseByCategory);
  const backgroundColors = generateColors(labels.length);
  myChartInstance = new Chart(myChartCanvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: '月間支出カテゴリ別内訳'
        }
      }
    }
  });
}

function renderMonthlyBarChart(allEntries) {
    const monthlyTotals = {};
    allEntries.forEach(item => {
        const month = item.date.substring(0, 7);
        if (!monthlyTotals[month]) {
            monthlyTotals[month] = { income: 0, expense: 0 };
        }
        if (item.type === "収入") {
            monthlyTotals[month].income += item.amount;
        } else {
            monthlyTotals[month].expense += item.amount;
        }
    });

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const incomeData = sortedMonths.map(month => monthlyTotals[month].income);
    const expenseData = sortedMonths.map(month => monthlyTotals[month].expense);

    myChartInstance = new Chart(myChartCanvas, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: '収入',
                    data: incomeData,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                },
                {
                    label: '支出',
                    data: expenseData,
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '月別収支推移'
                }
            },
            scales: {
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: '月'
                    }
                },
                y: {
                    stacked: false,
                    title: {
                        display: true,
                        text: '金額 (円)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderYearlyBarChart(allEntries) {
    const yearlyTotals = {};
    allEntries.forEach(item => {
        const year = item.date.substring(0, 4);
        if (!yearlyTotals[year]) {
            yearlyTotals[year] = { income: 0, expense: 0 };
        }
        if (item.type === "収入") {
            yearlyTotals[year].income += item.amount;
        } else {
            yearlyTotals[year].expense += item.amount;
        }
    });

    const sortedYears = Object.keys(yearlyTotals).sort();
    const incomeData = sortedYears.map(year => yearlyTotals[year].income);
    const expenseData = sortedYears.map(year => yearlyTotals[year].expense);

    myChartInstance = new Chart(myChartCanvas, {
        type: 'bar',
        data: {
            labels: sortedYears,
            datasets: [
                {
                    label: '収入',
                    data: incomeData,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                },
                {
                    label: '支出',
                    data: expenseData,
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '年別収支推移'
                }
            },
            scales: {
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: '年'
                    }
                },
                y: {
                    stacked: false,
                    title: {
                        display: true,
                        text: '金額 (円)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function generateColors(num) {
    const colors = [];
    const baseColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#E7E9ED', '#A0A0A0', '#4BC0C0', '#C9CBCE'
    ];
    for (let i = 0; i < num; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

document.querySelectorAll('.chart-tabs button').forEach(button => {
    button.addEventListener('click', async (e) => {
        document.querySelector('.chart-tabs button.active').classList.remove('active');
        e.target.classList.add('active');
        await updateCharts();
    });
});


// 予算設定機能のロジック
async function setupBudgetSection() {
    const categories = Object.values(CATEGORY_OPTIONS.支出).concat(Array.from(customCategories)).sort();
    budgetCategorySelect.innerHTML = '<option value="">カテゴリを選択</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        budgetCategorySelect.appendChild(opt);
    });

    const budgets = await loadAllDataFromStore(STORE_NAMES.BUDGETS);
    budgetList.innerHTML = '';
    if (budgets.length > 0) {
        budgets.forEach(budget => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${budget.category}: ¥${budget.amount.toLocaleString()}</span>
                <button class="delete-btn" data-id="${budget.category}" data-store="${STORE_NAMES.BUDGETS}">削除</button>
            `;
            budgetList.appendChild(li);
        });
    } else {
        budgetList.innerHTML = '<p>予算はまだ設定されていません。</p>';
    }
}

setBudgetBtn.addEventListener('click', async () => {
    const category = budgetCategorySelect.value;
    const amount = parseInt(budgetAmountInput.value, 10);
    if (category && !isNaN(amount) && amount >= 0) {
        await saveData(STORE_NAMES.BUDGETS, { category, amount });
        alert(`カテゴリ「${category}」に予算¥${amount.toLocaleString()}を設定しました。`);
        await setupBudgetSection();
        await updateBudgetStatus();
        budgetAmountInput.value = '';
        budgetCategorySelect.value = '';
    } else {
        alert("カテゴリと予算額を正しく入力してください。");
    }
});

async function updateBudgetStatus(monthlyData) {
    const budgets = await loadAllDataFromStore(STORE_NAMES.BUDGETS);
    if (budgets.length === 0) {
        budgetStatusDiv.style.display = 'block';
        noBudgetSetMessage.style.display = 'block';
        return;
    }

    noBudgetSetMessage.style.display = 'none';
    const totalExpenses = {};
    monthlyData.filter(item => item.type === '支出').forEach(item => {
        const actualCategory = (item.category === "その他" && item.note && customCategories.has(item.note)) ? item.note : item.category;
        totalExpenses[actualCategory] = (totalExpenses[actualCategory] || 0) + item.amount;
    });

    let statusHtml = '<h3>今月の予算実績</h3><ul id="budgetStatusList">';
    budgets.forEach(budget => {
        const spent = totalExpenses[budget.category] || 0;
        const remaining = budget.amount - spent;
        const isWarning = remaining < 0;
        statusHtml += `
            <li class="budget-item ${isWarning ? 'warning' : ''}">
                <span>${budget.category}</span>
                <span>
                    ¥${spent.toLocaleString()} / ¥${budget.amount.toLocaleString()}
                    ${isWarning ? '（超過）' : ''}
                </span>
            </li>
        `;
    });
    statusHtml += '</ul>';
    budgetStatusDiv.innerHTML = statusHtml;
}


// 定期的な記録機能のロジック
async function setupRecurringEntriesSection() {
    const recurringEntries = await loadAllDataFromStore(STORE_NAMES.RECURRING_ENTRIES);
    recurringEntryList.innerHTML = '';
    if (recurringEntries.length > 0) {
        recurringEntries.forEach(entry => {
            const li = document.createElement('li');
            li.className = entry.type === "支出" ? "expense-item" : "income-item";
            li.innerHTML = `
                <span>${entry.day}日: ${entry.category} - ¥${entry.amount.toLocaleString()}</span>
                <button class="delete-recurring-btn" data-id="${entry.id}">削除</button>
            `;
            recurringEntryList.appendChild(li);
        });
    } else {
        recurringEntryList.innerHTML = '<p>定期的な記録はまだ登録されていません。</p>';
    }
}

addRecurringEntryBtn.addEventListener('click', async () => {
    const type = recurringTypeSelect.value;
    const category = recurringCategorySelect.value;
    const amount = parseInt(recurringAmountInput.value, 10);
    const note = recurringNoteInput.value;
    const day = parseInt(recurringDayInput.value, 10);

    if (type && category && !isNaN(amount) && amount >= 0 && !isNaN(day) && day >= 1 && day <= 31) {
        await saveData(STORE_NAMES.RECURRING_ENTRIES, { type, category, amount, note, day });
        alert("定期的な記録を登録しました。");
        await setupRecurringEntriesSection();
        recurringTypeSelect.value = '';
        recurringCategorySelect.value = '';
        recurringAmountInput.value = '';
        recurringNoteInput.value = '';
        recurringDayInput.value = '';
    } else {
        alert("すべての項目を正しく入力してください。");
    }
});

recurringEntryList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-recurring-btn')) {
        const idToDelete = parseInt(e.target.dataset.id, 10);
        if (confirm("この定期的な記録を削除してもよろしいですか？")) {
            await deleteDataFromStore(STORE_NAMES.RECURRING_ENTRIES, idToDelete);
            await setupRecurringEntriesSection();
        }
    }
});

addMonthlyRecurringEntriesBtn.addEventListener('click', async () => {
    const today = new Date();
    const currentMonthEntries = await loadAllDataFromStore(STORE_NAMES.ENTRIES).then(entries =>
        entries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate.getFullYear() === today.getFullYear() && entryDate.getMonth() === today.getMonth();
        })
    );
    const addedDates = new Set(currentMonthEntries.map(entry => entry.date));
    const recurringEntries = await loadAllDataFromStore(STORE_NAMES.RECURRING_ENTRIES);
    let addedCount = 0;

    for (const entry of recurringEntries) {
        const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${entry.day.toString().padStart(2, '0')}`;
        if (!addedDates.has(dateString)) {
            const data = {
                type: entry.type,
                date: dateString,
                category: entry.category,
                amount: entry.amount,
                note: entry.note || `定期的な記録: ${entry.category}`,
                tags: ['定期']
            };
            await saveData(STORE_NAMES.ENTRIES, data);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        alert(`${addedCount}件の定期的な記録を今月に追加しました。`);
        await loadAndDisplayData();
    } else {
        alert("今月は追加する定期的な記録はありませんでした。");
    }
});

// CSVインポート/エクスポート機能
exportCsvBtn.addEventListener('click', async () => {
    const allEntries = await loadAllDataFromStore(STORE_NAMES.ENTRIES) || [];
    if (allEntries.length === 0) {
        alert("エクスポートするデータがありません。");
        return;
    }
    const header = ["id", "type", "date", "category", "amount", "note", "tags"];
    const rows = allEntries.map(item => {
        const tagsString = (item.tags && item.tags.length > 0) ? item.tags.join(',') : '';
        const note = item.note ? `"${item.note.replace(/"/g, '""')}"` : '';
        return [item.id, item.type, item.date, item.category, item.amount, note, tagsString].join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + header.join(',') + "\n" + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kakeibo_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

importCsvBtn.addEventListener('click', () => {
    csvFileInput.click();
});

csvFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const dataToImport = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') continue;
                const values = line.split(',');
                if (values.length >= 6) {
                    const type = values[1].trim();
                    const date = values[2].trim();
                    const category = values[3].trim();
                    const amount = parseInt(values[4].trim(), 10);
                    const note = values[5].trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                    const tags = values[6] ? values[6].split(',').map(tag => tag.trim()) : [];
                    if (type && date && category && !isNaN(amount) && amount >= 0) {
                        dataToImport.push({ type, date, category, amount, note, tags });
                    }
                }
            }

            if (dataToImport.length > 0) {
                if (confirm(`${dataToImport.length}件のデータをインポートしますか？既存のデータは削除されず、追加されます。`)) {
                    for (const item of dataToImport) {
                        await saveData(STORE_NAMES.ENTRIES, item);
                    }
                    alert(`${dataToImport.length}件のデータをインポートしました。`);
                    await loadAllDataForSuggestions();
                    await loadAndDisplayData();
                }
            } else {
                alert("インポートできる有効なデータが見つかりませんでした。");
            }
        };
        reader.readAsText(file);
    }
});


// フッターナビゲーション
document.querySelectorAll('.footer-nav .nav-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            const headerHeight = 60;
            const elementPosition = targetElement.offsetTop;
            window.scrollTo({
                top: elementPosition - headerHeight,
                behavior: 'smooth'
            });
        }
    });
});


// フィルタリング機能
searchBtn.addEventListener('click', async () => {
    await loadAndDisplayData();
});

resetFilterBtn.addEventListener('click', async () => {
    filterKeywordInput.value = '';
    filterTypeSelect.value = '';
    filterCategorySelect.value = '';
    filterAmountMinInput.value = '';
    filterAmountMaxInput.value = '';
    await loadAndDisplayData();
});

filterTypeSelect.addEventListener('change', () => {
    const type = filterTypeSelect.value;
    filterCategorySelect.innerHTML = '<option value="">すべて</option>';
    const categories = type ? CATEGORY_OPTIONS[type].concat(type === '支出' ? Array.from(customCategories) : []) : Object.values(CATEGORY_OPTIONS).flat().concat(Array.from(customCategories));
    categories.sort().forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        filterCategorySelect.appendChild(opt);
    });
});


// アプリの初期化
async function init() {
    await openDB();
    await loadAllDataForSuggestions();
    updateCategoryOptions();
    await loadAndDisplayData();
    await setupBudgetSection();
    await setupRecurringEntriesSection();
    await updateCharts();
    await updateBudgetStatus();
}

window.addEventListener('load', init);
