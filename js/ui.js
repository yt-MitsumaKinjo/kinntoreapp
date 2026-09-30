// 画面切り替え・モーダル・トースト通知など、共通のUI操作をまとめたファイル

const MAIN_SCREENS = ['calendar', 'exercises', 'backup', 'month-calendar']; // 下部ナビに対応する画面
let historyStack = ['calendar'];

export function showScreen(screenName, { addToHistory = true } = {}) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');

  // 下部ナビの見た目を更新（メイン画面のときだけ）
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === screenName);
  });

  // 「登録」ボタンはカレンダー画面・日別詳細画面の時だけ出す
  const fab = document.getElementById('fab-add');
  if (fab) fab.style.display = (screenName === 'calendar' || screenName === 'day-detail') ? 'block' : 'none';

  if (addToHistory) {
    if (MAIN_SCREENS.includes(screenName)) {
      historyStack = [screenName]; // メイン画面に来たら履歴はリセット
    } else {
      historyStack.push(screenName);
    }
  }
}

export function goBack() {
  if (historyStack.length > 1) {
    historyStack.pop();
  }
  const prev = historyStack[historyStack.length - 1] || 'calendar';
  showScreen(prev, { addToHistory: false });
}

let toastTimer = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// 汎用モーダル。bodyElement には既に組み立てたDOM要素を渡す。
// onOk が false を返した場合は閉じない（入力チェックNGなど）。
export function openModal({ title, bodyElement, onOk }) {
  document.getElementById('modal-title').textContent = title;
  const bodyContainer = document.getElementById('modal-body');
  bodyContainer.innerHTML = '';
  bodyContainer.appendChild(bodyElement);

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('active');

  const okBtn = document.getElementById('modal-ok');
  const cancelBtn = document.getElementById('modal-cancel');

  const close = () => overlay.classList.remove('active');

  const handleOk = async () => {
    const result = await onOk();
    if (result !== false) close();
  };
  const handleCancel = () => close();

  // 前回のイベントが残らないようボタンを複製して差し替える
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.replaceWith(newOkBtn);
  newOkBtn.addEventListener('click', handleOk);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancelBtn);
  newCancelBtn.addEventListener('click', handleCancel);
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

export function confirmDialog(message) {
  return window.confirm(message);
}
