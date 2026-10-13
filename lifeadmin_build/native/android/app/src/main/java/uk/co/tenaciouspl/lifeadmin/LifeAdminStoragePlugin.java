package uk.co.tenaciouspl.lifeadmin;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.content.ContentValues;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "LifeAdminStorage")
public class LifeAdminStoragePlugin extends Plugin {
    private SQLiteOpenHelper helper;
    @Override public void load() {
        helper = new SQLiteOpenHelper(getContext(), "lifeadmin-records-v1.sqlite", null, 1) {
            @Override public void onConfigure(SQLiteDatabase db) {
                db.disableWriteAheadLogging();
                db.execSQL("PRAGMA synchronous=FULL");
                db.execSQL("PRAGMA secure_delete=ON");
            }
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL, data TEXT NOT NULL)");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
                throw new IllegalStateException("Unsupported device storage version.");
            }
        };
    }
    @PluginMethod public synchronized void read(PluginCall call) {
        try {
            JSObject result = new JSObject();
            try (Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT revision, data FROM snapshot WHERE id=1", null)) {
                if (cursor.moveToFirst()) {
                    result.put("revision", cursor.getString(0));
                    result.put("snapshot", cursor.getString(1));
                } else {
                    result.put("revision", "empty");
                    result.put("snapshot", JSONObject.NULL);
                }
            }
            call.resolve(result);
        } catch (Exception failure) {
            call.reject("Device records could not be opened.", "storage_read");
        }
    }
    @PluginMethod public synchronized void write(PluginCall call) {
        String snapshot = call.getString("snapshot");
        String expected = call.getString("expectedRevision");
        if (snapshot == null || expected == null || expected.length() > 100 || snapshot.getBytes(StandardCharsets.UTF_8).length > 5 * 1024 * 1024) {
            call.reject("Invalid or oversized device snapshot.", "storage_input"); return;
        }
        try {
            JSONObject value = new JSONObject(snapshot);
            if (!"lifeadmin-backup".equals(value.getString("format")) || !(value.get("version") instanceof Integer) || value.getInt("version") != 1 ||
                value.getJSONArray("tasks").length() > 10000 || value.getJSONArray("plans").length() > 10000) {
                call.reject("Unsupported device snapshot.", "storage_input"); return;
            }
            SQLiteDatabase db = helper.getWritableDatabase();
            String revision = UUID.randomUUID().toString();
            boolean conflict = false;
            db.beginTransaction();
            try {
                String current = "empty";
                try (Cursor cursor = db.rawQuery("SELECT revision FROM snapshot WHERE id=1", null)) {
                    if (cursor.moveToFirst()) current = cursor.getString(0);
                }
                if (!current.equals(expected)) conflict = true;
                else {
                    ContentValues row = new ContentValues();
                    row.put("id", 1); row.put("revision", revision); row.put("data", snapshot);
                    if (db.insertWithOnConflict("snapshot", null, row, SQLiteDatabase.CONFLICT_REPLACE) == -1) throw new IllegalStateException("Save failed.");
                    db.setTransactionSuccessful();
                }
            } finally { db.endTransaction(); }
            if (conflict) { call.reject("Device records changed. Retry the save.", "conflict"); return; }
            JSObject result = new JSObject(); result.put("revision", revision);
            call.resolve(result); // Acknowledge only after transaction commit.
        } catch (Exception failure) {
            call.reject("The save failed. Existing records were preserved.", "storage_write");
        }
    }
    @Override protected synchronized void handleOnDestroy() { if (helper != null) helper.close(); }
}
