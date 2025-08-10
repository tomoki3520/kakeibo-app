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
const myChartCanvas = document.getElementById("myChart");
const budgetList = document.getElementById("budgetList");
const budgetCategorySelect = document.getElementById("budgetCategorySelect");
const budgetAmountInput = document.getElementById("budgetAmountInput");
const setBudgetBtn = document.getElementById("setBudgetBtn");
const budgetStatusDiv = document.getElementById("budgetStatus");
const noBudgetSetMessage = document.getElementById("noBudgetSetMessage");

const recurringTypeSelect = document.getElementById("recurringType");
const recurringCategorySelect = document.getElementById("recurringCategory");
const recurringAmountInput = document.getElementById("recurringAmount");
const recurringNoteInput = document.getElementById("recurringNote");
const recurringDayInput = document.getElementById("recurringDay");
const addRecurringEntryBtn = document.getElementById("addRecurringEntryBtn");
const recurringEntryList = document.getElementById("recurringEntryList");
const addMonthlyRecurringEntriesBtn = document.getElementById("addMonthlyRecurringEntriesBtn");

const filterKeywordInput = document.getElementById("filterKeyword");
const filterTypeSelect = document.getElementById("filterType");
const filterCategorySelect = document.getElementById("filterCategory");
const filterAmountMinInput = document.getElementById("filterAmountMin");
const filterAmountMaxInput = document.getElementById("filterAmountMax");
const searchBtn = document.getElementById("searchBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");

const pieChartTab = document.getElementById("pieChartTab");
const monthlyBarChartTab = document.getElementById("monthlyBarChartTab");
const yearlyBarChartTab = document.getElementById("yearlyBarChartTab");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const importCsvBtn = document.getElementById("importCsvBtn");

const monthPicker = document.getElementById("monthPicker");

const navButtons = document.querySelectorAll('.nav-button');

// グローバル変数
let db;
let currentMonth = new Date();
let myChart;
let allData = [];
let tags = new Set();
let memos = new Set();
let customCategories = new Set();
let editEntryId = null;

// IndexedDB関連
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAMES.ENTRIES)) {
                db.createObjectStore(STORE_NAMES.ENTRIES, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.RECURRING_ENTRIES)) {
                db.createObjectStore(STORE_NAMES.RECURRING_ENTRIES, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.BUDGETS)) {
                db.createObjectStore(STORE_NAMES.BUDGETS, { keyPath: 'category' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function addData(storeName, data) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateData(storeName, data) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteDataFromStore(storeName, key) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function clearStore(storeName) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getAllData(storeName) {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// フォームの入力補助（サジェスト機能）
async function loadAllDataForSuggestions() {
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    tags.clear();
    memos.clear();
    customCategories.clear();

    allEntries.forEach(entry => {
        memos.add(entry.note);
        if (entry.tags) {
            entry.tags.split(',').map(tag => tag.trim()).forEach(tag => tags.add(tag));
        }
        if (entry.category && !CATEGORY_OPTIONS["支出"].includes(entry.category) && !CATEGORY_OPTIONS["収入"].includes(entry.category)) {
            customCategories.add(entry.category);
        }
    });
    updateMemoSuggestions();
    updateCategoryOptions();
    await setupBudgetSection();
}

function updateMemoSuggestions() {
    const memoDatalist = document.getElementById("memo-suggestions");
    memoDatalist.innerHTML = '';
    memos.forEach(memo => {
        const option = document.createElement('option');
        option.value = memo;
        memoDatalist.appendChild(option);
    });
}

// カテゴリオプションの動的更新
function updateCategoryOptions() {
    // 登録フォーム
    const selectedType = typeSelect.value;
    categorySelect.innerHTML = '<option value="">選択してください</option>';
    if (selectedType) {
        CATEGORY_OPTIONS[selectedType].forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            categorySelect.appendChild(opt);
        });
        if (selectedType === "支出") {
            Array.from(customCategories).sort().forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });
        }
    }

    // 予算設定
    budgetCategorySelect.innerHTML = '<option value="">カテゴリを選択</option>';
    const allExpenseCategories = CATEGORY_OPTIONS["支出"].concat(Array.from(customCategories));
    allExpenseCategories.sort().forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        budgetCategorySelect.appendChild(opt);
    });

    // 定期的な記録
    const selectedRecurringType = recurringTypeSelect.value;
    recurringCategorySelect.innerHTML = '<option value="">選択してください</option>';
    if (selectedRecurringType) {
        CATEGORY_OPTIONS[selectedRecurringType].forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            recurringCategorySelect.appendChild(opt);
        });
        if (selectedRecurringType === "支出") {
            Array.from(customCategories).sort().forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                recurringCategorySelect.appendChild(opt);
            });
        }
    }
}
typeSelect.addEventListener('change', updateCategoryOptions);
recurringTypeSelect.addEventListener('change', updateCategoryOptions);


