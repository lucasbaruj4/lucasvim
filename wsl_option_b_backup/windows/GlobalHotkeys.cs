using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Persistent background listener: registers useful system-wide hotkeys
// (work no matter which app has focus):
//   Shift+S            -> snip-style region-select screenshot
//   Ctrl+Alt+Up/Down    -> volume up/down
//   Ctrl+Shift+M        -> mute toggle
// Windows handles Alt+Tab and Alt+Space normally now that explorer.exe is
// the shell again.
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
                case ID_SCREENSHOT: TakeSnip(); break;
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

    void TakeSnip() {
        Rectangle bounds = Screen.PrimaryScreen.Bounds;
        Bitmap full = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(full)) {
            g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
        }

        using (var overlay = new SnipOverlay(full, bounds)) {
            overlay.ShowDialog();
        }
        full.Dispose();
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

class SnipOverlay : Form {
    Bitmap fullImage;
    Point start;
    Rectangle selection;
    bool selecting = false;

    public SnipOverlay(Bitmap full, Rectangle bounds) {
        fullImage = full;
        this.FormBorderStyle = FormBorderStyle.None;
        this.Bounds = bounds;
        this.StartPosition = FormStartPosition.Manual;
        this.TopMost = true;
        this.Cursor = Cursors.Cross;
        this.DoubleBuffered = true;
        this.KeyPreview = true;
        this.BackgroundImage = full;
        this.BackgroundImageLayout = ImageLayout.None;
        this.ShowInTaskbar = false;
    }

    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        this.Activate();
        this.Focus();
    }

    protected override void OnMouseDown(MouseEventArgs e) {
        selecting = true;
        start = e.Location;
        selection = new Rectangle(start, Size.Empty);
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e) {
        if (selecting) {
            int x = Math.Min(start.X, e.X);
            int y = Math.Min(start.Y, e.Y);
            int w = Math.Abs(e.X - start.X);
            int h = Math.Abs(e.Y - start.Y);
            selection = new Rectangle(x, y, w, h);
            Invalidate();
        }
    }

    protected override void OnMouseUp(MouseEventArgs e) {
        selecting = false;
        if (selection.Width > 2 && selection.Height > 2) {
            CopySelectionToClipboard();
        }
        this.Close();
    }

    protected override void OnKeyDown(KeyEventArgs e) {
        if (e.KeyCode == Keys.Escape) {
            this.Close();
        }
    }

    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        using (var dim = new SolidBrush(Color.FromArgb(120, 0, 0, 0))) {
            using (Region r = new Region(this.ClientRectangle)) {
                if (selection.Width > 0 && selection.Height > 0) {
                    r.Exclude(selection);
                }
                e.Graphics.FillRegion(dim, r);
            }
        }
        if (selection.Width > 0 && selection.Height > 0) {
            using (var pen = new Pen(Color.DeepSkyBlue, 2)) {
                e.Graphics.DrawRectangle(pen, selection);
            }
        }
    }

    void CopySelectionToClipboard() {
        using (Bitmap cropped = fullImage.Clone(selection, fullImage.PixelFormat)) {
            Clipboard.SetImage(cropped);
        }
    }
}
