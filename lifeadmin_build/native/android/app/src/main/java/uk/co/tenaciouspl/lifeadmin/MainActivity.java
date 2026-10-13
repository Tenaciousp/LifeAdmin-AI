package uk.co.tenaciouspl.lifeadmin;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LifeAdminStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