// メインのデータ表示機能
async function loadAndDisplayData() {
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    allData = allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // フィルターの適用
    const filteredData = allData.filter(entry => {
        const entryDate = new Date(entry.date);
        const filterMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const entryMonth = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);

        // 月フィルタリング
        if (entryMonth.getTime() !== filterMonth.getTime()) {
            return false;
        }

        // 検索・絞り込みフィルタリング
        const keyword = filterKeywordInput.value.toLowerCase();
        if (keyword && !((entry.note && entry.note.toLowerCase().includes(keyword)) || (entry.tags && entry.tags.toLowerCase().includes(keyword)))) {
            return false;
        }

        const type = filterTypeSelect.value;
        if (type && entry.type !== type) {
            return false;
        }

        const category = filterCategorySelect.value;
        if (category && entry.category !== category) {
            return false;
        }

        const minAmount = parseFloat(filterAmountMinInput.value);
        if (!isNaN(minAmount) && entry.amount < minAmount) {
            return false;
        }

        const maxAmount = parseFloat(filterAmountMaxInput.value);
        if (!isNaN(maxAmount) && entry.amount > maxAmount) {
            return false;
        }

        return true;
    });

    displayHistory(filteredData);
    updateSummary(filteredData);
    updateChart(filteredData);
}

// 履歴の表示
function displayHistory(entries) {
    historyList.innerHTML = '';
    if (entries.length === 0) {
        historyList.innerHTML = '<li class="no-data">この月のデータはありません。</li>';
        return;
    }

    entries.forEach(entry => {
        const li = document.createElement('li');
        li.classList.add('history-item', entry.type === '支出' ? 'expense' : 'income');
        const formattedTags = entry.tags ? entry.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('') : '';

        li.innerHTML = `
            <div class="item-header">
                <span class="item-date">${entry.date}</span>
                <span class="item-category">${entry.category}</span>
                <span class="item-type">${entry.type}</span>
            </div>
            <div class="item-body">
                <span class="item-note">${entry.note}</span>
                <span class="item-amount">${entry.amount.toLocaleString()} 円</span>
            </div>
            <div class="item-footer">
                <div class="item-tags">${formattedTags}</div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${entry.id}">編集</button>
                    <button class="delete-btn" data-id="${entry.id}">削除</button>
                </div>
            </div>
        `;
        historyList.appendChild(li);
    });
}

// 集計の更新
function updateSummary(entries) {
    let totalIncome = 0;
    let totalExpense = 0;

    entries.forEach(entry => {
        if (entry.type === '収入') {
            totalIncome += entry.amount;
        } else {
            totalExpense += entry.amount;
        }
    });

    totalIncomeSpan.textContent = `¥${totalIncome.toLocaleString()}`;
    totalExpenseSpan.textContent = `¥${totalExpense.toLocaleString()}`;
    balanceSpan.textContent = `¥${(totalIncome - totalExpense).toLocaleString()}`;

    updateBudgetStatus(totalExpense);
}

