# MASTER BUILD PROMPT — KVITTEL GLOBAL
## הוראות לבניית פלטפורמה בינלאומית לשליחת קוויטלעך לציוני צדיקים

אתה Claude Code, פועל כ-Principal Product Architect, Creative Director, Staff Full-Stack Engineer, Accessibility & Localization Lead, Payment Engineer, Embedded/IoT Architect ו-QA Lead. זו משימת **בנייה בפועל של מוצר** ברמה בינלאומית, לא כתיבת רעיונות או מסכי הדגמה בלבד. אם קיימת תיקיית פרויקט — סקור אותה ושמור על עבודה קיימת; אם התיקייה ריקה — הקם את הפרויקט מאפס. אינך רשאי להניח שיש לך הרשאות, כלי דפדפן, MCP, שירותים או מפתחות API שאינם קיימים. אל תטען שבוצעו פעולות שלא ביצעת. פעל בצורה עצמאית, עקבית ומקצועית.

## 0. חזון וערכי המוצר

שם עבודה: **Kvittel Global / קוויטל אונליין** — שם זמני שניתן לשנות מתוך הגדרות המיתוג, ולא שם רשמי או הבטחה לזמינות דומיין. השירות מאפשר לאדם בכל מקום בעולם למצוא ציון של צדיק, למלא קוויטל עם שמות ובקשות, לשלם בלי להירשם, ולשלוח את הקוויטל להדפסה פיזית על נייר תרמי בעמוד קטן המוצב באישור מנהלי הציון ליד פתח הקוויטלעך הקיים. הקוויטל נחתך במלואו, מופנה דרך תעלה לפתח הייעודי, וחיישנים מאשרים מעבר. בהמשך: סרטון פרטי של רגע המסירה; כמה ציונים בהזמנה; שמירת קוויטלעך, הילולות, שותפים מקומיים ועוד.

החוויה צריכה להיות **קדושה, מכובדת, מרגשת, יוקרתית, מדויקת, שקטה וברורה**; לא עיצוב קזינו, תרומות גנרי, אתר סגולות צעקני או דשבורד SaaS גנרי. השירות מוכר מסירה פיזית ותיעוד אפשרי, **לא הבטחה לישועה או תוצאה רוחנית**. אין להציג הדפסה כאילו בוצעה אם אין אישור חומרה. כל אתר קבר דורש רשות להתקין ולתפעל ציוד. הגנה על פרטיות בקשות ושמות היא דרישת יסוד.

## 1. דרך העבודה של Claude Code — חובה

1. התחל בסקירת הריפו, README, package files, קונבנציות, מצב Git ומצב הכלים. אם הפרויקט ריק, בצע bootstrap. הצג סיכום קצר והחלטות מרכזיות, **ואז כתוב קוד** — אל תעצור לאחר שלב האפיון.
2. השתמש ב-Plan Mode כשמועיל, צור `docs/MASTER_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/UX_DESIGN_SYSTEM.md`, `docs/DEVICE_PROTOCOL.md`, `docs/ROADMAP.md`, `docs/SECURITY_PRIVACY.md`, `docs/OPERATIONS.md`, `docs/LOCALIZATION.md` ו-`CLAUDE.md` עם הנחיות מתמשכות. צור milestone checklist שניתן להמשיך בסשנים נוספים.
3. אם יש subagents, השתמש בהם באופן ממוקד: חקר UX/Design, Backend/Payments, IoT/Devices, Localization/SEO, Security/QA — בלי לייצר קונפליקטים בעריכת אותם קבצים. Skills, hooks ו-MCP רק כשזמינים ומתאימים; אין להמציא חיבור.
4. בנה vertical slices עובדים מקצה לקצה; לא עשרות עמודי placeholder. לאחר כל שלב הרץ typecheck, lint, tests, build, ובדיקות דפדפן אמיתיות באמצעות Playwright או Chrome אם זמין. צלם screenshots במסכים ורוחבים שונים ותקן על בסיסם. אל תסתפק באמירה 'נראה טוב'.
5. כל אינטגרציה שדורשת מפתח חיצוני תקבל interface/provider adapter ו-sandbox/mock בדיקות, עם `.env.example`. אסור לייצר תשלומים אמיתיים בסביבת בדיקות או להמציא חיבור למדפסת. Mock יזוהה בבירור כ-DEMO.
6. אל תמחוק נתונים, תדרוס עבודת משתמש, תפרסם לפרודקשן, תבצע חיוב אמיתי או push ל-main ללא הרשאה. התאם את העבודה לריפו קיים; הימנע מתלות ב-Docker עבור פיתוח מקומי.
7. פתח לאורך העבודה ממשק שימושי ולא רק מסמכי ארכיטקטורה. בסוף כל אבן דרך דווח מה עובד, מה נבדק בפועל, מה mock, מה דורש credentials או חומרה, ומה השלב הבא. אין להצהיר על תכונה כמושלמת אם אינה פועלת.

## 2. היעד העיצובי — PRIORITY #1, ללא פשרות

צור חוויית **luxury editorial product** מרשימה במיוחד, עם איכות עיצוב המתאימה למותג בינלאומי יוקרתי. יש חופש יצירתי מלא לשפר את האפיון, אך בלי לוותר על התפקוד והכבוד למקום.

