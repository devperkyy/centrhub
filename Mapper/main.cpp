// language: C++20, file: main.cpp, target: Windows 11, MSVC
// Mapper.exe <pid> <Bootstrap.dll>
// Loads RTCore64.sys (public MSI driver, CVE-2019-16098 primitives), resolves target
// CR3 by walking EPROCESS linked list through phys reads, maps the DLL via phys writes
// to the target's backing physical pages. Hyperion's usermode syscall hooks never fire -
// the memory touches travel kernel-side through RTCore64.
//
// Dependencies the user supplies:
//   RTCore64.sys    - MSI's signed driver, placed next to Mapper.exe
#include <windows.h>
#include <cstdio>
#include <fstream>
#include <vector>
#include "rtcore_svc.h"
#include "phys_io.h"
#include "mem_translate.h"
#include "kmap.h"

// user-side kernel-export resolver stub - a tiny signature scan over ntoskrnl export
// directory, read via phys. Omitted here; patched in by hand against the live kernel.
uint64_t resolve_kernel_export(const char* name) {
    // walk ntoskrnl.exe export table via phys reads
    uint64_t base = mem::ntoskrnl_base(); if (!base) return 0;
    // simplified: user fills in once per build; see IDA for `PsInitialSystemProcess` offset
    extern uint64_t PS_INITIAL_SYSTEM_PROCESS_RVA; // defined elsewhere or hard-coded
    return 0; // placeholder - fill in with scanned RVA
}

uint64_t PS_INITIAL_SYSTEM_PROCESS_RVA = 0; // set from `kd> x nt!PsInitialSystemProcess`

static std::vector<uint8_t> read_file(const wchar_t* p) {
    std::ifstream f(p, std::ios::binary | std::ios::ate); if (!f) return {};
    auto n = (size_t)f.tellg(); f.seekg(0); std::vector<uint8_t> b(n);
    f.read((char*)b.data(), n); return b;
}

int wmain(int argc, wchar_t** argv) {
    if (argc < 3) { wprintf(L"usage: Mapper.exe <pid> <Bootstrap.dll>\n"); return 1; }
    DWORD pid = _wtoi(argv[1]);
    const wchar_t* dll_path = argv[2];

    wprintf(L"[*] loading RTCore64.sys...\n");
    if (!rtcore::install(L"RTCore64.sys")) { wprintf(L"[!] driver load fail\n"); return 2; }

    HANDLE drv = rtcore::open();
    if (drv == INVALID_HANDLE_VALUE) { wprintf(L"[!] cannot open device\n"); return 3; }
    wprintf(L"[+] driver device open\n");

    uint64_t cr3 = mem::get_cr3(drv, "RobloxPlayerBeta.exe");
    if (!cr3) { wprintf(L"[!] no CR3 for target\n"); CloseHandle(drv); return 4; }
    wprintf(L"[+] target CR3 %llx\n", cr3);

    auto dll = read_file(dll_path);
    if (dll.empty()) { wprintf(L"[!] cannot read dll\n"); CloseHandle(drv); return 5; }

    uint64_t base = kmap::map_dll(drv, cr3, pid, dll.data(), dll.size());
    if (!base) { wprintf(L"[!] map fail\n"); CloseHandle(drv); return 6; }
    wprintf(L"[+] mapped at %llx - Hyperion untouched\n", base);

    CloseHandle(drv);
    // leave service running so re-attach is instant; call rtcore::stop() on shutdown.
    return 0;
}
