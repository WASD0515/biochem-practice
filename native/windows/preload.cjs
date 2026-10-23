const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('DesktopBridge',{
 saveFile:(name,type,content)=>ipcRenderer.invoke('save-file',{name,type,content}),
 watchFolder:()=>ipcRenderer.invoke('watch-folder'),
 openExternal:url=>ipcRenderer.invoke('open-update-url',url),
 onFiles:callback=>ipcRenderer.on('folder-files',(_event,files)=>callback(files))
});
