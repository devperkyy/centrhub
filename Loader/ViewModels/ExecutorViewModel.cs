// Editor state + inject/execute/clear + console pipe
using System.Collections.ObjectModel;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RobloxExecutor.Services;

namespace RobloxExecutor.ViewModels;

public partial class ScriptTab : ObservableObject
{
    [ObservableProperty] private string title = "untitled";
    [ObservableProperty] private string source = "-- Luau\nprint('hello from VANTA')\n";
    [ObservableProperty] private bool dirty;
}

public partial class ExecutorViewModel : ObservableObject
{
    public ObservableCollection<ScriptTab> Tabs { get; } = new();
    [ObservableProperty] private ScriptTab? activeTab;
    [ObservableProperty] private string consoleBuffer = "";
    [ObservableProperty] private bool isAttached;

    public ExecutorViewModel()
    {
        Tabs.Add(new ScriptTab());
        ActiveTab = Tabs[0];
        PipeClient.Connected += () => IsAttached = true;
        PipeClient.Disconnected += () => IsAttached = false;
    }

    [RelayCommand]
    private async Task InjectAsync()
    {
        AppendConsole("[*] locating target process...");
        var proc = Injector.FindRoblox();
        if (proc == null) { AppendConsole("[!] no RobloxPlayerBeta.exe"); return; }
        AppendConsole($"[*] injecting into PID {proc.Id}...");
        var ok = await Task.Run(() => Injector.Inject(proc.Id));
        AppendConsole(ok ? "[+] bootstrap injected" : "[!] injection failed");
        if (ok) await PipeClient.ConnectAsync();
    }

    [RelayCommand]
    private async Task ExecuteAsync()
    {
        if (ActiveTab == null) return;
        if (!PipeClient.IsConnected) { AppendConsole("[!] not attached"); return; }
        AppendConsole($"[>] execute ({ActiveTab.Source.Length} chars)");
        await PipeClient.SendScriptAsync(ActiveTab.Source);
    }

    [RelayCommand]
    private void Clear() => ConsoleBuffer = "";

    [RelayCommand]
    private void NewTab()
    {
        var t = new ScriptTab { Title = $"untitled {Tabs.Count + 1}", Source = "" };
        Tabs.Add(t);
        ActiveTab = t;
    }

    [RelayCommand]
    private void CloseTab(ScriptTab? t)
    {
        if (t == null || Tabs.Count <= 1) return;
        var idx = Tabs.IndexOf(t);
        Tabs.Remove(t);
        ActiveTab = Tabs[System.Math.Max(0, idx - 1)];
    }

    public void AppendConsole(string line)
    {
        Application.Current.Dispatcher.Invoke(() =>
            ConsoleBuffer += (ConsoleBuffer.Length == 0 ? "" : "\n") + line);
    }
}
