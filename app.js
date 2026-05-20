const STORAGE_KEY = "personal-food-log.entries";
const SETTINGS_KEY = "personal-food-log.settings";
const FAVORITES_KEY = "personal-food-log.favorites";
const SYNC_SETTINGS_KEY = "personal-food-log.sync-settings";

const mealLabels = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "點心/宵夜",
};

const mealOrder = ["breakfast", "lunch", "dinner", "snack"];

const elements = {
  selectedDate: document.querySelector("#selectedDate"),
  prevDayButton: document.querySelector("#prevDayButton"),
  nextDayButton: document.querySelector("#nextDayButton"),
  totalCalories: document.querySelector("#totalCalories"),
  totalProtein: document.querySelector("#totalProtein"),
  totalCarbs: document.querySelector("#totalCarbs"),
  totalFat: document.querySelector("#totalFat"),
  scriptUrlInput: document.querySelector("#scriptUrlInput"),
  syncSecretInput: document.querySelector("#syncSecretInput"),
  saveSyncSettingsButton: document.querySelector("#saveSyncSettingsButton"),
  testSyncButton: document.querySelector("#testSyncButton"),
  syncFromSheetButton: document.querySelector("#syncFromSheetButton"),
  syncStatusBadge: document.querySelector("#syncStatusBadge"),
  syncStatusText: document.querySelector("#syncStatusText"),
  trendChart: document.querySelector("#trendChart"),
  trendAverage: document.querySelector("#trendAverage"),
  trendPeak: document.querySelector("#trendPeak"),
  trendEmptyState: document.querySelector("#trendEmptyState"),
  dailyGoal: document.querySelector("#dailyGoal"),
  remainingCalories: document.querySelector("#remainingCalories"),
  remainingLabel: document.querySelector("#remainingLabel"),
  goalProgress: document.querySelector("#goalProgress"),
  form: document.querySelector("#entryForm"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  mealType: document.querySelector("#mealType"),
  favoriteSelect: document.querySelector("#favoriteSelect"),
  favoriteList: document.querySelector("#favoriteList"),
  favoriteCount: document.querySelector("#favoriteCount"),
  saveFavorite: document.querySelector("#saveFavorite"),
  foodName: document.querySelector("#foodName"),
  calories: document.querySelector("#calories"),
  protein: document.querySelector("#protein"),
  carbs: document.querySelector("#carbs"),
  fat: document.querySelector("#fat"),
  quantity: document.querySelector("#quantity"),
  notes: document.querySelector("#notes"),
  logTitle: document.querySelector("#logTitle"),
  searchInput: document.querySelector("#searchInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportStatus: document.querySelector("#exportStatus"),
  mealGroups: document.querySelector("#mealGroups"),
  emptyState: document.querySelector("#emptyState"),
  entryTemplate: document.querySelector("#entryTemplate"),
};

let entries = loadCollection(STORAGE_KEY);
let favorites = loadCollection(FAVORITES_KEY);
let settings = loadSettings();
let syncSettings = loadSyncSettings();
let editingId = null;

function loadCollection(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? { dailyGoal: 1800 };
  } catch {
    return { dailyGoal: 1800 };
  }
}

function loadSyncSettings() {
  try {
    return { scriptUrl: "", sharedSecret: "", ...JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY)) };
  } catch {
    return { scriptUrl: "", sharedSecret: "" };
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function saveSyncSettings() {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(syncSettings));
}

function getSyncSettingsFromInputs() {
  return {
    scriptUrl: elements.scriptUrlInput.value.trim(),
    sharedSecret: elements.syncSecretInput.value.trim(),
  };
}

function hasSyncUrl(settingsSource = syncSettings) {
  return Boolean(settingsSource.scriptUrl && settingsSource.scriptUrl.trim());
}

function hasSyncSecret(settingsSource = syncSettings) {
  return Boolean(settingsSource.sharedSecret && settingsSource.sharedSecret.trim());
}

function hasSyncCredentials(settingsSource = syncSettings) {
  return hasSyncUrl(settingsSource) && hasSyncSecret(settingsSource);
}

