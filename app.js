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
const submitBtn = document.querySelector("#expense-form button[type='submit']");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// グローバル変数
let customCategories = new Set();
let pastNotes = new Set();
let currentMonth = new Date();
let myChartInstance;
let db;
let allEntries = [];
let editingEntryId = null;

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
        data.id = editingEntryId;
        await saveData(STORE_NAMES.ENTRIES, data);
        alert("履歴が更新されました。");
        editingEntryId = null;
    } else {
        await saveData(STORE_NAMES.ENTRIES, data);
        alert("履歴が追加されました。");
    }

    form.reset();
    dateInput.valueAsDate = new Date();
    submitBtn.textContent = '追加';
    cancelEditBtn.style.display = 'none';

    await loadAllDataForSuggestions();
    await loadAndDisplayData();
});

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
    const categoriesToShow = (CATEGORY_OPTIONS[type] || []).concat(
        type === '支出' ? Array.from(customCategories) : []
    );
    categoriesToShow.sort().forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
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
        }
        if (item.note) {
            pastNotes.add(item.note);
        }
    });
    updateMemoSuggestions();
}

async function loadAndDisplayData() {
    allEntries = await loadAllDataFromStore(STORE_NAMES.ENTRIES) || [];
    displayHistoryForMonth(currentMonth);
    updateBudgetStatus();
    updateCharts();
}

function displayHistoryForMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    historyList.innerHTML = '';
    const filtered = allEntries.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });
    filtered.sort((a,b) => new Date(a.date) - new Date(b.date));
    let totalIncome = 0;
    let totalExpense = 0;
    filtered.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.date} | ${item.type} | ${item.category} | ${item.amount.toLocaleString()}円 | ${item.note || ''}`;
        li.dataset.id = item.id;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            fillFormForEdit(item);
        });
        historyList.appendChild(li);
        if (item.type === '収入') {
            totalIncome += item.amount;
        } else if (item.type === '支出') {
            totalExpense += item.amount;
        }
    });
    totalIncomeSpan.textContent = totalIncome.toLocaleString();
    totalExpenseSpan.textContent = totalExpense.toLocaleString();
    balanceSpan.textContent = (totalIncome - totalExpense).toLocaleString();
    currentMonthDisplay.textContent = `${year}年${month + 1}月`;
}

function fillFormForEdit(item) {
    editingEntryId = item.id;
    typeSelect.value = item.type;
    updateCategoryOptions();
    categorySelect.value = item.category;
    amountInput.value = item.amount;
    noteInput.value = item.note;
    tagsInput.value = item.tags ? item.tags.join(', ') : '';
    dateInput.value = item.date;
    submitBtn.textContent = '更新';
    cancelEditBtn.style.display = 'inline-block';
}

prevMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    displayHistoryForMonth(currentMonth);
    updateCharts();
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    displayHistoryForMonth(currentMonth);
    updateCharts();
});

// --- 定期記録機能 ---
addRecurringEntryBtn.addEventListener('click', async () => {
    const type = recurringTypeSelect.value;
    const category = recurringCategorySelect.value;
    const amount = parseInt(recurringAmountInput.value, 10);
    const note = recurringNoteInput.value;
    const day = parseInt(recurringDayInput.value, 10);

    if (!type || !category || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) {
        alert("種別、カテゴリ、金額、日付(1-31)は正しく入力してください。");
        return;
    }

    await saveData(STORE_NAMES.RECURRING_ENTRIES, { type, category, amount, note, day });
    alert("定期記録を追加しました。");
    recurringTypeSelect.value = '';
    recurringCategorySelect.value = '';
    recurringAmountInput.value = '';
    recurringNoteInput.value = '';
    recurringDayInput.value = '';
    loadAndDisplayRecurringEntries();
});

async function loadAndDisplayRecurringEntries() {
    const recurringEntries = await loadAllDataFromStore(STORE_NAMES.RECURRING_ENTRIES) || [];
    recurringEntryList.innerHTML = '';
    recurringEntries.forEach(entry => {
        const div = document.createElement('div');
        div.textContent = `${entry.type} | ${entry.category} | ${entry.amount}円 | 毎月${entry.day}日 | メモ: ${entry.note || ''}`;
        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', async () => {
            await deleteDataFromStore(STORE_NAMES.RECURRING_ENTRIES, entry.id);
            alert('定期記録を削除しました。');
            loadAndDisplayRecurringEntries();
        });
        div.appendChild(delBtn);
        recurringEntryList.appendChild(div);
    });
}

addMonthlyRecurringEntriesBtn.addEventListener('click', async () => {
    await applyRecurringEntriesForCurrentMonth();
    alert("今月の定期記録を追加しました。");
    await loadAndDisplayData();
});

async function applyRecurringEntriesForCurrentMonth() {
    const recurringEntries = await loadAllDataFromStore(STORE_NAMES.RECURRING_ENTRIES) || [];
    if (recurringEntries.length === 0) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const existingEntries = allEntries.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    for (const recurring of recurringEntries) {
        let day = recurring.day;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        if (day > daysInMonth) day = daysInMonth;
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const exists = existingEntries.some(entry =>
            entry.type === recurring.type &&
            entry.category === recurring.category &&
            entry.amount === recurring.amount &&
            entry.date === dateStr &&
            entry.note === recurring.note
        );

        if (!exists) {
            const newEntry = {
                type: recurring.type,
                category: recurring.category,
                amount: recurring.amount,
                date: dateStr,
                note: recurring.note,
                tags: []
            };
            await saveData(STORE_NAMES.ENTRIES, newEntry);
            allEntries.push(newEntry);
        }
    }
}

// --- 予算機能 ---
setBudgetBtn.addEventListener('click', async () => {
    const category = budgetCategorySelect.value;
    const amount = parseInt(budgetAmountInput.value, 10);
    if (!category || isNaN(amount) || amount <= 0) {
        alert('カテゴリと正しい金額を入力してください。');
        return;
    }
    await saveData(STORE_NAMES.BUDGETS, { category, amount });
    alert('予算を設定しました。');
    loadAndDisplayBudget();
});

async function loadAndDisplayBudget() {
    const budgets = await loadAllDataFromStore(STORE_NAMES.BUDGETS) || [];
    budgetList.innerHTML = '';
    budgets.forEach(budget => {
        const div = document.createElement('div');
        div.textContent = `${budget.category}: ${budget.amount.toLocaleString()}円`;
        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', async () => {
            await deleteDataFromStore(STORE_NAMES.BUDGETS, budget.category);
            alert('予算を削除しました。');
            loadAndDisplayBudget();
        });
        div.appendChild(delBtn);
        budgetList.appendChild(div);
    });
    updateBudgetStatus();
}

async function updateBudgetStatus() {
    const budgets = await loadAllDataFromStore(STORE_NAMES.BUDGETS) || [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    let messages = [];
    budgets.forEach(budget => {
        const spent = allEntries
            .filter(entry => entry.type === '支出' && entry.category === budget.category)
            .filter(entry => {
                const d = new Date(entry.date);
                return d.getFullYear() === year && d.getMonth() === month;
            })
            .reduce((sum, entry) => sum + entry.amount, 0);
        if (spent > budget.amount) {
            messages.push(`${budget.category}の支出が予算を超えています！（${spent.toLocaleString()}円 / ${budget.amount.toLocaleString()}円）`);
        }
    });
    budgetStatusDiv.innerHTML = messages.length > 0 ? messages.join('<br>') : '今月の予算内です。';
}

// --- フィルタ機能 ---
searchBtn.addEventListener('click', () => {
    applyFilter();
});

resetFilterBtn.addEventListener('click', () => {
    filterKeywordInput.value = '';
    filterTypeSelect.value = '';
    filterCategorySelect.value = '';
    filterAmountMinInput.value = '';
    filterAmountMaxInput.value = '';
    displayHistoryForMonth(currentMonth);
    updateCharts();
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

function applyFilter() {
    const keyword = filterKeywordInput.value.trim();
    const type = filterTypeSelect.value;
    const category = filterCategorySelect.value;
    const amountMin = parseInt(filterAmountMinInput.value, 10);
    const amountMax = parseInt(filterAmountMaxInput.value, 10);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    let filtered = allEntries.filter(item => {
        const d = new Date(item.date);
        if (d.getFullYear() !== year || d.getMonth() !== month) return false;
        if (keyword && !item.note?.includes(keyword)) return false;
        if (type && item.type !== type) return false;
        if (category && item.category !== category) return false;
        if (!isNaN(amountMin) && item.amount < amountMin) return false;
        if (!isNaN(amountMax) && item.amount > amountMax) return false;
        return true;
    });

    historyList.innerHTML = '';
    filtered.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.date} | ${item.type} | ${item.category} | ${item.amount.toLocaleString()}円 | ${item.note || ''}`;
        li.dataset.id = item.id;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            fillFormForEdit(item);
        });
        historyList.appendChild(li);
    });

    let totalIncome = 0;
    let totalExpense = 0;
    filtered.forEach(item => {
        if (item.type === '収入') totalIncome += item.amount;
        else if (item.type === '支出') totalExpense += item.amount;
    });

    totalIncomeSpan.textContent = totalIncome.toLocaleString();
    totalExpenseSpan.textContent = totalExpense.toLocaleString();
    balanceSpan.textContent = (totalIncome - totalExpense).toLocaleString();
    updateCharts(filtered);
}

