#pragma once
#include <windows.h>
#include <cstdint>
namespace phys {
    bool read (HANDLE drv, uint64_t pa, void* out, uint32_t size);
    bool write(HANDLE drv, uint64_t pa, const void* in, uint32_t size);
}