function isTestDeploymentUrl(url = syncSettings.scriptUrl) {
  return /\/dev(?:[?#].*)?$/.test(url.trim());
}

function getSyncUrlWarning(url = syncSettings.scriptUrl) {
  if (!url.trim()) return "";
  if (isTestDeploymentUrl(url)) {
    return "目前使用的是 /dev 測試部署網址。請改用正式 Web App URL，網址通常以 /exec 結尾。";
  }
  if (!/\/exec(?:[?#].*)?$/.test(url.trim())) {
    return "請確認貼上的網址是 Apps Script Web App 正式部署 URL，通常會以 /exec 結尾。";
  }
  return "";
}

function getScriptUrl(action, settingsSource = syncSettings) {
  const url = new URL(settingsSource.scriptUrl);
  url.searchParams.set("action", action);
  if (settingsSource.sharedSecret) {
    url.searchParams.set("sharedSecret", settingsSource.sharedSecret);
  }
  return url.toString();
}

async function sheetGet(action) {
  const requestSettings = getSyncSettingsFromInputs();
  if (!hasSyncUrl(requestSettings)) {
    throw new Error("尚未設定 Apps Script URL");
  }
  if (!hasSyncSecret(requestSettings)) {
    throw new Error("尚未輸入同步密鑰");
  }
  const warning = getSyncUrlWarning(requestSettings.scriptUrl);
  if (warning) {
    throw new Error(warning);
  }

  let response;
  try {
    response = await fetch(getScriptUrl(action, requestSettings), {
      method: "GET",
    });
  } catch (error) {
    throw new Error(formatNetworkError(error));
  }
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Google Sheet 回傳錯誤");
  }
  return payload.data;
}

async function sheetPost(action, payload) {
  const requestSettings = getSyncSettingsFromInputs();
  if (!hasSyncUrl(requestSettings)) {
    return null;
  }
  if (!hasSyncSecret(requestSettings)) {
    throw new Error("尚未輸入同步密鑰");
  }
  const warning = getSyncUrlWarning(requestSettings.scriptUrl);
  if (warning) {
    throw new Error(warning);
  }

  let response;
  try {
    response = await fetch(requestSettings.scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, sharedSecret: requestSettings.sharedSecret, ...payload }),
    });
  } catch (error) {
    throw new Error(formatNetworkError(error));
  }
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || "Google Sheet 寫入失敗");
  }
  return result.data;
}

function formatNetworkError(error) {
  return `${error.message}。請確認使用正式部署的 /exec URL、存取權限為 Anyone with the link，並已部署最新版本。`;
}

function setSyncStatus(message, state = "idle") {
  const currentSettings = getSyncSettingsFromInputs();
  elements.syncStatusText.textContent = message;
  elements.syncStatusBadge.classList.toggle("ok", state === "ok");
  elements.syncStatusBadge.classList.toggle("warning", state === "warning");
  elements.syncStatusBadge.textContent =
    state === "ok"
      ? "已同步"
      : state === "warning"
        ? "同步需注意"
        : hasSyncCredentials(currentSettings)
          ? "已設定"
          : hasSyncUrl(currentSettings)
            ? "需密鑰"
            : "本機模式";
}

function renderSyncSettings() {
  elements.scriptUrlInput.value = syncSettings.scriptUrl || "";
  elements.syncSecretInput.value = syncSettings.sharedSecret || "";
  renderSyncAvailability();
}

