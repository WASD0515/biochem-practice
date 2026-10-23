package cn.edu.biochem.practice;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.annotation.SuppressLint;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
 private WebView web;private ValueCallback<Uri[]> chooser;private String pendingExport;
 private static final String ORIGIN="https://appassets.androidplatform.net";
 @SuppressLint("SetJavaScriptEnabled") public void onCreate(Bundle saved){
  super.onCreate(saved);getWindow().setStatusBarColor(0xff176455);getWindow().setNavigationBarColor(0xfff5f6f3);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(0xff176455);
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  web=new WebView(this);root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);
  web.addJavascriptInterface(new ExportBridge(),"NativeBridge");
  web.setWebViewClient(new WebViewClient(){
   public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri u=request.getUrl();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())){
     String p=u.getPath();if(p==null||p.contains(".."))return error();if(p.equals("/"))p="/index.html";
     try {String mime=p.endsWith(".js")?"application/javascript":p.endsWith(".css")?"text/css":p.endsWith(".json")||p.endsWith(".webmanifest")?"application/json":p.endsWith(".svg")?"image/svg+xml":p.endsWith(".png")?"image/png":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(p.substring(1)));}catch(IOException e){return error();}
    }return null;
   }
   private WebResourceResponse error(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,new ByteArrayInputStream(new byte[0]));}
   public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){return !ORIGIN.equals(req.getUrl().getScheme()+"://"+req.getUrl().getHost());}
  });
  web.setWebChromeClient(new WebChromeClient(){public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){
   if(chooser!=null)chooser.onReceiveValue(null);chooser=cb;
   Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
   try{startActivityForResult(i,10);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;
  }});
  web.loadUrl(ORIGIN+"/index.html");
 }
 public class ExportBridge{
  @JavascriptInterface public void saveFile(String name,String mime,String content){
   if(content==null||content.length()>20000000)return;
   runOnUiThread(()->{if(pendingExport!=null){Toast.makeText(MainActivity.this,"请先完成当前文件保存",Toast.LENGTH_SHORT).show();return;}pendingExport=content;
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json".equals(mime)?"application/json":"text/plain");i.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[\\\\/:*?\"<>|]","_"));
    try{startActivityForResult(i,11);}catch(Exception e){pendingExport=null;Toast.makeText(MainActivity.this,"未找到文件保存应用",Toast.LENGTH_LONG).show();}
   });
  }
 }
 protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
  if(request==10&&chooser!=null){Uri[] uris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();uris=new Uri[n];for(int i=0;i<n;i++)uris[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)uris=new Uri[]{data.getData()};}chooser.onReceiveValue(uris);chooser=null;}
  if(request==11){if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingExport!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(pendingExport.getBytes(StandardCharsets.UTF_8));Toast.makeText(this,"文件已保存",Toast.LENGTH_SHORT).show();}catch(Exception e){Toast.makeText(this,"保存失败，请重试",Toast.LENGTH_LONG).show();}}pendingExport=null;}
 }
 public void onBackPressed(){if(web.canGoBack())web.goBack();else{web.evaluateJavascript("document.querySelector('[data-action=nav][data-page=home]').click()",null);}}
 protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