function updateBudgetStatus(currentExpense) {
    const currentMonthKey = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    let isBudgetSet = false;
    let budgetHtml = '<h3>今月の予算実績</h3>';
    getAllData(STORE_NAMES.BUDGETS).then(budgets => {
        let totalBudget = 0;
        let totalCurrentExpense = 0;
        
        budgets.forEach(budget => {
            const category = budget.category;
            const amount = budget.amount;
            totalBudget += amount;
            isBudgetSet = true;

            const categoryExpense = allData
                .filter(e => {
                    const eDate = new Date(e.date);
                    return e.type === '支出' && e.category === category && eDate.getFullYear() === currentMonth.getFullYear() && eDate.getMonth() === currentMonth.getMonth();
                })
                .reduce((sum, e) => sum + e.amount, 0);
            
            totalCurrentExpense += categoryExpense;
            const remaining = amount - categoryExpense;
            const statusClass = remaining >= 0 ? 'budget-ok' : 'budget-over';
            const statusText = remaining >= 0 ? '達成' : '超過';
            const progress = (categoryExpense / amount) * 100;
            
            budgetHtml += `
                <div class="budget-item">
                    <div class="budget-item-header">
                        <span>${category}</span>
                        <span>${categoryExpense.toLocaleString()} / ${amount.toLocaleString()} 円</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${Math.min(progress, 100)}%;"></div>
                    </div>
                    <div class="budget-item-footer">
                        <span>残り: ${remaining.toLocaleString()} 円</span>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                </div>
            `;
        });
        
        if (isBudgetSet) {
            noBudgetSetMessage.style.display = 'none';
            const remainingTotal = totalBudget - totalCurrentExpense;
            const totalStatusClass = remainingTotal >= 0 ? 'budget-ok' : 'budget-over';
            const totalStatusText = remainingTotal >= 0 ? '達成' : '超過';
            
            budgetHtml += `
                <div class="total-budget-summary">
                    <hr>
                    <div class="total-budget-item">
                        <span>合計</span>
                        <span>${totalCurrentExpense.toLocaleString()} / ${totalBudget.toLocaleString()} 円</span>
                    </div>
                    <div class="total-budget-item">
                        <span>残り合計</span>
                        <span>${remainingTotal.toLocaleString()} 円</span>
                        <span class="${totalStatusClass}">${totalStatusText}</span>
                    </div>
                </div>
            `;
            budgetStatusDiv.innerHTML = budgetHtml;
        } else {
            noBudgetSetMessage.style.display = 'block';
            budgetStatusDiv.innerHTML = `<h3>今月の予算実績</h3>`;
            budgetStatusDiv.appendChild(noBudgetSetMessage);
        }
    });
}

// グラフの描画
function updateChart(entries) {
    if (myChart) {
        myChart.destroy();
    }
    const activeTab = document.querySelector('.chart-tabs button.active').id;
    if (activeTab === 'pieChartTab') {
        renderPieChart(entries);
    } else if (activeTab === 'monthlyBarChartTab') {
        renderMonthlyBarChart();
    } else {
        renderYearlyBarChart();
    }
}

function renderPieChart(entries) {
    const expenseData = entries.filter(e => e.type === '支出');
    const categoryTotals = expenseData.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    myChart = new Chart(myChartCanvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#5D6D7E', '#48C9B0', '#F4D03F', '#D35400', '#2E86C1', '#229954',
                    '#8E44AD'
                ],
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
                    text: 'カテゴリ別支出'
                }
            }
        },
    });
}

async function renderMonthlyBarChart() {
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    const monthlyData = {};

    allEntries.forEach(entry => {
        const date = new Date(entry.date);
        const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expense: 0 };
        }
        if (entry.type === '収入') {
            monthlyData[month].income += entry.amount;
        } else {
            monthlyData[month].expense += entry.amount;
        }
    });

    const labels = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
    const incomeData = labels.map(month => monthlyData[month].income);
    const expenseData = labels.map(month => monthlyData[month].expense);

    myChart = new Chart(myChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '収入',
                    data: incomeData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                },
                {
                    label: '支出',
                    data: expenseData,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                }
            ]
        },
        options: {
            responsive: true,
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
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '月別収支推移'
                }
            }
        }
    });
}

