import { useEffect, useState } from 'react';
import { EmptyState, LoadingSpinner } from './Feedback';
import { diaryEvents, diaryAlertState } from './lib/offline/diary.mjs';
import { calendarAvailable, chooseCalendars, syncDiary, removeDiaryEntries } from './lib/offline/device-calendar.mjs';
const key = 'lifeadmin-calendar-v1';
const button = 'min-h-[44px] max-w-full rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50';
function rememberedCalendar() { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
export default function DiaryPanel({ tasks, onEdit }: { tasks: Record<string, any>[]; onEdit?: (task: Record<string, any>) => void }) {
  const [calendarId, setCalendarId] = useState(rememberedCalendar);
  const [choice, setChoice] = useState('');
  const [calendars, setCalendars] = useState<{id: string; title: string}[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  // The string dependency changes only when diary-relevant fields change.
  let events = '', invalid = '';
  try { events = JSON.stringify(diaryEvents(tasks)); } catch (failure) { invalid = failure instanceof Error ? failure.message : 'Check diary dates.'; }
  const reminderStates = invalid || !events ? [] : (JSON.parse(events) as ReturnType<typeof diaryEvents>).map(event => ({...event, ...diaryAlertState(event)}));
  useEffect(() => {
    let active = true;
    if (!calendarId) return;
    if (invalid) { setError(invalid); setStatus("Diary update paused. Correct the saved dates or disconnect the diary."); setBusy(false); return; }
    setStatus('Updating diary entries…'); setError(''); setBusy(true);
    void syncDiary(calendarId, JSON.parse(events)).then(result => {
      if (active) setStatus(`Diary saved: ${result.count} entries. ${result.skippedPast} past dates skipped. Saved entries and alerts are separate; check the reminder times below and your device settings.`);
    }).catch(failure => { if (active) { setStatus('Diary update incomplete. Your saved bills are unchanged.'); setError(failure instanceof Error ? failure.message : 'Calendar update failed.'); } }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [calendarId, events, invalid, retry]);
  async function choose() {
    setBusy(true); setError('');
    try { const list = await chooseCalendars(); setCalendars(list); setChoice(list[0]?.id || ''); if (!list.length) setError('No writable calendar is available. Add a calendar in your device settings, then retry.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Calendar access failed.'); }
    finally { setBusy(false); }
  }
  function connect() {
    if (!choice || !calendars.some(x => x.id === choice)) return;
    if (!window.confirm('Enable automatic entries in this calendar? Calendar providers might sync entries. Saving or deleting bills, marking them done, restoring backups and changing dates will update or remove linked HomeAdmin entries. Calendar alerts depend on your settings.')) return;
    try { localStorage.setItem(key, choice); if (localStorage.getItem(key) !== choice) throw new Error(); setCalendarId(choice); setCalendars([]); setRetry(x => x + 1); }
    catch { setError('Calendar setup could not be saved. No diary entries were requested.'); }
  }
  async function disconnect(remove: boolean) {
    if (!window.confirm(remove ? 'Remove all calendar entries managed by this installation and disconnect diary updates?' : 'Disconnect automatic updates and keep existing entries? Future bill changes will not update those entries.')) return;
    setBusy(true); setError('');
    try {
      // Stop automatic work first. If storage is unavailable, retain the connection and do not promise it stopped.
      localStorage.removeItem(key); if (localStorage.getItem(key)) throw new Error('Calendar setup could not be removed.');
      setCalendarId('');
      if (remove) await removeDiaryEntries();
      setStatus(remove ? 'Diary disconnected and managed entries removed.' : 'Diary disconnected. Existing entries were kept.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Disconnect failed.'); setStatus('Check your calendar. Some linked entries might remain. Retry removal below.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm" aria-labelledby="diary-heading">
    <h2 id="diary-heading" className="text-xl font-bold">Contract diary</h2>
    <p className="mt-3 text-slate-700">Keep track of when contracts end or when you need to contact a provider again. First open a bill and add a renewal, cancellation or follow-up date. Next, choose to add that date to your diary. If you want calendar alerts, connect a device calendar below. Dates and reminders are separate from recording a payment.</p>
    <details className="mt-3 rounded-xl border border-violet-100 p-3"><summary className="min-h-[44px] cursor-pointer py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700">Calendar privacy and how updates work</summary>
    <p className="mt-3">Entries use neutral titles without provider names or account references. Your selected calendar might sync or be shared through its provider. Permission supports maintaining HomeAdmin entries; unrelated events are not uploaded. Setup is device-specific, so connecting two devices to one calendar risks duplicate entries.</p>
    <p className="mt-3">Updates run while HomeAdmin is open and on reopening. Calendar alerts then follow your calendar settings. Existing entries are not guaranteed to be removed when uninstalling the app. Past dates are not added as new events.</p>
    </details>
    {busy && <p role="status" aria-busy="true" className="mt-3 flex items-center gap-2 font-semibold text-violet-900"><LoadingSpinner />Updating calendar…</p>}
    {status && !busy && <p role="status" className="mt-3">{status}</p>}{error && <p role="alert" className="mt-3 text-red-900">{error}</p>}
    {!invalid && events === '[]' && <EmptyState title="No diary dates yet" description="Add a contract or follow-up date to a bill. Connect a calendar only when you want device entries." />}
    {!!reminderStates.length && <section className="mt-4 rounded-xl border p-3" aria-label="HomeAdmin reminder times"><h3 className="font-bold">Entries and alert times</h3><p>Calendar entries do not guarantee an alert. HomeAdmin requests a 09:00 local alert only when the selected reminder time is still in the future.</p><ul>{reminderStates.map(item => <li className="mt-3" key={item.key}><p>{item.title} · {item.date} · {item.leadDays} days before</p>{item.status === 'elapsed' ? <><p className="font-semibold text-amber-900">Selected alert time has elapsed. This entry has no future HomeAdmin alarm with this lead.</p>{onEdit && <button type="button" className={button + ' mt-2'} onClick={() => { const task = tasks.find(task => task.id === item.key.split('/')[0]); if (task) onEdit(task); }}>Edit bill reminder lead</button>}<p>Choose a shorter lead in the bill's Contract dates and diary section, then save. HomeAdmin will update the same linked entry.</p></> : <p>Eligible HomeAdmin alert time: {new Date(item.alertAt).toLocaleString()}. Connect a calendar to request this alert. Calendar permissions and device settings control delivery.</p>}</li>)}</ul></section>}
    {calendarAvailable() ? <div className="mt-4 space-y-3"><button disabled={busy} className={button} onClick={() => void choose()}>{calendarId ? 'Change calendar' : 'Connect calendar'}</button>
      {!!calendars.length && <div><label>Calendar<select className="mt-1 block min-h-[44px] w-full rounded-xl border p-2" value={choice} onChange={event => setChoice(event.target.value)}>{calendars.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label><button disabled={busy} className={button + ' mt-3'} onClick={connect}>Enable diary updates</button></div>}
      {!!calendarId && <div className="flex flex-wrap gap-3"><button disabled={busy} className={button} onClick={() => setRetry(x => x + 1)}>Retry diary update</button><button disabled={busy} className={button} onClick={() => void disconnect(false)}>Disconnect and keep entries</button></div>}
      <button disabled={busy} className={button} onClick={() => void disconnect(true)}>Remove HomeAdmin diary entries</button>
    </div> : <p className="mt-3">Automatic diary entries require the installed app with calendar support. Your saved dates remain available here.</p>}
  </section>;
}
