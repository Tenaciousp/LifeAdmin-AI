package uk.co.tenaciouspl.lifeadmin;

import android.app.Activity;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.ClipDescription;
import android.os.Build;
import android.os.PersistableBundle;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "LifeAdminFiles")
public class LifeAdminFilesPlugin extends Plugin {
    private static final int LIMIT = 5 * 1024 * 1024;
    private boolean choosing = false;

    @PluginMethod public synchronized void exportBackup(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null || snapshot.getBytes(StandardCharsets.UTF_8).length > LIMIT) {
            call.reject("Invalid or oversized backup.", "file_input"); return;
        }
        if (choosing) { call.reject("Finish the current file selection.", "file_busy"); return; }
        choosing = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "homeadmin-backup.json");
        try { startActivityForResult(call, intent, "exportResult"); }
        catch (Exception error) { choosing = false; call.reject("File selection is unavailable.", "file_open"); }
    }
    @PluginMethod public synchronized void importBackup(PluginCall call) {
        if (choosing) { call.reject("Finish the current file selection.", "file_busy"); return; }
        choosing = true;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        try { startActivityForResult(call, intent, "importResult"); }
        catch (Exception error) { choosing = false; call.reject("File selection is unavailable.", "file_open"); }
    }
    @PluginMethod public void copyText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.length() > 262144) { call.reject("Plan text is too large to copy.", "clipboard_input"); return; }
        try {
            ClipboardManager manager = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager == null) throw new IllegalStateException();
            ClipData clip = ClipData.newPlainText("HomeAdmin plan", text);
            if (Build.VERSION.SDK_INT >= 33) {
                PersistableBundle extras = new PersistableBundle();
                extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true);
                clip.getDescription().setExtras(extras);
            }
            manager.setPrimaryClip(clip); call.resolve();
        } catch (Exception error) { call.reject("Copy failed. Select the text and copy manually.", "clipboard_write"); }
    }
    private Uri selected(ActivityResult result) {
        return result.getResultCode() == Activity.RESULT_OK && result.getData() != null ? result.getData().getData() : null;
    }
    @ActivityCallback private synchronized void exportResult(PluginCall call, ActivityResult result) {
        choosing = false; if (call == null) return;
        Uri uri = selected(result);
        if (uri == null) { call.reject("Backup export cancelled.", "cancelled"); return; }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) throw new IllegalStateException("Destination unavailable.");
            String snapshot = call.getString("snapshot");
            if (snapshot == null || snapshot.getBytes(StandardCharsets.UTF_8).length > LIMIT) throw new IllegalArgumentException();
            stream.write(snapshot.getBytes(StandardCharsets.UTF_8)); stream.flush();
        } catch (Exception error) { call.reject("Backup file could not be saved. Check the destination before relying on this copy.", "file_write"); return; }
        call.resolve();
    }
    @ActivityCallback private synchronized void importResult(PluginCall call, ActivityResult result) {
        choosing = false; if (call == null) return;
        Uri uri = selected(result);
        if (uri == null) { call.reject("Backup selection cancelled.", "cancelled"); return; }
        try (InputStream stream = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (stream == null) throw new IllegalStateException();
            byte[] buffer = new byte[8192]; int count;
            while ((count = stream.read(buffer)) != -1) {
                if (bytes.size() + count > LIMIT) throw new IllegalArgumentException();
                bytes.write(buffer, 0, count);
            }
            String snapshot = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
            JSObject value = new JSObject(); value.put("snapshot", snapshot); call.resolve(value);
        } catch (Exception error) { call.reject("Backup must be a readable UTF-8 JSON file no larger than 5 MB.", "file_read"); }
    }
}
