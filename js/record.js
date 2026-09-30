// 「登録」ボタンから始まる、種目選択 → セット入力 → 保存のロジック

import * as db from './db.js';
import { showScreen, showToast } from './ui.js';
import { todayString, sortByBodyPartOrder } from './utils.js';
import { refreshCalendar, getCurrentDetailDate } from './calendar.js';

let allBodyParts = [];
let allExercises = [];
let selectedFilterBodyPartId = 'all';
let selectedDate = null; // 種目選択→セット入力に引き継ぐ、登録先の日付

let currentExercise = null;
let editingRecordId = null; // nullなら新規登録、値があれば編集中の記録id
let activeTimerIds = new Set(); // 動いている休憩タイマーのsetInterval ID一覧

export async function initRecordFlow() {
  document.getElementById('fab-add').addEventListener('click', () => {
    // 日別詳細画面から押した場合はその日付、カレンダー画面からなら今日の日付を使う
    openExerciseSelect(getCurrentDetailDate());
  });

  document.getElementById('add-set-btn').addEventListener('click', () => addSetRow());
  document.getElementById('save-record-btn').addEventListener('click', saveRecord);
}

// ===== ③ 種目選択画面（部位ごとの色付きタイル表示） =====

export async function openExerciseSelect(dateStr) {
  selectedDate = dateStr || todayString();
  showScreen('exercise-select');
  [allBodyParts, allExercises] = await Promise.all([db.getBodyParts(), db.getExercises()]);
  selectedFilterBodyPartId = 'all';
  renderBodyPartFilter();
  renderExerciseList();
}

function renderBodyPartFilter() {
  const container = document.getElementById('bodypart-filter');
  container.innerHTML = '';

  const allChip = makeFilterChip('すべて', null, null, selectedFilterBodyPartId === 'all');
  allChip.addEventListener('click', () => {
    selectedFilterBodyPartId = 'all';
    renderBodyPartFilter();
    renderExerciseList();
  });
  container.appendChild(allChip);

  allBodyParts.forEach((bp) => {
    const chip = makeFilterChip(bp.name, bp.icon, bp.color, selectedFilterBodyPartId === bp.id);
    chip.addEventListener('click', () => {
      selectedFilterBodyPartId = bp.id;
      renderBodyPartFilter();
      renderExerciseList();
    });
    container.appendChild(chip);
  });
}

function makeFilterChip(label, iconSrc, color, isActive) {
  const chip = document.createElement('button');
  chip.className = 'filter-chip' + (isActive ? ' active' : '');
  if (isActive && color) {
    chip.style.background = color;
    chip.style.borderColor = color;
  }
  if (iconSrc) {
    const img = document.createElement('img');
    img.src = iconSrc;
    chip.appendChild(img);
  }
  const span = document.createElement('span');
  span.textContent = label;
  chip.appendChild(span);
  return chip;
}

function renderExerciseList() {
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';

  const bodyPartsById = Object.fromEntries(allBodyParts.map((bp) => [bp.id, bp]));
  let filtered = allExercises.filter(
    (ex) => selectedFilterBodyPartId === 'all' || ex.bodyPartId === selectedFilterBodyPartId
  );

  if (filtered.length === 0) {
    list.innerHTML = '<p class="hint-text">この部位の種目はまだ登録されていません。「種目管理」から追加できます。</p>';
    return;
  }

  // 「すべて」の時は、胸→背中→肩→二頭筋→三頭筋→腹筋→脚の順にまとめて表示する
  if (selectedFilterBodyPartId === 'all') {
    filtered = sortByBodyPartOrder(filtered, (ex) => ex.bodyPartId);
  }

  filtered.forEach((ex) => {
    const bp = bodyPartsById[ex.bodyPartId];
    const tile = document.createElement('button');
    tile.className = 'exercise-tile';
    if (bp) tile.style.background = bp.color;

    if (bp) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'exercise-tile-icon';
      const img = document.createElement('img');
      img.src = bp.icon;
      img.alt = bp.name;
      iconWrap.appendChild(img);
      tile.appendChild(iconWrap);
    }
    const span = document.createElement('span');
    span.className = 'exercise-tile-label';
    span.textContent = ex.name;
    tile.appendChild(span);

    tile.addEventListener('click', () => openSetInput(ex, { date: selectedDate }));
    list.appendChild(tile);
  });
}