function renderSyncAvailability() {
  const currentSettings = getSyncSettingsFromInputs();
  const warning = getSyncUrlWarning(currentSettings.scriptUrl);
  elements.testSyncButton.disabled = !hasSyncCredentials(currentSettings) || Boolean(warning);
  elements.syncFromSheetButton.disabled = !hasSyncCredentials(currentSettings) || Boolean(warning);
  if (warning) {
    setSyncStatus(warning, "warning");
  } else if (hasSyncUrl(currentSettings) && !hasSyncSecret(currentSettings)) {
    setSyncStatus("已填入 Apps Script URL。請輸入同步密鑰，否則不會連線或同步。", "warning");
  } else {
    setSyncStatus(
      hasSyncCredentials(currentSettings)
        ? "已填入 Apps Script URL 與同步密鑰，可儲存設定、測試連線或從 Google Sheet 同步。"
        : "尚未設定 Google Sheet，同步功能會先使用本機儲存。",
    );
  }
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function normalizeDateValue(value) {
  if (!value) return "";
  const text = String(value);
  const dateMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);
  return Number.isNaN(parsedDate.getTime()) ? text.slice(0, 10) : toDateInputValue(parsedDate);
}

function formatSelectedDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatWeekday(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    weekday: "short",
  }).format(date);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-TW", {
    maximumFractionDigits: 1,
  });
}

function parseOptionalNumber(input) {
  const value = Number(input.value);
  return input.value === "" || Number.isNaN(value) ? 0 : Math.max(0, value);
}

function shiftSelectedDate(days) {
  const date = new Date(`${elements.selectedDate.value}T00:00:00`);
  date.setDate(date.getDate() + days);
  elements.selectedDate.value = toDateInputValue(date);
  render();
}

function getEntriesForSelectedDate() {
  const query = elements.searchInput.value.trim().toLowerCase();
  return entries
    .filter((entry) => entry.date === elements.selectedDate.value)
    .filter((entry) => entry.foodName.toLowerCase().includes(query))
    .sort((a, b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType));
}

