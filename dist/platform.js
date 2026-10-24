(function(root){
'use strict';
const native=!!root.NativeBridge||!!root.DesktopBridge;
function ios(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function standalone(){return !!navigator.standalone||root.matchMedia('(display-mode: standalone)').matches;}
function downloadTarget(assets){
 if(root.NativeBridge)return assets.android?{url:assets.android,label:'下载安卓 APK'}:null;
 if(root.DesktopBridge){const mac=['darwin','macos'].includes(root.DesktopBridge.platform),key=mac?'macos':'windows';return assets[key]?{url:assets[key],label:mac?'下载 macOS 安装包':'下载 Windows x64 安装包'}:null;}
 return null;
}
const api={native,ios,standalone,downloadTarget};
if(typeof module!=='undefined')module.exports=api;else root.AppPlatform=api;
})(typeof window!=='undefined'?window:globalThis);