### שפה חזותית
- פלטה: midnight navy / כחול עמוק, ivory / אבן שמנת, warm limestone, aged gold / זהב עתיק, גוונים משניים של פחם, חום ונייר עתיק. זהב כהדגשה, לא הצפה.
- פונט עברי כותרות עשיר כגון `Frank Ruhl Libre` או `Noto Serif Hebrew`; גופי טקסט קריאים כגון `Heebo` / `Assistant`. לטינית איכותית כגון `Cormorant Garamond` לכותרות ו-`Manrope` / `Inter` לגוף. עבור קירילית, יידיש וסימנים דיאקריטיים, לבחור *משפחות המכסות את הגליפים בפועל*, עם fallback מתוכנן. לבדוק רינדור בכל שפה; לא להסתמך על שם פונט בלבד.
- מסגרות אבן מעודנות, מוטיבים גיאומטריים יהודיים עתיקים במידה, עיטורי קו דק, textures עדינים, תאורה רכה, צילום אותנטי ברישיון שימוש. לא להשתמש בתמונות של ציון אחר תחת שם ציון שגוי. אין לייצר מצבות פיקטיביות ולהציגן כתיעוד אמיתי. אם אין תמונה — placeholder ממותג ומכובד.
- Hero יוצא דופן עם חיפוש ציון מרכזי, טיפוגרפיית display, תמונות עשירות ואווירה מחוברת למסע הרוחני; בהמשך כרטיסי ציונים איכותיים, חוויית תהליך, הצגת אמינות המסירה ומידע על השירות.
- כרטיסי ציון עם יחס צילום 4:5 או 3:4, טיפול חכם בתמונה, שם, מיקום, זמינות אמיתית, מחיר שקוף ו-CTA ברור. רכיבי UI עקביים, radii נשלטים, micro-interactions איכותיים, skeletons ו-empty states מושקעים.
- אנימציות Framer Motion / CSS בהתאם לצורך, מרוסנות, smooth 60fps, ללא פגיעה בביצועים או רגישות לתנועה (`prefers-reduced-motion`). לא להציף באפקטי parallax.
- טופס הקוויטל הוא 'hero interaction': על desktop טופס בצד אחד ותצוגה חיה אלגנטית של קוויטל על רקע מצבה/קיר אבן מופשט בצד השני; הטקסט מופיע בזמן אמת כאילו נכתב על נייר, תוך שימור דיוק. במובייל — preview נפתח בקלות בלי להקטין את הטופס. דוגמת ההדפסה חייבת להשתמש באותו layout engine או חוקים של הפתק המודפס.
- עיצוב מובייל **mobile first**, אך desktop נראה יוקרתי ולא stretched mobile UI. רוחבי בדיקה 360, 390, 768, 1024, 1440, 1920. בדוק נגישות, contrast, keyboard/focus, WCAG 2.2 AA ככל הניתן, alt texts, screen readers.
- בנה **Design System** אמיתי: tokens צבע, spacing, radii, shadows, typography, transitions, Button/Input/Card/Badge/Modal/Drawer/Stepper/Toast/Empty State/Loading/Error/Status/Charts. Storybook או showcase פנימי מומלץ.
- אין להשתמש ב-gradient סגול/כחול גנרי, אייקונים אקראיים, תמונות סטוק לא מתאימות או רכיבי שבלונה. הראה 2 כיווני art-direction בנכסי preview/דף עיצוב פנימי, בחר את הטוב ובנה סביבו. אם כלי ליצירת תמונות זמין — השתמש בו רק עבור רקעים ועיטורים, לא כתחליף לתצלומי ציונים אותנטיים.

## 3. שפות ובינאום (תשתית מהיום הראשון)

**חובה בפועל ל-MVP:** עברית `he`, אנגלית `en`, צרפתית `fr`, רוסית `ru`. תכנן ויישם תשתית והודעות לשפות נוספות: יידיש `yi` (RTL), ספרדית `es`, פורטוגזית `pt`, גרמנית `de`; ארכיטקטורה לקראת פולנית `pl`, אוקראינית `uk`, איטלקית `it` ועוד. עד שלא הושלם QA תרגומי לשפה משנית, ניתן להשאיר אותה כבויה ב-feature flags; אין להציג שפה עם טקסט חצי מתורגם כאילו היא גמורה.

