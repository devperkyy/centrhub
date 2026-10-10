using System.IO;
using System.Reflection;
using System.Windows.Controls;
using System.Xml;
using ICSharpCode.AvalonEdit.Highlighting;
using ICSharpCode.AvalonEdit.Highlighting.Xshd;
using RobloxExecutor.ViewModels;

namespace RobloxExecutor.Views;

public partial class ExecutorView : UserControl
{
    public ExecutorView() { InitializeComponent(); DataContextChanged += OnCtx; }

    private void Editor_Loaded(object sender, System.Windows.RoutedEventArgs e)
    {
        var asm = Assembly.GetExecutingAssembly();
        using var s = asm.GetManifestResourceStream("RobloxExecutor.Resources.Luau.xshd")
                      ?? File.OpenRead("Resources/Luau.xshd");
        using var r = new XmlTextReader(s);
        Editor.SyntaxHighlighting = HighlightingLoader.Load(r, HighlightingManager.Instance);
    }

    private void OnCtx(object? _, System.Windows.DependencyPropertyChangedEventArgs e)
    {
        if (DataContext is ExecutorViewModel vm)
        {
            vm.PropertyChanged += (_, ev) =>
            {
                if (ev.PropertyName == nameof(ExecutorViewModel.ActiveTab))
                    SyncEditor(vm);
                if (ev.PropertyName == nameof(ExecutorViewModel.ConsoleBuffer))
                    Dispatcher.BeginInvoke(() => ConsoleScroll.ScrollToEnd());
            };
            SyncEditor(vm);
            Editor.TextChanged += (_, _) =>
            {
                if (vm.ActiveTab != null)
                { vm.ActiveTab.Source = Editor.Text; vm.ActiveTab.Dirty = true; }
            };
        }
    }

    private void SyncEditor(ExecutorViewModel vm)
    {
        if (vm.ActiveTab != null && Editor.Text != vm.ActiveTab.Source)
            Editor.Text = vm.ActiveTab.Source;
    }
}
