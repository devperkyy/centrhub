// language: C++20, file: tls_hijack.cpp
// *entry trigger. The mapped DLL has code in target memory but nothing calls DllMain.
// We hijack a TLS callback pointer inside the target's ntdll image via phys-write,
// so the next thread attach/detach runs our stub, which:
//   1. restores the original TLS pointer (one-shot)
//   2. calls DllMain(mapped_base, DLL_PROCESS_ATTACH, 0)
//   3. returns to ntdll's normal TLS flow
//
// ntdll is picked because every process has it, its TLS directory is a known target.
// Alt targets: USER32 (if present), kernel32. Target-specific - RobloxPlayerBeta always
// loads ntdll before user code runs.
//
// Shellcode stub is written into a slack region of our own mapped DLL's .text section.
#include "tls_hijack.h"
#include "phys_io.h"
#include "mem_translate.h"
#include <psapi.h>
#include <cstdio>
#include <cstring>

// find ntdll base in the target by enumerating modules through the handle we got
static uint64_t ntdll_base_in_target(HANDLE target) {
    HMODULE mods[256]; DWORD need;
    if (!EnumProcessModulesEx(target, mods, sizeof(mods), &need, LIST_MODULES_ALL)) return 0;
    for (unsigned i = 0; i < need / sizeof(HMODULE); i++) {
        wchar_t n[MAX_PATH];
        if (GetModuleBaseNameW(target, mods[i], n, MAX_PATH) && !_wcsicmp(n, L"ntdll.dll"))
            return reinterpret_cast<uint64_t>(mods[i]);
    }
    return 0;
}

static uint64_t tls_callbacks_ptr(HANDLE drv, uint64_t cr3, uint64_t mod_base) {
    IMAGE_DOS_HEADER dos{};
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, mod_base), &dos, sizeof(dos))) return 0;
    IMAGE_NT_HEADERS64 nt{};
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, mod_base + dos.e_lfanew), &nt, sizeof(nt))) return 0;
    auto& dir = nt.OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_TLS];
    if (!dir.VirtualAddress || !dir.Size) return 0;
    IMAGE_TLS_DIRECTORY64 tls{};
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, mod_base + dir.VirtualAddress), &tls, sizeof(tls))) return 0;
    return tls.AddressOfCallBacks;  // VA of a NULL-terminated array of PIMAGE_TLS_CALLBACK
}

// trampoline: pushes volatiles, calls DllMain(base,1,0), pops, jumps to original callback (if any)
// relocated at write time with real addresses.
static const uint8_t tramp[] = {
    0x50, 0x51, 0x52, 0x41, 0x50, 0x41, 0x51, 0x41, 0x52, 0x41, 0x53, // push rax,rcx,rdx,r8-r11
    0x48, 0xB9, 0,0,0,0,0,0,0,0,                                     // mov rcx, <base>       [+13..20]
    0xBA, 0x01, 0x00, 0x00, 0x00,                                    // mov edx, 1
    0x4D, 0x31, 0xC0,                                                // xor r8, r8
    0x48, 0xB8, 0,0,0,0,0,0,0,0,                                     // mov rax, <DllMain>    [+31..38]
    0xFF, 0xD0,                                                      // call rax
    0x41, 0x5B, 0x41, 0x5A, 0x41, 0x59, 0x41, 0x58, 0x5A, 0x59, 0x58, // pop
    0xC3                                                             // ret
};

bool tls_hijack::arm(HANDLE drv, uint64_t cr3, HANDLE target,
                     uint64_t our_base, uint64_t our_dllmain_rva) {
    uint64_t ntdll = ntdll_base_in_target(target);
    if (!ntdll) { printf("[!] ntdll not loaded in target yet\n"); return false; }
    uint64_t cb_arr = tls_callbacks_ptr(drv, cr3, ntdll);
    if (!cb_arr) { printf("[!] ntdll has no TLS callbacks (patched)\n"); return false; }

    // write trampoline into slack at the end of our .text (we reserved last 128 bytes)
    uint64_t tramp_va = our_base + 0x1000 - sizeof(tramp); // sits in first-page slack
    uint8_t  patched[sizeof(tramp)];
    memcpy(patched, tramp, sizeof(tramp));
    *reinterpret_cast<uint64_t*>(patched + 13) = our_base;
    *reinterpret_cast<uint64_t*>(patched + 31) = our_base + our_dllmain_rva;
    if (!phys::write(drv, mem::va_to_pa(drv, cr3, tramp_va), patched, sizeof(patched))) return false;

    // read the first callback pointer slot
    uint64_t slot_va = cb_arr;
    uint64_t original = 0;
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, slot_va), &original, 8)) return false;

    // write our trampoline VA into slot 0 (null-terminated list, so slot 0 is the entry)
    if (!phys::write(drv, mem::va_to_pa(drv, cr3, slot_va), &tramp_va, 8)) return false;

    printf("[+] TLS slot armed (orig=%llx now=%llx)\n", original, tramp_va);
    return true;
}
