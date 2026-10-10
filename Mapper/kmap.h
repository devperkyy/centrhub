#pragma once
#include <windows.h>
#include <cstdint>
namespace kmap {
    // High-level: load DLL image into target process using phys-write primitive.
    // Returns remote base of mapped image on success, 0 on fail.
    uint64_t map_dll(HANDLE drv, uint64_t cr3, DWORD pid,
                     const uint8_t* dll_bytes, size_t dll_size);
}
