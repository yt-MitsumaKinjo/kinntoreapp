// 月間カレンダー画面のロジック

import * as db from './db.js';
import { showDayDetail } from './calendar.js';
import {
  toDateString, todayString, getMonthGridStart, getMonthGridEnd,
} from './utils.js';

let currentMonthDate = new Date(); // この月の1日を指す日付として使う
let bodyPartsById = {};

export async function initMonthCalendar() {
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

  await refreshMonthCalendar();
}

function changeMonth(delta) {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + delta, 1);
  renderMonth();
}

// 種目管理・記録の保存後などに呼ぶと、部位データを取り直して再描画する
export async function refreshMonthCalendar() {
  const bodyParts = await db.getBodyParts();
  bodyPartsById = Object.fromEntries(bodyParts.map((bp) => [bp.id, bp]));
  await renderMonth();
}

async function renderMonth() {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  document.getElementById('month-label').textContent = `${year}年${month + 1}月`;

  const gridStart = getMonthGridStart(year, month);
  const gridEnd = getMonthGridEnd(year, month);

  const records = await db.getRecordsByDateRange(toDateString(gridStart), toDateString(gridEnd));

  // 日付ごとに、その日にやった部位id一覧（重複なし）を作る
  const bodyPartsByDate = {};
  records.forEach((rec) => {
    if (!bodyPartsByDate[rec.date]) bodyPartsByDate[rec.date] = [];
    if (!bodyPartsByDate[rec.date].includes(rec.bodyPartId)) {
      bodyPartsByDate[rec.date].push(rec.bodyPartId);
    }
  });

  const today = todayString();
  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateStr = toDateString(cursor);
    const isOtherMonth = cursor.getMonth() !== month;

    const cell = document.createElement('button');
    cell.className = 'month-day-cell'
      + (dateStr === today ? ' is-today' : '')
      + (isOtherMonth ? ' is-other-month' : '');

    const dayNumber = document.createElement('div');
    dayNumber.className = 'month-day-number';
    dayNumber.textContent = cursor.getDate();
    cell.appendChild(dayNumber);

    const icons = document.createElement('div');
    icons.className = 'month-day-icons';
    (bodyPartsByDate[dateStr] || []).forEach((bpId) => {
      const bp = bodyPartsById[bpId];
      if (!bp) return;
      const img = document.createElement('img');
      img.src = bp.icon;
      img.alt = bp.name;
      icons.appendChild(img);
    });
    cell.appendChild(icons);

    cell.addEventListener('click', () => showDayDetail(dateStr));
    grid.appendChild(cell);

    cursor.setDate(cursor.getDate() + 1);
  }
}
