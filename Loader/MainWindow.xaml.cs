using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using RobloxExecutor.Services;

namespace RobloxExecutor;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        RenderTransform = new TranslateTransform(0, 12);
        Opacity = 0;
        SourceInitialized += (_, _) =>
        {
            MicaHelper.Apply(this);
            if (TryFindResource("SbWindowEntrance") is Storyboard sb) sb.Begin(this);
        };
    }

    private void OnMinimize(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void OnMaximize(object sender, RoutedEventArgs e)
        => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private void OnClose(object sender, RoutedEventArgs e)
    {
        var fade = new DoubleAnimation(1, 0, new System.Windows.Duration(System.TimeSpan.FromMilliseconds(140)));
        fade.Completed += (_, _) => Close();
        BeginAnimation(OpacityProperty, fade);
    }
}
