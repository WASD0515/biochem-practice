const {app,BrowserWindow,session,ipcMain,dialog,shell}=require('electron');
const path=require('path');
const fs=require('node:fs/promises');
let win,folder=null,versions=new Map();
async function scan(){if(!folder||!win)return;try{const files=[];for(const e of await fs.readdir(folder,{withFileTypes:true})){if(!e.isFile()||!(/\.(json|csv|txt|docx)$/i.test(e.name)))continue;const full=path.join(folder,e.name),st=await fs.stat(full),sig=st.mtimeMs+':'+st.size;if(st.size>15000000||versions.get(e.name)===sig)continue;const content=await fs.readFile(full);files.push({name:e.name,base64:content.toString('base64')});versions.set(e.name,sig);}if(files.length)win.webContents.send('folder-files',files);}catch(e){console.error('Folder scan failed:',e.message);}}
app.whenReady().then(()=>{
 session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 session.defaultSession.on('will-download',(_event,item)=>{
  item.setSaveDialogOptions({title:'保存生化练习室文件',defaultPath:path.join(app.getPath('downloads'),item.getFilename())});
 });
 win=new BrowserWindow({width:1400,height:950,minWidth:680,minHeight:650,title:'生化练习室',backgroundColor:'#f5f6f3',autoHideMenuBar:true,icon:path.join(__dirname,'../../dist/icon-512.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file://'))e.preventDefault();});
 win.loadFile(path.join(__dirname,'../../dist/index.html'));
 ipcMain.handle('open-update-url',async(_event,value)=>{const u=new URL(value),prefix='/WASD0515/biochem-practice/releases';if(u.protocol!=='https:'||u.hostname!=='github.com'||u.port||u.username||u.password||!(u.pathname===prefix||u.pathname.startsWith(prefix+'/')))throw Error('无效的项目下载地址');await shell.openExternal(u.href);return true;});
 ipcMain.handle('save-file',async(_event,{name,content})=>{if(typeof name!=='string'||typeof content!=='string'||content.length>20000000)throw Error('Invalid export');const choice=await dialog.showSaveDialog(win,{title:'保存生化练习室文件',defaultPath:path.join(app.getPath('downloads'),path.basename(name))});if(!choice.canceled&&choice.filePath){await fs.writeFile(choice.filePath,content,'utf8');return true;}return false;});
 ipcMain.handle('watch-folder',async()=>{const choice=await dialog.showOpenDialog(win,{title:'选择教师题库自动导入文件夹',properties:['openDirectory']});if(choice.canceled)return null;folder=choice.filePaths[0];versions=new Map();setTimeout(scan,1000);return path.basename(folder);});
 setInterval(scan,30000);
});
app.on('window-all-closed',()=>app.quit());
