// 種目管理画面（追加・編集・削除）のロジック

import * as db from './db.js';
import { openModal, showToast, confirmDialog } from './ui.js';
import { sortByBodyPartOrder } from './utils.js';

let allBodyParts = [];
let allExercises = [];
let selectedFilterBodyPartId = 'all';

export async function initExercisesScreen() {
  document.getElementById('add-exercise-btn').addEventListener('click', () => openExerciseModal(null));
  await refreshExercisesScreen();
}

// 種目管理画面が表示されるたびに最新データを読み直す（app.jsのナビ処理から呼ばれる）
export async function refreshExercisesScreen() {
  [allBodyParts, allExercises] = await Promise.all([db.getBodyParts(), db.getExercises()]);
  renderFilter();
  renderList();
}

function renderFilter() {
  const container = document.getElementById('manage-bodypart-filter');
  container.innerHTML = '';

  const allChip = makeFilterChip('すべて', null, null, selectedFilterBodyPartId === 'all');
  allChip.addEventListener('click', () => {
    selectedFilterBodyPartId = 'all';
    renderFilter();
    renderList();
  });
  container.appendChild(allChip);

  allBodyParts.forEach((bp) => {
    const chip = makeFilterChip(bp.name, bp.icon, bp.color, selectedFilterBodyPartId === bp.id);
    chip.addEventListener('click', () => {
      selectedFilterBodyPartId = bp.id;
      renderFilter();
      renderList();
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

function renderList() {
  const list = document.getElementById('exercise-manage-list');
  list.innerHTML = '';

  const bodyPartsById = Object.fromEntries(allBodyParts.map((bp) => [bp.id, bp]));
  let filtered = allExercises.filter(
    (ex) => selectedFilterBodyPartId === 'all' || ex.bodyPartId === selectedFilterBodyPartId
  );

  if (filtered.length === 0) {
    list.innerHTML = '<p class="hint-text">種目がありません。下のボタンから追加してください。</p>';
    return;
  }

  if (selectedFilterBodyPartId === 'all') {
    // 「すべて」の時は、胸→背中→肩→二頭筋→三頭筋→腹筋→脚の順に見出し付きでまとめる
    filtered = sortByBodyPartOrder(filtered, (ex) => ex.bodyPartId);
    let lastBodyPartId = null;
    filtered.forEach((ex) => {
      if (ex.bodyPartId !== lastBodyPartId) {
        lastBodyPartId = ex.bodyPartId;
        const bp = bodyPartsById[ex.bodyPartId];
        const header = document.createElement('div');
        header.className = 'exercise-group-header';
        header.textContent = bp ? bp.name : '';
        list.appendChild(header);
      }
      list.appendChild(buildExerciseManageItem(ex, bodyPartsById));
    });
  } else {
    filtered.forEach((ex) => {
      list.appendChild(buildExerciseManageItem(ex, bodyPartsById));
    });
  }
}

function buildExerciseManageItem(ex, bodyPartsById) {
  const bp = bodyPartsById[ex.bodyPartId];
  const item = document.createElement('div');
  item.className = 'exercise-manage-item';

  if (bp) {
    const img = document.createElement('img');
    img.src = bp.icon;
    img.alt = bp.name;
    item.appendChild(img);
  }

  const name = document.createElement('div');
  name.className = 'exercise-manage-name';
  name.textContent = ex.name;
  item.appendChild(name);

  const editBtn = document.createElement('button');
  editBtn.textContent = '編集';
  editBtn.addEventListener('click', () => openExerciseModal(ex));
  item.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '削除';
  deleteBtn.addEventListener('click', async () => {
    if (!confirmDialog(`「${ex.name}」を削除しますか？（過去の記録は残ります）`)) return;
    await db.deleteExercise(ex.id);
    showToast('削除しました');
    await refreshExercisesScreen();
  });
  item.appendChild(deleteBtn);

  return item;
}

function openExerciseModal(existingExercise) {
  const form = document.createElement('div');

  const nameField = document.createElement('div');
  nameField.className = 'modal-field';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = '種目名';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = existingExercise ? existingExercise.name : '';
  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);

  const bodyPartField = document.createElement('div');
  bodyPartField.className = 'modal-field';
  const bodyPartLabel = document.createElement('label');
  bodyPartLabel.textContent = '部位';
  const bodyPartSelect = document.createElement('select');
  allBodyParts.forEach((bp) => {
    const option = document.createElement('option');
    option.value = bp.id;
    option.textContent = bp.name;
    if (existingExercise && existingExercise.bodyPartId === bp.id) option.selected = true;
    bodyPartSelect.appendChild(option);
  });
  bodyPartField.appendChild(bodyPartLabel);
  bodyPartField.appendChild(bodyPartSelect);

  form.appendChild(nameField);
  form.appendChild(bodyPartField);

  openModal({
    title: existingExercise ? '種目を編集' : '種目を追加',
    bodyElement: form,
    onOk: async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showToast('種目名を入力してください');
        return false;
      }
      const bodyPartId = bodyPartSelect.value;

      if (existingExercise) {
        await db.updateExercise(existingExercise.id, name, bodyPartId);
      } else {
        await db.addExercise(name, bodyPartId);
      }
      showToast('保存しました');
      await refreshExercisesScreen();
    },
  });
}
