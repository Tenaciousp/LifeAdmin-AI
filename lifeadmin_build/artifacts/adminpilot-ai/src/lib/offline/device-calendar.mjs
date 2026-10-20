import { Capacitor, registerPlugin } from '@capacitor/core';
const calendar = registerPlugin('LifeAdminCalendar');
export const calendarAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LifeAdminCalendar');
function plugin() {
  if (!calendarAvailable()) throw new Error('Automatic diary entries need the installed HomeAdmin app with calendar support.');
  return calendar;
}
export async function chooseCalendars() { return (await plugin().calendars({ requestPermission: true })).calendars; }
export async function syncDiary(calendarId, events) { return plugin().sync({ calendarId, events }); }
export async function removeDiaryEntries() { return plugin().removeAll(); }