// ===== ④ セット入力画面 =====

function openSetInput(exercise, { date, sets, recordId } = {}) {
  currentExercise = exercise;
  editingRecordId = recordId || null;
  stopAllTimers();

  showScreen('set-input');
  document.getElementById('set-input-title').textContent = exercise.name;
  document.getElementById('record-date').value = date || todayString();

  const container = document.getElementById('sets-container');
  container.innerHTML = '';

  const initialSets = sets && sets.length > 0 ? sets : [{ weight: '', reps: '', restSeconds: null }];
  initialSets.forEach((set) => addSetRow(set));
}

// 編集ボタンから呼ばれる（calendar.jsから利用）
export function openEditRecord(record, exercise) {
  openSetInput(exercise, {
    date: record.date,
    sets: record.sets,
    recordId: record.id,
  });
}

function addSetRow(prefill) {
  const container = document.getElementById('sets-container');
  const index = container.children.length;

  // 直前のセットの値を初期値として引き継ぐ（重量・回数・休憩時間とも）
  const prev = container.children[index - 1];
  const prevWeight = prev ? prev.querySelector('.weight-input').value : '';
  const prevReps = prev ? prev.querySelector('.reps-input').value : '';
  const prevRestMin = prev ? prev.querySelector('.rest-min-input').value : '';
  const prevRestSec = prev ? prev.querySelector('.rest-sec-input').value : '';

  const restMin = prefill && prefill.restSeconds ? Math.floor(prefill.restSeconds / 60) : '';
  const restSec = prefill && prefill.restSeconds ? prefill.restSeconds % 60 : '';

  const row = document.createElement('div');
  row.className = 'set-row-input';

  // 上段：セット番号 + 削除ボタン
  const top = document.createElement('div');
  top.className = 'set-row-top';

  const label = document.createElement('div');
  label.className = 'set-index';
  label.textContent = `${index + 1}セット目`;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-set-btn';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    stopRowTimer(row);
    row.remove();
    renumberSetRows();
  });

  top.appendChild(label);
  top.appendChild(removeBtn);

  // 中段：重量・回数
  const main = document.createElement('div');
  main.className = 'set-row-main';

  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.inputMode = 'decimal';
  weightInput.step = '0.5';
  weightInput.placeholder = '重量';
  weightInput.className = 'weight-input';
  weightInput.value = prefill && prefill.weight !== '' ? prefill.weight : prevWeight;

  const repsInput = document.createElement('input');
  repsInput.type = 'number';
  repsInput.inputMode = 'numeric';
  repsInput.placeholder = '回数';
  repsInput.className = 'reps-input';
  repsInput.value = prefill && prefill.reps !== '' ? prefill.reps : prevReps;

  main.appendChild(makeInputGroup(weightInput, 'kg'));
  main.appendChild(makeInputGroup(repsInput, '回'));

  // 下段：セット間の休憩時間
  const rest = document.createElement('div');
  rest.className = 'set-row-rest';

  const restLabel = document.createElement('span');
  restLabel.className = 'rest-label';
  restLabel.textContent = '休憩';

  const restMinInput = document.createElement('input');
  restMinInput.type = 'number';
  restMinInput.inputMode = 'numeric';
  restMinInput.placeholder = '0';
  restMinInput.className = 'rest-min-input';
  restMinInput.value = restMin !== '' ? restMin : prevRestMin;

  const restSecInput = document.createElement('input');
  restSecInput.type = 'number';
  restSecInput.inputMode = 'numeric';
  restSecInput.placeholder = '0';
  restSecInput.className = 'rest-sec-input';
  restSecInput.value = restSec !== '' ? restSec : prevRestSec;

  const timerBtn = document.createElement('button');
  timerBtn.type = 'button';
  timerBtn.className = 'rest-timer-btn';
  timerBtn.textContent = '▶ 計測';
  timerBtn.addEventListener('click', () => toggleRowTimer(row, timerBtn, restMinInput, restSecInput));

  rest.appendChild(restLabel);
  rest.appendChild(restMinInput);
  rest.appendChild(document.createTextNode('分'));
  rest.appendChild(restSecInput);
  rest.appendChild(document.createTextNode('秒'));
  rest.appendChild(timerBtn);

  row.appendChild(top);
  row.appendChild(main);
  row.appendChild(rest);

  container.appendChild(row);
}

