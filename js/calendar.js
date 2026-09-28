// ホーム画面（週間カレンダー）のロジック

import * as db from './db.js';
import { showScreen, showToast, confirmDialog } from './ui.js';
import {
  toDateString, todayString, getWeekStart, getWeekDates,
  formatMonthDay, formatYearMonthDayJa, WEEKDAY_LABELS_JA, formatRestSeconds,
  computeStreakDays, nowTimeString, diffMinutes, formatDurationMinutes,
} from './utils.js';
import { openEditRecord } from './record.js';

let currentWeekStart = getWeekStart(new Date());
let bodyPartsList = [];
let bodyPartsById = {};
let exercisesById = {};
let currentDetailDate = null;

export async function initCalendar() {
  document.getElementById('prev-week').addEventListener('click', () => changeWeek(-7));
  document.getElementById('next-week').addEventListener('click', () => changeWeek(7));

  // スワイプでの週切り替え
  const grid = document.getElementById('calendar-grid');
  let touchStartX = null;
  grid.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  grid.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) {
      changeWeek(diff > 0 ? -7 : 7);
    }
    touchStartX = null;
  });

  document.getElementById('session-start-time').addEventListener('change', () => handleSessionTimeInputChange('start'));
  document.getElementById('session-end-time').addEventListener('change', () => handleSessionTimeInputChange('end'));
  document.getElementById('session-reset-btn').addEventListener('click', handleSessionReset);

  await refreshCalendar();
}

function changeWeek(days) {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + days);
  currentWeekStart = d;
  renderWeek();
}

// 種目管理・記録の保存後などに呼ぶと、部位/種目データを取り直して再描画する
export async function refreshCalendar() {
  const [bodyParts, exercises] = await Promise.all([db.getBodyParts(), db.getExercises()]);
  bodyPartsList = bodyParts;
  bodyPartsById = Object.fromEntries(bodyParts.map((bp) => [bp.id, bp]));
  exercisesById = Object.fromEntries(exercises.map((ex) => [ex.id, ex]));
  await renderWeek();
}

async function renderWeek() {
  const weekDates = getWeekDates(currentWeekStart);
  const startStr = toDateString(weekDates[0]);
  const endStr = toDateString(weekDates[6]);

  document.getElementById('week-label').textContent =
    `${formatMonthDay(weekDates[0])} 〜 ${formatMonthDay(weekDates[6])}`;

  const records = await db.getRecordsByDateRange(startStr, endStr);

  // 日付ごとに、その日にやった部位id一覧（重複なし）を作る
  const bodyPartsByDate = {};
  records.forEach((rec) => {
    if (!bodyPartsByDate[rec.date]) bodyPartsByDate[rec.date] = [];
    if (!bodyPartsByDate[rec.date].includes(rec.bodyPartId)) {
      bodyPartsByDate[rec.date].push(rec.bodyPartId);
    }
  });

  const today = todayString();
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  weekDates.forEach((date, i) => {
    const dateStr = toDateString(date);
    const cell = document.createElement('button');
    cell.className = 'day-cell' + (dateStr === today ? ' is-today' : '');

    const weekdayLabel = document.createElement('div');
    weekdayLabel.className = 'weekday-label';
    weekdayLabel.textContent = WEEKDAY_LABELS_JA[i];

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();

    const icons = document.createElement('div');
    icons.className = 'day-icons';
    (bodyPartsByDate[dateStr] || []).forEach((bpId) => {
      const bp = bodyPartsById[bpId];
      if (!bp) return;
      const img = document.createElement('img');
      img.src = bp.icon;
      img.alt = bp.name;
      icons.appendChild(img);
    });

    cell.appendChild(weekdayLabel);
    cell.appendChild(dayNumber);
    cell.appendChild(icons);

    cell.addEventListener('click', () => showDayDetail(dateStr));
    grid.appendChild(cell);
  });

  await renderMonthSummary(weekDates);
}

// 表示中の週が含まれる「月」の部位別トレーニング日数と、連続記録日数を表示する
async function renderMonthSummary(weekDates) {
  // 週の最初の日(月曜)が属する月を対象にする
  const baseDate = weekDates[0];
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-11
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  document.getElementById('summary-title').textContent = isCurrentMonth
    ? '今月の記録'
    : `${month + 1}月の記録`;

  const monthRecords = await db.getRecordsByDateRange(toDateString(monthStart), toDateString(monthEnd));

  // 部位ごとに、この月のうち何日トレーニングしたか（同じ日の複数種目は1日として数える）
  const datesByBodyPart = {};
  monthRecords.forEach((rec) => {
    if (!datesByBodyPart[rec.bodyPartId]) datesByBodyPart[rec.bodyPartId] = new Set();
    datesByBodyPart[rec.bodyPartId].add(rec.date);
  });

  const chipsContainer = document.getElementById('summary-chips');
  chipsContainer.innerHTML = '';
  bodyPartsList.forEach((bp) => {
    const count = datesByBodyPart[bp.id] ? datesByBodyPart[bp.id].size : 0;
    const chip = document.createElement('div');
    chip.className = 'summary-chip' + (count === 0 ? ' zero' : '');

    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = `${bp.name} x${count}`;
    chip.appendChild(countSpan);

    chipsContainer.appendChild(chip);
  });

  // 連続記録日数（全期間の記録から計算）
  const allRecords = await db.getAllRecords();
  const allDates = new Set(allRecords.map((rec) => rec.date));
  const streak = computeStreakDays(allDates);
  document.getElementById('streak-count').textContent = streak;
}

