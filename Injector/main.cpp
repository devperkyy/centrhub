// language: C++20, file: main.cpp, target: Windows 11, MSVC
// Injector.exe <pid> <dll_path>  - manual-maps the bootstrap DLL into the target
#include <windows.h>
#include <cstdio>
#include <string>
#include <vector>
#include "process.h"
#include "manual_map.h"

int wmain(int argc, wchar_t** argv) {
    if (argc < 3) { wprintf(L"usage: Injector.exe <pid> <dll>\n"); return 1; }
    DWORD pid = _wtoi(argv[1]);
    const wchar_t* dll = argv[2];

    HANDLE h = open_target(pid);
    if (!h) { wprintf(L"[!] OpenProcess fail %lu\n", GetLastError()); return 2; }

    FILE* f = _wfopen(dll, L"rb");
    if (!f) { wprintf(L"[!] cannot read dll\n"); return 3; }
    fseek(f, 0, SEEK_END); long sz = ftell(f); fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> buf(sz);
    fread(buf.data(), 1, sz, f); fclose(f);

    void* base = manual_map(h, buf.data(), buf.size());
    if (!base) { wprintf(L"[!] manual_map fail\n"); return 4; }
    wprintf(L"[+] mapped at %p\n", base);
    CloseHandle(h);
    return 0;
}
