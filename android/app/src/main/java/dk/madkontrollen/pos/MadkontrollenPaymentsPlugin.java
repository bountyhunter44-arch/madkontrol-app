package dk.madkontrollen.pos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MadkontrollenPayments")
public class MadkontrollenPaymentsPlugin extends Plugin {
    private String getString(PluginCall call, String key) {
        String value = call.getString(key);
        return value == null ? "" : value.trim();
    }

    private double getAmount(PluginCall call) {
        Double amount = call.getDouble("amount");
        return amount == null ? 0 : amount;
    }

    private void rejectInvalid(PluginCall call, String message) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("provider", "zettle");
        result.put("status", "invalid_argument");
        result.put("code", "INVALID_PAYMENT_INPUT");
        result.put("message", message);
        call.resolve(result);
    }

    private JSObject notConfigured() {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("provider", "zettle");
        result.put("status", "unavailable");
        result.put("code", "ZETTLE_SDK_NOT_CONFIGURED");
        result.put("message", "Zettle SDK er ikke koblet på Android endnu.");
        return result;
    }

    @PluginMethod
    public void checkNativePaymentSupport(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("nativeAvailable", true);
        result.put("zettleSdkConfigured", false);
        call.resolve(result);
    }

    @PluginMethod
    public void startZettlePayment(PluginCall call) {
        String companyId = getString(call, "companyId");
        String locationId = getString(call, "locationId");
        String saleId = getString(call, "saleId");
        String reference = getString(call, "reference");
        double amount = getAmount(call);

        if (companyId.isEmpty()) {
            rejectInvalid(call, "companyId mangler.");
            return;
        }
        if (locationId.isEmpty()) {
            rejectInvalid(call, "locationId mangler.");
            return;
        }
        if (saleId.isEmpty() && reference.isEmpty()) {
            rejectInvalid(call, "saleId eller reference mangler.");
            return;
        }
        if (amount <= 0) {
            rejectInvalid(call, "Beløbet skal være større end 0.");
            return;
        }

        call.resolve(notConfigured());
    }

    @PluginMethod
    public void cancelZettlePayment(PluginCall call) {
        call.resolve(notConfigured());
    }
}
