'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { extractCode } from '@/lib/progress';
import type { SiteSettings } from '@/lib/site-content';
import SettingsEditor from './settings-editor';
import Icon from './icon';

type Row = { id: string; code: string; status: string; created_at: string; deleted_at?: string | null };
type Report = { id: string; code: string; created_at: string; codeId: string | null; codeStatus: string | null };
type Section = 'overview' | 'codes' | 'reports' | 'settings';
type Stats = { approved: number; pending: number; rejected: number; deleted: number };
type Modal = { type: 'add' | 'logout' } | { type: 'actions' | 'edit' | 'delete'; row: Row };
type Notice = { text: string; kind: 'success' | 'error' } | null;
const labels: Record<string, string> = { approved: 'منشور', pending: 'بانتظار المراجعة', rejected: 'مرفوض', deleted: 'محذوف' };
const number = (n: number) => n.toLocaleString('ar-EG');
const date = (value: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export default function AdminPanel() {
  const [client] = useState<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key) : null;
  });
  const [token, setToken] = useState(''), [authResolved, setAuthResolved] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [codes, setCodes] = useState<Row[]>([]), [reports, setReports] = useState<Report[]>([]), [settings, setSettings] = useState<SiteSettings | null>(null);
  const [stats, setStats] = useState<Stats>({ approved: 0, pending: 0, rejected: 0, deleted: 0 });
  const [notice, setNotice] = useState<Notice>(null), [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [status, setStatus] = useState('all'), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [page, setPage] = useState(0), [reportPage, setReportPage] = useState(0), [count, setCount] = useState(0), [reportCount, setReportCount] = useState(0), [reload, setReload] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null), [codeText, setCodeText] = useState(''), [modalError, setModalError] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), tokenRef = useRef(''), pendingAction = useRef(false), requestSequence = useRef(0);
  const pageSize = 40;
  const total = stats.approved + stats.pending + stats.rejected + stats.deleted;
  const blocked = busy || loading;
  const titles: Record<Section, [string, string]> = {
    overview: ['نظرة عامة', 'تابع المبادرة، واعرف ما يحتاج انتباهك.'],
    codes: [status === 'deleted' ? 'المحذوفات' : 'إدارة الأكواد', status === 'deleted' ? 'الأكواد المخفية عن الزوار. تقدر تستعيدها وتنشرها من هنا.' : 'ابحث عن كود، راجع حالته، أو أضف كودًا جديدًا.'],
    reports: ['البلاغات', 'راجع ما أرسله المستخدمون واتخذ الإجراء المناسب.'],
    settings: ['الإعدادات والمحتوى', 'غيّر طريقة النشر ومحتوى الموقع، ثم احفظ تعديلاتك.'],
  };

  useEffect(() => {
    if (!client) { setAuthResolved(true); return; }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.access_token || ''; tokenRef.current = next; setToken(next); setAuthResolved(true);
      if (!next) { setReady(false); setCodes([]); setReports([]); setSettings(null); }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    if (!token) return;
    const seq = ++requestSequence.current; setLoading(true); setLoadError('');
    const controller = new AbortController();
    const options = { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' as RequestCache, signal: controller.signal };
    const params = new URLSearchParams({ status, q: query, page: String(page), reportPage: String(reportPage) });
    void (async () => {
      try {
        const [a, b] = await Promise.all([fetch('/api/admin/codes?' + params, options), fetch('/api/admin/settings', options)]);
        const [data, config] = await Promise.all([a.json(), b.json()]);
        if (seq !== requestSequence.current || tokenRef.current !== token) return;
        if (!a.ok || !b.ok) { setLoadError((!a.ok ? data.message : config.message) || 'تعذر تحميل لوحة الإدارة.'); return; }
        setCodes(data.codes); setReports(data.reports); setCount(data.count); setReportCount(data.reportCount); setStats(data.stats); setSettings(config); setReady(true);
        if (page > 0 && page * pageSize >= data.count) setPage(Math.max(0, Math.ceil(data.count / pageSize) - 1));
        if (reportPage > 0 && reportPage * pageSize >= data.reportCount) setReportPage(Math.max(0, Math.ceil(data.reportCount / pageSize) - 1));
      } catch (error) { if (seq === requestSequence.current && !controller.signal.aborted) setLoadError('تعذر الاتصال. بياناتك الحالية ما زالت ظاهرة؛ جرّب التحديث.'); }
      finally { if (seq === requestSequence.current && !controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [token, status, query, page, reportPage, reload]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 12000 : 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  function notify(text: string, kind: 'success' | 'error' = 'success') { setNotice({ text, kind }); }
  function refresh() { setReload(v => v + 1); }
  function navigate(next: Section, filter?: string) {
    setSection(next);
    if (next === 'codes' && filter !== undefined) { setStatus(filter); setPage(0); setSearch(''); setQuery(''); }
    if (next === 'reports') setReportPage(0);
    requestAnimationFrame(() => document.getElementById('admin-content')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  function openModal(next: Modal) {
    setModalError(''); setCodeText(next.type === 'edit' ? next.row.code : ''); setModal(next);
    requestAnimationFrame(() => {
      if (!dialog.current?.open) dialog.current?.showModal();
      if (next.type === 'add' || next.type === 'edit') dialog.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea,input')?.focus();
    });
  }
  function closeModal() { if (busy) return; dialog.current?.close(); setModal(null); setModalError(''); }
  function closeAfterSave() { dialog.current?.close(); setModal(null); setModalError(''); }
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!client || busy) return; setBusy(true); setNotice(null);
    try { const { error } = await client.auth.signInWithPassword({ email, password }); if (error) notify('البريد أو كلمة المرور غير صحيحة، أو الحساب غير مفعّل.', 'error'); else setPassword(''); }
    catch { notify('تعذر الاتصال بخدمة الدخول. حاول مجددًا.', 'error'); } finally { setBusy(false); }
  }
  async function api(path: string, method: string, body: unknown) {
    const { data } = await client!.auth.getSession(); const access = data.session?.access_token;
    if (!access) throw new Error('انتهت الجلسة. سجّل الدخول مجددًا.');
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.message || 'تعذر حفظ الإجراء.'); return result;
  }
  async function action(id: string, value: string, code?: string) {
    if (pendingAction.current) return; pendingAction.current = true; setBusy(true); setModalError('');
    try { const result = await api('/api/admin/codes', 'PATCH', { id, action: value, code }); notify(result.message); closeAfterSave(); refresh(); }
    catch (error) { const text = error instanceof Error ? error.message : 'تعذر تأكيد الإجراء.'; if (modal) setModalError(text); else notify(text, 'error'); }
    finally { pendingAction.current = false; setBusy(false); }
  }
  async function submitCode(event: React.FormEvent) {
    event.preventDefault(); if (pendingAction.current || !modal) return;
    const code = extractCode(codeText); if (!code) { setModalError('ألصق كودًا واحدًا بصيغة NG- وثمانية أحرف أو أرقام.'); return; }
    if (modal.type === 'edit') { await action(modal.row.id, 'edit', code); return; }
    pendingAction.current = true; setBusy(true); setModalError('');
    try { const result = await api('/api/admin/codes', 'POST', { code }); notify(result.message); closeAfterSave(); refresh(); }
    catch (error) { setModalError(error instanceof Error ? error.message : 'تعذرت إضافة الكود.'); }
    finally { pendingAction.current = false; setBusy(false); }
  }
  async function saveSettings(next: SiteSettings) {
    if (pendingAction.current) return; pendingAction.current = true; setBusy(true);
    try { const result = await api('/api/admin/settings', 'PATCH', next); setSettings(result.settings); notify('تم حفظ إعداداتك ومحتوى الموقع.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.', 'error'); throw error; }
    finally { pendingAction.current = false; setBusy(false); }
  }
  async function signOut() {
    if (settingsDirty && modal?.type !== 'logout') { openModal({ type: 'logout' }); return; }
    setBusy(true);
    try { const { error } = await client!.auth.signOut(); if (error) throw error; setSettingsDirty(false); closeAfterSave(); }
    catch { if(modal?.type==='logout')setModalError('تعذر تسجيل الخروج. حاول مجددًا.');else notify('تعذر تسجيل الخروج. حاول مجددًا.', 'error'); } finally { setBusy(false); }
  }
  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); if(modal?.type==='actions')closeAfterSave();notify('تم نسخ الكود.'); }
    catch { const message='تعذر النسخ التلقائي. تقدر تحدد نص الكود وتنسخه يدويًا.';if(modal)setModalError(message);else notify(message,'error'); }
  }
  function lookup(code: string) { setSearch(code); setQuery(code); setStatus('all'); setPage(0); setSection('codes'); }
  const toast = notice && <div className={'adm-toast ' + notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}><Icon name={notice.kind === 'error' ? 'info' : 'check'} /><span>{notice.text}</span><button aria-label="إغلاق الرسالة" onClick={() => setNotice(null)}><Icon name="close" /></button></div>;

  if (!token) return <div className="adm-login-page"><div className="adm-login-story"><a href="/" className="adm-brand"><span className="adm-brand-mark"><Icon name="key" /></span><span>مساعد أكواد نسك<small>مركز الإدارة</small></span></a><div><span className="adm-overline">إدارة المبادرة</span><h1>كل تفاصيل الموقع،<br /><em>في مكان واحد.</em></h1><p>تابع الأكواد، راجع البلاغات، وحدّث المحتوى اللي بيساعد المستخدمين.</p><div className="adm-login-features"><span><Icon name="key" /> الأكواد</span><span><Icon name="flag" /> البلاغات</span><span><Icon name="edit" /> المحتوى</span></div></div><small>مبادرة مجانية من أحمد عيد</small></div><main className="adm-login-form-area"><a href="/" className="adm-back-link"><Icon name="arrow" /> الرجوع للموقع</a><div className="adm-login-box"><span className="adm-login-icon"><Icon name="lock" /></span><h2>أهلًا بعودتك.</h2><p>سجّل الدخول لإدارة الموقع.</p>{!authResolved ? <div className="adm-session-loading" role="status"><span className="adm-spinner" /> جاري التحقق من الجلسة…</div> : !client ? <div className="adm-inline-error">لوحة الإدارة غير مفعّلة بعد. أكمل إعداد الاتصال بالمشروع.</div> : <form onSubmit={login}><label htmlFor="admin-email">البريد الإلكتروني</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required disabled={busy} dir="ltr" /><label htmlFor="admin-password">كلمة المرور</label><div className="adm-password"><input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} dir="ltr" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword}><Icon name="eye" /></button></div><button className="adm-button primary adm-login-submit" disabled={busy}>{busy ? <><span className="adm-spinner" /> جاري الدخول…</> : <>تسجيل الدخول <Icon name="arrow" /></>}</button><small>الدخول مخصص لمديري الموقع.</small></form>}</div></main>{toast}</div>;

  return <div className="adm-workspace"><a className="skip-link" href="#admin-content">انتقل لمحتوى الإدارة</a><aside className="adm-sidebar"><a className="adm-brand" href="/" target="_blank" rel="noopener noreferrer"><span className="adm-brand-mark"><Icon name="key" /></span><span>مساعد أكواد نسك<small>مركز الإدارة</small></span></a><span className="adm-nav-label">مساحة العمل</span><nav aria-label="أقسام الإدارة">{[
    { id: 'overview', label: 'نظرة عامة', icon: 'dashboard', active: section === 'overview', onClick: () => navigate('overview') },
    { id: 'codes', label: 'الأكواد', icon: 'key', active: section === 'codes' && status !== 'deleted', onClick: () => navigate('codes', 'all') },
    { id: 'reports', label: 'البلاغات', icon: 'flag', active: section === 'reports', badge: reportCount, onClick: () => navigate('reports') },
    { id: 'settings', label: 'الإعدادات والمحتوى', icon: 'settings', active: section === 'settings', onClick: () => navigate('settings') },
    { id: 'trash', label: 'المحذوفات', icon: 'trash', active: section === 'codes' && status === 'deleted', onClick: () => navigate('codes', 'deleted') },
  ].map(item => <button key={item.id} aria-current={item.active ? 'page' : undefined} onClick={item.onClick}><Icon name={item.icon} /><span>{item.label}</span>{!!item.badge && <b>{number(item.badge)}</b>}{item.id === 'settings' && settingsDirty && <i className="adm-dirty-dot" aria-label="تغييرات غير محفوظة" />}</button>)}</nav><div className="adm-sidebar-help"><Icon name="heart" /><b>خلّي المساعدة أسهل.</b><p>تعديلاتك تظهر للمستخدمين من نفس رابط الموقع.</p><a href="/" target="_blank" rel="noopener noreferrer">اعرض الموقع <Icon name="external" /></a></div><div className="adm-account"><span className="adm-avatar"><Icon name="user" /></span><span><b>حساب الإدارة</b><small>جلسة مسجّلة</small></span><button onClick={() => void signOut()} disabled={busy} aria-label="تسجيل الخروج"><Icon name="logout" /></button></div></aside>
    <div className="adm-main"><header className="adm-topbar"><div className="adm-breadcrumb">مركز الإدارة <Icon name="chevron" /><strong>{titles[section][0]}</strong></div><select className="adm-mobile-section" aria-label="انتقل إلى قسم الإدارة" value={section==='codes'&&status==='deleted'?'trash':section} onChange={event=>event.target.value==='trash'?navigate('codes','deleted'):navigate(event.target.value as Section,event.target.value==='codes'?'all':undefined)}><option value="overview">نظرة عامة</option><option value="codes">الأكواد</option><option value="reports">البلاغات</option><option value="settings">الإعدادات والمحتوى</option><option value="trash">المحذوفات</option></select><div className="adm-topbar-actions"><span className={'adm-live-indicator'+(loadError?' error':'')}><i /> {loading ? 'جاري التحديث' : loadError ? 'تعذر التحديث' : ready ? 'متصل' : 'جاري الاتصال'}</span><button className="adm-icon-button" disabled={blocked} onClick={refresh} aria-label="تحديث بيانات الإدارة"><Icon name="refresh" /></button><a href="/" target="_blank" rel="noopener noreferrer" className="adm-button subtle" aria-label="عرض الموقع في تبويب جديد"><Icon name="external" /> اعرض الموقع</a></div></header>
    <main id="admin-content" className="adm-content" tabIndex={-1}><div className="adm-page-heading"><div><span className="adm-overline">{section === 'overview' ? 'أهلًا بك في لوحة الإدارة' : 'مساحة العمل'}</span><h1>{titles[section][0]}</h1><p>{titles[section][1]}</p></div>{section === 'codes' && status !== 'deleted' && <button className="adm-button primary" disabled={!ready || blocked} onClick={() => openModal({ type: 'add' })}><Icon name="plus" /> إضافة كود</button>}</div>
    {loadError && <div className="adm-load-error" role="alert"><Icon name="info" /><span>{loadError}</span><button onClick={refresh}>إعادة المحاولة</button></div>}
    {!ready ? <div className="adm-loading" role="status"><span className="adm-spinner" /> جاري تجهيز لوحة الإدارة…<div className="adm-skeleton-grid">{[0, 1, 2, 3].map(i => <div key={i} />)}</div></div> : <>
      <section hidden={section !== 'overview'} aria-label="ملخص المبادرة"><div className="adm-stats">{[
        { label: 'أكواد منشورة', value: stats.approved, hint: 'متاحة للمستخدمين', icon: 'key', tone: 'green', filter: 'approved' },
        { label: 'بانتظار المراجعة', value: stats.pending, hint: stats.pending ? 'تحتاج قرارك' : 'لا توجد إضافات معلّقة', icon: 'clock', tone: 'amber', filter: 'pending' },
        { label: 'بلاغات مفتوحة', value: reportCount, hint: reportCount ? 'من مستخدمي الموقع' : 'لا توجد بلاغات حاليًا', icon: 'flag', tone: 'orange', filter: null },
        { label: 'إجمالي الأكواد', value: total, hint: 'يشمل كل الحالات', icon: 'dashboard', tone: 'neutral', filter: 'all' },
      ].map(card => <button className={'adm-stat ' + card.tone} key={card.label} onClick={() => card.filter === null ? navigate('reports') : navigate('codes', card.filter)}><span className="adm-stat-top">{card.label}<i><Icon name={card.icon} /></i></span><strong>{number(card.value)}</strong><span className="adm-stat-bottom">{card.hint}<Icon name="arrow" /></span></button>)}</div>
      <div className="adm-overview-grid"><article className="adm-panel adm-publishing"><div className="adm-panel-heading"><span className="adm-tile green"><Icon name="settings" /></span><span className={'adm-badge ' + (settings?.autoApprove ? 'approved' : 'pending')}>{settings?.autoApprove ? 'نشر تلقائي' : 'مراجعة يدوية'}</span></div><h2>طريقة استقبال الأكواد</h2><p>{settings?.autoApprove ? 'الإضافات الجديدة تظهر مباشرة بعد التحقق من الصيغة ومنع التكرار.' : 'الإضافات الجديدة تنتظر موافقتك قبل الظهور في القائمة.'}</p><div className="adm-policy-line"><span>استقبال الإضافات</span><b><i className={settings?.submissionsEnabled ? 'on' : ''} />{settings?.submissionsEnabled ? 'مفتوح' : 'متوقف مؤقتًا'}</b></div><button className="adm-text-button" onClick={() => navigate('settings')}>تحكّم في النشر <Icon name="arrow" /></button></article><article className="adm-panel adm-attention"><div className="adm-panel-heading"><span className="adm-tile amber"><Icon name="flag" /></span><span className="adm-overline">قائمة المتابعة</span></div><h2>{reportCount || stats.pending ? 'حاجات تحتاج مراجعتك' : 'كل شيء جاهز حاليًا'}</h2><p>راجع البلاغات والإضافات المعلّقة من مكان واحد.</p><button className="adm-attention-item" onClick={() => navigate('reports')}><span><Icon name="flag" /> بلاغات المستخدمين</span><b>{number(reportCount)}</b><Icon name="chevron" /></button><button className="adm-attention-item" onClick={() => navigate('codes', 'pending')}><span><Icon name="clock" /> أكواد تنتظر الموافقة</span><b>{number(stats.pending)}</b><Icon name="chevron" /></button></article></div>
      <div className="adm-section-heading"><div><h2>اختصارات تساعدك تبدأ</h2><p>اختار المهمة اللي محتاج تعملها.</p></div></div><div className="adm-shortcuts"><button onClick={() => openModal({ type: 'add' })}><span className="adm-tile green"><Icon name="plus" /></span><span><b>إضافة كود جديد</b><small>انشر كودًا مباشرة من حسابك</small></span><Icon name="arrow" /></button><button onClick={() => navigate('settings')}><span className="adm-tile neutral"><Icon name="edit" /></span><span><b>تحديث محتوى الموقع</b><small>النصوص والروابط والدليل</small></span><Icon name="arrow" /></button><button onClick={() => navigate('codes', 'deleted')}><span className="adm-tile neutral"><Icon name="trash" /></span><span><b>مراجعة المحذوفات</b><small>{number(stats.deleted)} كود قابل للاستعادة</small></span><Icon name="arrow" /></button></div></section>
      <section hidden={section !== 'codes'} aria-label="قائمة الأكواد"><div className="adm-panel adm-codes-panel" aria-busy={loading}><div className="adm-list-toolbar"><form className="adm-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}><Icon name="search" /><input aria-label="البحث عن كود" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالكود…" dir="auto" /><button type="submit" disabled={loading}>بحث</button>{query && <button type="button" aria-label="مسح البحث" onClick={() => { setSearch(''); setQuery(''); setPage(0); }}><Icon name="close" /></button>}</form><span className="adm-result-count">{number(count)} {query ? 'نتيجة' : 'كود'}</span></div><div className="adm-filters" role="group" aria-label="حالة الأكواد">{[['all', 'الكل', total], ['approved', 'المنشور', stats.approved], ['pending', 'المراجعة', stats.pending], ['rejected', 'المرفوض', stats.rejected], ['deleted', 'المحذوف', stats.deleted]].map(([id, label, value]) => <button key={id} aria-pressed={status === id} onClick={() => { setStatus(String(id)); setPage(0); }}>{label}<span>{number(Number(value))}</span></button>)}</div>
      {codes.length === 0 ? <div className="adm-empty"><span className="adm-tile neutral"><Icon name={query ? 'search' : status === 'deleted' ? 'trash' : 'key'} /></span><h2>{query ? 'مفيش نتيجة مطابقة' : status === 'deleted' ? 'المحذوفات فارغة' : 'لا توجد أكواد بهذه الحالة'}</h2><p>{query ? 'جرّب جزءًا آخر من الكود أو امسح البحث.' : 'تقدر تختار حالة أخرى من الفلاتر.'}</p><button className="adm-button subtle" onClick={() => { setSearch(''); setQuery(''); setStatus('all'); setPage(0); }}>عرض كل الأكواد</button></div> : <div className="adm-code-table"><div className="adm-table-heading" aria-hidden="true"><span>الكود</span><span>الحالة</span><span>تاريخ الإضافة</span><span>الإجراءات</span></div>{codes.map(row => <article className="adm-code-row" key={row.id}><div className="adm-code-identity"><span className="adm-code-symbol"><Icon name="key" /></span><code dir="ltr">{row.code}</code><button className="adm-copy-mini" onClick={() => void copyCode(row.code)} aria-label={'نسخ ' + row.code}><Icon name="copy" /></button></div><div className="adm-row-status"><span className={'adm-badge ' + row.status}><i />{labels[row.status]}</span></div><time className="adm-row-date" dateTime={row.created_at}>{date(row.created_at)}</time><div className="adm-row-controls">{row.status === 'pending' && <button className="adm-approve-mini" disabled={blocked} onClick={() => void action(row.id, 'approve')}>نشر</button>}{row.status === 'deleted' && <button className="adm-approve-mini" disabled={blocked} onClick={() => void action(row.id, 'restore')}>استعادة</button>}<button className="adm-icon-button" disabled={blocked} onClick={() => openModal({ type: 'actions', row })} aria-label={'إجراءات الكود ' + row.code}><Icon name="more" /></button></div></article>)}</div>}<Pagination page={page} count={count} size={pageSize} disabled={blocked} onChange={setPage} /></div></section>
      <section hidden={section !== 'reports'} aria-label="بلاغات المستخدمين">{reports.length === 0 ? <div className="adm-panel adm-empty"><span className="adm-tile green"><Icon name="check" /></span><h2>مفيش بلاغات مفتوحة.</h2><p>أي بلاغ جديد من المستخدمين هيظهر هنا لمراجعته.</p><button className="adm-button subtle" onClick={() => navigate('overview')}>ارجع للنظرة العامة</button></div> : <><div className="adm-report-note"><Icon name="info" /><p>حذف الكود يخفيه عن الزوار ويغلق بلاغاته، مع إمكانية استعادته من المحذوفات.</p><span>{number(reportCount)} بلاغ</span></div><div className="adm-report-grid">{reports.map(row => <article className="adm-panel adm-report-card" key={row.id}><div className="adm-report-top"><span className="adm-report-type"><Icon name="flag" /> الكود لم يعمل</span><time dateTime={row.created_at}>{date(row.created_at)}</time></div><code dir="ltr">{row.code}</code><span className={'adm-badge ' + (row.codeStatus || '')}>{row.codeStatus ? labels[row.codeStatus] : 'غير موجود بالقائمة'}</span><div className="adm-report-divider" /><p>أبلغ مستخدم أن هذا الكود لم يعمل معه داخل التطبيق.</p><div className="adm-report-actions"><button className="adm-button subtle" disabled={blocked} onClick={() => void action(row.id, 'resolve')}><Icon name="check" /> إغلاق البلاغ فقط</button>{row.codeId && row.codeStatus !== 'deleted' && <button className="adm-button danger-subtle" disabled={blocked} onClick={() => openModal({ type: 'delete', row: { id: row.codeId!, code: row.code, status: row.codeStatus || 'approved', created_at: row.created_at } })}><Icon name="trash" /> حذف الكود</button>}</div><button className="adm-text-button" onClick={() => lookup(row.code)}>عرض الكود وتفاصيله <Icon name="arrow" /></button></article>)}</div><Pagination page={reportPage} count={reportCount} size={pageSize} disabled={blocked} onChange={setReportPage} /></>}</section>
      <section hidden={section !== 'settings'} aria-label="إعدادات الموقع">{settings && <SettingsEditor value={settings} saving={busy} onSave={saveSettings} onReload={refresh} onDirtyChange={setSettingsDirty} />}</section>
    </>}
    <footer className="adm-footer"><span>مساعد أكواد نسك · مركز الإدارة</span><span>التوقيت المعروض: القاهرة</span></footer></main></div>{toast}
    <dialog ref={dialog} className="adm-dialog" aria-labelledby="adm-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else { setModal(null); setModalError(''); } }} onClick={event => { const box=event.currentTarget.getBoundingClientRect();if(event.target===event.currentTarget&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))closeModal(); }}><div className="adm-dialog-header"><span className={'adm-tile ' + (modal?.type === 'delete' ? 'red' : 'green')}><Icon name={modal?.type === 'delete' ? 'trash' : modal?.type === 'logout' ? 'logout' : 'key'} /></span><button className="adm-icon-button" aria-label="إغلاق النافذة" disabled={busy} onClick={closeModal}><Icon name="close" /></button></div><h2 id="adm-dialog-title">{modal?.type === 'add' ? 'إضافة كود جديد' : modal?.type === 'edit' ? 'تعديل الكود' : modal?.type === 'delete' ? 'تحذف الكود من القائمة؟' : modal?.type === 'logout' ? 'عندك تغييرات غير محفوظة' : 'إدارة الكود'}</h2>
      {modal && 'row' in modal && <code className="adm-dialog-code" dir="ltr">{modal.row.code}</code>}
      {(modal?.type === 'add' || modal?.type === 'edit') && <form onSubmit={submitCode}><p>{modal.type === 'add' ? 'ألصق كودًا أو رسالة تحتوي على كود واحد. إضافتك كمدير تُنشر مباشرة.' : 'راجع الكود الجديد قبل حفظ التعديل.'}</p><label htmlFor="adm-code-input">{modal.type === 'add' ? 'الكود أو رسالة المشاركة' : 'الكود الجديد'}</label><textarea id="adm-code-input" rows={modal.type === 'add' ? 3 : 1} dir="auto" value={codeText} onChange={event => setCodeText(event.target.value)} maxLength={modal.type === 'add' ? 2000 : 11} required disabled={busy} /><div className="adm-dialog-buttons"><button className="adm-button primary" disabled={busy}>{busy ? 'جاري الحفظ…' : modal.type === 'add' ? 'إضافة ونشر' : 'حفظ التعديل'}</button><button type="button" className="adm-button subtle" disabled={busy} onClick={closeModal}>إلغاء</button></div></form>}
      {modal?.type === 'actions' && <div className="adm-action-list"><button onClick={() => void copyCode(modal.row.code)}><Icon name="copy" /><span><b>نسخ الكود</b><small>انسخ النص إلى الحافظة</small></span></button>{modal.row.status === 'deleted' ? <button disabled={busy} onClick={() => void action(modal.row.id, 'restore')}><Icon name="undo" /><span><b>استعادة ونشر</b><small>إعادة الكود إلى القائمة العامة</small></span></button> : <>{modal.row.status !== 'approved' && <button disabled={busy} onClick={() => void action(modal.row.id, 'approve')}><Icon name="check" /><span><b>نشر الكود</b><small>إظهاره للمستخدمين مباشرة</small></span></button>}<button disabled={busy} onClick={() => openModal({ type: 'edit', row: modal.row })}><Icon name="edit" /><span><b>تعديل الكود</b><small>تحديث الأحرف أو الأرقام</small></span></button>{modal.row.status !== 'rejected' && <button disabled={busy} onClick={() => void action(modal.row.id, 'reject')}><Icon name="info" /><span><b>رفض وإخفاء</b><small>إخفاؤه عن المستخدمين</small></span></button>}<button className="destructive" disabled={busy} onClick={() => openModal({ type: 'delete', row: modal.row })}><Icon name="trash" /><span><b>حذف الكود</b><small>ينتقل إلى المحذوفات ويمكن استعادته</small></span></button></>}</div>}
      {modal?.type === 'delete' && <><p>هيختفي عن المستخدمين وتتقفل البلاغات المرتبطة به. تقدر تستعيده وتنشره من المحذوفات.</p><div className="adm-dialog-buttons"><button className="adm-button danger" disabled={busy} onClick={() => void action(modal.row.id, 'delete')}>{busy ? 'جاري الحذف…' : 'حذف الكود'}</button><button className="adm-button subtle" disabled={busy} onClick={closeModal}>احتفظ بالكود</button></div></>}
      {modal?.type === 'logout' && <><p>احفظ تعديلات الإعدادات أولًا، أو سجّل الخروج وتجاهلها.</p><div className="adm-dialog-buttons"><button className="adm-button primary" onClick={() => { closeModal(); navigate('settings'); }}>ارجع للتعديلات</button><button className="adm-button subtle" disabled={busy} onClick={() => void signOut()}>خروج وتجاهل التغييرات</button></div></>}
      {modalError && <p className="adm-inline-error" role="alert">{modalError}</p>}
    </dialog>
  </div>;
}
function Pagination({ page, count, size, disabled, onChange }: { page: number; count: number; size: number; disabled: boolean; onChange: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return <div className="adm-pagination"><span>{count ? <>عرض {number(page * size + 1)}–{number(Math.min((page + 1) * size, count))} من {number(count)}</> : 'لا توجد نتائج'}</span><div><button className="adm-icon-button" aria-label="الصفحة السابقة" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} /></button><span>{number(page + 1)} / {number(pages)}</span><button className="adm-icon-button" aria-label="الصفحة التالية" disabled={disabled || (page + 1) * size >= count} onClick={() => onChange(page + 1)}><Icon name="chevron" /></button></div></div>;
}