// 休憩タイマーの開始/停止を切り替える。停止時に経過時間を分・秒欄へ自動入力する
function toggleRowTimer(row, btn, minInput, secInput) {
  if (row._timerId) {
    stopRowTimer(row, { fillInputs: true, minInput, secInput });
    return;
  }

  row._timerStart = Date.now();
  btn.textContent = '■ 0:00';
  btn.classList.add('running');

  row._timerId = setInterval(() => {
    const elapsed = Math.round((Date.now() - row._timerStart) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    btn.textContent = `■ ${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
  activeTimerIds.add(row._timerId);
}

// 指定した行のタイマーを止める（保存/画面遷移時の後片付けにも使う）
function stopRowTimer(row, { fillInputs = false, minInput, secInput } = {}) {
  if (!row._timerId) return;

  clearInterval(row._timerId);
  activeTimerIds.delete(row._timerId);

  if (fillInputs) {
    const elapsedSec = Math.max(0, Math.round((Date.now() - row._timerStart) / 1000));
    minInput.value = Math.floor(elapsedSec / 60);
    secInput.value = elapsedSec % 60;
  }

  const btn = row.querySelector('.rest-timer-btn');
  if (btn) {
    btn.textContent = '▶ 計測';
    btn.classList.remove('running');
  }

  row._timerId = null;
}

// 画面を離れる時などに、動いているタイマーを全部止める
function stopAllTimers() {
  const container = document.getElementById('sets-container');
  Array.from(container.children).forEach((row) => stopRowTimer(row));
  activeTimerIds.forEach((id) => clearInterval(id));
  activeTimerIds.clear();
}

function makeInputGroup(inputEl, unitLabel) {
  const group = document.createElement('div');
  group.className = 'input-group';
  group.appendChild(inputEl);
  const unit = document.createElement('span');
  unit.className = 'unit';
  unit.textContent = unitLabel;
  group.appendChild(unit);
  return group;
}

function renumberSetRows() {
  const container = document.getElementById('sets-container');
  Array.from(container.children).forEach((row, i) => {
    row.querySelector('.set-index').textContent = `${i + 1}セット目`;
  });
}

async function saveRecord() {
  stopAllTimers();
  const container = document.getElementById('sets-container');
  const rows = Array.from(container.children);

  const sets = rows
    .map((row) => {
      const min = parseInt(row.querySelector('.rest-min-input').value, 10) || 0;
      const sec = parseInt(row.querySelector('.rest-sec-input').value, 10) || 0;
      const restSeconds = min * 60 + sec;
      return {
        weight: parseFloat(row.querySelector('.weight-input').value),
        reps: parseInt(row.querySelector('.reps-input').value, 10),
        restSeconds: restSeconds > 0 ? restSeconds : null,
      };
    })
    .filter((set) => !isNaN(set.weight) && !isNaN(set.reps));

  if (sets.length === 0) {
    showToast('重量と回数を入力してください');
    return;
  }

  const date = document.getElementById('record-date').value || todayString();

  if (editingRecordId) {
    await db.updateRecord(editingRecordId, date, currentExercise.id, currentExercise.bodyPartId, sets);
  } else {
    await db.addRecord(date, currentExercise.id, currentExercise.bodyPartId, sets);
  }

  showToast('保存しました');
  editingRecordId = null;
  await refreshCalendar();
  showScreen('calendar');
}
