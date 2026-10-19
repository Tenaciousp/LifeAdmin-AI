package uk.co.tenaciouspl.lifeadmin;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONObject;

@CapacitorPlugin(name = "LifeAdminCalendar", permissions = {
    @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
})
public class LifeAdminCalendarPlugin extends Plugin {
    private static final Map<String, String> TITLES = new HashMap<>();
    static {
        TITLES.put("contract_expiry", "Contract expiry"); TITLES.put("renewal_date", "Renewal date");
        TITLES.put("notice_deadline", "Cancellation notice deadline"); TITLES.put("follow_up_date", "Follow-up date");
    }
    private boolean permitted() { return getPermissionState("calendar") == PermissionState.GRANTED; }
    private void requireAccess() {
        if (!permitted()) throw new IllegalStateException("Calendar permission is unavailable. Reconnect through Contract diary or review permission in Settings.");
    }
    private String owner() {
        SharedPreferences preferences = getContext().getSharedPreferences("LifeAdminDiary", Context.MODE_PRIVATE);
        String value = preferences.getString("owner", null);
        if (value == null) {
            value = UUID.randomUUID().toString();
            if (!preferences.edit().putString("owner", value).commit()) throw new IllegalStateException("Diary setup could not be saved.");
        }
        return "lifeadmin-diary/" + value + "/";
    }
    @PluginMethod public void calendars(PluginCall call) {
        if (!permitted() && Boolean.TRUE.equals(call.getBoolean("requestPermission", false))) {
            requestPermissionForAlias("calendar", call, "calendarPermission"); return;
        }
        listCalendars(call);
    }
    @PermissionCallback private void calendarPermission(PluginCall call) { listCalendars(call); }
    private void listCalendars(PluginCall call) {
        try {
            requireAccess();
            JSArray values = new JSArray();
            try (Cursor cursor = getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI,
                new String[] { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME },
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=? AND " + CalendarContract.Calendars.SYNC_EVENTS + "=1",
                new String[] { String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) }, null)) {
                if (cursor == null) throw new IllegalStateException("Calendar provider is unavailable.");
                while (cursor.moveToNext()) { JSObject item = new JSObject(); item.put("id", String.valueOf(cursor.getLong(0))); item.put("title", cursor.getString(1)); values.put(item); }
            }
            JSObject result = new JSObject(); result.put("calendars", values); call.resolve(result);
        } catch (Exception error) { call.reject("Calendar access failed. " + error.getMessage(), "calendar_access"); }
    }
    private void requireCalendar(long id) {
        try (Cursor cursor = getContext().getContentResolver().query(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, id),
            new String[] { CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.SYNC_EVENTS }, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst() || cursor.getInt(0) < CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR || cursor.getInt(1) != 1)
                throw new IllegalStateException("The selected calendar is unavailable or read-only. Choose a writable calendar.");
        }
    }
    private static final class Entry {
        String key, title; long start, end; int lead;
    }
    private ArrayList<Entry> entries(PluginCall call) throws Exception {
        JSArray values = call.getArray("events");
        if (values == null || values.length() > 1000) throw new IllegalArgumentException("Invalid diary entries.");
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setLenient(false); format.setTimeZone(TimeZone.getTimeZone("UTC"));
        ArrayList<Entry> result = new ArrayList<>(); Set<String> keys = new HashSet<>();
        for (int index = 0; index < values.length(); index++) {
            JSONObject value = values.getJSONObject(index);
            String key = value.getString("key"), day = value.getString("date");
            int lead = value.getInt("leadDays");
            if (!key.matches("[A-Za-z0-9_-]{1,100}/(contract_expiry|renewal_date|notice_deadline|follow_up_date)") || !keys.add(key)
                || !day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || day.compareTo("1900-01-01") < 0 || day.compareTo("2199-12-31") > 0
                || !(lead == 0 || lead == 7 || lead == 14 || lead == 30)) throw new IllegalArgumentException("Check diary dates and reminder settings.");
            Date date = format.parse(day);
            if (date == null || !format.format(date).equals(day)) throw new IllegalArgumentException("Check diary dates.");
            Entry entry = new Entry(); entry.key = key; entry.title = "LifeAdmin: " + TITLES.get(key.substring(key.indexOf('/') + 1));
            // Android all-day events use UTC midnight, not local midnight.
            entry.start = date.getTime(); entry.end = entry.start + 86400000L; entry.lead = lead;
            result.add(entry);
        }
        return result;
    }
    private Map<String, Long> ownedEvents(String prefix) {
        Map<String, Long> result = new HashMap<>();
        try (Cursor cursor = getContext().getContentResolver().query(CalendarContract.Events.CONTENT_URI,
            new String[] { CalendarContract.Events._ID, CalendarContract.Events.CUSTOM_APP_URI },
            CalendarContract.Events.CUSTOM_APP_PACKAGE + "=? AND " + CalendarContract.Events.CUSTOM_APP_URI + " LIKE ? AND " + CalendarContract.Events.DELETED + "=0",
            new String[] { getContext().getPackageName(), prefix + "%" }, null)) {
            if (cursor == null) throw new IllegalStateException("Calendar provider is unavailable.");
            while (cursor.moveToNext()) {
                String marker = cursor.getString(1);
                // UUID prefix has no SQL wildcards. Restrict changes to this installation's exact marker.
                if (marker != null && marker.startsWith(prefix)) {
                    String key = marker.substring(prefix.length());
                    if (result.put(key, cursor.getLong(0)) != null) throw new IllegalStateException("Duplicate managed diary entries found. Review your calendar before retrying.");
                }
            }
        }
        return result;
    }
    private int reminderMinutes(Entry entry) {
        // Calendar provider reminders are relative to the UTC all-day DTSTART.
        // Compute a local 09:00 alarm using calendar-day arithmetic, including DST.
        Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US); utc.setTimeInMillis(entry.start);
        Calendar local = Calendar.getInstance(); local.clear();
        local.set(utc.get(Calendar.YEAR), utc.get(Calendar.MONTH), utc.get(Calendar.DAY_OF_MONTH), 9, 0, 0);
        local.add(Calendar.DAY_OF_MONTH, -entry.lead);
        if (local.getTimeInMillis() <= System.currentTimeMillis()) return -1;
        long minutes = (entry.start - local.getTimeInMillis()) / 60000L;
        // Some providers reject negative offsets for same-day morning alerts.
        // Use the event's day boundary in that case; calendar settings still govern delivery.
        return (int) Math.max(0, minutes);
    }
    @PluginMethod public synchronized void sync(PluginCall call) {
        try {
            requireAccess();
            String selected = call.getString("calendarId");
            if (selected == null || !selected.matches("[0-9]+")) throw new IllegalArgumentException("Choose a calendar.");
            long calendarId = Long.parseLong(selected); requireCalendar(calendarId);
            ArrayList<Entry> entries = entries(call); // Full validation before provider writes.
            String prefix = owner(); Map<String, Long> previous = ownedEvents(prefix);
            ArrayList<ContentProviderOperation> operations = new ArrayList<>();
            int count = 0, skipped = 0;
            SimpleDateFormat todayFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            SimpleDateFormat utcFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US); utcFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
            String today = todayFormat.format(new Date());
            for (Entry entry : entries) {
                Long oldId = previous.remove(entry.key);
                if (oldId == null && utcFormat.format(new Date(entry.start)).compareTo(today) < 0) { skipped++; continue; }
                ContentValues values = new ContentValues();
                values.put(CalendarContract.Events.CALENDAR_ID, calendarId); values.put(CalendarContract.Events.TITLE, entry.title);
                values.put(CalendarContract.Events.DESCRIPTION, "LifeAdmin diary entry. Open LifeAdmin to review the saved bill.");
                values.put(CalendarContract.Events.DTSTART, entry.start); values.put(CalendarContract.Events.DTEND, entry.end);
                values.put(CalendarContract.Events.ALL_DAY, 1); values.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
                values.put(CalendarContract.Events.CUSTOM_APP_PACKAGE, getContext().getPackageName());
                values.put(CalendarContract.Events.CUSTOM_APP_URI, prefix + entry.key);
                int minutes = reminderMinutes(entry); values.put(CalendarContract.Events.HAS_ALARM, minutes >= 0 ? 1 : 0);
                int eventOperation = operations.size();
                if (oldId == null) operations.add(ContentProviderOperation.newInsert(CalendarContract.Events.CONTENT_URI).withValues(values).build());
                else {
                    operations.add(ContentProviderOperation.newUpdate(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, oldId)).withValues(values).withExpectedCount(1).build());
                    operations.add(ContentProviderOperation.newDelete(CalendarContract.Reminders.CONTENT_URI).withSelection(CalendarContract.Reminders.EVENT_ID + "=?", new String[]{String.valueOf(oldId)}).build());
                }
                if (minutes >= 0) {
                    ContentProviderOperation.Builder reminder = ContentProviderOperation.newInsert(CalendarContract.Reminders.CONTENT_URI)
                        .withValue(CalendarContract.Reminders.MINUTES, minutes).withValue(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                    if (oldId == null) reminder.withValueBackReference(CalendarContract.Reminders.EVENT_ID, eventOperation);
                    else reminder.withValue(CalendarContract.Reminders.EVENT_ID, oldId);
                    operations.add(reminder.build());
                }
                count++;
            }
            for (long id : previous.values()) operations.add(ContentProviderOperation.newDelete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id)).withExpectedCount(1).build());
            if (!operations.isEmpty()) getContext().getContentResolver().applyBatch(CalendarContract.AUTHORITY, operations);
            JSObject result = new JSObject(); result.put("count", count); result.put("skippedPast", skipped); call.resolve(result);
        } catch (Exception error) { call.reject("Diary update failed. " + error.getMessage() + " Saved bills are unchanged. Check calendar access and retry.", "calendar_sync"); }
    }
    @PluginMethod public synchronized void removeAll(PluginCall call) {
        try {
            requireAccess(); Map<String, Long> entries = ownedEvents(owner());
            ArrayList<ContentProviderOperation> operations = new ArrayList<>();
            for (long id : entries.values()) operations.add(ContentProviderOperation.newDelete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id)).withExpectedCount(1).build());
            if (!operations.isEmpty()) getContext().getContentResolver().applyBatch(CalendarContract.AUTHORITY, operations);
            call.resolve();
        } catch (Exception error) { call.reject("Calendar entry removal failed. " + error.getMessage(), "calendar_remove"); }
    }
}