// --- グラフ関連（Chart.js） ---
function updateCharts(filteredEntries) {
    // グラフ描画ロジック
    // ...
}

// --- CSVエクスポート・インポート ---
exportCsvBtn.addEventListener('click', () => {
    exportCSV();
});

function exportCSV() {
    if (!allEntries.length) {
        alert('エクスポートするデータがありません。');
        return;
    }
    const header = ['id', 'type', 'date', 'category', 'amount', 'note', 'tags'];
    const csvRows = [
        header.join(',')
    ];
    allEntries.forEach(item => {
        const row = [
            item.id,
            item.type,
            item.date,
            item.category,
            item.amount,
            `"${(item.note || '').replace(/"/g, '""')}"`,
            `"${(item.tags || []).join(';')}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kakeibo_export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

importCsvBtn.addEventListener('click', () => {
    csvFileInput.click();
});

csvFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const lines = event.target.result.split('\n');
        const dataToImport = [];

        // ヘッダー行をスキップ
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',');

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
    csvFileInput.value = ''; // ファイル選択をリセット
});

function parseCSVLine(line) {
    const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,]+))/g;
    const result = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
        if (match[1] !== undefined) {
            result.push(match[1].replace(/\"\"/g, '"'));
        } else if (match[2] !== undefined) {
            result.push(match[2]);
        } else {
            result.push('');
        }
    }
    return result;
}

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

// --- 初期化処理 ---
async function init() {
    await openDB();
    await loadAllDataForSuggestions();
    updateCategoryOptions();
    await loadAndDisplayData();
    await loadAndDisplayRecurringEntries();
    await loadAndDisplayBudget();
    updateRecurringCategoryOptions();
    dateInput.valueAsDate = new Date();
    currentMonth = new Date();
    
    // アプリ起動時に今月の定期記録を自動追加する
    await applyRecurringEntriesForCurrentMonth();
}

window.addEventListener('load', init);