- `next-intl` (או חלופה מנומקת) עם `/he`, `/en`, `/fr`, `/ru`, נתיבי שפה ייחודיים, hreflang, locale-aware sitemap, OpenGraph ו-SEO לכל שפה.
- החלפת שפה גלובלית ללא אובדן הנתונים בטופס או איבוד ההזמנה; זיהוי locale לפי browser בהגעה ראשונה, עם בחירה ידנית ששורדת.
- `dir=rtl` ל-he/yi ו-`dir=ltr` לאחרות; CSS logical properties, icon mirroring ברכיבים רלוונטיים, bidi isolation עבור שמות ומספרי הזמנות, טיפול נכון בשפות מעורבות. שם הצדיק, שם האדם והקוויטל **לעולם לא ישונו אוטומטית** עקב שינוי שפת הממשק. עבור הדפסה הצג בפועל Unicode/ביטמאפ ואפשר בחירת תעתיק אופציונלית.
- תרגם UI, הודעות validation, הודעות תשלום, סטטוסי חומרה ללקוח, מיילים, SEO, תוכן מערכת וקטעי מדיניות. השתמש ב-ICU pluralization, Intl עבור כסף/תאריכים/מספרים, timezone לכל ציון ותאריך עברי בצורה אמינה. אסור hardcode של טקסט UI בקומפוננטות.
- תוכן ציון רב-לשוני ב-CMS: שם, aliases, תיאור, meta, FAQ, כתובת לפי locale. fallback גלוי בתוכן חסר; UI לא מתערבב עם שפה אחרת.
- QA snapshot ו-Playwright ב-he, en, fr, ru לפחות, כולל RTL מלא, שמות ארוכים בצרפתית ורוסית וחיפוש בכתיבים חלופיים.
- תשתית מערכתית למטבעות USD, EUR, ILS, GBP, CAD, AUD (לא להניח אותם מטבעות לכל שפה), מטבע בסיס ופלט מחירים נפרדים. המרת מטבעות חיצונית רק באמצעות rates אמיתיים עם timestamp או מחירון קבוע; מחיר עסקה תמיד נשמר כ-snapshot.

## 4. מסע המשתמש הציבורי — בלי הרשמה חובה

### 4.1 דף בית
חיפוש חכם לפי צדיק/כינוי/עיר/מדינה בעברית, אנגלית, יידיש, רוסית ותעתיקים. תוצאות live, fuzzy matching, accent folding. סינון לפי מדינה/עיר, שושלת/חסידות, תקופה, הילולא קרובה, ציונים מועדפים, זמינות אמיתית. Featured, Newly Available, Nearby Hilulot, How It Works, Trust, FAQ. אין להמציא זמן מסירה; הצג 'זמין כעת' רק אם התקן פעיל ולוח הזמנים מאפשר.

### 4.2 ספריית ציונים ודף ציון
תמונות אותנטיות ברישיון, גלריה, שם בצורות כתיב שונות, ביוגרפיה עם מקורות מאומתים, מיקום על מפה, קישור ניווט, מדינה/עיר, מנהגים/כללי המקום, תאריך הילולא, מחיר, סטטוס הדפסה, זמני שירות, מה כוללת ההזמנה, עמוד SEO ציבורי. רשומה יכולה להיות `discovery-only`, `coming-soon`, `active`, `paused`, `maintenance` בלי מכירה שקרית של הדפסה. טופס בקשת הוספת ציון ושימור מדדי ביקוש.

### 4.3 בונה קוויטל
- הוספת אדם אחד או רבים, שם פרטי, שם האב או האם, אפשרות 'בן/בת', בחירה כיצד להציג את הנוסח; אפשר לכתוב שמות באופן חופשי או שדות מובנים.
- קבוצות שמות: משפחה, חברים, רשימות שמורות לאחר כניסה.
- בקשה אישית, כמה פסקאות, בחירה בנושאים (בריאות, פרנסה, זיווג, ילדים, הצלחה, הודיה, כללי) ללא כיתוב מאגי או הבטחה. טקסט חופשי ראשון במעלה; נוסחים מוצעים אופציונליים בלבד.
- העלאת צילום כתב יד (JPG/PNG/PDF לאחר סניטציה), crop/rotate/preview, או בונה טקסט רגיל. מגבלות אורך/פלט לפני תשלום; מספר דפים ותמחור אם צריך; אין קיטוע שקט.
- תצוגה מיידית ומרגשת של הקוויטל, על נייר מודפס ברוחב 58 מ"מ; בנה renderer משותף ל-preview ול-raster print. תמיכה בעברית/יידיש/לטינית/קירילית ובטקסט דו-כיווני. אפשרות להחליף template חזותי מתוך קבוצה מצומצמת, תבנית ברירת מחדל מכובדת.
- Draft מקומי זמני לאורח, מאובטח ובמינימום מידע רגיש; הצעה לשמירה בענן רק לאחר התחברות והרשאה.
- הוספת כמה ציונים להזמנה אחת, אותו קוויטל או עותקים נפרדים, הנחות חבילה, סיכום קל וברור לכל ציון ולכל שירות.
- מסע קצר עם stepper: בחירת ציון ← כתיבה ← תצוגה ← תשלום ← מעקב. ללא יצירת חשבון חובה; תיבה נפרדת להסכמה לקבלת שיווק, לא מסומנת מראש.

### 4.4 Checkout והזמנות
תשלום מאובטח דרך ספק התומך במדינות הפעילות (adapter, אין hardcode לספק מסוים בלי אישור). guest checkout עם דוא"ל לאישור וקבלות. סכום ומטבע סופיים, מיסים אם רלוונטיים, מדיניות החזרים, קופונים, פריטי סל, מזהה הזמנה. Webhook signed + idempotent הוא מקור האמת לאישור תשלום, לא client redirect. חשבון יכול להתחבר עם magic link / OTP. קישור מעקב להזמנת אורח הוא token מוגן/פג תוקף, ללא גישה ציבורית לשמות. חשבוניות דרך ספק מתאים/אינטגרציה בהמשך, לא לזייף מסמך מס.

