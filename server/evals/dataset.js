const group = (category, expectedTools, questions, extra = {}) =>
  questions.map((question, index) => ({ id: `${category}-${index + 1}`, category, language: /[\u0600-\u06FF]/.test(question) ? "ar" : "en", question, expected_tools: expectedTools, ...extra }));

export const evaluationDataset = [
  ...group("busy_quiet_days", ["get_daily_sales"], [
    "How busy are we today?", "Are sales quiet today?", "Give me today's order summary", "How is the restaurant performing today?",
    "هل المطعم مزدحم اليوم؟", "هل المبيعات هادئة اليوم؟", "أعطني ملخص طلبات اليوم", "كيف أداء المطعم اليوم؟"
  ]),
  ...group("menu_profitability", ["get_low_performance_items"], [
    "Which dish is losing money?", "Show the weakest menu margins", "What menu item hurts profit?", "Which dishes underperform?",
    "ما الطبق الذي يسبب خسارة؟", "اعرض أضعف هوامش القائمة", "أي طبق يضر الأرباح؟", "ما الأطباق ضعيفة الأداء؟"
  ]),
  ...group("low_inventory", ["get_inventory_status"], [
    "What stock is running out?", "Show low inventory", "What ingredients need reordering?", "Will anything run out tonight?",
    "ما المخزون الذي سينفد؟", "اعرض عناصر المخزون الناقصة", "ما المكونات التي تحتاج إعادة طلب؟", "هل سينفد شيء الليلة؟"
  ]),
  ...group("missing_data", [], [
    "What was customer satisfaction last year?", "How much food waste did we record?", "Compare us with the restaurant next door", "What will the weather do to patio sales?",
    "ما مستوى رضا العملاء العام الماضي؟", "كم هدر الطعام المسجل؟", "قارن مطعمي بالمطعم المجاور", "كيف سيؤثر الطقس على مبيعات الجلسات الخارجية؟"
  ], { must_not_invent_numbers: true }),
  ...group("refund_anomalies", ["get_refund_summary"], [
    "Are refunds unusually high this week?", "How much did we refund this month?", "What are the top refund reasons?", "Review today's refunds",
    "هل المرتجعات مرتفعة هذا الأسبوع؟", "كم مبلغ الاسترداد هذا الشهر؟", "ما أسباب الاسترداد الأكثر شيوعاً؟", "راجع عمليات الاسترداد اليوم"
  ]),
  ...group("staffing_decisions", ["get_daily_sales", "suggest_staffing"], [
    "Do we need more staff tonight?", "Should I add a server for dinner?", "Is standard staffing enough today?", "How many cooks do we need tonight?",
    "هل أحتاج موظفين إضافيين الليلة؟", "هل أضيف نادلاً للعشاء؟", "هل عدد الموظفين المعتاد كافٍ اليوم؟", "كم طباخاً نحتاج الليلة؟"
  ]),
  ...group("bilingual_broad_decisions", ["get_daily_sales", "get_low_performance_items", "get_inventory_status"], [
    "What needs my attention?", "What is the top priority today?", "Where is the biggest operational risk?", "Give me the manager brief",
    "ما الذي يحتاج إلى انتباهي؟", "ما الأولوية اليوم؟", "أين أكبر خطر تشغيلي؟", "أعطني موجز المدير"
  ]),
  ...group("menu_actions_requiring_confirmation", ["flag_menu_item"], [
    "Deactivate the Lobster Pasta dish", "Disable this menu item", "أوقف طبق Lobster Pasta", "عطّل هذا العنصر"
  ], { requires_confirmation: true }),
  ...group("report_actions_requiring_confirmation", ["create_report"], [
    "Create a weekly report", "Create today's operating report", "أنشئ تقرير الأسبوع", "أنشئ تقرير تشغيل اليوم"
  ], { requires_confirmation: true })
];