async function renderYearlyBarChart() {
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    const yearlyData = {};

    allEntries.forEach(entry => {
        const date = new Date(entry.date);
        const year = date.getFullYear().toString();
        if (!yearlyData[year]) {
            yearlyData[year] = { income: 0, expense: 0 };
        }
        if (entry.type === '収入') {
            yearlyData[year].income += entry.amount;
        } else {
            yearlyData[year].expense += entry.amount;
        }
    });

    const labels = Object.keys(yearlyData).sort();
    const incomeData = labels.map(year => yearlyData[year].income);
    const expenseData = labels.map(year => yearlyData[year].expense);

    myChart = new Chart(myChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '収入',
                    data: incomeData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                },
                {
                    label: '支出',
                    data: expenseData,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                }
            ]
        },
        options: {
            responsive: true,
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
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '年別収支推移'
                }
            }
        }
    });
}

// イベントリスナー
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = typeSelect.value;
    const category = categorySelect.value;
    const amount = parseInt(amountInput.value, 10);
    const note = noteInput.value.trim();
    const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '').join(',');
    const date = document.getElementById("date").value || new Date().toISOString().slice(0, 10);

    if (isNaN(amount) || amount <= 0 || !type || !category) {
        alert("種別、カテゴリ、金額は必須項目です。金額は正の値を入力してください。");
        return;
    }

    const entry = { type, date, category, amount, note, tags };

    if (editEntryId) {
        entry.id = editEntryId;
        await updateData(STORE_NAMES.ENTRIES, entry);
        editEntryId = null;
        form.querySelector('button[type="submit"]').textContent = '追加';
        document.getElementById("cancelEditBtn").style.display = 'none';
    } else {
        await addData(STORE_NAMES.ENTRIES, entry);
    }
    
    form.reset();
    document.getElementById("date").valueAsDate = new Date();
    await loadAllDataForSuggestions();
    await loadAndDisplayData();
});

historyList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const idToDelete = parseInt(e.target.dataset.id, 10);
        if (confirm("この記録を削除してもよろしいですか？")) {
            await deleteDataFromStore(STORE_NAMES.ENTRIES, idToDelete);
            await loadAllDataForSuggestions();
            await loadAndDisplayData();
        }
    } else if (e.target.classList.contains('edit-btn')) {
        const idToEdit = parseInt(e.target.dataset.id, 10);
        const entryToEdit = allData.find(e => e.id === idToEdit);
        if (entryToEdit) {
            editEntryId = idToEdit;
            typeSelect.value = entryToEdit.type;
            updateCategoryOptions();
            document.getElementById("date").value = entryToEdit.date;
            categorySelect.value = entryToEdit.category;
            amountInput.value = entryToEdit.amount;
            noteInput.value = entryToEdit.note;
            tagsInput.value = entryToEdit.tags;
            form.querySelector('button[type="submit"]').textContent = '更新';
            document.getElementById("cancelEditBtn").style.display = 'inline-block';
            document.getElementById("top").scrollIntoView({ behavior: 'smooth' });
        }
    }
});

document.getElementById("cancelEditBtn").addEventListener('click', () => {
    editEntryId = null;
    form.reset();
    document.getElementById("date").valueAsDate = new Date();
    form.querySelector('button[type="submit"]').textContent = '追加';
    document.getElementById("cancelEditBtn").style.display = 'none';
    updateCategoryOptions();
});


prevMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateMonthDisplay();
    loadAndDisplayData();
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateMonthDisplay();
    loadAndDisplayData();
});

currentMonthDisplay.addEventListener('click', () => {
    monthPicker.click();
});