### 4.5 סטטוס מסירה
טיימליין אמיתי: payment pending / paid / queued / scheduled / sending / printing / cut / chute-confirmed / delivered / uncertain / failed / refunded. הצג תאריך ושעון מקומיים של הציון. וידאו פרטי *אופציונלי* אם מותקן ומוסדר מבחינת פרטיות. אם השירות מושהה או אין מדפסת מחוברת — הצע זמן מתוזמן/החזר, לא ציין 'נמסר'. הודעות אישור במייל רב-לשוני; ערוץ WhatsApp רק לאחר חיבור מאושר והסכמה.

## 5. חשבון משתמש — רשות בלבד
Magic link/OTP + OAuth אופציונלי בהמשך; חשבון אורח נשאר אפשרי תמיד. דשבורד אישי בעיצוב פרימיום: הזמנות היסטוריות, מסמכי תשלום, סרטונים, יצירת קוויטל חוזר, שמות שמורים, טמפלייטים, צדיקים מועדפים, יצירת רשימות משפחתיות, תזכורות להילולות/ראש חודש/יארצייט, תזמון שליחה לעתיד, הגדרות שפה, מטבע, פרטיות ומחיקת מידע. אפשר לאחד הזמנות אורח לחשבון רק אחרי הוכחת בעלות על האימייל. שמות ובקשות מוצגים רק לבעל ההרשאה; כלי תמיכה לא חושפים תוכן כברירת מחדל.

## 6. מערכת ניהול מקצועית — לא דמו
תפריט צד עם קבוצות מתקפלות, RTL/שפות, חיפוש גלובלי, breadcrumbs, קיצורי דרך, permission-aware UI, טבלאות מהירות, פילטרים, export, פעולות קבוצתיות, מודלים טובים למובייל. דשבורד כללי יוקרתי וקריא, לא גרפי דוגמה ללא משמעות.

### מודולים
1. Overview: revenue, orders, delivered, queued, failure rate, chargebacks, active graves/devices, device health, paper low, geography, language, currency, repeat rate, funnel, conversion, AOV, real revenue vs refunds, KPIs לפי תקופה וביחס לתקופה קודמת. הבחנה בין 'קוויטלעך' ל-'הזמנות' כדי לא להכפיל. drill-down לכל KPI.
2. Graves CMS: יצירה, עריכה, פרסום, מיקום/מפה, כתובות, שמות חלופיים, טקסטים לפי שפה, גלריה, זכויות צילום, ציון האם קיים אישור התקנה, מי מפעיל אותו, חגים/שעות לפי אזור זמן, מחיר, פרטי תחזוקה, סטטוס שירות. תצוגה ציבורית מקדימה לפני פרסום. תמיכה בכמה מכשירים לציון אחד ובשיוך/ניתוק מכשירים לאורך זמן.
3. Orders: טבלה עם status, payment, ציון, סכום, מקור, תאריך, מזהים; details עם תתי הזמנות/print jobs לכל ציון; טיפול בתקלה, ניסיון חוזר בטוח, החזר מלא/חלקי מאושר, audit trail. ללא חשיפת בקשות רגישות ברשימות וללא לוג תוכן.
4. Customers: רשומים ואורחים, הסכמות תקשורת, היסטוריה מותרת, תפקידים, מחיקת מידע והורדת נתונים. אי אפשר לצפות בתוכן אישי בלי הרשאה עסקית ספציפית ו-audit.
5. Pricing & Promotions: מחיר ברירת מחדל, overrides לפי ציון/מדינה/תאריך/מטבע, חבילות כמה ציונים, מספר עמודים, תיעוד וידאו, קופונים, הגבלת שימוש, כיבוי מבצע, תוקף, versioning ו-price history. מחיר snapshot נעול בזמן הזמנה.
6. Finance: סכומי gross/net, processing fees, מסים, refunds, partner splits, payouts, reconciliation, invoices דרך provider, export CSV. הפרדה בין נתונים אמיתיים ל-demo.
7. Device Fleet: health, online, last_seen, internet latency, signal strength, AC power presence כשהחומרה תומכת, backup battery, paper %, near-end, paper-end, cover-open, cutter-fault, print failures, optical sensor, camera, software version, logs sanitized, maintenance due, firmware rollouts. רשימת מכשירים + דף מכשיר + timeline events + פעולות מרחוק ברשאות.
8. Maintenance & Alerts: תקלה/חיישן/החלפת גליל/ניקוי/סוללה, tickets, SLA, escalation, assignee, reminder logic, predictive paper depletion, service logs, תמונות תחזוקה, spare parts, handoff.
9. Partners: גוף אחראי לציון/טכנאי מקומי/מפעיל, גישה מוגבלת לפי grave IDs, payouts agreements, שפת ממשק, כתובות קשר, דיווחים; ללא חשיפת תוכן קוויטלעך.
10. Content / SEO: דפי תוכן, שאלות נפוצות, ביו מקורות, מדינות, אוספי ציונים, הילולות, metadata לכל שפה, טקסטים מערכתיים, הודעות, banners, שיווק בהסכמה.
11. Settings: מיתוג/לוגו, שפות פעילות, מטבעות, checkout provider, payment webhook settings, mail, camera retention, privacy retention, notifications, שבת/חגים, תבניות הדפסה, roles/permissions, audit logs, feature flags, API keys מאובטחים, device provisioning, environment config.
12. Support & Audit: תמיכה בהזמנות, תחקור ללא גישה יתרה לבקשות, journal לפעולות רגישות, impersonation אם בכלל — רק בהרשאה מדוקדקת ומתועד.

