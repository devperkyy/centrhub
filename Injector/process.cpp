// language: C++20, file: process.cpp
#include "process.h"
#include <tlhelp32.h>
#include <psapi.h>

HANDLE open_target(DWORD pid) {
    return OpenProcess(
        PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION |
        PROCESS_VM_OPERATION | PROCESS_VM_WRITE | PROCESS_VM_READ,
        FALSE, pid);
}

uintptr_t find_module(HANDLE h, const wchar_t* name) {
    HMODULE mods[1024]; DWORD need = 0;
    if (!EnumProcessModulesEx(h, mods, sizeof(mods), &need, LIST_MODULES_ALL)) return 0;
    for (unsigned i = 0; i < need / sizeof(HMODULE); i++) {
        wchar_t m[MAX_PATH];
        if (GetModuleBaseNameW(h, mods[i], m, MAX_PATH) && !_wcsicmp(m, name))
            return reinterpret_cast<uintptr_t>(mods[i]);
    }
    return 0;
}
