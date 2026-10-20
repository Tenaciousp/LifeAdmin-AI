package uk.co.tenaciouspl.lifeadmin;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.SQLiteMode;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 35)
@SQLiteMode(SQLiteMode.Mode.NATIVE)
public class LifeAdminStoragePluginTest {
    private static final String NAME = "lifeadmin-records-v1.sqlite";
    private static final String FIRST = "{\"format\":\"lifeadmin-backup\",\"version\":1,\"tasks\":[],\"plans\":[],\"exported_at\":\"first\"}";
    private static final String SECOND = "{\"format\":\"lifeadmin-backup\",\"version\":1,\"tasks\":[],\"plans\":[],\"exported_at\":\"second\"}";
    private Context context;
    private LifeAdminStoragePlugin plugin;
    private LifeAdminStoragePlugin open() {
        LifeAdminStoragePlugin value = new LifeAdminStoragePlugin() {
            @Override public Context getContext() { return context; }
        };
        value.load(); return value;
    }
    @Before public void setup() {
        context = RuntimeEnvironment.getApplication();
        context.deleteDatabase(NAME);
        plugin = open();
    }
    @After public void close() { plugin.handleOnDestroy(); context.deleteDatabase(NAME); }
    private PluginCall write(String revision, String snapshot) {
        PluginCall call = mock(PluginCall.class);
        when(call.getString("expectedRevision")).thenReturn(revision);
        when(call.getString("snapshot")).thenReturn(snapshot);
        plugin.write(call); return call;
    }
    private JSObject result(PluginCall call) {
        ArgumentCaptor<JSObject> value = ArgumentCaptor.forClass(JSObject.class);
        verify(call).resolve(value.capture()); return value.getValue();
    }
    private JSObject read() { PluginCall call = mock(PluginCall.class); plugin.read(call); return result(call); }
    private SQLiteDatabase raw() {
        return SQLiteDatabase.openDatabase(context.getDatabasePath(NAME).getPath(), null, SQLiteDatabase.OPEN_READWRITE);
    }
    @Test public void acknowledgedSnapshotSurvivesReconnect() throws Exception {
        assertEquals("empty", read().getString("revision"));
        assertTrue(read().isNull("snapshot"));
        String revision = result(write("empty", FIRST)).getString("revision");
        plugin.handleOnDestroy(); plugin = open();
        assertEquals(revision, read().getString("revision"));
        assertEquals(FIRST, read().getString("snapshot"));
    }
    @Test public void staleWriteKeepsTheCommittedSnapshot() throws Exception {
        String revision = result(write("empty", FIRST)).getString("revision");
        PluginCall stale = write("empty", SECOND);
        verify(stale).reject(anyString(), eq("conflict"));
        verify(stale, never()).resolve(any(JSObject.class));
        assertEquals(revision, read().getString("revision"));
        assertEquals(FIRST, read().getString("snapshot"));
    }
    @Test public void nativeInsertFailureRollsBackTheWholeReplacement() throws Exception {
        String revision = result(write("empty", FIRST)).getString("revision");
        try (SQLiteDatabase db = raw()) {
            db.execSQL("CREATE TRIGGER fail_save BEFORE INSERT ON snapshot BEGIN SELECT RAISE(ABORT, 'injected'); END");
        }
        PluginCall failed = write(revision, SECOND);
        verify(failed).reject(anyString(), eq("storage_write"));
        verify(failed, never()).resolve(any(JSObject.class));
        assertEquals(revision, read().getString("revision"));
        assertEquals(FIRST, read().getString("snapshot"));
        try (SQLiteDatabase db = raw()) { db.execSQL("DROP TRIGGER fail_save"); }
        result(write(revision, SECOND));
        assertEquals(SECOND, read().getString("snapshot"));
    }
    @Test public void unsupportedDatabaseVersionDoesNotEraseRecords() throws Exception {
        result(write("empty", FIRST));
        plugin.handleOnDestroy();
        try (SQLiteDatabase db = raw()) { db.setVersion(2); }
        plugin = open();
        PluginCall call = mock(PluginCall.class); plugin.read(call);
        verify(call).reject(anyString(), eq("storage_read"));
        verify(call, never()).resolve(any(JSObject.class));
        try (SQLiteDatabase db = raw(); Cursor cursor = db.rawQuery("SELECT data FROM snapshot WHERE id=1", null)) {
            assertTrue(cursor.moveToFirst()); assertEquals(FIRST, cursor.getString(0));
        }
    }
}
