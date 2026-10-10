// language: C++20, file: handle_trick.cpp
// *Hyperion-blind handle acquisition.
//
// We open a DEFLATED handle to the target first - PROCESS_QUERY_LIMITED_INFORMATION
// is almost always allowed because explorer/task-mgr need it. Hyperion lets this one
// through. Then we locate THAT handle's entry in our own process's HANDLE_TABLE via
// phys-reads, and rewrite its GrantedAccess field to PROCESS_ALL_ACCESS.
//
// Alternative (not implemented here): duplicate from PsInitialSystemProcess's handle
// table - System has a full-access handle to every process it spawned. Both routes
// bypass Hyperion because the write path travels through RTCore64's phys IOCTL,
// not through NtDuplicateObject / NtOpenProcess.
#include "handle_trick.h"
#include "phys_io.h"
#include "mem_translate.h"
#include <cstdio>

// _HANDLE_TABLE_ENTRY on x64 Win11 23H2: single 64-bit value,
//   bits [00..02] : TagBits (3 bits, locked / audit / inherit)
//   bits [03..31] : ObjectPointerBits (shifted left 4 to get kernel-ptr lower 32)
//   bits [32..63] : GrantedAccess (upper 32 bits are the access mask)
//
// EPROCESS::ObjectTable offset per build - refresh with WinDbg. 23H2 ~ 0x570.
static constexpr uint32_t EPROC_OBJTABLE = 0x570;

// HANDLE_TABLE layout (nt!_HANDLE_TABLE) - we only need TableCode (lvl2/lvl3 tree root).
static constexpr uint32_t HT_TABLE_CODE  = 0x08;

static uint64_t resolve_handle_entry(HANDLE drv, uint64_t cr3, uint64_t eproc, HANDLE h) {
    uint64_t ht_va = 0;
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, eproc + EPROC_OBJTABLE), &ht_va, 8)) return 0;
    uint64_t table_code = 0;
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, ht_va + HT_TABLE_CODE), &table_code, 8)) return 0;

    // handle index = (HANDLE_VALUE / 4); low bits of table_code mark levels.
    uint64_t idx = reinterpret_cast<uint64_t>(h) >> 2;
    uint64_t level = table_code & 3;
    uint64_t root  = table_code & ~3ULL;

    constexpr uint64_t L0_CAP = 256;        // entries per leaf page
    constexpr uint64_t L1_CAP = 256 * 512;  // mid-level cap

    if (level == 0) {
        return root + idx * 16;             // single leaf, 16-byte entries
    }
    if (level == 1) {
        uint64_t mid_idx = idx / L0_CAP;
        uint64_t leaf;
        if (!phys::read(drv, mem::va_to_pa(drv, cr3, root + mid_idx * 8), &leaf, 8)) return 0;
        return leaf + (idx % L0_CAP) * 16;
    }
    // level 2 (deepest)
    uint64_t top_idx = idx / L1_CAP;
    uint64_t mid;
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, root + top_idx * 8), &mid, 8)) return 0;
    uint64_t mid_idx = (idx / L0_CAP) % 512;
    uint64_t leaf;
    if (!phys::read(drv, mem::va_to_pa(drv, cr3, mid + mid_idx * 8), &leaf, 8)) return 0;
    return leaf + (idx % L0_CAP) * 16;
}

HANDLE handle_trick::elevate(HANDLE drv, uint64_t cr3, DWORD pid) {
    // step 1: get the handle Hyperion lets through
    HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!h) { printf("[!] even QUERY_LIMITED refused\n"); return nullptr; }

    // step 2: find our own EPROCESS to walk its handle table
    uint64_t self_cr3 = mem::get_cr3(drv, "Mapper.exe");
    uint64_t self_eproc = mem::find_eprocess(drv, "Mapper.exe");
    if (!self_cr3 || !self_eproc) { CloseHandle(h); return nullptr; }

    // step 3: locate the handle entry
    uint64_t entry_va = resolve_handle_entry(drv, self_cr3, self_eproc, h);
    if (!entry_va) { CloseHandle(h); return nullptr; }
    uint64_t entry_pa = mem::va_to_pa(drv, self_cr3, entry_va);
    if (!entry_pa) { CloseHandle(h); return nullptr; }

    // step 4: read current, patch upper 32 bits (GrantedAccess) to ALL_ACCESS
    uint64_t cur = 0;
    if (!phys::read(drv, entry_pa, &cur, 8)) { CloseHandle(h); return nullptr; }
    uint64_t patched = (cur & 0x00000000FFFFFFFFULL) | ((uint64_t)PROCESS_ALL_ACCESS << 32);
    if (!phys::write(drv, entry_pa, &patched, 8)) { CloseHandle(h); return nullptr; }

    printf("[+] handle 0x%p elevated via phys-write (Hyperion blind)\n", h);
    return h;
}
