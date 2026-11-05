export const LINKS = {
  platform: 'https://www.nusuk.sa/',
  app: 'https://services.nusuk.sa/app?p=27',
  ios: 'https://apps.apple.com/sa/app/nusuk-%D9%86%D8%B3%D9%83/id6469515422',
  android: 'https://play.google.com/store/apps/details?id=com.moh.nusukapp',
  download: 'https://onelink.to/nusuk',
  announcement: 'https://www.facebook.com/MyNusuk/posts/pfbid034WZFCPLLjXcw8kTx1d8AwrZbCSX9q2dKZBr8MV9RVXvaBT6t1YC1uKdEHfYztcfHl',
  support: 'https://www.nusuk.sa/contact-us',
  faq: 'https://www.nusuk.sa/faq',
  umrah: 'https://www.nusuk.sa/umrah',
  linkedin: 'https://www.linkedin.com/in/eiido',
  github: 'https://github.com/eiido',
};
// A verification timestamp is a content revision, not the visitor's current time.
export const VERIFIED_AT = '2026-11-04T14:32:15Z';
export const CONTENT_VERSION = '2026-11-06.1';
// Add only real, redacted screenshots supplied by the owner, keyed by guide step number.
export const GUIDE_MEDIA: Record<string, { src: string; alt: string }> = {};
export const GUIDE_VIDEO: { src: string; poster?: string; title: string } | null = null;
export const CAMPAIGN = {
  start: '2026-11-01',
  startStatus: 'reported' as const,
  startSource: 'https://nabdapp.com/t/180223066-916a4c',
  end: null,
  dailyLimitStatus: 'unverified' as const,
  verificationNote: 'الإعلان الرسمي يؤكد الجوائز والمشاركة العالمية، ولا يوضح الحد اليومي للأسئلة أو الفرص ولا تاريخ نهاية المسابقة.',
};
export function verificationDate(value = VERIFIED_AT) {
  return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}
export const FAQ = [
  ['هل الموقع تابع لنسك؟', 'لا. هذه مبادرة شخصية مجانية من أحمد عيد لتسهيل نسخ الأكواد ومتابعتها. المشاركة والسحب والجوائز تتم داخل تطبيق نسك وبحسب شروطه.'],
  ['هل نسخ كود يعني أنه اتقبل في التطبيق؟', 'النسخ ينقل النص فقط. راجع رسالة نسك بعد إدخاله. «تم استخدامه» تأكيد منك لمتابعتك الشخصية، والموقع لا يقرأ نتيجة التطبيق.'],
  ['هل عدد الأكواد المنسوخة يساوي فرص السحب؟', 'لا. العدادات هنا لمتابعة استخدامك للموقع فقط. عدد الفرص وشروط اكتسابها والحد اليومي يوضحها نسك داخل التحدي.'],
  ['هل الحد اليومي أصبح ٣٠٠ سؤال أو فرصة؟', 'تتداول منشورات فيسبوك رقم ٣٠٠ فرصة وتنسبه إلى إدارة العناية بالمستفيدين. لم يتوفر الرد الرسمي الأصلي للتحقق، ولا نؤكد أن هذا يعني ٣٠٠ سؤال. راجع بطاقة التحديث المتداول وشروط التحدي داخل نسك.'],
  ['هل هلاقي تقدمي لو رجعت؟', 'نحفظ تقدمك على نفس المتصفح والجهاز. مسح بيانات المتصفح أو استخدام جهاز مختلف لا ينقل تقدمك؛ صدّر نسخة احتياطية من تاب الأكواد لاستيرادها لاحقًا.'],
  ['هل كل الأكواد صالحة؟', 'القائمة مستوردة من الملف الأصلي الذي جمع أكوادًا من تعليقات عامة. مطابقة الصيغة لا تؤكد قبول الكود أو استمرار صلاحيته. الإضافات الجديدة تظهر مباشرة أو بعد المراجعة وفق إعداد النشر الذي يحدده المدير.'],
];