// 日付単位のトレーニング開始・終了時刻(入力欄+ボタン)の表示を更新する
async function renderTrainingTimeSection(dateStr) {
  const session = await db.getDailySession(dateStr);

  document.getElementById('session-start-time').value = session.startTime || '';
  document.getElementById('session-end-time').value = session.endTime || '';

  const actionBtn = document.getElementById('session-action-btn');
  const durationRow = document.getElementById('session-duration-row');
  const durationText = document.getElementById('session-duration-text');

  if (!session.startTime) {
    actionBtn.textContent = '▶ トレーニング開始';
    actionBtn.className = 'session-action-btn is-start';
    actionBtn.style.display = 'block';
    actionBtn.onclick = async () => {
      await db.saveDailySession(dateStr, nowTimeString(), session.endTime);
      await renderTrainingTimeSection(dateStr);
    };
  } else if (!session.endTime) {
    actionBtn.textContent = '⏹ トレーニング終了';
    actionBtn.className = 'session-action-btn is-end';
    actionBtn.style.display = 'block';
    actionBtn.onclick = async () => {
      await db.saveDailySession(dateStr, session.startTime, nowTimeString());
      await renderTrainingTimeSection(dateStr);
    };
  } else {
    actionBtn.style.display = 'none';
    actionBtn.onclick = null;
  }

  if (session.startTime && session.endTime) {
    const minutes = diffMinutes(session.startTime, session.endTime);
    durationText.textContent = `🕐 トレーニング時間：${formatDurationMinutes(minutes)}`;
    durationRow.style.display = 'flex';
  } else {
    durationRow.style.display = 'none';
  }
}

// 開始・終了時刻の入力欄を手動で編集したときに呼ばれる
async function handleSessionTimeInputChange(which) {
  if (!currentDetailDate) return;
  const session = await db.getDailySession(currentDetailDate);
  const startTime = which === 'start' ? (document.getElementById('session-start-time').value || null) : session.startTime;
  const endTime = which === 'end' ? (document.getElementById('session-end-time').value || null) : session.endTime;
  await db.saveDailySession(currentDetailDate, startTime, endTime);
  await renderTrainingTimeSection(currentDetailDate);
}

async function handleSessionReset() {
  if (!currentDetailDate) return;
  if (!confirmDialog('トレーニング時間をリセットしますか？')) return;
  await db.saveDailySession(currentDetailDate, null, null);
  await renderTrainingTimeSection(currentDetailDate);
}

export async function showDayDetail(dateStr) {
  showScreen('day-detail');
  currentDetailDate = dateStr;
  const dateObj = new Date(dateStr + 'T00:00:00');
  document.getElementById('day-detail-date').textContent = formatYearMonthDayJa(dateObj);

  await renderTrainingTimeSection(dateStr);

  const listEl = document.getElementById('day-detail-list');
  listEl.innerHTML = '';

  const records = await db.getRecordsByDate(dateStr);

  if (records.length === 0) {
    listEl.innerHTML = '<p class="hint-text">この日の記録はまだありません。</p>';
    return;
  }

  records.forEach((rec) => {
    const bp = bodyPartsById[rec.bodyPartId];
    const exercise = exercisesById[rec.exerciseId];

    const card = document.createElement('div');
    card.className = 'record-card';

    const header = document.createElement('div');
    header.className = 'record-card-header';
    if (bp) {
      const img = document.createElement('img');
      img.src = bp.icon;
      img.alt = bp.name;
      header.appendChild(img);
    }
    const name = document.createElement('div');
    name.className = 'exercise-name';
    name.textContent = exercise ? exercise.name : '(削除済みの種目)';
    header.appendChild(name);
    card.appendChild(header);

    rec.sets.forEach((set, i) => {
      const row = document.createElement('div');
      row.className = 'set-row';
      let text = `${i + 1}セット目: ${set.weight}kg × ${set.reps}回`;
      const restLabel = formatRestSeconds(set.restSeconds);
      if (restLabel) text += `（休憩 ${restLabel}）`;
      row.textContent = text;
      card.appendChild(row);
    });

    const actions = document.createElement('div');
    actions.className = 'record-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      if (exercise) openEditRecord(rec, exercise);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '削除';
    deleteBtn.addEventListener('click', async () => {
      if (!confirmDialog('この記録を削除しますか？')) return;
      await db.deleteRecord(rec.id);
      showToast('削除しました');
      await refreshCalendar();
      await showDayDetail(dateStr);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    listEl.appendChild(card);
  });
}