monthPicker.addEventListener('change', (e) => {
    const [year, month] = e.target.value.split('-').map(Number);
    currentMonth = new Date(year, month - 1);
    updateMonthDisplay();
    loadAndDisplayData();
});

function updateMonthDisplay() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    currentMonthDisplay.textContent = `${year}年${month}月`;
}

// グラフタブの切り替え
pieChartTab.addEventListener('click', () => {
    pieChartTab.classList.add('active');
    monthlyBarChartTab.classList.remove('active');
    yearlyBarChartTab.classList.remove('active');
    loadAndDisplayData();
});

monthlyBarChartTab.addEventListener('click', () => {
    pieChartTab.classList.remove('active');
    monthlyBarChartTab.classList.add('active');
    yearlyBarChartTab.classList.remove('active');
    loadAndDisplayData();
});

yearlyBarChartTab.addEventListener('click', () => {
    pieChartTab.classList.remove('active');
    monthlyBarChartTab.classList.remove('active');
    yearlyBarChartTab.classList.add('active');
    loadAndDisplayData();
});

// 予算設定機能
async function setupBudgetSection() {
    const budgets = await getAllData(STORE_NAMES.BUDGETS);
    budgetList.innerHTML = '';
    budgets.forEach(budget => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${budget.category}: ¥${budget.amount.toLocaleString()}</span>
            <button class="delete-budget-btn" data-category="${budget.category}">削除</button>
        `;
        budgetList.appendChild(li);
    });
}

setBudgetBtn.addEventListener('click', async () => {
    const category = budgetCategorySelect.value;
    const amount = parseInt(budgetAmountInput.value, 10);
    if (!category || isNaN(amount) || amount <= 0) {
        alert('カテゴリと正の予算額を入力してください。');
        return;
    }
    await updateData(STORE_NAMES.BUDGETS, { category, amount });
    budgetCategorySelect.value = '';
    budgetAmountInput.value = '';
    await setupBudgetSection();
    await loadAndDisplayData(); // 予算ステータスを更新
});

budgetList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-budget-btn')) {
        const categoryToDelete = e.target.dataset.category;
        if (confirm(`${categoryToDelete}の予算を削除してもよろしいですか？`)) {
            await deleteDataFromStore(STORE_NAMES.BUDGETS, categoryToDelete);
            await setupBudgetSection();
            await loadAndDisplayData(); // 予算ステータスを更新
        }
    }
});


// 定期的な記録機能のロジック
async function setupRecurringEntriesSection() {
    const recurringEntries = await getAllData(STORE_NAMES.RECURRING_ENTRIES);
    recurringEntryList.innerHTML = '';
    recurringEntries.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${entry.type} - ${entry.category}: ¥${entry.amount.toLocaleString()} (${entry.note}) | 毎月${entry.day}日</span>
            <button class="delete-recurring-btn" data-id="${entry.id}">削除</button>
        `;
        recurringEntryList.appendChild(li);
    });
}

