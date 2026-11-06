'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icon';
import { CONTENT_VERSION, verificationDate } from '@/lib/content';
import { DEFAULT_CONTENT, validateContent, type SiteContent } from '@/lib/site-content';
import { CODE_PATTERN, PROGRESS_KEY, decodeProgress, extractCode, freshProgress, mergeProgress, nextPending, type CodeState, type Progress } from '@/lib/progress';
import legacyCodes from '@/data/legacy-codes.json';

type Tab = 'home' | 'codes' | 'guide' | 'campaign' | 'contribute';
type Filter = 'all' | 'pending' | CodeState | 'new' | 'today';
type CodeItem = { code: string; created_at: string | null; added_at?: string | null };
const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'home', name: 'الرئيسية', icon: 'home' }, { id: 'codes', name: 'الأكواد', icon: 'key' },
  { id: 'guide', name: 'الدليل', icon: 'book' }, { id: 'campaign', name: 'المسابقة', icon: 'gift' },
  { id: 'contribute', name: 'شارك كودك', icon: 'plus' },
];
const STATE_LABELS: Record<CodeState, string> = { copied: 'منسوخ', used: 'مستخدم', skipped: 'متخطّي', failed: 'لم يعمل معي' };
const n = (v: number) => v.toLocaleString('ar-EG');
const cairoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', dateStyle: 'short' });
function External({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<Icon name="external" /></a>;
}
function Stamp({ source = true, content, at }: { source?: boolean; content: SiteContent; at?:string }) {
  const date=at||content.verifiedAt;
  return <div className="source-stamp"><span><Icon name="clock" /> آخر تحقق: <time dateTime={date}>{verificationDate(date)}</time> · القاهرة</span>{source && <External href={content.links.announcement}>الإعلان الرسمي</External>}</div>;
}
type HelperProps={initialCodes:string[];initialItems?:CodeItem[];initialContent?:SiteContent;initialLive?:boolean;initialReady?:boolean;initialAutoApprove?:boolean;initialEtag?:string;initialError?:string};
export default function HelperApp({ initialCodes,initialItems,initialContent=DEFAULT_CONTENT,initialLive=false,initialReady=false,initialAutoApprove=true,initialEtag='',initialError='' }:HelperProps) {
  const [content,setContent]=useState<SiteContent>(initialContent);
  const [autoApprove,setAutoApprove]=useState(initialAutoApprove);
  const [dataError,setDataError]=useState(initialError);
  const etagRef=useRef(initialEtag);
  const {links:LINKS,campaign:CAMPAIGN,faq:FAQ,guideMedia:GUIDE_MEDIA,guideVideo:GUIDE_VIDEO}=content;
  useEffect(()=>{document.title=content.siteName;},[content.siteName]);
  const [tab, setTab] = useState<Tab>('home');
  const [items, setItems] = useState<CodeItem[]>(initialItems||initialCodes.map(code => ({ code, created_at: null })));
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const progressRef = useRef<Progress>(freshProgress());
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [today, setToday] = useState('');
  const [visits, setVisits] = useState<number | null>(null);
  const visitRequested = useRef(false);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [undo, setUndo] = useState<Progress | null>(null);
  const [view, setView] = useState<'single' | 'list'>('single');
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const copyLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const [liveReady, setLiveReady] = useState(initialReady);
  const [listMessage, setListMessage] = useState(initialLive?'الأكواد متصلة بقاعدة البيانات.':'قائمة المعاينة المحلية متاحة.');
  const [newVersion, setNewVersion] = useState(false);
  const manualDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualTrack, setManualTrack] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [reportResult, setReportResult] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  const codes = useMemo(() => items.map(i => i.code), [items]);
  const knownCodes = useMemo(() => new Set(codes), [codes]);
  const current = progress.current && knownCodes.has(progress.current) ? progress.current : nextPending(codes, progress);
  const state = current ? progress.states[current] : undefined;
  const counts = useMemo(() => {
    const result = { copied: 0, used: 0, skipped: 0, failed: 0, pending: 0 };
    for (const code of codes) { const s = progress.states[code]; if (s) result[s]++; else result.pending++; }
    return result;
  }, [codes, progress]);
  const newCodes = useMemo(() => new Set(items.filter(i => baseline && i.created_at && Date.parse(i.created_at) > Date.parse(baseline)).map(i => i.code)), [items, baseline]);

  const todayCodes = useMemo(() => new Set(items.filter(item => {
    const added = item.added_at ? Date.parse(item.added_at) : NaN;
    return today && Number.isFinite(added) && cairoDate.format(added) === today;
  }).map(item => item.code)), [items, today]);

  useEffect(() => {
    setToday(cairoDate.format());
    if (location.protocol === 'file:' || visitRequested.current) return;
    visitRequested.current = true;
    void fetch('/api/visits', { method: 'POST', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (Number.isSafeInteger(data.visits) && data.visits >= 0) setVisits(data.visits);
      }).catch(() => { /* An unavailable counter should not affect browsing. */ });
  }, []);

  function toast(text: string) {
    setNotice(text); if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4500);
  }
  function persist(next: Progress, allowUndo = false) {
    if (allowUndo) setUndo(structuredClone(progressRef.current));
    progressRef.current = next; setProgress(next);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); setStorageWarning(''); }
    catch { setStorageWarning('تعذر حفظ التقدم على هذا المتصفح. صدّر نسخة احتياطية قبل إغلاق الصفحة.'); }
  }
  function setCodeState(code: string, nextState: CodeState) {
    const old = progressRef.current;
    persist({ ...old, current: code, states: { ...old.states, [code]: nextState } }, true);
    setReportResult('');
  }
  function go(next: Tab) {
    setTab(next); history.replaceState(null, '', '#' + next);
    requestAnimationFrame(() => document.getElementById('main')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  async function refresh(showToast = false) {
    if (refreshLock.current) return;
    if (location.protocol === 'file:') { setListMessage('القائمة متاحة في هذه المعاينة المحلية. التحديثات المشتركة متاحة عبر رابط الموقع بعد نشره.'); return; }
    refreshLock.current = true; setRefreshing(true);
    try {
      const response = await fetch('/api/codes', { cache: 'no-store',headers:etagRef.current?{'If-None-Match':etagRef.current}:{} });
      if(response.status===304){setDataError('');if(showToast)toast('القائمة والمحتوى محدثان بالفعل.');return;}
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.codes) || data.codes.some((i: CodeItem) => !i || typeof i.code !== 'string' || !CODE_PATTERN.test(i.code))) throw new Error();
      setItems([...new Map<string, CodeItem>(data.codes.map((i: CodeItem) => [i.code, i])).values()]);
      setLiveReady(Boolean(data.acceptingSubmissions));
      setAutoApprove(Boolean(data.autoApprove));
      if(data.content)setContent(validateContent(data.content));
      etagRef.current=data.etag||response.headers.get('etag')||'';
      setDataError('');
      setListMessage('تم تحديث الأكواد والمحتوى من قاعدة البيانات.');
      if (data.contentVersion && data.contentVersion !== CONTENT_VERSION) setNewVersion(true);
      if (showToast) toast('تم تحديث الأكواد والمحتوى مع الاحتفاظ بتقدمك.');
    } catch { setListMessage('تعذر جلب التحديث. يمكنك متابعة القائمة المحفوظة في هذه الصفحة.'); if (showToast) toast('تعذر الاتصال؛ تقدمك محفوظ محليًا.'); }
    finally { refreshLock.current = false; setRefreshing(false); }
  }
  useEffect(() => {
    let next = freshProgress();
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) next = decodeProgress(JSON.parse(saved));
      else {
        const previous = localStorage.getItem('nusuk_codes_progress_v2');
        if (previous) next = decodeProgress(JSON.parse(previous));
        else {
          const v1 = JSON.parse(localStorage.getItem('nusuk_codes_copied_v1') || '[]');
          if (Array.isArray(v1)) for (const i of v1) if (Number.isInteger(i) && i >= 0 && i < 922 && legacyCodes[i + 1]) next.states[legacyCodes[i + 1]] = 'copied';
        }
      }
      setBaseline(next.lastSeenAt);
      next.lastSeenAt = new Date().toISOString();
      if (!next.current || !initialCodes.includes(next.current)) next.current = nextPending(initialCodes, next);
      persist(next);
    } catch { setStorageWarning('تعذر قراءة التقدم المحفوظ. لم نكتب فوقه؛ يمكنك استيراد نسخة احتياطية أو متابعة استخدام الموقع.'); }
    setLoaded(true);
    const syncTab = () => { const id = location.hash.slice(1); if (TABS.some(t => t.id === id)) setTab(id as Tab); };
    syncTab();
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== PROGRESS_KEY || !event.newValue) return;
      try { const value = decodeProgress(JSON.parse(event.newValue)); progressRef.current = value; setProgress(value); setUndo(null); } catch { /* Ignore a malformed write from another tab. */ }
    };
    const resume = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(cairoDate.format());
      void refresh();
    };
    const poll=window.setInterval(resume,45000);
    window.addEventListener('hashchange', syncTab); window.addEventListener('storage', syncStorage); document.addEventListener('visibilitychange', resume);
    void refresh();
    return () => { window.clearInterval(poll); window.removeEventListener('hashchange', syncTab); window.removeEventListener('storage', syncStorage); document.removeEventListener('visibilitychange', resume); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
    // Initialize once; use refs for progress in async handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(code: string, openApp = false, track = true) {
    if (copyLock.current) return; copyLock.current = true; setBusy(true);
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(code);
      if (track && progressRef.current.states[code] !== 'used') setCodeState(code, 'copied');
      toast('تم النسخ. الصق الكود داخل نسك وراجع النتيجة.');
      if (openApp) window.location.assign(LINKS.app);
    } catch { setManualCode(code); setManualTrack(track); manualDialog.current?.showModal(); }
    finally { setBusy(false); copyLock.current = false; }
  }
  function moveNext() {
    const next = nextPending(codes, progressRef.current, current);
    if (!next) { toast('لا توجد أكواد غير معلّمة. يمكنك مراجعة المتخطّي أو بقية القائمة.'); return; }
    persist({ ...progressRef.current, current: next }, true); setReportResult('');
  }
  async function shareSite() {
    if (location.protocol === 'file:') { toast('مشاركة رابط الموقع متاحة بعد نشره.'); return; }
    const url = location.origin + '/';
    try { if (navigator.share) await navigator.share({ title: content.siteName, text: 'أداة مجانية للأكواد والمتابعة مع دليل وروابط نسك الرسمية.', url }); else { await navigator.clipboard.writeText(url); toast('تم نسخ رابط الموقع.'); } }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) toast('تعذرت المشاركة. يمكنك نسخ رابط الموقع من شريط العنوان.'); }
  }
  function exportProgress() {
    const blob = new Blob([JSON.stringify({ ...progressRef.current, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'nusuk-progress-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('تم تجهيز نسخة التقدم. احتفظ بها في مكان آمن.');
  }
  async function importProgress(file?: File) {
    if (!file) return;
    try { if (file.size > 2_000_000) throw new Error('الملف كبير جدًا. الحد ٢ ميجابايت.'); const imported = decodeProgress(JSON.parse(await file.text())); persist(mergeProgress(progressRef.current, imported), true); toast('تم دمج النسخة الاحتياطية مع تقدمك.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'تعذر استيراد الملف.'); }
    if (importRef.current) importRef.current.value = '';
  }
  async function submitCode(event: React.FormEvent) {
    event.preventDefault(); if (submitBusy) return;
    const code = extractCode(submitText); if (!code) { setSubmitResult('ألصق كودًا واحدًا بصيغة NG- وثمانية أحرف أو أرقام، أو رسالة تحتوي على كود واحد.'); return; }
    setSubmitBusy(true); setSubmitResult('');
    try {
      const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await response.json(); setSubmitResult(data.message || 'تعذر إرسال الكود.');
      if (response.ok) { if(response.status===201)void refresh();setSubmitText(''); }
    } catch { setSubmitResult('تعذر الاتصال. لم يتم تأكيد الإرسال؛ حاول لاحقًا.'); }
    finally { setSubmitBusy(false); }
  }
  async function sendReport() {
    if (!current || reportBusy) return;
    setReportBusy(true);
    try {
      const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: current, reason: 'not_working' }) });
      const data = await response.json(); setReportResult(data.message || 'تعذر إرسال البلاغ.');
    } catch { setReportResult('تعذر الاتصال. حالة الكود عندك محفوظة، لكن البلاغ لم يتأكد إرساله.'); }
    finally { setReportBusy(false); }
  }
  const normalizedQuery = query.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLowerCase();
  const filtered = useMemo(() => items.filter((item, i) => {
    const s = progress.states[item.code];
    const match = filter === 'all' || (filter === 'pending' ? !s : filter === 'new' ? newCodes.has(item.code) : filter === 'today' ? todayCodes.has(item.code) : s === filter);
    const queryMatches = !normalizedQuery || (/^#?\d+$/.test(normalizedQuery) ? String(i + 1) === normalizedQuery.replace(/^#/, '') : item.code.toLowerCase().includes(normalizedQuery));
    return match && queryMatches;
  }), [items, progress, filter, newCodes, todayCodes, normalizedQuery]);

  return <>
    <a href="#main" className="skip-link">انتقل للمحتوى</a>
    <header className="site-header"><div className="shell header-inner"><button className="brand" onClick={() => go('home')} aria-label={content.siteName+" — الرئيسية"}><span className="brand-symbol"><Icon name="key" /></span><span><b>{content.siteName}</b><small>مبادرة مستقلة مجانية</small></span></button><External className="header-official" href={LINKS.platform}>نسك الرسمي</External></div></header>
    <nav className="navigation" aria-label="أقسام الموقع"><div className="shell nav-inner">{TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} className={tab === t.id ? 'nav-item active' : 'nav-item'} onClick={() => go(t.id)}><Icon name={t.icon}/><span>{t.name}</span></button>)}</div></nav>
    <main id="main" className="shell main" tabIndex={-1}>
      {dataError && <p className="alert" role="alert"><Icon name="info"/>{dataError} حدّث الصفحة بعد استعادة الاتصال أو تنفيذ الترقية.</p>}
      {storageWarning && <p className="alert" role="alert"><Icon name="info"/>{storageWarning}</p>}
      {newVersion && <div className="update-bar" role="status"><span>نسخة أحدث من الموقع متاحة.</span><button className="link-button" onClick={() => location.reload()}>تحديث مع الاحتفاظ بالتقدم</button></div>}
      <section hidden={tab !== 'home'} aria-labelledby="home-title">
        <div className="hero"><div className="hero-copy"><span className="eyebrow"><span className="tiny-dot"/> {content.home.eyebrow}</span><h1 id="home-title">{content.home.title}<br/><em>{content.home.highlight}</em></h1><p>{content.home.description}</p><div className="hero-buttons"><button className="button gold" onClick={() => go('codes')}><Icon name="key"/>{loaded && Object.keys(progress.states).length ? 'كمّل من مكانك' : 'ابدأ بالأكواد'}<Icon name="arrow"/></button><button className="button hero-secondary" onClick={() => go('guide')}>أول مرة؟ شوف الطريقة</button></div><div className="hero-foot"><Icon name="check"/> من غير حساب <span>·</span> تقدمك على جهازك <span>·</span> مجاني</div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="ticket-preview"><div className="ticket-eyebrow"><Icon name="key"/> كود، وخطوة لقدّام</div><div className="ticket-code">{codes[0]||"…"}</div><div className="ticket-tear"/><div className="ticket-copy"><Icon name="copy"/> نسخ بسهولة</div><span className="ticket-mark"><Icon name="check"/> مكانك محفوظ</span></div></div></div>
        <div className="quick-stats"><div><Icon name="key"/><span><strong>{n(codes.length)}</strong><small>كود في القائمة</small></span></div><div><Icon name="book"/><span><strong>خطوات واضحة</strong><small>دليل وروابط رسمية</small></span></div><div><Icon name="heart"/><span><strong>مساعدة مجانية</strong><small>دعوة طيبة تكفينا</small></span></div></div>
        {loaded && Object.keys(progress.states).length > 0 && <div className="resume-strip"><div><span className="eyebrow">أهلًا بعودتك</span><b>متبقي {n(counts.pending)} كود غير معلّم</b><p>عدادات متابعة شخصية، وليست عدد فرص السحب.</p></div><button className="button light" onClick={() => go('codes')}>كمّل <Icon name="arrow"/></button></div>}
        <div className="section-heading"><div><span className="eyebrow">تبدأ منين؟</span><h2>ثلاث خطوات، وكمّل براحتك.</h2></div><button className="link-button" onClick={() => go('guide')}>الدليل <Icon name="arrow"/></button></div>
        <div className="steps-grid">{[['١','اعرف مكان الكود','افتح التحدي داخل نسك وراجع تعليماته.'],['٢','انسخ واستخدم','الصق الكود في المكان المخصص وراجع الرسالة.'],['٣','ارجع وكمّل','علّم حالته عندك، وانتقل لأول كود متبقٍ.']].map(([num,title,body]) => <article className="step-card" key={num}><span className="step-number">{num}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className="campaign-teaser"><span className="teaser-icon"><Icon name="gift"/></span><div><span className="eyebrow">من إعلان نسك الرسمي</span><h2>فرحة تتشاركها مع اللي تحب.</h2><p>سحب يومي على عمرة لشخصين وجوائز زمزم. اعرف التفاصيل ومصدر كل معلومة.</p></div><button className="button light" onClick={() => go('campaign')}>عن المسابقة <Icon name="arrow"/></button></div>
        <div className="trust-note"><Icon name="info"/><p>الأداة مستقلة عن نسك. قبول الأكواد وفرص السحب وشروط المشاركة يحددها التطبيق؛ متابعة النسخ هنا لا تؤكد قبول الكود أو الفوز.</p></div>
      </section>

      <section hidden={tab !== 'codes'} aria-labelledby="codes-title">
        <div className="page-heading"><div><span className="eyebrow">كود ورا كود</span><h1 id="codes-title">كمّل من مكانك.</h1><p>المنسوخ والمستخدم حالات بتحددها أنت لمتابعتك.</p></div><button className="icon-button" onClick={() => void refresh(true)} disabled={refreshing} aria-label="تحديث قائمة الأكواد"><Icon name="undo"/></button></div>
        {today && <button className="today-codes-badge" onClick={() => { setView('list'); setFilter('today'); setQuery(''); setLimit(40); }}>
          <Icon name="plus"/> جديد اليوم · {n(todayCodes.size)} كود
        </button>}
        <div className="mode-switch" role="group" aria-label="طريقة عرض الأكواد"><button aria-pressed={view === 'single'} onClick={() => setView('single')}>كود بكود</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>القائمة والبحث</button></div>
        <div className="codes-layout"><div>
        {view === 'single' ? <div className="current-card"><div className="current-top"><span><span className="tiny-dot"/> {current ? 'الكود الحالي' : 'أنهيت غير المعلّم'}</span><span className={'state-badge ' + (state || '')}>{state ? STATE_LABELS[state] : 'لسه ما اتنسخش'}</span></div>{current ? <><div className="big-code" dir="ltr">{current}</div>{todayCodes.has(current) && <span className="code-today-label">جديد اليوم</span>}<p className="code-position">رقم {n(codes.indexOf(current) + 1)} من {n(codes.length)} · القائمة لا تؤكد الصلاحية</p><div className="copy-actions"><button className="button primary" disabled={busy || !loaded} onClick={() => void copy(current)}><Icon name="copy"/>نسخ الكود</button><button className="button light" disabled={busy || !loaded} onClick={() => void copy(current, true)}><Icon name="external"/>نسخ وفتح نسك</button></div><p className="helper-text">بعد الفتح، الصق الكود داخل التحدي. الموقع لا يملأه تلقائيًا.</p><div className="return-actions"><span>رجعت من التطبيق؟ علّم حالة الكود:</span><div><button aria-pressed={state === 'used'} onClick={() => { setCodeState(current, 'used'); toast('سجلنا استخدامه عندك. اختار التالي لما تكون جاهز.'); }}><Icon name="check"/>تم استخدامه</button><button aria-pressed={state === 'failed'} onClick={() => setCodeState(current, 'failed')}>لم يعمل معي</button><button aria-pressed={state === 'skipped'} onClick={() => setCodeState(current, 'skipped')}>تخطي</button></div></div>{state === 'failed' && <div className="report-box"><p>الحالة محفوظة عندك. تقدر تبعت بلاغ للمراجعة؛ ده لا يحذف الكود عند الجميع.</p><button className="link-button" disabled={!liveReady || reportBusy} onClick={() => void sendReport()}>{reportBusy ? 'جاري الإرسال…' : liveReady ? 'إرسال بلاغ للمراجعة' : 'استقبال البلاغات غير متاح حاليًا'}</button><p role="status">{reportResult}</p></div>}<div className="next-actions"><button className="button next-button" onClick={moveNext} disabled={!loaded}>الكود التالي <Icon name="arrow"/></button><button className="undo-button" disabled={!undo} onClick={() => { if (undo) { persist(undo); setUndo(null); toast('تم التراجع عن آخر تغيير.'); } }}><Icon name="undo"/> تراجع</button></div></> : <div className="completed"><Icon name="check"/><h2>لا توجد أكواد غير معلّمة حاليًا.</h2><p>راجع الأكواد المتخطّاة أو جرّب تحديث القائمة للجديد.</p><button className="button light" onClick={() => { setView('list'); setFilter('all'); }}>راجع القائمة</button></div>}</div>
        : <div className="list-card"><label className="search-box"><Icon name="search"/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(40); }} placeholder="ابحث بالكود أو رقمه…" aria-label="بحث بالكود أو رقمه" autoCapitalize="off" spellCheck={false}/></label><div className="filter-chips" role="group" aria-label="تصفية قائمة الأكواد">{([['pending','المتبقي'],['all','الكل'],['copied','المنسوخ'],['used','المستخدم'],['skipped','المتخطّي'],['failed','لم يعمل'],['new','من آخر زيارة'],['today','جديد اليوم']] as [Filter,string][]).map(([id,label]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setLimit(40); }}>{label}{id === 'new' && newCodes.size > 0 ? ' '+n(newCodes.size) : id === 'today' ? ' '+n(todayCodes.size) : ''}</button>)}</div><div className="list-meta">{n(filtered.length)} نتيجة <span>·</span> الترتيب داخل القائمة الحالية</div><ol className="code-list">{filtered.slice(0,limit).map(item => <li key={item.code} className={progress.states[item.code] ? 'has-state' : ''}><span className="row-number">{n(codes.indexOf(item.code)+1)}</span><div className="row-code"><code dir="ltr">{item.code}</code>{todayCodes.has(item.code) && <span className="code-today-label">جديد اليوم</span>}<small>{progress.states[item.code] ? STATE_LABELS[progress.states[item.code]] : newCodes.has(item.code) ? 'جديد منذ آخر زيارة' : 'غير معلّم'}</small></div><button className="row-open" aria-label={'عرض الكود '+item.code} onClick={() => { persist({ ...progressRef.current, current: item.code }, true); setView('single'); }}>عرض</button><button className="row-copy" disabled={busy || !loaded} aria-label={'نسخ الكود '+item.code} onClick={() => void copy(item.code)}><Icon name="copy"/></button></li>)}</ol>{filtered.length === 0 && <div className="empty-state"><Icon name="search"/><p>لا توجد أكواد مطابقة لهذا الاختيار.</p><button className="link-button" onClick={() => { setQuery(''); setFilter('all'); }}>عرض كل الأكواد</button></div>}{limit < filtered.length && <button className="button light load-more" onClick={() => setLimit(v => v+40)}>عرض ٤٠ كودًا إضافيًا</button>}</div>}
        <p className="sync-status"><Icon name="clock"/>{listMessage}</p></div>
        <aside className="progress-aside"><div className="progress-card"><span className="eyebrow">متابعتك الشخصية</span><h2>خطوة بخطوة.</h2><div className="progress-number">{n(counts.used)} <span>كود معلّم كمستخدم</span></div><div className="progress-track" role="progressbar" aria-label="الأكواد المعلّمة كمستخدمة" aria-valuenow={counts.used} aria-valuemin={0} aria-valuemax={codes.length}><span style={{width: (codes.length ? counts.used/codes.length*100 : 0)+'%'}}/></div><dl className="progress-breakdown"><div><dt>غير معلّم</dt><dd>{n(counts.pending)}</dd></div><div><dt>منسوخ فقط</dt><dd>{n(counts.copied)}</dd></div><div><dt>متخطّي</dt><dd>{n(counts.skipped)}</dd></div><div><dt>لم يعمل معك</dt><dd>{n(counts.failed)}</dd></div></dl><p>دي متابعة لاستخدامك، مش عدد فرص السحب.</p></div><details className="backup-menu"><summary>حفظ التقدم ونقله</summary><p>على نفس الجهاز والمتصفح، أو بملف احتياطي تنقله بنفسك.</p><button onClick={exportProgress}><Icon name="download"/>تصدير التقدم</button><button onClick={() => importRef.current?.click()}><Icon name="upload"/>استيراد نسخة سابقة</button><button className="danger-link" onClick={() => resetDialog.current?.showModal()}>إعادة تعيين التقدم</button><input hidden type="file" accept="application/json,.json" ref={importRef} onChange={e => void importProgress(e.target.files?.[0])}/></details><button className="text-help" onClick={() => go('guide')}><Icon name="book"/> محتاج مساعدة؟ افتح الدليل <Icon name="arrow"/></button></aside></div>
      </section>

      <section hidden={tab !== 'guide'} aria-labelledby="guide-title"><div className="page-heading"><div><span className="eyebrow">معاك من أول خطوة</span><h1 id="guide-title">الطريقة، ببساطة.</h1><p>افتح نسك، راجع تعليمات التحدي، وبعدها ابدأ الأكواد.</p></div></div><div className="guide-layout"><div className="guide-steps">{content.guideSteps.map(({num,title,body,icon}) => <article className="guide-step" key={num}><span className="step-number">{num}</span><div><h2>{title}</h2><p>{body}</p>{GUIDE_MEDIA[num] && <a className="guide-image-link" href={GUIDE_MEDIA[num].src} target="_blank" rel="noopener noreferrer" aria-label={"تكبير صورة: " + title}><img src={GUIDE_MEDIA[num].src} alt={GUIDE_MEDIA[num].alt} loading="lazy" decoding="async" className="guide-image"/></a>}{num === '٣' && <button className="link-button" onClick={() => go('codes')}>افتح الأكواد <Icon name="arrow"/></button>}</div><Icon name={icon}/></article>)}</div><aside><div className="download-card"><span className="icon-tile"><Icon name="download"/></span><h2>نسك على موبايلك</h2><p>روابط المتاجر مأخوذة من موقع نسك الرسمي.</p><External href={LINKS.android} className="store-link"><span><small>تحميل على Android</small><b>Google Play</b></span></External><External href={LINKS.ios} className="store-link"><span><small>تحميل على iPhone</small><b>App Store</b></span></External><External href={LINKS.platform} className="link-button">راجع موقع نسك</External></div><div className="help-card"><Icon name="info"/><p>لو أسماء الشاشات مختلفة عندك، اتبع تعليمات نسك الحالية. لا تشارك كلمة المرور أو رمز التحقق مع الموقع أو أي شخص.</p><External href={LINKS.support}>دعم نسك الرسمي</External></div></aside></div>{GUIDE_VIDEO && <section className="video-section"><h2>{GUIDE_VIDEO.title}</h2><video controls playsInline preload="none" poster={GUIDE_VIDEO.poster} aria-label={GUIDE_VIDEO.title}><source src={GUIDE_VIDEO.src}/><p>المتصفح لا يدعم عرض الفيديو. <a href={GUIDE_VIDEO.src}>افتح الفيديو</a></p></video></section>}<div className="section-heading"><div><span className="eyebrow">إجابات مختصرة</span><h2>ممكن تكون بتسأل…</h2></div></div><div className="faq-list">{FAQ.map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div><Stamp content={content} source={false}/></section>

      <section hidden={tab !== 'campaign'} aria-labelledby="campaign-title"><div className="page-heading"><div><span className="eyebrow">اعرف المعلومة ومصدرها</span><h1 id="campaign-title">عن مسابقة نسك.</h1><p>ملخص للإعلان الرسمي، وتحديثات واضحة الحالة.</p></div></div><div className="campaign-banner"><span className="verified-pill"><Icon name="check"/> من حساب نسك الموثق</span><h2>لك، ولمن تحب.</h2><p>{CAMPAIGN.intro}</p><External href={LINKS.announcement} className="button gold">اقرأ الإعلان الأصلي</External></div><div className="prize-grid"><article className="prize-card"><span className="icon-tile"><Icon name="gift"/></span><span className="eyebrow">جائزة العمرة</span><h2 className="multiline">{CAMPAIGN.umrahTitle}</h2><p>{CAMPAIGN.umrahDescription}</p><External href={LINKS.announcement}>المصدر: إعلان نسك</External></article><article className="prize-card water"><span className="icon-tile"><Icon name="water"/></span><span className="eyebrow">ماء زمزم المبارك</span><h2 className="multiline">{CAMPAIGN.zamzamTitle}</h2><p>{CAMPAIGN.zamzamDescription}</p><External href={LINKS.announcement}>المصدر: إعلان نسك</External></article></div><p className="campaign-totals">{CAMPAIGN.totals}</p><Stamp content={content}/>
        <div className="campaign-dates"><div><Icon name="clock"/><span><small>تاريخ البداية في التغطية الصحفية</small><b>{CAMPAIGN.startDisplay}</b></span><External href={CAMPAIGN.startSource}>التغطية</External></div><p>{CAMPAIGN.dateNote}</p></div>
        {content.update.visible && <article className={'unverified-update '+(content.update.status==='verified'?'verified-update':'')}><div className="update-heading"><span className="unverified-pill"><Icon name={content.update.status==='verified'?'check':'info'}/> {content.update.status==='verified'?'مؤكد بمصدر':'متداول · غير مؤكد رسميًا'}</span><span className="eyebrow">آخر تحديث للمعلومة</span></div><h2>{content.update.title}</h2><p>{content.update.body}</p><p><strong>{content.update.caution}</strong></p><div className="update-origin">المصدر: {content.update.sourceLabel}</div><Stamp content={content} at={content.update.verifiedAt} source={false}/>{content.update.sourceUrl?<External href={content.update.sourceUrl} className="link-button">افتح المصدر</External>:<External href={LINKS.support} className="link-button">تحقق من دعم نسك</External>}</article>}
        <div className="section-heading"><div><span className="eyebrow">من المنصة نفسها</span><h2>روابطك الرسمية، في مكان واحد.</h2></div></div><div className="official-links"><External href={LINKS.platform}><Icon name="home"/><span><b>منصة نسك</b><small>الموقع والخدمات الرسمية</small></span></External><External href={LINKS.app}><Icon name="external"/><span><b>فتح تطبيق نسك</b><small>الانتقال للتطبيق أو صفحة الوصول</small></span></External><External href={LINKS.download}><Icon name="download"/><span><b>تحميل التطبيق</b><small>رابط التحميل من إعلان نسك</small></span></External><External href={LINKS.support}><Icon name="info"/><span><b>الدعم والتواصل</b><small>الأسئلة المتعلقة بحسابك أو التحدي</small></span></External><External href={LINKS.faq}><Icon name="book"/><span><b>أسئلة نسك الشائعة</b><small>معلومات من المنصة</small></span></External><External href={LINKS.umrah}><Icon name="gift"/><span><b>رحلة العمرة</b><small>إرشادات وخدمات نسك للمعتمر</small></span></External></div><div className="trust-note"><Icon name="info"/><p>نسك يتيح خدمات العمرة والحج والروضة والإرشاد، بحسب موقعه الرسمي. هذه الأداة لا تصدر تصاريح ولا تنفذ المشاركة في السحب نيابة عنك.</p></div>
      </section>

      <section hidden={tab !== 'contribute'} aria-labelledby="contribute-title"><div className="page-heading"><div><span className="eyebrow">مساعدة منك، لغيرك</span><h1 id="contribute-title">شارك كودك بسهولة.</h1><p>أضف كودك من نسك إلى القائمة عشان غيرك يقدر يستخدمه.</p></div></div><div className="contribute-grid contribute-shared"><form className="submit-card" onSubmit={submitCode}><span className="icon-tile"><Icon name="plus"/></span><h2>أضف كودك للموقع.</h2><p>{autoApprove?"النشر التلقائي مفعّل: الكود الجديد يظهر مباشرة بعد التحقق من صيغته ومنع تكراره.":"الكود الجديد يمر بالمراجعة قبل ظهوره للجميع."} لا نحتاج اسمك أو رقم هاتفك أو بيانات حساب نسك.</p><label htmlFor="submit-code">كود أو رسالة مشاركة واحدة</label><textarea id="submit-code" rows={3} value={submitText} onChange={e => setSubmitText(e.target.value)} maxLength={2000} placeholder="ألصق رسالة المشاركة هنا…" dir="auto" required/><button className="button primary" type="submit" disabled={!liveReady || submitBusy}>{submitBusy ? 'جاري الإرسال…' : autoApprove?'إضافة ونشر الكود':'إرسال للمراجعة'}<Icon name="arrow"/></button>{!liveReady && <p className="inline-note">استقبال الأكواد الجديدة غير متاح حاليًا. حاول لاحقًا، وتقدر تستخدم قائمة الأكواد الموجودة.</p>}<p role="status" className="form-result">{submitResult}</p><details className="privacy-details"><summary>إيه اللي بيتحفظ عند الإرسال؟</summary><p>الكود وتاريخ إرساله وحالة مراجعته، ومعرّف مشفّر مؤقت لحدود الإرسال ومنع التكرار. لا نحتفظ بعنوان الشبكة الخام في قاعدة البيانات. مزوّد الاستضافة قد يحتفظ بسجلات تشغيله وفق سياسته.</p></details></form></div><div className="share-strip"><div><Icon name="share"/><span><b>تعرف حد محتاج الأداة؟</b><small>شارك الرابط باختيارك، يمكن تسهّل عليه.</small></span></div><button className="button light" onClick={() => void shareSite()}>مشاركة الموقع</button></div></section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><div className="prayer-line"><Icon name="heart"/><div><b>{content.prayerTitle}</b><p>{content.prayerBody}</p></div></div><div className="footer-bottom"><div><span>إعداد وتطوير {content.developerName}</span><small>مبادرة مستقلة، غير تابعة لتطبيق نسك.</small></div>{visits !== null && <small className="visit-total">زيارات الموقع · {n(visits)}</small>}<nav aria-label="روابط المطور"><External href={LINKS.linkedin}>عنّي وشغلي</External><External href={LINKS.github}>GitHub</External></nav></div></div></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
    <dialog className="app-dialog" ref={manualDialog} aria-labelledby="manual-title"><h2 id="manual-title">انسخ الكود يدويًا</h2><p>النسخ التلقائي غير متاح في هذا المتصفح. اضغط مطولًا على الحقل، وحدد الكود ثم انسخه.</p><textarea dir="ltr" readOnly value={manualCode} aria-label="الكود للنسخ اليدوي" onFocus={e => e.target.select()}/><div className="dialog-actions"><button className="button primary" onClick={() => { if(manualTrack)setCodeState(manualCode,'copied');manualDialog.current?.close();toast('تم تسجيل النسخ بتأكيدك.');}}>نسخته بالفعل</button><button className="button light" onClick={() => manualDialog.current?.close()}>إغلاق</button></div></dialog>
    <dialog className="app-dialog" ref={resetDialog} aria-labelledby="reset-title"><h2 id="reset-title">تبدأ المتابعة من جديد؟</h2><p>هنزيل حالات الأكواد من هذا الجهاز. تقدر تصدّر نسخة قبل ما تكمل.</p><button className="button light" onClick={exportProgress}>تصدير نسخة أولًا</button><div className="dialog-actions"><button className="button danger" onClick={() => { persist({...progressRef.current,states:{},current:codes[0]||null},true);resetDialog.current?.close();toast('تمت إعادة التعيين. يمكنك التراجع عن آخر تغيير.'); }}>إعادة التعيين</button><button className="button light" onClick={() => resetDialog.current?.close()}>إلغاء</button></div></dialog>
  </>;
}
