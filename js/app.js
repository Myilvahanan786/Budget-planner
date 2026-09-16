(function () {
  "use strict";

  var STORAGE_KEY = "budgetPlannerData_v1";
  var DEFAULT_CURRENCY = "USD";

  var CURRENCIES = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real" },
    { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" }
  ];

  var CATEGORIES = {
    income: ["Salary", "Freelance", "Investments", "Gifts", "Other Income"],
    expense: [
      "Housing", "Utilities", "Groceries", "Transportation", "Healthcare",
      "Entertainment", "Shopping", "Education", "Insurance", "Debt Payment", "Other Expense"
    ]
  };

  var CATEGORY_COLORS = {
    "Housing": "#4361ee", "Utilities": "#3a86ff", "Groceries": "#2a9d5c",
    "Transportation": "#ff9f1c", "Healthcare": "#e63946", "Entertainment": "#8338ec",
    "Shopping": "#f72585", "Education": "#06a77d", "Insurance": "#5c677d",
    "Debt Payment": "#d64550", "Other Expense": "#9aa3b8"
  };

  var state = {
    transactions: [],
    budgets: {},
    settings: { currency: DEFAULT_CURRENCY }
  };
  var currentMonth = monthKey(new Date());
  var activeType = "expense";

  // ---------- persistence ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.transactions)) {
          state.transactions = parsed.transactions;
        }
        if (parsed && parsed.budgets && typeof parsed.budgets === "object") {
          state.budgets = parsed.budgets;
        }
        if (parsed && parsed.settings && typeof parsed.settings.currency === "string" &&
            CURRENCIES.some(function (c) { return c.code === parsed.settings.currency; })) {
          state.settings.currency = parsed.settings.currency;
        }
      }
    } catch (e) {
      console.warn("Could not load saved data:", e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save data:", e);
    }
  }

  // ---------- helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function monthKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    return y + "-" + m;
  }

  function monthKeyFromDateStr(dateStr) {
    return dateStr.slice(0, 7);
  }

  function formatCurrency(n) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: state.settings.currency }).format(n || 0);
    } catch (e) {
      // Fallback if the browser's Intl data doesn't recognize the code
      var meta = CURRENCIES.filter(function (c) { return c.code === state.settings.currency; })[0];
      var symbol = meta ? meta.symbol : "$";
      return symbol + (n || 0).toFixed(2);
    }
  }

  function formatMonthLabel(key) {
    var parts = key.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function shiftMonth(key, delta) {
    var parts = key.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1 + delta, 1);
    return monthKey(d);
  }

  function todayStr() {
    var d = new Date();
    var offset = d.getTimezoneOffset();
    var local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }

  function transactionsForMonth(key) {
    return state.transactions.filter(function (t) { return monthKeyFromDateStr(t.date) === key; });
  }

  function sumByType(list, type) {
    return list.filter(function (t) { return t.type === type; })
      .reduce(function (sum, t) { return sum + t.amount; }, 0);
  }

  function sumByCategory(list) {
    var map = {};
    list.forEach(function (t) {
      if (t.type !== "expense") return;
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }

  // ---------- DOM refs ----------
  var el = {
    currencySelect: document.getElementById("currencySelect"),
    prevMonth: document.getElementById("prevMonth"),
    nextMonth: document.getElementById("nextMonth"),
    monthLabel: document.getElementById("currentMonthLabel"),
    totalIncome: document.getElementById("totalIncome"),
    totalExpense: document.getElementById("totalExpense"),
    totalBalance: document.getElementById("totalBalance"),
    savingsRate: document.getElementById("savingsRate"),
    txForm: document.getElementById("transactionForm"),
    txAmount: document.getElementById("txAmount"),
    txCategory: document.getElementById("txCategory"),
    txDescription: document.getElementById("txDescription"),
    txDate: document.getElementById("txDate"),
    typeButtons: document.querySelectorAll(".type-btn"),
    budgetForm: document.getElementById("budgetForm"),
    budgetCategory: document.getElementById("budgetCategory"),
    budgetAmount: document.getElementById("budgetAmount"),
    budgetProgress: document.getElementById("budgetProgress"),
    pieChart: document.getElementById("pieChart"),
    pieLegend: document.getElementById("pieLegend"),
    barChart: document.getElementById("barChart"),
    txTableBody: document.getElementById("txTableBody"),
    emptyState: document.getElementById("emptyState"),
    filterCategory: document.getElementById("filterCategory"),
    filterType: document.getElementById("filterType"),
    exportBtn: document.getElementById("exportBtn")
  };

  // ---------- category selects ----------
  function fillSelect(select, categories, placeholder) {
    select.innerHTML = "";
    if (placeholder) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      select.appendChild(opt);
    }
    categories.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      select.appendChild(o);
    });
  }

  function refreshTxCategoryOptions() {
    fillSelect(el.txCategory, CATEGORIES[activeType], null);
  }

  function refreshStaticSelects() {
    fillSelect(el.budgetCategory, CATEGORIES.expense, null);
    var allCategories = CATEGORIES.income.concat(CATEGORIES.expense);
    fillSelect(el.filterCategory, allCategories, "All Categories");
  }

  function refreshCurrencySelect() {
    el.currencySelect.innerHTML = "";
    CURRENCIES.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.code;
      o.textContent = c.code + " (" + c.symbol + ") — " + c.name;
      el.currencySelect.appendChild(o);
    });
    el.currencySelect.value = state.settings.currency;
  }

  // ---------- rendering ----------
  function renderMonthLabel() {
    el.monthLabel.textContent = formatMonthLabel(currentMonth);
  }

  function renderSummary() {
    var list = transactionsForMonth(currentMonth);
    var income = sumByType(list, "income");
    var expense = sumByType(list, "expense");
    var balance = income - expense;
    var rate = income > 0 ? Math.round((balance / income) * 100) : 0;

    el.totalIncome.textContent = formatCurrency(income);
    el.totalExpense.textContent = formatCurrency(expense);
    el.totalBalance.textContent = formatCurrency(balance);
    el.savingsRate.textContent = rate + "%";
    el.totalBalance.style.color = balance < 0 ? "var(--expense)" : "var(--accent)";
  }

  function renderBudgetProgress() {
    var list = transactionsForMonth(currentMonth);
    var spentByCategory = sumByCategory(list);
    var categories = Object.keys(state.budgets);
    el.budgetProgress.innerHTML = "";

    if (categories.length === 0) {
      var p = document.createElement("p");
      p.className = "budget-empty";
      p.textContent = "No budget limits set yet.";
      el.budgetProgress.appendChild(p);
      return;
    }

    categories.sort().forEach(function (cat) {
      var limit = state.budgets[cat];
      var spent = spentByCategory[cat] || 0;
      var pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      var over = spent > limit;

      var row = document.createElement("div");
      row.className = "budget-row";

      var head = document.createElement("div");
      head.className = "budget-row-head";

      var nameWrap = document.createElement("span");
      nameWrap.className = "cat-name";
      var swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = CATEGORY_COLORS[cat] || "#9aa3b8";
      nameWrap.appendChild(swatch);
      nameWrap.appendChild(document.createTextNode(cat));

      var amounts = document.createElement("span");
      amounts.className = "amounts" + (over ? " over" : "");
      amounts.textContent = formatCurrency(spent) + " / " + formatCurrency(limit);

      var removeBtn = document.createElement("button");
      removeBtn.className = "remove-budget";
      removeBtn.type = "button";
      removeBtn.title = "Remove limit";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        delete state.budgets[cat];
        save();
        renderBudgetProgress();
      });

      var headLeft = document.createElement("div");
      headLeft.style.display = "flex";
      headLeft.style.alignItems = "center";
      headLeft.style.gap = "8px";
      headLeft.appendChild(nameWrap);

      var headRight = document.createElement("div");
      headRight.style.display = "flex";
      headRight.style.alignItems = "center";
      headRight.style.gap = "6px";
      headRight.appendChild(amounts);
      headRight.appendChild(removeBtn);

      head.appendChild(headLeft);
      head.appendChild(headRight);

      var track = document.createElement("div");
      track.className = "progress-track";
      var fill = document.createElement("div");
      fill.className = "progress-fill " + (over ? "over" : pct >= 80 ? "warn" : "ok");
      fill.style.width = pct + "%";
      track.appendChild(fill);

      row.appendChild(head);
      row.appendChild(track);
      el.budgetProgress.appendChild(row);
    });
  }

  function renderTransactionTable() {
    var list = transactionsForMonth(currentMonth).slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    var catFilter = el.filterCategory.value;
    var typeFilter = el.filterType.value;
    if (catFilter) list = list.filter(function (t) { return t.category === catFilter; });
    if (typeFilter) list = list.filter(function (t) { return t.type === typeFilter; });

    el.txTableBody.innerHTML = "";
    el.emptyState.style.display = list.length === 0 ? "block" : "none";

    list.forEach(function (t) {
      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.textContent = t.date;

      var tdCat = document.createElement("td");
      tdCat.textContent = t.category;

      var tdDesc = document.createElement("td");
      tdDesc.textContent = t.description || "—";

      var tdAmount = document.createElement("td");
      tdAmount.className = "amount " + t.type;
      tdAmount.textContent = (t.type === "expense" ? "-" : "+") + formatCurrency(t.amount);

      var tdActions = document.createElement("td");
      tdActions.className = "actions";
      var delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.type = "button";
      delBtn.title = "Delete transaction";
      delBtn.textContent = "🗑";
      delBtn.addEventListener("click", function () {
        if (confirm("Delete this transaction?")) {
          state.transactions = state.transactions.filter(function (x) { return x.id !== t.id; });
          save();
          renderAll();
        }
      });
      tdActions.appendChild(delBtn);

      tr.appendChild(tdDate);
      tr.appendChild(tdCat);
      tr.appendChild(tdDesc);
      tr.appendChild(tdAmount);
      tr.appendChild(tdActions);
      el.txTableBody.appendChild(tr);
    });
  }

  // ---------- charts (plain canvas, no external libs) ----------
  function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function renderPieChart() {
    var canvas = el.pieChart;
    var ctx = canvas.getContext("2d");
    clearCanvas(ctx, canvas);

    var list = transactionsForMonth(currentMonth);
    var byCategory = sumByCategory(list);
    var entries = Object.keys(byCategory)
      .map(function (cat) { return { label: cat, value: byCategory[cat], color: CATEGORY_COLORS[cat] || "#9aa3b8" }; })
      .sort(function (a, b) { return b.value - a.value; });

    var total = entries.reduce(function (s, e) { return s + e.value; }, 0);
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var outerRadius = Math.min(cx, cy) - 10;
    var innerRadius = outerRadius * 0.55;

    ctx.font = "14px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (total === 0) {
      ctx.fillStyle = "#b45309";
      ctx.fillText("No expenses this month", cx, cy);
      el.pieLegend.innerHTML = "";
      return;
    }

    var startAngle = -Math.PI / 2;
    entries.forEach(function (entry) {
      var sliceAngle = (entry.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = entry.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    // donut hole
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#c2410c";
    ctx.font = "bold 16px -apple-system, sans-serif";
    ctx.fillText(formatCurrency(total), cx, cy - 8);
    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#b45309";
    ctx.fillText("total spent", cx, cy + 12);

    el.pieLegend.innerHTML = "";
    entries.forEach(function (entry) {
      var pct = Math.round((entry.value / total) * 100);
      var item = document.createElement("span");
      item.className = "legend-item";
      var swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = entry.color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(entry.label + " (" + pct + "%)"));
      el.pieLegend.appendChild(item);
    });
  }

  function lastNMonths(n, endKey) {
    var months = [];
    for (var i = n - 1; i >= 0; i--) {
      months.push(shiftMonth(endKey, -i));
    }
    return months;
  }

  function renderBarChart() {
    var canvas = el.barChart;
    var ctx = canvas.getContext("2d");
    clearCanvas(ctx, canvas);

    var gridColor = "#fed7aa";
    var textColor = "#b45309";

    var months = lastNMonths(6, currentMonth);
    var data = months.map(function (key) {
      var list = transactionsForMonth(key);
      return { key: key, income: sumByType(list, "income"), expense: sumByType(list, "expense") };
    });

    var maxVal = Math.max.apply(null, data.map(function (d) { return Math.max(d.income, d.expense); }).concat([1]));
    var padding = { top: 20, right: 20, bottom: 34, left: 60 };
    var chartW = canvas.width - padding.left - padding.right;
    var chartH = canvas.height - padding.top - padding.bottom;

    // gridlines + y labels
    var steps = 4;
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = textColor;
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var s = 0; s <= steps; s++) {
      var y = padding.top + chartH - (chartH * s) / steps;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.lineWidth = 1;
      ctx.stroke();
      var val = (maxVal * s) / steps;
      ctx.fillText(formatCurrency(val).replace(/\.00$/, ""), padding.left - 8, y);
    }

    var groupWidth = chartW / months.length;
    var barWidth = Math.min(28, groupWidth * 0.28);
    var gap = 8;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    data.forEach(function (d, i) {
      var groupX = padding.left + i * groupWidth + groupWidth / 2;
      var incomeH = (d.income / maxVal) * chartH;
      var expenseH = (d.expense / maxVal) * chartH;

      ctx.fillStyle = "#2a9d5c";
      ctx.fillRect(groupX - barWidth - gap / 2, padding.top + chartH - incomeH, barWidth, incomeH);

      ctx.fillStyle = "#d64550";
      ctx.fillRect(groupX + gap / 2, padding.top + chartH - expenseH, barWidth, expenseH);

      ctx.fillStyle = textColor;
      var parts = d.key.split("-");
      var label = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1)
        .toLocaleDateString(undefined, { month: "short" });
      ctx.fillText(label, groupX, padding.top + chartH + 8);
    });
  }

  // ---------- CSV export ----------
  function exportCsv() {
    var rows = [["Date", "Type", "Category", "Description", "Amount"]];
    state.transactions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); })
      .forEach(function (t) {
        rows.push([t.date, t.type, t.category, (t.description || "").replace(/"/g, '""'), t.amount.toFixed(2)]);
      });
    var csv = rows.map(function (r) {
      return r.map(function (field) {
        var s = String(field);
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      }).join(",");
    }).join("\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "budget-transactions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- master render ----------
  function renderAll() {
    renderMonthLabel();
    renderSummary();
    renderBudgetProgress();
    renderTransactionTable();
    renderPieChart();
    renderBarChart();
  }

  // ---------- events ----------
  el.typeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      el.typeButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeType = btn.getAttribute("data-type");
      refreshTxCategoryOptions();
    });
  });

  el.txForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = parseFloat(el.txAmount.value);
    if (!amount || amount <= 0) return;

    state.transactions.push({
      id: uid(),
      type: activeType,
      amount: amount,
      category: el.txCategory.value,
      description: el.txDescription.value.trim(),
      date: el.txDate.value || todayStr()
    });
    save();

    currentMonth = monthKeyFromDateStr(el.txDate.value || todayStr());
    el.txAmount.value = "";
    el.txDescription.value = "";
    renderAll();
  });

  el.budgetForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = parseFloat(el.budgetAmount.value);
    if (!el.budgetCategory.value || !(amount >= 0)) return;
    state.budgets[el.budgetCategory.value] = amount;
    save();
    el.budgetAmount.value = "";
    renderBudgetProgress();
  });

  el.prevMonth.addEventListener("click", function () {
    currentMonth = shiftMonth(currentMonth, -1);
    renderAll();
  });
  el.nextMonth.addEventListener("click", function () {
    currentMonth = shiftMonth(currentMonth, 1);
    renderAll();
  });

  el.filterCategory.addEventListener("change", renderTransactionTable);
  el.filterType.addEventListener("change", renderTransactionTable);
  el.exportBtn.addEventListener("click", exportCsv);

  el.currencySelect.addEventListener("change", function () {
    state.settings.currency = el.currencySelect.value;
    save();
    renderAll();
  });

  // ---------- init ----------
  function init() {
    load();
    refreshTxCategoryOptions();
    refreshStaticSelects();
    refreshCurrencySelect();
    el.txDate.value = todayStr();
    renderAll();
  }

  init();
})();
