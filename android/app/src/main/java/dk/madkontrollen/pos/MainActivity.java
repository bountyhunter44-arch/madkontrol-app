package dk.madkontrollen.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MadkontrollenPaymentsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
