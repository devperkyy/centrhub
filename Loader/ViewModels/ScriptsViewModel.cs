// Local library + github raw import
using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RobloxExecutor.Services;

namespace RobloxExecutor.ViewModels;

public partial class StoredScript : ObservableObject
{
    [ObservableProperty] private string name = "";
    [ObservableProperty] private string path = "";
}

public partial class ScriptsViewModel : ObservableObject
{
    public ObservableCollection<StoredScript> Library { get; } = new();
    [ObservableProperty] private string githubUrl = "";
    [ObservableProperty] private string importLog = "";

    private readonly string _dir;

    public ScriptsViewModel()
    {
        _dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VANTA", "scripts");
        Directory.CreateDirectory(_dir);
        Refresh();
    }

    [RelayCommand]
    private void Refresh()
    {
        Library.Clear();
        foreach (var f in Directory.EnumerateFiles(_dir, "*.lua", SearchOption.AllDirectories))
            Library.Add(new StoredScript { Name = Path.GetFileName(f), Path = f });
    }

    [RelayCommand]
    private async Task ImportGithubAsync()
    {
        if (string.IsNullOrWhiteSpace(GithubUrl)) return;
        ImportLog = "fetching...";
        try
        {
            var (name, body) = await GithubFetcher.FetchAsync(GithubUrl);
            var path = Path.Combine(_dir, name);
            await File.WriteAllTextAsync(path, body);
            ImportLog = $"saved {name} ({body.Length} chars)";
            Refresh();
        }
        catch (Exception ex) { ImportLog = $"fail: {ex.Message}"; }
    }

    public string Read(StoredScript s) => File.ReadAllText(s.Path);
}
