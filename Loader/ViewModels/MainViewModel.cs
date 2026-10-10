// Root VM: nav state, injection status, pipe plumbing to bootstrap
using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using CommunityToolkit.Mvvm.ComponentModel;
using RobloxExecutor.Services;
using RobloxExecutor.Views;

namespace RobloxExecutor.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly ExecutorView _executor = new();
    private readonly ScriptsView _scripts = new();
    private readonly SettingsView _settings = new();

    [ObservableProperty] private UserControl? currentView;
    [ObservableProperty] private bool isExecutorActive = true;
    [ObservableProperty] private bool isScriptsActive;
    [ObservableProperty] private bool isSettingsActive;

    [ObservableProperty] private string statusText = "Not attached";
    [ObservableProperty] private Brush statusColorBrush = (Brush)Application.Current.FindResource("Fg2Brush");
    [ObservableProperty] private string processInfo = "No Roblox process detected";
    [ObservableProperty] private string footerLeft = "idle";
    [ObservableProperty] private string footerRight = "VANTA v0.1";

    public MainViewModel()
    {
        CurrentView = _executor;
        _executor.DataContext = ExecutorVM;
        _scripts.DataContext = ScriptsVM;
        _settings.DataContext = SettingsVM;

        PipeClient.Connected    += () => UpdateStatus("Attached", "GoodBrush");
        PipeClient.Disconnected += () => UpdateStatus("Not attached", "Fg2Brush");
        PipeClient.LogReceived  += line => ExecutorVM.AppendConsole(line);

        _ = PollProcessAsync();
    }

    public ExecutorViewModel ExecutorVM { get; } = new();
    public ScriptsViewModel ScriptsVM { get; } = new();
    public SettingsViewModel SettingsVM { get; } = new();

    partial void OnIsExecutorActiveChanged(bool value) { if (value) { CurrentView = _executor; PlayContentFade(_executor); } }
    partial void OnIsScriptsActiveChanged(bool value)  { if (value) { CurrentView = _scripts;  PlayContentFade(_scripts);  } }
    partial void OnIsSettingsActiveChanged(bool value) { if (value) { CurrentView = _settings; PlayContentFade(_settings); } }

    private static void PlayContentFade(FrameworkElement el)
    {
        el.RenderTransform = new TranslateTransform(0, 6);
        if (Application.Current.TryFindResource("SbContentFade") is Storyboard sb)
            sb.Begin(el);
    }

    private void UpdateStatus(string txt, string brushKey)
    {
        StatusText = txt;
        StatusColorBrush = (Brush)Application.Current.FindResource(brushKey);
    }

    private async Task PollProcessAsync()
    {
        while (true)
        {
            var p = Injector.FindRoblox();
            ProcessInfo = p == null
                ? "No Roblox process detected"
                : $"RobloxPlayerBeta.exe · PID {p.Id}";
            await Task.Delay(1500);
        }
    }
}