function getTotalsForSelectedDate() {
  return entries
    .filter((entry) => entry.date === elements.selectedDate.value)
    .reduce(
      (totals, entry) => ({
        calories: totals.calories + Number(entry.calories || 0),
        protein: totals.protein + Number(entry.protein || 0),
        carbs: totals.carbs + Number(entry.carbs || 0),
        fat: totals.fat + Number(entry.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

function getSevenDayTrend() {
  const endDate = new Date(`${elements.selectedDate.value}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (6 - index));
    const dateValue = toDateInputValue(date);
    const calories = entries
      .filter((entry) => entry.date === dateValue)
      .reduce((sum, entry) => sum + Number(entry.calories || 0), 0);

    return {
      date: dateValue,
      calories,
      isSelected: dateValue === elements.selectedDate.value,
    };
  });
}

function renderSummary() {
  const totals = getTotalsForSelectedDate();
  const goal = Number(settings.dailyGoal) || 0;
  const remaining = goal - totals.calories;
  const progress = goal > 0 ? Math.min((totals.calories / goal) * 100, 100) : 0;

  elements.totalCalories.textContent = formatNumber(totals.calories);
  elements.totalProtein.textContent = `${formatNumber(totals.protein)}g`;
  elements.totalCarbs.textContent = `${formatNumber(totals.carbs)}g`;
  elements.totalFat.textContent = `${formatNumber(totals.fat)}g`;
  elements.dailyGoal.value = goal;
  elements.remainingLabel.textContent = remaining >= 0 ? "剩餘熱量" : "超出熱量";
  elements.remainingCalories.textContent = `${formatNumber(Math.abs(remaining))} kcal`;
  elements.goalProgress.style.width = `${progress}%`;
  elements.goalProgress.classList.toggle("over", remaining < 0);
}

function renderTrendChart() {
  const trend = getSevenDayTrend();
  const total = trend.reduce((sum, day) => sum + day.calories, 0);
  const peak = Math.max(...trend.map((day) => day.calories), 0);
  const goal = Number(settings.dailyGoal) || 0;
  const hasData = trend.some((day) => day.calories > 0);

  elements.trendAverage.textContent = `${formatNumber(total / 7)} kcal`;
  elements.trendPeak.textContent = `${formatNumber(peak)} kcal`;
  elements.trendEmptyState.classList.toggle("hidden", hasData);

  const width = 760;
  const height = 240;
  const padding = { top: 26, right: 28, bottom: 48, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(peak, goal, 100);
  const scaleMax = Math.ceil((maxValue * 1.15) / 100) * 100;
  const barSlot = chartWidth / trend.length;
  const barWidth = Math.min(54, barSlot * 0.58);
  const goalY = padding.top + chartHeight - (Math.min(goal, scaleMax) / scaleMax) * chartHeight;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "近 7 日每日熱量長條圖");

  [0, 0.5, 1].forEach((ratio) => {
    const y = padding.top + chartHeight * ratio;
    const line = createSvgElement("line", {
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
      class: ratio === 1 ? "trend-axis" : "trend-grid-line",
    });
    svg.appendChild(line);
  });

  if (goal > 0) {
    svg.appendChild(
      createSvgElement("line", {
        x1: padding.left,
        x2: width - padding.right,
        y1: goalY,
        y2: goalY,
        class: "trend-goal-line",
      }),
    );
    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: width - padding.right,
          y: Math.max(14, goalY - 8),
          "text-anchor": "end",
          class: "trend-goal-label",
        },
        `目標 ${formatNumber(goal)} kcal`,
      ),
    );
  }

  trend.forEach((day, index) => {
    const x = padding.left + index * barSlot + (barSlot - barWidth) / 2;
    const barHeight = day.calories > 0 ? Math.max((day.calories / scaleMax) * chartHeight, 4) : 4;
    const y = padding.top + chartHeight - barHeight;
    const className = ["trend-bar", day.calories === 0 ? "empty" : "", day.isSelected ? "selected" : ""]
      .filter(Boolean)
      .join(" ");

    svg.appendChild(
      createSvgElement("rect", {
        x,
        y,
        width: barWidth,
        height: barHeight,
        rx: 7,
        class: className,
      }),
    );
    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: x + barWidth / 2,
          y: Math.max(14, y - 8),
          "text-anchor": "middle",
          class: "trend-value",
        },
        day.calories > 0 ? formatNumber(day.calories) : "",
      ),
    );
    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: x + barWidth / 2,
          y: padding.top + chartHeight + 22,
          "text-anchor": "middle",
          class: "trend-label",
        },
        formatWeekday(day.date),
      ),
    );
    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: x + barWidth / 2,
          y: padding.top + chartHeight + 40,
          "text-anchor": "middle",
          class: "trend-label",
        },
        formatShortDate(day.date),
      ),
    );
  });

  elements.trendChart.replaceChildren(svg);
}

function createSvgElement(tagName, attributes, textContent = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  element.textContent = textContent;
  return element;
}

function renderEntries() {
  const selectedEntries = getEntriesForSelectedDate();
  elements.mealGroups.replaceChildren();
  elements.logTitle.textContent = formatSelectedDate(elements.selectedDate.value);

  elements.emptyState.classList.toggle("hidden", selectedEntries.length > 0);

  mealOrder.forEach((mealType) => {
    const mealEntries = selectedEntries.filter((entry) => entry.mealType === mealType);
    if (mealEntries.length === 0) return;

    const section = document.createElement("section");
    section.className = "meal-section";

    const heading = document.createElement("h3");
    const mealTotal = mealEntries.reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
    heading.textContent = `${mealLabels[mealType]} · ${formatNumber(mealTotal)} kcal`;

    const list = document.createElement("div");
    list.className = "entry-list";

    mealEntries.forEach((entry) => list.appendChild(createEntryCard(entry)));
    section.append(heading, list);
    elements.mealGroups.appendChild(section);
  });
}

function createEntryCard(entry) {
  const card = elements.entryTemplate.content.firstElementChild.cloneNode(true);
  const title = card.querySelector("h3");
  const meta = card.querySelector(".entry-meta");
  const nutrition = card.querySelector(".entry-nutrition");
  const notes = card.querySelector(".entry-notes");
  const calories = card.querySelector("strong");
  const editButton = card.querySelector(".edit-button");
  const deleteButton = card.querySelector(".delete-button");

  title.textContent = entry.foodName;
  meta.textContent = entry.quantity ? `${entry.quantity} · ${mealLabels[entry.mealType]}` : mealLabels[entry.mealType];
  nutrition.textContent = getNutritionText(entry);
  nutrition.classList.toggle("hidden", !nutrition.textContent);
  notes.textContent = entry.notes;
  notes.classList.toggle("hidden", !entry.notes);
  calories.textContent = `${formatNumber(entry.calories)} kcal`;

  editButton.addEventListener("click", () => startEdit(entry.id));
  deleteButton.addEventListener("click", () => deleteEntry(entry.id));

  return card;
}

function getNutritionText(item) {
  const parts = [];
  if (Number(item.protein || 0) > 0) parts.push(`蛋白質 ${formatNumber(item.protein)}g`);
  if (Number(item.carbs || 0) > 0) parts.push(`碳水 ${formatNumber(item.carbs)}g`);
  if (Number(item.fat || 0) > 0) parts.push(`脂肪 ${formatNumber(item.fat)}g`);
  return parts.join(" · ");
}

function createIcon(name) {
  const svg = createSvgElement("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    "aria-hidden": "true",
    focusable: "false",
  });
  const iconElements = {
    plus: [
      ["line", { x1: "12", y1: "5", x2: "12", y2: "19" }],
      ["line", { x1: "5", y1: "12", x2: "19", y2: "12" }],
    ],
    trash: [
      ["path", { d: "M3 6h18" }],
      ["path", { d: "M8 6V4h8v2" }],
      ["path", { d: "M6 6l1 15h10l1-15" }],
      ["path", { d: "M10 11v6" }],
      ["path", { d: "M14 11v6" }],
    ],
  };

  iconElements[name].forEach(([tagName, attributes]) => {
    svg.appendChild(
      createSvgElement(tagName, {
        ...attributes,
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    );
  });
  return svg;
}

function renderFavorites() {
  const sortedFavorites = [...favorites].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant-TW"));

  elements.favoriteSelect.replaceChildren(new Option("選擇已儲存的食物", ""));
  sortedFavorites.forEach((favorite) => {
    elements.favoriteSelect.appendChild(new Option(`${favorite.name} · ${formatNumber(favorite.calories)} kcal`, favorite.id));
  });

  elements.favoriteList.replaceChildren();
  elements.favoriteCount.textContent = `${favorites.length} 項`;

  if (favorites.length === 0) {
    const empty = document.createElement("p");
    empty.className = "entry-meta";
    empty.textContent = "勾選「儲存為常吃食物」後，會出現在這裡。";
    elements.favoriteList.appendChild(empty);
    return;
  }

  sortedFavorites.forEach((favorite) => {
    const item = document.createElement("article");
    item.className = "favorite-item";

    const name = document.createElement("div");
    name.className = "favorite-name";
    const title = document.createElement("strong");
    title.textContent = favorite.name;
    const detail = document.createElement("span");
    detail.textContent = `${mealLabels[favorite.mealType]} · ${formatNumber(favorite.calories)} kcal`;
    name.append(title, detail);

    const applyButton = document.createElement("button");
    applyButton.className = "icon-action-button apply-favorite-button";
    applyButton.type = "button";
    applyButton.setAttribute("aria-label", `套用 ${favorite.name}`);
    applyButton.title = "套用";
    applyButton.appendChild(createIcon("plus"));
    applyButton.addEventListener("click", () => applyFavorite(favorite.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-action-button danger-button delete-favorite-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `刪除 ${favorite.name}`);
    deleteButton.title = "刪除";
    deleteButton.appendChild(createIcon("trash"));
    deleteButton.addEventListener("click", () => deleteFavorite(favorite.id));

    item.append(name, applyButton, deleteButton);
    elements.favoriteList.appendChild(item);
  });
}

function render() {
  renderSummary();
  renderTrendChart();
  renderEntries();
  renderFavorites();
  renderExportState();
}

function persistLocalData() {
  saveEntries();
  saveFavorites();
}

function renderExportState() {
  elements.exportCsvButton.disabled = entries.length === 0;
  if (entries.length === 0) {
    elements.exportStatus.textContent = "目前沒有可匯出的飲食紀錄。";
  } else if (!elements.exportStatus.textContent.includes("已匯出")) {
    elements.exportStatus.textContent = "";
  }
}

function resetForm() {
  editingId = null;
  elements.form.reset();
  elements.mealType.value = "breakfast";
  elements.favoriteSelect.value = "";
  elements.formTitle.textContent = "新增飲食紀錄";
  elements.cancelEditButton.classList.add("hidden");
}

function startEdit(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  elements.mealType.value = entry.mealType;
  elements.favoriteSelect.value = "";
  elements.foodName.value = entry.foodName;
  elements.calories.value = entry.calories;
  elements.protein.value = entry.protein || "";
  elements.carbs.value = entry.carbs || "";
  elements.fat.value = entry.fat || "";
  elements.quantity.value = entry.quantity ?? "";
  elements.notes.value = entry.notes ?? "";
  elements.saveFavorite.checked = false;
  elements.formTitle.textContent = "編輯飲食紀錄";
  elements.cancelEditButton.classList.remove("hidden");
  elements.foodName.focus();
}

async function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  const confirmed = window.confirm(`刪除「${entry.foodName}」這筆紀錄？`);
  if (!confirmed) return;

  entries = entries.filter((item) => item.id !== id);
  saveEntries();
  if (editingId === id) resetForm();
  render();
  await syncMutation("deleteEntry", { id }, "已刪除紀錄並同步到 Google Sheet。");
}

function getFormData() {
  return {
    date: elements.selectedDate.value,
    mealType: elements.mealType.value,
    foodName: elements.foodName.value.trim(),
    calories: parseOptionalNumber(elements.calories),
    protein: parseOptionalNumber(elements.protein),
    carbs: parseOptionalNumber(elements.carbs),
    fat: parseOptionalNumber(elements.fat),
    quantity: elements.quantity.value.trim(),
    notes: elements.notes.value.trim(),
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = getFormData();
  if (!formData.foodName || Number.isNaN(formData.calories)) return;
  let savedEntry;
  let savedFavorite = null;

  if (editingId) {
    entries = entries.map((entry) =>
      entry.id === editingId ? { ...entry, ...formData, updatedAt: new Date().toISOString() } : entry,
    );
    savedEntry = entries.find((entry) => entry.id === editingId);
  } else {
    savedEntry = {
      id: crypto.randomUUID(),
      ...formData,
      createdAt: new Date().toISOString(),
    };
    entries.push(savedEntry);
  }

  if (elements.saveFavorite.checked) {
    savedFavorite = upsertFavorite(formData);
  }

  saveEntries();
  resetForm();
  render();
  await syncMutation("upsertEntry", { entry: savedEntry }, "已儲存紀錄並同步到 Google Sheet。");
  if (savedFavorite) {
    await syncMutation("upsertFavorite", { favorite: savedFavorite }, "常吃食物已同步到 Google Sheet。");
  }
}

function upsertFavorite(formData) {
  const existing = favorites.find((favorite) => favorite.name.toLowerCase() === formData.foodName.toLowerCase());
  const favoriteData = {
    name: formData.foodName,
    mealType: formData.mealType,
    calories: formData.calories,
    protein: formData.protein,
    carbs: formData.carbs,
    fat: formData.fat,
    quantity: formData.quantity,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    favorites = favorites.map((favorite) => (favorite.id === existing.id ? { ...favorite, ...favoriteData } : favorite));
  } else {
    favorites.push({
      id: crypto.randomUUID(),
      ...favoriteData,
      createdAt: new Date().toISOString(),
    });
  }

  saveFavorites();
  return favorites.find((favorite) => favorite.name.toLowerCase() === formData.foodName.toLowerCase());
}

function applyFavorite(id) {
  const favorite = favorites.find((item) => item.id === id);
  if (!favorite) return;

  elements.favoriteSelect.value = id;
  elements.mealType.value = favorite.mealType;
  elements.foodName.value = favorite.name;
  elements.calories.value = favorite.calories;
  elements.protein.value = favorite.protein || "";
  elements.carbs.value = favorite.carbs || "";
  elements.fat.value = favorite.fat || "";
  elements.quantity.value = favorite.quantity ?? "";
  elements.notes.value = "";
  elements.foodName.focus();
}

async function deleteFavorite(id) {
  const favorite = favorites.find((item) => item.id === id);
  if (!favorite) return;

  const confirmed = window.confirm(`從常吃食物刪除「${favorite.name}」？`);
  if (!confirmed) return;

  favorites = favorites.filter((item) => item.id !== id);
  saveFavorites();
  renderFavorites();
  await syncMutation("deleteFavorite", { id }, "已刪除常吃食物並同步到 Google Sheet。");
}

async function syncMutation(action, payload, successMessage) {
  const currentSettings = getSyncSettingsFromInputs();
  if (!hasSyncUrl(currentSettings)) return;
  if (!hasSyncSecret(currentSettings)) {
    renderSyncAvailability();
    return;
  }

  try {
    setSyncStatus("正在同步到 Google Sheet...");
    await sheetPost(action, payload);
    setSyncStatus(successMessage, "ok");
  } catch (error) {
    setSyncStatus(`同步失敗，資料已暫存在本機。${error.message}`, "warning");
  }
}

async function saveSyncSettingsFromInput() {
  const currentSettings = getSyncSettingsFromInputs();
  syncSettings.scriptUrl = currentSettings.scriptUrl;
  syncSettings.sharedSecret = currentSettings.sharedSecret;
  saveSyncSettings();
  renderSyncAvailability();
}

async function testSheetConnection() {
  const currentSettings = getSyncSettingsFromInputs();
  if (!hasSyncCredentials(currentSettings)) {
    renderSyncAvailability();
    return;
  }

  try {
    setSyncStatus("正在測試 Google Sheet 連線...");
    const data = await sheetGet("ping");
    const sheetLink = data?.spreadsheetUrl ? ` 試算表：${data.spreadsheetUrl}` : "";
    setSyncStatus(`Google Sheet 連線成功。${sheetLink}`, "ok");
  } catch (error) {
    setSyncStatus(`連線失敗：${error.message}`, "warning");
  }
}

async function syncFromSheet() {
  const currentSettings = getSyncSettingsFromInputs();
  if (!hasSyncCredentials(currentSettings)) {
    renderSyncAvailability();
    return;
  }

  try {
    setSyncStatus("正在從 Google Sheet 載入資料...");
    const [sheetEntries, sheetFavorites] = await Promise.all([sheetGet("listEntries"), sheetGet("listFavorites")]);
    const remoteEntries = normalizeEntries(sheetEntries);
    const remoteFavorites = normalizeFavorites(sheetFavorites);
    entries = mergeById(entries, remoteEntries);
    favorites = mergeById(favorites, remoteFavorites);
    persistLocalData();
    render();
    setSyncStatus(
      `已從 Google Sheet 同步 ${remoteEntries.length} 筆紀錄、${remoteFavorites.length} 個常吃食物。本機目前共有 ${entries.length} 筆紀錄。`,
      "ok",
    );
  } catch (error) {
    setSyncStatus(`同步失敗，繼續使用本機資料。${error.message}`, "warning");
  }
}

function normalizeEntries(items) {
  return (Array.isArray(items) ? items : [])
    .filter((entry) => entry && entry.id)
    .map((entry) => ({
      id: entry.id,
      date: normalizeDateValue(entry.date),
      mealType: entry.mealType,
      foodName: entry.foodName,
      calories: Number(entry.calories || 0),
      protein: Number(entry.protein || 0),
      carbs: Number(entry.carbs || 0),
      fat: Number(entry.fat || 0),
      quantity: entry.quantity || "",
      notes: entry.notes || "",
      createdAt: entry.createdAt || "",
      updatedAt: entry.updatedAt || "",
    }));
}

function normalizeFavorites(items) {
  return (Array.isArray(items) ? items : [])
    .filter((favorite) => favorite && favorite.id)
    .map((favorite) => ({
      id: favorite.id,
      name: favorite.name,
      mealType: favorite.mealType,
      calories: Number(favorite.calories || 0),
      protein: Number(favorite.protein || 0),
      carbs: Number(favorite.carbs || 0),
      fat: Number(favorite.fat || 0),
      quantity: favorite.quantity || "",
      createdAt: favorite.createdAt || "",
      updatedAt: favorite.updatedAt || "",
    }));
}

function mergeById(localItems, remoteItems) {
  const merged = new Map();
  localItems.forEach((item) => {
    if (item?.id) merged.set(item.id, item);
  });
  remoteItems.forEach((item) => {
    if (item?.id) merged.set(item.id, item);
  });
  return [...merged.values()];
}

async function exportEntriesToCsv() {
  if (entries.length === 0) {
    elements.exportStatus.textContent = "目前沒有可匯出的飲食紀錄。";
    return;
  }

  const headers = [
    "日期",
    "餐別",
    "食物名稱",
    "熱量(kcal)",
    "蛋白質(g)",
    "碳水(g)",
    "脂肪(g)",
    "份量",
    "備註",
    "建立時間",
    "更新時間",
  ];
  const rows = [...entries]
    .sort((a, b) => `${a.date}-${mealOrder.indexOf(a.mealType)}`.localeCompare(`${b.date}-${mealOrder.indexOf(b.mealType)}`))
    .map((entry) => [
      entry.date,
      mealLabels[entry.mealType] ?? entry.mealType,
      entry.foodName,
      entry.calories ?? 0,
      entry.protein ?? 0,
      entry.carbs ?? 0,
      entry.fat ?? 0,
      entry.quantity ?? "",
      entry.notes ?? "",
      entry.createdAt ?? "",
      entry.updatedAt ?? "",
    ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const csvWithBom = `\uFEFF${csv}`;
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8" });
  const today = toDateInputValue(new Date());
  const filename = `飲食紀錄-${today}.csv`;

  const savedWithFilePicker = await trySaveCsvFile(blob, filename);

  if (savedWithFilePicker) {
    elements.exportStatus.textContent = `已儲存 ${entries.length} 筆飲食紀錄。`;
    return;
  }

  triggerCsvDownload(csvWithBom, filename);
  elements.exportStatus.textContent = `已匯出 ${entries.length} 筆飲食紀錄。`;
}

async function trySaveCsvFile(blob, filename) {
  if (!("showSaveFilePicker" in window)) {
    return false;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "CSV 檔案",
          accept: { "text/csv": [".csv"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    return false;
  }
}

function triggerCsvDownload(csvText, filename) {
  const link = document.createElement("a");
  link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvText)}`;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function handleGoalInput() {
  settings.dailyGoal = Math.max(0, Number(elements.dailyGoal.value) || 0);
  saveSettings();
  renderSummary();
  renderTrendChart();
}

function init() {
  elements.selectedDate.value = toDateInputValue(new Date());
  elements.dailyGoal.value = settings.dailyGoal;
  renderSyncSettings();
  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.dailyGoal.addEventListener("input", handleGoalInput);
  elements.saveSyncSettingsButton.addEventListener("click", saveSyncSettingsFromInput);
  elements.testSyncButton.addEventListener("click", testSheetConnection);
  elements.syncFromSheetButton.addEventListener("click", syncFromSheet);
  elements.scriptUrlInput.addEventListener("input", renderSyncAvailability);
  elements.syncSecretInput.addEventListener("input", renderSyncAvailability);
  elements.favoriteSelect.addEventListener("change", (event) => {
    if (event.target.value) applyFavorite(event.target.value);
  });
  elements.selectedDate.addEventListener("change", () => {
    resetForm();
    render();
  });
  elements.searchInput.addEventListener("input", renderEntries);
  elements.exportCsvButton.addEventListener("click", exportEntriesToCsv);
  elements.prevDayButton.addEventListener("click", () => shiftSelectedDate(-1));
  elements.nextDayButton.addEventListener("click", () => shiftSelectedDate(1));
  render();
  if (hasSyncCredentials(getSyncSettingsFromInputs())) {
    syncFromSheet();
  }
}

init();
