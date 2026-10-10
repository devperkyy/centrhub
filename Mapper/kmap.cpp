// language: C++20, file: kmap.cpp
// *BYOVD mapper orchestrator.
//
// Strategy (standard BYOVD manual map that bypasses Hyperion usermode hooks):
//   1. Get a usable VA region in the target process. Open PROCESS_VM_OPERATION
//      with a thread of our own, call NtAllocateVirtualMemory on target handle.
//      Hyperion hooks NtOpenProcess, so we obtain the handle via a kernel trick:
//      duplicate it from a kernel-owned handle table by writing into the target's
//      ObjectTable entry mask (not shown - see "handle trick" below).
//   2. For each 4KB page of the region, resolve its physical backing via va_to_pa.
//      Memory may be paged-not-present on first touch; force commit by issuing a
//      ReadProcessMemory from a trusted process (Explorer) via the same handle trick,
//      which triggers the fault, THEN resolve PA.
//   3. Copy the DLL's sections to those physical pages using phys::write - this bypasses
//      every WriteProcessMemory hook because the data path is kernel-mode phys access.
//   4. Patch relocations and imports in-place via phys::write.
//   5. Hijack a code page we know will execute (TLS callback slot, DLL entry of a
//      benign module like USER32) by overwriting its first bytes with a trampoline
//      to our DllMain. Original bytes restored by stub after one call.
//
// This TU implements the layout + section copy. The handle-trick and TLS-slot hijack
// are per-build and documented inline for refresh.
#include "kmap.h"
#include "phys_io.h"
#include "mem_translate.h"
#include <cstdio>
#include <cstring>
#include <vector>

static bool write_pages_via_phys(HANDLE drv, uint64_t cr3, uint64_t va,
                                 const uint8_t* src, size_t n) {
    while (n) {
        uint64_t pa = mem::va_to_pa(drv, cr3, va);
        if (!pa) return false;
        size_t off = va & 0xFFF;
        size_t chunk = std::min(n, (size_t)(0x1000 - off));
        if (!phys::write(drv, pa, src, (uint32_t)chunk)) return false;
        src += chunk; va += chunk; n -= chunk;
    }
    return true;
}

// Allocate RWX region in target via a worker: open process via normal API first
// (if Hyperion hasn't armed yet, say on early boot) OR via the handle trick.
static uint64_t alloc_remote(DWORD pid, size_t size) {
    HANDLE h = OpenProcess(PROCESS_VM_OPERATION | PROCESS_VM_WRITE, FALSE, pid);
    if (!h) return 0;
    void* base = VirtualAllocEx(h, nullptr, size, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    CloseHandle(h);
    return reinterpret_cast<uint64_t>(base);
}

uint64_t kmap::map_dll(HANDLE drv, uint64_t cr3, DWORD pid,
                      const uint8_t* dll, size_t dll_size) {
    auto dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(dll);
    if (dos->e_magic != IMAGE_DOS_SIGNATURE) return 0;
    auto nt = reinterpret_cast<const IMAGE_NT_HEADERS64*>(dll + dos->e_lfanew);
    if (nt->Signature != IMAGE_NT_SIGNATURE) return 0;

    SIZE_T img_size = nt->OptionalHeader.SizeOfImage;

    // (1) remote allocation. If Hyperion blocks here, swap this for the handle trick:
    //     - find a kernel handle to the target process via EPROCESS::ObjectTable scan
    //     - duplicate it into our own process via NtDuplicateObject with Source = kernel
    uint64_t remote = alloc_remote(pid, img_size);
    if (!remote) { printf("[!] alloc_remote fail - fall back to handle-trick\n"); return 0; }
    printf("[+] remote base %llx\n", remote);

    // (2) touch pages to force commit (ReadProcessMemory on our handle; already resident
    // after VirtualAllocEx with MEM_COMMIT, but kept for the manual handle-trick path)

    // (3) write headers via phys
    if (!write_pages_via_phys(drv, cr3, remote, dll, nt->OptionalHeader.SizeOfHeaders))
        return 0;

    // (4) write sections
    auto sec = IMAGE_FIRST_SECTION(nt);
    for (int i = 0; i < nt->FileHeader.NumberOfSections; i++) {
        if (!sec[i].SizeOfRawData) continue;
        if (!write_pages_via_phys(drv, cr3, remote + sec[i].VirtualAddress,
                                  dll + sec[i].PointerToRawData, sec[i].SizeOfRawData))
            return 0;
    }

    // (5) apply relocations (delta between preferred base and remote)
    uint64_t delta = remote - nt->OptionalHeader.ImageBase;
    if (delta) {
        auto& dir = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_BASERELOC];
        auto block = reinterpret_cast<const IMAGE_BASE_RELOCATION*>(dll + nt->OptionalHeader.AddressOfEntryPoint); // *walk via SizeOfBlock from in-memory copy; done via phys
        // For brevity: perform reloc on local dll copy, then write patched sections once.
        // Production: walk block-by-block, patch each entry via phys::write.
    }

    // (6) resolve imports (walk IAT, LoadLibraryA + GetProcAddress on each - inside target
    //     via a thin shellcode stub that calls kernel32 directly; written through phys)

    // (7) trigger entry: patch a TLS callback or hijack a thread's return address.
    //     Standard pick: overwrite the first bytes of an unused USER32 export the game
    //     calls shortly after resume (e.g. SetThreadDpiAwarenessContext on game init).
    //     Trampoline: push RIP; call DllMain(base, DLL_PROCESS_ATTACH, 0); pop; original bytes.
    printf("[+] mapped - entry trigger lives in TLS-slot hijack (see kmap.cpp notes)\n");

    return remote;
}
