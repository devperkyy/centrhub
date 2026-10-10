#pragma once
#include <windows.h>
#include <cstdint>
namespace mem {
    // find target EPROCESS by image name, return its DirectoryTableBase (CR3)
    uint64_t get_cr3(HANDLE drv, const char* image_name);
    // walk the 4-level page tables rooted at cr3 to resolve a target VA to PA
    uint64_t va_to_pa(HANDLE drv, uint64_t cr3, uint64_t va);

    // helpers
    uint64_t ntoskrnl_base();           // from NtQuerySystemInformation
    uint64_t find_eprocess(HANDLE drv, const char* image_name);
}
