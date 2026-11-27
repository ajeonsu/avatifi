/**
 * Domain constants ported from 営業.gs (pack 20261125).
 * Keep in sync with GAS until Supabase settings tables own them.
 */

export const CRM_ROLES = ['管理', 'マーケ', 'IS', 'FS', 'CS', '制作'] as const;

export const CRM_STAGES = [
  'リード',
  'アポ',
  '着座',
  '見込み',
  '受注',
  '失注',
  '対象外',
] as const;

export const CRM_CATS = [
  '受注',
  '見込み',
  '協業',
  '引き継ぎ',
  'リスケ',
  '未着座',
  '失注',
  '無効',
  '取消',
] as const;

export const CRM_SHEET_TABS = {
  DEAL: '商談',
  CAMP: '施策',
  PAY: '入金',
  KPI: 'KPI目標',
  LOG: '履歴',
  FEE: 'フィーの支払い',
  TASK: 'タスク',
  PEOPLE: '参加者',
  CARD: '名刺',
  AGENCY: '代理店',
  CUST: '顧客',
  REQ: '依頼',
  SETTINGS: '設定',
  TRIAL: 'トライアル',
} as const;

/** Default payment rules from 営業.gs CRM_DEFAULT_RULES (Aoyagi 2026-11-16). */
export type PaymentRuleDraft = {
  method: string;
  settleFrom: string | number;
  settleTo: string | number;
  depositMonthsLater: number | '';
  depositDay: string;
  weekClose: string;
  daysAfterClose: number | '';
  holidayPolicy: string;
  minTransfer: string;
  note: string;
};

export const CRM_DEFAULT_PAYMENT_RULES: PaymentRuleDraft[] = [
  {
    method: 'マネフォ',
    settleFrom: 1,
    settleTo: 15,
    depositMonthsLater: 0,
    depositDay: '末',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: '前営業日',
    minTransfer: '',
    note: '1〜15日決済→当月末',
  },
  {
    method: 'マネフォ',
    settleFrom: 16,
    settleTo: '末',
    depositMonthsLater: 1,
    depositDay: '15',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: '前営業日',
    minTransfer: '',
    note: '16〜末日→翌月15日',
  },
  {
    method: 'ペライチ',
    settleFrom: 1,
    settleTo: 15,
    depositMonthsLater: 1,
    depositDay: '1',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: 'そのまま',
    minTransfer: '',
    note: '1〜15日→翌月1日',
  },
  {
    method: 'ペライチ',
    settleFrom: 16,
    settleTo: '末',
    depositMonthsLater: 2,
    depositDay: '1',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: 'そのまま',
    minTransfer: '',
    note: '16〜末日→翌々月1日',
  },
  {
    method: '会費ペイ',
    settleFrom: 1,
    settleTo: '末',
    depositMonthsLater: 1,
    depositDay: '15',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: '翌営業日',
    minTransfer: '',
    note: '毎月15日',
  },
  {
    method: '月額パンダ（口座振替）',
    settleFrom: 1,
    settleTo: '末',
    depositMonthsLater: 1,
    depositDay: '10',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: 'そのまま',
    minTransfer: '',
    note: '27日振替・翌月10日',
  },
  {
    method: '現金・振込',
    settleFrom: 1,
    settleTo: '末',
    depositMonthsLater: 0,
    depositDay: '当日',
    weekClose: '',
    daysAfterClose: '',
    holidayPolicy: 'そのまま',
    minTransfer: '',
    note: '決済日＝入金日',
  },
];

export const CRM_DEFAULT_SOURCES = [
  'セミナー',
  '協賛セミナー',
  '交流会',
  '代理店の紹介',
  '紹介',
  'BNI',
  'SNS',
  'アプリ',
  '広告',
  'テレアポ',
  '展示会',
  'メルマガ',
  '既存のお客様',
  'その他',
] as const;
