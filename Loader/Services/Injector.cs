// Native injector facade: finds Roblox, invokes Injector.exe or does CreateRemoteThread fallback
// Prefer the native Injector binary - handles manual mapping; this is the safety net.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace RobloxExecutor.Services;

public static class Injector
{
    public static Process? FindRoblox()
    {
        foreach (var name in new[] { "RobloxPlayerBeta", "Roblox", "RobloxPlayerLauncher" })
            foreach (var p in Process.GetProcessesByName(name))
                return p;
        return null;
    }

    public static bool Inject(int pid)
    {
        var dll = Path.GetFullPath("Bootstrap.dll");
        if (!File.Exists(dll)) return false;

        var native = Path.GetFullPath("Injector.exe");
        if (File.Exists(native))
        {
            var psi = new ProcessStartInfo(native, $"{pid} \"{dll}\"")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true
            };
            using var proc = Process.Start(psi)!;
            proc.WaitForExit(10_000);
            return proc.ExitCode == 0;
        }

        // fallback: CreateRemoteThread + LoadLibrary (loud, Hyperion catches - use native for serious work)
        return LoadLibInject(pid, dll);
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr VirtualAllocEx(IntPtr h, IntPtr addr, uint size, uint type, uint prot);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool WriteProcessMemory(IntPtr h, IntPtr addr, byte[] buf, uint size, out IntPtr written);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateRemoteThread(IntPtr h, IntPtr sa, uint stack, IntPtr start, IntPtr param, uint flags, IntPtr tid);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetModuleHandleW(string name);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetProcAddress(IntPtr mod, string name);
    [DllImport("kernel32.dll")]
    static extern uint WaitForSingleObject(IntPtr h, uint ms);

    const uint PROCESS_ALL = 0x1F0FFF;
    const uint MEM_COMMIT = 0x1000;
    const uint PAGE_RW = 0x04;

    static bool LoadLibInject(int pid, string dll)
    {
        var h = OpenProcess(PROCESS_ALL, false, pid);
        if (h == IntPtr.Zero) return false;
        var bytes = System.Text.Encoding.Unicode.GetBytes(dll + "\0");
        var remote = VirtualAllocEx(h, IntPtr.Zero, (uint)bytes.Length, MEM_COMMIT, PAGE_RW);
        if (remote == IntPtr.Zero) return false;
        if (!WriteProcessMemory(h, remote, bytes, (uint)bytes.Length, out _)) return false;
        var load = GetProcAddress(GetModuleHandleW("kernel32.dll"), "LoadLibraryW");
        var th = CreateRemoteThread(h, IntPtr.Zero, 0, load, remote, 0, IntPtr.Zero);
        if (th == IntPtr.Zero) return false;
        WaitForSingleObject(th, 5000);
        return true;
    }
}
