// Named pipe to bootstrap DLL. protocol: 4-byte LE length prefix + utf8 payload
// first byte of payload is a tag: 'S' = script, 'L' = log, 'K' = kill
using System;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace RobloxExecutor.Services;

public static class PipeClient
{
    private static NamedPipeClientStream? _pipe;
    private static CancellationTokenSource? _cts;
    public static bool IsConnected => _pipe?.IsConnected == true;

    public static event Action? Connected;
    public static event Action? Disconnected;
    public static event Action<string>? LogReceived;

    public static async Task<bool> ConnectAsync(string name = "vanta_pipe", int timeoutMs = 4000)
    {
        try
        {
            _pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous);
            await _pipe.ConnectAsync(timeoutMs);
            _cts = new CancellationTokenSource();
            _ = ReadLoop(_cts.Token);
            Connected?.Invoke();
            return true;
        }
        catch { Disconnected?.Invoke(); return false; }
    }

    public static async Task SendScriptAsync(string src)
    {
        if (_pipe is null || !_pipe.IsConnected) return;
        var body = Encoding.UTF8.GetBytes("S" + src);
        var len = BitConverter.GetBytes(body.Length);
        await _pipe.WriteAsync(len);
        await _pipe.WriteAsync(body);
        await _pipe.FlushAsync();
    }

    static async Task ReadLoop(CancellationToken ct)
    {
        var hdr = new byte[4];
        try
        {
            while (!ct.IsCancellationRequested && _pipe!.IsConnected)
            {
                int r = await _pipe.ReadAsync(hdr, 0, 4, ct);
                if (r != 4) break;
                int len = BitConverter.ToInt32(hdr);
                if (len <= 0 || len > 1 << 20) break;
                var body = new byte[len];
                int total = 0;
                while (total < len)
                {
                    int n = await _pipe.ReadAsync(body, total, len - total, ct);
                    if (n <= 0) break;
                    total += n;
                }
                if (total < len) break;
                if (body[0] == (byte)'L')
                    LogReceived?.Invoke(Encoding.UTF8.GetString(body, 1, len - 1));
            }
        }
        catch { }
        finally
        {
            _pipe?.Dispose(); _pipe = null;
            Disconnected?.Invoke();
        }
    }
}
