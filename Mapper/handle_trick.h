#pragma once
#include <windows.h>
#include <cstdint>
namespace handle_trick {
    // Obtain a full-access handle to target pid WITHOUT calling OpenProcess
    // (which Hyperion hooks). Works by rewriting an existing handle's AccessMask
    // in our own ObjectTable via phys-write, or by duplicating from System.
    HANDLE elevate(HANDLE drv, uint64_t cr3, DWORD target_pid);
}
