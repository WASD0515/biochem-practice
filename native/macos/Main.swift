import AppKit
import WebKit
import UniformTypeIdentifiers

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var folder: URL?
    var signatures: [String: String] = [:]
    var timer: Timer?
    let assets = Bundle.main.resourceURL!.appendingPathComponent("dist", isDirectory: true)
    var smokePath: String? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--smoke-test"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu(), appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于生化练习室", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出生化练习室", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let appItem = NSMenuItem(); appItem.submenu = appMenu; menu.addItem(appItem)
        let edit = NSMenu(title: "编辑")
        for (title, action, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let editItem = NSMenuItem(); editItem.submenu = edit; menu.addItem(editItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        let windowItem = NSMenuItem(); windowItem.submenu = windowMenu; menu.addItem(windowItem)
        NSApp.mainMenu = menu; NSApp.windowsMenu = windowMenu

        let controller = WKUserContentController()
        controller.add(self, name: "desktop")
        controller.addUserScript(WKUserScript(source: """
        (() => {
          let counter = 0; const pending = new Map(), listeners = [];
          window.__desktopReply = (id, value, error) => {
            const entry = pending.get(id); if (!entry) return;
            pending.delete(id); error ? entry.reject(new Error(error)) : entry.resolve(value);
          };
          window.__desktopFiles = files => listeners.forEach(callback => callback(files));
          function invoke(action, data = {}) {
            return new Promise((resolve, reject) => {
              const id = ++counter; pending.set(id, {resolve, reject});
              window.webkit.messageHandlers.desktop.postMessage({id, action, ...data});
            });
          }
          window.DesktopBridge = Object.freeze({platform: 'darwin', arch: 'universal',
            saveFile: (name, type, content) => invoke('save-file', {name, type, content}),
            watchFolder: () => invoke('watch-folder'),
            openExternal: url => invoke('open-update-url', {url}),
            onFiles: callback => listeners.push(callback)
          });
        })();
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self; webView.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 950), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.minSize = NSSize(width: 680, height: 650)
        window.title = "生化练习室"; window.contentView = webView
        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.loadFileURL(assets.appendingPathComponent("index.html"), allowingReadAccessTo: assets)
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.scanFolder() }
        if smokePath != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in self?.finishSmoke(["error": "页面加载超时"], success: false) }
        }
    }
    @objc func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "生化练习室", .version: "离线题库 · Apple 芯片与 Intel 通用版"])
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        decisionHandler(url.isFileURL && url.standardizedFileURL.path.hasPrefix(assets.path + "/") ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.json, .commaSeparatedText, .plainText, UTType(filenameExtension: "docx")!]
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func reply(_ id: Int, _ value: Any = NSNull(), error: String? = nil) {
        guard let data = try? JSONSerialization.data(withJSONObject: [id, value, error as Any? ?? NSNull()]), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__desktopReply(...\(json));", completionHandler: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let data = message.body as? [String: Any], let id = data["id"] as? Int, let action = data["action"] as? String else { return }
        switch action {
        case "save-file":
            guard let name = data["name"] as? String, let content = data["content"] as? String, content.utf8.count <= 20_000_000 else { reply(id, error: "导出内容无效或过大"); return }
            let panel = NSSavePanel()
            panel.title = "保存生化练习室文件"
            panel.nameFieldStringValue = (name as NSString).lastPathComponent
            panel.canCreateDirectories = true
            panel.beginSheetModal(for: window) { [weak self] result in
                guard result == .OK, let url = panel.url else { self?.reply(id, false); return }
                do { try content.write(to: url, atomically: true, encoding: .utf8); self?.reply(id, true) }
                catch { self?.reply(id, error: error.localizedDescription) }
            }
        case "open-update-url":
            guard let value = data["url"] as? String, let url = URL(string: value), url.scheme == "https", url.host == "github.com", url.port == nil, url.user == nil, url.password == nil,
                  url.path == "/WASD0515/biochem-practice/releases" || url.path.hasPrefix("/WASD0515/biochem-practice/releases/") else { reply(id, error: "无效的项目下载地址"); return }
            reply(id, NSWorkspace.shared.open(url))
        case "watch-folder":
            let panel = NSOpenPanel()
            panel.title = "选择教师题库自动导入文件夹"
            panel.canChooseDirectories = true; panel.canChooseFiles = false
            panel.beginSheetModal(for: window) { [weak self] result in
                guard let self = self, result == .OK, let url = panel.url else { self?.reply(id); return }
                self.folder = url; self.signatures = [:]; self.reply(id, url.lastPathComponent)
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.scanFolder() }
            }
        default: reply(id, error: "不支持的操作")
        }
    }
    func scanFolder() {
        guard let folder = folder else { return }
        do {
            var files: [[String: String]] = []
            for url in try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]) {
                guard ["json", "csv", "txt", "docx"].contains(url.pathExtension.lowercased()) else { continue }
                let metadata = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey])
                guard metadata.isRegularFile == true, let size = metadata.fileSize, size <= 15_000_000 else { continue }
                let signature = "\(metadata.contentModificationDate?.timeIntervalSince1970 ?? 0):\(size)"
                if signatures[url.lastPathComponent] == signature { continue }
                files.append(["name": url.lastPathComponent, "base64": try Data(contentsOf: url).base64EncodedString()])
                signatures[url.lastPathComponent] = signature
            }
            if !files.isEmpty {
                let data = try JSONSerialization.data(withJSONObject: files)
                webView.evaluateJavaScript("window.__desktopFiles(\(String(data: data, encoding: .utf8)!));", completionHandler: nil)
            }
        } catch { NSLog("教师文件夹读取失败：%@", error.localizedDescription) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard smokePath != nil else { return }
        // Developer-only smoke test, using the real macOS WebKit and persistent storage.
        webView.evaluateJavaScript("""
        (() => {
          const before = localStorage.getItem('biochem-mac-smoke');
          localStorage.setItem('biochem-mac-smoke', 'persistent');
          const result = {version: U.VERSION, platform: DesktopBridge.platform,
            total: bank().length, safe: active().length, storage: storageOK,
            persistedAcrossLaunch: before === 'persistent', title: document.title,
            updateTarget: AppPlatform.downloadTarget({macos: 'mac.dmg', windows: 'win.exe'}).url};
          nav('settings'); result.settings = document.querySelector('#content').innerText.includes('macOS');
          nav('practice'); result.chapters = document.querySelectorAll('[data-topic]').length;
          nav('home'); return result;
        })()
        """) { [weak self] value, error in
            guard let result = value as? [String: Any], error == nil else { self?.finishSmoke(["error": error?.localizedDescription ?? "未知错误"], success: false); return }
            let success = result["total"] as? Int == 2433 && result["storage"] as? Bool == true && result["platform"] as? String == "darwin" && result["updateTarget"] as? String == "mac.dmg" && result["settings"] as? Bool == true
            self?.finishSmoke(result, success: success)
        }
    }
    func finishSmoke(_ result: [String: Any], success: Bool) {
        guard let path = smokePath else { return }
        if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: URL(fileURLWithPath: path)) }
        exit(success ? 0 : 1)
    }
}
let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
