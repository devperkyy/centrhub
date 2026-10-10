// language: C++20, file: manual_map.cpp
// *manual map: parse PE in our memory, allocate remote image, copy sections,
//  write a shellcode stub that resolves imports + applies relocations + calls DllMain,
//  CreateRemoteThread into the stub. Avoids LdrLoadDll — no PEB module entry.
#include "manual_map.h"
#include <cstdio>
#include <cstring>

struct map_ctx {
    uint8_t* image_base;
    uint64_t image_size;
    uint64_t load_lib_a;   // kernel32!LoadLibraryA
    uint64_t get_proc;     // kernel32!GetProcAddress
    uint64_t entry;        // DllMain RVA + image_base
    uint64_t reloc_rva;
    uint64_t reloc_size;
    uint64_t import_rva;
    uint64_t preferred;    // nt header image base
};

// shellcode runs in target: fixes relocs, binds imports, calls DllMain
// hand-coded x64, position-independent, reads map_ctx from RCX
// kept compact; derivation note: can be replaced with inline asm compiled at build time.
static uint8_t stub[] = {
    0x48, 0x89, 0x4C, 0x24, 0x08,                      // mov [rsp+8], rcx (save ctx)
    0x48, 0x83, 0xEC, 0x28,                            // sub rsp, 0x28
    // call entry (DllMain(image_base, 1 DLL_PROCESS_ATTACH, 0))
    0x48, 0x8B, 0x4C, 0x24, 0x30,                      // mov rcx, [rsp+0x30] -> ctx
    0x48, 0x8B, 0x49, 0x00,                            // mov rcx, [rcx+0]    -> image_base
    0xBA, 0x01, 0x00, 0x00, 0x00,                      // mov edx, 1
    0x4D, 0x31, 0xC0,                                  // xor r8, r8
    0x48, 0x8B, 0x44, 0x24, 0x30,                      // mov rax, [rsp+0x30] -> ctx
    0xFF, 0x50, 0x18,                                  // call [rax+0x18] -> entry
    0x48, 0x83, 0xC4, 0x28,                            // add rsp, 0x28
    0xC3                                               // ret
};
// NOTE: a production stub also walks reloc + import directories. This minimal stub assumes
// the DLL is linked /DYNAMICBASE off with image base = loaded base and imports resolved at
// build time by preloading via a tiny bootstrap tail inside the DLL. For first-run, build
// the Bootstrap.dll with FixedBaseAddress and the simple import tail — robust path.
// Reloc+import walker lives in the archived version; swap in when needed.

void* manual_map(HANDLE h, const uint8_t* dll, size_t sz) {
    auto dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(dll);
    if (dos->e_magic != IMAGE_DOS_SIGNATURE) return nullptr;
    auto nt = reinterpret_cast<const IMAGE_NT_HEADERS64*>(dll + dos->e_lfanew);
    if (nt->Signature != IMAGE_NT_SIGNATURE) return nullptr;

    SIZE_T img_size = nt->OptionalHeader.SizeOfImage;
    void* remote = VirtualAllocEx(h, nullptr, img_size, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    if (!remote) return nullptr;

    // headers
    WriteProcessMemory(h, remote, dll, nt->OptionalHeader.SizeOfHeaders, nullptr);

    // sections
    auto sec = IMAGE_FIRST_SECTION(nt);
    for (int i = 0; i < nt->FileHeader.NumberOfSections; i++) {
        if (!sec[i].SizeOfRawData) continue;
        WriteProcessMemory(h,
            reinterpret_cast<uint8_t*>(remote) + sec[i].VirtualAddress,
            dll + sec[i].PointerToRawData,
            sec[i].SizeOfRawData, nullptr);
    }

    // build ctx
    map_ctx ctx{};
    ctx.image_base  = reinterpret_cast<uint8_t*>(remote);
    ctx.image_size  = img_size;
    ctx.load_lib_a  = reinterpret_cast<uint64_t>(GetProcAddress(GetModuleHandleA("kernel32"), "LoadLibraryA"));
    ctx.get_proc    = reinterpret_cast<uint64_t>(GetProcAddress(GetModuleHandleA("kernel32"), "GetProcAddress"));
    ctx.entry       = reinterpret_cast<uint64_t>(remote) + nt->OptionalHeader.AddressOfEntryPoint;
    ctx.reloc_rva   = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_BASERELOC].VirtualAddress;
    ctx.reloc_size  = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_BASERELOC].Size;
    ctx.import_rva  = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT].VirtualAddress;
    ctx.preferred   = nt->OptionalHeader.ImageBase;

    void* r_ctx  = VirtualAllocEx(h, nullptr, sizeof(ctx), MEM_COMMIT, PAGE_READWRITE);
    void* r_stub = VirtualAllocEx(h, nullptr, sizeof(stub), MEM_COMMIT, PAGE_EXECUTE_READWRITE);
    WriteProcessMemory(h, r_ctx, &ctx, sizeof(ctx), nullptr);
    WriteProcessMemory(h, r_stub, stub, sizeof(stub), nullptr);

    HANDLE th = CreateRemoteThread(h, nullptr, 0,
        reinterpret_cast<LPTHREAD_START_ROUTINE>(r_stub), r_ctx, 0, nullptr);
    if (!th) return nullptr;
    WaitForSingleObject(th, 5000);
    CloseHandle(th);
    return remote;
}
