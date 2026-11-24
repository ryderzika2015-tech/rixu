package tech.rixu.app;
import android.content.Intent;
import android.provider.Settings;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="RixuSettings")
public class RixuSettingsPlugin extends Plugin {
 @PluginMethod public void getReminderState(PluginCall call){
  android.media.AudioManager audio=(android.media.AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
  android.app.NotificationManager manager=(android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
  JSObject result=new JSObject();result.put("normalRinger",audio.getRingerMode()==android.media.AudioManager.RINGER_MODE_NORMAL);result.put("volume",audio.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION));
  result.put("unrestricted",manager.getCurrentInterruptionFilter()==android.app.NotificationManager.INTERRUPTION_FILTER_ALL);
  boolean sound=true,vibration=true;
  if(android.os.Build.VERSION.SDK_INT>=26){android.app.NotificationChannel channel=manager.getNotificationChannel("rixu-audible-v2");if(channel!=null){sound=channel.getSound()!=null&&channel.getImportance()>=3;vibration=channel.shouldVibrate();}}
  result.put("sound",sound);result.put("vibration",vibration);call.resolve(result);
 }
 @PluginMethod public void openNotificationSettings(PluginCall call){
  Intent intent;
  if(android.os.Build.VERSION.SDK_INT>=26){intent=new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);intent.putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());intent.putExtra(Settings.EXTRA_CHANNEL_ID,"rixu-audible-v2");}
  else{intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));}
  try{getActivity().startActivity(intent);call.resolve();}catch(Exception e){call.reject("无法打开通知设置");}
 }
 @PluginMethod public void openDownload(PluginCall call){
  String url=call.getString("url","");
  if(!url.matches("https://github\\.com/ryderzika2015-tech/rixu/releases/download/android-v[0-9]+\\.[0-9]+\\.[0-9]+/rixu-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk")){call.reject("更新地址无效");return;}
  try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));call.resolve();}catch(Exception e){call.reject("没有可用的浏览器，请稍后重试");}
 }
}
