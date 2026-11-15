/**
 * DRAFT legal/content pages. These are working drafts that MUST be reviewed by
 * qualified counsel per operating jurisdiction before launch. Publishing text
 * does not by itself make the service compliant.
 */
type T = { title: string; body: string };
export const LEGAL_PAGES: Array<{ slug: string; tr: Record<"he" | "en" | "fr" | "ru", T> }> = [
  {
    slug: "delivery-disclosure",
    tr: {
      he: {
        title: "מה בדיוק אנחנו מספקים",
        body: "השירות מספק **מסירה פיזית** של הקוויטל שכתבתם: הדפסה על נייר תרמי בעמדה המוצבת באישור אחראי הציון, חיתוך, והחדרה דרך תעלה סגורה אל הפתח המיועד לקוויטלעך.\n\nזו אינה תפילה של אדם אחר בשמכם, ואיננו מבטיחים תוצאה רוחנית כלשהי.\n\nסטטוס \"נמסר\" מוצג רק לאחר אישור מהחומרה. כאשר אין אישור חיישן, נציין זאת במפורש. השירות פועל לפי שעות הציון, ואינו פועל בשבתות ובימים טובים.",
      },
      en: {
        title: "What exactly we provide",
        body: "The service provides **physical delivery** of the kvittel you wrote: it is printed on thermal paper at a unit installed with the permission of the site's caretakers, cut, and guided through a closed chute into the designated kvittel opening.\n\nIt is not a prayer said on your behalf by another person, and we make no promise of any spiritual outcome.\n\n\"Delivered\" is shown only after hardware confirmation. Where no sensor confirmation exists, we say so explicitly. Service follows each site's hours and does not operate on Shabbat or Yom Tov.",
      },
      fr: {
        title: "Ce que nous fournissons exactement",
        body: "Le service assure la **remise physique** du kvitel que vous avez écrit : impression sur papier thermique par une borne installée avec l'accord des responsables du lieu, découpe, puis acheminement par une goulotte fermée jusqu'à l'ouverture prévue pour les kvitlekh.\n\nIl ne s'agit pas d'une prière dite en votre nom par une autre personne, et nous ne promettons aucun résultat spirituel.\n\nLe statut « Remis » n'apparaît qu'après confirmation matérielle. En l'absence de confirmation par capteur, nous l'indiquons clairement. Le service suit les horaires de chaque lieu et ne fonctionne ni le Chabbat ni les jours de fête.",
      },
      ru: {
        title: "Что именно мы предоставляем",
        body: "Сервис обеспечивает **физическую доставку** написанного вами квитла: печать на термобумаге в терминале, установленном с разрешения смотрителей места, отрезание и подачу по закрытому лотку в предназначенное для квитлах отверстие.\n\nЭто не молитва, произносимая за вас другим человеком, и мы не обещаем никакого духовного результата.\n\nСтатус «Доставлено» показывается только после подтверждения оборудованием. Если подтверждения датчика нет, мы прямо об этом сообщаем. Сервис работает по часам каждого места и не работает в Шаббат и праздники.",
      },
    },
  },
  {
    slug: "privacy",
    tr: {
      he: {
        title: "מדיניות פרטיות (טיוטה)",
        body: "**טיוטה — טעונה בדיקה משפטית לפני השקה.**\n\nשמות ובקשות עלולים לכלול מידע רגיש על בריאות, אמונה ומשפחה. לכן:\n\n- תוכן הקוויטל מוצפן במנוחה ומפוענח רק לצורך הדפסה.\n- התוכן אינו נכתב ללוגים, לאנליטיקה או לכתובות URL.\n- צוות התמיכה אינו רואה תוכן כברירת מחדל.\n- תוכן נמחק אוטומטית לאחר תקופת שמירה מוגדרת (ברירת מחדל: 30 יום לאחר המסירה).\n- ניתן לבקש ייצוא או מחיקה של המידע בכל עת.\n\nאיננו שומרים פרטי כרטיס אשראי; התשלום מתבצע אצל ספק סליקה.",
      },
      en: {
        title: "Privacy policy (draft)",
        body: "**Draft — requires legal review before launch.**\n\nNames and requests may include sensitive information about health, faith and family. Therefore:\n\n- Kvittel content is encrypted at rest and decrypted only for printing.\n- Content is never written to logs, analytics or URLs.\n- Support staff cannot see content by default.\n- Content is deleted automatically after a configured retention period (default: 30 days after delivery).\n- You may request export or deletion of your data at any time.\n\nWe never store card details; payment is handled by a payment provider.",
      },
      fr: {
        title: "Politique de confidentialité (projet)",
        body: "**Projet — à faire valider juridiquement avant le lancement.**\n\nLes noms et les demandes peuvent contenir des informations sensibles sur la santé, la foi et la famille. C'est pourquoi :\n\n- Le contenu du kvitel est chiffré au repos et déchiffré uniquement pour l'impression.\n- Le contenu n'apparaît jamais dans les journaux, les statistiques ou les URL.\n- Le support n'a pas accès au contenu par défaut.\n- Le contenu est supprimé automatiquement après une durée de conservation définie (par défaut : 30 jours après la remise).\n- Vous pouvez demander l'export ou la suppression de vos données à tout moment.\n\nNous ne conservons jamais de données de carte ; le paiement est traité par un prestataire.",
      },
      ru: {
        title: "Политика конфиденциальности (проект)",
        body: "**Проект — требует юридической проверки перед запуском.**\n\nИмена и просьбы могут содержать чувствительные сведения о здоровье, вере и семье. Поэтому:\n\n- Содержимое квитла хранится в зашифрованном виде и расшифровывается только для печати.\n- Содержимое никогда не попадает в логи, аналитику или URL.\n- Служба поддержки по умолчанию не видит содержимое.\n- Содержимое автоматически удаляется после заданного срока хранения (по умолчанию — 30 дней после доставки).\n- Вы можете в любой момент запросить выгрузку или удаление данных.\n\nМы не храним данные карт; оплату обрабатывает платёжный провайдер.",
      },
    },
  },
  {
    slug: "refunds",
    tr: {
      he: { title: "מדיניות החזרים (טיוטה)", body: "**טיוטה — טעונה בדיקה משפטית.**\n\n- אם הקוויטל לא נמסר עקב תקלה, השהיית שירות או תחזוקה — תוצע מסירה מתוזמנת או החזר מלא.\n- במקרה של מסירה \"לא ודאית\" (ללא אישור חיישן) — הצוות בודק ידנית; לא תתבצע הדפסה כפולה אוטומטית.\n- לאחר מסירה מאושרת לא ניתן לבטל." },
      en: { title: "Refund policy (draft)", body: "**Draft — requires legal review.**\n\n- If your kvittel was not delivered due to a fault, service pause or maintenance, you will be offered a scheduled delivery or a full refund.\n- If delivery is \"uncertain\" (no sensor confirmation), our team reviews it manually; we never automatically print twice.\n- Confirmed deliveries cannot be cancelled." },
      fr: { title: "Politique de remboursement (projet)", body: "**Projet — à valider juridiquement.**\n\n- Si votre kvitel n'a pas été remis en raison d'une panne, d'une suspension ou d'une maintenance, une remise programmée ou un remboursement intégral vous sera proposé.\n- En cas de remise « incertaine » (sans confirmation du capteur), notre équipe vérifie manuellement ; nous n'imprimons jamais deux fois automatiquement.\n- Une remise confirmée ne peut pas être annulée." },
      ru: { title: "Политика возврата (проект)", body: "**Проект — требует юридической проверки.**\n\n- Если квитл не был доставлен из-за неисправности, приостановки или обслуживания, мы предложим доставку по расписанию или полный возврат.\n- Если доставка «не подтверждена» (нет подтверждения датчика), команда проверяет её вручную; повторная печать автоматически не выполняется.\n- Подтверждённую доставку отменить нельзя." },
    },
  },
  {
    slug: "terms",
    tr: {
      he: { title: "תנאי שימוש (טיוטה)", body: "**טיוטה — טעונה בדיקה משפטית.**\n\nהשירות מספק הדפסה ומסירה פיזית בלבד, בכפוף לזמינות הציון, לאישור אחראי המקום ולשעות הפעילות. המחיר הסופי מוצג לפני התשלום ונשמר כחלק מההזמנה. אין להשתמש בשירות לתוכן פוגעני או בלתי חוקי." },
      en: { title: "Terms of service (draft)", body: "**Draft — requires legal review.**\n\nThe service provides printing and physical delivery only, subject to site availability, the caretakers' permission and service hours. The final price is shown before payment and stored with your order. The service may not be used for abusive or unlawful content." },
      fr: { title: "Conditions d'utilisation (projet)", body: "**Projet — à valider juridiquement.**\n\nLe service fournit uniquement l'impression et la remise physique, sous réserve de la disponibilité du lieu, de l'accord des responsables et des horaires. Le prix final est affiché avant le paiement et conservé avec la commande. Le service ne peut être utilisé pour un contenu injurieux ou illégal." },
      ru: { title: "Условия использования (проект)", body: "**Проект — требует юридической проверки.**\n\nСервис предоставляет только печать и физическую доставку, в зависимости от доступности места, разрешения смотрителей и часов работы. Итоговая цена показывается до оплаты и сохраняется в заказе. Запрещено использовать сервис для оскорбительного или незаконного содержания." },
    },
  },
];