כל המודולים יוצגו כניווט עקבי ולא כ-50 טאבים פתוחים. לא למלא ב-placeholder שאינו עובד; מודולים עתידיים יכולים להיות מסומנים 'בפיתוח' אך ה-schema/permissions/interfaces יתוכננו כבר עכשיו.

## 7. ניהול התקנים פיזיים — אפיון לבקר Raspberry Pi

יחידת שטח: עמוד כ-24×24 ס"מ ובגובה כ-100 ס"מ (תכנון קונספטואלי), מדפסת תרמית קומפקטית עם גליל פנימי 58 מ"מ, Full Cut מאומת, חיבור USB/Serial; מגירת שירות, דלת צד נעולה, תעלת נפילה סגורה לפתח קוויטלעך מאחורי הציון, חיישן מעבר, מצלמה אופציונלית. דגמי בדיקה: Cashino EP-261C / EP-260C / SPRT SP-RME3 / SNR EP5803; **אין להניח שמנגנון eject, Near-End או פרוטוקול סטטוס קיים ללא אימות הדגם בפועל**. אל תכתוב hardcoded driver לדגם שלא חובר ונבדק.

### רכיבי תוכנה
- `device-agent` נפרד ב-Python או Node ל-Linux על Raspberry Pi Zero 2 W/דגם נבחר, עם `PrinterAdapter` ממשק מחליף: `MockPrinterAdapter`, `EscPosRasterAdapter`, ובהמשך `VendorSpecificAdapter`. יכול לקבל bitmap/raster data משרת או לרנדר מקומית בצורה דטרמיניסטית לפי החלטת ארכיטקטורה. חיבור יוצא בלבד לשרת עם device credentials, TLS, unique device ID, token rotation, provisioning code חד-פעמי, revoke, אין inbound ports פתוחים.
- Transport MQTT מאובטח או persistent WebSocket/HTTPS polling + ack; reconnect אוטומטי, backoff, offline queue, heartbeat timestamp, שליחת telemetry, גרסאות, פקודות חתומות ומוגבלות.
- Device states: online/offline, network type, wifi signal, modem if any, boot uptime, power supply / UPS sensor if installed, paper end, near end, cover open, temperature if sensor, cutter status אם נחשף, chute passage optical sensor, camera state, print job state. הצג `unsupported / unknown` בשדות שאינם מדידים, לא 100% מזויף.
- Paper remaining % בשלב ראשון דרך paper-length accounting מאז החלפת גליל (קוטר חיצוני, קוטר ליבה, עובי נייר, אורך מודפס + feed/cut לכל משימה, calibration), כולל uncertainty; חיישן near-end כבקרת חצייה. בהמשך radius sensor. חיזוי days-to-empty לפי rolling average + עליית ביקוש סביב הילולא. alert כאשר days-to-empty קטן מהזמן הנדרש לתחזוקה, גם אם האחוז גבוה.
- Paper path: `start print -> print complete reported -> cut requested/confirmed if supported -> optical chute sensor observed -> delivery confirmed`. חיישן עליון אינו בהכרח מאשר שהפתק הגיע לתא; אם אין end sensor, ציין במפורש רמת confidence. במקרה ambiguous stop automatic replay וצרף `uncertain` לטיפול ידני, כדי לא להכפיל קוויטלעך.
- Queue semantics: server-side idempotent command IDs, per-device serialized execution, ack/lease, expiration, append-only device events, replay safety, bounded local spool. חיבור מחדש לא גורם להדפסה כפולה; תכנן תרחישי power loss / ack lost / sensor timeout.
- רינדור למדפסת: raster דו-כיווני כולל עברית/יידיש/קירילית/צרפתית, רזולוציה פיזית לדגם, preview matching, safe margins, maximum ticket length, paper feed/cut. אל תדפיס תוכן בקשות בלוגים.
- Device simulator מלא עם knobs: disconnect, no paper, low paper, cutter jam, sensor fail, AC off, internet loss, double callback, reboot mid-print. בנה `device-simulator` ואפשר לצוות לבצע E2E בלי חומרה אמיתית.
- Command operations: test print, resume/pause, reboot agent, restart service, clear error after verification, diagnostics, config update, signed OTA canary rollout and rollback. לא לחשוף shell execution חופשי דרך admin UI. OTA עם release channels ו-health confirmation; שינויים קטלניים מחייבים הרשאה.
- חיבור תקשורת וחשמל: להבחין בבירור בין `heartbeat missed` לבין `AC power failure confirmed by supported hardware`; התקן עם גיבוי קצר יכול לשלוח על נפילת מתח, אבל אם אין — אי אפשר לדעת סיבה רק מאובדן קשר. תכנן מפרט חיישנים ורשימת BOM בנפרד.
- camera add-on: מצלמה המצלמת **רק את אזור יציאת הקוויטל** ולא אנשים, clip קצר triggered per job, secure object storage, signed URL, customer-only viewing, retention limit, opt-in/notice, shutter/privacy considerations. בזמן שאין צילום, אל תציע תיעוד.
- שעות עבודה לפי TZ של הציון, blackout windows לשבת וימים טובים לפי מדיניות הציון; ניהול המועדים בצורה אמינה ומתועדת, הפרדת payment accepted מסימון delivered, סגירת שירות בזמן תחזוקה.

