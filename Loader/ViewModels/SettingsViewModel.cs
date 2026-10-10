using CommunityToolkit.Mvvm.ComponentModel;

namespace RobloxExecutor.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    [ObservableProperty] private string targetProcess = "RobloxPlayerBeta.exe";
    [ObservableProperty] private string pipeName = "vanta_pipe";
    [ObservableProperty] private string bootstrapPath = "Bootstrap.dll";
    [ObservableProperty] private bool manualMap = true;
    [ObservableProperty] private bool autoReattach = true;
}