addRecurringEntryBtn.addEventListener('click', async () => {
    const type = recurringTypeSelect.value;
    const category = recurringCategorySelect.value;
    const amount = parseInt(recurringAmountInput.value, 10);
    const note = recurringNoteInput.value.trim();
    const day = parseInt(recurringDayInput.value, 10);

    if (isNaN(amount) || amount <= 0 || !type || !category || isNaN(day) || day < 1 || day > 31) {
        alert("種別、カテゴリ、正の金額、1〜31の追加日を正しく入力してください。");
        return;
    }

    const entry = { type, category, amount, note, day };
    await addData(STORE_NAMES.RECURRING_ENTRIES, entry);
    
    // フォームをリセット
    recurringTypeSelect.value = '';
    recurringCategorySelect.innerHTML = '<option value="">選択してください</option>';
    recurringAmountInput.value = '';
    recurringNoteInput.value = '';
    recurringDayInput.value = '';

    // リストを更新
    await setupRecurringEntriesSection();
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
    const recurringEntries = await getAllData(STORE_NAMES.RECURRING_ENTRIES);
    if (recurringEntries.length === 0) {
        alert('登録済みの定期的な記録がありません。');
        return;
    }
    
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    const addedDates = new Set(allEntries.map(e => e.date));

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    let addedCount = 0;

    for (const entry of recurringEntries) {
        const entryDate = `${currentMonthStr}-${entry.day.toString().padStart(2, '0')}`;
        if (!addedDates.has(entryDate)) {
            const newEntry = {
                type: entry.type,
                date: entryDate,
                category: entry.category,
                amount: entry.amount,
                note: `[定期] ${entry.note}`,
                tags: `定期`
            };
            await addData(STORE_NAMES.ENTRIES, newEntry);
            addedCount++;
        }
    }
    
    if (addedCount > 0) {
        alert(`${addedCount}件の定期的な記録を今月に追加しました。`);
        await loadAllDataForSuggestions();
        await loadAndDisplayData();
    } else {
        alert('今月は追加できる定期的な記録がありませんでした。既に記録済みか、日付が不正な可能性があります。');
    }
});

// CSVエクスポート機能
exportCsvBtn.addEventListener('click', async () => {
    const allEntries = await getAllData(STORE_NAMES.ENTRIES);
    let csv = "ID,種別,日付,カテゴリ,金額,メモ,タグ\n";
    allEntries.forEach(entry => {
        csv += `${entry.id},"${entry.type}","${entry.date}","${entry.category}",${entry.amount},"${entry.note}","${entry.tags}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kakeibo_data_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('CSVデータがエクスポートされました。');
});

// CSVインポート機能
importCsvBtn.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    if (!file) {
        alert('CSVファイルを選択してください。');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const header = lines[0].split(',').map(h => h.trim());

        if (!header.includes('種別') || !header.includes('日付') || !header.includes('カテゴリ') || !header.includes('金額')) {
            alert('CSVヘッダーに「種別」「日付」「カテゴリ」「金額」がありません。正しいフォーマットのファイルを選択してください。');
            return;
        }

        const entriesToImport = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;

            const values = line.match(/(?:[^,"]+|"[^"]*")+/g).map(val => val.replace(/"/g, '').trim());
            const entry = {};
            header.forEach((h, index) => {
                const value = values[index];
                if (h === 'ID' || h === 'id') return; // IDはインポートしない
                if (h === '金額' || h === 'amount') {
                    entry.amount = parseInt(value, 10);
                } else if (h === 'タグ' || h === 'tags') {
                    entry.tags = value;
                } else if (h === 'メモ' || h === 'note') {
                    entry.note = value;
                } else if (h === '日付' || h === 'date') {
                    entry.date = value;
                } else if (h === '種別' || h === 'type') {
                    entry.type = value;
                } else if (h === 'カテゴリ' || h === 'category') {
                    entry.category = value;
                }
            });
            if (entry.type && entry.date && entry.category && entry.amount) {
                entriesToImport.push(entry);
            }
        }
        
        // 既存データをクリアするか確認
        if (confirm(`CSVから ${entriesToImport.length} 件のデータをインポートします。既存のデータをすべて削除して置き換えますか？\n「キャンセル」を選択した場合、データが追加されます。`)) {
            await clearStore(STORE_NAMES.ENTRIES);
            console.log("Existing data cleared.");
        }

        for (const entry of entriesToImport) {
            await addData(STORE_NAMES.ENTRIES, entry);
        }

        alert(`${entriesToImport.length}件のデータを正常にインポートしました。`);
        csvFileInput.value = '';
        await loadAllDataForSuggestions();
        await loadAndDisplayData();
    };

    reader.readAsText(file);
});


// スクロールナビゲーション
const headerHeight = document.querySelector('h1').offsetHeight;
navButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
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
    document.getElementById("date").valueAsDate = new Date();
    updateMonthDisplay();
}

init();


