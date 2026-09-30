// 日付まわりの共通処理をまとめたファイル

// Dateオブジェクトを "YYYY-MM-DD" の文字列にする（保存・比較用）
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString() {
  return toDateString(new Date());
}

// 現在時刻を "HH:MM" の文字列にする（開始/終了時刻の「今」ボタン用）
export function nowTimeString() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// "HH:MM" 形式の開始・終了時刻から、経過分数を計算する
// 終了が開始より前の場合は日をまたいだとみなす
export function diffMinutes(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

// 分数を「1時間30分」「45分」のような表示用文字列にする
export function formatDurationMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

// 秒数を「1分30秒」のような表示用文字列にする（0や未入力ならnullを返す）
export function formatRestSeconds(totalSeconds) {
  if (!totalSeconds) return null;
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  if (min > 0 && sec > 0) return `${min}分${sec}秒`;
  if (min > 0) return `${min}分`;
  return `${sec}秒`;
}

// 指定した日を含む週の「月曜日」を返す
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=日曜, 1=月曜, ... 6=土曜
  const diff = day === 0 ? -6 : 1 - day; // 日曜なら-6日、それ以外は月曜まで戻る日数
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 週の開始日(月曜)から7日分のDateオブジェクト配列を返す
export function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatYearMonthDayJa(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export const WEEKDAY_LABELS_JA = ['月', '火', '水', '木', '金', '土', '日'];

// 記録がある日付の集合(Set)から、今日を含む連続記録日数を数える
// 今日にまだ記録がなくても、昨日までの連続記録は途切れさせない
export function computeStreakDays(dateSet) {
  let streak = 0;
  const cursor = new Date();

  if (!dateSet.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (dateSet.has(toDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// 種目一覧を部位別にまとめる時の表示順（胸→背中→肩→二頭筋→三頭筋→腹筋→脚）
export const BODY_PART_ORDER = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'abs', 'legs'];

// 配列を、指定した部位の並び順どおりにグループ化して並べ替える(部位内の順序は保たれる)
export function sortByBodyPartOrder(items, getBodyPartId) {
  return [...items].sort((a, b) => {
    const ai = BODY_PART_ORDER.indexOf(getBodyPartId(a));
    const bi = BODY_PART_ORDER.indexOf(getBodyPartId(b));
    return ai - bi;
  });
}

// 月間カレンダー用：指定した月を含む表示グリッド(月曜始まり、前後月の日にちも含めて週単位で埋める)の
// 最初の日付(月曜)を返す
export function getMonthGridStart(year, month) {
  return getWeekStart(new Date(year, month, 1));
}

// 月間カレンダー用：表示グリッドの最後の日付(日曜)を返す
export function getMonthGridEnd(year, month) {
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const weekStartOfLastDay = getWeekStart(lastDayOfMonth);
  const gridEnd = new Date(weekStartOfLastDay);
  gridEnd.setDate(gridEnd.getDate() + 6);
  return gridEnd;
}
