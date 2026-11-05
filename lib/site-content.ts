import { LINKS, VERIFIED_AT, CAMPAIGN, FAQ, GUIDE_MEDIA, GUIDE_VIDEO } from './content';

export const DEFAULT_CONTENT = {
  siteName: 'مساعد أكواد نسك',
  description: 'أداة مستقلة مجانية لتسهيل نسخ أكواد تحدي نسك ومتابعتها، مع دليل وروابط رسمية ومعلومات موثقة عن المسابقة.',
  developerName: 'أحمد عيد',
  prayerTitle: 'لو الأداة نفعتك، افتكرنا بدعوة طيبة.',
  prayerBody: 'ادعُ لي ولوالديّ بظهر الغيب. ربنا يكتب لنا ولكم زيارة بيته الحرام.',
  home: { eyebrow:'أكوادك ودليلك، في مكان واحد', title:'كودك التالي،', highlight:'بخطوة أسهل.', description:'انسخ كودًا، استخدمه داخل نسك، وارجع كمّل من مكانك. هنساعدك تتابع من غير ما تتوه بين الأكواد.' },
  links: { ...LINKS },
  verifiedAt: VERIFIED_AT,
  campaign: {
    ...CAMPAIGN,
    intro:'المشاركة متاحة من جميع أنحاء العالم وفق إعلان نسك. شروط التحدي داخل التطبيق هي المرجع للأهلية والفرص.',
    umrahTitle:'فائز يوميًا،\nوعمرة لشخصين.',
    umrahDescription:'للفائز ومرافق يختاره، وتشمل التأشيرة وتذاكر الطيران وإقامة ١٠ ليالٍ في مكة والمدينة.',
    zamzamTitle:'١٠ فائزين يوميًا،\n٢٠ كرتونة لكل فائز.',
    zamzamDescription:'١٠ كراتين للفائز، و١٠ يهديها لعشرة أشخاص يختارهم، بحسب الإعلان.',
    totals:'الإجمالي المعلن للحملة: ١٠٠ رحلة عمرة و١٠٬٠٠٠ كرتون زمزم. لا نستنتج تاريخ النهاية من هذه الأعداد.',
    startDisplay:'١ نوفمبر ٢٠٢٦',
    dateNote:'الإعلان الرسمي يذكر الانطلاق يوم الأحد. لم يحدد الإعلان الذي راجعناه تاريخ نهاية المسابقة؛ مدة إتاحة هذه الأداة مستقلة عن مدة الحملة.',
  },
  update: {
    visible:true, status:'unverified' as 'unverified' | 'verified', title:'هل الحد اليومي أصبح ٣٠٠ فرصة؟',
    body:'تتداول منشورات فيسبوك رفع الحد إلى ٣٠٠ فرصة يوميًا، وتنسب المعلومة إلى إدارة العناية بالمستفيدين بوزارة الحج والعمرة. لم يتوفر لدينا رابط الرد الرسمي الأصلي للتحقق من صحة النسبة أو تفاصيلها.',
    caution:'لا نؤكد أن «٣٠٠ فرصة» تعني «٣٠٠ سؤال»، ولا أن كل إجابة تؤهل تلقائيًا للسحب. راجع الشروط والعدد الظاهر داخل التحدي، أو تواصل مع دعم نسك.',
    sourceLabel:'منشورات فيسبوك؛ الرد الرسمي الأصلي غير متاح.', sourceUrl:'', verifiedAt:VERIFIED_AT,
  },
  guideSteps: [
    {num:'١',title:'حمّل التطبيق الرسمي',body:'اختار متجر جهازك من الروابط الرسمية أدناه. لو التطبيق موجود، تأكد من تحديثه من المتجر.',icon:'download'},
    {num:'٢',title:'افتح التحدي واقرأ شروطه',body:'سجّل الدخول في نسك وادخل إلى قسم التحدي أو المسابقة المتاح بحسابك. راجع طريقة كسب الفرص والحدود الموضحة فيه.',icon:'gift'},
    {num:'٣',title:'انسخ كودًا من هنا',body:'اختار «نسخ الكود» أو «نسخ وفتح نسك». ارجع للتطبيق والصق الكود في المكان المخصص لإضافة المفتاح أو الكود بحسب واجهته.',icon:'copy'},
    {num:'٤',title:'راجع رسالة التطبيق',body:'لو تم قبوله، ارجع وعلّمه «تم استخدامه». لو اترفض، اختار «لم يعمل معي»، أو تخطّاه وكمّل. القبول يحدده نسك.',icon:'check'},
  ],
  guideMedia: {...GUIDE_MEDIA} as Record<string,{src:string;alt:string}>,
  guideVideo: GUIDE_VIDEO as {src:string;poster?:string;title:string}|null,
  faq: FAQ.map(([q,a])=>[q,a] as [string,string]),
};
export type SiteContent = typeof DEFAULT_CONTENT;
export type SiteSettings = { autoApprove: boolean; submissionsEnabled: boolean; revision:number; codesRevision:number; updatedAt:string; content:SiteContent };
export function defaultSettings(): SiteSettings {
  return {autoApprove:true,submissionsEnabled:true,revision:1,codesRevision:1,updatedAt:VERIFIED_AT,content:structuredClone(DEFAULT_CONTENT)};
}
function text(v:unknown,name:string,max=3000,empty=false): asserts v is string {
  if(typeof v!=='string'||(!empty&&!v.trim())||v.length>max)throw new Error('قيمة غير صالحة: '+name);
}
function webUrl(v:unknown,name:string,optional=false,local=false) {
  text(v,name,2000,optional);if(v==='')return;
  if(local && /^\/(?!\/)[^\\]*$/.test(v as string))return;
  try{const u=new URL(v as string);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw new Error('الرابط يجب أن يبدأ بـ https://: '+name);}
}
function timestamp(v:unknown,name:string){text(v,name,50);if(!/^\d{4}-\d\d-\d\dT/.test(v as string)||!Number.isFinite(Date.parse(v as string)))throw new Error('تاريخ غير صالح: '+name);}
export function validateContent(raw:unknown): SiteContent {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('المحتوى غير صالح.');
  const c=structuredClone(raw) as SiteContent;
  for(const k of ['siteName','description','developerName','prayerTitle','prayerBody'] as const)text(c[k],k,k==='siteName'?100:1000);
  if(!c.home||!c.links||!c.campaign||!c.update)throw new Error('أقسام المحتوى غير مكتملة.');
  for(const k of ['eyebrow','title','highlight','description'] as const)text(c.home[k],'home.'+k,1000);
  for(const k of Object.keys(DEFAULT_CONTENT.links) as (keyof typeof LINKS)[])webUrl(c.links[k],'links.'+k);
  timestamp(c.verifiedAt,'verifiedAt');
  for(const k of ['intro','umrahTitle','umrahDescription','zamzamTitle','zamzamDescription','totals','startDisplay','dateNote'] as const)text(c.campaign[k],'campaign.'+k);
  webUrl(c.campaign.startSource,'campaign.startSource');
  if(typeof c.update.visible!=='boolean'||!['verified','unverified'].includes(c.update.status))throw new Error('حالة التحديث غير صالحة.');
  for(const k of ['title','body','caution','sourceLabel'] as const)text(c.update[k],'update.'+k,3000,k==='caution');
  webUrl(c.update.sourceUrl,'update.sourceUrl',true);timestamp(c.update.verifiedAt,'update.verifiedAt');
  if(c.update.visible&&c.update.status==='verified'&&!c.update.sourceUrl)throw new Error('التحديث المؤكد يحتاج رابط مصدر رسمي.');
  if(!Array.isArray(c.guideSteps)||c.guideSteps.length!==4)throw new Error('الدليل يحتاج أربع خطوات.');
  for(let i=0;i<4;i++){const row=c.guideSteps[i];if(row.num!==DEFAULT_CONTENT.guideSteps[i].num)throw new Error('ترقيم الدليل غير صالح.');text(row.title,'guide.title',300);text(row.body,'guide.body');if(!['download','gift','copy','check','book','info'].includes(row.icon))throw new Error('أيقونة غير مدعومة.');}
  if(!c.guideMedia||typeof c.guideMedia!=='object'||Array.isArray(c.guideMedia))throw new Error('صور الدليل غير صالحة.');
  for(const [num,image]of Object.entries(c.guideMedia)){if(!c.guideSteps.some(s=>s.num===num))throw new Error('رقم صورة غير صالح.');webUrl(image.src,'guide.image',false,true);text(image.alt,'guide.alt',500);}
  if(c.guideVideo!==null){if(!c.guideVideo||typeof c.guideVideo!=='object')throw new Error('الفيديو غير صالح.');webUrl(c.guideVideo.src,'video.src',false,true);if(c.guideVideo.poster)webUrl(c.guideVideo.poster,'video.poster',true,true);text(c.guideVideo.title,'video.title',300);}
  if(!Array.isArray(c.faq)||c.faq.length>20)throw new Error('الأسئلة الشائعة غير صالحة.');
  for(const row of c.faq){if(!Array.isArray(row)||row.length!==2)throw new Error('سؤال غير صالح.');text(row[0],'faq.question',500);text(row[1],'faq.answer');}
  return c;
}
