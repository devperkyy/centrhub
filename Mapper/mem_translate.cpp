// language: C++20, file: mem_translate.cpp
// *VA->PA walk via arbitrary phys read primitive.
// Four indices on x64 Intel: PML4[47:39] PDPT[38:30] PD[29:21] PT[20:12] PO[11:0]
// Large/huge pages (PS bit) handled at PD/PDPT.
//
// Target CR3: pulled from EPROCESS::DirectoryTableBase. We don't call PsLookupProcessByImage
// here (no kernel ctx); instead we scan the EPROCESS linked list that begins at
// PsInitialSystemProcess (exported from ntoskrnl), reading each node via phys r.
#include "mem_translate.h"
#include "phys_io.h"
#include <winternl.h>
#include <vector>
#include <cstring>
#include <cstdio>

#pragma comment(lib, "ntdll.lib")

// EPROCESS offsets - PATCHWISE per Windows build. These are correct for recent 23H2 kernels.
// Refresh with WinDbg: `dt nt!_EPROCESS` and look at the *UniqueProcessId*, *ImageFileName*,
// *ActiveProcessLinks*, *DirectoryTableBase* fields.
struct eproc_offs {
    uint32_t unique_pid;
    uint32_t links;         // ActiveProcessLinks (LIST_ENTRY)
    uint32_t image_name;    // 15-byte ImageFileName
    uint32_t dtb;           // DirectoryTableBase
};
// Windows 11 23H2 (Oct 2026) - refresh if a Patch Tuesday shifts them
static const eproc_offs K_OFFS = { 0x440, 0x448, 0x5a8, 0x28 };

typedef NTSTATUS (NTAPI* NtQuerySystemInformation_t)(ULONG, PVOID, ULONG, PULONG);

uint64_t mem::ntoskrnl_base() {
    HMODULE nt = GetModuleHandleW(L"ntdll.dll");
    auto NtQSI = (NtQuerySystemInformation_t)GetProcAddress(nt, "NtQuerySystemInformation");
    ULONG need = 0; NtQSI(11 /*SystemModuleInformation*/, nullptr, 0, &need);
    std::vector<uint8_t> buf(need);
    if (NtQSI(11, buf.data(), need, &need) != 0) return 0;
    // SYSTEM_MODULE_INFORMATION: ULONG count; then array of RTL_PROCESS_MODULE_INFORMATION
    uint32_t count = *(uint32_t*)buf.data();
    struct mod { uintptr_t sect; uintptr_t handle; uintptr_t base; ULONG size; ULONG flags; USHORT lo; USHORT idx; USHORT nlen; USHORT nmo; char name[256]; };
    auto mods = reinterpret_cast<mod*>(buf.data() + 8);
    return mods[0].base; // first entry is ntoskrnl
}

uint64_t mem::find_eprocess(HANDLE drv, const char* image_name) {
    uint64_t nt = ntoskrnl_base(); if (!nt) return 0;
    // PsInitialSystemProcess is exported - resolve via dbghelp or hardcoded RVA from a
    // signature scan of the loaded kernel. For brevity we expect a user-side resolver:
    extern uint64_t resolve_kernel_export(const char* name);
    uint64_t p_ps_init = resolve_kernel_export("PsInitialSystemProcess"); // u64* -> EPROCESS of System
    if (!p_ps_init) return 0;

    // follow the LIST_ENTRY ring
    uint64_t head = 0;
    if (!phys::read(drv, p_ps_init, &head, 8)) return 0;
    uint64_t cur = head, start = head;
    char name[16] = {};
    for (int i = 0; i < 2048; i++) {
        uint64_t name_va = cur + K_OFFS.image_name;
        if (!phys::read(drv, name_va, name, 15)) break;
        name[15] = 0;
        if (_stricmp(name, image_name) == 0) return cur;
        uint64_t flink_va = cur + K_OFFS.links;
        if (!phys::read(drv, flink_va, &cur, 8)) break;
        cur -= K_OFFS.links;    // FLINK points to next EPROCESS's LIST_ENTRY; subtract offset
        if (cur == start) break;
    }
    return 0;
}

uint64_t mem::get_cr3(HANDLE drv, const char* image_name) {
    uint64_t eproc = find_eprocess(drv, image_name);
    if (!eproc) return 0;
    uint64_t cr3 = 0;
    phys::read(drv, eproc + K_OFFS.dtb, &cr3, 8);
    return cr3 & ~0xFFFull;
}

uint64_t mem::va_to_pa(HANDLE drv, uint64_t cr3, uint64_t va) {
    auto idx = [&](int lvl) { return (va >> (12 + 9*lvl)) & 0x1FF; };
    uint64_t pml4e, pdpte, pde, pte;
    if (!phys::read(drv, cr3 + idx(3)*8, &pml4e, 8) || !(pml4e & 1)) return 0;
    uint64_t pdpt = pml4e & 0x000FFFFFFFFFF000ULL;
    if (!phys::read(drv, pdpt + idx(2)*8, &pdpte, 8) || !(pdpte & 1)) return 0;
    if (pdpte & (1ULL<<7)) /* 1GB page */
        return (pdpte & 0x000FFFFFC0000000ULL) | (va & 0x3FFFFFFF);
    uint64_t pd = pdpte & 0x000FFFFFFFFFF000ULL;
    if (!phys::read(drv, pd + idx(1)*8, &pde, 8) || !(pde & 1)) return 0;
    if (pde & (1ULL<<7)) /* 2MB page */
        return (pde & 0x000FFFFFFFE00000ULL) | (va & 0x1FFFFF);
    uint64_t pt = pde & 0x000FFFFFFFFFF000ULL;
    if (!phys::read(drv, pt + idx(0)*8, &pte, 8) || !(pte & 1)) return 0;
    return (pte & 0x000FFFFFFFFFF000ULL) | (va & 0xFFF);
}