## 8. ארכיטקטורה ובסיס נתונים

בחר Stack פרגמטי, יציב ושכיח, וכתוב ADR קצר לכל בחירה מרכזית. המלצת מוצא: Next.js App Router + React + TypeScript strict + Tailwind עם tokens / shadcn primitives בהתאמה עמוקה (לא UI גנרי) + next-intl + PostgreSQL + Drizzle או Prisma + Zod + TanStack Query היכן שנדרש + BullMQ עם Redis אם queue נדרש ב-MVP, או מערכת תורים עמידה אחרת עם הצדקה. Auth.js/ספק מאובטח תואם; Stripe/Adyen/Tranzila או provider אחר רק לאחר בדיקת התאמה לישות הסולקת; adapter לסליקה.

אפשר monorepo עם `apps/web`, `apps/device-agent`, `packages/db`, `packages/types`, `packages/print-layout`, `packages/ui`, `packages/config` ו-`infra`, אם המחיר המורכבויות מוצדק. אין חובה ל-Docker עבור Windows; ספק פקודות `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build` עם DB בענן או local. Deployment ל-Railway/DigitalOcean/Vercel בהתאם ל-services בפועל עם background worker נפרד. secrets ב-env בלבד, אין מפתחות בריפו.

**מודל דומיין מינימלי מורחב, עם migrations/constraints/indexes:**
- `users`, `profiles`, `sessions`, `roles`, `permissions`, `role_assignments`, `user_consents`, `audit_logs`
- `graves`, `grave_translations`, `grave_aliases`, `grave_media`, `countries`, `locations`, `grave_schedules`, `grave_hilulot`, `grave_operators`, `grave_requests`
- `devices`, `device_credentials`, `device_assignments`, `device_telemetry`, `device_events`, `device_commands`, `firmware_releases`, `rollouts`, `device_config`
- `paper_rolls`, `paper_roll_changes`, `printer_profiles`, `sensor_readings`, `maintenance_tickets`, `alerts`, `alert_rules`, `notifications`
- `orders`, `order_items`, `kvittels`, `kvittel_people`, `kvittel_files`, `print_jobs`, `print_attempts`, `proof_media`, `order_tracking_tokens`
- `payments`, `payment_events`, `refunds`, `prices`, `price_versions`, `discounts`, `coupons`, `currency_rates`, `partner_agreements`, `partner_settlements`
- `saved_people`, `saved_templates`, `favorite_graves`, `scheduled_deliveries`, `reminder_subscriptions`
- `pages`, `translations`, `seo_metadata`, `email_templates`, `feature_flags`
- זיקה בין אובייקטים, מזהים יציבים, UTC במסד + TZ IANA לכל ציון, minor units לכסף, snapshot חוקי של מחיר, soft deletion/retention מותאם, encryption לשדות רגישים ובקרות גישה בשרת. אל תשמור פרטי כרטיס אשראי. אל תגדיר JSON blob במקום קשרי דומיין קריטיים.

**חשוב**: אין חובה ליצור את כל הטבלאות העתידיות ביום הראשון אם הן אינן משמשות עדיין, אבל תכנן את ה-domain boundaries/ממשקים וה-roadmap באופן שלא יצטרכו לשכתב את מודל ההזמנות/התקנים/שפות בהרחבה. הוסף indexes לחיפוש ושאילתות הדשבורד; schema versioning ו-migrations בטוחים.

## 9. אבטחה, פרטיות, אמינות ותשלומים

- API server-side authorization לכל פעולה כולל device/partner scopes; RBAC עם `super_admin`, `admin`, `finance`, `support_limited`, `content_editor`, `partner_manager`, `local_maintainer`, `customer`. least privilege.
- קוויטלעך עשויים לכלול מידע רגיש על בריאות, אמונה ומשפחה; פרטיות by design, הצפנה במנוחה ובתעבורה, הגבלת גישה לתוכן, retention בר-ניהול, מחיקה/ייצוא, logging redaction, ללא בקשות גלויות ב-analytics/URL/error monitoring. בדוק צורך במסמכי privacy/GDPR עם ייעוץ משפטי; **אל תצהיר שיש ציות משפטי מלא רק כי נוסף טקסט באתר**.
- Abuse protection: rate limits, CAPTCHA אחרי סיכון, anti-bot על checkout/auth, XSS/CSRF/SSRF הגנות, upload scanning/type-size constraints, signed uploads, webhook signature verification, idempotent payment processing.
- תשלום: amount from server, signed webhooks, refunds with audit, double-charge and partial failure tests. אל תחייב בלי credentials/sandbox מאושר.
- ניהול צילום: אין חשיפה ציבורית של תיעודי לקוחות; footage no people, TTL, secure access, audit. סטטוסים ותיעוד אמיתיים בלבד.
- Observability: logs sanitized, traces, metrics, health checks, background job queue health, retry/dead-letter, alerts and runbooks. backup DB, restore drill instructions, privacy incident response.
- עסקית: דף terms, privacy, refunds, cookie controls, disclosure 'המסירה פיזית בלבד ולא תפילה אישית של אדם', שעות ושבתות, הסכמת אחראי הציון; מקום לאישורי התקנה.

