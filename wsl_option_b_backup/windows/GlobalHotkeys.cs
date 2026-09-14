using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Persistent background listener: registers useful system-wide hotkeys
// (work no matter which app has focus):
//   Shift+S            -> the normal Windows Snipping Tool region selector
//   Ctrl+Alt+Up/Down    -> volume up/down
//   Ctrl+Shift+M        -> mute toggle
//   Win+E              -> open Files
// Windows handles Alt+Tab and Alt+Space normally now that explorer.exe is
// the shell again. Ctrl+V in Pi is supplied by Windows Terminal.
class HotkeyListener : Form {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc callback, IntPtr moduleHandle, uint threadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string moduleName);

    delegate IntPtr LowLevelKeyboardProc(int code, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    struct KeyboardHookData {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr extraInfo;
    }

    const int WH_KEYBOARD_LL = 13;
    const int WM_KEYDOWN = 0x0100;
    const int WM_KEYUP = 0x0101;
    const int WM_SYSKEYDOWN = 0x0104;
    const int WM_SYSKEYUP = 0x0105;
    const uint KEYEVENTF_KEYUP = 0x0002;

    const uint MOD_ALT = 0x0001;
    const uint MOD_CONTROL = 0x0002;
    const uint MOD_SHIFT = 0x0004;
    const byte VK_LWIN = 0x5B;
    const byte VK_RWIN = 0x5C;
    const byte VK_MENU = 0x12;
    const byte VK_SPACE = 0x20;
    const uint VK_UP = 0x26;
    const uint VK_DOWN = 0x28;
    const uint VK_S = 0x53;
    const uint VK_M = 0x4D;
    const uint VK_E = 0x45;
    const int WM_HOTKEY = 0x0312;

    const int ID_SCREENSHOT = 1;
    const int ID_VOL_UP = 2;
    const int ID_VOL_DOWN = 3;
    const int ID_MUTE = 4;

    const string AUDIO_EXE = @"C:\Users\Admin\AppData\Local\AudioCtl.exe";

    LowLevelKeyboardProc keyboardHookProc;
    IntPtr keyboardHook;
    bool winKeyDown;
    bool winComboUsed;
    bool suppressE;

    public HotkeyListener() {
        this.ShowInTaskbar = false;
        this.Opacity = 0;
        this.FormBorderStyle = FormBorderStyle.FixedToolWindow;
        this.StartPosition = FormStartPosition.Manual;
        this.Bounds = new Rectangle(-2000, -2000, 1, 1);
    }

    protected override void OnLoad(EventArgs e) {
        base.OnLoad(e);
        this.Hide();
        RegisterHotKey(this.Handle, ID_SCREENSHOT, MOD_SHIFT, VK_S);
        RegisterHotKey(this.Handle, ID_VOL_UP, MOD_CONTROL | MOD_ALT, VK_UP);
        RegisterHotKey(this.Handle, ID_VOL_DOWN, MOD_CONTROL | MOD_ALT, VK_DOWN);
        RegisterHotKey(this.Handle, ID_MUTE, MOD_CONTROL | MOD_SHIFT, VK_M);
        keyboardHookProc = KeyboardHookCallback;
        keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardHookProc, GetModuleHandle(null), 0);
    }

    protected override void WndProc(ref Message m) {
        if (m.Msg == WM_HOTKEY) {
            switch (m.WParam.ToInt32()) {
                case ID_SCREENSHOT: LaunchWindowsSnip(); break;
                case ID_VOL_UP: RunAudioCtl("up"); break;
                case ID_VOL_DOWN: RunAudioCtl("down"); break;
                case ID_MUTE: RunAudioCtl("toggle"); break;
            }
        }
        base.WndProc(ref m);
    }

    void RunAudioCtl(string action) {
        var psi = new ProcessStartInfo(AUDIO_EXE, action);
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        Process.Start(psi);
    }

    void LaunchWindowsSnip() {
        try {
            Process.Start(new ProcessStartInfo {
                FileName = "ms-screenclip:",
                UseShellExecute = true
            });
        } catch { }
    }

    void LaunchFiles() {
        try {
            Process.Start(new ProcessStartInfo {
                FileName = "explorer.exe",
                Arguments = @"shell:AppsFolder\Files_1y0xx7n9077q4!App",
                UseShellExecute = true
            });
        } catch { }
    }

    void LaunchPowerToysRun() {
        try {
            keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
            keybd_event(VK_SPACE, 0, 0, UIntPtr.Zero);
            keybd_event(VK_SPACE, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        } catch { }
    }

    IntPtr KeyboardHookCallback(int code, IntPtr wParam, IntPtr lParam) {
        if (code >= 0) {
            int message = wParam.ToInt32();
            KeyboardHookData data = (KeyboardHookData)Marshal.PtrToStructure(lParam, typeof(KeyboardHookData));
            bool keyDown = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
            bool keyUp = message == WM_KEYUP || message == WM_SYSKEYUP;

            if (keyDown && (data.vkCode == VK_LWIN || data.vkCode == VK_RWIN)) {
                if (!winKeyDown) winComboUsed = false;
                winKeyDown = true;
            } else if (keyDown && winKeyDown) {
                winComboUsed = true;
                if (data.vkCode == VK_E) {
                    if (!suppressE) {
                        suppressE = true;
                        try { BeginInvoke((MethodInvoker)LaunchFiles); } catch { }
                    }
                    return (IntPtr)1;
                }
            } else if (keyUp && data.vkCode == VK_E && suppressE) {
                suppressE = false;
                return (IntPtr)1;
            } else if (keyUp && (data.vkCode == VK_LWIN || data.vkCode == VK_RWIN)) {
                bool bareWin = winKeyDown && !winComboUsed;
                winKeyDown = false;
                if (bareWin) {
                    try { BeginInvoke((MethodInvoker)LaunchPowerToysRun); } catch { }
                    return (IntPtr)1;
                }
            }
        }

        return CallNextHookEx(keyboardHook, code, wParam, lParam);
    }

    protected override void Dispose(bool disposing) {
        UnregisterHotKey(this.Handle, ID_SCREENSHOT);
        UnregisterHotKey(this.Handle, ID_VOL_UP);
        UnregisterHotKey(this.Handle, ID_VOL_DOWN);
        UnregisterHotKey(this.Handle, ID_MUTE);
        if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook);
        base.Dispose(disposing);
    }

    [STAThread]
    static void Main() {
        SetProcessDPIAware();
        Application.EnableVisualStyles();
        Application.Run(new HotkeyListener());
    }
}
