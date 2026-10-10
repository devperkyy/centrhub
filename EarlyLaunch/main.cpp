// language: C++20, file: main.cpp, target: Windows 11, MSVC
// EarlyLaunch - spawns Roblox client suspended, manual-maps Bootstrap.dll BEFORE
// Hyperion's syscall hooks arm, resumes. Beats Hyperion on usermode because its
// entry-point TLS callbacks run after the process is created and before it executes
// user code; we land our DLL during that window.
//
// Usage: EarlyLaunch.exe <path-to-RobloxPlayerBeta.exe> <args...> [-dll Bootstrap.dll]
//
// How we find the client when path is omitted:
//   HKCU\Software\ROBLOX Corporation\Environments\roblox-player\clientExe
#include <windows.h>
#include <shlwapi.h>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#include <fstream>
#include "manual_map.h"

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "advapi32.lib")

static std::wstring find_client_from_reg() {
    HKEY k; wchar_t buf[MAX_PATH]; DWORD sz = sizeof(buf); DWORD type = 0;
    const wchar_t* subkey = L"Software\\ROBLOX Corporation\\Environments\\roblox-player";
    if (RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ, &k) != ERROR_SUCCESS) return L"";
    LSTATUS r = RegQueryValueExW(k, L"clientExe", nullptr, &type, (LPBYTE)buf, &sz);
    RegCloseKey(k);
    if (r == ERROR_SUCCESS && type == REG_SZ) return buf;
    return L"";
}

static std::vector<uint8_t> read_file(const wchar_t* p) {
    std::ifstream f(p, std::ios::binary | std::ios::ate);
    if (!f) return {};
    auto n = (size_t)f.tellg(); f.seekg(0);
    std::vector<uint8_t> buf(n); f.read((char*)buf.data(), n);
    return buf;
}

int wmain(int argc, wchar_t** argv) {
    std::wstring client, dll_path = L"Bootstrap.dll";
    std::wstring extra_args;

    for (int i = 1; i < argc; i++) {
        std::wstring a = argv[i];
        if (a == L"-dll" && i + 1 < argc) { dll_path = argv[++i]; continue; }
        if (client.empty() && PathFileExistsW(a.c_str())) { client = a; continue; }
        if (!extra_args.empty()) extra_args += L' ';
        extra_args += a;
    }
    if (client.empty()) client = find_client_from_reg();
    if (client.empty()) { wprintf(L"[!] no RobloxPlayerBeta.exe path (pass as arg or from registry)\n"); return 1; }
    wprintf(L"[*] client: %s\n", client.c_str());

    auto dll_bytes = read_file(dll_path.c_str());
    if (dll_bytes.empty()) { wprintf(L"[!] cannot read %s\n", dll_path.c_str()); return 2; }

    // launch suspended
    std::wstring cmd = L"\"" + client + L"\"";
    if (!extra_args.empty()) cmd += L' ' + extra_args;

    STARTUPINFOW si{sizeof(si)};
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE,
                        CREATE_SUSPENDED, nullptr, nullptr, &si, &pi)) {
        wprintf(L"[!] CreateProcess fail %lu\n", GetLastError()); return 3;
    }
    wprintf(L"[+] suspended pid %lu\n", pi.dwProcessId);

    // tiny settle - some loaders set up TLS before our first manual map runs
    Sleep(80);

    void* base = manual_map(pi.hProcess, dll_bytes.data(), dll_bytes.size());
    if (!base) {
        wprintf(L"[!] manual_map fail - terminating\n");
        TerminateProcess(pi.hProcess, 1); return 4;
    }
    wprintf(L"[+] bootstrap mapped at %p\n", base);

    ResumeThread(pi.hThread);
    wprintf(L"[+] resumed - Roblox running with VANTA in-process\n");

    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
    return 0;
}