## 10. שותפים ותחזוקה בעולם

Partner portal scoped to assigned sites with alerts, paper replacement confirmation (including photo optional), consumables, local contact info, tickets, reports, agreed revenue share (if enabled), language preferences. No access to private prayer content. Partner settlement history built in future-ready structure. נהל תאריך שירות, כמות גלילים מתאימה, מחיר, משלוחים/מלאי, predictive forecast. תכנן bulk operations והחלפת מכשיר בציון בלי לאבד הזמנות והיסטוריה. צור מערכת onboarding/provisioning באתר למתקן חדש עם QR/pairing code, GPS/location asserted by admin (not auto trusted), activation test print, live verification, device replacement/revocation.

## 11. הרחבות עתידיות — תשתית עכשיו, הפעלה בשלבים

- subscriptions/repeating sends באישור מפורש, חידוש ידני/אוטומטי עם שקיפות וחיובים מותרים.
- אירועי הילולא, Hebrew calendar, עונות שיא ותזכורות מותרות.
- חבילות ציונים, bulk orders למוסדות, CSV upload לאחר בדיקות, API מוגן ו-usage limits.
- Gift a kvittel, קבוצות משפחתיות, שיתוף תבניות לפי הסכמה (לא חשיפת בקשות).
- AI writing assistant אופציונלי, ללא המצאת שמות או הבטחות; AI translation של תוכן מערכת עם workflow review human-in-the-loop, לעולם לא להעביר בקשות אישיות למודל ללא הסכמה מפורשת.
- סרטון מסירה פרטי, consent, watermark/retention, pay-per-video אם בוחרים.
- Mobile PWA, saved reminders, push opt-in, QR code על כל עמוד שמוביל ישירות לדף הציון, multi-tenant partner/franchise future.
- ביקוש לציונים ללא התקנה + heatmap ל-prioritization, profitability by grave, procurement & logistics.
- AB tests/analytics privacy-aware, coupon/referrals, country landing pages, multi-currency, regional payment methods.
- מודל עבודה עתידי מול נותן שירות אנושי עבור ציונים בלי מכשיר — **שירות נפרד ומסומן**, לא להציג כהדפסה מיידית.

## 12. מסכים חובה — בנה ולא רק תאר

**ציבורי**: home hero, search/results, country browse, grave detail, kvittel builder live preview, multi-grave picker, cart/checkout, success/tracking, unavailable/scheduled state, FAQ/how-it-works, login magic link, user profile/history, templates, saved names, favorites, settings/privacy.

**ניהול**: overview, grave list/create/edit detail, localization CMS, media upload, pricing, orders + detail + jobs, customer overview, devices fleet/device detail/telemetry/chart, alerts/maintenance, device pairing, finance, partner management, content pages, settings/roles/feature flags/audit.

**מפעיל מקומי**: assigned grave status, paper remaining, change-roll workflow, incident tickets, maintenance history, test print with authorization.

לכל מסך: loading, empty, error, offline, success, mobile/desktop states. עבור מסכים שתלויים באינטגרציה חיצונית — demo mode אינטראקטיבי עובד ומסומן, עם נתוני seed שאינם מוצגים כעובדות חיות.

## 13. דרישות UX מיוחדות

- תהליך שליחת קוויטל יסתיים בתוך 1–2 דקות עבור לקוח שיודע מה לכתוב (לא הבטחה מחייבת), ללא הרשמה, עם שמירת draft בזמן מעבר דפים.
- שמות ארוכים/כפולים, תווים בעברית עם ניקוד, קירילית, לועזית, יידיש, אימוג׳י לא תקינים במדפסת: validation ונרמול שקופים; אין אובדן של טקסט שהוקלד.
- תמונה/סריקה של כתב יד תישמר כתמונה מקורית ללא 'תיקון' AI שמשנה מילים. רק crop/rotation/contrast עם שליטת משתמש.
- עמוד ניהול עוצמתי אך לא עמוס: KPI drill-down, searchable tables, proper RTL, main page scroll vs nested sidebar scroll, no double-page scrolling, readable values beneath labels, tooltips מועילים אבל לא צפופים.
- כפתורי פעולה אמיתיים; אין faux interactions, טופס מזויף שמוביל להצלחה מזויפת, גרפים אקראיים שמסומנים כמספרים אמיתיים.

## 14. תיעוד ובדיקות קבלה

