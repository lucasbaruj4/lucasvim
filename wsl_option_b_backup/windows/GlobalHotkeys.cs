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
// Windows handles Alt+Tab and Alt+Space normally now that explorer.exe is
// the shell again. Ctrl+V in Pi is supplied by Windows Terminal.
class HotkeyListener : Form {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    const uint MOD_ALT = 0x0001;
    const uint MOD_CONTROL = 0x0002;
    const uint MOD_SHIFT = 0x0004;
    const uint VK_UP = 0x26;
    const uint VK_DOWN = 0x28;
    const uint VK_S = 0x53;
    const uint VK_M = 0x4D;
    const int WM_HOTKEY = 0x0312;

    const int ID_SCREENSHOT = 1;
    const int ID_VOL_UP = 2;
    const int ID_VOL_DOWN = 3;
    const int ID_MUTE = 4;

    const string AUDIO_EXE = @"C:\Users\Admin\AppData\Local\AudioCtl.exe";

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

    protected override void Dispose(bool disposing) {
        UnregisterHotKey(this.Handle, ID_SCREENSHOT);
        UnregisterHotKey(this.Handle, ID_VOL_UP);
        UnregisterHotKey(this.Handle, ID_VOL_DOWN);
        UnregisterHotKey(this.Handle, ID_MUTE);
        base.Dispose(disposing);
    }

    [STAThread]
    static void Main() {
        SetProcessDPIAware();
        Application.EnableVisualStyles();
        Application.Run(new HotkeyListener());
    }
}
