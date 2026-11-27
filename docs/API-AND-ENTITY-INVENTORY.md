# Avatifi CRM — API & entity inventory (frozen from pack)

Generated: 2026-11-27T05:31:44.060Z

## Sheet tabs
- 設定
- 商談
- 施策
- 参加者
- 名刺
- 代理店
- 顧客
- トライアル
- 依頼
- 入金
- KPI目標
- 履歴
- フィーの支払い
- タスク

## app* functions (CRM API surface)
- `appAddPerson`
- `appAgencyStats`
- `appAnalysis`
- `appBoot`
- `appCardToDeal`
- `appCardUpload`
- `appChurn`
- `appCustBulk`
- `appCustomerActivity`
- `appDealBulk`
- `appDealMove`
- `appDelete`
- `appFeePayouts`
- `appFeeSave`
- `appFormAnswers`
- `appGoalSave`
- `appGoals`
- `appHistory`
- `appHome`
- `appImportHolidays`
- `appImportPreview`
- `appImportRun`
- `appKpi`
- `appKpiTargets`
- `appList`
- `appMakeFormLinks`
- `appMonthCounts`
- `appPayAdd`
- `appPayConfirm`
- `appPayDelete`
- `appPayEdit`
- `appPayments`
- `appPeopleToDeal`
- `appReferrals`
- `appReqCost`
- `appReqMemo`
- `appReqStatus`
- `appRevenue`
- `appRevenuePlan`
- `appSave`
- `appSettings`
- `appSettingsSave`
- `appTaskDelete`
- `appTaskDone`
- `appTaskSave`
- `appTasks`
- `appUserKey`

## Entities
### deal → `deals` (tab: 商談)
| key | label | type |
|-----|-------|------|
| id | 商談ID | id |
| leadDate | リード獲得日 | date |
| name | お名前 | text |
| company | 会社名 | text |
| industry | 業種 | text |
| channel | 連絡手段 | choice:連絡手段 |
| email | メールアドレス | text |
| sns | SNSのURL | url |
| followers | フォロワー数 | number |
| source | 経路 | choice:経路 |
| sourceDetail | 経路の詳細 | text |
| leadOwner | リード獲得者 | person |
| apoOwner | アポ獲得者 | person |
| apoDate | アポ獲得日 | date |
| sentText | 送った文面 | longtext |
| replyText | 返ってきた文面 | longtext |
| proposal | 提案する商材 | choice:サービス |
| closer | 商談者 | person |
| meetPlan | 商談予定日 | date |
| meetDate | 商談実施日 | date |
| result | 商談結果 | choice:商談結果 |
| reason | 結果の理由 | text |
| nextDate | 次の連絡日 | date |
| hearing | ヒアリングメモ | longtext |
| memo | メモ | longtext |
| wonService | 受注した商材 | choice:サービス |
| wonInit | 受注：初期費用（税込） | yen |
| wonFee | 受注：月額（税込） | yen |
| wonDate | 受注日 | date |
| customer | 顧客名（台帳） | ro |
| resultDate | 結果を変えた日 | ro |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |
| title | 役職 | text |
| business | 事業内容 | text |
| background | 事前課題（参加背景） | longtext |

### camp → `campaigns` (tab: 施策)
| key | label | type |
|-----|-------|------|
| id | 施策ID | id |
| name | 施策名 | text |
| kind | 種類 | choice:施策の種類 |
| theme | テーマ | text |
| date | 開催日 | date |
| time | 時間 | text |
| format | 形式 | choice:形式 |
| state | 開催の状態 | choice:開催の状態 |
| partner | 協業者 | text |
| speaker | 講演者 | text |
| pm | PM | person |
| place | 場所 | longtext |
| fee | 参加費用 | text |
| entry | 参加者の管理 | url |
| planned | 参加予定人数 | text |
| schedule | タイムスケジュール | longtext |
| image | 集客用画像 | text |
| memo | 備考 | longtext |
| imported | 参加者（取り込み） | longtext |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |
| goalPeople | 目標の参加者数 | number |
| goalApo | 目標のアポ | number |
| goalWon | 目標の契約 | number |
| goalAmount | 目標の金額 | yen |
| material | 資料（URL） | url |
| banner | 募集バナー（URL） | url |

### people → `people` (tab: 参加者)
| key | label | type |
|-----|-------|------|
| id | 参加者ID | id |
| camp | 施策ID | text |
| campName | 施策名 | text |
| company | 会社名 | text |
| name | お名前 | text |
| title | 役職 | text |
| background | 事前課題（参加背景） | longtext |
| business | 事業内容 | text |
| state | 参加 | choice:参加の結果 |
| staff | 担当（社内） | person |
| deal | 商談ID | ro |
| memo | メモ | longtext |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |

### card → `cards` (tab: 名刺)
| key | label | type |
|-----|-------|------|
| id | 名刺ID | id |
| date | 交換日 | date |
| company | 会社名 | text |
| name | お名前 | text |
| title | 役職 | text |
| email | メールアドレス | text |
| phone | 電話 | text |
| address | 住所 | text |
| url | ホームページ | url |
| place | 交換した場所 | text |
| owner | 交換した人 | person |
| memo | メモ | longtext |
| photo | 名刺の写真 | url |
| ocr | 読み取った文字 | longtext |
| deal | 商談ID | ro |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |

### agency → `agencies` (tab: 代理店)
| key | label | type |
|-----|-------|------|
| name | 代理店名 | text |
| start | 代理店契約日 | date |
| state | 状態 | choice:代理店の状態 |
| end | 終了日 | date |
| owner | 担当者 | text |
| contact | 連絡先 | text |
| memo | メモ | longtext |
| feeRule | フィーの決め方 | choice:フィーの決め方 |
| kind | 区分 | choice:代理店の区分 |
| relation | 関係 | choice:関係 |
| mtg | 定例MTG日 | date |
| imported | 取次先（取り込み） | longtext |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |

### cust → `customers` (tab: 顧客)
| key | label | type |
|-----|-------|------|
| name | 顧客名 | ro |
| company | 会社名 | text |
| kana | 読み | text |
| industry | 業種 | text |
| service | 契約サービス | choice:サービス |
| kind | プランの種類 | choice:プランの種類 |
| plan | プランの本数 | choice:プランの本数 |
| auto | 自動編集の本数 | choice:自動編集の本数 |
| planName | プラン名（自動） | ro |
| state | 契約状態 | choice:契約状態 |
| contract | 契約日 | date |
| end | 契約の終わり | date |
| notice | 解約の申し出日 | date |
| start | 開始日 | date |
| sales | 担当営業 | person |
| cs | CS担当 | person |
| materials | 提供した素材（リンク） | links |
| agency | 紹介した代理店 | choice:代理店 |
| source | 流入経路 | text |
| deal | 商談ID | ro |
| init | 初期費用（税込） | yen |
| initPay | 初期費用の支払い方法 | choice:支払い方法 |
| paid | 初期費用の入金日 | date |
| fee | 月額（税込） | yen |
| feePay | 月額の支払い方法 | choice:支払い方法 |
| firstCharge | 月額の初回の決済日 | date |
| autopay | 定期決済の登録 | choice:定期決済の登録 |
| gform | Googleフォーム | choice:Googleフォーム |
| csheet | 顧客シート | url |
| csite | 顧客サイト | url |
| email | メールアドレス | text |
| contact | 連絡の手段 | choice:連絡の手段 |
| avatar | avatar_id | text |
| voiceId | voice_id | text |
| voice | 声の作り方 | choice:声の作り方 |
| menu | メニューと料金表 | longtext |
| howto | 予約・購入の方法 | longtext |
| target | 見てほしいお客様 | longtext |
| ng | 使えない表現 | longtext |
| yomi | 読みの注意 | longtext |
| post | 投稿先と頻度 | text |
| folder | 顧客フォルダ | ro |
| lastReq | 最終依頼日（自動） | ro |
| idle | 依頼なし（日・自動） | ro |
| salesMemo | 備考（営業） | longtext |

### req → `requests` (tab: 依頼)
| key | label | type |
|-----|-------|------|
| id | 依頼ID | ro |
| received | 受付日時 | dt |
| cust | 顧客名 | ro |
| type | 型 | ro |
| theme | 何の動画か | ro |
| sales | 担当営業 | ro |
| folder | フォルダ | ro |
| status | 状態 | ro |
| waiting | 誰待ち | ro |
| statusDate | 状態を変えた日 | ro |
| ready | そろった日 | ro |
| ok | 台本OK日 | ro |
| due | 納品予定 | ro |
| waitDays | お客様待ち（営業日） | ro |
| revisions | 修正回数 | ro |
| count | 期間の何本目 | ro |
| delivered | 納品日 | ro |
| memo | メモ | ro |
| voice | 声 | ro |
| make | 作り方 | ro |
| estUsd | 見込み HeyGen（$） | ro |
| estCr | 見込み ElevenLabs（cr） | ro |
| actUsd | 実績 HeyGen（$） | ro |
| actEl | 実績 ElevenLabs（$） | ro |

### task → `tasks` (tab: タスク)
| key | label | type |
|-----|-------|------|
| id | タスクID | id |
| title | やること | text |
| person | 担当 | person |
| due | 期限 | date |
| memo | メモ | longtext |
| refKind | つながる先の種類 | text |
| refKey | つながる先 | text |
| done | 済み | text |
| doneAt | 済んだ日 | date |
| createdBy | 作った人 | ro |
| updatedAt | 最終更新 | ro-dt |
| updatedBy | 更新した人 | ro |