בנה fixtures/seed של 4–8 ציונים לצורך הדגמה (למשל קרעסטיר, ליז'נסק) עם סטטוס מפורש `DEMO` וללא תמונות/מיקומים לא מאומתים. מכשירים והזמנות דמה יהיו ניתנים לסימולציה מלוח הבקרה בסביבת פיתוח בלבד.

**אמת בכל milestone:**
1. `pnpm build`, lint, typecheck עוברים (או פקודות שוות-ערך).
2. E2E אורח: בחירת ציון → טופס בעברית → preview → תשלום mock → יצירת הזמנה → print job → simulator ACK/optical signal → status delivered; ושוב עם המדפסת מנותקת ועם uncertain case.
3. E2E admin: יצירת ציון, תרגומים ב-4 שפות, תמונות, מחיר, פרסום, provisioning מכשיר, סימולציית heartbeat, low-paper alert, change-roll action, חיפוש בהזמנות.
4. E2E guest/account: אין הרשמה חובה, magic link mock, טמפלייט נשמר רק בהסכמה, אורח לא יכול לראות הזמנות של אחרים, partner לא רואה ציון לא משויך.
5. בדיקות snapshot ו-screenshots he/en/fr/ru ב-mobile/tablet/desktop; אין גלישה רוחבית, אין text overflow, RTL מדויק. בדוק יידיש בקומפוננטות הבסיס ו-Cyrillic font.
6. Core security tests webhook replay, payment redirect spoof, device token invalid, duplicate job, unauthorized role access, upload invalid, SQL injection basic defenses, sensitive logging absence.
7. Performance: public pages fast, image optimization, lazy load, progressive enhancement, Core Web Vitals & Lighthouse יעד >=90 performance/accessibility בציוד/רשת סבירים תוך תיעוד חריגים. לא לטעון לציון שלא נמדד.

## 15. תכנית ביצוע עם אבני דרך ברורות

**M0 — Architecture + Design Sprint**: סקירת ריפו, החלטות stack, docs, Design System, 2 visual concepts, טיפוגרפיה, design tokens, shell, auth skeleton, i18n 4 languages, DB/seed, simulator baseline.

**M1 — Public Experience**: דף בית מושקע באמת, חיפוש וסינונים, כרטיסים, דף ציון, בונה קוויטל עם preview raster-like, מובייל מדהים, פריסה רב-לשונית, מבחני עיצוב.

**M2 — Orders & Checkout**: סל מרובה ציונים, מחירון, checkout provider adapter + sandbox/mock, מסך מעקב, הודעות מייל, account optional, privacy.

**M3 — Device Control Plane**: device registry, pairing, secure API, protocol, simulator, queue, idempotency, device health, paper prediction, optical confirmation, error handling, fleet UI.

**M4 — Admin & CMS**: ציונים/מדינות/תוכן/מדיה/מחירים/הזמנות/תפקידים/דשבורד אנליטיקה, logs.

**M5 — Customers, Partners, Maintenance**: היסטוריה, תבניות, שמות מועדפים, maintenance workflows, local operator portal, alerts, partner roles and settlement groundwork.

**M6 — Internationalization Expansion + Quality**: ביקורת שפות he/en/fr/ru מלאה; enable yi/es/pt/de רק לאחר השלמת תרגומים ובדיקת שפה, SEO, monitoring, release readiness, QA/security/performance.

**M7 — Future Flags**: camera video proofs, hilula scheduler, multi-grave packages/partner API, AI copy helper, scheduled deliveries, OTA release manager, advanced finance. בנה interfaces/database boundaries כבר קודם, והפעל לפי דגלים.

אל תנסה לבצע בבת אחת 'הכול 100%' באופן שמייצר קוד לא נבדק. אך **אל תעצור לאחר אפיון או skeleton**. השלם milestones עובדים ברצף ככל שהסביבה מאפשרת; אם מגבלה אמיתית מונעת אינטגרציה, השלם adapter + simulator + tests ותעד במדויק מה חסר.

## 16. תוצרים נדרשים

- ריפו מסודר, קוד עובד, migrations, seed, מדריך הפעלה `README.md`, `.env.example`, `CLAUDE.md` לעבודה עתידית, קובץ roadmap/checklist מתעדכן.
- Design system מושקע, דמו ויזואלי מהוקצע בכל שפות הליבה, תמונות מסך של mobile/desktop, dashboard ציבורי/ניהולי עובד.
- OpenAPI או contract ברור לשרת, device protocol, simulator, unit/E2E/integration tests, CI checks.
- מדריך התקנת device-agent על Raspberry Pi, רשימת hardware/BOM כאפשרויות ולא עובדות מאומתות, הוראות provisioning, תחזוקה והחלפת גליל, security checklist.
- טבלת 'Implemented / Simulated / Awaiting external service / Future' לכל יכולת מהותית. כל חיבור והבטחה חייבים לשקף מצב אמיתי.

## 17. הוראה סופית

**השקע מאמץ יוצא דופן בעיצוב.** זה מוצר פרימיום אמיתי: אם מסך נראה כמו תבנית SaaS רגילה, שנה אותו. השתמש בטיפוגרפיה ברמה גבוהה, קומפוזיציה חזקה, צילום אמין, עיצוב עשיר ולא עמוס, חוויית קוויטל ייחודית, מעבר יפה בין RTL/LTR, ודיוק בפרטים עד לרמת microcopy, focus states ו-mobile spacing.

התחל עכשיו בסקירה קצרה של הפרויקט והכלים, צור תוכנית עבודה ומערכת עיצוב, **ומיד עבור למימוש אמיתי**. אל תשאל שאלות כלליות שכבר הוגדרו כאן; קבל החלטות מקצועיות סבירות ותעד אותן. שאל רק אם באמת חסר סוד/הרשאה/בחירה עסקית החוסמים פעולה בלתי הפיכה. אל תכין מצגת במקום אתר. אל תסתיר חוסרים מאחורי mock. הבן את חוויית הקוויטל מהאתר ועד לפתח הפיזי בציון, ובנה את כל השכבות כך שיוכלו לצמוח למאות ציונים בשפות רבות.
