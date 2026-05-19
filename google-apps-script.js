const SPREADSHEET_NAME = "個人飲食紀錄資料庫";
const SPREADSHEET_ID_PROPERTY = "FOOD_LOG_SPREADSHEET_ID";
const SHARED_SECRET_PROPERTY = "FOOD_LOG_SHARED_SECRET";

const SHEETS = {
  entries: {
    name: "FoodEntries",
    headers: [
      "id",
      "date",
      "mealType",
      "foodName",
      "calories",
      "protein",
      "carbs",
      "fat",
      "quantity",
      "notes",
      "createdAt",
      "updatedAt",
    ],
  },
  favorites: {
    name: "FavoriteFoods",
    headers: [
      "id",
      "name",
      "mealType",
      "calories",
      "protein",
      "carbs",
      "fat",
      "quantity",
      "createdAt",
      "updatedAt",
    ],
  },
};

function doGet(event) {
  try {
    assertAuthorized(event.parameter.sharedSecret);
    const spreadsheet = ensureSheets();
    const action = event.parameter.action;

    if (action === "ping") {
      return jsonResponse({
        ok: true,
        data: {
          message: "connected",
          spreadsheetId: spreadsheet.getId(),
          spreadsheetUrl: spreadsheet.getUrl(),
        },
      });
    }

    if (action === "listEntries") {
      return jsonResponse({ ok: true, data: readSheetObjects(spreadsheet, SHEETS.entries) });
    }

    if (action === "listFavorites") {
      return jsonResponse({ ok: true, data: readSheetObjects(spreadsheet, SHEETS.favorites) });
    }

    return jsonResponse({ ok: false, error: "Unknown GET action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    assertAuthorized(body.sharedSecret);
    const spreadsheet = ensureSheets();
    const action = body.action;

    if (action === "upsertEntry") {
      upsertRow(spreadsheet, SHEETS.entries, body.entry);
      return jsonResponse({ ok: true, data: body.entry });
    }

    if (action === "deleteEntry") {
      deleteRowById(spreadsheet, SHEETS.entries, body.id);
      return jsonResponse({ ok: true, data: { id: body.id } });
    }

    if (action === "upsertFavorite") {
      upsertRow(spreadsheet, SHEETS.favorites, body.favorite);
      return jsonResponse({ ok: true, data: body.favorite });
    }

    if (action === "deleteFavorite") {
      deleteRowById(spreadsheet, SHEETS.favorites, body.id);
      return jsonResponse({ ok: true, data: { id: body.id } });
    }

    return jsonResponse({ ok: false, error: "Unknown POST action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function assertAuthorized(sharedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty(SHARED_SECRET_PROPERTY);
  if (!expectedSecret) return;

  if (String(sharedSecret || "") !== expectedSecret) {
    throw new Error("Unauthorized");
  }
}

function ensureSheets() {
  const spreadsheet = getOrCreateSpreadsheet();
  Object.values(SHEETS).forEach((config) => {
    let sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(config.name);
    }

    const existingHeaders = sheet.getRange(1, 1, 1, config.headers.length).getValues()[0];
    const needsHeaders = config.headers.some((header, index) => existingHeaders[index] !== header);
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
    }
  });

  return spreadsheet;
}

function getOrCreateSpreadsheet() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, activeSpreadsheet.getId());
    return activeSpreadsheet;
  }

  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty(SPREADSHEET_ID_PROPERTY);

  if (storedId) {
    try {
      return SpreadsheetApp.openById(storedId);
    } catch (error) {
      properties.deleteProperty(SPREADSHEET_ID_PROPERTY);
    }
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  return spreadsheet;
}

function readSheetObjects(spreadsheet, config) {
  const sheet = spreadsheet.getSheetByName(config.name);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, config.headers.length).getValues();
  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      config.headers.reduce((object, header, index) => {
        object[header] = normalizeValue(header, row[index]);
        return object;
      }, {}),
    );
}

function upsertRow(spreadsheet, config, item) {
  if (!item || !item.id) {
    throw new Error("Missing item id");
  }

  const sheet = spreadsheet.getSheetByName(config.name);
  const rowIndex = findRowById(sheet, item.id);
  const values = config.headers.map((header) => (item[header] === undefined || item[header] === null ? "" : item[header]));

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, config.headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function deleteRowById(spreadsheet, config, id) {
  if (!id) {
    throw new Error("Missing id");
  }

  const sheet = spreadsheet.getSheetByName(config.name);
  const rowIndex = findRowById(sheet, id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
  }
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = ids.findIndex((row) => row[0] === id);
  return index >= 0 ? index + 2 : -1;
}

function normalizeValue(header, value) {
  if (["calories", "protein", "carbs", "fat"].includes(header)) {
    return Number(value) || 0;
  }

  if (header === "date") {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return String(value || "").slice(0, 10);
  }

  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  }

  return value;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
